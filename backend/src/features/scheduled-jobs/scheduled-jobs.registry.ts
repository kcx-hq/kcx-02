import type { ScheduledJob } from "../../models/ec2/scheduled_jobs.js";
import { handleEc2DailyRollup } from "./handlers/ec2/ec2-daily-rollup.handler.js";
import { handleEc2HourlyRetentionCleanup } from "./handlers/ec2/ec2-hourly-retention-cleanup.handler.js";
import { handleEc2InventorySync } from "./handlers/ec2/ec2-inventory-sync.handler.js";
import { handleEc2MetricsSync } from "./handlers/ec2/ec2-metrics-sync.handler.js";
import { handleStagingCostLineItemsCleanup } from "./handlers/billing/staging-cost-line-items-cleanup.handler.js";
import { handleCloudInventorySyncPipeline } from "./handlers/inventory/cloud-inventory-sync-pipeline.handler.js";
import { handleLoadBalancerCostAggregation } from "./handlers/load-balancer/load-balancer-cost-aggregation.handler.js";
import { handleLoadBalancerInventorySync } from "./handlers/load-balancer/load-balancer-inventory-sync.handler.js";
import { handleLoadBalancerMetricsSync } from "./handlers/load-balancer/load-balancer-metrics-sync.handler.js";

export type ScheduledJobType =
  | "ec2_inventory_sync"
  | "load_balancer_inventory_sync"
  | "load_balancer_cost_aggregation"
  | "load_balancer_metrics_sync"
  | "ec2_metrics_sync"
  | "ec2_daily_rollup"
  | "ec2_hourly_retention_cleanup"
  | "staging_cost_line_items_cleanup"
  | "cloud_inventory_sync_pipeline";

type ScheduledJobCategory = "inventory_sync" | "metrics_sync" | "rollup" | "cleanup";

type RegisteredScheduledJobDefinition = {
  type: ScheduledJobType;
  service: "ec2" | "load-balancer" | "billing" | "inventory";
  key: string;
  category: ScheduledJobCategory;
  handler: (job: ScheduledJob) => Promise<void>;
};

export const REGISTERED_SCHEDULED_JOBS: ReadonlyArray<RegisteredScheduledJobDefinition> = [
  {
    type: "ec2_inventory_sync",
    service: "ec2",
    key: "ec2-inventory-sync",
    category: "inventory_sync",
    handler: handleEc2InventorySync,
  },
  {
    type: "load_balancer_inventory_sync",
    service: "load-balancer",
    key: "load-balancer-inventory-sync",
    category: "inventory_sync",
    handler: handleLoadBalancerInventorySync,
  },
  {
    type: "cloud_inventory_sync_pipeline",
    service: "inventory",
    key: "cloud-inventory-sync-pipeline",
    category: "inventory_sync",
    handler: handleCloudInventorySyncPipeline,
  },
  {
    type: "load_balancer_cost_aggregation",
    service: "load-balancer",
    key: "load-balancer-cost-aggregation",
    category: "rollup",
    handler: handleLoadBalancerCostAggregation,
  },
  {
    type: "load_balancer_metrics_sync",
    service: "load-balancer",
    key: "load-balancer-metrics-sync",
    category: "metrics_sync",
    handler: handleLoadBalancerMetricsSync,
  },
  {
    type: "ec2_metrics_sync",
    service: "ec2",
    key: "ec2-metrics-sync",
    category: "metrics_sync",
    handler: handleEc2MetricsSync,
  },
  {
    type: "ec2_daily_rollup",
    service: "ec2",
    key: "ec2-daily-rollup",
    category: "rollup",
    handler: handleEc2DailyRollup,
  },
  {
    type: "ec2_hourly_retention_cleanup",
    service: "ec2",
    key: "ec2-hourly-retention-cleanup",
    category: "cleanup",
    handler: handleEc2HourlyRetentionCleanup,
  },
  {
    type: "staging_cost_line_items_cleanup",
    service: "billing",
    key: "staging-cost-line-items-cleanup",
    category: "cleanup",
    handler: handleStagingCostLineItemsCleanup,
  },
];

const REGISTERED_SCHEDULED_JOB_BY_TYPE = new Map(
  REGISTERED_SCHEDULED_JOBS.map((job) => [job.type, job] as const),
);

export const isScheduledJobType = (value: string): value is ScheduledJobType =>
  REGISTERED_SCHEDULED_JOB_BY_TYPE.has(value as ScheduledJobType);

export const toScheduledJobType = (value: string): ScheduledJobType => {
  if (isScheduledJobType(value)) return value;
  throw new Error(`Unsupported scheduled job type: ${value}`);
};

export const getRegisteredScheduledJob = (type: ScheduledJobType): RegisteredScheduledJobDefinition =>
  REGISTERED_SCHEDULED_JOB_BY_TYPE.get(type) as RegisteredScheduledJobDefinition;

export const getInventorySyncScheduledJobTypes = (): ScheduledJobType[] =>
  REGISTERED_SCHEDULED_JOBS.filter((job) => job.category === "inventory_sync").map((job) => job.type);
