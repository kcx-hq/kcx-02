import { BadRequestError } from "../../../errors/http-errors.js";
import { AnomalyDetectionRun } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";

import {
  markAnomalyDetectionRunCompleted,
  markAnomalyDetectionRunFailed,
  markAnomalyDetectionRunRunning,
} from "./anomaly-detection-run.service.js";
import { applyDailyTotalCostSpikeLifecycle } from "./daily-total-cost-spike.lifecycle.js";
import {
  detectDailyTotalCostSpikesForSource, type DailyTotalCostSpikeDetectionResult,
} from "./daily-total-cost-spike.detector.js";

async function mergeRunMetadata(runId: string, patch: Record<string, unknown>): Promise<void> {
  const run = await AnomalyDetectionRun.findByPk(runId);
  if (!run) return;

  const currentMetadata = run.metadataJson && typeof run.metadataJson === "object" ? run.metadataJson : {};
  await run.update({
    metadataJson: {
      ...currentMetadata,
      ...patch,
    },
    updatedAt: new Date(),
  });
}

async function executeDailyTotalCostSpikeRun(runId: string): Promise<void> {
  const run = await AnomalyDetectionRun.findByPk(runId);
  if (!run) {
    logger.warn("Anomaly execution skipped: run not found", { runId });
    return;
  }

  if (run.status === "running") {
    logger.info("Anomaly execution skipped: run is already running", { runId });
    return;
  }

  if (run.status === "completed") {
    logger.info("Anomaly execution skipped: run already completed", { runId });
    return;
  }

  if (run.status === "failed" || run.status === "cancelled") {
    logger.info("Anomaly execution skipped: run is not executable", {
      runId,
      status: run.status,
    });
    return;
  }

  if (!run.billingSourceId) {
    await markAnomalyDetectionRunFailed(runId, {
      errorMessage: "Run is missing required billing_source_id scope",
      statusMessage: "Cannot execute anomaly detection run without billing source",
    });
    return;
  }

  const billingSourceId = String(run.billingSourceId);

  await markAnomalyDetectionRunRunning(runId, "Running daily total cost spike detector");

  try {
    const result: DailyTotalCostSpikeDetectionResult = await detectDailyTotalCostSpikesForSource({
      billingSourceId,
      dateFrom: run.dateFrom ?? null,
      dateTo: run.dateTo ?? null,
    });

    const lifecycle = await applyDailyTotalCostSpikeLifecycle({
      runId,
      billingSourceId,
      tenantId: run.tenantId ?? null,
      cloudConnectionId: run.cloudConnectionId ?? null,
      effectiveDateFrom: result.effectiveDateFrom,
      effectiveDateTo: result.effectiveDateTo,
      candidates: result.candidates,
    });

    await mergeRunMetadata(runId, {
      phase: "phase_6",
      detector: "daily_total_cost_spike",
      guardrails: result.guardrails,
      effectiveDateFrom: result.effectiveDateFrom,
      effectiveDateTo: result.effectiveDateTo,
      historyWindowStart: result.historyWindowStart,
      historyWindowEnd: result.historyWindowEnd,
      defaultedDateWindow: result.defaultedDateWindow,
      evaluatedDays: result.evaluatedDays,
      observedDaysInWindow: result.observedDaysInWindow,
      candidateCount: result.candidates.length,
      persistedCreated: lifecycle.created,
      persistedUpdated: lifecycle.updated,
      persistedResolved: lifecycle.resolved,
      executionFinishedAt: new Date().toISOString(),
    });

    await markAnomalyDetectionRunCompleted(runId, {
      statusMessage: `Daily spike detection completed (${result.candidates.length} candidate(s), ${lifecycle.created} created, ${lifecycle.updated} updated, ${lifecycle.resolved} resolved)`,
      sourcesProcessed: 1,
      anomaliesCreated: lifecycle.created,
      anomaliesUpdated: lifecycle.updated,
      anomaliesResolved: lifecycle.resolved,
    });

    logger.info("Anomaly execution completed", {
      runId,
      billingSourceId,
      candidates: result.candidates.length,
      created: lifecycle.created,
      updated: lifecycle.updated,
      resolved: lifecycle.resolved,
      effectiveDateFrom: result.effectiveDateFrom,
      effectiveDateTo: result.effectiveDateTo,
      defaultedDateWindow: result.defaultedDateWindow,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await mergeRunMetadata(runId, {
      phase: "phase_6",
      detector: "daily_total_cost_spike",
      executionFailedAt: new Date().toISOString(),
      executionError: errorMessage,
    });

    await markAnomalyDetectionRunFailed(runId, {
      errorMessage,
      statusMessage: "Daily spike detection failed",
    });

    throw error;
  }
}

export async function executeAnomalyDetectionRun(runId: string): Promise<void> {
  const normalizedRunId = String(runId ?? "").trim();
  if (!normalizedRunId) {
    throw new BadRequestError("runId is required");
  }

  await executeDailyTotalCostSpikeRun(normalizedRunId);
}
