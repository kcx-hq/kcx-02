/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { BillingSource, CloudConnectionV2 } from "../../../models/index.js";
import env from "../../../config/env.js";
import { logger } from "../../../utils/logger.js";
import { downloadExportFile } from "../../cloud-connections/aws/infrastructure/aws-export-reader.service.js";
import type { AwsParquetSchemaValidationResult } from "../../cloud-connections/aws/exports/aws-export-ingestion.types.js";
import { RAW_COLUMNS, mapFactCostLineItem } from "../mappers/raw_focus_to_dimensions.mapper.js";
import {
  createIngestionDimensionCache,
  primeDimensionCacheForChunk,
  resolveDimensionsWithCache,
} from "./dimension-upsert.service.js";
import { parseParquetSchemaColumnsFromBuffer, readParquetRowChunksFromBuffer } from "./file-reader.service.js";
import { insertFactCostLineItemsBatch } from "./fact-cost-line-item.service.js";
import { getIngestionRunFiles } from "./ingestion-run-file.service.js";
import { recordIngestionRowErrors } from "./ingestion-row-error.service.js";
import { updateIngestionRunStatus } from "./ingestion.service.js";
import {
  buildSchemaValidationErrorMessage,
  normalizeRowToCanonical,
  validateHeaders,
} from "./schema-validator.service.js";
import { upsertCostAggregationsForRun } from "./cost-aggregation.service.js";
import {
  syncAwsIdleRecommendationsAfterIngestion,
  syncAwsRightsizingRecommendationsAfterIngestion,
} from "../../dashboard/optimization/recommendation-sync/sync.service.js";
import { createTagDimensionCache, resolveFactTagId } from "./dim-tag.service.js";
import { assertTagDimensionSchemaReady } from "./ingestion-schema-guard.service.js";

const STAGE_MESSAGE = {
  validating_schema: "Validating manifest and parquet schema",
  reading_rows: "Reading parquet files",
  normalizing: "Normalizing parquet rows",
  upserting_dimensions: "Preparing dimensions",
  inserting_facts: "Loading fact cost rows",
  finalizing: "Finalizing ingestion",
  completed: "Billing data is ready",
  completed_with_warnings: "Billing data is ready with warnings",
  failed: "AWS export ingestion failed",
};

const PROGRESS_BY_STAGE = {
  validating_schema: 10,
  reading_rows: 20,
  normalizing: 40,
  upserting_dimensions: 60,
  inserting_facts: 85,
  finalizing: 95,
  completed: 100,
  completed_with_warnings: 100,
};

const now = () => new Date();

const toErrorMessage = (error) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Unknown AWS parquet ingestion error";
};

const setRunState = async (runId, patch) => {
  await updateIngestionRunStatus(runId, {
    last_heartbeat_at: now(),
    ...patch,
  });
};

const markRunFailed = async (runId, error, progressPercent = PROGRESS_BY_STAGE.finalizing) => {
  await setRunState(runId, {
    status: "failed",
    current_step: "failed",
    progress_percent: progressPercent,
    status_message: STAGE_MESSAGE.failed,
    error_message: toErrorMessage(error),
    finished_at: now(),
  });
};

const buildRowErrorFromException = ({ runId, rawBillingFileId, rowNumber, rawRow, error }) => ({
  ingestionRunId: runId,
  rawBillingFileId,
  rowNumber,
  errorCode: error && typeof error === "object" && "code" in error && error.code ? String(error.code) : "row_transform_error",
  errorMessage: toErrorMessage(error),
  rawRowJson: rawRow ?? null,
});

const buildSchemaResult = ({ rawBillingFileId, key, validation }) => ({
  success: Boolean(validation?.success),
  rawBillingFileId: String(rawBillingFileId),
  key,
  matchedCanonicalColumns: Object.keys(validation?.canonicalHeaderMap ?? {}),
  missingRequiredColumns: Array.isArray(validation?.missingRequiredColumns) ? validation.missingRequiredColumns : [],
  unknownColumns: Array.isArray(validation?.unknownHeaders) ? validation.unknownHeaders : [],
  ambiguousColumns: Array.isArray(validation?.ambiguousHeaders)
    ? validation.ambiguousHeaders.map((item) => ({
        header: String(item?.header ?? ""),
        candidates: Array.isArray(item?.candidates) ? item.candidates : [],
      }))
    : [],
});

export async function processAwsExportParquetRun({ run }) {
  await assertTagDimensionSchemaReady();

  const runId = String(run.id);
  const batchSize = env.billingIngestionBatchSize;
  const rowConcurrency = Math.max(1, env.billingIngestionRowConcurrency);
  logger.info("AWS parquet processor: step=start", { runId, batchSize });

  await setRunState(runId, {
    status: "validating_schema",
    current_step: "validating_schema",
    progress_percent: PROGRESS_BY_STAGE.validating_schema,
    status_message: STAGE_MESSAGE.validating_schema,
    started_at: now(),
    finished_at: null,
    error_message: null,
  });

  try {
    const source = await BillingSource.findByPk(String(run.billingSourceId));
    if (!source) {
      throw new Error(`Billing source not found for run ${runId}`);
    }

    const connection = await CloudConnectionV2.findByPk(String(source.cloudConnectionId));
    if (!connection) {
      throw new Error(`Cloud connection not found for billing source ${source.id}`);
    }

    const roleArn = String(connection.billingRoleArn ?? "").trim();
    const region = String(connection.exportRegion ?? connection.region ?? "").trim();
    if (!roleArn || !region) {
      throw new Error("AWS connection is missing billingRoleArn/exportRegion");
    }

    const linkedFiles = await getIngestionRunFiles(runId);
    const manifestLinks = linkedFiles.filter((link) => link.fileRole === "manifest");
    const dataLinks = linkedFiles.filter((link) => link.fileRole === "data");

    if (manifestLinks.length !== 1) {
      throw new Error(`Expected exactly one manifest link, found ${manifestLinks.length}`);
    }

    if (dataLinks.length === 0) {
      throw new Error("No parquet data files linked to ingestion run");
    }

    const schemaValidationResults = [];
    const canonicalHeaderMapsByRawFileId = new Map();
    const parquetBuffersByRawFileId = new Map();

    for (const dataLink of dataLinks) {
      const rawFile = dataLink.RawBillingFile;
      if (!rawFile?.rawStorageBucket || !rawFile?.rawStorageKey) {
        throw new Error(`Raw file ${dataLink.rawBillingFileId} is missing raw storage location`);
      }
      logger.info("AWS parquet processor: step=download_file:start", {
        runId,
        rawBillingFileId: String(rawFile.id),
        bucket: rawFile.rawStorageBucket,
        key: rawFile.rawStorageKey,
      });

      const base64FileBody = await downloadExportFile({
        roleArn,
        externalId: connection.externalId ?? null,
        region,
        bucket: rawFile.rawStorageBucket,
        key: rawFile.rawStorageKey,
      });

      const parquetBuffer = Buffer.from(base64FileBody, "base64");
      logger.info("AWS parquet processor: step=download_file:done", {
        runId,
        rawBillingFileId: String(rawFile.id),
        bytes: parquetBuffer.length,
      });
      parquetBuffersByRawFileId.set(String(rawFile.id), parquetBuffer);

      logger.info("AWS parquet processor: step=parse_schema:start", {
        runId,
        rawBillingFileId: String(rawFile.id),
      });
      const parquetColumns = await parseParquetSchemaColumnsFromBuffer(parquetBuffer);
      logger.info("AWS parquet processor: step=parse_schema:done", {
        runId,
        rawBillingFileId: String(rawFile.id),
        columnCount: parquetColumns.length,
      });
      const validation = validateHeaders(parquetColumns);
      const schemaResult = buildSchemaResult({
        rawBillingFileId: String(rawFile.id),
        key: rawFile.rawStorageKey,
        validation,
      });

      schemaValidationResults.push(schemaResult);
      canonicalHeaderMapsByRawFileId.set(String(rawFile.id), validation.canonicalHeaderMap ?? {});

      if (!validation.success) {
        const schemaValidationErrorMessage = buildSchemaValidationErrorMessage(validation);
        throw new Error(`Schema validation failed for ${rawFile.rawStorageKey}: ${schemaValidationErrorMessage}`);
      }
    }

    await setRunState(runId, {
      status: "reading_rows",
      current_step: "reading_rows",
      progress_percent: PROGRESS_BY_STAGE.reading_rows,
      status_message: STAGE_MESSAGE.reading_rows,
    });

    const dimensionCache = createIngestionDimensionCache();
    const tagCache = createTagDimensionCache();
    const failedReasonCounts = {};
    const allRowErrors = [];

    let rowsRead = 0;
    let rowsLoaded = 0;
    let rowsFailed = 0;
    let processedDataFiles = 0;

    for (const dataLink of dataLinks) {
      const rawFile = dataLink.RawBillingFile;
      const rawFileId = String(rawFile.id);
      logger.info("AWS parquet processor: step=process_data_file:start", {
        runId,
        rawFileId,
        key: rawFile.rawStorageKey,
      });

      await setRunState(runId, {
        status: "normalizing",
        current_step: "normalizing",
        progress_percent: PROGRESS_BY_STAGE.normalizing,
        status_message: `Normalizing ${rawFile.rawStorageKey}`,
        rows_read: rowsRead,
        rows_loaded: rowsLoaded,
        rows_failed: rowsFailed,
      });

      const canonicalHeaderMap = canonicalHeaderMapsByRawFileId.get(rawFileId) ?? {};
      const parquetBuffer = parquetBuffersByRawFileId.get(rawFileId);
      if (!parquetBuffer) {
        throw new Error(`Parquet buffer missing for raw file ${rawFileId}`);
      }

      let chunkOffset = 0;
      let chunkIndex = 0;
      logger.info("AWS parquet processor: step=parse_chunks:start", {
        runId,
        rawFileId,
        batchSize,
      });
      for await (const chunk of readParquetRowChunksFromBuffer(parquetBuffer, batchSize)) {
        chunkIndex += 1;
        logger.info("AWS parquet processor: step=parse_chunks:chunk_received", {
          runId,
          rawFileId,
          chunkIndex,
          chunkSize: chunk.length,
          chunkOffset,
        });
        rowsRead += chunk.length;

        const cachePrimeStartedAt = Date.now();
        try {
          await primeDimensionCacheForChunk({
            rawRows: chunk,
            tenantId: rawFile.tenantId,
            providerId: rawFile.cloudProviderId,
            cache: dimensionCache,
          });
        } catch (error) {
          logger.warn("Dimension cache priming failed for AWS parquet chunk; fallback to per-row resolution", {
            ingestionRunId: runId,
            rawBillingFileId: rawFileId,
            reason: toErrorMessage(error),
          });
        }
        const cachePrimeMs = Date.now() - cachePrimeStartedAt;

        const mapRowsStartedAt = Date.now();
        const factRows = [];
        let chunkProcessedRows = 0;

        for (let index = 0; index < chunk.length; index += rowConcurrency) {
          const sliceStart = index;
          const slice = chunk.slice(sliceStart, sliceStart + rowConcurrency);
          const sliceResults = await Promise.all(
            slice.map(async (rawRow, localIndex) => {
              const chunkIndexPosition = sliceStart + localIndex;
              const rowNumber = chunkOffset + chunkIndexPosition + 1;
              try {
                const normalizedRow = normalizeRowToCanonical(rawRow, canonicalHeaderMap);
                const dimensions = await resolveDimensionsWithCache({
                  rawRow: normalizedRow,
                  tenantId: rawFile.tenantId,
                  providerId: rawFile.cloudProviderId,
                  cache: dimensionCache,
                });

                const factPayload = mapFactCostLineItem({
                  tenant_id: rawFile.tenantId,
                  billing_source_id: rawFile.billingSourceId,
                  ingestion_run_id: runId,
                  provider_id: rawFile.cloudProviderId,
                  billing_account_key: dimensions.billingAccountKey,
                  sub_account_key: dimensions.subAccountKey,
                  region_key: dimensions.regionKey,
                  service_key: dimensions.serviceKey,
                  resource_key: dimensions.resourceKey,
                  sku_key: dimensions.skuKey,
                  charge_key: dimensions.chargeKey,
                  tag_id: await resolveFactTagId({
                    tenantId: rawFile.tenantId,
                    providerId: rawFile.cloudProviderId,
                    rawTags: normalizedRow[RAW_COLUMNS.tags],
                    tagCache,
                  }),
                  usage_date_key: dimensions.usageDateKey,
                  billing_period_start_date_key: dimensions.billingPeriodStartDateKey,
                  billing_period_end_date_key: dimensions.billingPeriodEndDateKey,
                  raw_row: normalizedRow,
                });

                return {
                  ok: true,
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
                    tagId: factPayload.tag_id,
                  },
                };
              } catch (error) {
                return {
                  ok: false,
                  rowNumber,
                  rawRow,
                  error,
                };
              }
            }),
          );

          for (const result of sliceResults) {
            if (result.ok) {
              factRows.push({
                rowNumber: result.rowNumber,
                rawRow: result.rawRow,
                createPayload: result.createPayload,
              });
              continue;
            }

            rowsFailed += 1;
            const rowError = buildRowErrorFromException({
              runId,
              rawBillingFileId: rawFileId,
              rowNumber: result.rowNumber,
              rawRow: result.rawRow,
              error: result.error,
            });
            allRowErrors.push(rowError);
            failedReasonCounts[rowError.errorCode] = (failedReasonCounts[rowError.errorCode] ?? 0) + 1;
          }

          chunkProcessedRows += slice.length;
          if (chunkProcessedRows % Math.max(100, rowConcurrency) === 0 || chunkProcessedRows === chunk.length) {
            await setRunState(runId, {
              status: "normalizing",
              current_step: "normalizing",
              rows_read: rowsRead,
              rows_loaded: rowsLoaded,
              rows_failed: rowsFailed,
              total_rows_estimated: rowsRead,
              progress_percent: PROGRESS_BY_STAGE.normalizing,
              status_message: `Normalizing ${rawFile.rawStorageKey} (${chunkProcessedRows}/${chunk.length})`,
              last_heartbeat_at: now(),
            });
          }
        }
        const mapRowsMs = Date.now() - mapRowsStartedAt;

        const insertStartedAt = Date.now();
        if (factRows.length > 0) {
          await setRunState(runId, {
            status: "inserting_facts",
            current_step: "inserting_facts",
            progress_percent: PROGRESS_BY_STAGE.inserting_facts,
            status_message: STAGE_MESSAGE.inserting_facts,
          });

          const insertResult = await insertFactCostLineItemsBatch({
            factRows,
            ingestionRunId: runId,
          });

          rowsLoaded += insertResult.insertedCount;

          if (insertResult.batchFallbackError) {
            logger.warn("AWS parquet processor: step=fact_insert_batch_fallback", {
              runId,
              rawFileId,
              chunkIndex,
              batchSize: factRows.length,
              insertedCount: insertResult.insertedCount,
              failedCount: insertResult.failedRows.length,
              errorCode: insertResult.batchFallbackError.errorCode,
              errorMessage: insertResult.batchFallbackError.errorMessage,
            });
          }

          if (insertResult.failedRows.length > 0) {
            rowsFailed += insertResult.failedRows.length;
            for (const failedRow of insertResult.failedRows) {
              const rowError = {
                ingestionRunId: runId,
                rawBillingFileId: rawFileId,
                rowNumber: failedRow.rowNumber,
                errorCode: failedRow.errorCode,
                errorMessage: failedRow.errorMessage,
                rawRowJson: failedRow.rawRow ?? null,
              };

              allRowErrors.push(rowError);
              failedReasonCounts[rowError.errorCode] = (failedReasonCounts[rowError.errorCode] ?? 0) + 1;
            }
          }
        }
        const insertMs = Date.now() - insertStartedAt;

        await setRunState(runId, {
          rows_read: rowsRead,
          rows_loaded: rowsLoaded,
          rows_failed: rowsFailed,
          total_rows_estimated: rowsRead,
          status_message: STAGE_MESSAGE.inserting_facts,
          progress_percent: PROGRESS_BY_STAGE.inserting_facts,
        });

        logger.info("AWS parquet processor: step=parse_chunks:chunk_processed", {
          runId,
          rawFileId,
          chunkIndex,
          chunkSize: chunk.length,
          cachePrimeMs,
          mapRowsMs,
          insertMs,
          rowsRead,
          rowsLoaded,
          rowsFailed,
        });

        chunkOffset += chunk.length;
      }
      logger.info("AWS parquet processor: step=parse_chunks:done", {
        runId,
        rawFileId,
        chunkCount: chunkIndex,
        rowsRead,
        rowsLoaded,
        rowsFailed,
      });

      processedDataFiles += 1;

      await setRunState(runId, {
        progress_percent: Math.min(
          PROGRESS_BY_STAGE.inserting_facts,
          Math.round((processedDataFiles / dataLinks.length) * PROGRESS_BY_STAGE.inserting_facts),
        ),
      });
    }

    if (allRowErrors.length > 0) {
      await recordIngestionRowErrors({ rowErrors: allRowErrors });
    }

    await setRunState(runId, {
      status: "finalizing",
      current_step: "finalizing",
      progress_percent: PROGRESS_BY_STAGE.finalizing,
      status_message: STAGE_MESSAGE.finalizing,
      rows_read: rowsRead,
      rows_loaded: rowsLoaded,
      rows_failed: rowsFailed,
      total_rows_estimated: rowsRead,
    });

    if (rowsLoaded === 0 && rowsFailed > 0) {
      throw new Error("All rows failed during AWS parquet ingestion");
    }

    const topReasons = Object.entries(failedReasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, count]) => `${reason} (${count})`)
      .join(", ");

    const finalStatus = rowsFailed > 0 ? "completed_with_warnings" : "completed";

    await setRunState(runId, {
      status: finalStatus,
      current_step: finalStatus,
      progress_percent: PROGRESS_BY_STAGE[finalStatus],
      status_message: STAGE_MESSAGE[finalStatus],
      rows_read: rowsRead,
      rows_loaded: rowsLoaded,
      rows_failed: rowsFailed,
      total_rows_estimated: rowsRead,
      error_message: rowsFailed > 0 ? `Rows failed: ${rowsFailed}${topReasons ? `. Top reasons: ${topReasons}` : ""}` : null,
      finished_at: now(),
      last_heartbeat_at: now(),
    });

    await source.update({
      lastIngestedAt: now(),
      status: "active",
    });

    if (rowsLoaded > 0) {
      await upsertCostAggregationsForRun({
        ingestionRunId: runId,
        tenantId: source.tenantId,
        providerId: source.cloudProviderId,
        billingSourceId: source.id,
        uploadedBy: connection.createdBy ?? null,
      });

      try {
        await syncAwsRightsizingRecommendationsAfterIngestion({
          tenantId: String(source.tenantId),
          billingSourceId: String(source.id),
          ingestionRunId: runId,
        });
      } catch (syncError) {
        logger.warn("Optimization recommendation sync failed after AWS parquet ingestion", {
          ingestionRunId: runId,
          tenantId: source.tenantId ?? null,
          billingSourceId: source.id ?? null,
          reason: toErrorMessage(syncError),
        });
      }

      try {
        await syncAwsIdleRecommendationsAfterIngestion({
          tenantId: String(source.tenantId),
          billingSourceId: String(source.id),
          ingestionRunId: runId,
        });
      } catch (idleSyncError) {
        logger.warn("Idle recommendation sync failed after AWS parquet ingestion", {
          ingestionRunId: runId,
          tenantId: source.tenantId ?? null,
          billingSourceId: source.id ?? null,
          reason: toErrorMessage(idleSyncError),
        });
      }
    }

    logger.info("AWS parquet ingestion completed", {
      ingestionRunId: runId,
      rowsRead,
      rowsLoaded,
      rowsFailed,
      schemaValidationResults,
    });

    return {
      schemaValidationResults: schemaValidationResults as AwsParquetSchemaValidationResult[],
      rowsRead,
      rowsLoaded,
      rowsFailed,
    };
  } catch (error) {
    logger.error("AWS parquet processor: step=failed", {
      runId,
      reason: toErrorMessage(error),
    });
    await markRunFailed(runId, error, PROGRESS_BY_STAGE.finalizing);
    throw error;
  }
}
