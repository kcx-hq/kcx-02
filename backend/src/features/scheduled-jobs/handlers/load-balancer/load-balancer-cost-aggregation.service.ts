import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { logger } from "../../../../utils/logger.js";
import { syncLoadBalancerCostDaily } from "../../../load-balancer/cost/load-balancer-cost-daily.service.js";

type AggregationWindow = {
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

const computeAggregationWindow = (job: ScheduledJob, now: Date = new Date()): AggregationWindow => {
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

export async function runLoadBalancerCostAggregationForScheduledJob(job: ScheduledJob): Promise<void> {
  const jobId = String(job.id);
  const cloudConnectionId = normalizeTrim(job.cloudConnectionId ? String(job.cloudConnectionId) : "");
  if (!cloudConnectionId) {
    throw new Error("scheduled job missing cloud_connection_id");
  }

  const startedAt = Date.now();
  const window = computeAggregationWindow(job);
  const config = (job.configJson ?? null) as Record<string, unknown> | null;
  const accountId = normalizeTrim(typeof config?.account_id === "string" ? config.account_id : "") || null;
  const region = normalizeTrim(typeof config?.region === "string" ? config.region : "") || null;

  logger.info("Load balancer cost aggregation scheduled run started", {
    jobId,
    cloudConnectionId,
    accountId,
    region,
    startDate: window.startDate,
    endDate: window.endDate,
    rebuildRecentDays: window.rebuildRecentDays,
  });

  try {
    const result = await syncLoadBalancerCostDaily({
      startDate: window.startDate,
      endDate: window.endDate,
      cloudConnectionId,
      accountId,
      region,
      rebuildRange: true,
      triggerSource: "scheduler",
    });

    logger.info("Load balancer cost aggregation scheduled run completed", {
      jobId,
      cloudConnectionId,
      accountId,
      region,
      startDate: window.startDate,
      endDate: window.endDate,
      rowsScanned: result.rowsScanned,
      lbRowsMatched: Math.max(result.rowsClassified - result.rowsUnmatched, 0),
      unmatchedRows: result.rowsUnmatched,
      dailyRowsWritten: result.rowsUpserted,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.warn("Load balancer cost aggregation scheduled run failed", {
      jobId,
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
