import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildDashboardRequest } from "../shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../shared/validator.js";
import { S3CostInsightsService } from "./s3-cost-insights.service.js";
import type { S3CostInsightsFilters } from "./s3-cost-insights.types.js";

const scopeResolver = new DashboardScopeResolver();
const s3CostInsightsService = new S3CostInsightsService();

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
});

export async function handleGetS3CostInsights(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);

  const scope = await scopeResolver.resolve(dashboardRequest);
  const data = await s3CostInsightsService.getInsights(scope, parseS3Filters(req));

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 cost insights fetched successfully",
    data,
  });
}
