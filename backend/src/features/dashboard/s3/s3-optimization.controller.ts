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
    ruleName?: string;
    status?: "Enabled" | "Disabled";
    scope?: { type?: "entire_bucket" | "prefix"; prefix?: string };
    transitions?: Array<{ days?: number; storageClass?: "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE" }>;
    expirationDays?: number | null;
    abortIncompleteMultipartUploadDays?: number | null;
  };

  const actorUserId =
    typeof req.auth?.user.id === "string" || typeof req.auth?.user.id === "number"
      ? String(req.auth?.user.id)
      : null;

  const data = await s3OptimizationService.applyBucketLifecyclePolicy(scope, {
    bucketName: String(payload.bucketName ?? "").trim(),
    ruleName: String(payload.ruleName ?? "").trim(),
    status: payload.status === "Disabled" ? "Disabled" : "Enabled",
    scope: {
      type: payload.scope?.type === "prefix" ? "prefix" : "entire_bucket",
      ...(typeof payload.scope?.prefix === "string" ? { prefix: payload.scope.prefix } : {}),
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
      : [],
    expirationDays: payload.expirationDays ?? null,
    abortIncompleteMultipartUploadDays: payload.abortIncompleteMultipartUploadDays ?? null,
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
