import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../../../_shared/validation/zod-validate.js";
import type {
  InventoryEc2VolumeDetailQuery,
  InventoryEc2VolumePerformanceQuery,
  InventoryEc2VolumesListQuery,
} from "./volumes-inventory.types.js";

const volumesInventoryQuerySchema = z.object({
  cloudConnectionId: z.string().uuid().nullable(),
  subAccountKey: z.string().trim().min(1).max(64).nullable(),
  attachedInstanceId: z.string().trim().min(1).max(128).nullable(),
  state: z.string().trim().min(1).max(100).nullable(),
  volumeType: z.string().trim().min(1).max(100).nullable(),
  isAttached: z.boolean().nullable(),
  attachmentState: z.enum(["attached", "unattached", "attached_stopped"]).nullable(),
  optimizationStatus: z.enum(["idle", "underutilized", "optimal", "warning"]).nullable(),
  signal: z.enum(["unattached", "attached_stopped", "idle", "underutilized"]).nullable(),
  region: z.string().trim().min(1).max(100).nullable(),
  search: z.string().trim().min(1).max(200).nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  sortBy: z
    .enum([
      "signal",
      "volumeId",
      "sizeGb",
      "dailyCost",
      "mtdCost",
      "volumeType",
      "availabilityZone",
      "attachedInstanceState",
    ])
    .default("signal"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

const PERFORMANCE_INTERVAL_VALUES = ["daily", "hourly"] as const;
const PERFORMANCE_TOPIC_VALUES = ["ebs"] as const;
const PERFORMANCE_METRIC_VALUES = [
  "volume_read_bytes",
  "volume_write_bytes",
  "volume_read_ops",
  "volume_write_ops",
  "queue_length",
  "burst_balance",
  "volume_idle_time",
] as const;

const performanceMetricsSchema = z
  .array(z.enum(PERFORMANCE_METRIC_VALUES))
  .min(1);

const volumePerformanceQuerySchema = z.object({
  volumeId: z.string().trim().min(1).max(200),
  cloudConnectionId: z.string().uuid().nullable(),
  interval: z.enum(PERFORMANCE_INTERVAL_VALUES).default("daily"),
  topic: z.enum(PERFORMANCE_TOPIC_VALUES).default("ebs"),
  metrics: performanceMetricsSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

const volumeDetailQuerySchema = z.object({
  volumeId: z.string().trim().min(1).max(200),
  cloudConnectionId: z.string().uuid().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
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

export function parseVolumesInventoryListQuery(req: Request): InventoryEc2VolumesListQuery {
  const cloudConnectionId = toNullableString(
    firstQueryValue(req.query.cloudConnectionId) ?? firstQueryValue(req.query.cloud_connection_id),
  );
  const subAccountKey = toNullableString(
    firstQueryValue(req.query.subAccountKey) ?? firstQueryValue(req.query.sub_account_key),
  );
  const attachedInstanceId = toNullableString(
    firstQueryValue(req.query.attachedInstanceId) ?? firstQueryValue(req.query.attached_instance_id),
  );
  const state = toNullableString(firstQueryValue(req.query.state));
  const volumeType = toNullableString(
    firstQueryValue(req.query.volumeType) ?? firstQueryValue(req.query.volume_type),
  );
  const isAttached = toNullableBoolean(
    firstQueryValue(req.query.isAttached) ?? firstQueryValue(req.query.is_attached),
  );
  const attachmentState = toNullableString(
    firstQueryValue(req.query.attachmentState) ?? firstQueryValue(req.query.attachment_state),
  );
  const optimizationStatus = toNullableString(
    firstQueryValue(req.query.optimizationStatus) ?? firstQueryValue(req.query.optimization_status),
  );
  const signal = toNullableString(firstQueryValue(req.query.signal));
  const region = toNullableString(firstQueryValue(req.query.region));
  const search = toNullableString(firstQueryValue(req.query.search));
  const startDate = toNullableString(
    firstQueryValue(req.query.startDate) ?? firstQueryValue(req.query.start_date),
  );
  const endDate = toNullableString(
    firstQueryValue(req.query.endDate) ?? firstQueryValue(req.query.end_date),
  );
  const sortBy =
    toNullableString(firstQueryValue(req.query.sortBy) ?? firstQueryValue(req.query.sort_by)) ??
    "signal";
  const sortDirection =
    toNullableString(firstQueryValue(req.query.sortDirection) ?? firstQueryValue(req.query.sort_direction)) ??
    "desc";
  const page = firstQueryValue(req.query.page) ?? "1";
  const pageSize =
    firstQueryValue(req.query.pageSize) ??
    firstQueryValue(req.query.page_size) ??
    "25";

  return parseWithSchema(volumesInventoryQuerySchema, {
    cloudConnectionId,
    subAccountKey,
    attachedInstanceId,
    state,
    volumeType,
    isAttached,
    attachmentState,
    optimizationStatus,
    signal,
    region,
    search,
    startDate,
    endDate,
    sortBy,
    sortDirection,
    page,
    pageSize,
  });
}

export function parseVolumesInventoryPerformanceQuery(
  req: Request,
): InventoryEc2VolumePerformanceQuery {
  const volumeId = toNullableString(
    firstQueryValue(req.query.volumeId) ?? firstQueryValue(req.query.volume_id),
  );
  const cloudConnectionId = toNullableString(
    firstQueryValue(req.query.cloudConnectionId) ?? firstQueryValue(req.query.cloud_connection_id),
  );
  const interval = toNullableString(firstQueryValue(req.query.interval)) ?? "daily";
  const topic = toNullableString(firstQueryValue(req.query.topic)) ?? "ebs";
  const metricsRaw = toNullableString(firstQueryValue(req.query.metrics)) ?? "volume_read_bytes";
  const metrics = metricsRaw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const startDate = toNullableString(
    firstQueryValue(req.query.startDate) ?? firstQueryValue(req.query.start_date),
  );
  const endDate = toNullableString(
    firstQueryValue(req.query.endDate) ?? firstQueryValue(req.query.end_date),
  );

  return parseWithSchema(volumePerformanceQuerySchema, {
    volumeId,
    cloudConnectionId,
    interval,
    topic,
    metrics,
    startDate,
    endDate,
  });
}

export function parseVolumesInventoryDetailQuery(
  req: Request,
): InventoryEc2VolumeDetailQuery {
  const volumeIdRaw = req.params.volumeId;
  const volumeId = toNullableString(Array.isArray(volumeIdRaw) ? volumeIdRaw[0] : volumeIdRaw);
  const cloudConnectionId = toNullableString(
    firstQueryValue(req.query.cloudConnectionId) ?? firstQueryValue(req.query.cloud_connection_id),
  );
  const startDate = toNullableString(
    firstQueryValue(req.query.startDate) ?? firstQueryValue(req.query.start_date),
  );
  const endDate = toNullableString(
    firstQueryValue(req.query.endDate) ?? firstQueryValue(req.query.end_date),
  );

  return parseWithSchema(volumeDetailQuerySchema, {
    volumeId,
    cloudConnectionId,
    startDate,
    endDate,
  });
}

