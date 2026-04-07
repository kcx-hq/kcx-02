/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

import env from "../../../config/env.js";
import { NotFoundError } from "../../../errors/http-errors.js";
import { RawBillingFile } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { mapFactCostLineItem } from "../mappers/raw_focus_to_dimensions.mapper.js";
import { processAwsExportParquetRun } from "./aws-export-parquet.processor.js";
import {
  createIngestionDimensionCache,
  primeDimensionCacheForChunk,
  resolveDimensionsWithCache,
} from "./dimension-upsert.service.js";
import {
  detectFileFormatFromKey,
  readBillingRowChunks,
  readCsvHeaders,
  readParquetSchemaColumns,
} from "./file-reader.service.js";
import { insertFactCostLineItemsBatch } from "./fact-cost-line-item.service.js";
import { getIngestionRunFiles } from "./ingestion-run-file.service.js";
import { recordIngestionRowErrors } from "./ingestion-row-error.service.js";
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
  completed_with_warnings: 100,
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
  completed_with_warnings: "Billing data is ready with warnings",
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

function createProgressUpdater(runId, minIntervalMs) {
  let lastProgressUpdateAt = 0;

  return async (patch, { force = false } = {}) => {
    const timestamp = Date.now();
    if (!force && timestamp - lastProgressUpdateAt < minIntervalMs) {
      return false;
    }

    await updateRunProgress(runId, patch);
    lastProgressUpdateAt = Date.now();
    return true;
  };
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

async function markRunCompleted(
  runId,
  { rowsRead = 0, rowsLoaded = 0, rowsFailed = 0, warningMessage = null } = {},
) {
  const status = rowsFailed > 0 ? "completed_with_warnings" : "completed";
  await setRunStage(runId, status, {
    rows_read: rowsRead,
    rows_loaded: rowsLoaded,
    rows_failed: rowsFailed,
    error_message: warningMessage,
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

function buildRowErrorFromException({
  runId,
  rawBillingFileId,
  rowNumber,
  rawRow,
  error,
  fallbackCode = "row_transform_error",
}) {
  const errorCode =
    error && typeof error === "object" && "code" in error && error.code ? String(error.code) : fallbackCode;
  const errorMessage = toErrorMessage(error);

  return {
    ingestionRunId: runId,
    rawBillingFileId,
    rowNumber,
    errorCode,
    errorMessage,
    rawRowJson: rawRow ?? null,
  };
}

function summarizeTopFailureReasons(reasonCounts, limit = 3) {
  return Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([reason, count]) => `${reason} (${count})`);
}

function resolveIngestionFlow(runFiles) {
  const files = Array.isArray(runFiles) ? runFiles : [];
  const manifestLinks = files.filter((fileLink) => fileLink.fileRole === "manifest");
  const dataLinks = files.filter((fileLink) => fileLink.fileRole === "data");

  if (manifestLinks.length > 0 && dataLinks.length === 0) {
    throw new Error("Invalid ingestion run: manifest file link exists but no data file links were found");
  }

  return {
    flow: manifestLinks.length > 0 ? "aws_export_manifest" : "raw_file_stream",
    manifestLinksCount: manifestLinks.length,
    dataLinksCount: dataLinks.length,
  };
}

async function processIngestionRun(ingestionRunId) {
  console.info("Starting ingestion", { ingestionRunId });
  logger.info("Ingestion orchestrator: step=start", { ingestionRunId });

  let run;
  let latestProgressPercent = PROGRESS_BY_STAGE.queued;
  let rowsRead = 0;
  let rowsLoaded = 0;
  let rowsFailed = 0;

  try {
    logger.info("Ingestion orchestrator: step=load_run:start", { ingestionRunId });
    run = await loadIngestionRunOrThrow(ingestionRunId);
    logger.info("Ingestion orchestrator: step=load_run:done", {
      ingestionRunId,
      runId: run.id,
      rawBillingFileId: run.rawBillingFileId,
    });

    logger.info("Ingestion orchestrator: step=load_run_files:start", { runId: run.id });
    const runFiles = await getIngestionRunFiles(run.id);
    const hasManifestLinkedRun = Array.isArray(runFiles) && runFiles.some((fileLink) => fileLink.fileRole === "manifest");
    if (hasManifestLinkedRun) {
      await processAwsExportParquetRun({ run });
      logger.info("Ingestion orchestrator: step=delegate_aws_parquet:done", { runId: run.id });
      return;
    }

    logger.info("Ingestion orchestrator: step=load_raw_file:start", { rawBillingFileId: run.rawBillingFileId });
    const rawFile = await loadRawBillingFileOrThrow(run.rawBillingFileId);
    assertRawFileLocation(rawFile);
    const resolvedFileFormat = resolveIngestionFileFormat(rawFile);
    console.log("[S3-UPLOAD-DEBUG][INGESTION][START]", {
      tenantId: rawFile.tenantId ?? null,
      userId: null,
      sessionId: null,
      ingestionRunId: String(run.id),
      runId: String(run.id),
      rawFileId: String(run.rawBillingFileId),
      bucket: rawFile.rawStorageBucket,
      key: rawFile.rawStorageKey,
      format: resolvedFileFormat,
    });
    console.log("[S3-UPLOAD-DEBUG][INGESTION][FORMAT]", {
      tenantId: rawFile.tenantId ?? null,
      userId: null,
      sessionId: null,
      ingestionRunId: String(run.id),
      key: rawFile.rawStorageKey,
      detectedFormat: resolvedFileFormat,
    });
    const chunkSize = env.billingIngestionBatchSize;
    const minStatusUpdateIntervalMs = env.billingIngestionStatusMinIntervalMs;

    const updateProgressThrottled = createProgressUpdater(run.id, minStatusUpdateIntervalMs);

    logger.info("Ingestion orchestrator: step=mark_running:start", { runId: run.id });
    await markRunRunning(run.id);
    latestProgressPercent = PROGRESS_BY_STAGE.validating_schema;
    logger.info("Ingestion orchestrator: step=mark_running:done", { runId: run.id });

    console.log("[S3-UPLOAD-DEBUG][INGESTION][S3_HEAD]", {
      tenantId: rawFile.tenantId ?? null,
      userId: null,
      sessionId: null,
      ingestionRunId: String(run.id),
      bucket: rawFile.rawStorageBucket,
      key: rawFile.rawStorageKey,
    });
    try {
      await verifyRawFileExistsInS3({
        bucket: rawFile.rawStorageBucket,
        key: rawFile.rawStorageKey,
      });
    } catch (error) {
      console.error("[S3-UPLOAD-DEBUG][INGESTION][S3_HEAD_FAILED]", {
        tenantId: rawFile.tenantId ?? null,
        userId: null,
        sessionId: null,
        ingestionRunId: String(run.id),
        bucket: rawFile.rawStorageBucket,
        key: rawFile.rawStorageKey,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    console.log("[S3-UPLOAD-DEBUG][INGESTION][S3_READ_START]", {
      tenantId: rawFile.tenantId ?? null,
      userId: null,
      sessionId: null,
      ingestionRunId: String(run.id),
      bucket: rawFile.rawStorageBucket,
      key: rawFile.rawStorageKey,
      stage: "schema_headers",
    });
    let headers;
    try {
      headers =
        resolvedFileFormat === "csv"
          ? await readCsvHeaders({
              bucket: rawFile.rawStorageBucket,
              key: rawFile.rawStorageKey,
            })
          : await readParquetSchemaColumns({
              bucket: rawFile.rawStorageBucket,
              key: rawFile.rawStorageKey,
            });
    } catch (error) {
      console.error("[S3-UPLOAD-DEBUG][INGESTION][S3_READ_FAILED]", {
        tenantId: rawFile.tenantId ?? null,
        userId: null,
        sessionId: null,
        ingestionRunId: String(run.id),
        bucket: rawFile.rawStorageBucket,
        key: rawFile.rawStorageKey,
        error: error instanceof Error ? error.message : String(error),
        stage: "schema_headers",
      });
      throw error;
    }

    logger.info("Ingestion orchestrator: step=validate_schema:start", { runId: run.id });
    const validation = validateHeaders(headers);
    logger.info("Ingestion orchestrator: step=validate_schema:done", {
      runId: run.id,
      validationSuccess: validation.success,
      missingRequiredColumns: validation.missingRequiredColumns?.length ?? 0,
      unknownHeaders: validation.unknownHeaders?.length ?? 0,
      ambiguousHeaders: validation.ambiguousHeaders?.length ?? 0,
    });
    if (!validation.success) {
      const schemaValidationErrorMessage = buildSchemaValidationErrorMessage(validation);
      await markRunFailed(run.id, new Error(schemaValidationErrorMessage), latestProgressPercent);
      logger.error("Ingestion orchestrator: step=validate_schema:failed", {
        runId: run.id,
        schemaValidationErrorMessage,
      });
      return;
    }

    logger.info("Ingestion orchestrator: step=set_stage:reading_rows", { runId: run.id });
    await setRunStage(run.id, "reading_rows");
    latestProgressPercent = PROGRESS_BY_STAGE.reading_rows;

    logger.info("Ingestion orchestrator: step=set_stage:normalizing", { runId: run.id });
    await setRunStage(run.id, "normalizing", {
      rows_read: 0,
      rows_loaded: 0,
      rows_failed: 0,
      total_rows_estimated: null,
    });
    latestProgressPercent = PROGRESS_BY_STAGE.normalizing;

    logger.info("Ingestion orchestrator: step=set_stage:upserting_dimensions", { runId: run.id });
    await setRunStage(run.id, "upserting_dimensions", {
      rows_read: 0,
      rows_loaded: 0,
      rows_failed: 0,
      total_rows_estimated: null,
    });
    latestProgressPercent = PROGRESS_BY_STAGE.upserting_dimensions;

    const dimensionCache = createIngestionDimensionCache();

    let chunkIndex = 0;
    let movedToInsertStage = false;
    let failedRowWriteErrors = 0;
    const failureReasonCounts = {};

    console.log("[S3-UPLOAD-DEBUG][INGESTION][S3_READ_START]", {
      tenantId: rawFile.tenantId ?? null,
      userId: null,
      sessionId: null,
      ingestionRunId: String(run.id),
      bucket: rawFile.rawStorageBucket,
      key: rawFile.rawStorageKey,
      stage: "rows_stream",
    });

    const rowChunkIterator = readBillingRowChunks({
      bucket: rawFile.rawStorageBucket,
      key: rawFile.rawStorageKey,
      fileFormat: resolvedFileFormat,
      chunkSize,
    })[Symbol.asyncIterator]();
    logger.info("Ingestion orchestrator: step=row_iteration:start", {
      runId: run.id,
      chunkSize,
      fileFormat: resolvedFileFormat,
    });

    try {
      while (true) {
        const chunkReadStartedAt = Date.now();
        const { value: rawChunk, done } = await rowChunkIterator.next();
        const readMs = Date.now() - chunkReadStartedAt;

        if (done) {
          break;
        }

        chunkIndex += 1;
        rowsRead += rawChunk.length;

        const normalizeStartedAt = Date.now();
        const normalizedChunk = rawChunk.map((rawRow) =>
          normalizeRowToCanonical(rawRow, validation.canonicalHeaderMap),
        );
        const normalizeMs = Date.now() - normalizeStartedAt;
        const chunkStartRowNumber = rowsRead - rawChunk.length + 1;
        const rowErrorsForChunk = [];

        const dimensionStartedAt = Date.now();
        let dimensionCachePrimed = true;
        try {
          await primeDimensionCacheForChunk({
            rawRows: normalizedChunk,
            tenantId: rawFile.tenantId,
            providerId: rawFile.cloudProviderId,
            cache: dimensionCache,
          });
        } catch (cachePrimeError) {
          dimensionCachePrimed = false;
          console.warn("Dimension cache priming failed; continuing with per-row resolution", {
            ingestionRunId: run.id,
            chunkIndex,
            chunkSize: normalizedChunk.length,
            reason: toErrorMessage(cachePrimeError),
          });
        }

      const factRows = [];
      for (const [chunkRowIndex, normalizedRow] of normalizedChunk.entries()) {
        const rowNumber = chunkStartRowNumber + chunkRowIndex;
        try {
          const {
            billingAccountKey,
            subAccountKey,
            regionKey,
            serviceKey,
            resourceKey,
            skuKey,
            chargeKey,
            usageDateKey,
            billingPeriodStartDateKey,
            billingPeriodEndDateKey,
          } = await resolveDimensionsWithCache({
            rawRow: normalizedRow,
            tenantId: rawFile.tenantId,
            providerId: rawFile.cloudProviderId,
            cache: dimensionCache,
          });

          const factPayload = mapFactCostLineItem({
            tenant_id: rawFile.tenantId,
            billing_source_id: rawFile.billingSourceId,
            ingestion_run_id: run.id,
            provider_id: rawFile.cloudProviderId,
            billing_account_key: billingAccountKey,
            sub_account_key: subAccountKey,
            region_key: regionKey,
            service_key: serviceKey,
            resource_key: resourceKey,
            sku_key: skuKey,
            charge_key: chargeKey,
            usage_date_key: usageDateKey,
            billing_period_start_date_key: billingPeriodStartDateKey,
            billing_period_end_date_key: billingPeriodEndDateKey,
            raw_row: normalizedRow,
          });

          factRows.push({
            rowNumber,
            rawRow: normalizedRow,
            createPayload: {
              tenantId: factPayload.tenant_id,
              billingSourceId: factPayload.billing_source_id,
              ingestionRunId: factPayload.ingestion_run_id,
              providerId: factPayload.provider_id,
              billingAccountKey: factPayload.billing_account_key,
              subAccountKey: factPayload.sub_account_key,
              regionKey: factPayload.region_key,
              serviceKey: factPayload.service_key,
              resourceKey: factPayload.resource_key,
              skuKey: factPayload.sku_key,
              chargeKey: factPayload.charge_key,
              usageDateKey: factPayload.usage_date_key,
              billingPeriodStartDateKey: factPayload.billing_period_start_date_key,
              billingPeriodEndDateKey: factPayload.billing_period_end_date_key,
              billedCost: factPayload.billed_cost,
              effectiveCost: factPayload.effective_cost,
              listCost: factPayload.list_cost,
              usageStartTime: factPayload.usage_start_time,
              usageEndTime: factPayload.usage_end_time,
              lineItemType: factPayload.line_item_type,
              pricingTerm: factPayload.pricing_term,
              publicOnDemandCost: factPayload.public_on_demand_cost,
              discountAmount: factPayload.discount_amount,
              creditAmount: factPayload.credit_amount,
              refundAmount: factPayload.refund_amount,
              taxCost: factPayload.tax_cost,
              consumedQuantity: factPayload.consumed_quantity,
              pricingQuantity: factPayload.pricing_quantity,
              tagsJson: factPayload.tags_json,
            },
          });
        } catch (err) {
          rowsFailed += 1;
          const rowError = buildRowErrorFromException({
            runId: run.id,
            rawBillingFileId: run.rawBillingFileId,
            rowNumber,
            rawRow: normalizedRow,
            error: err,
          });
          rowErrorsForChunk.push(rowError);
          failureReasonCounts[rowError.errorCode] = (failureReasonCounts[rowError.errorCode] ?? 0) + 1;
          console.warn("Row transform failed", {
            ingestionRunId: run.id,
            chunkIndex,
            chunkRowIndex,
            rowNumber,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      const dimensionMs = Date.now() - dimensionStartedAt;

      let factInsertMs = 0;
      if (factRows.length > 0) {
        if (!movedToInsertStage) {
          await setRunStage(run.id, "inserting_facts", {
            rows_read: rowsRead,
            rows_loaded: rowsLoaded,
            rows_failed: rowsFailed,
            total_rows_estimated: rowsRead,
          });
          movedToInsertStage = true;
          latestProgressPercent = PROGRESS_BY_STAGE.inserting_facts;
        }

        const factInsertStartedAt = Date.now();
        const factInsertResult = await insertFactCostLineItemsBatch({
          factRows,
          ingestionRunId: run.id,
        });
        factInsertMs = Date.now() - factInsertStartedAt;
        rowsLoaded += factInsertResult.insertedCount;

        if (factInsertResult.batchFallbackError) {
          console.warn("Fact batch fallback summary", {
            ingestionRunId: run.id,
            chunkIndex,
            batchSize: factRows.length,
            insertedCount: factInsertResult.insertedCount,
            failedCount: factInsertResult.failedRows.length,
            errorCode: factInsertResult.batchFallbackError.errorCode,
          });
        }

        if (factInsertResult.failedRows.length > 0) {
          rowsFailed += factInsertResult.failedRows.length;
          for (const failedRow of factInsertResult.failedRows) {
            rowErrorsForChunk.push({
              ingestionRunId: run.id,
              rawBillingFileId: run.rawBillingFileId,
              rowNumber: failedRow.rowNumber,
              errorCode: failedRow.errorCode,
              errorMessage: failedRow.errorMessage,
              rawRowJson: failedRow.rawRow ?? null,
            });
            failureReasonCounts[failedRow.errorCode] = (failureReasonCounts[failedRow.errorCode] ?? 0) + 1;
          }
        }
      }

      if (rowErrorsForChunk.length > 0) {
        try {
          await recordIngestionRowErrors({ rowErrors: rowErrorsForChunk });
        } catch (rowErrorWriteFailure) {
          failedRowWriteErrors += rowErrorsForChunk.length;
          console.error("Failed to persist ingestion row errors", {
            ingestionRunId: run.id,
            chunkIndex,
            rowErrorCount: rowErrorsForChunk.length,
            reason: toErrorMessage(rowErrorWriteFailure),
          });
        }
      }

      latestProgressPercent = calculateProgressWithinStage({
        stageStart: PROGRESS_BY_STAGE.upserting_dimensions,
        stageEnd: PROGRESS_BY_STAGE.inserting_facts,
        currentValue: rowsLoaded + rowsFailed,
        totalValue: rowsRead,
      });

      const statusUpdateStartedAt = Date.now();
      await updateProgressThrottled(
        {
          rows_read: rowsRead,
          rows_loaded: rowsLoaded,
          rows_failed: rowsFailed,
          total_rows_estimated: rowsRead,
          progress_percent: latestProgressPercent,
          status_message: STAGE_MESSAGE.inserting_facts,
        },
        { force: chunkIndex === 1 },
      );
      const statusUpdateMs = Date.now() - statusUpdateStartedAt;

        console.info("Ingestion chunk processed", {
          ingestionRunId: run.id,
          chunk_index: chunkIndex,
          chunk_size: rawChunk.length,
          rows_read: rowsRead,
          rows_loaded: rowsLoaded,
          rows_failed: rowsFailed,
          chunk_rejected_rows: rowErrorsForChunk.length,
          dimension_cache_primed: dimensionCachePrimed,
          read_ms: readMs,
          normalize_ms: normalizeMs,
          dimension_ms: dimensionMs,
          fact_insert_ms: factInsertMs,
          status_update_ms: statusUpdateMs,
        });
      }
    } catch (error) {
      console.error("[S3-UPLOAD-DEBUG][INGESTION][S3_READ_FAILED]", {
        tenantId: rawFile.tenantId ?? null,
        userId: null,
        sessionId: null,
        ingestionRunId: String(run.id),
        bucket: rawFile.rawStorageBucket,
        key: rawFile.rawStorageKey,
        error: error instanceof Error ? error.message : String(error),
        stage: "rows_stream",
      });
      throw error;
    }

    await updateProgressThrottled(
      {
        rows_read: rowsRead,
        rows_loaded: rowsLoaded,
        rows_failed: rowsFailed,
        total_rows_estimated: rowsRead,
        progress_percent: PROGRESS_BY_STAGE.inserting_facts,
        status_message: STAGE_MESSAGE.inserting_facts,
      },
      { force: true },
    );

    await setRunStage(run.id, "finalizing", {
      rows_read: rowsRead,
      rows_loaded: rowsLoaded,
      rows_failed: rowsFailed,
      total_rows_estimated: rowsRead,
    });

    const topReasons = summarizeTopFailureReasons(failureReasonCounts);
    if (rowsLoaded === 0 && rowsFailed > 0) {
      const allRowsFailedMessage =
        topReasons.length > 0
          ? `Ingestion failed: all rows were rejected. Top reasons: ${topReasons.join(", ")}`
          : "Ingestion failed: all rows were rejected.";
      await markRunFailed(run.id, new Error(allRowsFailedMessage), PROGRESS_BY_STAGE.finalizing);
      console.error("Ingestion failed after processing with zero loaded rows", {
        ingestionRunId: run.id,
        rowsRead,
        rowsLoaded,
        rowsFailed,
        top_failure_reasons: topReasons,
      });
      logger.error("Ingestion orchestrator: step=finalize:all_rows_failed", {
        runId: run.id,
        rowsRead,
        rowsLoaded,
        rowsFailed,
        topReasons,
      });
      return;
    }

    const warningMessage =
      rowsFailed > 0
        ? `${rowsFailed} rows failed validation/insert and were skipped${
            topReasons.length > 0 ? `. Top reasons: ${topReasons.join(", ")}` : ""
          }`
        : null;

    await markRunCompleted(run.id, {
      rowsRead,
      rowsLoaded,
      rowsFailed,
      warningMessage,
    });

    console.log("[S3-UPLOAD-DEBUG][INGESTION][END]", {
      tenantId: rawFile.tenantId ?? null,
      userId: null,
      sessionId: null,
      ingestionRunId: String(run.id),
      runId: String(run.id),
      bucket: rawFile.rawStorageBucket,
      key: rawFile.rawStorageKey,
      status: rowsFailed > 0 ? "completed_with_warnings" : "completed",
      rowsProcessed: rowsRead,
      rowsFailed,
    });

    console.info("Ingestion completed", {
      ingestionRunId: run.id,
      rowsRead,
      rowsLoaded,
      rowsFailed,
      failed_row_error_writes: failedRowWriteErrors,
      top_failure_reasons: topReasons,
    });
    logger.info("Ingestion orchestrator: step=completed", {
      runId: run.id,
      rowsRead,
      rowsLoaded,
      rowsFailed,
      failedRowWriteErrors,
      topReasons,
    });
  } catch (error) {
    if (!run?.id) {
      logger.error("Ingestion orchestrator: step=failed_before_run_loaded", {
        ingestionRunId,
        reason: toErrorMessage(error),
      });
      throw error;
    }

    const failedRawFile =
      run?.rawBillingFileId ? await loadRawBillingFileOrThrow(run.rawBillingFileId).catch(() => null) : null;

    try {
      await markRunFailed(run.id, error, latestProgressPercent);
      console.log("[S3-UPLOAD-DEBUG][INGESTION][END]", {
        tenantId: failedRawFile?.tenantId ?? null,
        userId: null,
        sessionId: null,
        ingestionRunId: String(run.id),
        runId: String(run.id),
        bucket: failedRawFile?.rawStorageBucket ?? null,
        key: failedRawFile?.rawStorageKey ?? null,
        status: "failed",
        rowsProcessed: rowsRead,
        rowsFailed,
      });
    } catch (markError) {
      console.error("Failed to mark ingestion run as failed", {
        ingestionRunId: run.id,
        reason: toErrorMessage(markError),
        originalReason: toErrorMessage(error),
      });
      logger.error("Ingestion orchestrator: step=mark_failed:error", {
        runId: run.id,
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

