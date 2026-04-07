/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Canonical raw billing schema used as the strict boundary between:
 * - file-reader output (provider-specific header names), and
 * - existing mapper/services (which expect canonical raw source columns).
 *
 * This keeps header variability isolated before downstream ingestion logic.
 */

const CANONICAL_COLUMNS = Object.freeze([
  "AvailabilityZone",
  "BilledCost",
  "BillingAccountId",
  "BillingAccountName",
  "BillingCurrency",
  "BillingPeriodEnd",
  "BillingPeriodStart",
  "ChargeCategory",
  "ChargeClass",
  "ChargePeriodStart",
  "ChargePeriodEnd",
  "ConsumedQuantity",
  "ConsumedUnit",
  "EffectiveCost",
  "ListCost",
  "PricingCategory",
  "PricingQuantity",
  "PricingUnit",
  "ProviderName",
  "RegionId",
  "RegionName",
  "ResourceId",
  "ResourceName",
  "ResourceType",
  "ServiceCategory",
  "ServiceName",
  "ServiceSubcategory",
  "SkuId",
  "SkuPriceId",
  "SubAccountId",
  "SubAccountName",
  "Tags",
  "usage_start_time",
  "usage_end_time",
  "usage_type",
  "operation",
  "line_item_type",
  "pricing_term",
  "purchase_option",
  "public_on_demand_cost",
  "discount_amount",
  "credit_amount",
  "refund_amount",
  "tax_cost",
  "reservation_arn",
  "savings_plan_arn",
  "savings_plan_type",
]);

/**
 * "Any schema" mode:
 * - We no longer block ingestion at schema-validation time for missing required columns.
 * - Missing fields are normalized to null and handled by row-level insert validation.
 *
 * This keeps ingestion resilient for CUR-style, FOCUS-style, and custom exports.
 */
const REQUIRED_COLUMNS = Object.freeze([]);

const REQUIRED_COLUMN_SET = new Set(REQUIRED_COLUMNS);

const OPTIONAL_COLUMNS = Object.freeze(
  CANONICAL_COLUMNS.filter((columnName) => !REQUIRED_COLUMN_SET.has(columnName)),
);

const COLUMN_ALIASES = Object.freeze({
  AvailabilityZone: Object.freeze([
    "AvailabilityZone",
    "availability_zone",
    "availabilityzone",
    "az",
    "zone",
    "product/availabilityZone",
  ]),
  BilledCost: Object.freeze([
    "BilledCost",
    "billed_cost",
    "billedcost",
    "lineItem/UnblendedCost",
    "lineItem/BlendedCost",
    "cost",
    "amount",
  ]),
  BillingAccountId: Object.freeze([
    "BillingAccountId",
    "billing_account_id",
    "billingaccountid",
    "account_id",
    "accountid",
    "payer_account_id",
    "payeraccountid",
    "bill/PayerAccountId",
    "payer_id",
  ]),
  BillingAccountName: Object.freeze([
    "BillingAccountName",
    "billing_account_name",
    "billingaccountname",
    "account_name",
    "payer_account_name",
    "payer_name",
  ]),
  BillingCurrency: Object.freeze([
    "BillingCurrency",
    "billing_currency",
    "currency",
    "bill/BillingEntity",
    "invoice_currency",
  ]),
  BillingPeriodEnd: Object.freeze([
    "BillingPeriodEnd",
    "billing_period_end",
    "billingperiodend",
    "bill/BillingPeriodEndDate",
    "billing_period_end_date",
    "invoice_period_end",
  ]),
  BillingPeriodStart: Object.freeze([
    "BillingPeriodStart",
    "billing_period_start",
    "billingperiodstart",
    "bill/BillingPeriodStartDate",
    "billing_period_start_date",
    "invoice_period_start",
  ]),
  ChargeCategory: Object.freeze([
    "ChargeCategory",
    "charge_category",
    "lineItem/LineItemType",
    "line_item_type",
    "charge_type",
  ]),
  ChargeClass: Object.freeze([
    "ChargeClass",
    "charge_class",
    "chargeclass",
    "pricing/term",
    "term_type",
  ]),
  ChargePeriodStart: Object.freeze([
    "ChargePeriodStart",
    "charge_period_start",
    "chargeperiodstart",
    "usage_start",
    "usage_start_time",
    "lineItem/UsageStartDate",
    "usage_start_date",
    "start_time",
    "start_date",
  ]),
  ChargePeriodEnd: Object.freeze([
    "ChargePeriodEnd",
    "charge_period_end",
    "chargeperiodend",
    "usage_end",
    "usage_end_time",
    "lineItem/UsageEndDate",
    "usage_end_date",
    "end_time",
    "end_date",
  ]),
  ConsumedQuantity: Object.freeze([
    "ConsumedQuantity",
    "consumed_quantity",
    "usage_quantity",
    "lineItem/UsageAmount",
    "usageamount",
    "quantity",
  ]),
  ConsumedUnit: Object.freeze([
    "ConsumedUnit",
    "consumed_unit",
    "usage_unit",
    "pricing/unit",
    "unit",
    "uom",
  ]),
  EffectiveCost: Object.freeze([
    "EffectiveCost",
    "effective_cost",
    "effectivecost",
    "lineItem/NetUnblendedCost",
    "net_unblended_cost",
    "amortized_cost",
    "net_cost",
    "cost",
  ]),
  ListCost: Object.freeze([
    "ListCost",
    "list_cost",
    "listcost",
    "public_on_demand_cost",
    "pricing/publicOnDemandCost",
    "ondemand_cost",
  ]),
  PricingCategory: Object.freeze([
    "PricingCategory",
    "pricing_category",
    "pricingcategory",
    "purchase_option",
    "pricing/term",
    "term",
  ]),
  PricingQuantity: Object.freeze([
    "PricingQuantity",
    "pricing_quantity",
    "pricingquantity",
    "normalized_usage_amount",
    "normalized_usage",
  ]),
  PricingUnit: Object.freeze([
    "PricingUnit",
    "pricing_unit",
    "pricingunit",
    "price_unit",
    "unit",
  ]),
  ProviderName: Object.freeze([
    "ProviderName",
    "provider_name",
    "provider",
    "cloud_provider",
    "vendor",
    "source_provider",
  ]),
  RegionId: Object.freeze([
    "RegionId",
    "region_id",
    "regionid",
    "product/regionCode",
    "aws_region_code",
  ]),
  RegionName: Object.freeze([
    "RegionName",
    "region_name",
    "region",
    "product/region",
    "aws_region",
    "location",
  ]),
  ResourceId: Object.freeze([
    "ResourceId",
    "resource_id",
    "resourceid",
    "lineItem/ResourceId",
    "resource_arn",
    "arn",
    "instance_id",
  ]),
  ResourceName: Object.freeze([
    "ResourceName",
    "resource_name",
    "resourcename",
    "name",
  ]),
  ResourceType: Object.freeze([
    "ResourceType",
    "resource_type",
    "resourcetype",
    "product/ProductFamily",
    "product_family",
    "instance_type",
  ]),
  ServiceCategory: Object.freeze([
    "ServiceCategory",
    "service_category",
    "servicecategory",
    "product/servicecode",
    "service_code",
  ]),
  ServiceName: Object.freeze([
    "ServiceName",
    "service_name",
    "service",
    "product/ProductName",
    "product_name",
  ]),
  ServiceSubcategory: Object.freeze([
    "ServiceSubcategory",
    "service_subcategory",
    "servicesubcategory",
    "usage_type_group",
  ]),
  SkuId: Object.freeze([
    "SkuId",
    "sku_id",
    "skuid",
    "product/sku",
    "sku",
  ]),
  SkuPriceId: Object.freeze([
    "SkuPriceId",
    "sku_price_id",
    "skupriceid",
    "price_id",
    "pricing/rateId",
  ]),
  SubAccountId: Object.freeze([
    "SubAccountId",
    "sub_account_id",
    "subaccountid",
    "linked_account_id",
    "lineItem/UsageAccountId",
    "usage_account_id",
    "member_account_id",
  ]),
  SubAccountName: Object.freeze([
    "SubAccountName",
    "sub_account_name",
    "subaccountname",
    "linked_account_name",
    "usage_account_name",
  ]),
  Tags: Object.freeze([
    "Tags",
    "tags",
    "resource_tags",
    "tags_json",
    "lineItem/ResourceTags",
  ]),
  usage_start_time: Object.freeze([
    "usage_start_time",
    "ChargePeriodStart",
    "charge_period_start",
    "lineItem/UsageStartDate",
  ]),
  usage_end_time: Object.freeze([
    "usage_end_time",
    "ChargePeriodEnd",
    "charge_period_end",
    "lineItem/UsageEndDate",
  ]),
  usage_type: Object.freeze([
    "usage_type",
    "usagetype",
    "lineItem/UsageType",
  ]),
  operation: Object.freeze([
    "operation",
    "lineItem/Operation",
  ]),
  line_item_type: Object.freeze([
    "line_item_type",
    "ChargeFrequency",
    "charge_frequency",
    "lineItem/LineItemType",
  ]),
  pricing_term: Object.freeze([
    "pricing_term",
    "PricingCategory",
    "pricing_category",
    "pricing/term",
  ]),
  purchase_option: Object.freeze([
    "purchase_option",
    "PurchaseOption",
    "pricing/purchaseOption",
  ]),
  public_on_demand_cost: Object.freeze([
    "public_on_demand_cost",
    "ListCost",
    "list_cost",
    "pricing/publicOnDemandCost",
  ]),
  discount_amount: Object.freeze([
    "discount_amount",
    "discount",
    "savings_amount",
  ]),
  credit_amount: Object.freeze([
    "credit_amount",
    "credit",
    "credit_cost",
  ]),
  refund_amount: Object.freeze([
    "refund_amount",
    "refund",
    "refund_cost",
  ]),
  tax_cost: Object.freeze([
    "tax_cost",
    "tax",
    "tax_amount",
  ]),
  reservation_arn: Object.freeze([
    "reservation_arn",
    "reservationarn",
  ]),
  savings_plan_arn: Object.freeze([
    "savings_plan_arn",
    "savingsplanarn",
  ]),
  savings_plan_type: Object.freeze([
    "savings_plan_type",
    "savingsplantype",
  ]),
});

/**
 * Deterministic normalization:
 * - trim + lowercase
 * - drop separators/spaces and all non-alphanumeric chars
 */
function normalizeHeaderName(header) {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function appendLookupValue(lookupMap, key, canonicalColumn) {
  if (!key) return;
  const existing = lookupMap.get(key);
  if (existing) {
    existing.add(canonicalColumn);
    return;
  }
  lookupMap.set(key, new Set([canonicalColumn]));
}

/**
 * Build deterministic alias lookups used by validator matching steps.
 * Returns sets intentionally (not single values) so ambiguity can be detected.
 */
function buildAliasLookup() {
  const exactAliasLookup = new Map();
  const lowerAliasLookup = new Map();
  const normalizedAliasLookup = new Map();

  for (const canonicalColumn of CANONICAL_COLUMNS) {
    const aliases = COLUMN_ALIASES[canonicalColumn] ?? [];

    for (const alias of aliases) {
      const aliasString = String(alias ?? "").trim();
      if (!aliasString) continue;

      appendLookupValue(exactAliasLookup, aliasString, canonicalColumn);
      appendLookupValue(lowerAliasLookup, aliasString.toLowerCase(), canonicalColumn);
      appendLookupValue(normalizedAliasLookup, normalizeHeaderName(aliasString), canonicalColumn);
    }
  }

  return {
    exactAliasLookup,
    lowerAliasLookup,
    normalizedAliasLookup,
  };
}

export {
  CANONICAL_COLUMNS,
  REQUIRED_COLUMNS,
  OPTIONAL_COLUMNS,
  COLUMN_ALIASES,
  normalizeHeaderName,
  buildAliasLookup,
};




