import { sanitizeFactMeasureNumerics } from "../services/numeric-validation.service.js";

/**
 * Raw source column names are intentionally contained to this mapping layer.
 * Downstream models/services should only use lowercase snake_case analytics names.
 */

const RAW_COLUMNS = Object.freeze({
  availabilityZone: "AvailabilityZone",
  billedCost: "BilledCost",
  billingAccountId: "BillingAccountId",
  billingAccountName: "BillingAccountName",
  billingCurrency: "BillingCurrency",
  billingPeriodEnd: "BillingPeriodEnd",
  billingPeriodStart: "BillingPeriodStart",
  chargeCategory: "ChargeCategory",
  chargeClass: "ChargeClass",
  chargePeriodStart: "ChargePeriodStart",
  chargePeriodEnd: "ChargePeriodEnd",
  usageStartTime: "usage_start_time",
  usageEndTime: "usage_end_time",
  lineItemType: "line_item_type",
  consumedQuantity: "ConsumedQuantity",
  consumedUnit: "ConsumedUnit",
  effectiveCost: "EffectiveCost",
  listCost: "ListCost",
  publicOnDemandCost: "public_on_demand_cost",
  discountAmount: "discount_amount",
  pricingCategory: "PricingCategory",
  pricingTerm: "pricing_term",
  pricingQuantity: "PricingQuantity",
  pricingUnit: "PricingUnit",
  creditAmount: "credit_amount",
  refundAmount: "refund_amount",
  taxCost: "tax_cost",
  providerName: "ProviderName",
  regionId: "RegionId",
  regionName: "RegionName",
  resourceId: "ResourceId",
  resourceName: "ResourceName",
  resourceType: "ResourceType",
  serviceCategory: "ServiceCategory",
  serviceName: "ServiceName",
  serviceSubcategory: "ServiceSubcategory",
  skuId: "SkuId",
  skuPriceId: "SkuPriceId",
  subAccountId: "SubAccountId",
  subAccountName: "SubAccountName",
  tags: "Tags",
});

const isBlank = (value) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const cleanStringOrNull = (value) => {
  if (isBlank(value)) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
};

const toNumberOrNull = (value) => {
  if (isBlank(value)) return null;
  const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

/**
 * Returns YYYY-MM-DD or null.
 * Note:
 * - This uses JS Date parsing and UTC ISO formatting.
 * - If provider timestamps include timezone offsets, the derived date may shift.
 * - Good enough for MVP; if exact provider-local date handling becomes critical,
 *   replace with a stricter parser later.
 */
const toDateOnlyOrNull = (value) => {
  if (isBlank(value)) return null;

  // Fast path for already date-shaped strings.
  if (typeof value === "string") {
    const trimmed = value.trim();
    const simpleDateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (simpleDateMatch) return simpleDateMatch[1];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
};

const toJsonOrNull = (value) => {
  if (isBlank(value)) return null;

  if (typeof value === "object") {
    return value;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return { raw_value: value };
    }
  }

  return { raw_value: value };
};

const hasAnyValue = (obj) =>
  Object.values(obj).some((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });

const mapDimBillingAccount = (rawRow) => ({
  billing_account_id: cleanStringOrNull(rawRow[RAW_COLUMNS.billingAccountId]),
  billing_account_name: cleanStringOrNull(rawRow[RAW_COLUMNS.billingAccountName]),
  billing_currency: cleanStringOrNull(rawRow[RAW_COLUMNS.billingCurrency]),
});

const shouldUpsertDimBillingAccount = (rawRow) => {
  const mapped = mapDimBillingAccount(rawRow);
  return !isBlank(mapped.billing_account_id);
};

const mapDimSubAccount = (rawRow) => ({
  sub_account_id: cleanStringOrNull(rawRow[RAW_COLUMNS.subAccountId]),
  sub_account_name: cleanStringOrNull(rawRow[RAW_COLUMNS.subAccountName]),
});

const shouldUpsertDimSubAccount = (rawRow) => {
  const mapped = mapDimSubAccount(rawRow);
  return !isBlank(mapped.sub_account_id);
};

const mapDimRegion = (rawRow) => ({
  region_id: cleanStringOrNull(rawRow[RAW_COLUMNS.regionId]),
  region_name: cleanStringOrNull(rawRow[RAW_COLUMNS.regionName]),
  availability_zone: cleanStringOrNull(rawRow[RAW_COLUMNS.availabilityZone]),
});

const shouldUpsertDimRegion = (rawRow) => {
  const mapped = mapDimRegion(rawRow);
  return !isBlank(mapped.region_name) || !isBlank(mapped.region_id);
};

const mapDimService = (rawRow) => ({
  service_name: cleanStringOrNull(rawRow[RAW_COLUMNS.serviceName]),
  service_category: cleanStringOrNull(rawRow[RAW_COLUMNS.serviceCategory]),
  service_subcategory: cleanStringOrNull(rawRow[RAW_COLUMNS.serviceSubcategory]),
});

const shouldUpsertDimService = (rawRow) => {
  const mapped = mapDimService(rawRow);
  return !isBlank(mapped.service_name);
};

const mapDimResource = (rawRow) => ({
  resource_id: cleanStringOrNull(rawRow[RAW_COLUMNS.resourceId]),
  resource_name: cleanStringOrNull(rawRow[RAW_COLUMNS.resourceName]),
  resource_type: cleanStringOrNull(rawRow[RAW_COLUMNS.resourceType]),
});

const shouldUpsertDimResource = (rawRow) => {
  const mapped = mapDimResource(rawRow);
  return !isBlank(mapped.resource_id);
};

const mapDimSku = (rawRow) => ({
  sku_id: cleanStringOrNull(rawRow[RAW_COLUMNS.skuId]),
  sku_price_id: cleanStringOrNull(rawRow[RAW_COLUMNS.skuPriceId]),
  pricing_category: cleanStringOrNull(rawRow[RAW_COLUMNS.pricingCategory]),
  pricing_unit: cleanStringOrNull(rawRow[RAW_COLUMNS.pricingUnit]),
});

const shouldUpsertDimSku = (rawRow) => {
  const mapped = mapDimSku(rawRow);
  return hasAnyValue(mapped);
};

const mapDimCharge = (rawRow) => ({
  charge_category: cleanStringOrNull(rawRow[RAW_COLUMNS.chargeCategory]),
  charge_class: cleanStringOrNull(rawRow[RAW_COLUMNS.chargeClass]),
});

const shouldUpsertDimCharge = (rawRow) => {
  const mapped = mapDimCharge(rawRow);
  return hasAnyValue(mapped);
};

const mapDateLookups = (rawRow) => ({
  usage_full_date: toDateOnlyOrNull(rawRow[RAW_COLUMNS.chargePeriodStart]),
  billing_period_start_full_date: toDateOnlyOrNull(rawRow[RAW_COLUMNS.billingPeriodStart]),
  billing_period_end_full_date: toDateOnlyOrNull(rawRow[RAW_COLUMNS.billingPeriodEnd]),
});

const mapFactMeasures = (rawRow) =>
  sanitizeFactMeasureNumerics({
    billed_cost: rawRow[RAW_COLUMNS.billedCost],
    effective_cost: rawRow[RAW_COLUMNS.effectiveCost],
    list_cost: rawRow[RAW_COLUMNS.listCost],
    usage_start_time: cleanStringOrNull(rawRow[RAW_COLUMNS.usageStartTime]),
    usage_end_time: cleanStringOrNull(rawRow[RAW_COLUMNS.usageEndTime]),
    line_item_type: cleanStringOrNull(rawRow[RAW_COLUMNS.lineItemType]),
    pricing_term: cleanStringOrNull(rawRow[RAW_COLUMNS.pricingTerm]),
    public_on_demand_cost: rawRow[RAW_COLUMNS.publicOnDemandCost],
    discount_amount: rawRow[RAW_COLUMNS.discountAmount],
    consumed_quantity: rawRow[RAW_COLUMNS.consumedQuantity],
    pricing_quantity: rawRow[RAW_COLUMNS.pricingQuantity],
    credit_amount: rawRow[RAW_COLUMNS.creditAmount],
    refund_amount: rawRow[RAW_COLUMNS.refundAmount],
    tax_cost: rawRow[RAW_COLUMNS.taxCost],
    tags_json: toJsonOrNull(rawRow[RAW_COLUMNS.tags]),
  });

/**
 * ProviderName should be resolved to provider_id by looking up cloud_providers.
 * This mapper only returns the external provider value needed for that lookup.
 */
const mapProviderResolutionInput = (rawRow) => ({
  provider_name: cleanStringOrNull(rawRow[RAW_COLUMNS.providerName]),
});

/**
 * ConsumedUnit and ChargePeriodEnd are currently not stored in the final analytics schema.
 * We expose them here for debugging, future enrichment, or logging if needed.
 */
const getNotPersistedRawFields = (rawRow) => ({
  consumed_unit: cleanStringOrNull(rawRow[RAW_COLUMNS.consumedUnit]),
  charge_period_end: toDateOnlyOrNull(rawRow[RAW_COLUMNS.chargePeriodEnd]),
});

/**
 * Build the final fact row payload after dimensions and date keys are resolved.
 *
 * Expected inputs:
 * - tenant_id
 * - billing_source_id
 * - ingestion_run_id
 * - provider_id
 * - billing_account_key
 * - sub_account_key
 * - region_key
 * - service_key
 * - resource_key
 * - sku_key
 * - charge_key
 * - usage_date_key
 * - billing_period_start_date_key
 * - billing_period_end_date_key
 * - raw_row
 */
const mapFactCostLineItem = ({
  tenant_id,
  billing_source_id,
  ingestion_run_id,
  provider_id,
  billing_account_key = null,
  sub_account_key = null,
  region_key = null,
  service_key = null,
  resource_key = null,
  sku_key = null,
  charge_key = null,
  usage_date_key = null,
  billing_period_start_date_key = null,
  billing_period_end_date_key = null,
  raw_row,
}) => ({
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
  usage_date_key,
  billing_period_start_date_key,
  billing_period_end_date_key,
  ...mapFactMeasures(raw_row),
});

const RAW_TO_ANALYTICS_REFERENCE = Object.freeze({
  dim_billing_account: {
    BillingAccountId: "billing_account_id",
    BillingAccountName: "billing_account_name",
    BillingCurrency: "billing_currency",
  },
  dim_sub_account: {
    SubAccountId: "sub_account_id",
    SubAccountName: "sub_account_name",
  },
  dim_region: {
    RegionId: "region_id",
    RegionName: "region_name",
    AvailabilityZone: "availability_zone",
  },
  dim_service: {
    ServiceName: "service_name",
    ServiceCategory: "service_category",
    ServiceSubcategory: "service_subcategory",
  },
  dim_resource: {
    ResourceId: "resource_id",
    ResourceName: "resource_name",
    ResourceType: "resource_type",
  },
  dim_sku: {
    SkuId: "sku_id",
    SkuPriceId: "sku_price_id",
    PricingCategory: "pricing_category",
    PricingUnit: "pricing_unit",
  },
  dim_charge: {
    ChargeCategory: "charge_category",
    ChargeClass: "charge_class",
  },
  dim_date: {
    ChargePeriodStart: "usage_date_key (via dim_date.full_date)",
    BillingPeriodStart: "billing_period_start_date_key (via dim_date.full_date)",
    BillingPeriodEnd: "billing_period_end_date_key (via dim_date.full_date)",
  },
  fact_cost_line_items: {
    BilledCost: "billed_cost",
    EffectiveCost: "effective_cost",
    ListCost: "list_cost",
    usage_start_time: "usage_start_time",
    usage_end_time: "usage_end_time",
    line_item_type: "line_item_type",
    pricing_term: "pricing_term",
    public_on_demand_cost: "public_on_demand_cost",
    discount_amount: "discount_amount",
    ConsumedQuantity: "consumed_quantity",
    PricingQuantity: "pricing_quantity",
    credit_amount: "credit_amount",
    refund_amount: "refund_amount",
    tax_cost: "tax_cost",
    Tags: "tags_json",
  },
});

export {
  RAW_COLUMNS,
  RAW_TO_ANALYTICS_REFERENCE,
  cleanStringOrNull,
  toNumberOrNull,
  toDateOnlyOrNull,
  toJsonOrNull,
  mapDimBillingAccount,
  shouldUpsertDimBillingAccount,
  mapDimSubAccount,
  shouldUpsertDimSubAccount,
  mapDimRegion,
  shouldUpsertDimRegion,
  mapDimService,
  shouldUpsertDimService,
  mapDimResource,
  shouldUpsertDimResource,
  mapDimSku,
  shouldUpsertDimSku,
  mapDimCharge,
  shouldUpsertDimCharge,
  mapDateLookups,
  mapFactMeasures,
  mapFactCostLineItem,
  mapProviderResolutionInput,
  getNotPersistedRawFields,
};
