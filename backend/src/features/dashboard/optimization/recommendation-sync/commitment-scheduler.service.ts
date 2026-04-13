import { BillingSource, CloudProvider } from "../../../../models/index.js";
import env from "../../../../config/env.js";
import { logger } from "../../../../utils/logger.js";
import { syncAwsCommitmentRecommendationsWithFreshness } from "./sync.service.js";

let timer: NodeJS.Timeout | null = null;
let startupTimer: NodeJS.Timeout | null = null;
let isRunning = false;

async function runCommitmentSyncSweep(): Promise<void> {
  if (isRunning) {
    logger.info("Commitment scheduler skipped: previous run still in progress");
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
      logger.warn("Commitment scheduler skipped: AWS provider not found");
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
        const result = await syncAwsCommitmentRecommendationsWithFreshness({
          tenantId,
          billingSourceId,
          cloudConnectionId,
          trigger: "SCHEDULED_JOB",
          maxAgeMinutes: env.optimizationCommitmentSyncFreshnessMinutes,
        });

        if (result.skipped || result.insertedCount <= 0) {
          skipped += 1;
          logger.info("Commitment scheduler source run skipped", {
            tenantId,
            billingSourceId,
            cloudConnectionId,
            fetchedCount: result.fetchedCount,
            normalizedCount: result.normalizedCount,
            enrichedCount: result.enrichedCount,
            insertedCount: result.insertedCount,
            reason: result.reason,
          });
        } else {
          succeeded += 1;
          logger.info("Commitment scheduler source run succeeded", {
            tenantId,
            billingSourceId,
            cloudConnectionId,
            fetchedCount: result.fetchedCount,
            normalizedCount: result.normalizedCount,
            enrichedCount: result.enrichedCount,
            insertedCount: result.insertedCount,
          });
        }
      } catch (error) {
        failed += 1;
        logger.warn("Commitment scheduler sync failed for billing source", {
          tenantId,
          billingSourceId,
          cloudConnectionId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("Commitment scheduler sweep completed", {
      totalSources: sources.length,
      attempted,
      succeeded,
      skipped,
      failed,
      durationMs: Date.now() - startedAt,
    });
  } finally {
    isRunning = false;
  }
}

export function startCommitmentRecommendationScheduler(): () => void {
  if (!env.optimizationCommitmentSchedulerEnabled) {
    logger.info("Commitment scheduler disabled via config");
    return () => {};
  }

  startupTimer = setTimeout(() => {
    void runCommitmentSyncSweep();
  }, env.optimizationCommitmentSchedulerStartupDelayMs);

  timer = setInterval(() => {
    void runCommitmentSyncSweep();
  }, env.optimizationCommitmentSyncIntervalMs);

  logger.info("Commitment scheduler started", {
    intervalMs: env.optimizationCommitmentSyncIntervalMs,
    startupDelayMs: env.optimizationCommitmentSchedulerStartupDelayMs,
    freshnessMinutes: env.optimizationCommitmentSyncFreshnessMinutes,
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
    logger.info("Commitment scheduler stopped");
  };
}
