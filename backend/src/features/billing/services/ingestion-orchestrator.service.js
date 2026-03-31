import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

import env from "../../../config/env.js";
import { NotFoundError } from "../../../errors/http-errors.js";
import { RawBillingFile } from "../../../models/index.js";
import { insertFactCostLineItem } from "./fact-cost-line-item.service.js";
import { readBillingFile } from "./file-reader.service.js";
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

async function markRunCompleted(runId, { rowsRead = 0, rowsLoaded = 0, rowsFailed = 0 } = {}) {
  await updateIngestionRunStatus(runId, {
    status: "completed",
    rows_read: rowsRead,
    rows_loaded: rowsLoaded,
    rows_failed: rowsFailed,
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

function assertRawFileLocation(rawFile) {
  if (!rawFile?.rawStorageBucket || !rawFile?.rawStorageKey) {
    throw new Error("Raw billing file is missing S3 bucket or object key");
  }
}

export async function processIngestionRun(ingestionRunId) {
  console.info("Starting ingestion", { ingestionRunId });

  let run;

  try {
    run = await loadIngestionRunOrThrow(ingestionRunId);

    const rawFile = await loadRawBillingFileOrThrow(run.rawBillingFileId);
    assertRawFileLocation(rawFile);
    assertSupportedFormat(rawFile.fileFormat);

    // Validate object exists before moving run to active processing.
    await verifyRawFileExistsInS3({
      bucket: rawFile.rawStorageBucket,
      key: rawFile.rawStorageKey,
    });

    await markRunRunning(run.id);

    const { rows, rowCount } = await readBillingFile({
      bucket: rawFile.rawStorageBucket,
      key: rawFile.rawStorageKey,
      fileFormat: rawFile.fileFormat,
    });

    console.info("Rows to process", { rowCount });

    let rowsRead = 0;
    let rowsLoaded = 0;
    let rowsFailed = 0;

    // NOTE:
    // This processes rows sequentially (MVP).
    // Can be optimized later using batching or parallel processing.
    for (const rawRow of rows) {
      rowsRead += 1;

      try {
        await insertFactCostLineItem({
          rawRow,
          tenantId: rawFile.tenantId,
          billingSourceId: rawFile.billingSourceId,
          ingestionRunId: run.id,
          providerId: rawFile.cloudProviderId,
        });

        rowsLoaded += 1;
      } catch (_error) {
        rowsFailed += 1;
        continue;
      }
    }

    await markRunCompleted(run.id, {
      rowsRead,
      rowsLoaded,
      rowsFailed,
    });

    console.info("Ingestion completed", { rowsLoaded, rowsFailed });
  } catch (error) {
    if (!run?.id) {
      throw error;
    }

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
