import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../../constants/http-status.js";
import { sendSuccess } from "../../../../utils/api-response.js";
import { buildDashboardRequest } from "../../shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../../shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../../shared/validator.js";

import { S3AnomaliesService } from "./s3-anomalies.service.js";
import type { S3AnomaliesFilters } from "./s3-anomalies.types.js";

const scopeResolver = new DashboardScopeResolver();
const s3AnomaliesService = new S3AnomaliesService();

const parseOptionalString = (value: unknown): string | null => {
  if (typeof value === "undefined" || value === null) return null;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" && first.trim().length > 0 ? first.trim() : null;
  }
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const parsePositiveInt = (value: unknown, fallback: number): number => {
  const raw = parseOptionalString(value);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const parseS3AnomalyFilters = (req: Request): S3AnomaliesFilters => {
  const severityRaw = parseOptionalString(req.query.severity)?.toLowerCase();
  const statusRaw = parseOptionalString(req.query.status)?.toLowerCase();
  return {
    limit: Math.min(200, Math.max(1, parsePositiveInt(req.query.limit, 50))),
    offset: parsePositiveInt(req.query.offset, 0),
    severity:
      severityRaw === "low" || severityRaw === "medium" || severityRaw === "high"
        ? severityRaw
        : undefined,
    status:
      statusRaw === "open" || statusRaw === "resolved" || statusRaw === "ignored"
        ? statusRaw
        : undefined,
  };
};

export async function handleGetS3Anomalies(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const filters = parseS3AnomalyFilters(req);
  const data = await s3AnomaliesService.getAnomalies(scope, filters);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 anomalies fetched successfully",
    data,
  });
}

