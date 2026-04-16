import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import type { CostExplorerFilters, CostExplorerGroupBy } from "./cost-explorer.types.js";

const BASE_GROUP_BY = ["none", "service", "service-category", "resource", "region", "account"] as const;

const isValidGroupBy = (value: string): value is CostExplorerGroupBy =>
  BASE_GROUP_BY.includes(value as (typeof BASE_GROUP_BY)[number]) || /^tag:[a-z0-9]+$/.test(value);

const costExplorerFiltersSchema = z.object({
  granularity: z.enum(["hourly", "daily", "monthly"]),
  groupBy: z.string().refine(
    (value) => isValidGroupBy(value),
    "groupBy must be a known dimension or tag:<normalized_key>",
  ).transform((value) => value as CostExplorerGroupBy),
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

const costExplorerGroupOptionsSchema = z.object({
  tagKey: z.string().trim().regex(/^[a-z0-9]+$/).nullable(),
});

export function buildCostExplorerGroupOptionsFilters(req: Request): { tagKey: string | null } {
  const tagKeyRaw = firstQueryValue(req.query.tagKey) ?? null;
  const tagKey = tagKeyRaw && tagKeyRaw.trim().length > 0 ? tagKeyRaw.trim().toLowerCase() : null;
  return parseWithSchema(costExplorerGroupOptionsSchema, { tagKey });
}
