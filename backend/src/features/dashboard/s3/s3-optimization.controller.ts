import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { BadRequestError } from "../../../errors/http-errors.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildDashboardRequest } from "../shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../shared/validator.js";
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
    scope?: { type?: "entire_bucket" | "prefix"; prefix?: string };
    transitions?: Array<{ days?: number; storageClass?: "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE" }>;
    transitions_config?: Array<{ days?: number; storage_class?: "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE" }>;
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
    },
    transitions: Array.isArray(payload.transitions)
      ? payload.transitions.map((item) => ({
          days: Number(item.days),
          storageClass: item.storageClass === "DEEP_ARCHIVE"
            ? "DEEP_ARCHIVE"
            : item.storageClass === "STANDARD_IA"
              ? "STANDARD_IA"
              : "GLACIER",
        }))
      : Array.isArray(payload.transitions_config)
        ? payload.transitions_config.map((item) => ({
            days: Number(item.days),
            storageClass: item.storage_class === "DEEP_ARCHIVE"
              ? "DEEP_ARCHIVE"
              : item.storage_class === "STANDARD_IA"
                ? "STANDARD_IA"
                : "GLACIER",
          }))
      : [],
    expirationDays: payload.expirationDays ?? payload.expiration_days ?? null,
    abortIncompleteMultipartUploadDays:
      payload.abortIncompleteMultipartUploadDays ?? payload.abort_multipart_days ?? null,
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
