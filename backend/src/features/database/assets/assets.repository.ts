import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type {
  DatabaseAssetRow,
  DatabaseAssetsAccountOption,
  DatabaseAssetsFilterOptions,
  DatabaseAssetsFilterValueOption,
  DatabaseAssetsQueryParams,
  DatabaseAssetsRegionOption,
  DatabaseAssetsSummary,
} from "./assets.types.js";

type ReplacementMap = Record<string, string | number | null>;

type SqlWhere = {
  sql: string;
  replacements: ReplacementMap;
};

type AssetQueryRow = {
  resourceId: string;
  resourceArn: string | null;
  resourceName: string | null;
  dbIdentifier: string;
  dbService: string;
  dbEngine: string | null;
  dbEngineVersion: string | null;
  resourceType: string | null;
  instanceClass: string | null;
  capacityMode: string | null;
  regionKey: string | null;
  regionId: string | null;
  regionName: string | null;
  subAccountKey: string | null;
  subAccountId: string | null;
  subAccountName: string | null;
  status: string | null;
  clusterId: string | null;
  isClusterResource: boolean | null;
  allocatedStorageGb: string | number | null;
  storageUsedGb: string | number | null;
  dataFootprintGb: string | number | null;
  avgCpu: string | number | null;
  maxCpu: string | number | null;
  avgConnections: string | number | null;
  maxConnections: string | number | null;
  avgIops: string | number | null;
  avgThroughputBytes: string | number | null;
  totalBilledCost: string | number | null;
  totalEffectiveCost: string | number | null;
  totalListCost: string | number | null;
  totalCost: string | number | null;
  currencyCode: string | null;
  recommendationCount: string | number | null;
  latestUsageDate: string;
  discoveredAt: Date | string | null;
  metadata: Record<string, unknown> | null;
  totalCount: string | number | null;
};

type SummaryRow = {
  totalAssets: string | number | null;
  totalCost: string | number | null;
  avgCpu: string | number | null;
  totalStorageGb: string | number | null;
  recommendationCount: string | number | null;
};

type ValueOptionRow = {
  value: string | null;
  label: string | null;
  count: string | number | null;
};

type RegionOptionRow = {
  regionKey: string | number | null;
  regionId: string | null;
  regionName: string | null;
  count: string | number | null;
};

type AccountOptionRow = {
  subAccountKey: string | number | null;
  subAccountId: string | null;
  subAccountName: string | null;
  count: string | number | null;
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

const toNullableString = (value: string | number | null | undefined): string | null => {
  if (value === null || typeof value === "undefined") return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const toDateOnly = (value: string | Date): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
};

const toIsoTimestamp = (value: string | Date | null): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const buildScopedFactWhere = (params: DatabaseAssetsQueryParams): SqlWhere => {
  const clauses = [
    'f.tenant_id = CAST(:tenantId AS uuid)',
    'f.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)',
  ];

  const replacements: ReplacementMap = {
    tenantId: params.tenantId,
    startDate: params.startDate,
    endDate: params.endDate,
  };

  if (params.cloudConnectionId) {
    clauses.push('f.cloud_connection_id = CAST(:cloudConnectionId AS uuid)');
    replacements.cloudConnectionId = params.cloudConnectionId;
  }
  if (params.regionKey) {
    clauses.push('f.region_key = CAST(:regionKey AS bigint)');
    replacements.regionKey = params.regionKey;
  }
  if (params.dbService) {
    clauses.push('f.db_service = :dbService');
    replacements.dbService = params.dbService;
  }
  if (params.dbEngine) {
    clauses.push('f.db_engine = :dbEngine');
    replacements.dbEngine = params.dbEngine;
  }
  if (params.subAccountKey) {
    clauses.push('f.sub_account_key = CAST(:subAccountKey AS bigint)');
    replacements.subAccountKey = params.subAccountKey;
  }

  return { sql: clauses.join('\n      AND '), replacements };
};

const buildPostJoinWhere = (params: DatabaseAssetsQueryParams): SqlWhere => {
  const clauses: string[] = [];
  const replacements: ReplacementMap = {};

  if (params.status) {
    clauses.push('COALESCE(li.status, a.status) = :status');
    replacements.status = params.status;
  }
  if (params.instanceClass) {
    clauses.push('li.instance_class = :instanceClass');
    replacements.instanceClass = params.instanceClass;
  }
  if (params.search) {
    clauses.push(`(
      a.resource_id ILIKE :search
      OR a.resource_name ILIKE :search
      OR a.resource_arn ILIKE :search
      OR li.resource_name ILIKE :search
      OR li.resource_arn ILIKE :search
      OR li.cluster_id ILIKE :search
      OR a.db_engine ILIKE :search
      OR a.db_service ILIKE :search
    )`);
    replacements.search = `%${params.search}%`;
  }

  return {
    sql: clauses.length > 0 ? clauses.join('\n      AND ') : 'TRUE',
    replacements,
  };
};

const baseCtes = (scopedSql: string, postJoinSql: string): string => `
WITH scoped_fact AS (
  SELECT f.*
  FROM fact_db_resource_daily f
  WHERE ${scopedSql}
),
aggregated_assets AS (
  SELECT
    f.tenant_id,
    f.cloud_connection_id,
    f.resource_id,
    MAX(f.resource_arn) AS resource_arn,
    MAX(f.resource_name) AS resource_name,
    MAX(f.db_service) AS db_service,
    MAX(f.db_engine) AS db_engine,
    MAX(f.db_engine_version) AS db_engine_version,
    MAX(f.resource_type) AS resource_type,
    MAX(f.region_key) AS region_key,
    MAX(f.sub_account_key) AS sub_account_key,
    MAX(f.status) AS status,
    MAX(f.cluster_id) AS cluster_id,
    COALESCE(BOOL_OR(COALESCE(f.is_cluster_resource, false)), false) AS is_cluster_resource,
    MAX(f.allocated_storage_gb) AS fact_allocated_storage_gb,
    MAX(f.storage_used_gb) AS fact_storage_used_gb,
    MAX(f.data_footprint_gb) AS fact_data_footprint_gb,
    AVG(f.cpu_avg) AS avg_cpu,
    MAX(f.cpu_max) AS max_cpu,
    AVG(f.connections_avg) AS avg_connections,
    MAX(f.connections_max) AS max_connections,
    AVG(COALESCE(f.read_iops, 0) + COALESCE(f.write_iops, 0)) AS avg_iops,
    AVG(COALESCE(f.read_throughput_bytes, 0) + COALESCE(f.write_throughput_bytes, 0)) AS avg_throughput_bytes,
    COALESCE(SUM(f.total_billed_cost), 0) AS total_billed_cost,
    COALESCE(SUM(f.total_effective_cost), 0) AS total_effective_cost,
    COALESCE(SUM(f.total_list_cost), 0) AS total_list_cost,
    COALESCE(SUM(f.total_effective_cost), 0) AS total_cost,
    MAX(f.currency_code) AS currency_code,
    MAX(f.usage_date) AS latest_usage_date
  FROM scoped_fact f
  GROUP BY f.tenant_id, f.cloud_connection_id, f.resource_id
),
latest_inventory AS (
  SELECT ranked.*
  FROM (
    SELECT
      inv.tenant_id,
      inv.cloud_connection_id,
      inv.resource_id,
      inv.resource_arn,
      inv.resource_name,
      inv.db_service,
      inv.db_engine,
      inv.db_engine_version,
      inv.resource_type,
      inv.region_key,
      inv.sub_account_key,
      inv.status,
      inv.instance_class,
      inv.capacity_mode,
      inv.cluster_id,
      inv.is_cluster_resource,
      inv.allocated_storage_gb,
      inv.data_footprint_gb,
      inv.discovered_at,
      inv.tags_json,
      inv.metadata_json,
      inv.is_current,
      ROW_NUMBER() OVER (
        PARTITION BY inv.tenant_id, inv.cloud_connection_id, inv.resource_id
        ORDER BY CASE WHEN inv.is_current THEN 0 ELSE 1 END ASC, inv.discovered_at DESC
      ) AS row_num
    FROM db_resource_inventory_snapshots inv
    WHERE inv.tenant_id = CAST(:tenantId AS uuid)
  ) ranked
  WHERE ranked.row_num = 1
),
recommendation_counts AS (
  SELECT
    a.tenant_id,
    a.cloud_connection_id,
    a.resource_id,
    COUNT(*)::bigint AS recommendation_count
  FROM aggregated_assets a
  JOIN fact_recommendations fr
    ON fr.tenant_id = a.tenant_id
   AND fr.resource_id = a.resource_id
   AND fr.status = 'OPEN'
   AND (a.cloud_connection_id IS NULL OR fr.cloud_connection_id = a.cloud_connection_id)
  GROUP BY a.tenant_id, a.cloud_connection_id, a.resource_id
),
final_assets AS (
  SELECT
    a.resource_id,
    COALESCE(li.resource_arn, a.resource_arn) AS resource_arn,
    COALESCE(li.resource_name, a.resource_name) AS resource_name,
    COALESCE(li.db_service, a.db_service) AS db_service,
    COALESCE(li.db_engine, a.db_engine) AS db_engine,
    COALESCE(li.db_engine_version, a.db_engine_version) AS db_engine_version,
    COALESCE(li.resource_type, a.resource_type) AS resource_type,
    li.instance_class,
    li.capacity_mode,
    COALESCE(li.region_key, a.region_key) AS region_key,
    dr.region_id,
    dr.region_name,
    COALESCE(li.sub_account_key, a.sub_account_key) AS sub_account_key,
    dsa.sub_account_id,
    dsa.sub_account_name,
    COALESCE(li.status, a.status) AS status,
    COALESCE(li.cluster_id, a.cluster_id) AS cluster_id,
    COALESCE(li.is_cluster_resource, a.is_cluster_resource, false) AS is_cluster_resource,
    COALESCE(li.allocated_storage_gb, a.fact_allocated_storage_gb) AS allocated_storage_gb,
    a.fact_storage_used_gb AS storage_used_gb,
    COALESCE(li.data_footprint_gb, a.fact_data_footprint_gb) AS data_footprint_gb,
    a.avg_cpu,
    a.max_cpu,
    a.avg_connections,
    a.max_connections,
    a.avg_iops,
    a.avg_throughput_bytes,
    a.total_billed_cost,
    a.total_effective_cost,
    a.total_list_cost,
    a.total_cost,
    a.currency_code,
    COALESCE(rc.recommendation_count, 0) AS recommendation_count,
    a.latest_usage_date,
    li.discovered_at,
    li.metadata_json AS metadata
  FROM aggregated_assets a
  LEFT JOIN latest_inventory li
    ON li.tenant_id = a.tenant_id
   AND li.resource_id = a.resource_id
   AND (
     li.cloud_connection_id = a.cloud_connection_id
     OR (li.cloud_connection_id IS NULL AND a.cloud_connection_id IS NULL)
   )
  LEFT JOIN dim_region dr ON dr.id = COALESCE(li.region_key, a.region_key)
  LEFT JOIN dim_sub_account dsa ON dsa.id = COALESCE(li.sub_account_key, a.sub_account_key)
  LEFT JOIN recommendation_counts rc
    ON rc.tenant_id = a.tenant_id
   AND rc.resource_id = a.resource_id
   AND (
     rc.cloud_connection_id = a.cloud_connection_id
     OR (rc.cloud_connection_id IS NULL AND a.cloud_connection_id IS NULL)
   )
  WHERE ${postJoinSql}
)
`;

export class DatabaseAssetsRepository {
  async getAssetsPage(params: DatabaseAssetsQueryParams): Promise<{ assets: DatabaseAssetRow[]; total: number }> {
    const scoped = buildScopedFactWhere(params);
    const postJoin = buildPostJoinWhere(params);
    const offset = (params.page - 1) * params.pageSize;

    const rows = await sequelize.query<AssetQueryRow>(
      `
${baseCtes(scoped.sql, postJoin.sql)}
SELECT
  fa.resource_id AS "resourceId",
  fa.resource_arn AS "resourceArn",
  fa.resource_name AS "resourceName",
  COALESCE(NULLIF(BTRIM(fa.resource_name), ''), fa.resource_id) AS "dbIdentifier",
  fa.db_service AS "dbService",
  fa.db_engine AS "dbEngine",
  fa.db_engine_version AS "dbEngineVersion",
  fa.resource_type AS "resourceType",
  fa.instance_class AS "instanceClass",
  fa.capacity_mode AS "capacityMode",
  fa.region_key::text AS "regionKey",
  fa.region_id AS "regionId",
  fa.region_name AS "regionName",
  fa.sub_account_key::text AS "subAccountKey",
  fa.sub_account_id AS "subAccountId",
  fa.sub_account_name AS "subAccountName",
  fa.status AS "status",
  fa.cluster_id AS "clusterId",
  fa.is_cluster_resource AS "isClusterResource",
  fa.allocated_storage_gb AS "allocatedStorageGb",
  fa.storage_used_gb AS "storageUsedGb",
  fa.data_footprint_gb AS "dataFootprintGb",
  fa.avg_cpu AS "avgCpu",
  fa.max_cpu AS "maxCpu",
  fa.avg_connections AS "avgConnections",
  fa.max_connections AS "maxConnections",
  fa.avg_iops AS "avgIops",
  fa.avg_throughput_bytes AS "avgThroughputBytes",
  fa.total_billed_cost AS "totalBilledCost",
  fa.total_effective_cost AS "totalEffectiveCost",
  fa.total_list_cost AS "totalListCost",
  fa.total_cost AS "totalCost",
  fa.currency_code AS "currencyCode",
  fa.recommendation_count AS "recommendationCount",
  fa.latest_usage_date AS "latestUsageDate",
  fa.discovered_at AS "discoveredAt",
  fa.metadata AS "metadata",
  COUNT(*) OVER() AS "totalCount"
FROM final_assets fa
ORDER BY fa.total_cost DESC, fa.resource_id ASC
LIMIT :pageSize OFFSET :offset;
`,
      {
        replacements: {
          ...scoped.replacements,
          ...postJoin.replacements,
          pageSize: params.pageSize,
          offset,
        },
        type: QueryTypes.SELECT,
      },
    );

    const total = toNumber(rows[0]?.totalCount);

    return {
      assets: rows.map((row) => ({
        resourceId: row.resourceId,
        resourceArn: row.resourceArn,
        resourceName: row.resourceName,
        dbIdentifier: row.dbIdentifier,
        dbService: row.dbService,
        dbEngine: row.dbEngine,
        dbEngineVersion: row.dbEngineVersion,
        resourceType: row.resourceType,
        instanceClass: row.instanceClass,
        capacityMode: row.capacityMode,
        regionKey: toNullableString(row.regionKey),
        regionId: row.regionId,
        regionName: row.regionName,
        subAccountKey: toNullableString(row.subAccountKey),
        subAccountId: row.subAccountId,
        subAccountName: row.subAccountName,
        status: row.status,
        clusterId: row.clusterId,
        isClusterResource: Boolean(row.isClusterResource),
        allocatedStorageGb: toNullableNumber(row.allocatedStorageGb),
        storageUsedGb: toNullableNumber(row.storageUsedGb),
        dataFootprintGb: toNullableNumber(row.dataFootprintGb),
        avgCpu: toNullableNumber(row.avgCpu),
        maxCpu: toNullableNumber(row.maxCpu),
        avgConnections: toNullableNumber(row.avgConnections),
        maxConnections: toNullableNumber(row.maxConnections),
        avgIops: toNullableNumber(row.avgIops),
        avgThroughputBytes: toNullableNumber(row.avgThroughputBytes),
        totalBilledCost: toNumber(row.totalBilledCost),
        totalEffectiveCost: toNumber(row.totalEffectiveCost),
        totalListCost: toNumber(row.totalListCost),
        totalCost: toNumber(row.totalCost),
        currencyCode: row.currencyCode,
        recommendationCount: toNumber(row.recommendationCount),
        latestUsageDate: toDateOnly(row.latestUsageDate),
        discoveredAt: toIsoTimestamp(row.discoveredAt),
        metadata: row.metadata,
      })),
      total,
    };
  }

  async getSummary(params: DatabaseAssetsQueryParams): Promise<DatabaseAssetsSummary> {
    const scoped = buildScopedFactWhere(params);
    const postJoin = buildPostJoinWhere(params);

    const rows = await sequelize.query<SummaryRow>(
      `
${baseCtes(scoped.sql, postJoin.sql)}
SELECT
  COUNT(*) AS "totalAssets",
  COALESCE(SUM(fa.total_cost), 0) AS "totalCost",
  AVG(fa.avg_cpu) AS "avgCpu",
  SUM(COALESCE(fa.allocated_storage_gb, 0)) AS "totalStorageGb",
  COALESCE(SUM(fa.recommendation_count), 0) AS "recommendationCount"
FROM final_assets fa;
`,
      {
        replacements: {
          ...scoped.replacements,
          ...postJoin.replacements,
        },
        type: QueryTypes.SELECT,
      },
    );

    const row = rows[0];

    return {
      totalAssets: toNumber(row?.totalAssets),
      totalCost: toNumber(row?.totalCost),
      avgCpu: toNullableNumber(row?.avgCpu),
      totalStorageGb: toNullableNumber(row?.totalStorageGb),
      recommendationCount: toNumber(row?.recommendationCount),
    };
  }

  async getFilterOptions(params: DatabaseAssetsQueryParams): Promise<DatabaseAssetsFilterOptions> {
    const replacements: ReplacementMap = {
      tenantId: params.tenantId,
      startDate: params.startDate,
      endDate: params.endDate,
    };

    const cloudFilter = params.cloudConnectionId
      ? 'AND f.cloud_connection_id = CAST(:cloudConnectionId AS uuid)'
      : '';

    if (params.cloudConnectionId) {
      replacements.cloudConnectionId = params.cloudConnectionId;
    }

    const optionsBaseCte = `
WITH scoped_fact AS (
  SELECT f.*
  FROM fact_db_resource_daily f
  WHERE f.tenant_id = CAST(:tenantId AS uuid)
    AND f.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
    ${cloudFilter}
),
resources AS (
  SELECT DISTINCT ON (f.tenant_id, f.cloud_connection_id, f.resource_id)
    f.tenant_id,
    f.cloud_connection_id,
    f.resource_id,
    f.db_service,
    f.db_engine,
    f.region_key,
    f.sub_account_key,
    f.status
  FROM scoped_fact f
  ORDER BY f.tenant_id, f.cloud_connection_id, f.resource_id, f.usage_date DESC
),
latest_inventory AS (
  SELECT ranked.*
  FROM (
    SELECT
      inv.tenant_id,
      inv.cloud_connection_id,
      inv.resource_id,
      inv.instance_class,
      inv.status,
      inv.region_key,
      inv.sub_account_key,
      ROW_NUMBER() OVER (
        PARTITION BY inv.tenant_id, inv.cloud_connection_id, inv.resource_id
        ORDER BY CASE WHEN inv.is_current THEN 0 ELSE 1 END ASC, inv.discovered_at DESC
      ) AS row_num
    FROM db_resource_inventory_snapshots inv
    WHERE inv.tenant_id = CAST(:tenantId AS uuid)
  ) ranked
  WHERE ranked.row_num = 1
),
final_assets AS (
  SELECT
    r.resource_id,
    r.db_service,
    r.db_engine,
    COALESCE(li.instance_class, NULL) AS instance_class,
    COALESCE(li.status, r.status) AS status,
    COALESCE(li.region_key, r.region_key) AS region_key,
    COALESCE(li.sub_account_key, r.sub_account_key) AS sub_account_key
  FROM resources r
  LEFT JOIN latest_inventory li
    ON li.tenant_id = r.tenant_id
   AND li.resource_id = r.resource_id
   AND (
     li.cloud_connection_id = r.cloud_connection_id
     OR (li.cloud_connection_id IS NULL AND r.cloud_connection_id IS NULL)
   )
)
`;

    const [dbServices, dbEngines, classes, statuses, regions, accounts] = await Promise.all([
      sequelize.query<ValueOptionRow>(
        `
${optionsBaseCte}
SELECT
  fa.db_service AS value,
  fa.db_service AS label,
  COUNT(*) AS count
FROM final_assets fa
WHERE fa.db_service IS NOT NULL AND BTRIM(fa.db_service) <> ''
GROUP BY fa.db_service
ORDER BY count DESC, value ASC;
`,
        { replacements, type: QueryTypes.SELECT },
      ),
      sequelize.query<ValueOptionRow>(
        `
${optionsBaseCte}
SELECT
  fa.db_engine AS value,
  fa.db_engine AS label,
  COUNT(*) AS count
FROM final_assets fa
WHERE fa.db_engine IS NOT NULL AND BTRIM(fa.db_engine) <> ''
GROUP BY fa.db_engine
ORDER BY count DESC, value ASC;
`,
        { replacements, type: QueryTypes.SELECT },
      ),
      sequelize.query<ValueOptionRow>(
        `
${optionsBaseCte}
SELECT
  fa.instance_class AS value,
  fa.instance_class AS label,
  COUNT(*) AS count
FROM final_assets fa
WHERE fa.instance_class IS NOT NULL AND BTRIM(fa.instance_class) <> ''
GROUP BY fa.instance_class
ORDER BY count DESC, value ASC;
`,
        { replacements, type: QueryTypes.SELECT },
      ),
      sequelize.query<ValueOptionRow>(
        `
${optionsBaseCte}
SELECT
  fa.status AS value,
  fa.status AS label,
  COUNT(*) AS count
FROM final_assets fa
WHERE fa.status IS NOT NULL AND BTRIM(fa.status) <> ''
GROUP BY fa.status
ORDER BY count DESC, value ASC;
`,
        { replacements, type: QueryTypes.SELECT },
      ),
      sequelize.query<RegionOptionRow>(
        `
${optionsBaseCte}
SELECT
  fa.region_key AS "regionKey",
  dr.region_id AS "regionId",
  dr.region_name AS "regionName",
  COUNT(*) AS count
FROM final_assets fa
LEFT JOIN dim_region dr ON dr.id = fa.region_key
WHERE fa.region_key IS NOT NULL
GROUP BY fa.region_key, dr.region_id, dr.region_name
ORDER BY count DESC, "regionName" ASC NULLS LAST;
`,
        { replacements, type: QueryTypes.SELECT },
      ),
      sequelize.query<AccountOptionRow>(
        `
${optionsBaseCte}
SELECT
  fa.sub_account_key AS "subAccountKey",
  dsa.sub_account_id AS "subAccountId",
  dsa.sub_account_name AS "subAccountName",
  COUNT(*) AS count
FROM final_assets fa
LEFT JOIN dim_sub_account dsa ON dsa.id = fa.sub_account_key
WHERE fa.sub_account_key IS NOT NULL
GROUP BY fa.sub_account_key, dsa.sub_account_id, dsa.sub_account_name
ORDER BY count DESC, "subAccountName" ASC NULLS LAST;
`,
        { replacements, type: QueryTypes.SELECT },
      ),
    ]);

    const mapValueOptions = (rows: ValueOptionRow[]): DatabaseAssetsFilterValueOption[] =>
      rows
        .map((row) => ({
          value: toNullableString(row.value) ?? "",
          label: toNullableString(row.label) ?? toNullableString(row.value) ?? "",
          count: toNumber(row.count),
        }))
        .filter((row) => row.value.length > 0);

    return {
      dbServices: mapValueOptions(dbServices),
      dbEngines: mapValueOptions(dbEngines),
      classes: mapValueOptions(classes),
      statuses: mapValueOptions(statuses),
      regions: regions
        .map((row): DatabaseAssetsRegionOption | null => {
          const regionKey = toNullableString(row.regionKey);
          if (!regionKey) return null;
          return {
            regionKey,
            regionId: row.regionId,
            regionName: row.regionName,
            count: toNumber(row.count),
          };
        })
        .filter((row): row is DatabaseAssetsRegionOption => Boolean(row)),
      accounts: accounts
        .map((row): DatabaseAssetsAccountOption | null => {
          const subAccountKey = toNullableString(row.subAccountKey);
          if (!subAccountKey) return null;
          return {
            subAccountKey,
            subAccountId: row.subAccountId,
            subAccountName: row.subAccountName,
            count: toNumber(row.count),
          };
        })
        .filter((row): row is DatabaseAssetsAccountOption => Boolean(row)),
    };
  }
}
