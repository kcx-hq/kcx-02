import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { logger } from "../../../../utils/logger.js";
import { LoadBalancerMetricsIngestionService } from "../../../load-balancer/load-balancer-metrics-ingestion.service.js";

type MetricsSyncWindow = {
  startDate: string;
  endDate: string;
  rebuildRecentDays: number;
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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
  return Math.min(90, n);
};

const toDateOnlyOrNull = (value: unknown): string | null => {
  const normalized = normalizeTrim(typeof value === "string" ? value : null);
  if (!DATE_ONLY_REGEX.test(normalized)) return null;
  return normalized;
};

const computeMetricsSyncWindow = (job: ScheduledJob, now: Date = new Date()): MetricsSyncWindow => {
  const config = (job.configJson ?? null) as Record<string, unknown> | null;
  const configuredStart = toDateOnlyOrNull(config?.start_date);
  const configuredEnd = toDateOnlyOrNull(config?.end_date);

  if (configuredStart && configuredEnd) {
    const orderedStart = configuredStart <= configuredEnd ? configuredStart : configuredEnd;
    const orderedEnd = configuredEnd >= configuredStart ? configuredEnd : configuredStart;
    return { startDate: orderedStart, endDate: orderedEnd, rebuildRecentDays: 0 };
  }

  const rebuildRecentDays = clampRecentDays(config?.rebuild_recent_days) ?? 3;
  const todayUtc = startOfUtcDay(now);
  const yesterdayUtc = new Date(todayUtc.getTime() - 24 * 60 * 60 * 1000);
  const startUtc = new Date(yesterdayUtc.getTime() - (rebuildRecentDays - 1) * 24 * 60 * 60 * 1000);

  return {
    startDate: formatDateUtc(startUtc),
    endDate: formatDateUtc(yesterdayUtc),
    rebuildRecentDays,
  };
};

export async function runLoadBalancerMetricsSyncForScheduledJob(job: ScheduledJob): Promise<void> {
  const tenantId = normalizeTrim(job.tenantId ? String(job.tenantId) : "");
  const cloudConnectionId = normalizeTrim(job.cloudConnectionId ? String(job.cloudConnectionId) : "");
  if (!tenantId) throw new Error("scheduled job missing tenant_id");
  if (!cloudConnectionId) throw new Error("scheduled job missing cloud_connection_id");

  const startedAt = Date.now();
  const window = computeMetricsSyncWindow(job);
  const config = (job.configJson ?? null) as Record<string, unknown> | null;
  const accountId = normalizeTrim(typeof config?.account_id === "string" ? config.account_id : "") || null;
  const region = normalizeTrim(typeof config?.region === "string" ? config.region : "") || null;

  logger.info("Load balancer metrics sync job started", {
    jobId: String(job.id),
    tenantId,
    cloudConnectionId,
    accountId,
    region,
    startDate: window.startDate,
    endDate: window.endDate,
    rebuildRecentDays: window.rebuildRecentDays,
  });

  try {
    const service = new LoadBalancerMetricsIngestionService();
    const rows = await service.syncMetrics({
      tenantId,
      cloudConnectionId,
      startDate: window.startDate,
      endDate: window.endDate,
      accountId,
      region,
    });

    logger.info("Load balancer metrics sync completed", {
      jobId: String(job.id),
      tenantId,
      cloudConnectionId,
      accountId,
      region,
      rowsSynced: rows.length,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.warn("Load balancer metrics sync failed", {
      jobId: String(job.id),
      tenantId,
      cloudConnectionId,
      accountId,
      region,
      startDate: window.startDate,
      endDate: window.endDate,
      durationMs: Date.now() - startedAt,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

