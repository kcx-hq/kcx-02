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
const PROGRESS_BY_STAGE = {
  queued: 5,
  validating_schema: 10,
  reading_rows: 25,
  normalizing: 45,
  upserting_dimensions: 65,
  inserting_facts: 85,
  finalizing: 95,
  completed: 100,
};

const STAGE_MESSAGE = {
  queued: "Your billing file is queued for processing",
  validating_schema: "Checking file structure",
  reading_rows: "Reading billing rows",
  normalizing: "Standardizing billing fields",
  upserting_dimensions: "Preparing services, accounts, and resources",
  inserting_facts: "Saving cost records",
  finalizing: "Finalizing ingestion",
  completed: "Billing data is ready",
  failed: "We couldn't finish ingestion",
};

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

const now = () => new Date();

function clampProgress(progressPercent) {
  if (!Number.isFinite(progressPercent)) return 0;
  return Math.max(0, Math.min(100, Math.round(progressPercent)));
}

function calculateProgressWithinStage({
  stageStart,
  stageEnd,
  currentValue,
  totalValue,
}) {
  if (!Number.isFinite(totalValue) || totalValue <= 0) {
    return stageStart;
  }

  const ratio = Math.max(0, Math.min(1, currentValue / totalValue));
  return clampProgress(stageStart + (stageEnd - stageStart) * ratio);
}

async function updateRunProgress(runId, patch) {
  await updateIngestionRunStatus(runId, {
    ...patch,
    last_heartbeat_at: now(),
  });
}

async function setRunStage(runId, stage, patch = {}) {
  await updateRunProgress(runId, {
    status: stage,
    current_step: stage,
    progress_percent: PROGRESS_BY_STAGE[stage] ?? 0,
    status_message: STAGE_MESSAGE[stage] ?? null,
    ...patch,
  });
}

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
  await setRunStage(runId, "validating_schema", {
    started_at: now(),
    finished_at: null,
    error_message: null,
  });
}

async function markRunCompleted(runId, { rowsRead = 0, rowsLoaded = 0, rowsFailed = 0 } = {}) {
  await setRunStage(runId, "completed", {
    rows_read: rowsRead,
    rows_loaded: rowsLoaded,
    rows_failed: rowsFailed,
    finished_at: now(),
  });
}

async function markRunFailed(runId, error, progressPercent) {
  await updateRunProgress(runId, {
    status: "failed",
    current_step: "failed",
    progress_percent: progressPercent === undefined ? undefined : clampProgress(progressPercent),
    status_message: STAGE_MESSAGE.failed,
    error_message: toErrorMessage(error),
    finished_at: now(),
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

async function processIngestionRun(ingestionRunId) {
  console.info("Starting ingestion", { ingestionRunId });

  let run;
  let latestProgressPercent = PROGRESS_BY_STAGE.queued;

  try {
    run = await loadIngestionRunOrThrow(ingestionRunId);

    const rawFile = await loadRawBillingFileOrThrow(run.rawBillingFileId);
    assertRawFileLocation(rawFile);
    const resolvedFileFormat = resolveIngestionFileFormat(rawFile);

    await markRunRunning(run.id);
    latestProgressPercent = PROGRESS_BY_STAGE.validating_schema;

    await verifyRawFileExistsInS3({
      bucket: rawFile.rawStorageBucket,
      key: rawFile.rawStorageKey,
    });

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
      await markRunFailed(run.id, new Error(schemaValidationErrorMessage), latestProgressPercent);
      return;
    }

    await setRunStage(run.id, "reading_rows");
    latestProgressPercent = PROGRESS_BY_STAGE.reading_rows;

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

    await updateRunProgress(run.id, {
      rows_read: rawRows.length,
      total_rows_estimated: rawRows.length,
      progress_percent: PROGRESS_BY_STAGE.reading_rows,
      status_message: STAGE_MESSAGE.reading_rows,
    });

    await setRunStage(run.id, "normalizing");
    latestProgressPercent = PROGRESS_BY_STAGE.normalizing;

    const totalRowsEstimated = rawRows.length;
    const normalizedRows = [];
    for (const [index, rawRow] of rawRows.entries()) {
      normalizedRows.push(normalizeRowToCanonical(rawRow, validation.canonicalHeaderMap));
      if (index % 200 === 0 || index + 1 === totalRowsEstimated) {
        latestProgressPercent = calculateProgressWithinStage({
          stageStart: PROGRESS_BY_STAGE.reading_rows,
          stageEnd: PROGRESS_BY_STAGE.normalizing,
          currentValue: index + 1,
          totalValue: totalRowsEstimated,
        });
        await updateRunProgress(run.id, {
          progress_percent: latestProgressPercent,
          status_message: STAGE_MESSAGE.normalizing,
          total_rows_estimated: totalRowsEstimated,
        });
      }
    }

    await setRunStage(run.id, "upserting_dimensions", {
      total_rows_estimated: totalRowsEstimated,
      rows_loaded: 0,
      rows_failed: 0,
    });
    latestProgressPercent = PROGRESS_BY_STAGE.upserting_dimensions;

    let rowsRead = 0;
    let rowsLoaded = 0;
    let rowsFailed = 0;
    const totalRows = normalizedRows.length;

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
      }

      if (rowsRead === 1) {
        await setRunStage(run.id, "inserting_facts", {
          rows_read: rowsRead,
          rows_loaded: rowsLoaded,
          rows_failed: rowsFailed,
          total_rows_estimated: totalRows,
        });
        latestProgressPercent = PROGRESS_BY_STAGE.inserting_facts;
      } else if (rowsRead % 50 === 0 || rowsRead === totalRows) {
        latestProgressPercent = calculateProgressWithinStage({
          stageStart: PROGRESS_BY_STAGE.upserting_dimensions,
          stageEnd: PROGRESS_BY_STAGE.inserting_facts,
          currentValue: rowsRead,
          totalValue: totalRows,
        });
        await updateRunProgress(run.id, {
          rows_read: rowsRead,
          rows_loaded: rowsLoaded,
          rows_failed: rowsFailed,
          total_rows_estimated: totalRows,
          progress_percent: latestProgressPercent,
          status_message: STAGE_MESSAGE.inserting_facts,
        });
      }
    }

    await setRunStage(run.id, "finalizing", {
      rows_read: rowsRead,
      rows_loaded: rowsLoaded,
      rows_failed: rowsFailed,
      total_rows_estimated: totalRows,
    });

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
      await markRunFailed(run.id, error, latestProgressPercent);
    } catch (markError) {
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

export {
  processIngestionRun,
  loadIngestionRunOrThrow,
  loadRawBillingFileOrThrow,
  verifyRawFileExistsInS3,
  markRunRunning,
  markRunCompleted,
  markRunFailed,
};
