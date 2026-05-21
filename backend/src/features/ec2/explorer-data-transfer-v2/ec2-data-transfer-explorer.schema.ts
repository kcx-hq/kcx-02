import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import type { DashboardScope } from "../../dashboard/dashboard.types.js";
import type { Ec2TransferType } from "../classification/types.js";
import {
  EC2_DATA_TRANSFER_EXPLORER_COMPARE,
  EC2_DATA_TRANSFER_EXPLORER_GRANULARITIES,
  EC2_DATA_TRANSFER_EXPLORER_GROUP_BY,
  EC2_DATA_TRANSFER_EXPLORER_Y_AXIS,
  type Ec2DataTransferExplorerInput,
  type Ec2DataTransferExplorerTagFilter,
} from "./ec2-data-transfer-explorer.types.js";

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

const parseTagFilters = (value: unknown): Ec2DataTransferExplorerTagFilter[] =>
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
    .filter((item): item is Ec2DataTransferExplorerTagFilter => Boolean(item));

const toTransferTypeArray = (value: unknown): Ec2TransferType[] => {
  const valid = new Set<Ec2TransferType>(["internet", "inter_region", "inter_az", "regional", "unknown"]);
  return parseStringArray(value)
    .map((item) => item.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_"))
    .filter((item): item is Ec2TransferType => valid.has(item as Ec2TransferType));
};

const querySchema = z.object({
  startDate: z.string().regex(DATE_ONLY_REGEX),
  endDate: z.string().regex(DATE_ONLY_REGEX),
  granularity: z.enum(EC2_DATA_TRANSFER_EXPLORER_GRANULARITIES),
  yAxis: z.enum(EC2_DATA_TRANSFER_EXPLORER_Y_AXIS),
  groupBy: z.enum(EC2_DATA_TRANSFER_EXPLORER_GROUP_BY),
  tagKey: z.string().trim().min(1).nullable(),
  compare: z.enum(EC2_DATA_TRANSFER_EXPLORER_COMPARE),
  accountIds: z.array(z.string().trim().min(1)),
  regions: z.array(z.string().trim().min(1)),
  instanceTypes: z.array(z.string().trim().min(1)),
  transferTypes: z.array(z.enum(["internet", "inter_region", "inter_az", "regional", "unknown"])),
  tags: z.array(z.object({ key: z.string().trim().min(1), value: z.string().trim().min(1) })),
}).superRefine((value, ctx) => {
  if (value.startDate > value.endDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate"], message: "startDate must be <= endDate" });
  }
  if (value.groupBy === "tag" && !value.tagKey) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tagKey"], message: "tagKey is required when groupBy=tag" });
  }
});

export function buildEc2DataTransferExplorerInput(req: Request, scope: DashboardScope): Ec2DataTransferExplorerInput {
  const payload = { ...(req.method === "POST" ? (req.body as Record<string, unknown> | undefined) : undefined), ...req.query };
  const parsed = parseWithSchema(querySchema, {
    startDate: firstValue(payload.startDate) ?? firstValue(payload.from) ?? scope.from,
    endDate: firstValue(payload.endDate) ?? firstValue(payload.to) ?? scope.to,
    granularity: firstValue(payload.granularity) ?? "daily",
    yAxis: firstValue(payload.yAxis) ?? "transfer_cost",
    groupBy: firstValue(payload.groupBy) ?? "none",
    tagKey: firstValue(payload.tagKey)?.trim() || null,
    compare: firstValue(payload.compare) ?? "none",
    accountIds: parseStringArray(payload.accountIds),
    regions: parseStringArray(payload.regions),
    instanceTypes: parseStringArray(payload.instanceTypes),
    transferTypes: toTransferTypeArray(payload.transferTypes),
    tags: parseTagFilters(payload.tags),
  });

  return {
    scope,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    granularity: parsed.granularity,
    yAxis: parsed.yAxis,
    groupBy: parsed.groupBy,
    tagKey: parsed.tagKey,
    compare: parsed.compare,
    filters: {
      accountIds: parsed.accountIds,
      regions: parsed.regions,
      instanceTypes: parsed.instanceTypes,
      transferTypes: parsed.transferTypes,
      tags: parsed.tags,
    },
  };
}

