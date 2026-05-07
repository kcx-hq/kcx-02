import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import {
  classifyLoadBalancerCurLineItem,
  type LoadBalancerCurClassifierInput,
} from "./load-balancer-cur.classifier.js";
import {
  LoadBalancerCostDailyRepository,
  type LoadBalancerCostDailyRowUpsertInput,
} from "./load-balancer-cost-daily.repository.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const validateDateOnly = (value: string, field: "startDate" | "endDate"): void => {
  if (!DATE_ONLY_REGEX.test(value)) {
    throw new Error(`${field} must be in YYYY-MM-DD format`);
  }
};

const normalizeTrim = (value: string | null | undefined): string => String(value ?? "").trim();
const normalizeLower = (value: string | null | undefined): string => normalizeTrim(value).toLowerCase();

const toNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const toFixed6 = (value: number): string => value.toFixed(6);

const resolveProjectCostAmount = (row: CurFactRow): number => {
  // Follow existing convention used in historical cost builders: billed_cost first.
  if (row.billedCost !== null && row.billedCost !== undefined) return toNumber(row.billedCost);
  if (row.effectiveCost !== null && row.effectiveCost !== undefined) return toNumber(row.effectiveCost);
  if (row.listCost !== null && row.listCost !== undefined) return toNumber(row.listCost);
  return 0;
};

const isBytesQuantitySignal = (row: CurFactRow): boolean => {
  const blob = [
    normalizeLower(row.usageType),
    normalizeLower(row.productUsageType),
    normalizeLower(row.lineItemDescription),
  ].join(" ");

  return (
    blob.includes("processedbytes")
    || blob.includes("dataprocessing-bytes")
    || blob.includes("bytes")
  );
};

const toGiBFromUsageQuantity = (row: CurFactRow): number => {
  const quantity = toNumber(row.usageQuantity);
  if (quantity <= 0) return 0;

  const usageType = normalizeLower(row.usageType);
  const productUsageType = normalizeLower(row.productUsageType);
  const lineItemDescription = normalizeLower(row.lineItemDescription);
  const blob = `${usageType} ${productUsageType} ${lineItemDescription}`;

  if (blob.includes("gb")) return quantity;
  if (blob.includes("gib")) return quantity;
  if (blob.includes("byte")) return quantity / (1024 ** 3);
  return quantity;
};

type SyncLoadBalancerCostDailyParams = {
  startDate: string;
  endDate: string;
  cloudConnectionId?: string | null;
  accountId?: string | null;
  region?: string | null;
  rebuildRange?: boolean;
  triggerSource?: "ingestion" | "scheduler";
};

type CurFactRow = {
  usageDate: string;
  cloudConnectionId: string | null;
  accountId: string | null;
  region: string | null;
  resourceId: string | null;
  serviceName: string | null;
  serviceCategory: string | null;
  usageType: string | null;
  productUsageType: string | null;
  productFamily: string | null;
  operation: string | null;
  lineItemDescription: string | null;
  lineItemType: string | null;
  usageQuantity: string | null;
  billedCost: string | null;
  effectiveCost: string | null;
  listCost: string | null;
  currencyCode: string | null;
};

type InventoryArnRow = {
  cloudConnectionId: string | null;
  accountId: string;
  region: string;
  arn: string;
  name?: string | null;
};

type ArnRelationRow = {
  arn: string;
  loadBalancerArn: string;
};

type AggregateBucket = {
  cloudConnectionId: string | null;
  accountId: string;
  region: string;
  loadBalancerArn: string;
  usageDate: string;
  totalCost: number;
  fixedCost: number;
  lcuCost: number;
  dataProcessingCost: number;
  processedBytesGb: number;
  usageQuantity: number;
  lineItemCount: number;
  currencyCode: string;
};

const buildAggregateKey = (row: {
  cloudConnectionId: string | null;
  accountId: string;
  region: string;
  loadBalancerArn: string;
  usageDate: string;
}): string =>
  [
    normalizeLower(row.cloudConnectionId),
    normalizeLower(row.accountId),
    normalizeLower(row.region),
    normalizeLower(row.loadBalancerArn),
    row.usageDate,
  ].join("|");

async function fetchCurFactRows(params: SyncLoadBalancerCostDailyParams): Promise<CurFactRow[]> {
  return sequelize.query<CurFactRow>(
    `
SELECT
  COALESCE(dd_usage.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time)))::text AS "usageDate",
  bs.cloud_connection_id::text AS "cloudConnectionId",
  COALESCE(NULLIF(TRIM(dsa.sub_account_id), ''), NULLIF(TRIM(dba.billing_account_id), '')) AS "accountId",
  COALESCE(NULLIF(TRIM(drgn.region_id), ''), NULLIF(TRIM(drgn.region_name), ''), NULLIF(TRIM(f.from_region_code), ''), NULLIF(TRIM(f.to_region_code), '')) AS "region",
  NULLIF(TRIM(dres.resource_id), '') AS "resourceId",
  NULLIF(TRIM(ds.service_name), '') AS "serviceName",
  NULLIF(TRIM(ds.service_category), '') AS "serviceCategory",
  NULLIF(TRIM(f.usage_type), '') AS "usageType",
  NULLIF(TRIM(f.product_usage_type), '') AS "productUsageType",
  NULLIF(TRIM(f.product_family), '') AS "productFamily",
  NULLIF(TRIM(f.operation), '') AS "operation",
  NULLIF(TRIM(f.line_item_description), '') AS "lineItemDescription",
  NULLIF(TRIM(f.line_item_type), '') AS "lineItemType",
  f.consumed_quantity::text AS "usageQuantity",
  f.billed_cost::text AS "billedCost",
  f.effective_cost::text AS "effectiveCost",
  f.list_cost::text AS "listCost",
  COALESCE(NULLIF(TRIM(dba.billing_currency), ''), 'USD') AS "currencyCode"
FROM fact_cost_line_items f
LEFT JOIN dim_date dd_usage
  ON dd_usage.id = f.usage_date_key
LEFT JOIN billing_sources bs
  ON bs.id = f.billing_source_id
LEFT JOIN dim_sub_account dsa
  ON dsa.id = f.sub_account_key
LEFT JOIN dim_billing_account dba
  ON dba.id = f.billing_account_key
LEFT JOIN dim_region drgn
  ON drgn.id = f.region_key
LEFT JOIN dim_resource dres
  ON dres.id = f.resource_key
LEFT JOIN dim_service ds
  ON ds.id = f.service_key
WHERE COALESCE(dd_usage.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) >= CAST(:startDate AS date)
  AND COALESCE(dd_usage.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) <= CAST(:endDate AS date)
  AND (CAST(:cloudConnectionId AS uuid) IS NULL OR bs.cloud_connection_id = CAST(:cloudConnectionId AS uuid))
  AND (:accountId::text IS NULL OR COALESCE(NULLIF(TRIM(dsa.sub_account_id), ''), NULLIF(TRIM(dba.billing_account_id), '')) = :accountId::text)
  AND (:region::text IS NULL OR COALESCE(NULLIF(TRIM(drgn.region_id), ''), NULLIF(TRIM(drgn.region_name), ''), NULLIF(TRIM(f.from_region_code), ''), NULLIF(TRIM(f.to_region_code), '')) = :region::text)
  AND (
    LOWER(COALESCE(ds.service_name, '')) LIKE '%load balanc%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%loadbalancer%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%lcu%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%processedbytes%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%dataprocessing-bytes%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%loadbalancer%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%lcu%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%processedbytes%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%dataprocessing-bytes%'
    OR LOWER(COALESCE(dres.resource_id, '')) LIKE '%elasticloadbalancing%'
  );
    `,
    {
      replacements: {
        startDate: params.startDate,
        endDate: params.endDate,
        cloudConnectionId: normalizeTrim(params.cloudConnectionId) || null,
        accountId: normalizeTrim(params.accountId) || null,
        region: normalizeTrim(params.region) || null,
      },
      type: QueryTypes.SELECT,
    },
  );
}

async function fetchInventoryArnMap(params: SyncLoadBalancerCostDailyParams): Promise<Map<string, InventoryArnRow>> {
  const rows = await sequelize.query<InventoryArnRow>(
    `
SELECT
  cloud_connection_id::text AS "cloudConnectionId",
  account_id AS "accountId",
  region AS "region",
  arn AS "arn",
  name AS "name"
FROM load_balancers
WHERE (CAST(:cloudConnectionId AS uuid) IS NULL OR cloud_connection_id = CAST(:cloudConnectionId AS uuid))
  AND (:accountId::text IS NULL OR account_id = :accountId::text)
  AND (:region::text IS NULL OR region = :region::text);
    `,
    {
      replacements: {
        cloudConnectionId: normalizeTrim(params.cloudConnectionId) || null,
        accountId: normalizeTrim(params.accountId) || null,
        region: normalizeTrim(params.region) || null,
      },
      type: QueryTypes.SELECT,
    },
  );

  const out = new Map<string, InventoryArnRow>();
  for (const row of rows) {
    const arn = normalizeTrim(row.arn);
    if (!arn) continue;
    out.set(normalizeLower(arn), row);
  }
  return out;
}

async function fetchTargetGroupToLoadBalancerArnMap(
  params: SyncLoadBalancerCostDailyParams,
): Promise<Map<string, string>> {
  const rows = await sequelize.query<ArnRelationRow>(
    `
SELECT
  arn AS "arn",
  load_balancer_arn AS "loadBalancerArn"
FROM load_balancer_target_groups
WHERE load_balancer_arn IS NOT NULL
  AND (CAST(:cloudConnectionId AS uuid) IS NULL OR cloud_connection_id = CAST(:cloudConnectionId AS uuid))
  AND (:accountId::text IS NULL OR account_id = :accountId::text)
  AND (:region::text IS NULL OR region = :region::text);
    `,
    {
      replacements: {
        cloudConnectionId: normalizeTrim(params.cloudConnectionId) || null,
        accountId: normalizeTrim(params.accountId) || null,
        region: normalizeTrim(params.region) || null,
      },
      type: QueryTypes.SELECT,
    },
  );

  const out = new Map<string, string>();
  for (const row of rows) {
    const arn = normalizeTrim(row.arn);
    const lbArn = normalizeTrim(row.loadBalancerArn);
    if (!arn || !lbArn) continue;
    out.set(normalizeLower(arn), lbArn);
  }
  return out;
}

async function fetchListenerToLoadBalancerArnMap(
  params: SyncLoadBalancerCostDailyParams,
): Promise<Map<string, string>> {
  const rows = await sequelize.query<ArnRelationRow>(
    `
SELECT
  arn AS "arn",
  load_balancer_arn AS "loadBalancerArn"
FROM load_balancer_listeners
WHERE load_balancer_arn IS NOT NULL
  AND (CAST(:cloudConnectionId AS uuid) IS NULL OR cloud_connection_id = CAST(:cloudConnectionId AS uuid))
  AND (:accountId::text IS NULL OR account_id = :accountId::text)
  AND (:region::text IS NULL OR region = :region::text);
    `,
    {
      replacements: {
        cloudConnectionId: normalizeTrim(params.cloudConnectionId) || null,
        accountId: normalizeTrim(params.accountId) || null,
        region: normalizeTrim(params.region) || null,
      },
      type: QueryTypes.SELECT,
    },
  );

  const out = new Map<string, string>();
  for (const row of rows) {
    const arn = normalizeTrim(row.arn);
    const lbArn = normalizeTrim(row.loadBalancerArn);
    if (!arn || !lbArn) continue;
    out.set(normalizeLower(arn), lbArn);
  }
  return out;
}

function resolveMatchedLoadBalancer(
  candidateArn: string | null,
  rowScope: { cloudConnectionId: string | null; accountId: string | null; region: string | null },
  inventoryArnMap: Map<string, InventoryArnRow>,
  targetGroupToLoadBalancerArnMap: Map<string, string>,
  listenerToLoadBalancerArnMap: Map<string, string>,
): InventoryArnRow | null {
  const arn = normalizeTrim(candidateArn);
  const normalizedArn = normalizeLower(arn);

  const scopeRows = Array.from(inventoryArnMap.values()).filter(
    (item) =>
      normalizeLower(item.cloudConnectionId) === normalizeLower(rowScope.cloudConnectionId)
      && normalizeLower(item.accountId) === normalizeLower(rowScope.accountId)
      && normalizeLower(item.region) === normalizeLower(rowScope.region),
  );

  if (normalizedArn) {
    const direct = inventoryArnMap.get(normalizedArn);
    if (direct) return direct;

    const fromTargetGroupArn = targetGroupToLoadBalancerArnMap.get(normalizedArn);
    if (fromTargetGroupArn) {
      const mapped = inventoryArnMap.get(normalizeLower(fromTargetGroupArn));
      if (mapped) return mapped;
    }

    const fromListenerArn = listenerToLoadBalancerArnMap.get(normalizedArn);
    if (fromListenerArn) {
      const mapped = inventoryArnMap.get(normalizeLower(fromListenerArn));
      if (mapped) return mapped;
    }

    // Fallback: try name/suffix style matching when CUR doesn't keep full LB ARN.
    const fromScopeHeuristic = scopeRows.find((item) => {
      const name = normalizeLower(item.name);
      const arnLower = normalizeLower(item.arn);
      const lbSuffix = arnLower.includes(":loadbalancer/")
        ? arnLower.split(":loadbalancer/")[1]
        : "";
      return (
        (name && (normalizedArn === name || normalizedArn.includes(name)))
        || (lbSuffix && (normalizedArn === lbSuffix || normalizedArn.includes(lbSuffix)))
        || (arnLower && arnLower.includes(normalizedArn))
      );
    });
    if (fromScopeHeuristic) return fromScopeHeuristic;
  }

  // Last-resort fallback for scoped runs: if exactly one LB in scope, bind to it.
  if (scopeRows.length === 1) {
    return scopeRows[0];
  }

  return null;
}

export async function syncLoadBalancerCostDaily(
  params: SyncLoadBalancerCostDailyParams,
): Promise<{
  rowsScanned: number;
  rowsClassified: number;
  rowsUnmatched: number;
  rowsUpserted: number;
  rowsDeleted: number;
}> {
  validateDateOnly(params.startDate, "startDate");
  validateDateOnly(params.endDate, "endDate");
  if (params.startDate > params.endDate) {
    throw new Error("startDate must be less than or equal to endDate");
  }

  const startedAt = Date.now();
  logger.info("Load balancer cost daily sync started", {
    triggerSource: params.triggerSource ?? "scheduler",
    startDate: params.startDate,
    endDate: params.endDate,
    cloudConnectionId: normalizeTrim(params.cloudConnectionId) || null,
    accountId: normalizeTrim(params.accountId) || null,
    region: normalizeTrim(params.region) || null,
    rebuildRange: params.rebuildRange !== false,
  });

  const repository = new LoadBalancerCostDailyRepository();
  const curRows = await fetchCurFactRows(params);
  const inventoryArnMap = await fetchInventoryArnMap(params);
  const targetGroupToLoadBalancerArnMap = await fetchTargetGroupToLoadBalancerArnMap(params);
  const listenerToLoadBalancerArnMap = await fetchListenerToLoadBalancerArnMap(params);

  let rowsClassified = 0;
  let rowsUnmatched = 0;

  const aggregateMap = new Map<string, AggregateBucket>();

  for (const row of curRows) {
    const classifierInput: LoadBalancerCurClassifierInput = {
      productName: row.serviceName,
      serviceName: row.serviceName,
      serviceCategory: row.serviceCategory,
      usageType: row.usageType,
      productUsageType: row.productUsageType,
      operation: row.operation,
      lineItemDescription: row.lineItemDescription,
      lineItemResourceId: row.resourceId,
      resourceId: row.resourceId,
      normalizedResourceId: row.resourceId,
    };
    const classified = classifyLoadBalancerCurLineItem(classifierInput);
    if (!classified.isLoadBalancer) continue;
    rowsClassified += 1;

    const matchedInventory = resolveMatchedLoadBalancer(
      classified.resourceArn ?? classified.normalizedResourceId,
      {
        cloudConnectionId: row.cloudConnectionId,
        accountId: row.accountId,
        region: row.region,
      },
      inventoryArnMap,
      targetGroupToLoadBalancerArnMap,
      listenerToLoadBalancerArnMap,
    );

    if (!matchedInventory) {
      rowsUnmatched += 1;
      continue;
    }

    const usageDate = normalizeTrim(row.usageDate);
    const key = buildAggregateKey({
      cloudConnectionId: matchedInventory.cloudConnectionId,
      accountId: matchedInventory.accountId,
      region: matchedInventory.region,
      loadBalancerArn: matchedInventory.arn,
      usageDate,
    });

    const existing = aggregateMap.get(key);
    const costAmount = resolveProjectCostAmount(row);
    const usageQuantity = toNumber(row.usageQuantity);
    const processedBytesGb = isBytesQuantitySignal(row) ? toGiBFromUsageQuantity(row) : 0;

    if (!existing) {
      aggregateMap.set(key, {
        cloudConnectionId: matchedInventory.cloudConnectionId,
        accountId: matchedInventory.accountId,
        region: matchedInventory.region,
        loadBalancerArn: matchedInventory.arn,
        usageDate,
        totalCost: costAmount,
        fixedCost: classified.costComponent === "fixed" ? costAmount : 0,
        lcuCost: classified.costComponent === "lcu" ? costAmount : 0,
        dataProcessingCost: classified.costComponent === "data_processing" ? costAmount : 0,
        processedBytesGb,
        usageQuantity,
        lineItemCount: 1,
        currencyCode: normalizeTrim(row.currencyCode) || "USD",
      });
      continue;
    }

    existing.totalCost += costAmount;
    if (classified.costComponent === "fixed") existing.fixedCost += costAmount;
    if (classified.costComponent === "lcu") existing.lcuCost += costAmount;
    if (classified.costComponent === "data_processing") existing.dataProcessingCost += costAmount;
    existing.processedBytesGb += processedBytesGb;
    existing.usageQuantity += usageQuantity;
    existing.lineItemCount += 1;
  }

  const upsertRows: LoadBalancerCostDailyRowUpsertInput[] = Array.from(aggregateMap.values()).map((row) => ({
    cloudConnectionId: row.cloudConnectionId,
    accountId: row.accountId,
    region: row.region,
    loadBalancerArn: row.loadBalancerArn,
    usageDate: row.usageDate,
    totalCost: toFixed6(row.totalCost),
    fixedCost: toFixed6(row.fixedCost),
    lcuCost: toFixed6(row.lcuCost),
    dataProcessingCost: toFixed6(row.dataProcessingCost),
    processedBytesGb: toFixed6(row.processedBytesGb),
    usageQuantity: toFixed6(row.usageQuantity),
    currencyCode: row.currencyCode,
    lineItemCount: row.lineItemCount,
  }));

  let rowsDeleted = 0;
  if (params.rebuildRange !== false) {
    rowsDeleted = await repository.deleteByDateRange({
      startDate: params.startDate,
      endDate: params.endDate,
      cloudConnectionId: normalizeTrim(params.cloudConnectionId) || null,
      accountId: normalizeTrim(params.accountId) || null,
      region: normalizeTrim(params.region) || null,
    });
  }

  const rowsUpserted = await repository.upsertDailyRows(upsertRows);

  const lbRowsMatched = Math.max(rowsClassified - rowsUnmatched, 0);
  logger.info("Load balancer cost daily sync completed", {
    triggerSource: params.triggerSource ?? "scheduler",
    startDate: params.startDate,
    endDate: params.endDate,
    rowsScanned: curRows.length,
    rowsClassified,
    lbRowsMatched,
    rowsUnmatched,
    inventoryRows: inventoryArnMap.size,
    targetGroupRows: targetGroupToLoadBalancerArnMap.size,
    listenerRows: listenerToLoadBalancerArnMap.size,
    rowsDeleted,
    dailyRowsWritten: rowsUpserted,
    durationMs: Date.now() - startedAt,
  });

  if (rowsUnmatched > 0) {
    logger.warn("Load balancer cost sync skipped unmatched rows", {
      startDate: params.startDate,
      endDate: params.endDate,
      unmatchedRows: rowsUnmatched,
    });
  }

  return {
    rowsScanned: curRows.length,
    rowsClassified,
    rowsUnmatched,
    rowsUpserted,
    rowsDeleted,
  };
}

type IngestionWindowRow = {
  min_usage_date: string | null;
  max_usage_date: string | null;
};

export async function syncLoadBalancerCostDailyForIngestionRun({
  ingestionRunId,
  cloudConnectionId,
}: {
  ingestionRunId: string | number;
  cloudConnectionId?: string | null;
}): Promise<{
  skipped: boolean;
  reason?: string;
  rowsScanned?: number;
  rowsClassified?: number;
  rowsUnmatched?: number;
  rowsUpserted?: number;
  rowsDeleted?: number;
}> {
  const rows = await sequelize.query<IngestionWindowRow>(
    `
SELECT
  MIN(COALESCE(dd_usage.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))))::text AS min_usage_date,
  MAX(COALESCE(dd_usage.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))))::text AS max_usage_date
FROM fact_cost_line_items f
LEFT JOIN dim_date dd_usage
  ON dd_usage.id = f.usage_date_key
WHERE f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT);
    `,
    {
      replacements: { ingestionRunId: String(ingestionRunId) },
      type: QueryTypes.SELECT,
    },
  );

  const startDate = normalizeTrim(rows[0]?.min_usage_date);
  const endDate = normalizeTrim(rows[0]?.max_usage_date);
  if (!startDate || !endDate) {
    return { skipped: true, reason: "no_usage_dates_for_ingestion_run" };
  }

  const result = await syncLoadBalancerCostDaily({
    startDate,
    endDate,
    cloudConnectionId: normalizeTrim(cloudConnectionId) || null,
    rebuildRange: true,
    triggerSource: "ingestion",
  });

  return {
    skipped: false,
    rowsScanned: result.rowsScanned,
    rowsClassified: result.rowsClassified,
    rowsUnmatched: result.rowsUnmatched,
    rowsUpserted: result.rowsUpserted,
    rowsDeleted: result.rowsDeleted,
  };
}

export type { SyncLoadBalancerCostDailyParams };
