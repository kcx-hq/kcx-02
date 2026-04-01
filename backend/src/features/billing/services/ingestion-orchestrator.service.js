import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

import env from "../../../config/env.js";
import { NotFoundError } from "../../../errors/http-errors.js";
import { RawBillingFile } from "../../../models/index.js";
import { insertFactCostLineItem } from "./fact-cost-line-item.service.js";
import {
  detectFileFormatFromKey,
  readCsvHeaders,
  readCsvRows,
  readParquetRows,
  readParquetSchemaColumns,
} from "./file-reader.service.js";
import { getIngestionRunById, updateIngestionRunStatus } from "./ingestion.service.js";
import {
  buildSchemaValidationErrorMessage,
  normalizeRowToCanonical,
  validateHeaders,
} from "./schema-validator.service.js";

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

function resolveIngestionFileFormat(rawFile) {
  const formatFromRecord = normalizeFormat(rawFile?.fileFormat);
  const formatFromKey = detectFileFormatFromKey(rawFile?.rawStorageKey);

  if (formatFromRecord && formatFromKey && formatFromRecord !== formatFromKey) {
    throw new Error(
      `File format mismatch. record=${rawFile?.fileFormat}, key=${rawFile?.rawStorageKey}`,
    );
  }

  const resolvedFormat = formatFromRecord || formatFromKey;
  assertSupportedFormat(resolvedFormat);
  return resolvedFormat;
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
    const resolvedFileFormat = resolveIngestionFileFormat(rawFile);

    await markRunRunning(run.id);

    await verifyRawFileExistsInS3({
      bucket: rawFile.rawStorageBucket,
      key: rawFile.rawStorageKey,
    });

    // Two-phase ingestion flow:
    // 1) Read only schema/header metadata
    // 2) Validate schema and fail fast
    // 3) Read and normalize full rows only when schema is valid
    const headers =
      resolvedFileFormat === "csv"
        ? await readCsvHeaders({
            bucket: rawFile.rawStorageBucket,
            key: rawFile.rawStorageKey,
          })
        : await readParquetSchemaColumns({
            bucket: rawFile.rawStorageBucket,
            key: rawFile.rawStorageKey,
          });

    const validation = validateHeaders(headers);

    if (!validation.success) {
      const schemaValidationErrorMessage = buildSchemaValidationErrorMessage(validation);
      await markRunFailed(run.id, new Error(schemaValidationErrorMessage));
      return;
    }

    const rawRows =
      resolvedFileFormat === "csv"
        ? await readCsvRows({
            bucket: rawFile.rawStorageBucket,
            key: rawFile.rawStorageKey,
          })
        : await readParquetRows({
            bucket: rawFile.rawStorageBucket,
            key: rawFile.rawStorageKey,
          });

    const normalizedRows = rawRows.map((rawRow) =>
      normalizeRowToCanonical(rawRow, validation.canonicalHeaderMap),
    );

    console.info("Schema validation passed", {
      normalizedRowCount: normalizedRows.length,
      fileFormat: resolvedFileFormat,
    });

    let rowsRead = 0;
    let rowsLoaded = 0;
    let rowsFailed = 0;

    // NOTE:
    // This processes normalized rows sequentially (MVP).
    // Can be optimized later using batching or parallel processing.
    for (const [rowIndex, normalizedRow] of normalizedRows.entries()) {
      rowsRead += 1;

      try {
        await insertFactCostLineItem({
          rawRow: normalizedRow,
          tenantId: rawFile.tenantId,
          billingSourceId: rawFile.billingSourceId,
          ingestionRunId: run.id,
          providerId: rawFile.cloudProviderId,
        });

        rowsLoaded += 1;
      } catch (err) {
        rowsFailed += 1;
        console.warn("Row insert failed", {
          ingestionRunId: run.id,
          rowIndex,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
    }

    await markRunCompleted(run.id, {
      rowsRead,
      rowsLoaded,
      rowsFailed,
    });

    console.info("Ingestion completed", { rowsRead, rowsLoaded, rowsFailed });
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
