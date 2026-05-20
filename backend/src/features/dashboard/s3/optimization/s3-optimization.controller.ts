import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../../constants/http-status.js";
import { BadRequestError } from "../../../../errors/http-errors.js";
import { sendSuccess } from "../../../../utils/api-response.js";
import { buildDashboardRequest } from "../../shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../../shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../../shared/validator.js";
import { S3OptimizationService } from "./s3-optimization.service.js";

const scopeResolver = new DashboardScopeResolver();
const s3OptimizationService = new S3OptimizationService();

export async function handleGetS3Optimization(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);

  const scope = await scopeResolver.resolve(dashboardRequest);
  const data = await s3OptimizationService.getOptimization(scope);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 optimization fetched successfully",
    data,
  });
}

export async function handleGetS3Replication(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);

  const scope = await scopeResolver.resolve(dashboardRequest);
  const data = await s3OptimizationService.getReplicationVisibility(scope);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 replication visibility fetched successfully",
    data,
  });
}

export async function handleGetS3ReplicationDestinationBuckets(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);

  const sourceBucketName = typeof req.query.sourceBucketName === "string" ? req.query.sourceBucketName.trim() : "";
  if (!sourceBucketName) {
    throw new BadRequestError("sourceBucketName query parameter is required");
  }

  const scope = await scopeResolver.resolve(dashboardRequest);
  const data = await s3OptimizationService.getReplicationDestinationBuckets(scope, sourceBucketName);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 replication destination buckets fetched successfully",
    data,
  });
}

export async function handlePreviewS3ReplicationSetup(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const payload = req.body as {
    sourceBucketName?: string;
    destinationBucketName?: string;
    destinationRegion?: string;
    replicationType?: "same_account" | "cross_account";
    destinationAccountId?: string | null;
    replicationRoleArn?: string;
    ruleName?: string;
    prefix?: string | null;
    replicateDeleteMarkers?: boolean;
    autoEnableSourceVersioning?: boolean;
    autoEnableDestinationVersioning?: boolean;
  };

  const data = await s3OptimizationService.previewReplicationSetup(scope, {
    sourceBucketName: String(payload.sourceBucketName ?? "").trim(),
    destinationBucketName: String(payload.destinationBucketName ?? "").trim(),
    destinationRegion: String(payload.destinationRegion ?? "").trim(),
    replicationType: payload.replicationType === "cross_account" ? "cross_account" : "same_account",
    destinationAccountId: payload.destinationAccountId ?? null,
    replicationRoleArn: String(payload.replicationRoleArn ?? "").trim(),
    ruleName: String(payload.ruleName ?? "").trim(),
    prefix: payload.prefix ?? null,
    replicateDeleteMarkers: payload.replicateDeleteMarkers === true,
    autoEnableSourceVersioning: payload.autoEnableSourceVersioning === true,
    autoEnableDestinationVersioning: payload.autoEnableDestinationVersioning === true,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 replication setup preview generated successfully",
    data,
  });
}

export async function handleAutoCreateS3ReplicationRole(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const payload = req.body as {
    sourceBucketName?: string;
    destinationBucketName?: string;
    roleName?: string | null;
  };

  const data = await s3OptimizationService.createReplicationRoleAutomatically(scope, {
    sourceBucketName: String(payload.sourceBucketName ?? "").trim(),
    destinationBucketName: String(payload.destinationBucketName ?? "").trim(),
    roleName: payload.roleName ?? null,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 replication role created successfully",
    data,
  });
}

export async function handleApplyS3ReplicationSetup(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const payload = req.body as {
    sourceBucketName?: string;
    destinationBucketName?: string;
    destinationRegion?: string;
    replicationType?: "same_account" | "cross_account";
    destinationAccountId?: string | null;
    replicationRoleArn?: string;
    ruleName?: string;
    prefix?: string | null;
    replicateDeleteMarkers?: boolean;
    autoEnableSourceVersioning?: boolean;
    autoEnableDestinationVersioning?: boolean;
  };

  const data = await s3OptimizationService.applyReplicationSetup(scope, {
    sourceBucketName: String(payload.sourceBucketName ?? "").trim(),
    destinationBucketName: String(payload.destinationBucketName ?? "").trim(),
    destinationRegion: String(payload.destinationRegion ?? "").trim(),
    replicationType: payload.replicationType === "cross_account" ? "cross_account" : "same_account",
    destinationAccountId: payload.destinationAccountId ?? null,
    replicationRoleArn: String(payload.replicationRoleArn ?? "").trim(),
    ruleName: String(payload.ruleName ?? "").trim(),
    prefix: payload.prefix ?? null,
    replicateDeleteMarkers: payload.replicateDeleteMarkers === true,
    autoEnableSourceVersioning: payload.autoEnableSourceVersioning === true,
    autoEnableDestinationVersioning: payload.autoEnableDestinationVersioning === true,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 replication configured successfully",
    data,
  });
}

export async function handleGetS3BucketLifecycleInsight(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);

  const bucket = typeof req.query.bucket === "string" ? req.query.bucket.trim() : "";
  if (!bucket) {
    throw new BadRequestError("bucket query parameter is required");
  }

  const scope = await scopeResolver.resolve(dashboardRequest);
  const data = await s3OptimizationService.getBucketLifecycleInsight(scope, bucket);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 bucket lifecycle insight fetched successfully",
    data,
  });
}

export async function handleApplyS3BucketLifecyclePolicy(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);

  const payload = req.body as {
    bucketName?: string;
    bucket_name?: string;
    accountId?: string;
    account_id?: string;
    region?: string;
    ruleName?: string;
    rule_name?: string;
    status?: "Enabled" | "Disabled";
    scope?: {
      type?: "entire_bucket" | "prefix";
      prefix?: string;
      minObjectSizeBytes?: number | null;
      maxObjectSizeBytes?: number | null;
      min_object_size_bytes?: number | null;
      max_object_size_bytes?: number | null;
    };
    transitions?: Array<{ days?: number; storageClass?: "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE" | "INTELLIGENT_TIERING" }>;
    transitions_config?: Array<{ days?: number; storage_class?: "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE" | "INTELLIGENT_TIERING" }>;
    noncurrentVersionTransitions?: Array<{ days?: number; storageClass?: "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE" | "INTELLIGENT_TIERING" }>;
    noncurrent_version_transitions?: Array<{ days?: number; storage_class?: "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE" | "INTELLIGENT_TIERING" }>;
    noncurrentVersionExpirationDays?: number | null;
    noncurrent_version_expiration_days?: number | null;
    expiredObjectDeleteMarker?: boolean | null;
    expired_object_delete_marker?: boolean | null;
    expirationDays?: number | null;
    expiration_days?: number | null;
    abortIncompleteMultipartUploadDays?: number | null;
    abort_multipart_days?: number | null;
    deleteWarningAccepted?: boolean | null;
    delete_warning_accepted?: boolean | null;
    lifecycle_status?: "Enabled" | "Disabled";
    rule_status?: "Enabled" | "Disabled";
    ruleScope?: { type?: "entire_bucket" | "prefix"; prefix?: string };
    scope_config?: { type?: "entire_bucket" | "prefix"; prefix?: string };
  };

  const actorUserId =
    typeof req.auth?.user.id === "string" || typeof req.auth?.user.id === "number"
      ? String(req.auth?.user.id)
      : null;

  const data = await s3OptimizationService.applyBucketLifecyclePolicy(scope, {
    bucketName: String(payload.bucketName ?? payload.bucket_name ?? "").trim(),
    accountId: String(payload.accountId ?? payload.account_id ?? "").trim() || null,
    region: String(payload.region ?? "").trim() || null,
    ruleName: String(payload.ruleName ?? payload.rule_name ?? "").trim(),
    status:
      payload.status === "Disabled" || payload.lifecycle_status === "Disabled" || payload.rule_status === "Disabled"
        ? "Disabled"
        : "Enabled",
    scope: {
      type: (payload.scope?.type ?? payload.ruleScope?.type ?? payload.scope_config?.type) === "prefix"
        ? "prefix"
        : "entire_bucket",
      ...(typeof (payload.scope?.prefix ?? payload.ruleScope?.prefix ?? payload.scope_config?.prefix) === "string"
        ? { prefix: payload.scope?.prefix ?? payload.ruleScope?.prefix ?? payload.scope_config?.prefix }
        : {}),
      minObjectSizeBytes:
        payload.scope?.minObjectSizeBytes ??
        payload.scope?.min_object_size_bytes ??
        null,
      maxObjectSizeBytes:
        payload.scope?.maxObjectSizeBytes ??
        payload.scope?.max_object_size_bytes ??
        null,
    },
    transitions: Array.isArray(payload.transitions)
      ? payload.transitions.map((item) => ({
          days: Number(item.days),
          storageClass: item.storageClass === "DEEP_ARCHIVE"
            ? "DEEP_ARCHIVE"
            : item.storageClass === "STANDARD_IA"
              ? "STANDARD_IA"
              : item.storageClass === "INTELLIGENT_TIERING"
                ? "INTELLIGENT_TIERING"
              : "GLACIER",
        }))
      : Array.isArray(payload.transitions_config)
        ? payload.transitions_config.map((item) => ({
            days: Number(item.days),
            storageClass: item.storage_class === "DEEP_ARCHIVE"
              ? "DEEP_ARCHIVE"
              : item.storage_class === "STANDARD_IA"
                ? "STANDARD_IA"
                : item.storage_class === "INTELLIGENT_TIERING"
                  ? "INTELLIGENT_TIERING"
                  : "GLACIER",
        }))
      : [],
    noncurrentVersionTransitions: Array.isArray(payload.noncurrentVersionTransitions)
      ? payload.noncurrentVersionTransitions.map((item) => ({
          days: Number(item.days),
          storageClass: item.storageClass === "DEEP_ARCHIVE"
            ? "DEEP_ARCHIVE"
            : item.storageClass === "STANDARD_IA"
              ? "STANDARD_IA"
              : item.storageClass === "INTELLIGENT_TIERING"
                ? "INTELLIGENT_TIERING"
                : "GLACIER",
        }))
      : Array.isArray(payload.noncurrent_version_transitions)
        ? payload.noncurrent_version_transitions.map((item) => ({
            days: Number(item.days),
            storageClass: item.storage_class === "DEEP_ARCHIVE"
              ? "DEEP_ARCHIVE"
              : item.storage_class === "STANDARD_IA"
                ? "STANDARD_IA"
                : item.storage_class === "INTELLIGENT_TIERING"
                  ? "INTELLIGENT_TIERING"
                  : "GLACIER",
          }))
        : [],
    expirationDays: payload.expirationDays ?? payload.expiration_days ?? null,
    abortIncompleteMultipartUploadDays:
      payload.abortIncompleteMultipartUploadDays ?? payload.abort_multipart_days ?? null,
    noncurrentVersionExpirationDays:
      payload.noncurrentVersionExpirationDays ?? payload.noncurrent_version_expiration_days ?? null,
    expiredObjectDeleteMarker: payload.expiredObjectDeleteMarker ?? payload.expired_object_delete_marker ?? null,
    deleteWarningAccepted: payload.deleteWarningAccepted ?? payload.delete_warning_accepted ?? null,
  }, actorUserId);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 lifecycle policy applied successfully",
    data,
  });
}

export async function handleGetPolicyActionHistory(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const data = await s3OptimizationService.getPolicyActionHistory(scope);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Policy action history fetched successfully",
    data,
  });
}

export async function handleDeleteS3BucketLifecyclePolicy(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);

  const payload = req.body as {
    bucketName?: string;
    bucket_name?: string;
    ruleName?: string;
    rule_name?: string;
    accountId?: string;
    account_id?: string;
    region?: string;
  };

  const actorUserId =
    typeof req.auth?.user.id === "string" || typeof req.auth?.user.id === "number"
      ? String(req.auth?.user.id)
      : null;

  const data = await s3OptimizationService.deleteBucketLifecyclePolicy(
    scope,
    {
      bucketName: String(payload.bucketName ?? payload.bucket_name ?? "").trim(),
      ruleName: String(payload.ruleName ?? payload.rule_name ?? "").trim(),
      accountId: String(payload.accountId ?? payload.account_id ?? "").trim() || null,
      region: String(payload.region ?? "").trim() || null,
    },
    actorUserId,
  );

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 lifecycle policy deleted successfully",
    data,
  });
}

