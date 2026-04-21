import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../../../_shared/validation/zod-validate.js";
import type { InventoryEc2InstancesListQuery } from "./instances-inventory.types.js";

const instancesInventoryQuerySchema = z.object({
  cloudConnectionId: z.string().uuid().nullable(),
  subAccountKey: z.string().trim().min(1).max(64).nullable(),
  state: z.string().trim().min(1).max(100).nullable(),
  region: z.string().trim().min(1).max(100).nullable(),
  instanceType: z.string().trim().min(1).max(100).nullable(),
  pricingType: z.enum(["on_demand", "reserved", "savings_plan", "spot"]).nullable(),
  search: z.string().trim().min(1).max(200).nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

const firstQueryValue = (value: unknown): string | undefined => {
  if (typeof value === "undefined") return undefined;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return typeof value === "string" ? value : undefined;
};

const toNullableString = (value: string | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function parseInstancesInventoryListQuery(req: Request): InventoryEc2InstancesListQuery {
  const cloudConnectionId = toNullableString(
    firstQueryValue(req.query.cloudConnectionId) ?? firstQueryValue(req.query.cloud_connection_id),
  );
  const subAccountKey = toNullableString(
    firstQueryValue(req.query.subAccountKey) ?? firstQueryValue(req.query.sub_account_key),
  );
  const state = toNullableString(firstQueryValue(req.query.state));
  const region = toNullableString(firstQueryValue(req.query.region));
  const instanceType = toNullableString(
    firstQueryValue(req.query.instanceType) ?? firstQueryValue(req.query.instance_type),
  );
  const pricingType = toNullableString(
    firstQueryValue(req.query.pricingType) ?? firstQueryValue(req.query.pricing_type),
  );
  const search = toNullableString(firstQueryValue(req.query.search));
  const startDate = toNullableString(
    firstQueryValue(req.query.startDate) ?? firstQueryValue(req.query.start_date),
  );
  const endDate = toNullableString(
    firstQueryValue(req.query.endDate) ?? firstQueryValue(req.query.end_date),
  );
  const page = firstQueryValue(req.query.page) ?? "1";
  const pageSize =
    firstQueryValue(req.query.pageSize) ??
    firstQueryValue(req.query.page_size) ??
    "25";

  return parseWithSchema(instancesInventoryQuerySchema, {
    cloudConnectionId,
    subAccountKey,
    state,
    region,
    instanceType,
    pricingType,
    search,
    startDate,
    endDate,
    page,
    pageSize,
  });
}

