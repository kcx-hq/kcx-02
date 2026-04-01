import {
  DimBillingAccount,
  DimSubAccount,
  DimRegion,
  DimService,
  DimResource,
  DimSku,
  DimCharge,
  DimDate,
} from "../../../models/index.js";
import {
  mapDimBillingAccount,
  mapDimSubAccount,
  mapDimRegion,
  mapDimService,
  mapDimResource,
  mapDimSku,
  mapDimCharge,
  mapDateLookups,
  mapProviderResolutionInput,
  shouldUpsertDimBillingAccount,
  shouldUpsertDimSubAccount,
  shouldUpsertDimRegion,
  shouldUpsertDimService,
  shouldUpsertDimResource,
  shouldUpsertDimSku,
  shouldUpsertDimCharge,
} from "../mappers/raw_focus_to_dimensions.mapper.js";

const toErrorMessage = (error) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return String(error);
};

/**
 * Dimension tables normalize repeated billing attributes (account/region/service/etc.)
 * so we store each unique combination once and reference it from facts via keys.
 */
async function getOrCreateBillingAccount({ rawRow, tenantId, providerId }) {
  if (!shouldUpsertDimBillingAccount(rawRow)) {
    // Null checks prevent writing empty dimension rows and keep FK columns nullable by design.
    return null;
  }

  const mapped = mapDimBillingAccount(rawRow);

  try {
    const where = {
      tenantId,
      providerId,
      billingAccountId: mapped.billing_account_id,
    };

    const existing = await DimBillingAccount.findOne({ where });
    if (existing) return existing.id;

    const created = await DimBillingAccount.create({
      tenantId,
      providerId,
      billingAccountId: mapped.billing_account_id,
      billingAccountName: mapped.billing_account_name,
      billingCurrency: mapped.billing_currency,
    });

    return created.id;
  } catch (error) {
    throw new Error(`Failed to resolve dim_billing_account: ${toErrorMessage(error)}`);
  }
}

async function getOrCreateSubAccount({ rawRow, tenantId, providerId }) {
  if (!shouldUpsertDimSubAccount(rawRow)) {
    return null;
  }

  const mapped = mapDimSubAccount(rawRow);

  try {
    const where = {
      tenantId,
      providerId,
      subAccountId: mapped.sub_account_id,
    };

    const existing = await DimSubAccount.findOne({ where });
    if (existing) return existing.id;

    const created = await DimSubAccount.create({
      tenantId,
      providerId,
      subAccountId: mapped.sub_account_id,
      subAccountName: mapped.sub_account_name,
    });

    return created.id;
  } catch (error) {
    throw new Error(`Failed to resolve dim_sub_account: ${toErrorMessage(error)}`);
  }
}

async function getOrCreateRegion({ rawRow, providerId }) {
  if (!shouldUpsertDimRegion(rawRow)) {
    return null;
  }

  const mapped = mapDimRegion(rawRow);

  try {
    const where = {
      providerId,
      regionId: mapped.region_id,
      regionName: mapped.region_name,
      availabilityZone: mapped.availability_zone,
    };

    const existing = await DimRegion.findOne({ where });
    if (existing) return existing.id;

    const created = await DimRegion.create({
      providerId,
      regionId: mapped.region_id,
      regionName: mapped.region_name,
      availabilityZone: mapped.availability_zone,
    });

    return created.id;
  } catch (error) {
    throw new Error(`Failed to resolve dim_region: ${toErrorMessage(error)}`);
  }
}

async function getOrCreateService({ rawRow, providerId }) {
  if (!shouldUpsertDimService(rawRow)) {
    return null;
  }

  const mapped = mapDimService(rawRow);

  try {
    const where = {
      providerId,
      serviceName: mapped.service_name,
      serviceCategory: mapped.service_category,
      serviceSubcategory: mapped.service_subcategory,
    };

    const existing = await DimService.findOne({ where });
    if (existing) return existing.id;

    const created = await DimService.create({
      providerId,
      serviceName: mapped.service_name,
      serviceCategory: mapped.service_category,
      serviceSubcategory: mapped.service_subcategory,
    });

    return created.id;
  } catch (error) {
    throw new Error(`Failed to resolve dim_service: ${toErrorMessage(error)}`);
  }
}

async function getOrCreateResource({ rawRow, tenantId, providerId }) {
  if (!shouldUpsertDimResource(rawRow)) {
    return null;
  }

  const mapped = mapDimResource(rawRow);

  try {
    const where = {
      tenantId,
      providerId,
      resourceId: mapped.resource_id,
    };

    const existing = await DimResource.findOne({ where });
    if (existing) return existing.id;

    const created = await DimResource.create({
      tenantId,
      providerId,
      resourceId: mapped.resource_id,
      resourceName: mapped.resource_name,
      resourceType: mapped.resource_type,
    });

    return created.id;
  } catch (error) {
    throw new Error(`Failed to resolve dim_resource: ${toErrorMessage(error)}`);
  }
}

async function getOrCreateSku({ rawRow, providerId }) {
  if (!shouldUpsertDimSku(rawRow)) {
    return null;
  }

  const mapped = mapDimSku(rawRow);

  try {
    const where = {
      providerId,
      skuId: mapped.sku_id,
      skuPriceId: mapped.sku_price_id,
      pricingCategory: mapped.pricing_category,
      pricingUnit: mapped.pricing_unit,
    };

    const existing = await DimSku.findOne({ where });
    if (existing) return existing.id;

    const created = await DimSku.create({
      providerId,
      skuId: mapped.sku_id,
      skuPriceId: mapped.sku_price_id,
      pricingCategory: mapped.pricing_category,
      pricingUnit: mapped.pricing_unit,
    });

    return created.id;
  } catch (error) {
    throw new Error(`Failed to resolve dim_sku: ${toErrorMessage(error)}`);
  }
}

async function getOrCreateCharge({ rawRow }) {
  if (!shouldUpsertDimCharge(rawRow)) {
    return null;
  }

  const mapped = mapDimCharge(rawRow);

  try {
    const where = {
      chargeCategory: mapped.charge_category,
      chargeClass: mapped.charge_class,
    };

    const existing = await DimCharge.findOne({ where });
    if (existing) return existing.id;

    const created = await DimCharge.create({
      chargeCategory: mapped.charge_category,
      chargeClass: mapped.charge_class,
    });

    return created.id;
  } catch (error) {
    throw new Error(`Failed to resolve dim_charge: ${toErrorMessage(error)}`);
  }
}

async function getOrCreateDate(fullDate) {
  if (!fullDate) {
    return null;
  }

  try {
    const existing = await DimDate.findOne({ where: { fullDate } });
    if (existing) return existing.id;

    const parsed = new Date(`${fullDate}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid full_date: ${fullDate}`);
    }

    const monthOfYear = parsed.getUTCMonth() + 1;
    const created = await DimDate.create({
      fullDate,
      dayOfMonth: parsed.getUTCDate(),
      monthOfYear,
      yearNumber: parsed.getUTCFullYear(),
      quarterNumber: Math.floor((monthOfYear - 1) / 3) + 1,
      monthName: parsed.toLocaleString("en-US", { month: "long", timeZone: "UTC" }),
      dayName: parsed.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" }),
    });

    return created.id;
  } catch (error) {
    throw new Error(`Failed to resolve dim_date: ${toErrorMessage(error)}`);
  }
}

async function resolveDimensions({ rawRow, tenantId, providerId }) {
  try {
    // Provider resolution belongs to orchestration; here we only validate mapper compatibility.
    const providerResolutionInput = mapProviderResolutionInput(rawRow);
    void providerResolutionInput;

    // Keys are used in fact rows instead of raw text values to keep fact storage compact,
    // consistent, and query-efficient across repeated categorical values.
    const [
      billingAccountKey,
      subAccountKey,
      regionKey,
      serviceKey,
      resourceKey,
      skuKey,
      chargeKey,
    ] = await Promise.all([
      getOrCreateBillingAccount({ rawRow, tenantId, providerId }),
      getOrCreateSubAccount({ rawRow, tenantId, providerId }),
      getOrCreateRegion({ rawRow, providerId }),
      getOrCreateService({ rawRow, providerId }),
      getOrCreateResource({ rawRow, tenantId, providerId }),
      getOrCreateSku({ rawRow, providerId }),
      getOrCreateCharge({ rawRow }),
    ]);

    const {
      usage_full_date: usageFullDate,
      billing_period_start_full_date: billingPeriodStartFullDate,
      billing_period_end_full_date: billingPeriodEndFullDate,
    } = mapDateLookups(rawRow);

    const [usageDateKey, billingPeriodStartDateKey, billingPeriodEndDateKey] = await Promise.all([
      getOrCreateDate(usageFullDate),
      getOrCreateDate(billingPeriodStartFullDate),
      getOrCreateDate(billingPeriodEndFullDate),
    ]);

    // Can be optimized later using bulk upsert or caching.
    return {
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
    };
  } catch (error) {
    throw new Error(`Failed to resolve billing dimensions: ${toErrorMessage(error)}`);
  }
}

export { resolveDimensions };
