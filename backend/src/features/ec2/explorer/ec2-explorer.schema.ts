import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import type { DashboardScope } from "../../dashboard/dashboard.types.js";
import {
  EC2_COST_BASIS,
  EC2_EXPLORER_GROUP_BY,
  EC2_EXPLORER_METRICS,
  EC2_INSTANCE_CONDITIONS,
  EC2_USAGE_AGGREGATIONS,
  EC2_USAGE_TYPES,
  type Ec2ExplorerInput,
  type Ec2ExplorerTagFilter,
} from "./ec2-explorer.types.js";

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

const parseTagFilters = (value: unknown): Ec2ExplorerTagFilter[] => {
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
    .filter((entry): entry is Ec2ExplorerTagFilter => Boolean(entry));
};

const parseOptionalNumber = (value: unknown): number | null => {
  const raw = firstQueryValue(value);
  if (!raw || raw.trim().length === 0) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const querySchema = z
  .object({
    startDate: z.string().regex(DATE_ONLY_REGEX),
    endDate: z.string().regex(DATE_ONLY_REGEX),
    metric: z.enum(EC2_EXPLORER_METRICS),
    groupBy: z.enum(EC2_EXPLORER_GROUP_BY),
    tagKey: z.string().trim().min(1).max(200).nullable(),
    regions: z.array(z.string().trim().min(1)).max(200),
    tags: z.array(z.object({ key: z.string().trim().min(1), value: z.string().trim().min(1) })).max(200),
    costBasis: z.enum(EC2_COST_BASIS),
    usageType: z.enum(EC2_USAGE_TYPES),
    aggregation: z.enum(EC2_USAGE_AGGREGATIONS),
    condition: z.enum(EC2_INSTANCE_CONDITIONS),
    groupValues: z.array(z.string().trim().min(1)).max(200),
    minCost: z.number().nullable(),
    maxCost: z.number().nullable(),
    minCpu: z.number().nullable(),
    maxCpu: z.number().nullable(),
    minNetwork: z.number().nullable(),
    maxNetwork: z.number().nullable(),
    states: z.array(z.string().trim().min(1)).max(200),
    instanceTypes: z.array(z.string().trim().min(1)).max(200),
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
    if (value.metric === "usage") {
      const allowedForCpu = new Set(["team", "product", "environment", "region", "account", "instance_type", "tag"]);
      const allowedForNetwork = new Set(["network_type", "region", "account", "instance_type", "tag"]);
      const allowed = value.usageType === "network" ? allowedForNetwork : allowedForCpu;
      if (!allowed.has(value.groupBy)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["groupBy"],
          message: `groupBy=${value.groupBy} is not allowed for usageType=${value.usageType}`,
        });
      }
    }
  });

export function buildEc2ExplorerInput(req: Request, scope: DashboardScope): Ec2ExplorerInput {
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
  const groupByRaw = firstQueryValue(req.query.groupBy) ?? "none";
  const groupBy = groupByRaw === "instance-type"
    ? "instance_type"
    : groupByRaw === "reservation-type"
      ? "reservation_type"
      : groupByRaw === "network-cost"
        ? "network_cost"
        : groupByRaw === "network-type"
          ? "network_type"
      : groupByRaw;
  const tagKeyRaw = firstQueryValue(req.query.tagKey);
  const tagKey = tagKeyRaw && tagKeyRaw.trim().length > 0 ? tagKeyRaw.trim() : null;
  const costBasis = firstQueryValue(req.query.costBasis) ?? "effective_cost";
  const usageTypeRaw =
    firstQueryValue(req.query.usageMetric) ??
    firstQueryValue(req.query.usageType) ??
    "cpu";
  const usageType =
    usageTypeRaw === "network-in-out" ||
    usageTypeRaw === "network_in" ||
    usageTypeRaw === "network_out"
      ? "network"
      : usageTypeRaw === "disk-read-write" ||
        usageTypeRaw === "disk_read" ||
        usageTypeRaw === "disk_write"
        ? "disk"
        : usageTypeRaw;
  const aggregationRaw = firstQueryValue(req.query.aggregation) ?? firstQueryValue(req.query.usageAggregation) ?? "avg";
  const aggregation = aggregationRaw === "average" ? "avg" : aggregationRaw;
  const condition = firstQueryValue(req.query.condition) ?? firstQueryValue(req.query.instancesCondition) ?? "all";

  const parsed = parseWithSchema(querySchema, {
    startDate,
    endDate,
    metric,
    groupBy,
    tagKey,
    regions: parseStringArray(req.query.regions),
    tags: parseTagFilters(req.query.tags),
    costBasis,
    usageType,
    aggregation,
    condition,
    groupValues: parseStringArray(req.query.groupValues),
    minCost: parseOptionalNumber(req.query.minCost),
    maxCost: parseOptionalNumber(req.query.maxCost),
    minCpu: parseOptionalNumber(req.query.minCpu),
    maxCpu: parseOptionalNumber(req.query.maxCpu),
    minNetwork: parseOptionalNumber(req.query.minNetwork),
    maxNetwork: parseOptionalNumber(req.query.maxNetwork),
    states: parseStringArray(req.query.states),
    instanceTypes: parseStringArray(req.query.instanceTypes),
  });

  return {
    scope,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    metric: parsed.metric,
    groupBy: parsed.groupBy,
    tagKey: parsed.tagKey,
    filters: {
      regions: parsed.regions,
      tags: parsed.tags,
    },
    costBasis: parsed.costBasis,
    usageType: parsed.usageType,
    aggregation: parsed.aggregation,
    condition: parsed.condition,
    groupValues: parsed.groupValues,
    minCost: parsed.minCost,
    maxCost: parsed.maxCost,
    minCpu: parsed.minCpu,
    maxCpu: parsed.maxCpu,
    minNetwork: parsed.minNetwork,
    maxNetwork: parsed.maxNetwork,
    states: parsed.states,
    instanceTypes: parsed.instanceTypes,
  };
}
