import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import type { DashboardScope } from "../../dashboard/dashboard.types.js";
import {
  EC2_USAGE_EXPLORER_AGGREGATIONS,
  EC2_USAGE_EXPLORER_COMPARE,
  EC2_USAGE_EXPLORER_GRANULARITIES,
  EC2_USAGE_EXPLORER_GROUP_BY,
  EC2_USAGE_EXPLORER_METRICS,
  type Ec2UsageExplorerInput,
  type Ec2UsageExplorerTagFilter,
} from "./ec2-usage-explorer.types.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const firstValue = (value: unknown): string | undefined => {
  if (typeof value === "undefined") return undefined;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
};

const parseStringArray = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value])
    .flatMap((entry) => String(entry ?? "").split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseTagFilters = (value: unknown): Ec2UsageExplorerTagFilter[] =>
  parseStringArray(value)
    .map((entry) => {
      const sep = entry.includes(":") ? ":" : entry.includes("=") ? "=" : null;
      if (!sep) return null;
      const i = entry.indexOf(sep);
      const key = entry.slice(0, i).trim();
      const val = entry.slice(i + 1).trim();
      if (!key || !val) return null;
      return { key, value: val };
    })
    .filter((item): item is Ec2UsageExplorerTagFilter => Boolean(item));

const querySchema = z.object({
  startDate: z.string().regex(DATE_ONLY_REGEX),
  endDate: z.string().regex(DATE_ONLY_REGEX),
  granularity: z.enum(EC2_USAGE_EXPLORER_GRANULARITIES),
  usageMetric: z.enum(EC2_USAGE_EXPLORER_METRICS),
  aggregation: z.enum(EC2_USAGE_EXPLORER_AGGREGATIONS),
  groupBy: z.enum(EC2_USAGE_EXPLORER_GROUP_BY),
  tagKey: z.string().trim().min(1).nullable(),
  compare: z.enum(EC2_USAGE_EXPLORER_COMPARE),
  accountIds: z.array(z.string().trim().min(1)),
  regions: z.array(z.string().trim().min(1)),
  instanceTypes: z.array(z.string().trim().min(1)),
  tags: z.array(z.object({ key: z.string().trim().min(1), value: z.string().trim().min(1) })),
}).superRefine((value, ctx) => {
  if (value.startDate > value.endDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate"], message: "startDate must be <= endDate" });
  }
  if (value.groupBy === "tag" && !value.tagKey) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tagKey"], message: "tagKey is required when groupBy=tag" });
  }
});

export function buildEc2UsageExplorerInput(req: Request, scope: DashboardScope): Ec2UsageExplorerInput {
  const payload = { ...(req.method === "POST" ? (req.body as Record<string, unknown> | undefined) : undefined), ...req.query };
  const parsed = parseWithSchema(querySchema, {
    startDate: firstValue(payload.startDate) ?? firstValue(payload.from) ?? scope.from,
    endDate: firstValue(payload.endDate) ?? firstValue(payload.to) ?? scope.to,
    granularity: firstValue(payload.granularity) ?? "daily",
    usageMetric: firstValue(payload.usageMetric) ?? "cpu",
    aggregation: firstValue(payload.aggregation) ?? "avg",
    groupBy: firstValue(payload.groupBy) ?? "none",
    tagKey: firstValue(payload.tagKey)?.trim() || null,
    compare: firstValue(payload.compare) ?? "none",
    accountIds: parseStringArray(payload.accountIds),
    regions: parseStringArray(payload.regions),
    instanceTypes: parseStringArray(payload.instanceTypes),
    tags: parseTagFilters(payload.tags),
  });

  return {
    scope,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    granularity: parsed.granularity,
    usageMetric: parsed.usageMetric,
    aggregation: parsed.aggregation,
    groupBy: parsed.groupBy,
    tagKey: parsed.tagKey,
    compare: parsed.compare,
    filters: {
      accountIds: parsed.accountIds,
      regions: parsed.regions,
      instanceTypes: parsed.instanceTypes,
      tags: parsed.tags,
    },
  };
}

