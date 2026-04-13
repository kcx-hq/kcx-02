import type {
  AnomalyDetectionRunMode,
  AnomalyDetectionRunStatus,
  AnomalyDetectionRunTriggerType,
} from "../../../models/anomaly-detection-run.js";

export const ANOMALY_RUN_LIFECYCLE_STATUSES = ["queued", "running", "completed", "failed"] as const;
export type AnomalyRunLifecycleStatus = (typeof ANOMALY_RUN_LIFECYCLE_STATUSES)[number];

export type CreateAnomalyDetectionRunInput = {
  billingSourceId: string;
  triggerType: AnomalyDetectionRunTriggerType;
  mode: AnomalyDetectionRunMode;
  tenantId?: string | null;
  cloudConnectionId?: string | null;
  ingestionRunId?: string | number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  includeHourly?: boolean;
  forceRebuild?: boolean;
  createdBy?: string | null;
  metadataJson?: Record<string, unknown> | null;
  statusMessage?: string | null;
};

export type UpdateAnomalyDetectionRunStatusInput = {
  status: AnomalyRunLifecycleStatus;
  statusMessage?: string | null;
  errorMessage?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

export type UpdateAnomalyDetectionRunCountersInput = {
  sourcesProcessed?: number;
  anomaliesCreated?: number;
  anomaliesUpdated?: number;
  anomaliesResolved?: number;
};

export type CompleteAnomalyDetectionRunInput = {
  statusMessage?: string | null;
} & UpdateAnomalyDetectionRunCountersInput;

export type FailAnomalyDetectionRunInput = {
  errorMessage: string;
  statusMessage?: string | null;
};

export type AnomalyDetectionRunSummary = {
  id: string;
  billingSourceId: string | null;
  cloudConnectionId: string | null;
  triggerType: string;
  mode: string;
  status: AnomalyDetectionRunStatus | string;
  sourcesProcessed: number;
  anomaliesCreated: number;
  anomaliesUpdated: number;
  anomaliesResolved: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  statusMessage: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};
