/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { FactCostLineItemTags, FactCostLineItems as FactCostLineItem, sequelize } from "../../../models/index.js";
import { RAW_COLUMNS, mapFactCostLineItem } from "../mappers/raw_focus_to_dimensions.mapper.js";
import { classifyFactInsertError } from "./numeric-validation.service.js";
import { resolveDimensions, resolveDimensionsWithCache } from "./dimension-upsert.service.js";
import { createTagDimensionCache, resolveFactPrimaryTagId, resolveFactTagIds } from "./dim-tag.service.js";

const isBlank = (value) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const isEmptyObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;

async function attachFactTags({ factId, tenantId, providerId, tagIds }) {
  if (!factId || !Array.isArray(tagIds) || tagIds.length === 0) return;

  const uniqueTagIds = Array.from(new Set(tagIds.map((id) => String(id).trim()).filter(Boolean)));
  if (uniqueTagIds.length === 0) return;

  await FactCostLineItemTags.bulkCreate(
    uniqueTagIds.map((tagId) => ({
      factId,
      tagId,
      tenantId,
      providerId,
    })),
    { ignoreDuplicates: true, returning: false },
  );
}

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
    throw new Error("tenantId is required to insert fact_cost_line_items");
  }

  if (isBlank(providerId)) {
    throw new Error("providerId is required to insert fact_cost_line_items");
  }

  if (!rawRow || isEmptyObject(rawRow)) {
    throw new Error("rawRow must be a non-empty object");
  }

  try {
    // console.debug("Inserting fact row", { tenantId, ingestionRunId });

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
    };

    const record = await FactCostLineItem.create(factCreatePayload);
    await attachFactTags({
      factId: record.id,
      tenantId: factPayload.tenant_id,
      providerId: factPayload.provider_id,
      tagIds: resolveBridgeTagIds({ tagIds, primaryTagId: tagId }),
    });

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
      const insertedRecords = await FactCostLineItem.bulkCreate(createPayloads, {
        returning: true,
        transaction,
      });

      const requiresTagLinks = factRows.some((entry) => Array.isArray(entry?.tagIds) && entry.tagIds.length > 0);
      if (requiresTagLinks && insertedRecords.some((record) => !record?.id)) {
        throw new Error("Bulk insert did not return fact IDs required for tag bridge linking");
      }

      const tagLinkPayloads = [];
      for (let index = 0; index < insertedRecords.length; index += 1) {
        const record = insertedRecords[index];
        const factRow = factRows[index];
        const tagIds = resolveBridgeTagIds({
          tagIds: factRow?.tagIds,
          primaryTagId: factRow?.createPayload?.tagId,
        });
        if (!record?.id || tagIds.length === 0) continue;

        for (const tagId of tagIds) {
          tagLinkPayloads.push({
            factId: record.id,
            tagId,
            tenantId: factRow.createPayload.tenantId,
            providerId: factRow.createPayload.providerId,
          });
        }
      }

      if (tagLinkPayloads.length > 0) {
        await FactCostLineItemTags.bulkCreate(tagLinkPayloads, {
          ignoreDuplicates: true,
          returning: false,
          transaction,
        });
      }
    });

    return { insertedCount: createPayloads.length, failedRows: [] };
  } catch (bulkError) {
    const { errorCode: batchErrorCode, errorMessage: batchErrorMessage } = classifyFactInsertError(bulkError);
    console.warn("Fact batch insert failed, retrying row-by-row", {
      ingestionRunId,
      batchSize: factRows.length,
      errorCode: batchErrorCode,
      errorMessage: batchErrorMessage,
    });

    let insertedCount = 0;
    const failedRows = [];

    for (const [batchRowIndex, entry] of factRows.entries()) {
      try {
        const record = await FactCostLineItem.create(entry.createPayload);
        await attachFactTags({
          factId: record.id,
          tenantId: entry.createPayload.tenantId,
          providerId: entry.createPayload.providerId,
          tagIds: resolveBridgeTagIds({
            tagIds: entry.tagIds,
            primaryTagId: entry?.createPayload?.tagId,
          }),
        });
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

export { insertFactCostLineItem, insertFactCostLineItemsBatch };




