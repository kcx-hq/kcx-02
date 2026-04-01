import { BadRequestError, InternalServerError } from "../../../errors/http-errors.js";
import { BillingIngestionRun } from "../../../models/index.js";

type CreateIngestionRunParams = {
  billingSourceId: string | number;
  rawBillingFileId: string | number;
};

type UpdateIngestionRunPatch = {
  status?: string;
  rows_read?: number;
  rows_loaded?: number;
  rows_failed?: number;
  error_message?: string | null;
  started_at?: Date | string | null;
  finished_at?: Date | string | null;
};

const INGESTION_RUN_PATCH_FIELD_MAP = {
  status: "status",
  rows_read: "rowsRead",
  rows_loaded: "rowsLoaded",
  rows_failed: "rowsFailed",
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
