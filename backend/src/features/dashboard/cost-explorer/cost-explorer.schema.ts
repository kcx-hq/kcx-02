import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import type { CostExplorerFilters } from "./cost-explorer.types.js";

const costExplorerFiltersSchema = z.object({
  granularity: z.enum(["hourly", "daily", "monthly"]),
  groupBy: z.enum(["none", "service", "service-category", "resource", "region", "account"]),
  metric: z.enum(["billed", "effective", "list"]),
  compareKey: z.enum(["previous-month", "budget", "forecast"]).nullable(),
});

const firstQueryValue = (value: unknown): string | undefined => {
  if (typeof value === "undefined") return undefined;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return typeof value === "string" ? value : undefined;
};

export function buildCostExplorerFilters(req: Request): CostExplorerFilters {
  const granularity = firstQueryValue(req.query.granularity) ?? "daily";
  const groupBy = firstQueryValue(req.query.groupBy) ?? "none";
  const metric = firstQueryValue(req.query.metric) ?? "billed";
  const compareRaw = firstQueryValue(req.query.compareKey) ?? firstQueryValue(req.query.compare) ?? null;
  const compareKey = compareRaw && compareRaw.trim().length > 0 ? compareRaw : null;

  return parseWithSchema(costExplorerFiltersSchema, {
    granularity,
    groupBy,
    metric,
    compareKey,
  });
}
