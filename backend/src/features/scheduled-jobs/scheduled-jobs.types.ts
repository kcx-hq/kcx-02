import type { ScheduledJob } from "../../models/ec2/scheduled_jobs.js";
import {
  isScheduledJobType,
  toScheduledJobType,
  type ScheduledJobType,
} from "./scheduled-jobs.registry.js";

export type { ScheduledJobType };

export type ScheduledJobScheduleType = "interval" | "cron";

export type ScheduledJobLastStatus = "queued" | "running" | "completed" | "failed" | "disabled";

export type ComputeNextRunAtReason = "interval" | "cron_stub";

export type ComputeNextRunAtResult = {
  nextRunAt: Date;
  reason: ComputeNextRunAtReason;
};

export { isScheduledJobType, toScheduledJobType };

export type { ScheduledJob };
