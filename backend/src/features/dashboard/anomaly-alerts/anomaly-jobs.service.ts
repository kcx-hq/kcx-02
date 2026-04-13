import { NotFoundError, UnauthorizedError } from "../../../errors/http-errors.js";
import { AnomalyDetectionRun, BillingSource } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";

import { createAnomalyDetectionRun } from "./anomaly-detection-run.service.js";
import { triggerAnomalyDetectionRunExecution } from "./anomaly-ingestion-trigger.service.js";
import type { CreateAnomalyJobPayload } from "./anomaly.schema.js";

type ManualJobContext = {
  tenantId: string;
  userId: string | null;
};

type AnomalyRunStatusResponse = {
  id: string;
  status: string;
  trigger_type: string;
  mode: string;
  tenant_id: string | null;
  billing_source_id: number | null;
  cloud_connection_id: string | null;
  ingestion_run_id: number | null;
  date_from: string | null;
  date_to: string | null;
  include_hourly: boolean;
  force_rebuild: boolean;
  sources_processed: number;
  anomalies_created: number;
  anomalies_updated: number;
  anomalies_resolved: number;
  error_message: string | null;
  status_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

const toIntOrNull = (value: unknown): number | null => {
  if (value === null || typeof value === "undefined") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIsoOrNull = (value: Date | null | undefined): string | null => {
  if (!value) return null;
  return value.toISOString();
};

const toStatusResponse = (run: InstanceType<typeof AnomalyDetectionRun>): AnomalyRunStatusResponse => ({
  id: String(run.id),
  status: String(run.status),
  trigger_type: String(run.triggerType),
  mode: String(run.mode),
  tenant_id: run.tenantId ?? null,
  billing_source_id: toIntOrNull(run.billingSourceId),
  cloud_connection_id: run.cloudConnectionId ?? null,
  ingestion_run_id: toIntOrNull(run.ingestionRunId),
  date_from: run.dateFrom ?? null,
  date_to: run.dateTo ?? null,
  include_hourly: Boolean(run.includeHourly),
  force_rebuild: Boolean(run.forceRebuild),
  sources_processed: Number(run.sourcesProcessed ?? 0),
  anomalies_created: Number(run.anomaliesCreated ?? 0),
  anomalies_updated: Number(run.anomaliesUpdated ?? 0),
  anomalies_resolved: Number(run.anomaliesResolved ?? 0),
  error_message: run.errorMessage ?? null,
  status_message: run.statusMessage ?? null,
  started_at: toIsoOrNull(run.startedAt),
  finished_at: toIsoOrNull(run.finishedAt),
  created_at: run.createdAt.toISOString(),
  updated_at: run.updatedAt.toISOString(),
});

async function loadTenantBillingSourceOrThrow({
  billingSourceId,
  tenantId,
}: {
  billingSourceId: number;
  tenantId: string;
}): Promise<InstanceType<typeof BillingSource>> {
  const billingSource = await BillingSource.findOne({
    where: {
      id: String(billingSourceId),
      tenantId,
    },
  });

  if (!billingSource) {
    throw new NotFoundError("Billing source not found");
  }

  return billingSource;
}

export async function createManualAnomalyDetectionJob({
  payload,
  context,
}: {
  payload: CreateAnomalyJobPayload;
  context: ManualJobContext;
}): Promise<{ job_id: string; status: string; trigger_type: string; mode: string }> {
  const billingSource = await loadTenantBillingSourceOrThrow({
    billingSourceId: Number(payload.billing_source_id),
    tenantId: context.tenantId,
  });

  const run = await createAnomalyDetectionRun({
    triggerType: "manual",
    mode: payload.mode,
    billingSourceId: String(billingSource.id),
    tenantId: context.tenantId,
    cloudConnectionId: billingSource.cloudConnectionId ?? null,
    dateFrom: payload.date_from ?? null,
    dateTo: payload.date_to ?? null,
    includeHourly: payload.include_hourly,
    forceRebuild: payload.force_rebuild,
    createdBy: context.userId,
    statusMessage: "Queued by manual anomaly detection request",
    metadataJson: {
      source: "manual_api",
      phase: "phase_7",
    },
  });

  setImmediate(() => {
    void triggerAnomalyDetectionRunExecution(run.id).catch((error: unknown) => {
      logger.error("Manual anomaly job execution failed", {
        runId: run.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    });
  });

  return {
    job_id: run.id,
    status: String(run.status),
    trigger_type: String(run.triggerType),
    mode: String(run.mode),
  };
}

export async function getAnomalyDetectionJobStatusForTenant({
  jobId,
  tenantId,
}: {
  jobId: string;
  tenantId: string;
}): Promise<AnomalyRunStatusResponse> {
  const run = await AnomalyDetectionRun.findByPk(jobId, {
    include: [
      {
        model: BillingSource,
        required: false,
      },
    ],
  });

  if (!run) {
    throw new NotFoundError("Anomaly detection job not found");
  }

  const joinedBillingSource = (run as unknown as { BillingSource?: InstanceType<typeof BillingSource> }).BillingSource;
  const runTenantId = run.tenantId ?? joinedBillingSource?.tenantId ?? null;

  if (!runTenantId) {
    throw new UnauthorizedError("Anomaly detection job tenant context is missing");
  }

  if (String(runTenantId) !== tenantId) {
    throw new NotFoundError("Anomaly detection job not found");
  }

  return toStatusResponse(run);
}
