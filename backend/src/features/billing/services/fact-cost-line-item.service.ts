/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { FactCostLineItems as FactCostLineItem } from "../../../models/index.js";
import { mapFactCostLineItem } from "../mappers/raw_focus_to_dimensions.mapper.js";
import { classifyFactInsertError } from "./numeric-validation.service.js";
import { resolveDimensions, resolveDimensionsWithCache } from "./dimension-upsert.service.js";

const isBlank = (value) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const isEmptyObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;

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
    };

    const record = await FactCostLineItem.create(factCreatePayload);

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
    await FactCostLineItem.bulkCreate(createPayloads, {
      returning: false,
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
        await FactCostLineItem.create(entry.createPayload);
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




