import type { DashboardScope } from "../../dashboard.types.js";
import { S3OptimizationRepository } from "./s3-optimization.repository.js";
import type {
  S3BucketLifecycleInsightResponse,
  S3PolicyActionHistoryResponse,
  S3LifecyclePolicyApplyRequest,
  S3LifecyclePolicyApplyResponse,
  S3LifecyclePolicyDeleteRequest,
  S3LifecyclePolicyDeleteResponse,
  S3OptimizationResponse,
  S3ReplicationDestinationBucketsResponse,
  S3ReplicationVisibilityResponse,
  S3ReplicationSetupApplyResponse,
  S3ReplicationRoleAutoCreateResponse,
  S3ReplicationRoleAutoCreateRequest,
  S3ReplicationSetupPreviewResponse,
  S3ReplicationSetupRequest,
} from "./s3-optimization.types.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../../../errors/http-errors.js";
import { BillingSource, CloudConnectionV2, CloudProvider, S3BucketConfigSnapshot } from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";
import { assumeRole } from "../../../cloud-connections/aws/infrastructure/aws-sts.service.js";
import { collectS3BucketConfigSnapshotsForBillingSource } from "../../../billing/services/s3-bucket-config-snapshot.service.js";
import {
  DeleteBucketLifecycleCommand,
  GetBucketLocationCommand,
  GetBucketReplicationCommand,
  GetBucketLifecycleConfigurationCommand,
  GetBucketVersioningCommand,
  HeadBucketCommand,
  PutBucketReplicationCommand,
  PutBucketVersioningCommand,
  PutBucketLifecycleConfigurationCommand,
  S3Client,
  type BucketLifecycleConfiguration,
  type LifecycleRule,
  type Transition,
  type TransitionStorageClass,
} from "@aws-sdk/client-s3";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { CreateRoleCommand, GetRoleCommand, IAMClient, PutRolePolicyCommand } from "@aws-sdk/client-iam";

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
    const noncurrentTransitions = Array.isArray(payload.noncurrentVersionTransitions) ? payload.noncurrentVersionTransitions : [];
    const seenStorageClasses = new Set<string>();
    const normalizedTransitions: Array<{ Days: number; StorageClass: TransitionStorageClass }> = transitions
      .filter((item) => item && Number.isFinite(item.days))
      .map((item) => ({
        Days: Math.trunc(item.days),
        StorageClass: item.storageClass as TransitionStorageClass,
      }))
      .filter((item) => item.Days > 0 && ["STANDARD_IA", "GLACIER", "DEEP_ARCHIVE", "INTELLIGENT_TIERING"].includes(String(item.StorageClass)))
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

    for (const transition of normalizedTransitions) {
      if (transition.StorageClass === "STANDARD_IA" && transition.Days < 30) {
        throw new BadRequestError("STANDARD_IA transition requires at least 30 days");
      }
    }

    const seenNoncurrentStorageClasses = new Set<string>();
    const normalizedNoncurrentTransitions: Array<{ NoncurrentDays: number; StorageClass: TransitionStorageClass }> = noncurrentTransitions
      .filter((item) => item && Number.isFinite(item.days))
      .map((item) => ({
        NoncurrentDays: Math.trunc(item.days),
        StorageClass: item.storageClass as TransitionStorageClass,
      }))
      .filter((item) => item.NoncurrentDays > 0 && ["STANDARD_IA", "GLACIER", "DEEP_ARCHIVE", "INTELLIGENT_TIERING"].includes(String(item.StorageClass)))
      .sort((a, b) => a.NoncurrentDays - b.NoncurrentDays);
    if (normalizedNoncurrentTransitions.length !== noncurrentTransitions.length) {
      throw new BadRequestError("Invalid noncurrentVersionTransitions. Use supported storage classes and positive days.");
    }
    for (const transition of normalizedNoncurrentTransitions) {
      const storageClass = String(transition.StorageClass);
      if (seenNoncurrentStorageClasses.has(storageClass)) {
        throw new BadRequestError(`Duplicate noncurrent transition storage class: ${storageClass}`);
      }
      seenNoncurrentStorageClasses.add(storageClass);
      if (transition.StorageClass === "STANDARD_IA" && transition.NoncurrentDays < 30) {
        throw new BadRequestError("STANDARD_IA noncurrent transition requires at least 30 days");
      }
    }
    for (let idx = 1; idx < normalizedNoncurrentTransitions.length; idx += 1) {
      const current = normalizedNoncurrentTransitions[idx];
      const previous = normalizedNoncurrentTransitions[idx - 1];
      if (current && previous && current.NoncurrentDays <= previous.NoncurrentDays) {
        throw new BadRequestError("Noncurrent transition days must be strictly increasing");
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

    const noncurrentVersionExpirationDays = payload.noncurrentVersionExpirationDays == null
      ? null
      : Math.trunc(Number(payload.noncurrentVersionExpirationDays));
    if (noncurrentVersionExpirationDays != null && noncurrentVersionExpirationDays <= 0) {
      throw new BadRequestError("noncurrentVersionExpirationDays must be greater than 0");
    }
    if (
      noncurrentVersionExpirationDays != null &&
      normalizedNoncurrentTransitions.length > 0 &&
      noncurrentVersionExpirationDays <= (normalizedNoncurrentTransitions[normalizedNoncurrentTransitions.length - 1]?.NoncurrentDays ?? 0)
    ) {
      throw new BadRequestError("noncurrentVersionExpirationDays must be greater than noncurrent transition days");
    }

    const expiredObjectDeleteMarker = payload.expiredObjectDeleteMarker === true;

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
    if (expirationDays != null && expiredObjectDeleteMarker) {
      throw new BadRequestError("expiredObjectDeleteMarker cannot be combined with expirationDays in same rule");
    }

    const minObjectSizeBytes = payload.scope?.minObjectSizeBytes == null ? null : Math.trunc(Number(payload.scope.minObjectSizeBytes));
    const maxObjectSizeBytes = payload.scope?.maxObjectSizeBytes == null ? null : Math.trunc(Number(payload.scope.maxObjectSizeBytes));
    if (minObjectSizeBytes != null && minObjectSizeBytes < 0) {
      throw new BadRequestError("scope.minObjectSizeBytes must be >= 0");
    }
    if (maxObjectSizeBytes != null && maxObjectSizeBytes < 0) {
      throw new BadRequestError("scope.maxObjectSizeBytes must be >= 0");
    }
    if (minObjectSizeBytes != null && maxObjectSizeBytes != null && minObjectSizeBytes >= maxObjectSizeBytes) {
      throw new BadRequestError("scope.minObjectSizeBytes must be less than scope.maxObjectSizeBytes");
    }

    const lifecycleRule: LifecycleRule = {
      ID: normalizedRuleName,
      Status: payload.status,
      Filter: {
        ...(scopeType === "prefix" ? { Prefix: normalizedPrefix } : { Prefix: "" }),
        ...(minObjectSizeBytes != null ? { ObjectSizeGreaterThan: minObjectSizeBytes } : {}),
        ...(maxObjectSizeBytes != null ? { ObjectSizeLessThan: maxObjectSizeBytes } : {}),
      },
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
    if (normalizedNoncurrentTransitions.length > 0) {
      lifecycleRule.NoncurrentVersionTransitions = normalizedNoncurrentTransitions;
    }
    if (noncurrentVersionExpirationDays != null) {
      lifecycleRule.NoncurrentVersionExpiration = { NoncurrentDays: noncurrentVersionExpirationDays };
    }
    if (expiredObjectDeleteMarker) {
      lifecycleRule.Expiration = {
        ...(lifecycleRule.Expiration ?? {}),
        ExpiredObjectDeleteMarker: true,
      };
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

    if (normalizedNoncurrentTransitions.length > 0 || noncurrentVersionExpirationDays != null || expiredObjectDeleteMarker) {
      const versioningState = await s3Client.send(
        new GetBucketVersioningCommand({
          Bucket: normalizedBucketName,
        }),
      );
      if (versioningState.Status !== "Enabled") {
        throw new BadRequestError(
          "Versioning-only lifecycle options require bucket versioning to be Enabled",
        );
      }
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

  async getReplicationVisibility(scope: DashboardScope): Promise<S3ReplicationVisibilityResponse> {
    void this.refreshReplicationSnapshotsForScope(scope).catch((error) => {
      logger.warn("S3 replication refresh scheduled in background failed", {
        tenantId: scope.tenantId,
        reason: error instanceof Error ? error.message : String(error),
      });
    });
    const buckets = await this.repository.getReplicationVisibilityRows(scope);
    return {
      section: "s3-replication",
      title: "S3 Replication",
      message: "S3 replication visibility loaded",
      buckets,
    };
  }

  async getReplicationDestinationBuckets(
    scope: DashboardScope,
    sourceBucketName: string,
  ): Promise<S3ReplicationDestinationBucketsResponse> {
    const normalizedSourceBucketName = String(sourceBucketName ?? "").trim();
    if (!normalizedSourceBucketName) {
      throw new BadRequestError("sourceBucketName is required");
    }

    const snapshotBuckets = await this.repository.getReplicationVisibilityRows(scope);
    const destinationBuckets = Array.from(
      new Map(
        snapshotBuckets
          .map((row) => ({
            bucketName: String(row.bucketName ?? "").trim(),
            region: row.region ? String(row.region).trim() : null,
          }))
          .filter((row) => row.bucketName.length > 0 && row.bucketName !== normalizedSourceBucketName)
          .map((row) => [row.bucketName.toLowerCase(), row] as const),
      ).values(),
    ).sort((a, b) => a.bucketName.localeCompare(b.bucketName));

    return {
      section: "s3-replication-destination-buckets",
      title: "S3 Replication Destination Buckets",
      message: "Destination bucket options loaded from dashboard snapshots",
      sourceBucketName: normalizedSourceBucketName,
      buckets: destinationBuckets,
    };
  }

  async previewReplicationSetup(
    scope: DashboardScope,
    payload: S3ReplicationSetupRequest,
  ): Promise<S3ReplicationSetupPreviewResponse> {
    const prepared = await this.prepareReplicationSetupContext(scope, payload);
    const checks = await this.buildReplicationSetupChecks(prepared, payload);
    const canApply = checks.every((check) => check.status !== "fail");
    return {
      section: "s3-replication-setup-preview",
      title: "S3 Replication Setup Preview",
      message: canApply ? "Replication setup checks passed" : "Fix failed checks before applying replication",
      canApply,
      checks,
    };
  }

  async applyReplicationSetup(
    scope: DashboardScope,
    payload: S3ReplicationSetupRequest,
  ): Promise<S3ReplicationSetupApplyResponse> {
    const prepared = await this.prepareReplicationSetupContext(scope, payload);
    const checks = await this.buildReplicationSetupChecks(prepared, payload);
    const failedChecks = checks.filter((check) => check.status === "fail");
    if (failedChecks.length > 0) {
      throw new BadRequestError(
        `Replication setup blocked: ${failedChecks.map((item) => item.title).join(", ")}`,
      );
    }

    const sourceVersioning = await prepared.sourceClient.send(
      new GetBucketVersioningCommand({ Bucket: prepared.sourceBucketName }),
    );
    if (sourceVersioning.Status !== "Enabled") {
      if (payload.autoEnableSourceVersioning) {
        await prepared.sourceClient.send(
          new PutBucketVersioningCommand({
            Bucket: prepared.sourceBucketName,
            VersioningConfiguration: { Status: "Enabled" },
          }),
        );
      } else {
        throw new BadRequestError("Source bucket versioning is not enabled");
      }
    }

    const destinationClient = new S3Client({
      region: payload.destinationRegion,
      credentials: prepared.credentials,
    });
    try {
      const destinationVersioning = await destinationClient.send(
        new GetBucketVersioningCommand({ Bucket: payload.destinationBucketName }),
      );
      if (destinationVersioning.Status !== "Enabled") {
        if (payload.autoEnableDestinationVersioning) {
          await destinationClient.send(
            new PutBucketVersioningCommand({
              Bucket: payload.destinationBucketName,
              VersioningConfiguration: { Status: "Enabled" },
            }),
          );
        } else {
          throw new BadRequestError("Destination bucket versioning is not enabled");
        }
      }
    } catch (error) {
      const code =
        error && typeof error === "object" && "name" in error
          ? String((error as { name?: string }).name ?? "")
          : "";
      if (code.toLowerCase().includes("accessdenied")) {
        throw new BadRequestError("Destination versioning cannot be verified due to permissions");
      }
      throw error;
    }

    const existing = await prepared.sourceClient.send(
      new GetBucketReplicationCommand({ Bucket: prepared.sourceBucketName }),
    ).catch(() => null);
    const existingRules = Array.isArray(existing?.ReplicationConfiguration?.Rules)
      ? existing?.ReplicationConfiguration?.Rules
      : [];
    const normalizedRuleName = String(payload.ruleName ?? "").trim();
    const filteredRules = existingRules.filter((rule) => String(rule.ID ?? "").trim() !== normalizedRuleName);

    const destinationArn = `arn:aws:s3:::${payload.destinationBucketName}`;
    const mergedRules = [
      ...filteredRules,
      {
        ID: normalizedRuleName,
        Status: "Enabled" as const,
        Priority: 1,
        DeleteMarkerReplication: {
          Status: payload.replicateDeleteMarkers === true ? ("Enabled" as const) : ("Disabled" as const),
        },
        Filter: payload.prefix ? { Prefix: payload.prefix } : { Prefix: "" },
        Destination: {
          Bucket: destinationArn,
          ...(payload.destinationAccountId ? { Account: payload.destinationAccountId } : {}),
        },
      },
    ];

    await prepared.sourceClient.send(
      new PutBucketReplicationCommand({
        Bucket: prepared.sourceBucketName,
        ReplicationConfiguration: {
          Role: payload.replicationRoleArn,
          Rules: mergedRules,
        },
      }),
    );

    await S3BucketConfigSnapshot.create({
      tenantId: scope.tenantId,
      cloudConnectionId: prepared.connection.id,
      providerId: prepared.connection.providerId ? Number(prepared.connection.providerId) : null,
      accountId: prepared.context.accountId,
      bucketName: prepared.sourceBucketName,
      region: prepared.region,
      scanTime: new Date(),
      replicationStatus: "present",
      replicationRulesCount: mergedRules.length,
      replicationConfigJson: {
        Role: payload.replicationRoleArn,
        Rules: mergedRules,
      },
      createdAt: new Date(),
    });

    return {
      section: "s3-replication-setup-apply",
      title: "S3 Replication Setup Apply",
      message: "Replication configured successfully",
      sourceBucketName: prepared.sourceBucketName,
      destinationBucketName: payload.destinationBucketName,
      destinationRegion: payload.destinationRegion,
      replicationStatus: "configured",
    };
  }

  async createReplicationRoleAutomatically(
    scope: DashboardScope,
    payload: S3ReplicationRoleAutoCreateRequest,
  ): Promise<S3ReplicationRoleAutoCreateResponse> {
    const toAwsErrorCode = (error: unknown): string => {
      if (!error || typeof error !== "object") return "";
      const named = "name" in error ? String((error as { name?: string }).name ?? "") : "";
      const coded = "Code" in error ? String((error as { Code?: string }).Code ?? "") : "";
      const code = "code" in error ? String((error as { code?: string }).code ?? "") : "";
      return named || coded || code;
    };

    const sourceBucketName = String(payload.sourceBucketName ?? "").trim();
    const destinationBucketName = String(payload.destinationBucketName ?? "").trim();
    if (!sourceBucketName || !destinationBucketName) {
      throw new BadRequestError("sourceBucketName and destinationBucketName are required");
    }
    if (sourceBucketName === destinationBucketName) {
      throw new BadRequestError("sourceBucketName and destinationBucketName must be different");
    }

    const context = await this.repository.getBucketLifecycleExecutionContext(scope, sourceBucketName);
    const connection = await CloudConnectionV2.findOne({
      where: {
        id: context.cloudConnectionId,
        tenantId: scope.tenantId,
      },
    });
    if (!connection) throw new NotFoundError("Cloud connection not found for selected bucket");

    const assumeRoleArn = String(connection.actionRoleArn ?? "").trim();
    const externalId = String(connection.externalId ?? "").trim() || null;
    if (!assumeRoleArn) throw new BadRequestError("Cloud connection missing ActionRoleArn");

    const credentialsRaw = await assumeRole(assumeRoleArn, externalId);
    const credentials = {
      accessKeyId: credentialsRaw.accessKeyId,
      secretAccessKey: credentialsRaw.secretAccessKey,
      sessionToken: credentialsRaw.sessionToken,
    };
    const region = String(context.region ?? connection.region ?? "us-east-1").trim();
    const iamClient = new IAMClient({ region, credentials });

    const normalizedRoleName = String(payload.roleName ?? "").trim() || `kcx-s3-replication-${sourceBucketName.slice(0, 30).replace(/[^a-zA-Z0-9+=,.@_-]/g, "-")}`;
    const trustPolicy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "s3.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    };

    let roleArn = "";
    try {
      const existingRole = await iamClient.send(new GetRoleCommand({ RoleName: normalizedRoleName }));
      console.log(existingRole);
      roleArn = String(existingRole.Role?.Arn ?? "").trim();
    } catch (getRoleError) {
      const getRoleCode = toAwsErrorCode(getRoleError);
      const normalizedGetRoleCode = getRoleCode.toLowerCase();
      const isRoleMissing =
        normalizedGetRoleCode === "nosuchentity" ||
        normalizedGetRoleCode === "nosuchentityexception";
      if (getRoleCode && !isRoleMissing) {
        logger.error("S3 replication role auto-create: GetRole failed", {
          tenantId: scope.tenantId,
          roleName: normalizedRoleName,
          errorCode: getRoleCode,
          errorMessage: getRoleError instanceof Error ? getRoleError.message : String(getRoleError),
        });
        throw new ForbiddenError(
          `Unable to read IAM role in client account (GetRole failed: ${getRoleCode || "unknown"}). Check iam:GetRole permission.`,
        );
      }
      try {
        const createdRole = await iamClient.send(
          new CreateRoleCommand({
            RoleName: normalizedRoleName,
            AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
            Description: "KCX-managed S3 replication role",
          }),
        );
        roleArn = String(createdRole.Role?.Arn ?? "").trim();
      } catch (createRoleError) {
        const createRoleCode = toAwsErrorCode(createRoleError);
        if (createRoleCode === "EntityAlreadyExists") {
          const existingRole = await iamClient.send(new GetRoleCommand({ RoleName: normalizedRoleName }));
          roleArn = String(existingRole.Role?.Arn ?? "").trim();
        } else {
          logger.error("S3 replication role auto-create: CreateRole failed", {
            tenantId: scope.tenantId,
            roleName: normalizedRoleName,
            errorCode: createRoleCode,
            errorMessage: createRoleError instanceof Error ? createRoleError.message : String(createRoleError),
          });
          throw new ForbiddenError(
            `Unable to create IAM role in client account (CreateRole failed: ${createRoleCode || "unknown"}). Check iam:CreateRole permission and IAM role creation guardrails.`,
          );
        }
      }
    }

    const policyName = "kcx-s3-replication-policy";
    const sourceBucketArn = `arn:aws:s3:::${sourceBucketName}`;
    const destinationBucketArn = `arn:aws:s3:::${destinationBucketName}`;
    const inlinePolicy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "SourceBucketRead",
          Effect: "Allow",
          Action: [
            "s3:GetReplicationConfiguration",
            "s3:ListBucket",
          ],
          Resource: [sourceBucketArn],
        },
        {
          Sid: "SourceObjectRead",
          Effect: "Allow",
          Action: [
            "s3:GetObjectVersionForReplication",
            "s3:GetObjectVersionAcl",
            "s3:GetObjectVersionTagging",
          ],
          Resource: [`${sourceBucketArn}/*`],
        },
        {
          Sid: "DestinationWrite",
          Effect: "Allow",
          Action: [
            "s3:ReplicateObject",
            "s3:ReplicateDelete",
            "s3:ReplicateTags",
            "s3:ObjectOwnerOverrideToBucketOwner",
          ],
          Resource: [`${destinationBucketArn}/*`],
        },
      ],
    };
    try {
      await iamClient.send(
        new PutRolePolicyCommand({
          RoleName: normalizedRoleName,
          PolicyName: policyName,
          PolicyDocument: JSON.stringify(inlinePolicy),
        }),
      );
    } catch (putPolicyError) {
      const putPolicyCode = toAwsErrorCode(putPolicyError);
      logger.error("S3 replication role auto-create: PutRolePolicy failed", {
        tenantId: scope.tenantId,
        roleName: normalizedRoleName,
        errorCode: putPolicyCode,
        errorMessage: putPolicyError instanceof Error ? putPolicyError.message : String(putPolicyError),
      });
      throw new ForbiddenError(
        `Unable to attach IAM inline policy in client account (PutRolePolicy failed: ${putPolicyCode || "unknown"}). Check iam:PutRolePolicy permission.`,
      );
    }

    if (!roleArn) {
      throw new BadRequestError("Failed to resolve replication role ARN");
    }
    return {
      section: "s3-replication-role-auto-create",
      title: "S3 Replication Role Auto Create",
      message: "Replication IAM role created/updated successfully",
      roleName: normalizedRoleName,
      roleArn,
    };
  }

  private async prepareReplicationSetupContext(scope: DashboardScope, payload: S3ReplicationSetupRequest): Promise<{
    sourceBucketName: string;
    region: string;
    sourceClient: S3Client;
    credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string | undefined };
    context: Awaited<ReturnType<S3OptimizationRepository["getBucketLifecycleExecutionContext"]>>;
    connection: InstanceType<typeof CloudConnectionV2>;
  }> {
    const sourceBucketName = String(payload.sourceBucketName ?? "").trim();
    const destinationBucketName = String(payload.destinationBucketName ?? "").trim();
    const destinationRegion = String(payload.destinationRegion ?? "").trim();
    const replicationRoleArn = String(payload.replicationRoleArn ?? "").trim();
    const ruleName = String(payload.ruleName ?? "").trim();
    if (!sourceBucketName || !destinationBucketName || !destinationRegion || !replicationRoleArn || !ruleName) {
      throw new BadRequestError("sourceBucketName, destinationBucketName, destinationRegion, replicationRoleArn and ruleName are required");
    }

    const context = await this.repository.getBucketLifecycleExecutionContext(scope, sourceBucketName);
    const connection = await CloudConnectionV2.findOne({
      where: {
        id: context.cloudConnectionId,
        tenantId: scope.tenantId,
      },
    });
    if (!connection) throw new NotFoundError("Cloud connection not found for selected bucket");

    const assumeRoleArn = String(connection.actionRoleArn ?? "").trim();
    const externalId = String(connection.externalId ?? "").trim() || null;
    if (!assumeRoleArn) throw new BadRequestError("Cloud connection missing ActionRoleArn");

    const credentialsRaw = await assumeRole(assumeRoleArn, externalId);
    const credentials = {
      accessKeyId: credentialsRaw.accessKeyId,
      secretAccessKey: credentialsRaw.secretAccessKey,
      sessionToken: credentialsRaw.sessionToken,
    };
    const region = String(context.region ?? connection.region ?? "us-east-1").trim();
    const sourceClient = new S3Client({ region, credentials });
    return { sourceBucketName, region, sourceClient, credentials, context, connection };
  }

  private async buildReplicationSetupChecks(
    prepared: {
      sourceBucketName: string;
      region: string;
      sourceClient: S3Client;
      credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string | undefined };
      context: Awaited<ReturnType<S3OptimizationRepository["getBucketLifecycleExecutionContext"]>>;
    },
    payload: S3ReplicationSetupRequest,
  ): Promise<S3ReplicationSetupPreviewResponse["checks"]> {
    const checks: S3ReplicationSetupPreviewResponse["checks"] = [];
    const sourceVersioning = await prepared.sourceClient.send(
      new GetBucketVersioningCommand({ Bucket: prepared.sourceBucketName }),
    );
    checks.push({
      key: "source_versioning",
      title: "Source bucket versioning",
      status: sourceVersioning.Status === "Enabled" ? "pass" : "warn",
      detail: sourceVersioning.Status === "Enabled"
        ? "Source bucket versioning is enabled"
        : "Source bucket versioning is not enabled; enable before apply",
    });

    const destinationClient = new S3Client({
      region: payload.destinationRegion,
      credentials: prepared.credentials,
    });

    try {
      await destinationClient.send(new HeadBucketCommand({ Bucket: payload.destinationBucketName }));
      checks.push({
        key: "destination_bucket_access",
        title: "Destination bucket access",
        status: "pass",
        detail: "Destination bucket is reachable",
      });
    } catch (error) {
      const errorCode =
        error && typeof error === "object" && "name" in error
          ? String((error as { name?: string }).name ?? "")
          : "";
      checks.push({
        key: "destination_bucket_access",
        title: "Destination bucket access",
        status: "warn",
        detail: `Direct head access check failed (${errorCode || "unknown"}). Continuing with region/versioning checks.`,
      });
    }

    try {
      const destinationLocation = await destinationClient.send(
        new GetBucketLocationCommand({ Bucket: payload.destinationBucketName }),
      );
      const resolvedRegion = destinationLocation.LocationConstraint === "EU"
        ? "eu-west-1"
        : String(destinationLocation.LocationConstraint ?? "us-east-1");
      checks.push({
        key: "destination_region_match",
        title: "Destination region check",
        status: resolvedRegion === payload.destinationRegion ? "pass" : "warn",
        detail: resolvedRegion === payload.destinationRegion
          ? `Destination bucket region matches (${resolvedRegion})`
          : `Destination bucket region is ${resolvedRegion}; requested ${payload.destinationRegion}`,
      });
    } catch {
      checks.push({
        key: "destination_region_match",
        title: "Destination region check",
        status: "warn",
        detail: "Could not verify destination bucket region",
      });
    }

    try {
      const destinationVersioning = await destinationClient.send(
        new GetBucketVersioningCommand({ Bucket: payload.destinationBucketName }),
      );
      checks.push({
        key: "destination_versioning",
        title: "Destination bucket versioning",
        status: destinationVersioning.Status === "Enabled" ? "pass" : "warn",
        detail: destinationVersioning.Status === "Enabled"
          ? "Destination bucket versioning is enabled"
          : "Destination bucket versioning is not enabled; enable before apply",
      });
    } catch {
      checks.push({
        key: "destination_versioning",
        title: "Destination bucket versioning",
        status: "warn",
        detail: "Could not verify destination bucket versioning",
      });
    }

    const roleArn = String(payload.replicationRoleArn ?? "").trim();
    checks.push({
      key: "replication_role",
      title: "Replication IAM role",
      status: roleArn.startsWith("arn:aws:iam::") ? "pass" : "fail",
      detail: roleArn.startsWith("arn:aws:iam::")
        ? "Replication IAM role ARN provided"
        : "Valid replication IAM role ARN is required",
    });
    return checks;
  }

  private async refreshReplicationSnapshotsForScope(scope: DashboardScope): Promise<void> {
    try {
      const awsProvider = await CloudProvider.findOne({ where: { code: "aws" } });
      if (!awsProvider) return;

      let targetBillingSourceIds: string[] = [];
      if (scope.scopeType === "global" && Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
        targetBillingSourceIds = scope.billingSourceIds.map((id) => String(id));
      } else if (scope.scopeType === "global") {
        const sources = await BillingSource.findAll({
          where: {
            tenantId: scope.tenantId,
            cloudProviderId: String(awsProvider.id),
            status: "active",
          },
          attributes: ["id"],
        });
        targetBillingSourceIds = sources.map((source) => String(source.id));
      }

      for (const billingSourceId of targetBillingSourceIds) {
        try {
          await collectS3BucketConfigSnapshotsForBillingSource({
            tenantId: scope.tenantId,
            billingSourceId,
          });
        } catch (error) {
          logger.warn("S3 replication refresh failed for billing source", {
            tenantId: scope.tenantId,
            billingSourceId,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      logger.warn("S3 replication refresh skipped due to pre-read failure", {
        tenantId: scope.tenantId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async deleteBucketLifecyclePolicy(
    scope: DashboardScope,
    payload: S3LifecyclePolicyDeleteRequest,
    createdByUserId: string | null = null,
  ): Promise<S3LifecyclePolicyDeleteResponse> {
    const normalizedBucketName = String(payload.bucketName ?? "").trim();
    const normalizedRuleName = String(payload.ruleName ?? "").trim();
    const normalizedAccountId = String(payload.accountId ?? "").trim();
    const requestedRegion = String(payload.region ?? "").trim();
    if (!normalizedBucketName) throw new BadRequestError("bucketName is required");
    if (!normalizedRuleName) throw new BadRequestError("ruleName is required");

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
          scopeType: "entire_bucket",
          scopePrefix: null,
          status: input.status,
          errorMessage: input.errorMessage,
          requestPayloadJson: { action: "delete", bucketName: normalizedBucketName, ruleName: normalizedRuleName },
          responsePayloadJson: input.responsePayloadJson,
          createdByUserId,
        });
      } catch (logError) {
        logger.warn("S3 lifecycle delete: failed to persist policy action log", {
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
    } catch {
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
      const existing = await s3Client.send(
        new GetBucketLifecycleConfigurationCommand({
          Bucket: normalizedBucketName,
        }),
      );
      const existingRules = Array.isArray(existing.Rules) ? existing.Rules : [];
      const hasRule = existingRules.some((rule) => String(rule.ID ?? "").trim() === normalizedRuleName);
      if (!hasRule) {
        throw new NotFoundError(`Lifecycle rule ${normalizedRuleName} not found in bucket ${normalizedBucketName}`);
      }
      const filteredRules = existingRules.filter((rule) => String(rule.ID ?? "").trim() !== normalizedRuleName);

      if (filteredRules.length === 0) {
        await s3Client.send(
          new DeleteBucketLifecycleCommand({
            Bucket: normalizedBucketName,
          }),
        );
      } else {
        await s3Client.send(
          new PutBucketLifecycleConfigurationCommand({
            Bucket: normalizedBucketName,
            LifecycleConfiguration: { Rules: filteredRules },
          }),
        );
      }

      await writePolicyActionLogSafely({
        status: "SUCCEEDED",
        errorMessage: null,
        responsePayloadJson: { action: "delete", deletedRule: normalizedRuleName, remainingRules: filteredRules.length },
      });

      return {
        section: "s3-lifecycle-policy-delete",
        title: "S3 Lifecycle Policy Delete",
        message: "S3 lifecycle policy rule removed successfully",
        bucketName: normalizedBucketName,
        accountId: context.accountId,
        region,
        ruleName: normalizedRuleName,
      };
    } catch (error) {
      await writePolicyActionLogSafely({
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        responsePayloadJson: null,
      });
      throw error;
    }
  }
}

