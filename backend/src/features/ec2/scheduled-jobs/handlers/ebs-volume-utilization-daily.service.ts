import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { logger } from "../../../../utils/logger.js";
import { EbsVolumeUtilizationDailyRepository } from "./ebs-volume-utilization-daily.repository.js";

type RollupWindow = {
  startDate: string;
  endDate: string;
  rebuildRecentDays: number | null;
};

const normalizeTrim = (value: string | null | undefined): string => String(value ?? "").trim();

const startOfUtcDay = (date: Date): Date => {
  const d = new Date(date.getTime());
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const formatDateUtc = (date: Date): string => date.toISOString().slice(0, 10);

const clampRecentDays = (value: unknown): number | null => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const n = Math.trunc(parsed);
  if (n <= 0) return null;
  return Math.min(30, n);
};

const computeRollupWindow = (job: ScheduledJob, now: Date = new Date()): RollupWindow => {
  const config = (job.configJson ?? null) as Record<string, unknown> | null;
  const rebuildRecentDays = clampRecentDays(config?.rebuild_recent_days);

  const todayUtc = startOfUtcDay(now);
  const yesterdayUtc = new Date(todayUtc.getTime() - 24 * 60 * 60 * 1000);

  if (!rebuildRecentDays) {
    const date = formatDateUtc(yesterdayUtc);
    return { startDate: date, endDate: date, rebuildRecentDays: null };
  }

  const endDate = formatDateUtc(yesterdayUtc);
  const startUtc = new Date(yesterdayUtc.getTime() - (rebuildRecentDays - 1) * 24 * 60 * 60 * 1000);
  const startDate = formatDateUtc(startUtc);

  return { startDate, endDate, rebuildRecentDays };
};

export async function rollupEbsVolumeDaily(job: ScheduledJob): Promise<void> {
  const cloudConnectionId = normalizeTrim(job.cloudConnectionId ? String(job.cloudConnectionId) : "");
  if (!cloudConnectionId) {
    throw new Error("scheduled job missing cloud_connection_id");
  }

  const tenantId = normalizeTrim(job.tenantId ? String(job.tenantId) : "") || null;
  const providerId = normalizeTrim(job.providerId ? String(job.providerId) : "") || null;
  const window = computeRollupWindow(job);
  const startedAt = Date.now();

  logger.info("EBS volume daily rollup started", {
    jobId: String(job.id),
    tenantId,
    cloudConnectionId,
    providerId,
    startDate: window.startDate,
    endDate: window.endDate,
    rebuildRecentDays: window.rebuildRecentDays,
  });

  const repository = new EbsVolumeUtilizationDailyRepository();
  const result = await repository.rollupFromHourly({
    cloudConnectionId,
    tenantId,
    providerId,
    startDate: window.startDate,
    endDate: window.endDate,
  });

  logger.info("EBS volume daily rollup completed", {
    jobId: String(job.id),
    tenantId,
    cloudConnectionId,
    providerId,
    startDate: window.startDate,
    endDate: window.endDate,
    hourlySourceRows: result.hourlySourceRows,
    dailyRowsUpserted: result.dailyRowsUpserted,
    durationMs: Date.now() - startedAt,
  });
}

export async function rollupEbsVolumeDailyForScheduledJob(job: ScheduledJob): Promise<void> {
  await rollupEbsVolumeDaily(job);
}
