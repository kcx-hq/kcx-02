import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { BadRequestError } from "../../../errors/http-errors.js";
import { logger } from "../../../utils/logger.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { resolveDashboardTenantId } from "../shared/dashboard-request-builder.js";
import { getOptimizationDashboardData, triggerOptimizationRecommendationSync } from "./optimization.service.js";
import { syncAwsRightsizingRecommendationsOnDashboardOpen } from "./recommendation-sync/sync.service.js";
import type { AwsComputeOptimizerEc2RecommendationInput } from "./recommendation-sync/types.js";

type SyncRequestBody = {
  billingSourceId?: string;
  cloudConnectionId?: string;
  recommendations?: AwsComputeOptimizerEc2RecommendationInput[];
};

export async function handleGetOptimizationDashboard(req: Request, res: Response): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);

  try {
    await syncAwsRightsizingRecommendationsOnDashboardOpen({ tenantId });
  } catch (error) {
    logger.warn("Optimization sync-on-dashboard-open failed", {
      tenantId,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  const dashboardData = await getOptimizationDashboardData(tenantId);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Optimization dashboard data fetched successfully",
    data: dashboardData,
  });
}

export async function handleSyncOptimizationRecommendations(req: Request, res: Response): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);
  const body = (req.body ?? {}) as SyncRequestBody;
  const billingSourceId = typeof body.billingSourceId === "string" ? body.billingSourceId.trim() : undefined;
  const cloudConnectionId = typeof body.cloudConnectionId === "string" ? body.cloudConnectionId.trim() : undefined;

  if (!billingSourceId && !cloudConnectionId) {
    throw new BadRequestError("billingSourceId or cloudConnectionId is required");
  }

  if (typeof body.recommendations !== "undefined" && !Array.isArray(body.recommendations)) {
    throw new BadRequestError("recommendations must be an array when provided");
  }

  const syncResult = await triggerOptimizationRecommendationSync({
    tenantId,
    billingSourceId: billingSourceId || undefined,
    cloudConnectionId: cloudConnectionId || undefined,
    recommendations: Array.isArray(body.recommendations) ? body.recommendations : undefined,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Optimization recommendations sync completed",
    data: syncResult,
  });
}
