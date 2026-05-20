import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { BadRequestError } from "../../../errors/http-errors.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildDashboardRequest } from "../shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../shared/validator.js";
import { S3BucketDetailService } from "./s3-bucket-detail.service.js";

const scopeResolver = new DashboardScopeResolver();
const s3BucketDetailService = new S3BucketDetailService();

export async function handleGetS3BucketDetail(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const bucketName = decodeURIComponent(String(req.params.bucketName ?? req.query.bucketName ?? "")).trim();
  if (!bucketName) {
    throw new BadRequestError("bucketName is required");
  }

  const scope = await scopeResolver.resolve(dashboardRequest);
  const data = await s3BucketDetailService.getBucketDetail(scope, bucketName);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 bucket detail fetched successfully",
    data,
  });
}
