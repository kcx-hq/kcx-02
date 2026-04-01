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
  "line_item_type",
  "pricing_term",
  "public_on_demand_cost",
  "discount_amount",
]);

const REQUIRED_COLUMNS = Object.freeze([
  "BillingAccountId",
  "BillingPeriodStart",
  "BillingPeriodEnd",
  "ChargePeriodStart",
  "EffectiveCost",
  "ProviderName",
  "RegionName",
  "ServiceName",
  "SubAccountId",
]);

const REQUIRED_COLUMN_SET = new Set(REQUIRED_COLUMNS);

const OPTIONAL_COLUMNS = Object.freeze(
  CANONICAL_COLUMNS.filter((columnName) => !REQUIRED_COLUMN_SET.has(columnName)),
);

const COLUMN_ALIASES = Object.freeze({
  AvailabilityZone: Object.freeze(["AvailabilityZone", "availability_zone", "az"]),
  BilledCost: Object.freeze(["BilledCost", "billed_cost"]),
  BillingAccountId: Object.freeze(["BillingAccountId", "billing_account_id", "account_id"]),
  BillingAccountName: Object.freeze(["BillingAccountName", "billing_account_name", "account_name"]),
  BillingCurrency: Object.freeze(["BillingCurrency", "billing_currency", "currency"]),
  BillingPeriodEnd: Object.freeze(["BillingPeriodEnd", "billing_period_end"]),
  BillingPeriodStart: Object.freeze(["BillingPeriodStart", "billing_period_start"]),
  ChargeCategory: Object.freeze(["ChargeCategory", "charge_category"]),
  ChargeClass: Object.freeze(["ChargeClass", "charge_class"]),
  ChargePeriodStart: Object.freeze(["ChargePeriodStart", "charge_period_start", "usage_start"]),
  ChargePeriodEnd: Object.freeze(["ChargePeriodEnd", "charge_period_end", "usage_end"]),
  ConsumedQuantity: Object.freeze(["ConsumedQuantity", "consumed_quantity", "usage_quantity"]),
  ConsumedUnit: Object.freeze(["ConsumedUnit", "consumed_unit", "usage_unit"]),
  EffectiveCost: Object.freeze(["EffectiveCost", "effective_cost", "cost"]),
  ListCost: Object.freeze(["ListCost", "list_cost"]),
  PricingCategory: Object.freeze(["PricingCategory", "pricing_category"]),
  PricingQuantity: Object.freeze(["PricingQuantity", "pricing_quantity"]),
  PricingUnit: Object.freeze(["PricingUnit", "pricing_unit"]),
  ProviderName: Object.freeze(["ProviderName", "provider_name", "provider"]),
  RegionId: Object.freeze(["RegionId", "region_id"]),
  RegionName: Object.freeze(["RegionName", "region_name", "region"]),
  ResourceId: Object.freeze(["ResourceId", "resource_id"]),
  ResourceName: Object.freeze(["ResourceName", "resource_name"]),
  ResourceType: Object.freeze(["ResourceType", "resource_type"]),
  ServiceCategory: Object.freeze(["ServiceCategory", "service_category"]),
  ServiceName: Object.freeze(["ServiceName", "service_name", "service"]),
  ServiceSubcategory: Object.freeze(["ServiceSubcategory", "service_subcategory"]),
  SkuId: Object.freeze(["SkuId", "sku_id"]),
  SkuPriceId: Object.freeze(["SkuPriceId", "sku_price_id"]),
  SubAccountId: Object.freeze(["SubAccountId", "sub_account_id"]),
  SubAccountName: Object.freeze(["SubAccountName", "sub_account_name"]),
  Tags: Object.freeze(["Tags", "tags", "resource_tags"]),
  usage_start_time: Object.freeze(["usage_start_time", "ChargePeriodStart", "charge_period_start"]),
  usage_end_time: Object.freeze(["usage_end_time", "ChargePeriodEnd", "charge_period_end"]),
  line_item_type: Object.freeze(["line_item_type", "ChargeFrequency", "charge_frequency"]),
  pricing_term: Object.freeze(["pricing_term", "PricingCategory", "pricing_category"]),
  public_on_demand_cost: Object.freeze(["public_on_demand_cost", "ListCost", "list_cost"]),
  discount_amount: Object.freeze(["discount_amount"]),
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
