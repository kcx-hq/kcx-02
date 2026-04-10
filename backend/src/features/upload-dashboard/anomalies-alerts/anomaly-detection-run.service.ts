import { BadRequestError, InternalServerError, NotFoundError } from "../../../errors/http-errors.js";
import {
  ANOMALY_DETECTION_RUN_MODES,
  ANOMALY_DETECTION_RUN_TRIGGER_TYPES,
} from "../../../models/anomaly-detection-run.js";
import { AnomalyDetectionRun } from "../../../models/index.js";

import type {
  AnomalyDetectionRunSummary,
  CompleteAnomalyDetectionRunInput,
  CreateAnomalyDetectionRunInput,
  FailAnomalyDetectionRunInput,
  UpdateAnomalyDetectionRunCountersInput,
  UpdateAnomalyDetectionRunStatusInput,
} from "./anomaly-detection-run.types.js";

const ALLOWED_TRIGGER_TYPES = new Set<string>(ANOMALY_DETECTION_RUN_TRIGGER_TYPES);
const ALLOWED_MODES = new Set<string>(ANOMALY_DETECTION_RUN_MODES);
const ALLOWED_STATUSES = new Set<string>(["queued", "running", "completed", "failed"]);

const toNonNegativeInteger = (value: number, fieldName: string): number => {
  if (!Number.isInteger(value) || value < 0) {
    throw new BadRequestError(`${fieldName} must be a non-negative integer`);
  }
  return value;
};

const assertRunStatus = (status: string): void => {
  if (!ALLOWED_STATUSES.has(status)) {
    throw new BadRequestError("status must be one of queued, running, completed, failed");
  }
};

const assertTriggerType = (triggerType: string): void => {
  if (!ALLOWED_TRIGGER_TYPES.has(triggerType)) {
    throw new BadRequestError("triggerType must be one of ingestion, manual, system");
  }
};

const assertMode = (mode: string): void => {
  if (!ALLOWED_MODES.has(mode)) {
    throw new BadRequestError("mode must be one of incremental, date_range, full");
  }
};

const assertBillingSourceId = (billingSourceId: string): void => {
  const normalized = String(billingSourceId ?? "").trim();
  if (!/^\d+$/.test(normalized)) {
    throw new BadRequestError("billingSourceId must be a valid positive integer identifier");
  }
};

const toSummary = (run: InstanceType<typeof AnomalyDetectionRun>): AnomalyDetectionRunSummary => ({
  id: String(run.id),
  billingSourceId: run.billingSourceId === null ? null : String(run.billingSourceId),
  cloudConnectionId: run.cloudConnectionId ?? null,
  triggerType: String(run.triggerType),
  mode: String(run.mode),
  status: run.status,
  sourcesProcessed: Number(run.sourcesProcessed ?? 0),
  anomaliesCreated: Number(run.anomaliesCreated ?? 0),
  anomaliesUpdated: Number(run.anomaliesUpdated ?? 0),
  anomaliesResolved: Number(run.anomaliesResolved ?? 0),
  startedAt: run.startedAt ?? null,
  finishedAt: run.finishedAt ?? null,
  statusMessage: run.statusMessage ?? null,
  errorMessage: run.errorMessage ?? null,
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
});

export async function createAnomalyDetectionRun(input: CreateAnomalyDetectionRunInput): Promise<AnomalyDetectionRunSummary> {
  assertBillingSourceId(input.billingSourceId);
  assertTriggerType(input.triggerType);
  assertMode(input.mode);

  try {
    const run = await AnomalyDetectionRun.create({
      tenantId: input.tenantId ?? null,
      billingSourceId: String(input.billingSourceId),
      cloudConnectionId: input.cloudConnectionId ?? null,
      ingestionRunId: input.ingestionRunId === undefined || input.ingestionRunId === null ? null : String(input.ingestionRunId),
      triggerType: input.triggerType,
      mode: input.mode,
      status: "queued",
      dateFrom: input.dateFrom ?? null,
      dateTo: input.dateTo ?? null,
      includeHourly: input.includeHourly ?? false,
      forceRebuild: input.forceRebuild ?? false,
      statusMessage: input.statusMessage ?? null,
      createdBy: input.createdBy ?? null,
      metadataJson: input.metadataJson ?? null,
      updatedAt: new Date(),
    });

    return toSummary(run);
  } catch (error) {
    throw new InternalServerError("Failed to create anomaly detection run", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getAnomalyDetectionRunById(runId: string): Promise<AnomalyDetectionRunSummary | null> {
  try {
    const run = await AnomalyDetectionRun.findByPk(runId);
    if (!run) return null;
    return toSummary(run);
  } catch (error) {
    throw new InternalServerError("Failed to fetch anomaly detection run", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function updateAnomalyDetectionRunStatus(
  runId: string,
  input: UpdateAnomalyDetectionRunStatusInput,
): Promise<AnomalyDetectionRunSummary> {
  assertRunStatus(input.status);

  const patch: Record<string, unknown> = {
    status: input.status,
    updatedAt: new Date(),
  };

  if (input.statusMessage !== undefined) {
    patch.statusMessage = input.statusMessage;
  }

  if (input.errorMessage !== undefined) {
    patch.errorMessage = input.errorMessage;
  }

  if (input.startedAt !== undefined) {
    patch.startedAt = input.startedAt;
  }

  if (input.finishedAt !== undefined) {
    patch.finishedAt = input.finishedAt;
  }

  try {
    const [affectedRows] = await AnomalyDetectionRun.update(patch, { where: { id: runId } });
    if (affectedRows === 0) {
      throw new NotFoundError("Anomaly detection run not found");
    }

    const updated = await AnomalyDetectionRun.findByPk(runId);
    if (!updated) {
      throw new NotFoundError("Anomaly detection run not found");
    }

    return toSummary(updated);
  } catch (error) {
    if (error instanceof BadRequestError || error instanceof NotFoundError) {
      throw error;
    }

    throw new InternalServerError("Failed to update anomaly detection run status", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function updateAnomalyDetectionRunCounters(
  runId: string,
  input: UpdateAnomalyDetectionRunCountersInput,
): Promise<AnomalyDetectionRunSummary> {
  const patch: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.sourcesProcessed !== undefined) {
    patch.sourcesProcessed = toNonNegativeInteger(input.sourcesProcessed, "sourcesProcessed");
  }

  if (input.anomaliesCreated !== undefined) {
    patch.anomaliesCreated = toNonNegativeInteger(input.anomaliesCreated, "anomaliesCreated");
  }

  if (input.anomaliesUpdated !== undefined) {
    patch.anomaliesUpdated = toNonNegativeInteger(input.anomaliesUpdated, "anomaliesUpdated");
  }

  if (input.anomaliesResolved !== undefined) {
    patch.anomaliesResolved = toNonNegativeInteger(input.anomaliesResolved, "anomaliesResolved");
  }

  if (Object.keys(patch).length === 1) {
    throw new BadRequestError("No valid counter fields provided to update");
  }

  try {
    const [affectedRows] = await AnomalyDetectionRun.update(patch, { where: { id: runId } });
    if (affectedRows === 0) {
      throw new NotFoundError("Anomaly detection run not found");
    }

    const updated = await AnomalyDetectionRun.findByPk(runId);
    if (!updated) {
      throw new NotFoundError("Anomaly detection run not found");
    }

    return toSummary(updated);
  } catch (error) {
    if (error instanceof BadRequestError || error instanceof NotFoundError) {
      throw error;
    }

    throw new InternalServerError("Failed to update anomaly detection run counters", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function markAnomalyDetectionRunQueued(
  runId: string,
  statusMessage?: string | null,
): Promise<AnomalyDetectionRunSummary> {
  return updateAnomalyDetectionRunStatus(runId, {
    status: "queued",
    statusMessage: statusMessage ?? null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
  });
}

export async function markAnomalyDetectionRunRunning(
  runId: string,
  statusMessage?: string | null,
): Promise<AnomalyDetectionRunSummary> {
  return updateAnomalyDetectionRunStatus(runId, {
    status: "running",
    statusMessage: statusMessage ?? null,
    startedAt: new Date(),
    finishedAt: null,
  });
}

export async function markAnomalyDetectionRunCompleted(
  runId: string,
  input: CompleteAnomalyDetectionRunInput = {},
): Promise<AnomalyDetectionRunSummary> {
  await updateAnomalyDetectionRunCounters(runId, input);

  return updateAnomalyDetectionRunStatus(runId, {
    status: "completed",
    statusMessage: input.statusMessage ?? null,
    errorMessage: null,
    finishedAt: new Date(),
  });
}

export async function markAnomalyDetectionRunFailed(
  runId: string,
  input: FailAnomalyDetectionRunInput,
): Promise<AnomalyDetectionRunSummary> {
  const errorMessage = String(input.errorMessage ?? "").trim();
  if (!errorMessage) {
    throw new BadRequestError("errorMessage is required when marking a run as failed");
  }

  return updateAnomalyDetectionRunStatus(runId, {
    status: "failed",
    statusMessage: input.statusMessage ?? null,
    errorMessage,
    finishedAt: new Date(),
  });
}
