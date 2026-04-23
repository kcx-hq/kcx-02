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
import {
  applyEc2InstanceCostSpikeLifecycle,
} from "./ec2-instance-cost-spike.lifecycle.js";
import {
  detectEc2InstanceCostSpikesForSource, type Ec2InstanceCostSpikeDetectionResult,
} from "./ec2-instance-cost-spike.detector.js";

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

  await markAnomalyDetectionRunRunning(runId, "Running anomaly detectors");

  try {
    const result: DailyTotalCostSpikeDetectionResult = await detectDailyTotalCostSpikesForSource({
      billingSourceId,
      dateFrom: run.dateFrom ?? null,
      dateTo: run.dateTo ?? null,
    });

    const dailyTotalLifecycle = await applyDailyTotalCostSpikeLifecycle({
      runId,
      billingSourceId,
      tenantId: run.tenantId ?? null,
      cloudConnectionId: run.cloudConnectionId ?? null,
      effectiveDateFrom: result.effectiveDateFrom,
      effectiveDateTo: result.effectiveDateTo,
      candidates: result.candidates,
    });

    const cloudConnectionId = run.cloudConnectionId ? String(run.cloudConnectionId).trim() : null;
    const ec2Result: Ec2InstanceCostSpikeDetectionResult = await detectEc2InstanceCostSpikesForSource({
      billingSourceId,
      cloudConnectionId,
      tenantId: run.tenantId ?? null,
      dateFrom: run.dateFrom ?? null,
      dateTo: run.dateTo ?? null,
    });

    const ec2Lifecycle = await applyEc2InstanceCostSpikeLifecycle({
      runId,
      billingSourceId,
      tenantId: run.tenantId ?? null,
      cloudConnectionId,
      effectiveDateFrom: ec2Result.effectiveDateFrom,
      effectiveDateTo: ec2Result.effectiveDateTo,
      candidates: ec2Result.candidates,
    });

    const totalCreated = dailyTotalLifecycle.created + ec2Lifecycle.created;
    const totalUpdated = dailyTotalLifecycle.updated + ec2Lifecycle.updated;
    const totalResolved = dailyTotalLifecycle.resolved + ec2Lifecycle.resolved;

    await mergeRunMetadata(runId, {
      phase: "phase_6",
      detectors: {
        daily_total_cost_spike: {
          guardrails: result.guardrails,
          effectiveDateFrom: result.effectiveDateFrom,
          effectiveDateTo: result.effectiveDateTo,
          historyWindowStart: result.historyWindowStart,
          historyWindowEnd: result.historyWindowEnd,
          defaultedDateWindow: result.defaultedDateWindow,
          evaluatedDays: result.evaluatedDays,
          observedDaysInWindow: result.observedDaysInWindow,
          candidateCount: result.candidates.length,
          persistedCreated: dailyTotalLifecycle.created,
          persistedUpdated: dailyTotalLifecycle.updated,
          persistedResolved: dailyTotalLifecycle.resolved,
        },
        ec2_instance_cost_spike: {
          guardrails: ec2Result.guardrails,
          effectiveDateFrom: ec2Result.effectiveDateFrom,
          effectiveDateTo: ec2Result.effectiveDateTo,
          historyWindowStart: ec2Result.historyWindowStart,
          historyWindowEnd: ec2Result.historyWindowEnd,
          defaultedDateWindow: ec2Result.defaultedDateWindow,
          observedInstanceDaysInWindow: ec2Result.observedInstanceDaysInWindow,
          evaluatedInstanceDays: ec2Result.evaluatedInstanceDays,
          candidateCount: ec2Result.candidates.length,
          persistedCreated: ec2Lifecycle.created,
          persistedUpdated: ec2Lifecycle.updated,
          persistedResolved: ec2Lifecycle.resolved,
        },
      },
      candidateCount: result.candidates.length + ec2Result.candidates.length,
      persistedCreated: totalCreated,
      persistedUpdated: totalUpdated,
      persistedResolved: totalResolved,
      executionFinishedAt: new Date().toISOString(),
    });

    await markAnomalyDetectionRunCompleted(runId, {
      statusMessage: `Anomaly detection completed (${result.candidates.length + ec2Result.candidates.length} candidate(s), ${totalCreated} created, ${totalUpdated} updated, ${totalResolved} resolved)`,
      sourcesProcessed: 2,
      anomaliesCreated: totalCreated,
      anomaliesUpdated: totalUpdated,
      anomaliesResolved: totalResolved,
    });

    logger.info("Anomaly execution completed", {
      runId,
      billingSourceId,
      dailyTotalCandidates: result.candidates.length,
      ec2ResourceCandidates: ec2Result.candidates.length,
      created: totalCreated,
      updated: totalUpdated,
      resolved: totalResolved,
      effectiveDateFrom: run.dateFrom ?? null,
      effectiveDateTo: run.dateTo ?? null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await mergeRunMetadata(runId, {
      phase: "phase_6",
      detector: "composite_anomaly_detection",
      executionFailedAt: new Date().toISOString(),
      executionError: errorMessage,
    });

    await markAnomalyDetectionRunFailed(runId, {
      errorMessage,
      statusMessage: "Anomaly detection failed",
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
