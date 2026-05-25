import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type {
  DbOptimizationActionRow,
  DbOptimizationActionsQuery,
  DbOptimizationTopAction,
} from "./db-optimization.types.js";

type ReplacementMap = Record<string, string | number | boolean | null>;

type SqlWhere = {
  sql: string;
  replacements: ReplacementMap;
};

type ResourceRow = {
  resourceId: string;
  cloudConnectionId: string | null;
  resourceName: string | null;
  resourceArn: string | null;
  dbIdentifier: string | null;
  dbService: string | null;
  dbEngine: string | null;
  dbEngineVersion: string | null;
  resourceType: string | null;
  instanceClass: string | null;
  regionId: string | null;
  regionName: string | null;
  subAccountId: string | null;
  subAccountName: string | null;
  clusterId: string | null;
  status: string | null;
  totalCost: string | number | null;
  currencyCode: string | null;
  avgCpu: string | number | null;
  maxCpu: string | number | null;
  avgConnections: string | number | null;
  maxConnections: string | number | null;
  avgIops: string | number | null;
  avgThroughputBytes: string | number | null;
  allocatedStorageGb: string | number | null;
  storageUsedGb: string | number | null;
  hasLiveInventory: boolean;
  inventoryObservedAt: Date | string | null;
  activeCount: string | number | null;
  openCount: string | number | null;
  warningCount: string | number | null;
  types: string[] | null;
  evidenceLevels: string[] | null;
  maxConfidence: "high" | "medium" | "low" | null;
  estimatedMonthlySavingsTotal: string | number | null;
  topActions: unknown;
};

const toNumber = (value: string | number | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNullableString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toIsoTimestamp = (value: Date | string | null): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const normalizeInventorySource = (hasLiveInventory: boolean): "aws_sdk" | "billing_only" | "mixed" =>
  hasLiveInventory ? "mixed" : "billing_only";

const parseTopActions = (value: unknown): DbOptimizationTopAction[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((row): DbOptimizationTopAction | null => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const id = String(item.id ?? "").trim();
      if (!id) return null;
      return {
        id,
        title: String(item.title ?? "").trim() || "Recommendation",
        recommendationType: String(item.recommendationType ?? "").trim() || "unknown",
        status: String(item.status ?? "").trim() || "OPEN",
        estimatedMonthlySavings: toNumber(item.estimatedMonthlySavings as string | number | null | undefined),
        evidenceLevel: toNullableString(item.evidenceLevel as string | null | undefined),
        confidence: toNullableString(item.confidence as string | null | undefined),
      };
    })
    .filter((row): row is DbOptimizationTopAction => Boolean(row));
};

const buildResourcesCte = (query: DbOptimizationActionsQuery): SqlWhere => {
  const where: string[] = [
    "f.tenant_id = CAST(:tenantId AS uuid)",
    "f.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)",
    "COALESCE(LOWER(BTRIM(f.resource_type)), '') <> 'scoped'",
    "f.resource_id NOT LIKE 'db-scope:%'",
  ];

  const replacements: ReplacementMap = {
    tenantId: query.tenantId,
    startDate: query.startDate,
    endDate: query.endDate,
  };

  if (query.regionKey) {
    where.push(`(
      f.region_key::text = BTRIM(:regionKey)
      OR LOWER(BTRIM(COALESCE(dr.region_id, ''))) = LOWER(BTRIM(:regionKey))
      OR LOWER(BTRIM(COALESCE(dr.region_name, ''))) = LOWER(BTRIM(:regionKey))
    )`);
    replacements.regionKey = query.regionKey;
  }

  if (query.dbService) {
    where.push("LOWER(BTRIM(COALESCE(f.db_service, ''))) = LOWER(BTRIM(:dbService))");
    replacements.dbService = query.dbService;
  }

  if (query.dbEngine) {
    where.push("LOWER(BTRIM(COALESCE(f.db_engine, ''))) = LOWER(BTRIM(:dbEngine))");
    replacements.dbEngine = query.dbEngine;
  }

  if (query.resourceType) {
    where.push("LOWER(BTRIM(COALESCE(f.resource_type, ''))) = LOWER(BTRIM(:resourceType))");
    replacements.resourceType = query.resourceType;
  }

  if (query.search) {
    where.push(`(
      LOWER(COALESCE(f.resource_id, '')) LIKE LOWER(:searchLike)
      OR LOWER(COALESCE(f.resource_name, '')) LIKE LOWER(:searchLike)
      OR LOWER(COALESCE(f.resource_arn, '')) LIKE LOWER(:searchLike)
      OR LOWER(COALESCE(inv.resource_name, '')) LIKE LOWER(:searchLike)
    )`);
    replacements.searchLike = `%${query.search}%`;
  }

  return { sql: where.join("\n      AND "), replacements };
};

const baseCteSql = (resourceWhereSql: string): string => `
WITH latest_inventory AS (
  SELECT ranked.*
  FROM (
    SELECT
      inv.*,
      ROW_NUMBER() OVER (
        PARTITION BY inv.tenant_id, inv.cloud_connection_id, inv.resource_id
        ORDER BY CASE WHEN inv.is_current THEN 0 ELSE 1 END ASC, inv.discovered_at DESC
      ) AS row_num
    FROM db_resource_inventory_snapshots inv
    WHERE inv.tenant_id = CAST(:tenantId AS uuid)
  ) ranked
  WHERE ranked.row_num = 1
),
resource_base AS (
  SELECT
    f.tenant_id AS tenant_id,
    f.cloud_connection_id AS cloud_connection_id,
    f.resource_id AS resource_id,
    MAX(f.resource_name) AS resource_name,
    MAX(f.resource_arn) AS resource_arn,
    MAX(COALESCE(inv.resource_name, f.resource_name)) AS db_identifier,
    MAX(f.db_service) AS db_service,
    MAX(f.db_engine) AS db_engine,
    MAX(f.db_engine_version) AS db_engine_version,
    MAX(f.resource_type) AS resource_type,
    MAX(COALESCE(inv.instance_class, NULL)) AS instance_class,
    MAX(COALESCE(inv.cluster_id, f.cluster_id)) AS cluster_id,
    MAX(COALESCE(inv.status, f.status)) AS status,
    MAX(dr.region_id) AS region_id,
    MAX(dr.region_name) AS region_name,
    MAX(dsa.sub_account_id) AS sub_account_id,
    MAX(dsa.sub_account_name) AS sub_account_name,
    SUM(COALESCE(f.total_effective_cost, 0)) AS total_cost,
    MAX(f.currency_code) AS currency_code,
    AVG(f.cpu_avg) AS avg_cpu,
    MAX(f.cpu_max) AS max_cpu,
    AVG(f.connections_avg) AS avg_connections,
    MAX(f.connections_max) AS max_connections,
    AVG(CASE WHEN f.read_iops IS NULL AND f.write_iops IS NULL THEN NULL ELSE COALESCE(f.read_iops, 0) + COALESCE(f.write_iops, 0) END) AS avg_iops,
    AVG(CASE WHEN f.read_throughput_bytes IS NULL AND f.write_throughput_bytes IS NULL THEN NULL ELSE COALESCE(f.read_throughput_bytes, 0) + COALESCE(f.write_throughput_bytes, 0) END) AS avg_throughput_bytes,
    MAX(COALESCE(inv.allocated_storage_gb, f.allocated_storage_gb)) AS allocated_storage_gb,
    MAX(COALESCE(f.storage_used_gb, inv.data_footprint_gb, f.data_footprint_gb)) AS storage_used_gb,
    BOOL_OR(inv.resource_id IS NOT NULL) AS has_live_inventory,
    MAX(inv.discovered_at) AS inventory_observed_at
  FROM fact_db_resource_daily f
  LEFT JOIN latest_inventory inv
    ON inv.tenant_id = f.tenant_id
   AND inv.resource_id = f.resource_id
   AND (
     inv.cloud_connection_id = f.cloud_connection_id
     OR (inv.cloud_connection_id IS NULL AND f.cloud_connection_id IS NULL)
   )
  LEFT JOIN dim_region dr ON dr.id = COALESCE(inv.region_key, f.region_key)
  LEFT JOIN dim_sub_account dsa ON dsa.id = COALESCE(inv.sub_account_key, f.sub_account_key)
  WHERE ${resourceWhereSql}
  GROUP BY f.tenant_id, f.cloud_connection_id, f.resource_id
),
recommendation_agg AS (
  SELECT
    fr.tenant_id AS tenant_id,
    fr.cloud_connection_id AS cloud_connection_id,
    fr.resource_id AS resource_id,
    COUNT(*) FILTER (WHERE fr.status IN ('OPEN', 'IN_PROGRESS', 'SNOOZED')) AS active_count,
    COUNT(*) FILTER (WHERE fr.status = 'OPEN') AS open_count,
    COALESCE(SUM(
      CASE
        WHEN fr.status IN ('OPEN', 'IN_PROGRESS', 'SNOOZED')
          THEN COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(fr.metadata_json->'data_quality_warnings') = 'array' THEN fr.metadata_json->'data_quality_warnings' ELSE '[]'::jsonb END), 0)
        ELSE 0
      END
    ), 0) AS warning_count,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT CASE WHEN fr.status IN ('OPEN', 'IN_PROGRESS', 'SNOOZED') THEN fr.recommendation_type END), NULL) AS types,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT CASE WHEN fr.status IN ('OPEN', 'IN_PROGRESS', 'SNOOZED') THEN NULLIF(fr.metadata_json->>'evidence_level', '') END), NULL) AS evidence_levels,
    CASE
      WHEN BOOL_OR(fr.status IN ('OPEN', 'IN_PROGRESS', 'SNOOZED') AND LOWER(COALESCE(fr.metadata_json->>'confidence', '')) = 'high') THEN 'high'
      WHEN BOOL_OR(fr.status IN ('OPEN', 'IN_PROGRESS', 'SNOOZED') AND LOWER(COALESCE(fr.metadata_json->>'confidence', '')) = 'medium') THEN 'medium'
      WHEN BOOL_OR(fr.status IN ('OPEN', 'IN_PROGRESS', 'SNOOZED') AND LOWER(COALESCE(fr.metadata_json->>'confidence', '')) = 'low') THEN 'low'
      ELSE NULL
    END AS max_confidence,
    COALESCE(SUM(CASE WHEN fr.status IN ('OPEN', 'IN_PROGRESS', 'SNOOZED') THEN COALESCE(fr.estimated_monthly_savings, 0) ELSE 0 END), 0) AS estimated_monthly_savings_total
  FROM fact_recommendations fr
  WHERE fr.tenant_id = CAST(:tenantId AS uuid)
    AND fr.category = 'DB'
    AND fr.resource_id IS NOT NULL
  GROUP BY fr.tenant_id, fr.cloud_connection_id, fr.resource_id
),
top_actions AS (
  SELECT
    fr.tenant_id AS tenant_id,
    fr.cloud_connection_id AS cloud_connection_id,
    fr.resource_id AS resource_id,
    COALESCE(
      json_agg(
        json_build_object(
          'id', fr.id::text,
          'title', COALESCE(fr.recommendation_title, fr.recommendation_text, 'Recommendation'),
          'recommendationType', fr.recommendation_type,
          'status', fr.status,
          'estimatedMonthlySavings', COALESCE(fr.estimated_monthly_savings, 0),
          'evidenceLevel', NULLIF(fr.metadata_json->>'evidence_level', ''),
          'confidence', NULLIF(fr.metadata_json->>'confidence', '')
        )
        ORDER BY COALESCE(fr.estimated_monthly_savings, 0) DESC, fr.updated_at DESC
      ) FILTER (WHERE fr.row_num <= 3),
      '[]'::json
    ) AS top_actions
  FROM (
    SELECT
      r.*,
      ROW_NUMBER() OVER (
        PARTITION BY r.tenant_id, r.cloud_connection_id, r.resource_id
        ORDER BY COALESCE(r.estimated_monthly_savings, 0) DESC, r.updated_at DESC
      ) AS row_num
    FROM fact_recommendations r
    WHERE r.tenant_id = CAST(:tenantId AS uuid)
      AND r.category = 'DB'
      AND r.status IN ('OPEN', 'IN_PROGRESS', 'SNOOZED')
      AND r.resource_id IS NOT NULL
  ) fr
  GROUP BY fr.tenant_id, fr.cloud_connection_id, fr.resource_id
),
joined AS (
  SELECT
    rb.*,
    COALESCE(ra.active_count, 0) AS active_count,
    COALESCE(ra.open_count, 0) AS open_count,
    COALESCE(ra.warning_count, 0) AS warning_count,
    COALESCE(ra.types, ARRAY[]::text[]) AS types,
    COALESCE(ra.evidence_levels, ARRAY[]::text[]) AS evidence_levels,
    ra.max_confidence AS max_confidence,
    COALESCE(ra.estimated_monthly_savings_total, 0) AS estimated_monthly_savings_total,
    COALESCE(ta.top_actions, '[]'::json) AS top_actions
  FROM resource_base rb
  LEFT JOIN recommendation_agg ra
    ON ra.tenant_id = rb.tenant_id
   AND ra.resource_id = rb.resource_id
   AND (
     ra.cloud_connection_id = rb.cloud_connection_id
     OR (ra.cloud_connection_id IS NULL AND rb.cloud_connection_id IS NULL)
   )
  LEFT JOIN top_actions ta
    ON ta.tenant_id = rb.tenant_id
   AND ta.resource_id = rb.resource_id
   AND (
     ta.cloud_connection_id = rb.cloud_connection_id
     OR (ta.cloud_connection_id IS NULL AND rb.cloud_connection_id IS NULL)
   )
)
`;

const buildJoinedFilters = (query: DbOptimizationActionsQuery): SqlWhere => {
  const where: string[] = [];
  const replacements: ReplacementMap = {};

  if (query.status) {
    where.push("LOWER(BTRIM(COALESCE(joined.status, ''))) = LOWER(BTRIM(:resourceStatus))");
    replacements.resourceStatus = query.status;
  }

  if (typeof query.hasActions === "boolean") {
    if (query.hasActions) where.push("joined.active_count > 0");
    else where.push("joined.active_count = 0");
  }

  if (query.recommendationType) {
    where.push("EXISTS (SELECT 1 FROM unnest(joined.types) AS type_item WHERE LOWER(type_item) = LOWER(:recommendationType))");
    replacements.recommendationType = query.recommendationType;
  }

  return { sql: where.join("\n  AND "), replacements };
};

export class DbOptimizationRepository {
  async getActions(
    query: DbOptimizationActionsQuery,
  ): Promise<{ items: DbOptimizationActionRow[]; total: number }> {
    const resourceWhere = buildResourcesCte(query);
    const joinedFilters = buildJoinedFilters(query);
    const filterSql = joinedFilters.sql.length > 0 ? `WHERE ${joinedFilters.sql}` : "";
    const baseSql = baseCteSql(resourceWhere.sql);

    const replacements: ReplacementMap = {
      ...resourceWhere.replacements,
      ...joinedFilters.replacements,
      pageSize: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    };

    const countRows = await sequelize.query<{ total: string | number }>(
      `
${baseSql}
SELECT COUNT(*)::bigint AS total
FROM joined
${filterSql};
`,
      { replacements, type: QueryTypes.SELECT },
    );
    const total = toNumber(countRows[0]?.total);

    const rows = await sequelize.query<ResourceRow>(
      `
${baseSql}
SELECT
  joined.resource_id AS "resourceId",
  joined.cloud_connection_id AS "cloudConnectionId",
  joined.db_identifier AS "dbIdentifier",
  joined.resource_name AS "resourceName",
  joined.resource_arn AS "resourceArn",
  joined.db_service AS "dbService",
  joined.db_engine AS "dbEngine",
  joined.db_engine_version AS "dbEngineVersion",
  joined.resource_type AS "resourceType",
  joined.instance_class AS "instanceClass",
  joined.region_id AS "regionId",
  joined.region_name AS "regionName",
  joined.sub_account_id AS "subAccountId",
  joined.sub_account_name AS "subAccountName",
  joined.cluster_id AS "clusterId",
  joined.status AS "status",
  joined.total_cost AS "totalCost",
  joined.currency_code AS "currencyCode",
  joined.avg_cpu AS "avgCpu",
  joined.max_cpu AS "maxCpu",
  joined.avg_connections AS "avgConnections",
  joined.max_connections AS "maxConnections",
  joined.avg_iops AS "avgIops",
  joined.avg_throughput_bytes AS "avgThroughputBytes",
  joined.allocated_storage_gb AS "allocatedStorageGb",
  joined.storage_used_gb AS "storageUsedGb",
  joined.has_live_inventory AS "hasLiveInventory",
  joined.inventory_observed_at AS "inventoryObservedAt",
  joined.active_count AS "activeCount",
  joined.open_count AS "openCount",
  joined.warning_count AS "warningCount",
  joined.types AS "types",
  joined.evidence_levels AS "evidenceLevels",
  joined.max_confidence AS "maxConfidence",
  joined.estimated_monthly_savings_total AS "estimatedMonthlySavingsTotal",
  joined.top_actions AS "topActions"
FROM joined
${filterSql}
ORDER BY joined.total_cost DESC, joined.resource_id ASC
LIMIT :pageSize OFFSET :offset;
`,
      { replacements, type: QueryTypes.SELECT },
    );

    const items: DbOptimizationActionRow[] = rows.map((row) => {
      const hasLiveInventory = row.hasLiveInventory === true;
      return {
        resourceId: row.resourceId,
        cloudConnectionId: row.cloudConnectionId,
        dbIdentifier: row.dbIdentifier?.trim() || row.resourceName?.trim() || row.resourceId,
        resourceName: toNullableString(row.resourceName),
        resourceArn: toNullableString(row.resourceArn),
        dbService: row.dbService?.trim() || "Unknown",
        dbEngine: toNullableString(row.dbEngine),
        dbEngineVersion: toNullableString(row.dbEngineVersion),
        resourceType: toNullableString(row.resourceType),
        instanceClass: toNullableString(row.instanceClass),
        regionId: toNullableString(row.regionId),
        regionName: toNullableString(row.regionName),
        subAccountId: toNullableString(row.subAccountId),
        subAccountName: toNullableString(row.subAccountName),
        clusterId: toNullableString(row.clusterId),
        status: toNullableString(row.status),
        totalCost: toNumber(row.totalCost),
        currencyCode: toNullableString(row.currencyCode),
        avgCpu: toNullableNumber(row.avgCpu),
        maxCpu: toNullableNumber(row.maxCpu),
        avgConnections: toNullableNumber(row.avgConnections),
        maxConnections: toNullableNumber(row.maxConnections),
        avgIops: toNullableNumber(row.avgIops),
        avgThroughputBytes: toNullableNumber(row.avgThroughputBytes),
        allocatedStorageGb: toNullableNumber(row.allocatedStorageGb),
        storageUsedGb: toNullableNumber(row.storageUsedGb),
        hasLiveInventory,
        inventorySource: normalizeInventorySource(hasLiveInventory),
        inventoryObservedAt: toIsoTimestamp(row.inventoryObservedAt),
        actionSummary: {
          activeCount: toNumber(row.activeCount),
          openCount: toNumber(row.openCount),
          warningCount: toNumber(row.warningCount),
          types: Array.isArray(row.types) ? row.types.filter((v) => String(v).trim().length > 0) : [],
          evidenceLevels: Array.isArray(row.evidenceLevels) ? row.evidenceLevels.filter((v) => String(v).trim().length > 0) : [],
          maxConfidence: row.maxConfidence ?? null,
          estimatedMonthlySavingsTotal: toNumber(row.estimatedMonthlySavingsTotal),
          topActions: parseTopActions(row.topActions),
        },
      };
    });

    return { items, total };
  }
}
