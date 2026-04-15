import type { ScheduledJob } from "../../../models/ec2/scheduled_jobs.js";
import type { ComputeNextRunAtResult } from "./scheduled-jobs.types.js";

const addMinutes = (base: Date, minutes: number): Date => new Date(base.getTime() + minutes * 60_000);

export function computeNextRunAt(job: ScheduledJob, baseTime: Date = new Date()): ComputeNextRunAtResult {
  const scheduleType = String(job.scheduleType ?? "interval");

  if (scheduleType === "interval") {
    const intervalMinutes = typeof job.intervalMinutes === "number" ? job.intervalMinutes : Number(job.intervalMinutes);
    if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
      throw new Error(`Invalid interval_minutes for scheduled job ${String(job.id)}: ${String(job.intervalMinutes)}`);
    }

    return {
      nextRunAt: addMinutes(baseTime, intervalMinutes),
      reason: "interval",
    };
  }

  if (scheduleType === "cron") {
    // TODO: Add cron parsing (e.g. via cron-parser) and compute the next schedule based on cron_expression.
    // For now, we move the next run forward to avoid hot-looping on an always-due cron job.
    const fallbackMinutes = 60;
    return {
      nextRunAt: addMinutes(baseTime, fallbackMinutes),
      reason: "cron_stub",
    };
  }

  throw new Error(`Unsupported schedule_type for scheduled job ${String(job.id)}: ${scheduleType}`);
}

