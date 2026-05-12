/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import env from "../../../config/env.js";
import { BillingSource, CloudProvider } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { collectS3BucketConfigSnapshotsForBillingSource } from "./s3-bucket-config-snapshot.service.js";
import { refreshS3BucketCostSummaryForBillingSource } from "./s3-bucket-cost-summary.service.js";
import { syncS3CostDaily } from "./s3-cost-daily.service.js";

let timer: NodeJS.Timeout | null = null;
let startupTimer: NodeJS.Timeout | null = null;
let isRunning = false;

async function runS3BucketConfigSnapshotSweep(): Promise<void> {
  if (isRunning) {
    logger.info("S3 bucket config scheduler skipped: previous run still in progress");
    return;
  }

  isRunning = true;
  const startedAt = Date.now();
  try {
    const awsProvider = await CloudProvider.findOne({
      where: {
        code: "aws",
      },
    });
    if (!awsProvider) {
      logger.warn("S3 bucket config scheduler skipped: AWS provider not found");
      return;
    }

    const sources = await BillingSource.findAll({
      where: {
        cloudProviderId: String(awsProvider.id),
        status: "active",
      },
      order: [["updatedAt", "DESC"]],
    });

    let attempted = 0;
    let succeeded = 0;
    let skipped = 0;
    let failed = 0;
    let totalSnapshots = 0;
    let totalCostSummaryRows = 0;
    let totalS3CostDailyRows = 0;

    for (const source of sources) {
      const tenantId = String(source.tenantId ?? "").trim();
      const billingSourceId = String(source.id ?? "").trim();
      const cloudConnectionId = String(source.cloudConnectionId ?? "").trim();

      if (!tenantId || !billingSourceId || !cloudConnectionId) {
        skipped += 1;
        continue;
      }

      attempted += 1;
      try {
        const result = await collectS3BucketConfigSnapshotsForBillingSource({
          tenantId,
          billingSourceId,
        });
        const costSummary = await refreshS3BucketCostSummaryForBillingSource({
          tenantId,
          billingSourceId,
        });
        const today = new Date();
        const endDate = today.toISOString().slice(0, 10);
        const startDateObj = new Date(today);
        startDateObj.setUTCDate(startDateObj.getUTCDate() - 45);
        const startDate = startDateObj.toISOString().slice(0, 10);
        const s3CostDaily = await syncS3CostDaily({
          tenantId,
          startDate,
          endDate,
          cloudConnectionId,
          billingSourceId,
          providerId: source.cloudProviderId,
          rebuildRange: true,
        });
        totalSnapshots += Number(result.snapshotsCreated ?? 0);
        totalCostSummaryRows += Number(costSummary.rowsInserted ?? 0);
        totalS3CostDailyRows += Number(s3CostDaily.rowsInserted ?? 0);
        succeeded += 1;
        logger.info("S3 bucket config scheduler source run succeeded", {
          tenantId,
          billingSourceId,
          cloudConnectionId,
          bucketsScanned: result.bucketsScanned,
          snapshotsCreated: result.snapshotsCreated,
          costSummaryRowsInserted: costSummary.rowsInserted,
          s3CostDailyRowsInserted: s3CostDaily.rowsInserted,
        });
      } catch (error) {
        failed += 1;
        logger.warn("S3 bucket config scheduler source run failed", {
          tenantId,
          billingSourceId,
          cloudConnectionId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("S3 bucket config scheduler sweep completed", {
      totalSources: sources.length,
      attempted,
      succeeded,
      skipped,
      failed,
      totalSnapshots,
      totalCostSummaryRows,
      totalS3CostDailyRows,
      durationMs: Date.now() - startedAt,
    });
  } finally {
    isRunning = false;
  }
}

export function startS3BucketConfigSnapshotScheduler(): () => void {
  if (!env.s3BucketConfigSchedulerEnabled) {
    logger.info("S3 bucket config scheduler disabled via config");
    return () => {};
  }

  startupTimer = setTimeout(() => {
    void runS3BucketConfigSnapshotSweep();
  }, env.s3BucketConfigSchedulerStartupDelayMs);

  timer = setInterval(() => {
    void runS3BucketConfigSnapshotSweep();
  }, env.s3BucketConfigSchedulerIntervalMs);

  logger.info("S3 bucket config scheduler started", {
    intervalMs: env.s3BucketConfigSchedulerIntervalMs,
    startupDelayMs: env.s3BucketConfigSchedulerStartupDelayMs,
  });

  return () => {
    if (startupTimer) {
      clearTimeout(startupTimer);
      startupTimer = null;
    }
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    logger.info("S3 bucket config scheduler stopped");
  };
}
