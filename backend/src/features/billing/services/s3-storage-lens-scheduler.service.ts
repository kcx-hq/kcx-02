/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import env from "../../../config/env.js";
import { BillingSource, CloudProvider } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { syncStorageLensFromClientAccount } from "./s3-storage-lens-sync.service.js";

let timer: NodeJS.Timeout | null = null;
let startupTimer: NodeJS.Timeout | null = null;
let isRunning = false;

const normalize = (value: unknown): string => String(value ?? "").trim();

async function runStorageLensSyncSweep(): Promise<void> {
  if (isRunning) {
    logger.info("Storage Lens scheduler skipped: previous run still in progress");
    return;
  }

  isRunning = true;
  const startedAt = Date.now();

  try {
    const awsProvider = await CloudProvider.findOne({
      where: { code: "aws" },
    });
    if (!awsProvider) {
      logger.warn("Storage Lens scheduler skipped: AWS provider not found");
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
    let totalRowsScanned = 0;
    let totalSnapshotsUpserted = 0;

    for (const source of sources) {
      const tenantId = normalize(source.tenantId);
      const billingSourceId = normalize(source.id);
      const cloudConnectionId = normalize(source.cloudConnectionId);
      if (!tenantId || !billingSourceId || !cloudConnectionId) {
        skipped += 1;
        continue;
      }

      attempted += 1;
      try {
        const result = await syncStorageLensFromClientAccount({
          tenantId,
          billingSourceId,
          prefix: env.storageLensDefaultExportPrefix,
          maxFiles: env.storageLensSchedulerMaxFilesPerRun,
        });
        succeeded += 1;
        totalRowsScanned += Number(result.rowsScanned ?? 0);
        totalSnapshotsUpserted += Number(result.snapshotsUpserted ?? 0);
        logger.info("Storage Lens scheduler source run succeeded", {
          tenantId,
          billingSourceId,
          cloudConnectionId,
          ingestionRunId: result.ingestionRunId ?? null,
          rowsScanned: result.rowsScanned ?? 0,
          snapshotsUpserted: result.snapshotsUpserted ?? 0,
          objectsProcessed: result.objectsProcessed ?? 0,
        });
      } catch (error) {
        failed += 1;
        logger.warn("Storage Lens scheduler source run failed", {
          tenantId,
          billingSourceId,
          cloudConnectionId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("Storage Lens scheduler sweep completed", {
      totalSources: sources.length,
      attempted,
      succeeded,
      skipped,
      failed,
      totalRowsScanned,
      totalSnapshotsUpserted,
      durationMs: Date.now() - startedAt,
    });
  } finally {
    isRunning = false;
  }
}

export function startStorageLensScheduler(): () => void {
  if (!env.storageLensSchedulerEnabled) {
    logger.info("Storage Lens scheduler disabled via config");
    return () => {};
  }

  startupTimer = setTimeout(() => {
    void runStorageLensSyncSweep();
  }, env.storageLensSchedulerStartupDelayMs);

  timer = setInterval(() => {
    void runStorageLensSyncSweep();
  }, env.storageLensSchedulerIntervalMs);

  logger.info("Storage Lens scheduler started", {
    intervalMs: env.storageLensSchedulerIntervalMs,
    startupDelayMs: env.storageLensSchedulerStartupDelayMs,
    defaultPrefix: env.storageLensDefaultExportPrefix,
    maxFilesPerRun: env.storageLensSchedulerMaxFilesPerRun,
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
    logger.info("Storage Lens scheduler stopped");
  };
}

