import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { BadRequestError } from "../../../errors/http-errors.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildDashboardRequest } from "../shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../shared/validator.js";
import { S3CostInsightsService } from "./s3-cost-insights.service.js";
import type { S3CostInsightsFilters } from "./s3-cost-insights.types.js";

const scopeResolver = new DashboardScopeResolver();
const s3CostInsightsService = new S3CostInsightsService();
const ALLOWED_Y_AXIS_METRICS = new Set(["gross_cost", "billed_cost", "effective_cost", "amortized_cost", "usage_quantity"]);
const ALLOWED_USAGE_Y_AXIS = new Set(["storage_gb", "request_count", "transfer_gb", "object_count"]);

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

const parseS3Filters = (req: Request): Partial<S3CostInsightsFilters> => ({
  costCategory: parseStringList(req.query.costCategory) as S3CostInsightsFilters["costCategory"],
  seriesValues: parseStringList(req.query.seriesValues),
  bucket: parseOptionalString(req.query.bucket),
  storageClass: parseStringList(req.query.storageClass),
  region: parseStringList(req.query.region),
  account: parseStringList(req.query.account),
  costBy: (parseOptionalString(req.query.costBy) ?? undefined) as S3CostInsightsFilters["costBy"] | undefined,
  seriesBy: (parseOptionalString(req.query.seriesBy) ?? undefined) as
    | S3CostInsightsFilters["seriesBy"]
    | undefined,
  yAxisMetric: (parseOptionalString(req.query.yAxisMetric) ?? undefined) as
    | S3CostInsightsFilters["yAxisMetric"]
    | undefined,
  usageYAxis: (parseOptionalString(req.query.usageYAxis) ?? undefined) as
    | S3CostInsightsFilters["usageYAxis"]
    | undefined,
});

const validateS3Filters = (filters: Partial<S3CostInsightsFilters>): void => {
  if (filters.yAxisMetric && !ALLOWED_Y_AXIS_METRICS.has(filters.yAxisMetric)) {
    throw new BadRequestError(`Invalid yAxisMetric: ${filters.yAxisMetric}`);
  }
  if (filters.usageYAxis && !ALLOWED_USAGE_Y_AXIS.has(filters.usageYAxis)) {
    throw new BadRequestError(`Invalid usageYAxis: ${filters.usageYAxis}`);
  }
};

const parseResponseMode = (req: Request): "full" | "core" | "quick" | "overview" => {
  const mode = (parseOptionalString(req.query.responseMode) ?? "full").toLowerCase();
  if (mode === "quick") return "quick";
  if (mode === "overview") return "overview";
  return mode === "core" ? "core" : "full";
};

export async function handleGetS3CostInsights(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);

  const scope = await scopeResolver.resolve(dashboardRequest);
  const parsedFilters = parseS3Filters(req);
  validateS3Filters(parsedFilters);
  const data = await s3CostInsightsService.getInsights(scope, parsedFilters, {
    responseMode: parseResponseMode(req),
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 cost insights fetched successfully",
    data,
  });
}
