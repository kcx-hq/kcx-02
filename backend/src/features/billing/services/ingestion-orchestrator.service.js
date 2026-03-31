import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

import env from "../../../config/env.js";
import { NotFoundError } from "../../../errors/http-errors.js";
import { RawBillingFile } from "../../../models/index.js";
import { getIngestionRunById, updateIngestionRunStatus } from "./ingestion.service.js";

const SUPPORTED_FORMATS = new Set(["csv", "parquet"]);

const s3Client = new S3Client({
  region: env.awsRegion,
  endpoint: env.awsS3Endpoint,
  forcePathStyle: env.awsS3ForcePathStyle,
  credentials:
    env.awsAccessKeyId && env.awsSecretAccessKey
      ? {
          accessKeyId: env.awsAccessKeyId,
          secretAccessKey: env.awsSecretAccessKey,
          ...(env.awsSessionToken ? { sessionToken: env.awsSessionToken } : {}),
        }
      : undefined,
});

const toErrorMessage = (error) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Unknown ingestion orchestrator error";
};

const normalizeFormat = (value) => String(value ?? "").trim().toLowerCase();

async function loadIngestionRunOrThrow(ingestionRunId) {
  const run = await getIngestionRunById(ingestionRunId);
  if (!run) {
    throw new NotFoundError(`Billing ingestion run not found for id: ${ingestionRunId}`);
  }
  return run;
}

async function loadRawBillingFileOrThrow(rawBillingFileId) {
  const rawFile = await RawBillingFile.findByPk(String(rawBillingFileId));
  if (!rawFile) {
    throw new NotFoundError(`Raw billing file not found for id: ${rawBillingFileId}`);
  }
  return rawFile;
}

async function verifyRawFileExistsInS3({ bucket, key }) {
  await s3Client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

async function markRunRunning(runId) {
  await updateIngestionRunStatus(runId, {
    status: "running",
    started_at: new Date(),
    error_message: null,
    finished_at: null,
  });
}

async function markRunCompleted(runId) {
  await updateIngestionRunStatus(runId, {
    status: "completed",
    finished_at: new Date(),
  });
}

async function markRunFailed(runId, error) {
  await updateIngestionRunStatus(runId, {
    status: "failed",
    error_message: toErrorMessage(error),
    finished_at: new Date(),
  });
}

function assertSupportedFormat(fileFormat) {
  const normalizedFormat = normalizeFormat(fileFormat);
  if (!SUPPORTED_FORMATS.has(normalizedFormat)) {
    throw new Error(`Unsupported file format: ${fileFormat}`);
  }
}

export async function processIngestionRun(ingestionRunId) {
  const run = await loadIngestionRunOrThrow(ingestionRunId);

  try {
    await markRunRunning(run.id);

    const rawFile = await loadRawBillingFileOrThrow(run.rawBillingFileId);
    assertSupportedFormat(rawFile.fileFormat);

    // MVP readiness checks only:
    // 1) raw record exists
    // 2) object is present in S3
    // 3) format is currently supported
    // Real CSV/Parquet parsing + fact table loading will be added in a later phase.
    await verifyRawFileExistsInS3({
      bucket: rawFile.rawStorageBucket,
      key: rawFile.rawStorageKey,
    });

    await markRunCompleted(run.id);
  } catch (error) {
    try {
      await markRunFailed(run.id, error);
    } catch (markError) {
      // Assumption: avoid throwing from the async background task after a best-effort failure update.
      console.error("Failed to mark ingestion run as failed", {
        ingestionRunId: run.id,
        reason: toErrorMessage(markError),
        originalReason: toErrorMessage(error),
      });
    }
  }
}

export const ingestionOrchestrator = {
  processIngestionRun,
  loadIngestionRunOrThrow,
  loadRawBillingFileOrThrow,
  verifyRawFileExistsInS3,
  markRunRunning,
  markRunCompleted,
  markRunFailed,
};
