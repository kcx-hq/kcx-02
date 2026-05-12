import { QueryTypes } from "sequelize";

import { NotFoundError } from "../../../errors/http-errors.js";
import { sequelize } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import type { DashboardScope } from "../dashboard.types.js";
import { S3StorageAnomalyService } from "../s3/s3-storage-anomaly.service.js";
import type { S3StorageAnomalyInsight } from "../s3/s3-cost-insights.types.js";

import type { AnomalyListQuery } from "./anomaly.schema.js";

type AnomalyRow = {
  id: string;
  tenant_id: string | null;
  billing_source_id: number | null;
  billing_source_name: string | null;
  cloud_connection_id: string | null;
  cloud_connection_name: string | null;
  usage_date: string;
  account_name: string | null;
  service: string | null;
  region: string | null;
  detected_at: string;
  anomaly_type: string | null;
  anomaly_scope: string | null;
  baseline_type: string | null;
  source_granularity: string | null;
  source_table: string | null;
  expected_cost: string | null;
  actual_cost: string | null;
  delta_cost: string | null;
  delta_percent: string | null;
  confidence_score: string | null;
  severity: string;
  status: string;
  root_cause_hint: string | null;
  explanation_json: Record<string, unknown> | null;
  metadata_json: Record<string, unknown> | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  resolved_at: string | null;
  ignored_reason: string | null;
  created_at: string;
  service_name: string | null;
  region_name: string | null;
  resource_id: string | null;
  resource_name: string | null;
  sub_account_id: string | null;
  sub_account_name: string | null;
  contributors: Array<{
    id: string;
    dimension_type: string;
    dimension_key: string | null;
    dimension_value: string | null;
    contribution_cost: string | null;
    contribution_percent: string | null;
    rank: number | null;
    created_at: string;
  }>;
};

type TotalCountRow = {
  total: string | number;
};

type AnomaliesListResponse = {
  items: AnomalyRow[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

const s3StorageAnomalyService = new S3StorageAnomalyService();

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

const resolveDateRange = (query: AnomalyListQuery): { from: string; to: string } => {
  if (query.date_from && query.date_to) {
    return {
      from: query.date_from,
      to: query.date_to,
    };
  }

  const to = new Date();
  const from = new Date(to.getTime());
  from.setDate(from.getDate() - 13);
  return {
    from: toIsoDate(from),
    to: toIsoDate(to),
  };
};

const mapS3SeverityToAnomalySeverity = (severity: S3StorageAnomalyInsight["severity"]): "low" | "medium" | "high" => {
  if (severity === "LOW") return "low";
  if (severity === "MEDIUM") return "medium";
  return "high";
};

const mapS3AnomalyToAnomalyRow = (tenantId: string, item: S3StorageAnomalyInsight): AnomalyRow => {
  const detectedAt = item.reportDate ? `${item.reportDate}T00:00:00.000Z` : new Date().toISOString();
  const id = `s3-${item.accountId}-${item.bucketName}-${item.reportDate}-${item.anomalyType}`;
  const normalizedSeverity = mapS3SeverityToAnomalySeverity(item.severity);
  const deltaCost = Number(item.estimatedMonthlyCostImpact || 0);
  const deltaPercent = item.growthPercentage ?? null;
  return {
    id,
    tenant_id: tenantId,
    billing_source_id: null,
    billing_source_name: "S3 Storage Lens",
    cloud_connection_id: null,
    cloud_connection_name: null,
    usage_date: item.reportDate,
    account_name: item.accountId,
    service: "Amazon S3",
    region: item.region,
    detected_at: detectedAt,
    anomaly_type: item.anomalyType,
    anomaly_scope: "s3_bucket",
    baseline_type: "7d_storage_growth",
    source_granularity: "daily",
    source_table: "s3_storage_lens_daily",
    expected_cost: "0",
    actual_cost: String(deltaCost),
    delta_cost: String(deltaCost),
    delta_percent: deltaPercent == null ? null : String(deltaPercent),
    confidence_score:
      item.confidence === "HIGH" ? "0.9" : item.confidence === "MEDIUM" ? "0.7" : "0.5",
    severity: normalizedSeverity,
    status: "open",
    root_cause_hint: item.reason,
    explanation_json: {
      summary: item.reason,
      recommendation: item.recommendedAction,
      confidence: item.confidence,
      severity: item.severity,
      monthlyImpactUsd: item.estimatedMonthlyCostImpact,
    },
    metadata_json: {
      service: "Amazon S3",
      bucketName: item.bucketName,
      accountId: item.accountId,
      region: item.region,
      storageGibCurrent: item.storageGibCurrent,
      storageGib7dAgo: item.storageGib7dAgo,
      growthGib: item.growthGib,
      growthPercentage: item.growthPercentage,
      estimatedMonthlyCostImpact: item.estimatedMonthlyCostImpact,
      originalSeverity: item.severity,
      anomalyConfidence: item.confidence,
      recommendedAction: item.recommendedAction,
    },
    first_seen_at: detectedAt,
    last_seen_at: detectedAt,
    resolved_at: null,
    ignored_reason: null,
    created_at: detectedAt,
    service_name: "Amazon S3",
    region_name: item.region,
    resource_id: item.bucketName,
    resource_name: item.bucketName,
    sub_account_id: item.accountId,
    sub_account_name: item.accountId,
    contributors: [],
  };
};

const matchesS3AnomalyQueryFilter = (item: S3StorageAnomalyInsight, query: AnomalyListQuery): boolean => {
  if (query.status && query.status !== "open") {
    return false;
  }

  const normalizedSeverity = mapS3SeverityToAnomalySeverity(item.severity);
  if (query.severity && query.severity !== normalizedSeverity) {
    return false;
  }

  if (query.anomaly_type) {
    const expected = query.anomaly_type.trim().toLowerCase();
    if (item.anomalyType.trim().toLowerCase() !== expected) {
      return false;
    }
  }

  return true;
};

const compareAnomalyRowsDesc = (a: AnomalyRow, b: AnomalyRow): number => {
  const aUsage = new Date(a.usage_date).getTime();
  const bUsage = new Date(b.usage_date).getTime();
  if (bUsage !== aUsage) {
    return bUsage - aUsage;
  }
  const aCreated = new Date(a.created_at).getTime();
  const bCreated = new Date(b.created_at).getTime();
  return bCreated - aCreated;
};

async function getS3AnomalyRowsForTenant({
  tenantId,
  query,
}: {
  tenantId: string;
  query: AnomalyListQuery;
}): Promise<AnomalyRow[]> {
  const dateRange = resolveDateRange(query);
  const scope: DashboardScope = {
    scopeType: "global",
    tenantId,
    from: dateRange.from,
    to: dateRange.to,
    billingSourceIds: typeof query.billing_source_id === "number" ? [query.billing_source_id] : undefined,
  };

  try {
    const result = await s3StorageAnomalyService.getStorageGrowthAnomalies(scope);
    return result.items.filter((item) => matchesS3AnomalyQueryFilter(item, query)).map((item) => mapS3AnomalyToAnomalyRow(tenantId, item));
  } catch (error) {
    logger.warn("Failed to load S3 storage anomalies for anomaly alerts view", {
      tenantId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return [];
  }
}

async function assertTenantBillingSourceOrThrow({
  tenantId,
  billingSourceId,
}: {
  tenantId: string;
  billingSourceId: number;
}): Promise<void> {
  const [row] = await sequelize.query<{ id: number }>(
    `
      SELECT bs.id
      FROM billing_sources bs
      WHERE bs.id = CAST(:billingSourceId AS BIGINT)
        AND bs.tenant_id = :tenantId
      LIMIT 1
    `,
    {
      replacements: { billingSourceId, tenantId },
      type: QueryTypes.SELECT,
    },
  );

  if (!row?.id) {
    throw new NotFoundError("Billing source not found");
  }
}

export async function getAnomaliesForTenant({
  tenantId,
  query,
}: {
  tenantId: string;
  query: AnomalyListQuery;
}): Promise<AnomaliesListResponse> {
  if (typeof query.billing_source_id === "number") {
    await assertTenantBillingSourceOrThrow({
      tenantId,
      billingSourceId: query.billing_source_id,
    });
  }

  const whereClauses: string[] = ["fa.tenant_id = :tenantId"];
  const replacements: Record<string, unknown> = {
    tenantId,
    limit: query.limit,
    offset: query.offset,
  };

  if (typeof query.billing_source_id === "number") {
    whereClauses.push("fa.billing_source_id = CAST(:billingSourceId AS BIGINT)");
    replacements.billingSourceId = query.billing_source_id;
  }

  if (query.status) {
    whereClauses.push("fa.status = :status");
    replacements.status = query.status;
  }

  if (query.severity) {
    whereClauses.push("fa.severity = :severity");
    replacements.severity = query.severity;
  }

  if (query.anomaly_type) {
    whereClauses.push("fa.anomaly_type = :anomalyType");
    replacements.anomalyType = query.anomaly_type;
  }

  if (query.date_from) {
    whereClauses.push("fa.usage_date >= :dateFrom");
    replacements.dateFrom = query.date_from;
  }

  if (query.date_to) {
    whereClauses.push("fa.usage_date <= :dateTo");
    replacements.dateTo = query.date_to;
  }

  const s3Rows = await getS3AnomalyRowsForTenant({ tenantId, query });

  const dbWindowLimit = Math.min(
    5000,
    Math.max(query.limit, query.offset + query.limit + s3Rows.length + 50),
  );
  replacements.dbLimit = dbWindowLimit;

  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRow] = await sequelize.query<TotalCountRow>(
    `
      SELECT COUNT(*)::bigint AS total
      FROM fact_anomalies fa
      ${whereSql}
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );

  const items = await sequelize.query<AnomalyRow>(
    `
      SELECT
        fa.id,
        fa.tenant_id,
        fa.billing_source_id,
        bs.source_name AS billing_source_name,
        fa.cloud_connection_id,
        cc.connection_name AS cloud_connection_name,
        fa.usage_date,
        dsa.sub_account_name AS account_name,
        ds.service_name AS service,
        dr.region_name AS region,
        fa.detected_at,
        fa.anomaly_type,
        fa.anomaly_scope,
        fa.baseline_type,
        fa.source_granularity,
        fa.source_table,
        fa.expected_cost,
        fa.actual_cost,
        fa.delta_cost,
        fa.delta_percent,
        fa.confidence_score,
        fa.severity,
        fa.status,
        fa.root_cause_hint,
        fa.explanation_json,
        fa.metadata_json,
        fa.first_seen_at,
        fa.last_seen_at,
        fa.resolved_at,
        fa.ignored_reason,
        fa.created_at,
        ds.service_name,
        dr.region_name,
        dres.resource_id,
        dres.resource_name,
        dsa.sub_account_id,
        dsa.sub_account_name,
        COALESCE(ac.contributors, '[]'::json) AS contributors
      FROM fact_anomalies fa
      LEFT JOIN billing_sources bs ON bs.id = fa.billing_source_id
      LEFT JOIN cloud_connections cc ON cc.id = fa.cloud_connection_id
      LEFT JOIN dim_service ds ON ds.id = fa.service_key
      LEFT JOIN dim_region dr ON dr.id = fa.region_key
      LEFT JOIN dim_resource dres ON dres.id = fa.resource_key
      LEFT JOIN dim_sub_account dsa ON dsa.id = fa.sub_account_key
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', ac.id,
            'dimension_type', ac.dimension_type,
            'dimension_key', ac.dimension_key::text,
            'dimension_value', ac.dimension_value,
            'contribution_cost', ac.contribution_cost::text,
            'contribution_percent', ac.contribution_percent::text,
            'rank', ac.rank,
            'created_at', ac.created_at
          )
          ORDER BY ac.rank ASC NULLS LAST, ac.created_at ASC
        ) AS contributors
        FROM anomaly_contributors ac
        WHERE ac.anomaly_id = fa.id
      ) ac ON TRUE
      ${whereSql}
      ORDER BY fa.usage_date DESC, fa.created_at DESC
      LIMIT :dbLimit OFFSET 0
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );

  const mergedItems = [...items, ...s3Rows].sort(compareAnomalyRowsDesc);
  const paginatedItems = mergedItems.slice(query.offset, query.offset + query.limit);

  return {
    items: paginatedItems,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: Number(countRow?.total ?? 0) + s3Rows.length,
    },
  };
}
