import { Op } from "sequelize";

import { BadRequestError, InternalServerError } from "../../../errors/http-errors.js";
import { BillingIngestionRun, BillingIngestionRunFile, BillingSource, RawBillingFile, User } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { createAndStartAnomalyDetectionRunFromIngestion } from "../../dashboard/anomaly-alerts/anomaly-ingestion-trigger.service.js";

type CreateIngestionRunParams = {
  billingSourceId: string | number;
  rawBillingFileId: string | number;
};

type UpdateIngestionRunPatch = {
  status?: string;
  current_step?: string | null;
  progress_percent?: number;
  status_message?: string | null;
  rows_read?: number;
  rows_loaded?: number;
  rows_failed?: number;
  total_rows_estimated?: number | null;
  last_heartbeat_at?: Date | string | null;
  error_message?: string | null;
  started_at?: Date | string | null;
  finished_at?: Date | string | null;
};

export type BillingUploadHistoryRecord = {
  id: string;
  rawBillingFileId: string;
  fileName: string;
  fileType: string;
  status: string;
  uploadedAt: Date | null;
  uploadedBy: string | null;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  tenantId: string;
};

const INGESTION_RUN_PATCH_FIELD_MAP = {
  status: "status",
  current_step: "currentStep",
  progress_percent: "progressPercent",
  status_message: "statusMessage",
  rows_read: "rowsRead",
  rows_loaded: "rowsLoaded",
  rows_failed: "rowsFailed",
  total_rows_estimated: "totalRowsEstimated",
  last_heartbeat_at: "lastHeartbeatAt",
  error_message: "errorMessage",
  started_at: "startedAt",
  finished_at: "finishedAt",
} as const;

export async function createIngestionRun({
  billingSourceId,
  rawBillingFileId,
}: CreateIngestionRunParams) {
  try {
    const run = await BillingIngestionRun.create({
      billingSourceId: String(billingSourceId),
      rawBillingFileId: String(rawBillingFileId),
      status: "queued",
      currentStep: "queued",
      progressPercent: 5,
      statusMessage: "Your billing file is queued for processing",
      lastHeartbeatAt: new Date(),
    });

    await BillingIngestionRunFile.create({
      ingestionRunId: String(run.id),
      rawBillingFileId: String(rawBillingFileId),
      fileRole: "data",
      processingOrder: 0,
    });

    return run;
  } catch (error) {
    throw new InternalServerError("Failed to create billing ingestion run", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getIngestionRunById(runId: string | number) {
  try {
    return await BillingIngestionRun.findByPk(String(runId));
  } catch (error) {
    throw new InternalServerError("Failed to fetch billing ingestion run", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getIngestionRunByIdForTenant(runId: string | number, tenantId: string) {
  try {
    return await BillingIngestionRun.findOne({
      where: { id: String(runId) },
      include: [
        {
          model: BillingSource,
          attributes: [],
          required: true,
          where: { tenantId },
        },
      ],
    });
  } catch (error) {
    throw new InternalServerError("Failed to fetch billing ingestion run", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getLatestIngestionRunForSource({
  billingSourceId,
  tenantId,
}: {
  billingSourceId: string | number;
  tenantId: string;
}) {
  try {
    return await BillingIngestionRun.findOne({
      where: { billingSourceId: String(billingSourceId) },
      include: [
        {
          model: BillingSource,
          attributes: [],
          required: true,
          where: { tenantId },
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  } catch (error) {
    throw new InternalServerError("Failed to fetch latest billing ingestion run", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getLatestActiveIngestionRunForTenant(tenantId: string) {
  try {
    return await BillingIngestionRun.findOne({
      where: {
        status: {
          [Op.notIn]: ["completed", "completed_with_warnings", "failed"],
        },
      },
      include: [
        {
          model: BillingSource,
          attributes: [],
          required: true,
          where: { tenantId },
        },
      ],
      order: [["updatedAt", "DESC"]],
    });
  } catch (error) {
    throw new InternalServerError("Failed to fetch active billing ingestion run", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getUploadHistoryForTenant(tenantId: string): Promise<BillingUploadHistoryRecord[]> {
  try {
    const runs = await BillingIngestionRun.findAll({
      include: [
        {
          model: BillingSource,
          attributes: ["tenantId"],
          required: true,
          where: {
            tenantId,
            sourceType: "manual_upload",
          },
        },
        {
          model: RawBillingFile,
          attributes: ["originalFileName", "fileFormat", "createdAt"],
          required: true,
          include: [
            {
              model: User,
              attributes: ["fullName"],
              required: false,
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return runs.map((run) => {
      const source = (run as unknown as { BillingSource?: InstanceType<typeof BillingSource> }).BillingSource;
      const rawFile = (run as unknown as {
        RawBillingFile?: InstanceType<typeof RawBillingFile> & { User?: InstanceType<typeof User> };
      }).RawBillingFile;

      const failedRows = Number(run.rowsFailed ?? 0);
      const inferredStatus = (() => {
        if (run.status === "queued") return "queued";
        if (run.status === "failed") return "failed";
        if (run.status === "completed_with_warnings" || (run.status === "completed" && failedRows > 0)) {
          return "warning";
        }
        if (run.status === "completed") return "completed";
        return "processing";
      })();

      return {
        id: String(run.id),
        rawBillingFileId: String(run.rawBillingFileId),
        fileName: rawFile?.originalFileName ?? "Unknown file",
        fileType: rawFile?.fileFormat ?? "unknown",
        status: inferredStatus,
        uploadedAt: rawFile?.createdAt ?? null,
        // Assumption: uploader identity is not persisted on current raw file or ingestion-run schemas.
        uploadedBy: rawFile?.User?.fullName ?? null,
        totalRows: Number(run.totalRowsEstimated ?? run.rowsRead ?? 0),
        processedRows: Number(run.rowsLoaded ?? 0),
        failedRows,
        tenantId: source?.tenantId ?? tenantId,
      };
    });
  } catch (error) {
    throw new InternalServerError("Failed to fetch billing upload history", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function updateIngestionRunStatus(runId: string | number, patch: UpdateIngestionRunPatch) {
  const updatePayload: Record<string, unknown> = {};

  (Object.keys(INGESTION_RUN_PATCH_FIELD_MAP) as Array<keyof typeof INGESTION_RUN_PATCH_FIELD_MAP>).forEach((key) => {
    if (patch[key] !== undefined) {
      updatePayload[INGESTION_RUN_PATCH_FIELD_MAP[key]] = patch[key];
    }
  });

  if (Object.keys(updatePayload).length === 0) {
    throw new BadRequestError("No valid ingestion run fields provided to update");
  }

  updatePayload.updatedAt = new Date();

  try {
    const [affectedCount] = await BillingIngestionRun.update(updatePayload, {
      where: { id: String(runId) },
    });

    if (affectedCount === 0) {
      return null;
    }

    const updatedRun = await getIngestionRunById(runId);

    const nextStatus = typeof patch.status === "string" ? patch.status : null;
    const isSuccessfulCompletionStatus = nextStatus === "completed" || nextStatus === "completed_with_warnings";

    if (updatedRun && isSuccessfulCompletionStatus) {
      try {
        await createAndStartAnomalyDetectionRunFromIngestion({
          ingestionRunId: String(updatedRun.id),
        });
      } catch (error) {
        logger.error("Failed to enqueue anomaly detection run after ingestion completion", {
          ingestionRunId: String(updatedRun.id),
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return updatedRun;
  } catch (error) {
    throw new InternalServerError("Failed to update billing ingestion run", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
