/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
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
  usageType: "usage_type",
  productUsageType: "product_usagetype",
  productFamily: "product_family",
  fromLocation: "from_location",
  toLocation: "to_location",
  fromRegionCode: "from_region_code",
  toRegionCode: "to_region_code",
  billType: "bill_type",
  lineItemDescription: "line_item_description",
  legalEntity: "legal_entity",
  operation: "operation",
  lineItemType: "line_item_type",
  consumedQuantity: "ConsumedQuantity",
  consumedUnit: "ConsumedUnit",
  effectiveCost: "EffectiveCost",
  listCost: "ListCost",
  publicOnDemandCost: "public_on_demand_cost",
  publicOnDemandRate: "public_on_demand_rate",
  discountAmount: "discount_amount",
  bundledDiscount: "bundled_discount",
  pricingCategory: "PricingCategory",
  pricingTerm: "pricing_term",
  purchaseOption: "purchase_option",
  pricingQuantity: "PricingQuantity",
  pricingUnit: "PricingUnit",
  creditAmount: "credit_amount",
  refundAmount: "refund_amount",
  taxCost: "tax_cost",
  reservationArn: "reservation_arn",
  savingsPlanArn: "savings_plan_arn",
  savingsPlanType: "savings_plan_type",
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

  if (value instanceof Map) {
    return Object.fromEntries(Array.from(value.entries()).map(([key, mapValue]) => [String(key), mapValue]));
  }

  if (Array.isArray(value)) {
    const tupleLike = value.every((entry) => Array.isArray(entry) && entry.length === 2);
    if (tupleLike) {
      return Object.fromEntries(value.map(([key, mapValue]) => [String(key), mapValue]));
    }

    const keyValueStructLike = value.every(
      (entry) => entry && typeof entry === "object" && "key" in entry && "value" in entry,
    );
    if (keyValueStructLike) {
      return Object.fromEntries(
        value.map((entry) => [String(entry.key), entry.value]),
      );
    }
  }

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

const toIsoTimestampOrNull = (value) => {
  if (isBlank(value)) return null;

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const asDate = new Date(trimmed);
    if (Number.isFinite(asDate.getTime())) return asDate.toISOString();

    if (/^[+-]?\d+$/.test(trimmed)) {
      return toIsoTimestampOrNull(BigInt(trimmed));
    }

    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const abs = Math.abs(value);
    const millis =
      abs >= 1e18 ? value / 1e6 : abs >= 1e15 ? value / 1e3 : abs >= 1e12 ? value : value * 1e3;
    const date = new Date(millis);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  if (typeof value === "bigint") {
    const abs = value < 0n ? -value : value;
    const millis =
      abs >= 1000000000000000000n
        ? value / 1000000n
        : abs >= 1000000000000000n
          ? value / 1000n
          : abs >= 1000000000000n
            ? value
            : value * 1000n;
    const asNumber = Number(millis);
    if (!Number.isFinite(asNumber)) return null;
    const date = new Date(asNumber);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  if (typeof value === "object") {
    if ("value" in value) {
      return toIsoTimestampOrNull(value.value);
    }

    const valueOf = typeof value.valueOf === "function" ? value.valueOf() : value;
    if (valueOf !== value) {
      return toIsoTimestampOrNull(valueOf);
    }

    if (typeof value.toString === "function") {
      const stringified = value.toString();
      if (stringified && stringified !== "[object Object]") {
        return toIsoTimestampOrNull(stringified);
      }
    }
  }

  return null;
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
  usage_full_date: toDateOnlyOrNull(
    rawRow[RAW_COLUMNS.chargePeriodStart] ??
      rawRow[RAW_COLUMNS.usageStartTime] ??
      rawRow[RAW_COLUMNS.usageEndTime],
  ),
  billing_period_start_full_date: toDateOnlyOrNull(rawRow[RAW_COLUMNS.billingPeriodStart]),
  billing_period_end_full_date: toDateOnlyOrNull(rawRow[RAW_COLUMNS.billingPeriodEnd]),
});

const mapFactMeasures = (rawRow) =>
  sanitizeFactMeasureNumerics({
    billed_cost: rawRow[RAW_COLUMNS.billedCost],
    effective_cost: rawRow[RAW_COLUMNS.effectiveCost],
    list_cost: rawRow[RAW_COLUMNS.listCost],
    usage_start_time: toIsoTimestampOrNull(rawRow[RAW_COLUMNS.usageStartTime]),
    usage_end_time: toIsoTimestampOrNull(rawRow[RAW_COLUMNS.usageEndTime]),
    usage_type: cleanStringOrNull(rawRow[RAW_COLUMNS.usageType]),
    // Support both spellings during transition:
    // - product_usagetype (CUR field)
    // - product_usage_type (legacy/internal canonical key)
    product_usage_type: cleanStringOrNull(
      rawRow[RAW_COLUMNS.productUsageType] ??
        rawRow.product_usage_type ??
        rawRow["product_usage_type"] ??
        rawRow.product_usagetype ??
        rawRow.productUsageType ??
        rawRow.ProductUsageType ??
        rawRow["product/usageType"],
    ),
    product_family: cleanStringOrNull(rawRow[RAW_COLUMNS.productFamily]),
    from_location: cleanStringOrNull(rawRow[RAW_COLUMNS.fromLocation]),
    to_location: cleanStringOrNull(rawRow[RAW_COLUMNS.toLocation]),
    from_region_code: cleanStringOrNull(rawRow[RAW_COLUMNS.fromRegionCode]),
    to_region_code: cleanStringOrNull(rawRow[RAW_COLUMNS.toRegionCode]),
    bill_type: cleanStringOrNull(rawRow[RAW_COLUMNS.billType]),
    line_item_description: cleanStringOrNull(rawRow[RAW_COLUMNS.lineItemDescription]),
    legal_entity: cleanStringOrNull(rawRow[RAW_COLUMNS.legalEntity]),
    operation: cleanStringOrNull(rawRow[RAW_COLUMNS.operation]),
    line_item_type: cleanStringOrNull(rawRow[RAW_COLUMNS.lineItemType]),
    pricing_term: cleanStringOrNull(rawRow[RAW_COLUMNS.pricingTerm]),
    purchase_option: cleanStringOrNull(rawRow[RAW_COLUMNS.purchaseOption]),
    public_on_demand_cost: rawRow[RAW_COLUMNS.publicOnDemandCost],
    public_on_demand_rate: rawRow[RAW_COLUMNS.publicOnDemandRate],
    discount_amount: rawRow[RAW_COLUMNS.discountAmount],
    bundled_discount: rawRow[RAW_COLUMNS.bundledDiscount],
    consumed_quantity: rawRow[RAW_COLUMNS.consumedQuantity],
    pricing_quantity: rawRow[RAW_COLUMNS.pricingQuantity],
    credit_amount: rawRow[RAW_COLUMNS.creditAmount],
    refund_amount: rawRow[RAW_COLUMNS.refundAmount],
    tax_cost: rawRow[RAW_COLUMNS.taxCost],
    reservation_arn: cleanStringOrNull(rawRow[RAW_COLUMNS.reservationArn]),
    savings_plan_arn: cleanStringOrNull(rawRow[RAW_COLUMNS.savingsPlanArn]),
    savings_plan_type: cleanStringOrNull(rawRow[RAW_COLUMNS.savingsPlanType]),
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
  tag_id = null,
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
  tag_id,
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
    usage_type: "usage_type",
    product_usage_type: "product_usage_type",
    product_family: "product_family",
    from_location: "from_location",
    to_location: "to_location",
    from_region_code: "from_region_code",
    to_region_code: "to_region_code",
    bill_type: "bill_type",
    line_item_description: "line_item_description",
    legal_entity: "legal_entity",
    operation: "operation",
    line_item_type: "line_item_type",
    pricing_term: "pricing_term",
    purchase_option: "purchase_option",
    public_on_demand_cost: "public_on_demand_cost",
    public_on_demand_rate: "public_on_demand_rate",
    discount_amount: "discount_amount",
    bundled_discount: "bundled_discount",
    ConsumedQuantity: "consumed_quantity",
    PricingQuantity: "pricing_quantity",
    credit_amount: "credit_amount",
    refund_amount: "refund_amount",
    tax_cost: "tax_cost",
    reservation_arn: "reservation_arn",
    savings_plan_arn: "savings_plan_arn",
    savings_plan_type: "savings_plan_type",
    Tags: "tag_id (via dim_tag)",
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




