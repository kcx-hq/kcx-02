import type { ScheduledJob } from "../../../models/ec2/scheduled_jobs.js";

export type ScheduledJobType = "ec2_inventory_sync" | "ec2_metrics_sync" | "ec2_daily_rollup";

export type ScheduledJobScheduleType = "interval" | "cron";

export type ScheduledJobLastStatus = "queued" | "running" | "completed" | "failed" | "disabled";

export type ComputeNextRunAtReason = "interval" | "cron_stub";

export type ComputeNextRunAtResult = {
  nextRunAt: Date;
  reason: ComputeNextRunAtReason;
};

export const isScheduledJobType = (value: string): value is ScheduledJobType =>
  value === "ec2_inventory_sync" || value === "ec2_metrics_sync" || value === "ec2_daily_rollup";

export const toScheduledJobType = (value: string): ScheduledJobType => {
  if (isScheduledJobType(value)) return value;
  throw new Error(`Unsupported scheduled job type: ${value}`);
};

export type { ScheduledJob };

