import type { DashboardScope } from "../dashboard.types.js";
import { S3OptimizationRepository } from "./s3-optimization.repository.js";
import type {
  S3BucketLifecycleInsightResponse,
  S3PolicyActionHistoryResponse,
  S3LifecyclePolicyApplyRequest,
  S3LifecyclePolicyApplyResponse,
  S3OptimizationResponse,
} from "./s3-optimization.types.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../../errors/http-errors.js";
import { CloudConnectionV2, S3BucketConfigSnapshot } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { assumeRole } from "../../cloud-connections/aws/infrastructure/aws-sts.service.js";
import {
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
  S3Client,
  type BucketLifecycleConfiguration,
  type LifecycleRule,
  type Transition,
  type TransitionStorageClass,
} from "@aws-sdk/client-s3";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";

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
    const toAwsErrorCode = (error: unknown): string => {
      if (!error || typeof error !== "object") return "";
      const named = "name" in error ? String((error as { name?: string }).name ?? "") : "";
      const coded = "Code" in error ? String((error as { Code?: string }).Code ?? "") : "";
      const code = "code" in error ? String((error as { code?: string }).code ?? "") : "";
      return named || coded || code;
    };

    const isAwsAccessDeniedError = (error: unknown): boolean => {
      const errorCode = toAwsErrorCode(error).toLowerCase();
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message ?? "").toLowerCase()
          : "";
      const metadataStatus =
        error && typeof error === "object" && "$metadata" in error
          ? Number(((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ?? 0))
          : 0;
      return (
        errorCode.includes("accessdenied") ||
        errorCode.includes("accessdeniedexception") ||
        message.includes("access denied") ||
        message.includes("accessdenied") ||
        metadataStatus === 403
      );
    };

    const normalizedBucketName = String(payload.bucketName ?? "").trim();
    const normalizedAccountId = String(payload.accountId ?? "").trim();
    const requestedRegion = String(payload.region ?? "").trim();
    const normalizedRuleName = String(payload.ruleName ?? "").trim();
    if (!normalizedBucketName) throw new BadRequestError("bucketName is required");
    if (!normalizedRuleName) throw new BadRequestError("ruleName is required");
    if (!["Enabled", "Disabled"].includes(payload.status)) throw new BadRequestError("status must be Enabled or Disabled");

    const context = await this.repository.getBucketLifecycleExecutionContext(scope, normalizedBucketName);
    if (normalizedAccountId && normalizedAccountId !== context.accountId) {
      throw new BadRequestError(
        `Bucket/account mismatch. Bucket ${normalizedBucketName} is mapped to account ${context.accountId}.`,
      );
    }
    const connection = await CloudConnectionV2.findOne({
      where: {
        id: context.cloudConnectionId,
        tenantId: scope.tenantId,
      },
    });
    if (!connection) throw new NotFoundError("Cloud connection not found for selected bucket");

    const roleArn = String(connection.actionRoleArn ?? "").trim();
    const externalId = String(connection.externalId ?? "").trim() || null;
    const region = String(context.region ?? connection.region ?? "us-east-1").trim();
    if (requestedRegion && requestedRegion !== region) {
      throw new BadRequestError(`Region mismatch. Bucket ${normalizedBucketName} is mapped to region ${region}.`);
    }
    if (!roleArn) {
      throw new BadRequestError("Cloud connection missing ActionRoleArn required for lifecycle policy update");
    }

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
    if (scopeType === "prefix" && (rawPrefix.startsWith("/") || rawPrefix.includes("\\") || /\s/.test(rawPrefix))) {
      throw new BadRequestError("prefix must not start with '/', include backslashes, or contain whitespace");
    }
    const normalizedPrefix = scopeType === "prefix"
      ? rawPrefix
      : "";
    if (normalizedPrefix.length > 1024) {
      throw new BadRequestError("prefix is too long");
    }
    if (expirationDays != null && payload.deleteWarningAccepted !== true) {
      throw new BadRequestError("deleteWarningAccepted must be true when expirationDays is enabled");
    }

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

    const lifecycleConfig: BucketLifecycleConfiguration = { Rules: [lifecycleRule] };
    const billingSourceIds = scope.scopeType === "global" ? (scope.billingSourceIds ?? []) : [];
    logger.info("S3 lifecycle apply: prepared AWS request context", {
      tenantId: scope.tenantId,
      billingSourceIds,
      bucketName: normalizedBucketName,
      assumedRoleArn: roleArn,
      expectedAwsAccountId: context.accountId,
      region,
      lifecycleConfiguration: lifecycleConfig,
    });

    const writePolicyActionLogSafely = async (input: {
      status: "SUCCEEDED" | "FAILED";
      errorMessage: string | null;
      responsePayloadJson: Record<string, unknown> | null;
    }): Promise<void> => {
      try {
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
          status: input.status,
          errorMessage: input.errorMessage,
          requestPayloadJson: payload as unknown as Record<string, unknown>,
          responsePayloadJson: input.responsePayloadJson,
          createdByUserId,
        });
      } catch (logError) {
        logger.warn("S3 lifecycle apply: failed to persist policy action log", {
          tenantId: scope.tenantId,
          bucketName: normalizedBucketName,
          accountId: context.accountId,
          region,
          cloudConnectionId: connection.id,
          roleArn,
          logErrorMessage: logError instanceof Error ? logError.message : "Unknown log persistence error",
        });
      }
    };

    let credentials: Awaited<ReturnType<typeof assumeRole>>;
    try {
      credentials = await assumeRole(roleArn, externalId);
    } catch (error) {
      logger.error("S3 lifecycle apply: assume role failed", {
        tenantId: scope.tenantId,
        bucketName: normalizedBucketName,
        accountId: context.accountId,
        region,
        cloudConnectionId: connection.id,
        roleArn,
        errorMessage: error instanceof Error ? error.message : "Unknown assume-role error",
      });
      throw new ForbiddenError("Unable to assume client AWS role for lifecycle policy update");
    }
    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });
    try {
      const stsClient = new STSClient({
        region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        },
      });
      const identity = await stsClient.send(new GetCallerIdentityCommand({}));
      logger.info("S3 lifecycle apply: assumed role identity resolved", {
        tenantId: scope.tenantId,
        bucketName: normalizedBucketName,
        assumedRoleArn: roleArn,
        awsAccountId: identity.Account ?? null,
        callerArn: identity.Arn ?? null,
        callerUserId: identity.UserId ?? null,
      });
    } catch (identityError) {
      logger.warn("S3 lifecycle apply: failed to resolve caller identity", {
        tenantId: scope.tenantId,
        bucketName: normalizedBucketName,
        assumedRoleArn: roleArn,
        identityErrorMessage: identityError instanceof Error ? identityError.message : "Unknown identity error",
      });
    }

    let mergedRulesForWrite: LifecycleRule[] = [lifecycleRule];
    try {
      try {
        const existing = await s3Client.send(
          new GetBucketLifecycleConfigurationCommand({
            Bucket: normalizedBucketName,
          }),
        );
        const existingRules = Array.isArray(existing.Rules) ? existing.Rules : [];
        const withoutSameRule = existingRules.filter((rule) => String(rule.ID ?? "").trim() !== normalizedRuleName);
        mergedRulesForWrite = [...withoutSameRule, lifecycleRule];
      } catch (error) {
        const errorCode =
          typeof error === "object" && error !== null && "name" in error
            ? String((error as { name?: string }).name ?? "")
            : "";
        if (errorCode !== "NoSuchLifecycleConfiguration") {
          throw error;
        }
      }

      const lifecycleConfig: BucketLifecycleConfiguration = { Rules: mergedRulesForWrite };
      logger.info("S3 lifecycle apply: sending PutBucketLifecycleConfiguration", {
        tenantId: scope.tenantId,
        bucketName: normalizedBucketName,
        assumedRoleArn: roleArn,
        expectedAwsAccountId: context.accountId,
        lifecycleConfiguration: lifecycleConfig,
      });
      await s3Client.send(
        new PutBucketLifecycleConfigurationCommand({
          Bucket: normalizedBucketName,
          LifecycleConfiguration: lifecycleConfig,
        }),
      );

      const latestLifecycleConfig = await s3Client.send(
        new GetBucketLifecycleConfigurationCommand({
          Bucket: normalizedBucketName,
        }),
      );
      const latestRules = Array.isArray(latestLifecycleConfig.Rules) ? latestLifecycleConfig.Rules : [];
      const appliedPolicy = {
        Rules: latestRules as unknown as Record<string, unknown>[],
      };

      try {
        await S3BucketConfigSnapshot.create({
          tenantId: scope.tenantId,
          cloudConnectionId: connection.id,
          providerId: connection.providerId ? Number(connection.providerId) : null,
          accountId: context.accountId,
          bucketName: normalizedBucketName,
          region,
          scanTime: new Date(),
          lifecycleStatus: "present",
          lifecycleRulesCount: latestRules.length,
          lifecycleRulesJson: appliedPolicy,
          createdAt: new Date(),
        });
      } catch (snapshotError) {
        logger.warn("S3 lifecycle apply: snapshot persistence failed after successful AWS apply", {
          tenantId: scope.tenantId,
          bucketName: normalizedBucketName,
          accountId: context.accountId,
          region,
          cloudConnectionId: connection.id,
          roleArn,
          snapshotErrorMessage: snapshotError instanceof Error
            ? snapshotError.message
            : "Unknown snapshot persistence error",
        });
      }

      await writePolicyActionLogSafely({
        status: "SUCCEEDED",
        errorMessage: null,
        responsePayloadJson: appliedPolicy,
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
      const errorCode = toAwsErrorCode(error);
      logger.error("S3 lifecycle apply: AWS operation failed", {
        tenantId: scope.tenantId,
        bucketName: normalizedBucketName,
        assumedRoleArn: roleArn,
        expectedAwsAccountId: context.accountId,
        region,
        errorCode,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      await writePolicyActionLogSafely({
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        responsePayloadJson: null,
      });
      if (isAwsAccessDeniedError(error)) {
        throw new ForbiddenError(
          "AWS denied lifecycle update. Check action role has s3:PutLifecycleConfiguration and s3:GetLifecycleConfiguration, and backend is using ActionRoleArn.",
        );
      }
      if (errorCode === "NoSuchBucket") {
        throw new NotFoundError(`Bucket not found: ${normalizedBucketName}`);
      }
      if (errorCode === "InvalidRequest" || errorCode.includes("InvalidRequest")) {
        throw new BadRequestError("Policy configuration is invalid");
      }
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
