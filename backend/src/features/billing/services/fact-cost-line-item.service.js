import { FactCostLineItems as FactCostLineItem } from "../../../models/index.js";
import { mapFactCostLineItem } from "../mappers/raw_focus_to_dimensions.mapper.js";
import { resolveDimensions } from "./dimension-upsert.service.js";

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
    console.debug("Inserting fact row", { tenantId, ingestionRunId });

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
    } = await resolveDimensions({
      rawRow,
      tenantId,
      providerId,
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
      consumedQuantity: factPayload.consumed_quantity,
      pricingQuantity: factPayload.pricing_quantity,
      tagsJson: factPayload.tags_json,
    };

    // NOTE:
    // This inserts one row at a time (MVP).
    // Can be optimized later using bulk inserts or batching.
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

export { insertFactCostLineItem };
