import type { DashboardScope } from "../dashboard.types.js";
import { S3OptimizationRepository } from "./s3-optimization.repository.js";
import type {
  S3BucketLifecycleInsightResponse,
  S3PolicyActionHistoryResponse,
  S3LifecyclePolicyApplyRequest,
  S3LifecyclePolicyApplyResponse,
  S3OptimizationResponse,
} from "./s3-optimization.types.js";
import { BadRequestError, NotFoundError } from "../../../errors/http-errors.js";
import { CloudConnectionV2, S3BucketConfigSnapshot } from "../../../models/index.js";
import { assumeRole } from "../../cloud-connections/aws/infrastructure/aws-sts.service.js";
import {
  PutBucketLifecycleConfigurationCommand,
  S3Client,
  type BucketLifecycleConfiguration,
  type LifecycleRule,
  type Transition,
  type TransitionStorageClass,
} from "@aws-sdk/client-s3";

export class S3OptimizationService {
  constructor(private readonly repository: S3OptimizationRepository = new S3OptimizationRepository()) {}

  async getOptimization(scope: DashboardScope): Promise<S3OptimizationResponse> {
    const buckets = await this.repository.getLatestBucketLifecycleRows(scope);

    return {
      section: "s3-optimization",
      title: "S3 Optimization",
      message: "S3 optimization lifecycle data loaded",
      buckets,
    };
  }

  async getBucketLifecycleInsight(
    scope: DashboardScope,
    bucketName: string,
  ): Promise<S3BucketLifecycleInsightResponse> {
    const insight = await this.repository.getBucketLifecycleInsight(scope, bucketName);

    return {
      section: "s3-lifecycle-insight",
      title: "S3 Bucket Lifecycle Insight",
      message: "S3 lifecycle insight loaded",
      insight,
    };
  }

  async applyBucketLifecyclePolicy(
    scope: DashboardScope,
    payload: S3LifecyclePolicyApplyRequest,
    createdByUserId: string | null = null,
  ): Promise<S3LifecyclePolicyApplyResponse> {
    const normalizedBucketName = String(payload.bucketName ?? "").trim();
    const normalizedRuleName = String(payload.ruleName ?? "").trim();
    if (!normalizedBucketName) throw new BadRequestError("bucketName is required");
    if (!normalizedRuleName) throw new BadRequestError("ruleName is required");
    if (!["Enabled", "Disabled"].includes(payload.status)) throw new BadRequestError("status must be Enabled or Disabled");

    const context = await this.repository.getBucketLifecycleExecutionContext(scope, normalizedBucketName);
    const connection = await CloudConnectionV2.findOne({
      where: {
        id: context.cloudConnectionId,
        tenantId: scope.tenantId,
      },
    });
    if (!connection) throw new NotFoundError("Cloud connection not found for selected bucket");

    const roleArn = String(connection.actionRoleArn ?? connection.billingRoleArn ?? "").trim();
    const externalId = String(connection.externalId ?? "").trim() || null;
    const region = String(context.region ?? connection.region ?? "us-east-1").trim();
    if (!roleArn) throw new BadRequestError("Cloud connection missing action role ARN");

    const transitions = Array.isArray(payload.transitions) ? payload.transitions : [];
    const seenStorageClasses = new Set<string>();
    const normalizedTransitions: Array<{ Days: number; StorageClass: TransitionStorageClass }> = transitions
      .filter((item) => item && Number.isFinite(item.days))
      .map((item) => ({
        Days: Math.trunc(item.days),
        StorageClass: item.storageClass as TransitionStorageClass,
      }))
      .filter((item) => item.Days > 0 && ["STANDARD_IA", "GLACIER", "DEEP_ARCHIVE"].includes(String(item.StorageClass)))
      .sort((a, b) => a.Days - b.Days);
    if (normalizedTransitions.length !== transitions.length) {
      throw new BadRequestError("Invalid transitions. Use supported storage classes and positive days.");
    }

    for (const transition of normalizedTransitions) {
      const storageClass = String(transition.StorageClass);
      if (seenStorageClasses.has(storageClass)) {
        throw new BadRequestError(`Duplicate transition storage class: ${storageClass}`);
      }
      seenStorageClasses.add(storageClass);
    }

    for (let idx = 1; idx < normalizedTransitions.length; idx += 1) {
      const current = normalizedTransitions[idx];
      const previous = normalizedTransitions[idx - 1];
      if (current && previous && current.Days <= previous.Days) {
        throw new BadRequestError("Transition days must be strictly increasing");
      }
    }

    const expirationDays = payload.expirationDays == null ? null : Math.trunc(Number(payload.expirationDays));
    if (expirationDays != null && expirationDays <= 0) {
      throw new BadRequestError("expirationDays must be greater than 0");
    }
    if (
      expirationDays != null &&
      normalizedTransitions.length > 0 &&
      expirationDays <= (normalizedTransitions[normalizedTransitions.length - 1]?.Days ?? 0)
    ) {
      throw new BadRequestError("expirationDays must be greater than transition days");
    }

    const abortDays = payload.abortIncompleteMultipartUploadDays == null
      ? null
      : Math.trunc(Number(payload.abortIncompleteMultipartUploadDays));
    if (abortDays != null && abortDays <= 0) {
      throw new BadRequestError("abortIncompleteMultipartUploadDays must be greater than 0");
    }

    const scopeType = payload.scope?.type;
    const rawPrefix = String(payload.scope?.prefix ?? "").trim();
    if (scopeType !== "entire_bucket" && scopeType !== "prefix") {
      throw new BadRequestError("scope.type must be entire_bucket or prefix");
    }
    if (scopeType === "prefix" && !rawPrefix) {
      throw new BadRequestError("prefix is required when scope.type is prefix");
    }
    const normalizedPrefix = scopeType === "prefix"
      ? rawPrefix.replace(/^\/+/, "").replace(/\s+/g, "")
      : "";

    const lifecycleRule: LifecycleRule = {
      ID: normalizedRuleName,
      Status: payload.status,
      Filter: scopeType === "prefix" ? { Prefix: normalizedPrefix } : { Prefix: "" },
    };
    if (normalizedTransitions.length > 0) {
      lifecycleRule.Transitions = normalizedTransitions as Transition[];
    }
    if (expirationDays != null) {
      lifecycleRule.Expiration = { Days: expirationDays };
    }
    if (abortDays != null) {
      lifecycleRule.AbortIncompleteMultipartUpload = { DaysAfterInitiation: abortDays };
    }

    const lifecycleRules: LifecycleRule[] = [lifecycleRule];
    const lifecycleConfig: BucketLifecycleConfiguration = { Rules: lifecycleRules };
    const appliedPolicy = {
      Rules: lifecycleRules as unknown as Record<string, unknown>[],
    };
    const credentials = await assumeRole(roleArn, externalId);
    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    try {
      await s3Client.send(
        new PutBucketLifecycleConfigurationCommand({
          Bucket: normalizedBucketName,
          LifecycleConfiguration: lifecycleConfig,
        }),
      );

      await S3BucketConfigSnapshot.create({
        tenantId: scope.tenantId,
        cloudConnectionId: connection.id,
        providerId: connection.providerId ? Number(connection.providerId) : null,
        accountId: context.accountId,
        bucketName: normalizedBucketName,
        region,
        scanTime: new Date(),
        lifecycleStatus: "present",
        lifecycleRulesCount: lifecycleRules.length,
        lifecycleRulesJson: appliedPolicy,
        createdAt: new Date(),
      });

      await this.repository.createPolicyActionLog({
        tenantId: scope.tenantId,
        cloudConnectionId: connection.id,
        billingSourceId: null,
        providerId: connection.providerId ? Number(connection.providerId) : null,
        accountId: context.accountId || null,
        region: region || null,
        bucketName: normalizedBucketName,
        ruleName: normalizedRuleName,
        scopeType,
        scopePrefix: normalizedPrefix || null,
        status: "SUCCEEDED",
        errorMessage: null,
        requestPayloadJson: payload as unknown as Record<string, unknown>,
        responsePayloadJson: appliedPolicy,
        createdByUserId,
      });

      return {
        section: "s3-lifecycle-policy-apply",
        title: "S3 Lifecycle Policy Apply",
        message: "S3 lifecycle policy applied successfully in AWS and synced to dashboard snapshot",
        bucketName: normalizedBucketName,
        accountId: context.accountId,
        region,
        ruleName: normalizedRuleName,
        appliedPolicy,
      };
    } catch (error) {
      await this.repository.createPolicyActionLog({
        tenantId: scope.tenantId,
        cloudConnectionId: connection.id,
        billingSourceId: null,
        providerId: connection.providerId ? Number(connection.providerId) : null,
        accountId: context.accountId || null,
        region: region || null,
        bucketName: normalizedBucketName,
        ruleName: normalizedRuleName,
        scopeType,
        scopePrefix: normalizedPrefix || null,
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        requestPayloadJson: payload as unknown as Record<string, unknown>,
        responsePayloadJson: null,
        createdByUserId,
      });
      throw error;
    }
  }

  async getPolicyActionHistory(scope: DashboardScope): Promise<S3PolicyActionHistoryResponse> {
    const items = await this.repository.getPolicyActionHistory(scope);
    return {
      section: "policy-actions",
      title: "Policy Actions",
      message: "Policy action history loaded",
      items,
    };
  }
}
