/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { StagingCostLineItems as StagingCostLineItem, sequelize } from "../../../models/index.js";
import { QueryTypes } from "sequelize";
import env from "../../../config/env.js";
import { RAW_COLUMNS, mapFactCostLineItem } from "../mappers/raw_focus_to_dimensions.mapper.js";
import { classifyFactInsertError } from "./numeric-validation.service.js";
import { resolveDimensions, resolveDimensionsWithCache } from "./dimension-upsert.service.js";
import { createTagDimensionCache, resolveFactPrimaryTagId, resolveFactTagIds } from "./dim-tag.service.js";
import { buildSourceRowHash } from "./source-row-hash.service.js";

const isBlank = (value) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const isEmptyObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;

const resolveBridgeTagIds = ({ tagIds, primaryTagId }) => {
  const normalized = Array.isArray(tagIds)
    ? Array.from(new Set(tagIds.map((id) => String(id).trim()).filter(Boolean)))
    : [];
  if (normalized.length > 0) return normalized;

  if (primaryTagId !== null && primaryTagId !== undefined && String(primaryTagId).trim().length > 0) {
    return [String(primaryTagId).trim()];
  }

  return [];
};

async function insertFactCostLineItem({
  rawRow,
  tenantId,
  billingSourceId,
  ingestionRunId,
  providerId,
  dimensionCache,
}) {
  if (isBlank(tenantId)) {
    throw new Error("tenantId is required to insert staging_cost_line_items");
  }

  if (isBlank(providerId)) {
    throw new Error("providerId is required to insert staging_cost_line_items");
  }

  if (!rawRow || isEmptyObject(rawRow)) {
    throw new Error("rawRow must be a non-empty object");
  }

  try {
    // console.debug("Inserting fact row", { tenantId, ingestionRunId });

    const sourceRowHash = buildSourceRowHash(rawRow);
    const dimensionResolver = dimensionCache ? resolveDimensionsWithCache : resolveDimensions;
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
    } = await dimensionResolver({
      rawRow,
      tenantId,
      providerId,
      cache: dimensionCache,
    });

    const tagCache = createTagDimensionCache();
    const tagIds = await resolveFactTagIds({
      tenantId,
      providerId,
      rawTags: rawRow[RAW_COLUMNS.tags],
      tagCache,
    });
    const tagId = await resolveFactPrimaryTagId({
      tenantId,
      providerId,
      rawTags: rawRow[RAW_COLUMNS.tags],
      tagCache,
    });

    const factPayload = mapFactCostLineItem({
      tenant_id: tenantId,
      billing_source_id: billingSourceId,
      ingestion_run_id: ingestionRunId,
      provider_id: providerId,
      billing_account_key: billingAccountKey,
      sub_account_key: subAccountKey,
      region_key: regionKey,
      service_key: serviceKey,
      resource_key: resourceKey,
      sku_key: skuKey,
      charge_key: chargeKey,
      tag_id: tagId,
      usage_date_key: usageDateKey,
      billing_period_start_date_key: billingPeriodStartDateKey,
      billing_period_end_date_key: billingPeriodEndDateKey,
      raw_row: rawRow,
    });

    const factCreatePayload = {
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
      tagsJson: rawRow[RAW_COLUMNS.tags] ?? null,
      usageDateKey: factPayload.usage_date_key,
      billingPeriodStartDateKey: factPayload.billing_period_start_date_key,
      billingPeriodEndDateKey: factPayload.billing_period_end_date_key,
      billedCost: factPayload.billed_cost,
      effectiveCost: factPayload.effective_cost,
      listCost: factPayload.list_cost,
      usageStartTime: factPayload.usage_start_time,
      usageEndTime: factPayload.usage_end_time,
      usageType: factPayload.usage_type,
      productUsageType: factPayload.product_usage_type,
      productFamily: factPayload.product_family,
      fromLocation: factPayload.from_location,
      toLocation: factPayload.to_location,
      fromRegionCode: factPayload.from_region_code,
      toRegionCode: factPayload.to_region_code,
      billType: factPayload.bill_type,
      lineItemDescription: factPayload.line_item_description,
      legalEntity: factPayload.legal_entity,
      operation: factPayload.operation,
      lineItemType: factPayload.line_item_type,
      pricingTerm: factPayload.pricing_term,
      purchaseOption: factPayload.purchase_option,
      publicOnDemandCost: factPayload.public_on_demand_cost,
      publicOnDemandRate: factPayload.public_on_demand_rate,
      discountAmount: factPayload.discount_amount,
      bundledDiscount: factPayload.bundled_discount,
      creditAmount: factPayload.credit_amount,
      refundAmount: factPayload.refund_amount,
      taxCost: factPayload.tax_cost,
      reservationArn: factPayload.reservation_arn,
      savingsPlanArn: factPayload.savings_plan_arn,
      savingsPlanType: factPayload.savings_plan_type,
      consumedQuantity: factPayload.consumed_quantity,
      pricingQuantity: factPayload.pricing_quantity,
      tagId: factPayload.tag_id,
      tagIdsJson: resolveBridgeTagIds({ tagIds, primaryTagId: tagId }),
      sourceRowHash,
    };

    const record = await StagingCostLineItem.create(factCreatePayload);

    return {
      success: true,
      factId: record.id,
    };
  } catch (error) {
    console.error("Failed to insert fact row", {
      tenantId,
      ingestionRunId,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function insertFactCostLineItemsBatch({ factRows, ingestionRunId }) {
  if (!Array.isArray(factRows) || factRows.length === 0) {
    return { insertedCount: 0, failedRows: [] };
  }

  const createPayloads = factRows.map((entry) => entry.createPayload);

  try {
    await sequelize.transaction(async (transaction) => {
      await StagingCostLineItem.bulkCreate(createPayloads, {
        returning: true,
        transaction,
      });
    });

    const sampleTaggedRow = createPayloads.find(
      (row) => row?.tagId != null || (Array.isArray(row?.tagIdsJson) && row.tagIdsJson.length > 0),
    );
    if (sampleTaggedRow) {
      console.info("Staging tag survival check", {
        ingestionRunId,
        hasTagId: sampleTaggedRow.tagId != null,
        tagIdsCount: Array.isArray(sampleTaggedRow.tagIdsJson) ? sampleTaggedRow.tagIdsJson.length : 0,
        tagId: sampleTaggedRow.tagId ?? null,
      });
    }

    return { insertedCount: createPayloads.length, failedRows: [] };
  } catch (bulkError) {
    const { errorCode: batchErrorCode, errorMessage: batchErrorMessage } = classifyFactInsertError(bulkError);
    console.warn("Staging batch insert failed, retrying row-by-row", {
      ingestionRunId,
      batchSize: factRows.length,
      errorCode: batchErrorCode,
      errorMessage: batchErrorMessage,
    });

    let insertedCount = 0;
    const failedRows = [];

    for (const [batchRowIndex, entry] of factRows.entries()) {
      try {
        await StagingCostLineItem.create(entry.createPayload);
        insertedCount += 1;
      } catch (rowError) {
        const { errorCode, errorMessage } = classifyFactInsertError(rowError);
        failedRows.push({
          batchRowIndex,
          rowNumber: entry.rowNumber ?? null,
          rawRow: entry.rawRow ?? null,
          errorCode,
          errorMessage,
        });
      }
    }

    return {
      insertedCount,
      failedRows,
      batchFallbackError: {
        errorCode: batchErrorCode,
        errorMessage: batchErrorMessage,
      },
    };
  }
}

async function validateStagingRowsForIngestionRun({ ingestionRunId, billingSourceId }) {
  const [summary] = await sequelize.query(
    `
      SELECT
        COUNT(*)::bigint AS row_count,
        MIN(usage_start_time) AS min_usage_start_time,
        MAX(usage_end_time) AS max_usage_end_time
      FROM staging_cost_line_items
      WHERE ingestion_run_id = :ingestionRunId
        AND billing_source_id = :billingSourceId
    `,
    {
      type: QueryTypes.SELECT,
      replacements: {
        ingestionRunId: String(ingestionRunId),
        billingSourceId: String(billingSourceId),
      },
    },
  );

  const rowCount = Number(summary?.row_count ?? 0);
  const minUsageStartTime = summary?.min_usage_start_time ?? null;
  const maxUsageEndTime = summary?.max_usage_end_time ?? null;

  console.info("Staging validation summary", {
    ingestionRunId: String(ingestionRunId),
    billingSourceId: String(billingSourceId),
    rowCount,
    minUsageStartTime,
    maxUsageEndTime,
  });

  if (rowCount === 0) {
    throw new Error("Staging validation failed: row_count is 0");
  }
  if (!minUsageStartTime || !maxUsageEndTime) {
    throw new Error("Staging validation failed: min/max usage time is null");
  }

  return {
    rowCount,
    minUsageStartTime,
    maxUsageEndTime,
  };
}

async function replaceFactRowsFromStagingInTransaction({
  ingestionRunId,
  billingSourceId,
  rowsRead = 0,
  rowsFailed = 0,
  warningMessage = null,
}) {
  return sequelize.transaction(async (transaction) => {
    const [stagingBeforeDedupeSummary] = await sequelize.query(
      `
        SELECT
          COUNT(*)::bigint AS row_count
        FROM staging_cost_line_items
        WHERE ingestion_run_id = :ingestionRunId
          AND billing_source_id = :billingSourceId
      `,
      {
        type: QueryTypes.SELECT,
        transaction,
        replacements: {
          ingestionRunId: String(ingestionRunId),
          billingSourceId: String(billingSourceId),
        },
      },
    );

    const stagingBeforeDedupeCount = Number(stagingBeforeDedupeSummary?.row_count ?? 0);

    if (stagingBeforeDedupeCount === 0) {
      throw new Error("Staging replacement failed: row_count is 0");
    }

    const affectedUsageDateRows = await sequelize.query(
      `
        SELECT DISTINCT DATE(usage_start_time) AS usage_date
        FROM staging_cost_line_items
        WHERE ingestion_run_id = :ingestionRunId
          AND billing_source_id = :billingSourceId
          AND usage_start_time IS NOT NULL
        ORDER BY usage_date
      `,
      {
        type: QueryTypes.SELECT,
        transaction,
        replacements: {
          ingestionRunId: String(ingestionRunId),
          billingSourceId: String(billingSourceId),
        },
      },
    );
    const affectedUsageDates = affectedUsageDateRows
      .map((row) => String(row?.usage_date ?? "").trim())
      .filter(Boolean);

    if (affectedUsageDates.length === 0) {
      throw new Error("Staging replacement failed: no affected usage dates found");
    }

    const [stagingDuplicateSummary] = await sequelize.query(
      `
        WITH grouped AS (
          SELECT COUNT(*)::bigint AS c
          FROM staging_cost_line_items
          WHERE ingestion_run_id = :ingestionRunId
            AND billing_source_id = :billingSourceId
            AND source_row_hash IS NOT NULL
          GROUP BY billing_source_id, ingestion_run_id, source_row_hash
        )
        SELECT COALESCE(SUM(c - 1), 0)::bigint AS duplicate_count
        FROM grouped
        WHERE c > 1
      `,
      {
        type: QueryTypes.SELECT,
        transaction,
        replacements: {
          ingestionRunId: String(ingestionRunId),
          billingSourceId: String(billingSourceId),
        },
      },
    );

    const [deletedSummary] = await sequelize.query(
      `
        WITH deleted AS (
          DELETE FROM fact_cost_line_items
          WHERE billing_source_id = :billingSourceId
            AND DATE(usage_start_time) IN (
              SELECT DISTINCT DATE(usage_start_time)
              FROM staging_cost_line_items
              WHERE ingestion_run_id = :ingestionRunId
                AND billing_source_id = :billingSourceId
                AND usage_start_time IS NOT NULL
            )
          RETURNING 1
        )
        SELECT COUNT(*)::bigint AS deleted_count
        FROM deleted
      `,
      {
        type: QueryTypes.SELECT,
        transaction,
        replacements: {
          ingestionRunId: String(ingestionRunId),
          billingSourceId: String(billingSourceId),
        },
      },
    );

    const [stagingDedupeDeleteSummary] = await sequelize.query(
      `
        WITH ranked AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY billing_source_id, ingestion_run_id, source_row_hash
              ORDER BY id
            ) AS rn
          FROM staging_cost_line_items
          WHERE ingestion_run_id = :ingestionRunId
            AND billing_source_id = :billingSourceId
            AND source_row_hash IS NOT NULL
        ),
        deleted AS (
          DELETE FROM staging_cost_line_items s
          USING ranked r
          WHERE s.id = r.id
            AND r.rn > 1
          RETURNING 1
        )
        SELECT COUNT(*)::bigint AS deduped_rows_deleted
        FROM deleted
      `,
      {
        type: QueryTypes.SELECT,
        transaction,
        replacements: {
          ingestionRunId: String(ingestionRunId),
          billingSourceId: String(billingSourceId),
        },
      },
    );

    const [stagingAfterDedupeSummary] = await sequelize.query(
      `
        SELECT
          COUNT(*)::bigint AS row_count
        FROM staging_cost_line_items
        WHERE ingestion_run_id = :ingestionRunId
          AND billing_source_id = :billingSourceId
      `,
      {
        type: QueryTypes.SELECT,
        transaction,
        replacements: {
          ingestionRunId: String(ingestionRunId),
          billingSourceId: String(billingSourceId),
        },
      },
    );

    const stagingAfterDedupeCount = Number(stagingAfterDedupeSummary?.row_count ?? 0);
    if (stagingAfterDedupeCount === 0) {
      throw new Error("Staging replacement failed: row_count is 0 after source_row_hash dedupe");
    }

    const [insertSummary] = await sequelize.query(
      `
        WITH inserted AS (
          INSERT INTO fact_cost_line_items (
            tenant_id,
            billing_source_id,
            ingestion_run_id,
            provider_id,
            billing_account_key,
            sub_account_key,
            region_key,
            service_key,
            resource_key,
            sku_key,
            charge_key,
            tag_id,
            tags_json,
            tag_ids_json,
            usage_date_key,
            billing_period_start_date_key,
            billing_period_end_date_key,
            billed_cost,
            effective_cost,
            list_cost,
            consumed_quantity,
            pricing_quantity,
            usage_start_time,
            usage_end_time,
            usage_type,
            product_usage_type,
            product_family,
            from_location,
            to_location,
            from_region_code,
            to_region_code,
            bill_type,
            line_item_description,
            legal_entity,
            operation,
            line_item_type,
            pricing_term,
            purchase_option,
            public_on_demand_cost,
            public_on_demand_rate,
            discount_amount,
            bundled_discount,
            credit_amount,
            refund_amount,
            tax_cost,
            reservation_arn,
            savings_plan_arn,
            savings_plan_type,
            source_row_hash,
            ingested_at,
            created_at
          )
          SELECT
            tenant_id,
            billing_source_id,
            ingestion_run_id,
            provider_id,
            billing_account_key,
            sub_account_key,
            region_key,
            service_key,
            resource_key,
            sku_key,
            charge_key,
            tag_id,
            tags_json,
            tag_ids_json,
            usage_date_key,
            billing_period_start_date_key,
            billing_period_end_date_key,
            billed_cost,
            effective_cost,
            list_cost,
            consumed_quantity,
            pricing_quantity,
            usage_start_time,
            usage_end_time,
            usage_type,
            product_usage_type,
            product_family,
            from_location,
            to_location,
            from_region_code,
            to_region_code,
            bill_type,
            line_item_description,
            legal_entity,
            operation,
            line_item_type,
            pricing_term,
            purchase_option,
            public_on_demand_cost,
            public_on_demand_rate,
            discount_amount,
            bundled_discount,
            credit_amount,
            refund_amount,
            tax_cost,
            reservation_arn,
            savings_plan_arn,
            savings_plan_type,
            source_row_hash,
            ingested_at,
            created_at
          FROM staging_cost_line_items
          WHERE ingestion_run_id = :ingestionRunId
            AND billing_source_id = :billingSourceId
          RETURNING id, tenant_id, provider_id, tags_json, tag_ids_json
        ),
        bridge_candidates AS (
          SELECT
            i.id AS fact_id,
            i.tenant_id,
            i.provider_id,
            tag_ids_raw.tag_id_text::bigint AS tag_id
          FROM inserted i
          JOIN LATERAL jsonb_array_elements_text(COALESCE(i.tag_ids_json, '[]'::jsonb)) AS tag_ids_raw(tag_id_text)
            ON TRUE
        ),
        bridge_classified AS (
          SELECT
            c.fact_id,
            c.tag_id,
            c.tenant_id,
            c.provider_id,
            dt.normalized_key,
            CASE
              WHEN dt.normalized_key IN ('team', 'product', 'environment', 'owner', 'application', 'costcenter')
              THEN TRUE
              ELSE FALSE
            END AS is_allowlisted
          FROM bridge_candidates c
          JOIN dim_tag dt ON dt.id = c.tag_id
        ),
        bridge_inserted AS (
          INSERT INTO fact_cost_line_item_tags (
            fact_id,
            tag_id,
            tenant_id,
            provider_id,
            created_at
          )
          SELECT
            fact_id,
            tag_id,
            tenant_id,
            provider_id,
            NOW()
          FROM bridge_classified
          WHERE is_allowlisted
          ON CONFLICT (fact_id, tag_id) DO NOTHING
          RETURNING 1
        )
        SELECT
          (SELECT COUNT(*)::bigint FROM inserted) AS inserted_count,
          (SELECT COUNT(*)::bigint FROM inserted WHERE tags_json IS NOT NULL) AS fact_rows_with_tags_json,
          (SELECT COUNT(*)::bigint FROM bridge_inserted) AS bridge_rows_inserted,
          (SELECT COUNT(*)::bigint FROM bridge_classified WHERE NOT is_allowlisted) AS skipped_non_allowlisted_tag_rows
      `,
      {
        type: QueryTypes.SELECT,
        transaction,
        replacements: {
          ingestionRunId: String(ingestionRunId),
          billingSourceId: String(billingSourceId),
        },
      },
    );

    const [factDuplicateSummary] = await sequelize.query(
      `
        WITH grouped AS (
          SELECT COUNT(*)::bigint AS c
          FROM fact_cost_line_items
          WHERE ingestion_run_id = :ingestionRunId
            AND billing_source_id = :billingSourceId
          GROUP BY
            tenant_id, billing_source_id, ingestion_run_id, provider_id,
            usage_start_time, usage_end_time, resource_key, service_key,
            sku_key, charge_key, line_item_type, operation,
            billed_cost, effective_cost, consumed_quantity, pricing_quantity, tag_id
        )
        SELECT COALESCE(SUM(c - 1), 0)::bigint AS duplicate_count
        FROM grouped
        WHERE c > 1
      `,
      {
        type: QueryTypes.SELECT,
        transaction,
        replacements: {
          ingestionRunId: String(ingestionRunId),
          billingSourceId: String(billingSourceId),
        },
      },
    );

    const insertedCount = Number(insertSummary?.inserted_count ?? 0);
    const factRowsWithTagsJson = Number(insertSummary?.fact_rows_with_tags_json ?? 0);
    const bridgeRowsInserted = Number(insertSummary?.bridge_rows_inserted ?? 0);
    const skippedNonAllowlistedTagRows = Number(insertSummary?.skipped_non_allowlisted_tag_rows ?? 0);
    if (insertedCount !== stagingAfterDedupeCount) {
      throw new Error(
        `Staging replacement failed: inserted row count (${insertedCount}) does not match staging row count after dedupe (${stagingAfterDedupeCount})`,
      );
    }

    if (!env.keepStagingAfterIngest) {
      await sequelize.query(
        `
          DELETE FROM staging_cost_line_items
          WHERE ingestion_run_id = :ingestionRunId
            AND billing_source_id = :billingSourceId
        `,
        {
          transaction,
          replacements: {
            ingestionRunId: String(ingestionRunId),
            billingSourceId: String(billingSourceId),
          },
        },
      );
    }

    const finalStatus = Number(rowsFailed) > 0 ? "completed_with_warnings" : "completed";
    const finalMessage = Number(rowsFailed) > 0 ? "Billing data is ready with warnings" : "Billing data is ready";

    await sequelize.query(
      `
        UPDATE billing_ingestion_runs
        SET
          status = :finalStatus,
          current_step = :finalStatus,
          progress_percent = 100,
          status_message = :finalMessage,
          rows_read = :rowsRead,
          rows_loaded = :rowsLoaded,
          rows_failed = :rowsFailed,
          total_rows_estimated = :rowsRead,
          error_message = :warningMessage,
          finished_at = NOW(),
          last_heartbeat_at = NOW(),
          updated_at = NOW()
        WHERE id = :ingestionRunId
      `,
      {
        transaction,
        replacements: {
          ingestionRunId: String(ingestionRunId),
          finalStatus,
          finalMessage,
          rowsRead: Number(rowsRead) || 0,
          rowsLoaded: Number(insertSummary?.inserted_count ?? stagingAfterDedupeCount) || stagingAfterDedupeCount,
          rowsFailed: Number(rowsFailed) || 0,
          warningMessage,
        },
      },
    );

    const deletedCount = Number(deletedSummary?.deleted_count ?? 0);
    const stagingDuplicateCount = Number(stagingDuplicateSummary?.duplicate_count ?? 0);
    const dedupedRowsDeleted = Number(stagingDedupeDeleteSummary?.deduped_rows_deleted ?? 0);
    const factDuplicateCount = Number(factDuplicateSummary?.duplicate_count ?? 0);

    console.info("Staging->Fact replacement debug summary", {
      ingestionRunId: String(ingestionRunId),
      billingSourceId: String(billingSourceId),
      keepStagingAfterIngest: env.keepStagingAfterIngest,
      affectedUsageDates,
      stagingBeforeDedupe: stagingBeforeDedupeCount,
      dedupedRowsDeleted,
      stagingAfterDedupe: stagingAfterDedupeCount,
      deletedFactRows: deletedCount,
      insertedFactRows: insertedCount,
      stagingDuplicateCountBeforeDedupe: stagingDuplicateCount,
      factDuplicateCountAfterInsert: factDuplicateCount,
      factRowsWithTagsJson,
      bridgeRowsInserted,
      skippedNonAllowlistedTagRows,
    });

    console.info("Staging source_row_hash duplicate summary", {
      ingestionRunId: String(ingestionRunId),
      billingSourceId: String(billingSourceId),
      duplicateSourceRowHashCount: stagingDuplicateCount,
    });

    return {
      rowCount: stagingAfterDedupeCount,
      stagingBeforeDedupeCount,
      dedupedRowsDeleted,
      stagingAfterDedupeCount,
      affectedUsageDates,
      deletedCount,
      rowsInserted: insertedCount,
      stagingDuplicateCount,
      factDuplicateCount,
      factRowsWithTagsJson,
      bridgeRowsInserted,
      skippedNonAllowlistedTagRows,
      keptStagingRows: env.keepStagingAfterIngest,
    };
  });
}

function mapStagingRowToFactInsert(stagingRow) {
  const tagIds = Array.isArray(stagingRow?.tagIdsJson)
    ? stagingRow.tagIdsJson.map((id) => String(id).trim()).filter(Boolean)
    : [];

  return {
    createPayload: {
      tenantId: stagingRow.tenantId,
      billingSourceId: stagingRow.billingSourceId,
      ingestionRunId: stagingRow.ingestionRunId,
      providerId: stagingRow.providerId,
      billingAccountKey: stagingRow.billingAccountKey,
      subAccountKey: stagingRow.subAccountKey,
      regionKey: stagingRow.regionKey,
      serviceKey: stagingRow.serviceKey,
      resourceKey: stagingRow.resourceKey,
      skuKey: stagingRow.skuKey,
      chargeKey: stagingRow.chargeKey,
      tagsJson: stagingRow.tagsJson ?? null,
      usageDateKey: stagingRow.usageDateKey,
      billingPeriodStartDateKey: stagingRow.billingPeriodStartDateKey,
      billingPeriodEndDateKey: stagingRow.billingPeriodEndDateKey,
      billedCost: stagingRow.billedCost,
      effectiveCost: stagingRow.effectiveCost,
      listCost: stagingRow.listCost,
      usageStartTime: stagingRow.usageStartTime,
      usageEndTime: stagingRow.usageEndTime,
      usageType: stagingRow.usageType,
      productUsageType: stagingRow.productUsageType,
      productFamily: stagingRow.productFamily,
      fromLocation: stagingRow.fromLocation,
      toLocation: stagingRow.toLocation,
      fromRegionCode: stagingRow.fromRegionCode,
      toRegionCode: stagingRow.toRegionCode,
      billType: stagingRow.billType,
      lineItemDescription: stagingRow.lineItemDescription,
      legalEntity: stagingRow.legalEntity,
      operation: stagingRow.operation,
      lineItemType: stagingRow.lineItemType,
      pricingTerm: stagingRow.pricingTerm,
      purchaseOption: stagingRow.purchaseOption,
      publicOnDemandCost: stagingRow.publicOnDemandCost,
      publicOnDemandRate: stagingRow.publicOnDemandRate,
      discountAmount: stagingRow.discountAmount,
      bundledDiscount: stagingRow.bundledDiscount,
      creditAmount: stagingRow.creditAmount,
      refundAmount: stagingRow.refundAmount,
      taxCost: stagingRow.taxCost,
      reservationArn: stagingRow.reservationArn,
      savingsPlanArn: stagingRow.savingsPlanArn,
      savingsPlanType: stagingRow.savingsPlanType,
      consumedQuantity: stagingRow.consumedQuantity,
      pricingQuantity: stagingRow.pricingQuantity,
      tagId: stagingRow.tagId,
      tagIdsJson: stagingRow.tagIdsJson ?? [],
      sourceRowHash: stagingRow.sourceRowHash ?? null,
    },
    tagIds: resolveBridgeTagIds({
      tagIds,
      primaryTagId: stagingRow?.tagId ?? null,
    }),
  };
}

export {
  insertFactCostLineItem,
  insertFactCostLineItemsBatch,
  mapStagingRowToFactInsert,
  validateStagingRowsForIngestionRun,
  replaceFactRowsFromStagingInTransaction,
};




