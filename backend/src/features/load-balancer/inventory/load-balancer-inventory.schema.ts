import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import type { InventoryLoadBalancersListQuery } from "./load-balancer-inventory.types.js";

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  search: z.string().trim().min(1).max(200).nullable(),
  account: z.string().trim().min(1).max(50).nullable(),
  region: z.string().trim().min(1).max(100).nullable(),
  type: z.string().trim().min(1).max(100).nullable(),
  scheme: z.string().trim().min(1).max(100).nullable(),
  state: z.string().trim().min(1).max(100).nullable(),
  team: z.string().trim().min(1).max(100).nullable(),
  product: z.string().trim().min(1).max(100).nullable(),
  environment: z.string().trim().min(1).max(100).nullable(),
  tags: z.array(z.object({ key: z.string().trim().min(1), value: z.string().trim().min(1) })).max(100),
  sortBy: z
    .enum(["name", "type", "scheme", "region", "totalCost", "fixedCost", "lcuCost", "dataProcessingCost"])
    .default("name"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

const firstQueryValue = (value: unknown): string | undefined => {
  if (typeof value === "undefined") return undefined;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
};

const toNullableString = (value: string | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseTagFilters = (value: unknown): Array<{ key: string; value: string }> => {
  const raw = firstQueryValue(value);
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf(":");
      if (separatorIndex <= 0 || separatorIndex >= entry.length - 1) return null;
      const key = entry.slice(0, separatorIndex).trim();
      const val = entry.slice(separatorIndex + 1).trim();
      if (!key || !val) return null;
      return { key, value: val };
    })
    .filter((entry): entry is { key: string; value: string } => Boolean(entry));
};

export function parseLoadBalancerInventoryListQuery(req: Request): InventoryLoadBalancersListQuery {
  return parseWithSchema(querySchema, {
    startDate: toNullableString(firstQueryValue(req.query.startDate) ?? firstQueryValue(req.query.start_date)),
    endDate: toNullableString(firstQueryValue(req.query.endDate) ?? firstQueryValue(req.query.end_date)),
    search: toNullableString(firstQueryValue(req.query.search)),
    account: toNullableString(firstQueryValue(req.query.account)),
    region: toNullableString(firstQueryValue(req.query.region)),
    type: toNullableString(firstQueryValue(req.query.type)),
    scheme: toNullableString(firstQueryValue(req.query.scheme)),
    state: toNullableString(firstQueryValue(req.query.state)),
    team: toNullableString(firstQueryValue(req.query.team)),
    product: toNullableString(firstQueryValue(req.query.product)),
    environment: toNullableString(firstQueryValue(req.query.environment)),
    tags: parseTagFilters(req.query.tags),
    sortBy: toNullableString(firstQueryValue(req.query.sortBy) ?? firstQueryValue(req.query.sort_by)) ?? "name",
    sortDirection: toNullableString(firstQueryValue(req.query.sortDirection) ?? firstQueryValue(req.query.sort_direction)) ?? "asc",
    page: firstQueryValue(req.query.page) ?? "1",
    pageSize: firstQueryValue(req.query.pageSize) ?? firstQueryValue(req.query.page_size) ?? "25",
  });
}
