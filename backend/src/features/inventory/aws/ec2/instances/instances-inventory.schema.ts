import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../../../_shared/validation/zod-validate.js";
import type {
  InventoryEc2InstanceDetailQuery,
  InventoryEc2InstancePerformanceQuery,
  InventoryEc2InstancesListQuery,
} from "./instances-inventory.types.js";

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

const PERFORMANCE_INTERVAL_VALUES = ["daily", "hourly"] as const;
const PERFORMANCE_TOPIC_VALUES = [
  "cpu",
  "network",
  "disk_throughput",
  "disk_operations",
  "ebs",
  "health",
] as const;
const PERFORMANCE_METRIC_VALUES = [
  "cpu_avg",
  "cpu_max",
  "cpu_min",
  "network_in_bytes",
  "network_out_bytes",
  "disk_read_bytes",
  "disk_write_bytes",
  "disk_read_ops",
  "disk_write_ops",
  "ebs_read_bytes",
  "ebs_write_bytes",
  "ebs_queue_length_max",
  "ebs_burst_balance_avg",
  "ebs_idle_time_avg",
  "status_check_failed_max",
  "status_check_failed_instance_max",
  "status_check_failed_system_max",
] as const;

const DEFAULT_METRIC_BY_TOPIC: Record<(typeof PERFORMANCE_TOPIC_VALUES)[number], string> = {
  cpu: "cpu_avg",
  network: "network_in_bytes",
  disk_throughput: "disk_read_bytes",
  disk_operations: "disk_read_ops",
  ebs: "ebs_read_bytes",
  health: "status_check_failed_max",
};

const performanceMetricsSchema = z
  .array(z.enum(PERFORMANCE_METRIC_VALUES))
  .min(1)
  .max(6);

const instancePerformanceQuerySchema = z.object({
  instanceId: z.string().trim().min(1).max(200),
  cloudConnectionId: z.string().uuid().nullable(),
  interval: z.enum(PERFORMANCE_INTERVAL_VALUES).default("daily"),
  topic: z.enum(PERFORMANCE_TOPIC_VALUES).default("cpu"),
  metrics: performanceMetricsSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

const instanceDetailQuerySchema = z.object({
  instanceId: z.string().trim().min(1).max(200),
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

export function parseInstancesInventoryPerformanceQuery(
  req: Request,
): InventoryEc2InstancePerformanceQuery {
  const instanceId = toNullableString(
    firstQueryValue(req.query.instanceId) ?? firstQueryValue(req.query.instance_id),
  );
  const cloudConnectionId = toNullableString(
    firstQueryValue(req.query.cloudConnectionId) ?? firstQueryValue(req.query.cloud_connection_id),
  );
  const interval = toNullableString(firstQueryValue(req.query.interval)) ?? "daily";
  const topic = toNullableString(firstQueryValue(req.query.topic)) ?? "cpu";
  const normalizedTopic = PERFORMANCE_TOPIC_VALUES.includes(topic as (typeof PERFORMANCE_TOPIC_VALUES)[number])
    ? (topic as (typeof PERFORMANCE_TOPIC_VALUES)[number])
    : "cpu";
  const metricsRaw =
    toNullableString(firstQueryValue(req.query.metrics)) ??
    DEFAULT_METRIC_BY_TOPIC[normalizedTopic];
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

  return parseWithSchema(instancePerformanceQuerySchema, {
    instanceId,
    cloudConnectionId,
    interval,
    topic,
    metrics,
    startDate,
    endDate,
  });
}

export function parseInstancesInventoryDetailQuery(
  req: Request,
): InventoryEc2InstanceDetailQuery {
  const instanceIdRaw = req.params.instanceId;
  const instanceId = toNullableString(Array.isArray(instanceIdRaw) ? instanceIdRaw[0] : instanceIdRaw);
  const cloudConnectionId = toNullableString(
    firstQueryValue(req.query.cloudConnectionId) ?? firstQueryValue(req.query.cloud_connection_id),
  );
  const startDate = toNullableString(
    firstQueryValue(req.query.startDate) ?? firstQueryValue(req.query.start_date),
  );
  const endDate = toNullableString(
    firstQueryValue(req.query.endDate) ?? firstQueryValue(req.query.end_date),
  );

  return parseWithSchema(instanceDetailQuerySchema, {
    instanceId,
    cloudConnectionId,
    startDate,
    endDate,
  });
}

