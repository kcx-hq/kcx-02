import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../../../_shared/validation/zod-validate.js";
import type { InventoryEc2SnapshotsListQuery } from "./snapshots-inventory.types.js";

const snapshotsInventoryQuerySchema = z.object({
  cloudConnectionId: z.string().uuid().nullable(),
  regionKey: z.string().trim().regex(/^\d+$/).max(30).nullable(),
  state: z.string().trim().min(1).max(100).nullable(),
  storageTier: z.string().trim().min(1).max(100).nullable(),
  encrypted: z.boolean().nullable(),
  search: z.string().trim().min(1).max(200).nullable(),
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

const toNullableBoolean = (value: string | undefined): boolean | null | string => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return normalized;
};

export function parseSnapshotsInventoryListQuery(req: Request): InventoryEc2SnapshotsListQuery {
  const cloudConnectionId = toNullableString(
    firstQueryValue(req.query.cloudConnectionId) ?? firstQueryValue(req.query.cloud_connection_id),
  );
  const regionKey = toNullableString(
    firstQueryValue(req.query.regionKey) ?? firstQueryValue(req.query.region_key),
  );
  const state = toNullableString(firstQueryValue(req.query.state));
  const storageTier = toNullableString(
    firstQueryValue(req.query.storageTier) ?? firstQueryValue(req.query.storage_tier),
  );
  const encrypted = toNullableBoolean(firstQueryValue(req.query.encrypted));
  const search = toNullableString(firstQueryValue(req.query.search));
  const page = firstQueryValue(req.query.page) ?? "1";
  const pageSize =
    firstQueryValue(req.query.pageSize) ??
    firstQueryValue(req.query.page_size) ??
    "25";

  return parseWithSchema(snapshotsInventoryQuerySchema, {
    cloudConnectionId,
    regionKey,
    state,
    storageTier,
    encrypted,
    search,
    page,
    pageSize,
  });
}
