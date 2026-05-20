import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildDashboardRequest } from "../shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../shared/validator.js";
import { S3UsageInsightsService } from "./s3-usage-insights.service.js";
import type { S3UsageInsightsFilters } from "./s3-usage-insights.types.js";

const scopeResolver = new DashboardScopeResolver();
const s3UsageInsightsService = new S3UsageInsightsService();

const parseOptionalString = (value: unknown): string | null => {
  if (typeof value === "undefined" || value === null) return null;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" && first.trim().length > 0 ? first.trim() : null;
  }
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const parseStringList = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : typeof value === "undefined" ? [] : [value];
  return Array.from(
    new Set(
      values
        .flatMap((entry) => String(entry).split(","))
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );
};

const parseS3UsageFilters = (req: Request): S3UsageInsightsFilters => {
  const xAxis = parseOptionalString(req.query.xAxis);
  const usageByRaw = parseOptionalString(req.query.usageBy) ?? parseOptionalString(req.query.seriesBy);
  const yAxisRaw = parseOptionalString(req.query.yAxis) ?? parseOptionalString(req.query.usageYAxis);
  const compareBy = parseOptionalString(req.query.compareBy);
  const normalizedUsageBy =
    usageByRaw?.toLowerCase() === "operation"
      ? "operation_group"
      : usageByRaw?.toLowerCase() === "operation_group"
        ? "operation_group"
        : usageByRaw?.toLowerCase() === "storage_class"
          ? "storage_class"
          : usageByRaw?.toLowerCase() === "bucket"
            ? "bucket"
            : undefined;
  const normalizedYAxis =
    yAxisRaw?.toLowerCase() === "storage_gb_mo"
      ? "storage_gb_month"
      : yAxisRaw?.toLowerCase() === "storage_gb_month"
        ? "storage_gb_month"
        : yAxisRaw?.toLowerCase() === "retrieval_gb"
          ? "retrieval_gb"
          : yAxisRaw?.toLowerCase() === "storage_gb"
            ? "storage_gb"
            : yAxisRaw?.toLowerCase() === "request_count"
              ? "request_count"
              : yAxisRaw?.toLowerCase() === "transfer_gb"
                ? "transfer_gb"
                : yAxisRaw?.toLowerCase() === "object_count"
                  ? "object_count"
                  : yAxisRaw?.toLowerCase() === "api_operations"
                    ? "api_operations"
                    : undefined;

  return {
    xAxis: (xAxis ?? "date") as S3UsageInsightsFilters["xAxis"],
    usageBy: normalizedUsageBy,
    seriesBy: usageByRaw ?? undefined,
    compareBy: (compareBy ?? "none") as S3UsageInsightsFilters["compareBy"],
    yAxis: normalizedYAxis,
    usageYAxis: (normalizedYAxis === "storage_gb_month" ? "storage_gb_mo" : normalizedYAxis) as S3UsageInsightsFilters["usageYAxis"],
    bucket: parseOptionalString(req.query.bucket),
    region: parseStringList(req.query.region),
    account: parseStringList(req.query.account),
    storageClass: parseStringList(req.query.storageClass),
  };
};

export async function handleGetS3UsageInsights(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);

  const scope = await scopeResolver.resolve(dashboardRequest);
  const filters = parseS3UsageFilters(req);
  const data = await s3UsageInsightsService.getInsights(scope, filters);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 usage insights fetched successfully",
    data,
  });
}
