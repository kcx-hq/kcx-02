import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import type { CostHistoryFilters } from "./cost-history.types.js";

const costHistoryFiltersSchema = z.object({
  granularity: z.enum(["day", "month"]),
  groupBy: z.enum(["service", "region", "team", "app", "account", "resource", "service-category"]),
  xAxis: z.enum(["date", "account", "region"]),
  yAxisMetric: z.enum(["billed_cost", "effective_cost", "amortized_cost"]),
});

const firstQueryValue = (value: unknown): string | undefined => {
  if (typeof value === "undefined") return undefined;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return typeof value === "string" ? value : undefined;
};

export function buildCostHistoryFilters(req: Request): CostHistoryFilters {
  const granularity = firstQueryValue(req.query.granularity) ?? "month";
  const groupBy = firstQueryValue(req.query.groupBy) ?? "service";
  const xAxis = firstQueryValue(req.query.xAxis) ?? "date";
  const yAxisMetric = firstQueryValue(req.query.yAxisMetric) ?? "billed_cost";

  return parseWithSchema(costHistoryFiltersSchema, {
    granularity,
    groupBy,
    xAxis,
    yAxisMetric,
  });
}

