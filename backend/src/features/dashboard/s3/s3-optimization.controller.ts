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
