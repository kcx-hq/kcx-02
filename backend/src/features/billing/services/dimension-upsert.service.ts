/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { Op } from "sequelize";

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

const isUniqueViolation = (error) => {
  const message = toErrorMessage(error).toLowerCase();
  const parentMessage =
    error && typeof error === "object" && "parent" in error && error.parent?.message
      ? String(error.parent.message).toLowerCase()
      : "";
  return (
    message.includes("duplicate key value violates unique constraint") ||
    parentMessage.includes("duplicate key value violates unique constraint")
  );
};

const serializeKey = (parts) =>
  JSON.stringify(parts.map((value) => (value === undefined ? null : value)));

const createIngestionDimensionCache = () => ({
  billingAccount: new Map(),
  subAccount: new Map(),
  region: new Map(),
  service: new Map(),
  resource: new Map(),
  sku: new Map(),
  charge: new Map(),
  date: new Map(),
});

/**
 * Dimension tables normalize repeated billing attributes (account/region/service/etc.)
 * so we store each unique combination once and reference it from facts via keys.
 */
async function getOrCreateBillingAccount({ rawRow, tenantId, providerId }) {
  if (!shouldUpsertDimBillingAccount(rawRow)) {
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
    if (isUniqueViolation(error)) {
      const where = {
        tenantId,
        providerId,
        billingAccountId: mapped.billing_account_id,
      };
      const existing = await DimBillingAccount.findOne({ where });
      if (existing) return existing.id;
    }
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
    if (isUniqueViolation(error)) {
      const where = {
        tenantId,
        providerId,
        subAccountId: mapped.sub_account_id,
      };
      const existing = await DimSubAccount.findOne({ where });
      if (existing) return existing.id;
    }
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
    if (isUniqueViolation(error)) {
      const where = {
        providerId,
        regionId: mapped.region_id,
        regionName: mapped.region_name,
        availabilityZone: mapped.availability_zone,
      };
      const existing = await DimRegion.findOne({ where });
      if (existing) return existing.id;
    }
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
    if (isUniqueViolation(error)) {
      const where = {
        providerId,
        serviceName: mapped.service_name,
        serviceCategory: mapped.service_category,
        serviceSubcategory: mapped.service_subcategory,
      };
      const existing = await DimService.findOne({ where });
      if (existing) return existing.id;
    }
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
    if (isUniqueViolation(error)) {
      const where = {
        tenantId,
        providerId,
        resourceId: mapped.resource_id,
      };
      const existing = await DimResource.findOne({ where });
      if (existing) return existing.id;
    }
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
    if (isUniqueViolation(error)) {
      const where = {
        providerId,
        skuId: mapped.sku_id,
        skuPriceId: mapped.sku_price_id,
        pricingCategory: mapped.pricing_category,
        pricingUnit: mapped.pricing_unit,
      };
      const existing = await DimSku.findOne({ where });
      if (existing) return existing.id;
    }
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
    if (isUniqueViolation(error)) {
      const where = {
        chargeCategory: mapped.charge_category,
        chargeClass: mapped.charge_class,
      };
      const existing = await DimCharge.findOne({ where });
      if (existing) return existing.id;
    }
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
    if (isUniqueViolation(error)) {
      const existing = await DimDate.findOne({ where: { fullDate } });
      if (existing) return existing.id;
    }
    throw new Error(`Failed to resolve dim_date: ${toErrorMessage(error)}`);
  }
}

async function resolveBillingAccountsBulk({ entries, tenantId, providerId, cache }) {
  if (entries.size === 0) return;

  const billingAccountIds = new Set();
  for (const entry of entries.values()) {
    billingAccountIds.add(entry.mapped.billing_account_id);
  }

  const existing = await DimBillingAccount.findAll({
    attributes: ["id", "billingAccountId"],
    where: {
      tenantId,
      providerId,
      billingAccountId: { [Op.in]: Array.from(billingAccountIds) },
    },
  });

  for (const row of existing) {
    const key = serializeKey([tenantId, providerId, row.billingAccountId]);
    cache.billingAccount.set(key, row.id);
  }

  const missingPayloads = [];
  for (const [key, entry] of entries) {
    if (!cache.billingAccount.has(key)) {
      missingPayloads.push({
        tenantId,
        providerId,
        billingAccountId: entry.mapped.billing_account_id,
        billingAccountName: entry.mapped.billing_account_name,
        billingCurrency: entry.mapped.billing_currency,
      });
    }
  }

  if (missingPayloads.length > 0) {
    await DimBillingAccount.bulkCreate(missingPayloads, { ignoreDuplicates: true, returning: false });
    const resolved = await DimBillingAccount.findAll({
      attributes: ["id", "billingAccountId"],
      where: {
        tenantId,
        providerId,
        billingAccountId: { [Op.in]: Array.from(billingAccountIds) },
      },
    });

    for (const row of resolved) {
      const key = serializeKey([tenantId, providerId, row.billingAccountId]);
      cache.billingAccount.set(key, row.id);
    }
  }
}

async function resolveSubAccountsBulk({ entries, tenantId, providerId, cache }) {
  if (entries.size === 0) return;

  const subAccountIds = new Set();
  for (const entry of entries.values()) {
    subAccountIds.add(entry.mapped.sub_account_id);
  }

  const existing = await DimSubAccount.findAll({
    attributes: ["id", "subAccountId"],
    where: {
      tenantId,
      providerId,
      subAccountId: { [Op.in]: Array.from(subAccountIds) },
    },
  });

  for (const row of existing) {
    const key = serializeKey([tenantId, providerId, row.subAccountId]);
    cache.subAccount.set(key, row.id);
  }

  const missingPayloads = [];
  for (const [key, entry] of entries) {
    if (!cache.subAccount.has(key)) {
      missingPayloads.push({
        tenantId,
        providerId,
        subAccountId: entry.mapped.sub_account_id,
        subAccountName: entry.mapped.sub_account_name,
      });
    }
  }

  if (missingPayloads.length > 0) {
    await DimSubAccount.bulkCreate(missingPayloads, { ignoreDuplicates: true, returning: false });
    const resolved = await DimSubAccount.findAll({
      attributes: ["id", "subAccountId"],
      where: {
        tenantId,
        providerId,
        subAccountId: { [Op.in]: Array.from(subAccountIds) },
      },
    });

    for (const row of resolved) {
      const key = serializeKey([tenantId, providerId, row.subAccountId]);
      cache.subAccount.set(key, row.id);
    }
  }
}

async function resolveResourcesBulk({ entries, tenantId, providerId, cache }) {
  if (entries.size === 0) return;

  const resourceIds = new Set();
  for (const entry of entries.values()) {
    resourceIds.add(entry.mapped.resource_id);
  }

  const existing = await DimResource.findAll({
    attributes: ["id", "resourceId"],
    where: {
      tenantId,
      providerId,
      resourceId: { [Op.in]: Array.from(resourceIds) },
    },
  });

  for (const row of existing) {
    const key = serializeKey([tenantId, providerId, row.resourceId]);
    cache.resource.set(key, row.id);
  }

  const missingPayloads = [];
  for (const [key, entry] of entries) {
    if (!cache.resource.has(key)) {
      missingPayloads.push({
        tenantId,
        providerId,
        resourceId: entry.mapped.resource_id,
        resourceName: entry.mapped.resource_name,
        resourceType: entry.mapped.resource_type,
      });
    }
  }

  if (missingPayloads.length > 0) {
    await DimResource.bulkCreate(missingPayloads, { ignoreDuplicates: true, returning: false });
    const resolved = await DimResource.findAll({
      attributes: ["id", "resourceId"],
      where: {
        tenantId,
        providerId,
        resourceId: { [Op.in]: Array.from(resourceIds) },
      },
    });

    for (const row of resolved) {
      const key = serializeKey([tenantId, providerId, row.resourceId]);
      cache.resource.set(key, row.id);
    }
  }
}

const buildPredicateList = (entries, toWhereClause) =>
  Array.from(entries.values()).map((entry) => toWhereClause(entry.mapped));

async function resolveRegionsBulk({ entries, providerId, cache }) {
  if (entries.size === 0) return;

  const predicates = buildPredicateList(entries, (mapped) => ({
    providerId,
    regionId: mapped.region_id,
    regionName: mapped.region_name,
    availabilityZone: mapped.availability_zone,
  }));

  const existing = await DimRegion.findAll({
    attributes: ["id", "providerId", "regionId", "regionName", "availabilityZone"],
    where: {
      [Op.or]: predicates,
    },
  });

  for (const row of existing) {
    const key = serializeKey([row.providerId, row.regionId, row.regionName, row.availabilityZone]);
    cache.region.set(key, row.id);
  }

  const missingPayloads = [];
  for (const [key, entry] of entries) {
    if (!cache.region.has(key)) {
      missingPayloads.push({
        providerId,
        regionId: entry.mapped.region_id,
        regionName: entry.mapped.region_name,
        availabilityZone: entry.mapped.availability_zone,
      });
    }
  }

  if (missingPayloads.length > 0) {
    await DimRegion.bulkCreate(missingPayloads, { ignoreDuplicates: true, returning: false });
    const resolved = await DimRegion.findAll({
      attributes: ["id", "providerId", "regionId", "regionName", "availabilityZone"],
      where: {
        [Op.or]: predicates,
      },
    });

    for (const row of resolved) {
      const key = serializeKey([row.providerId, row.regionId, row.regionName, row.availabilityZone]);
      cache.region.set(key, row.id);
    }
  }
}

async function resolveServicesBulk({ entries, providerId, cache }) {
  if (entries.size === 0) return;

  const predicates = buildPredicateList(entries, (mapped) => ({
    providerId,
    serviceName: mapped.service_name,
    serviceCategory: mapped.service_category,
    serviceSubcategory: mapped.service_subcategory,
  }));

  const existing = await DimService.findAll({
    attributes: ["id", "providerId", "serviceName", "serviceCategory", "serviceSubcategory"],
    where: {
      [Op.or]: predicates,
    },
  });

  for (const row of existing) {
    const key = serializeKey([
      row.providerId,
      row.serviceName,
      row.serviceCategory,
      row.serviceSubcategory,
    ]);
    cache.service.set(key, row.id);
  }

  const missingPayloads = [];
  for (const [key, entry] of entries) {
    if (!cache.service.has(key)) {
      missingPayloads.push({
        providerId,
        serviceName: entry.mapped.service_name,
        serviceCategory: entry.mapped.service_category,
        serviceSubcategory: entry.mapped.service_subcategory,
      });
    }
  }

  if (missingPayloads.length > 0) {
    await DimService.bulkCreate(missingPayloads, { ignoreDuplicates: true, returning: false });
    const resolved = await DimService.findAll({
      attributes: ["id", "providerId", "serviceName", "serviceCategory", "serviceSubcategory"],
      where: {
        [Op.or]: predicates,
      },
    });

    for (const row of resolved) {
      const key = serializeKey([
        row.providerId,
        row.serviceName,
        row.serviceCategory,
        row.serviceSubcategory,
      ]);
      cache.service.set(key, row.id);
    }
  }
}

async function resolveSkusBulk({ entries, providerId, cache }) {
  if (entries.size === 0) return;

  const predicates = buildPredicateList(entries, (mapped) => ({
    providerId,
    skuId: mapped.sku_id,
    skuPriceId: mapped.sku_price_id,
    pricingCategory: mapped.pricing_category,
    pricingUnit: mapped.pricing_unit,
  }));

  const existing = await DimSku.findAll({
    attributes: ["id", "providerId", "skuId", "skuPriceId", "pricingCategory", "pricingUnit"],
    where: {
      [Op.or]: predicates,
    },
  });

  for (const row of existing) {
    const key = serializeKey([
      row.providerId,
      row.skuId,
      row.skuPriceId,
      row.pricingCategory,
      row.pricingUnit,
    ]);
    cache.sku.set(key, row.id);
  }

  const missingPayloads = [];
  for (const [key, entry] of entries) {
    if (!cache.sku.has(key)) {
      missingPayloads.push({
        providerId,
        skuId: entry.mapped.sku_id,
        skuPriceId: entry.mapped.sku_price_id,
        pricingCategory: entry.mapped.pricing_category,
        pricingUnit: entry.mapped.pricing_unit,
      });
    }
  }

  if (missingPayloads.length > 0) {
    await DimSku.bulkCreate(missingPayloads, { ignoreDuplicates: true, returning: false });
    const resolved = await DimSku.findAll({
      attributes: ["id", "providerId", "skuId", "skuPriceId", "pricingCategory", "pricingUnit"],
      where: {
        [Op.or]: predicates,
      },
    });

    for (const row of resolved) {
      const key = serializeKey([
        row.providerId,
        row.skuId,
        row.skuPriceId,
        row.pricingCategory,
        row.pricingUnit,
      ]);
      cache.sku.set(key, row.id);
    }
  }
}

async function resolveChargesBulk({ entries, cache }) {
  if (entries.size === 0) return;

  const predicates = buildPredicateList(entries, (mapped) => ({
    chargeCategory: mapped.charge_category,
    chargeClass: mapped.charge_class,
  }));

  const existing = await DimCharge.findAll({
    attributes: ["id", "chargeCategory", "chargeClass"],
    where: {
      [Op.or]: predicates,
    },
  });

  for (const row of existing) {
    const key = serializeKey([row.chargeCategory, row.chargeClass]);
    cache.charge.set(key, row.id);
  }

  const missingPayloads = [];
  for (const [key, entry] of entries) {
    if (!cache.charge.has(key)) {
      missingPayloads.push({
        chargeCategory: entry.mapped.charge_category,
        chargeClass: entry.mapped.charge_class,
      });
    }
  }

  if (missingPayloads.length > 0) {
    await DimCharge.bulkCreate(missingPayloads, { ignoreDuplicates: true, returning: false });
    const resolved = await DimCharge.findAll({
      attributes: ["id", "chargeCategory", "chargeClass"],
      where: {
        [Op.or]: predicates,
      },
    });

    for (const row of resolved) {
      const key = serializeKey([row.chargeCategory, row.chargeClass]);
      cache.charge.set(key, row.id);
    }
  }
}

async function resolveDatesBulk({ fullDates, cache }) {
  if (fullDates.size === 0) return;

  const dateValues = Array.from(fullDates);
  const existing = await DimDate.findAll({
    attributes: ["id", "fullDate"],
    where: {
      fullDate: { [Op.in]: dateValues },
    },
  });

  for (const row of existing) {
    const key = serializeKey([row.fullDate]);
    cache.date.set(key, row.id);
  }

  const missingDates = dateValues.filter((fullDate) => !cache.date.has(serializeKey([fullDate])));
  if (missingDates.length > 0) {
    const payloads = [];
    for (const fullDate of missingDates) {
      const parsed = new Date(`${fullDate}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) {
        continue;
      }

      const monthOfYear = parsed.getUTCMonth() + 1;
      payloads.push({
        fullDate,
        dayOfMonth: parsed.getUTCDate(),
        monthOfYear,
        yearNumber: parsed.getUTCFullYear(),
        quarterNumber: Math.floor((monthOfYear - 1) / 3) + 1,
        monthName: parsed.toLocaleString("en-US", { month: "long", timeZone: "UTC" }),
        dayName: parsed.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" }),
      });
    }

    if (payloads.length > 0) {
      await DimDate.bulkCreate(payloads, { ignoreDuplicates: true, returning: false });
    }

    const resolved = await DimDate.findAll({
      attributes: ["id", "fullDate"],
      where: {
        fullDate: { [Op.in]: dateValues },
      },
    });

    for (const row of resolved) {
      const key = serializeKey([row.fullDate]);
      cache.date.set(key, row.id);
    }
  }
}

async function primeDimensionCacheForChunk({ rawRows, tenantId, providerId, cache }) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return;
  }

  const billingAccountEntries = new Map();
  const subAccountEntries = new Map();
  const regionEntries = new Map();
  const serviceEntries = new Map();
  const resourceEntries = new Map();
  const skuEntries = new Map();
  const chargeEntries = new Map();
  const dateEntries = new Set();

  for (const rawRow of rawRows) {
    if (shouldUpsertDimBillingAccount(rawRow)) {
      const mapped = mapDimBillingAccount(rawRow);
      const key = serializeKey([tenantId, providerId, mapped.billing_account_id]);
      if (!cache.billingAccount.has(key)) {
        billingAccountEntries.set(key, { mapped });
      }
    }

    if (shouldUpsertDimSubAccount(rawRow)) {
      const mapped = mapDimSubAccount(rawRow);
      const key = serializeKey([tenantId, providerId, mapped.sub_account_id]);
      if (!cache.subAccount.has(key)) {
        subAccountEntries.set(key, { mapped });
      }
    }

    if (shouldUpsertDimRegion(rawRow)) {
      const mapped = mapDimRegion(rawRow);
      const key = serializeKey([providerId, mapped.region_id, mapped.region_name, mapped.availability_zone]);
      if (!cache.region.has(key)) {
        regionEntries.set(key, { mapped });
      }
    }

    if (shouldUpsertDimService(rawRow)) {
      const mapped = mapDimService(rawRow);
      const key = serializeKey([
        providerId,
        mapped.service_name,
        mapped.service_category,
        mapped.service_subcategory,
      ]);
      if (!cache.service.has(key)) {
        serviceEntries.set(key, { mapped });
      }
    }

    if (shouldUpsertDimResource(rawRow)) {
      const mapped = mapDimResource(rawRow);
      const key = serializeKey([tenantId, providerId, mapped.resource_id]);
      if (!cache.resource.has(key)) {
        resourceEntries.set(key, { mapped });
      }
    }

    if (shouldUpsertDimSku(rawRow)) {
      const mapped = mapDimSku(rawRow);
      const key = serializeKey([
        providerId,
        mapped.sku_id,
        mapped.sku_price_id,
        mapped.pricing_category,
        mapped.pricing_unit,
      ]);
      if (!cache.sku.has(key)) {
        skuEntries.set(key, { mapped });
      }
    }

    if (shouldUpsertDimCharge(rawRow)) {
      const mapped = mapDimCharge(rawRow);
      const key = serializeKey([mapped.charge_category, mapped.charge_class]);
      if (!cache.charge.has(key)) {
        chargeEntries.set(key, { mapped });
      }
    }

    const {
      usage_full_date: usageFullDate,
      billing_period_start_full_date: billingPeriodStartFullDate,
      billing_period_end_full_date: billingPeriodEndFullDate,
    } = mapDateLookups(rawRow);

    if (usageFullDate && !cache.date.has(serializeKey([usageFullDate]))) {
      dateEntries.add(usageFullDate);
    }
    if (billingPeriodStartFullDate && !cache.date.has(serializeKey([billingPeriodStartFullDate]))) {
      dateEntries.add(billingPeriodStartFullDate);
    }
    if (billingPeriodEndFullDate && !cache.date.has(serializeKey([billingPeriodEndFullDate]))) {
      dateEntries.add(billingPeriodEndFullDate);
    }
  }

  await Promise.all([
    resolveBillingAccountsBulk({ entries: billingAccountEntries, tenantId, providerId, cache }),
    resolveSubAccountsBulk({ entries: subAccountEntries, tenantId, providerId, cache }),
    resolveRegionsBulk({ entries: regionEntries, providerId, cache }),
    resolveServicesBulk({ entries: serviceEntries, providerId, cache }),
    resolveResourcesBulk({ entries: resourceEntries, tenantId, providerId, cache }),
    resolveSkusBulk({ entries: skuEntries, providerId, cache }),
    resolveChargesBulk({ entries: chargeEntries, cache }),
    resolveDatesBulk({ fullDates: dateEntries, cache }),
  ]);
}

async function resolveDimensionsWithCache({ rawRow, tenantId, providerId, cache }) {
  const effectiveCache = cache ?? createIngestionDimensionCache();

  try {
    const providerResolutionInput = mapProviderResolutionInput(rawRow);
    void providerResolutionInput;

    let billingAccountKey = null;
    if (shouldUpsertDimBillingAccount(rawRow)) {
      const mapped = mapDimBillingAccount(rawRow);
      const key = serializeKey([tenantId, providerId, mapped.billing_account_id]);
      billingAccountKey = effectiveCache.billingAccount.get(key);
      if (!billingAccountKey) {
        billingAccountKey = await getOrCreateBillingAccount({ rawRow, tenantId, providerId });
        if (billingAccountKey) {
          effectiveCache.billingAccount.set(key, billingAccountKey);
        }
      }
    }

    let subAccountKey = null;
    if (shouldUpsertDimSubAccount(rawRow)) {
      const mapped = mapDimSubAccount(rawRow);
      const key = serializeKey([tenantId, providerId, mapped.sub_account_id]);
      subAccountKey = effectiveCache.subAccount.get(key);
      if (!subAccountKey) {
        subAccountKey = await getOrCreateSubAccount({ rawRow, tenantId, providerId });
        if (subAccountKey) {
          effectiveCache.subAccount.set(key, subAccountKey);
        }
      }
    }

    let regionKey = null;
    if (shouldUpsertDimRegion(rawRow)) {
      const mapped = mapDimRegion(rawRow);
      const key = serializeKey([providerId, mapped.region_id, mapped.region_name, mapped.availability_zone]);
      regionKey = effectiveCache.region.get(key);
      if (!regionKey) {
        regionKey = await getOrCreateRegion({ rawRow, providerId });
        if (regionKey) {
          effectiveCache.region.set(key, regionKey);
        }
      }
    }

    let serviceKey = null;
    if (shouldUpsertDimService(rawRow)) {
      const mapped = mapDimService(rawRow);
      const key = serializeKey([
        providerId,
        mapped.service_name,
        mapped.service_category,
        mapped.service_subcategory,
      ]);
      serviceKey = effectiveCache.service.get(key);
      if (!serviceKey) {
        serviceKey = await getOrCreateService({ rawRow, providerId });
        if (serviceKey) {
          effectiveCache.service.set(key, serviceKey);
        }
      }
    }

    let resourceKey = null;
    if (shouldUpsertDimResource(rawRow)) {
      const mapped = mapDimResource(rawRow);
      const key = serializeKey([tenantId, providerId, mapped.resource_id]);
      resourceKey = effectiveCache.resource.get(key);
      if (!resourceKey) {
        resourceKey = await getOrCreateResource({ rawRow, tenantId, providerId });
        if (resourceKey) {
          effectiveCache.resource.set(key, resourceKey);
        }
      }
    }

    let skuKey = null;
    if (shouldUpsertDimSku(rawRow)) {
      const mapped = mapDimSku(rawRow);
      const key = serializeKey([
        providerId,
        mapped.sku_id,
        mapped.sku_price_id,
        mapped.pricing_category,
        mapped.pricing_unit,
      ]);
      skuKey = effectiveCache.sku.get(key);
      if (!skuKey) {
        skuKey = await getOrCreateSku({ rawRow, providerId });
        if (skuKey) {
          effectiveCache.sku.set(key, skuKey);
        }
      }
    }

    let chargeKey = null;
    if (shouldUpsertDimCharge(rawRow)) {
      const mapped = mapDimCharge(rawRow);
      const key = serializeKey([mapped.charge_category, mapped.charge_class]);
      chargeKey = effectiveCache.charge.get(key);
      if (!chargeKey) {
        chargeKey = await getOrCreateCharge({ rawRow });
        if (chargeKey) {
          effectiveCache.charge.set(key, chargeKey);
        }
      }
    }

    const {
      usage_full_date: usageFullDate,
      billing_period_start_full_date: billingPeriodStartFullDate,
      billing_period_end_full_date: billingPeriodEndFullDate,
    } = mapDateLookups(rawRow);

    let usageDateKey = null;
    if (usageFullDate) {
      const usageDateCacheKey = serializeKey([usageFullDate]);
      usageDateKey = effectiveCache.date.get(usageDateCacheKey);
      if (!usageDateKey) {
        usageDateKey = await getOrCreateDate(usageFullDate);
        if (usageDateKey) {
          effectiveCache.date.set(usageDateCacheKey, usageDateKey);
        }
      }
    }

    let billingPeriodStartDateKey = null;
    if (billingPeriodStartFullDate) {
      const billingStartCacheKey = serializeKey([billingPeriodStartFullDate]);
      billingPeriodStartDateKey = effectiveCache.date.get(billingStartCacheKey);
      if (!billingPeriodStartDateKey) {
        billingPeriodStartDateKey = await getOrCreateDate(billingPeriodStartFullDate);
        if (billingPeriodStartDateKey) {
          effectiveCache.date.set(billingStartCacheKey, billingPeriodStartDateKey);
        }
      }
    }

    let billingPeriodEndDateKey = null;
    if (billingPeriodEndFullDate) {
      const billingEndCacheKey = serializeKey([billingPeriodEndFullDate]);
      billingPeriodEndDateKey = effectiveCache.date.get(billingEndCacheKey);
      if (!billingPeriodEndDateKey) {
        billingPeriodEndDateKey = await getOrCreateDate(billingPeriodEndFullDate);
        if (billingPeriodEndDateKey) {
          effectiveCache.date.set(billingEndCacheKey, billingPeriodEndDateKey);
        }
      }
    }

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

async function resolveDimensions({ rawRow, tenantId, providerId }) {
  return resolveDimensionsWithCache({
    rawRow,
    tenantId,
    providerId,
    cache: createIngestionDimensionCache(),
  });
}

export {
  createIngestionDimensionCache,
  primeDimensionCacheForChunk,
  resolveDimensions,
  resolveDimensionsWithCache,
};




