import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { BadRequestError, NotFoundError } from "../../../errors/http-errors.js";
import { logger } from "../../../utils/logger.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { resolveDashboardTenantId } from "../shared/dashboard-request-builder.js";
import {
  getIdleOverviewData,
  getIdleRecommendationDetailData,
  getIdleRecommendationsData,
  getOptimizationRecommendationDebugData,
  getOptimizationDashboardData,
  getRightsizingOverviewData,
  getRightsizingRecommendationDetailData,
  getRightsizingRecommendationsData,
  triggerIdleRecommendationSync,
  triggerOptimizationRecommendationSync,
} from "./optimization.service.js";
import {
  syncAwsIdleRecommendationsOnRecommendationsOpen,
  syncAwsRightsizingRecommendationsOnDashboardOpen,
  syncAwsRightsizingRecommendationsOnRecommendationsOpen,
} from "./recommendation-sync/sync.service.js";
import type { AwsComputeOptimizerEc2RecommendationInput } from "./recommendation-sync/types.js";

type SyncRequestBody = {
  billingSourceId?: string;
  cloudConnectionId?: string;
  recommendations?: AwsComputeOptimizerEc2RecommendationInput[];
};

type DebugSyncQuery = {
  billingSourceId?: string;
  cloudConnectionId?: string;
};

const parseCsvParam = (value: unknown): string[] | undefined => {
  if (typeof value === "undefined") return undefined;
  const normalized = String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : undefined;
};

const parseIntParam = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseIntListParam = (value: unknown): number[] | undefined => {
  const textList = parseCsvParam(value);
  if (!textList) return undefined;
  const parsed = textList.map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry));
  return parsed.length > 0 ? parsed : undefined;
};

export async function handleGetOptimizationDashboard(req: Request, res: Response): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);

  try {
    await syncAwsRightsizingRecommendationsOnDashboardOpen({ tenantId });
  } catch (error) {
    logger.warn("Optimization sync-on-optimization-click failed", {
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

export async function handleSyncIdleRecommendations(req: Request, res: Response): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);
  const body = (req.body ?? {}) as SyncRequestBody;
  const billingSourceId = typeof body.billingSourceId === "string" ? body.billingSourceId.trim() : undefined;
  const cloudConnectionId = typeof body.cloudConnectionId === "string" ? body.cloudConnectionId.trim() : undefined;

  if (!billingSourceId && !cloudConnectionId) {
    throw new BadRequestError("billingSourceId or cloudConnectionId is required");
  }

  const syncResult = await triggerIdleRecommendationSync({
    tenantId,
    billingSourceId: billingSourceId || undefined,
    cloudConnectionId: cloudConnectionId || undefined,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Idle recommendations sync completed",
    data: syncResult,
  });
}

export async function handleDebugSyncOptimizationRecommendations(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);
  const query = (req.query ?? {}) as DebugSyncQuery;
  const billingSourceId =
    typeof query.billingSourceId === "string" ? query.billingSourceId.trim() : undefined;
  const cloudConnectionId =
    typeof query.cloudConnectionId === "string" ? query.cloudConnectionId.trim() : undefined;

  const syncResult = await triggerOptimizationRecommendationSync({
    tenantId,
    billingSourceId: billingSourceId || undefined,
    cloudConnectionId: cloudConnectionId || undefined,
  });

  const debugData = await getOptimizationRecommendationDebugData(tenantId);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Optimization recommendation debug sync completed",
    data: {
      syncResult,
      debug: debugData,
    },
  });
}

export async function handleGetRightsizingOverview(req: Request, res: Response): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);
  const data = await getRightsizingOverviewData(tenantId);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Rightsizing overview fetched successfully",
    data,
  });
}

export async function handleGetRightsizingRecommendations(req: Request, res: Response): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);
  const data = await getRightsizingRecommendationsData({
    tenantId,
    filters: {
      status: parseCsvParam(req.query.status),
      effort: parseCsvParam(req.query.effort),
      risk: parseCsvParam(req.query.risk),
      accountIds: parseCsvParam(req.query.account),
      regions: parseCsvParam(req.query.region),
      serviceKeys: parseIntListParam(req.query.serviceKey),
      page: parseIntParam(req.query.page, 1),
      pageSize: parseIntParam(req.query.pageSize, 20),
    },
  });

  void syncAwsRightsizingRecommendationsOnRecommendationsOpen({ tenantId }).catch((error) => {
    logger.warn("Optimization sync-on-recommendations-open failed", {
      tenantId,
      reason: error instanceof Error ? error.message : String(error),
    });
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Rightsizing recommendations fetched successfully",
    data,
  });
}

export async function handleGetRightsizingRecommendationDetail(req: Request, res: Response): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);
  const recommendationId = String(req.params.recommendationId ?? "").trim();
  if (!recommendationId) {
    throw new BadRequestError("recommendationId is required");
  }

  const data = await getRightsizingRecommendationDetailData({
    tenantId,
    recommendationId,
  });
  if (!data) {
    throw new NotFoundError("Rightsizing recommendation not found");
  }

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Rightsizing recommendation detail fetched successfully",
    data,
  });
}

export async function handleGetIdleOverview(req: Request, res: Response): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);
  const data = await getIdleOverviewData(tenantId);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Idle overview fetched successfully",
    data,
  });
}

export async function handleGetIdleRecommendations(req: Request, res: Response): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);

  const data = await getIdleRecommendationsData({
    tenantId,
    filters: {
      status: parseCsvParam(req.query.status),
      effort: parseCsvParam(req.query.effort),
      risk: parseCsvParam(req.query.risk),
      accountIds: parseCsvParam(req.query.account),
      regions: parseCsvParam(req.query.region),
      serviceKeys: parseIntListParam(req.query.serviceKey),
      page: parseIntParam(req.query.page, 1),
      pageSize: parseIntParam(req.query.pageSize, 20),
    },
  });

  void syncAwsIdleRecommendationsOnRecommendationsOpen({ tenantId }).catch((error) => {
    logger.warn("Idle sync-on-recommendations-open failed", {
      tenantId,
      reason: error instanceof Error ? error.message : String(error),
    });
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Idle recommendations fetched successfully",
    data,
  });
}

export async function handleGetIdleRecommendationDetail(req: Request, res: Response): Promise<void> {
  const tenantId = resolveDashboardTenantId(req);
  const recommendationId = String(req.params.recommendationId ?? "").trim();
  if (!recommendationId) {
    throw new BadRequestError("recommendationId is required");
  }

  const data = await getIdleRecommendationDetailData({
    tenantId,
    recommendationId,
  });
  if (!data) {
    throw new NotFoundError("Idle recommendation not found");
  }

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Idle recommendation detail fetched successfully",
    data,
  });
}
