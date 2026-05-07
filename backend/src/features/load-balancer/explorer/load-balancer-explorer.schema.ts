import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import type { DashboardScope } from "../../dashboard/dashboard.types.js";
import {
  LOAD_BALANCER_EXPLORER_GRANULARITIES,
  LOAD_BALANCER_EXPLORER_GROUP_BY,
  LOAD_BALANCER_EXPLORER_METRICS,
  type LoadBalancerExplorerInput,
  type LoadBalancerExplorerTagFilter,
} from "./load-balancer-explorer.types.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const firstQueryValue = (value: unknown): string | undefined => {
  if (typeof value === "undefined") return undefined;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return typeof value === "string" ? value : undefined;
};

const parseStringArray = (value: unknown): string[] => {
  if (typeof value === "undefined") return [];
  const values = (Array.isArray(value) ? value : [value])
    .flatMap((entry) => String(entry).split(","))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return [...new Set(values)];
};

const parseTagFilters = (value: unknown): LoadBalancerExplorerTagFilter[] => {
  const rawValues = parseStringArray(value);
  return rawValues
    .map((entry) => {
      const normalized = entry.trim();
      if (!normalized) return null;
      const splitter = normalized.includes(":") ? ":" : normalized.includes("=") ? "=" : null;
      if (!splitter) return null;
      const separatorIndex = normalized.indexOf(splitter);
      const key = normalized.slice(0, separatorIndex).trim();
      const val = normalized.slice(separatorIndex + 1).trim();
      if (!key || !val) return null;
      return { key, value: val };
    })
    .filter((entry): entry is LoadBalancerExplorerTagFilter => Boolean(entry));
};

const querySchema = z
  .object({
    startDate: z.string().regex(DATE_ONLY_REGEX),
    endDate: z.string().regex(DATE_ONLY_REGEX),
    metric: z.enum(LOAD_BALANCER_EXPLORER_METRICS),
    granularity: z.enum(LOAD_BALANCER_EXPLORER_GRANULARITIES),
    groupBy: z.enum(LOAD_BALANCER_EXPLORER_GROUP_BY),
    tagKey: z.string().trim().min(1).max(200).nullable(),
    cloudConnectionId: z.string().trim().min(1).max(100).nullable(),
    accountId: z.string().trim().min(1).max(100).nullable(),
    regions: z.array(z.string().trim().min(1)).max(200),
    types: z.array(z.string().trim().min(1)).max(200),
    schemes: z.array(z.string().trim().min(1)).max(200),
    states: z.array(z.string().trim().min(1)).max(200),
    teams: z.array(z.string().trim().min(1)).max(200),
    products: z.array(z.string().trim().min(1)).max(200),
    environments: z.array(z.string().trim().min(1)).max(200),
    tags: z.array(z.object({ key: z.string().trim().min(1), value: z.string().trim().min(1) })).max(200),
    groupValues: z.array(z.string().trim().min(1)).max(200),
  })
  .superRefine((value, ctx) => {
    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "startDate must be less than or equal to endDate",
      });
    }
    if (value.groupBy === "tag" && (!value.tagKey || value.tagKey.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tagKey"],
        message: "tagKey is required when groupBy=tag",
      });
    }
  });

export function buildLoadBalancerExplorerInput(req: Request, scope: DashboardScope): LoadBalancerExplorerInput {
  const startDate =
    firstQueryValue(req.query.startDate) ??
    firstQueryValue(req.query.dateFrom) ??
    firstQueryValue(req.query.from) ??
    scope.from;
  const endDate =
    firstQueryValue(req.query.endDate) ??
    firstQueryValue(req.query.dateTo) ??
    firstQueryValue(req.query.to) ??
    scope.to;

  const metric = firstQueryValue(req.query.metric) ?? "cost";
  const granularity = firstQueryValue(req.query.granularity) ?? "daily";

  const groupByRaw = firstQueryValue(req.query.groupBy) ?? "none";
  const groupBy = groupByRaw === "load-balancer"
    ? "load_balancer"
    : groupByRaw === "none"
      ? "cost_type"
    : groupByRaw;

  const tagKeyRaw = firstQueryValue(req.query.tagKey);
  const tagKey = tagKeyRaw && tagKeyRaw.trim().length > 0 ? tagKeyRaw.trim() : null;

  const parsed = parseWithSchema(querySchema, {
    startDate,
    endDate,
    metric,
    granularity,
    groupBy,
    tagKey,
    cloudConnectionId: firstQueryValue(req.query.cloudConnectionId) ?? null,
    accountId: firstQueryValue(req.query.accountId) ?? null,
    regions: parseStringArray(req.query.region ?? req.query.regions),
    types: parseStringArray(req.query.type ?? req.query.types),
    schemes: parseStringArray(req.query.scheme ?? req.query.schemes),
    states: parseStringArray(req.query.state ?? req.query.states),
    teams: parseStringArray(req.query.team ?? req.query.teams),
    products: parseStringArray(req.query.product ?? req.query.products),
    environments: parseStringArray(req.query.environment ?? req.query.environments),
    tags: parseTagFilters(req.query.tags),
    groupValues: parseStringArray(req.query.groupValues),
  });

  return {
    scope,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    metric: parsed.metric,
    granularity: parsed.granularity,
    groupBy: parsed.groupBy,
    tagKey: parsed.tagKey,
    groupValues: parsed.groupValues,
    filters: {
      cloudConnectionId: parsed.cloudConnectionId,
      accountId: parsed.accountId,
      regions: parsed.regions,
      types: parsed.types,
      schemes: parsed.schemes,
      states: parsed.states,
      teams: parsed.teams,
      products: parsed.products,
      environments: parsed.environments,
      tags: parsed.tags,
    },
  };
}
