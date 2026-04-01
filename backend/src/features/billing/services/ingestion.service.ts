import { Op } from "sequelize";

import { BadRequestError, InternalServerError } from "../../../errors/http-errors.js";
import { BillingIngestionRun, BillingSource } from "../../../models/index.js";

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
    return await BillingIngestionRun.create({
      billingSourceId: String(billingSourceId),
      rawBillingFileId: String(rawBillingFileId),
      status: "queued",
      currentStep: "queued",
      progressPercent: 5,
      statusMessage: "Your billing file is queued for processing",
      lastHeartbeatAt: new Date(),
    });
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
          [Op.notIn]: ["completed", "failed"],
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

    return getIngestionRunById(runId);
  } catch (error) {
    throw new InternalServerError("Failed to update billing ingestion run", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
