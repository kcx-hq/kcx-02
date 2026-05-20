import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type {
  DatabaseAssetDetailQueryParams,
  DatabaseAssetDetailResponse,
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
  cloudConnectionId: string | null;
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
  hasLiveInventory: boolean;
  endpoint: string | null;
  endpointPort: string | number | null;
  multiAz: boolean | null;
  storageEncrypted: boolean | null;
  deletionProtection: boolean | null;
  backupRetentionPeriod: string | number | null;
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

type DetailIdentityRow = {
  resourceId: string;
  resourceArn: string | null;
  resourceName: string | null;
  dbIdentifier: string;
  dbService: string | null;
  dbEngine: string | null;
  dbEngineVersion: string | null;
  resourceType: string | null;
  instanceClass: string | null;
  capacityMode: string | null;
  status: string | null;
  clusterId: string | null;
  isClusterResource: boolean | null;
  regionKey: string | null;
  regionName: string | null;
  subAccountKey: string | null;
  subAccountName: string | null;
  cloudConnectionId: string;
  latestUsageDate: string | Date | null;
  discoveredAt: string | Date | null;
  hasLiveInventory: boolean;
  endpoint: string | null;
  endpointPort: string | number | null;
  multiAz: boolean | null;
  storageEncrypted: boolean | null;
  deletionProtection: boolean | null;
  backupRetentionPeriod: string | number | null;
  tags: Record<string, unknown> | null;
  rawMetadata: Record<string, unknown> | null;
};

type DetailAggregateRow = {
  totalCost: string | number | null;
  totalBilledCost: string | number | null;
  totalEffectiveCost: string | number | null;
  totalListCost: string | number | null;
  currencyCode: string | null;
  dailyAverageCost: string | number | null;
  computeCost: string | number | null;
  storageCost: string | number | null;
  ioCost: string | number | null;
  backupCost: string | number | null;
  dataTransferCost: string | number | null;
  taxCost: string | number | null;
  creditAmount: string | number | null;
  refundAmount: string | number | null;
  avgCpu: string | number | null;
  maxCpu: string | number | null;
  avgLoad: string | number | null;
  maxLoad: string | number | null;
  avgConnections: string | number | null;
  maxConnections: string | number | null;
  requestCount: string | number | null;
  allocatedStorageGb: string | number | null;
  storageUsedGb: string | number | null;
  dataFootprintGb: string | number | null;
  avgIops: string | number | null;
  maxIops: string | number | null;
  avgThroughputBytes: string | number | null;
  maxThroughputBytes: string | number | null;
  readIops: string | number | null;
  writeIops: string | number | null;
  readThroughputBytes: string | number | null;
  writeThroughputBytes: string | number | null;
  dayCount: string | number | null;
};

type RecommendationCountRow = {
  recommendationCount: string | number | null;
};

type RelatedResourceCountRow = {
  relatedResourceCount: string | number | null;
};

type CostTrendRow = {
  date: string | Date;
  totalCost: string | number | null;
  compute: string | number | null;
  storage: string | number | null;
  io: string | number | null;
  backup: string | number | null;
  dataTransfer: string | number | null;
  tax: string | number | null;
  credit: string | number | null;
  refund: string | number | null;
  other: string | number | null;
};

type UsageTrendRow = {
  date: string | Date;
  avgCpu: string | number | null;
  maxCpu: string | number | null;
  avgLoad: string | number | null;
  maxLoad: string | number | null;
  avgConnections: string | number | null;
  maxConnections: string | number | null;
  requestCount: string | number | null;
};

type StorageTrendRow = {
  date: string | Date;
  allocatedStorageGb: string | number | null;
  storageUsedGb: string | number | null;
  dataFootprintGb: string | number | null;
};

type PerformanceTrendRow = {
  date: string | Date;
  readIops: string | number | null;
  writeIops: string | number | null;
  totalIops: string | number | null;
  readThroughputBytes: string | number | null;
  writeThroughputBytes: string | number | null;
  totalThroughputBytes: string | number | null;
  avgLoad: string | number | null;
  avgConnections: string | number | null;
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

const toNullableBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  return null;
};

const extractStringFromMetadata = (metadata: Record<string, unknown> | null, keys: string[]): string | null => {
  if (!metadata || typeof metadata !== "object") return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
};

const extractNumberFromMetadata = (metadata: Record<string, unknown> | null, keys: string[]): number | null => {
  if (!metadata || typeof metadata !== "object") return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const extractBooleanFromMetadata = (metadata: Record<string, unknown> | null, keys: string[]): boolean | null => {
  if (!metadata || typeof metadata !== "object") return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "boolean") return value;
  }
  return null;
};

const extractArnIdentifier = (value: string | null | undefined): string | null => {
  const arn = toNullableString(value);
  if (!arn || !arn.toLowerCase().startsWith("arn:")) return null;
  const parts = arn.split(":");
  if (parts.length < 6) return null;
  const resourcePart = parts.slice(5).join(":").trim();
  if (!resourcePart) return null;

  const slashIdx = resourcePart.lastIndexOf("/");
  const colonIdx = resourcePart.lastIndexOf(":");
  const separatorIdx = Math.max(slashIdx, colonIdx);
  const tail = separatorIdx >= 0 ? resourcePart.slice(separatorIdx + 1).trim() : resourcePart;
  return tail.length > 0 ? tail : null;
};

const cleanIdentifierFromCandidates = (candidates: Array<string | null | undefined>): string | null => {
  for (const candidate of candidates) {
    const normalized = toNullableString(candidate);
    if (!normalized) continue;
    if (normalized.toLowerCase().startsWith("arn:")) continue;
    return normalized;
  }
  return null;
};

const resolveDbIdentifier = (input: {
  resourceName: string | null;
  dbIdentifier: string | null;
  resourceId: string;
  resourceArn: string | null;
  clusterId: string | null;
  metadata: Record<string, unknown> | null;
}): string => {
  const metadata = input.metadata;
  const metadataPreferred = cleanIdentifierFromCandidates([
    extractStringFromMetadata(metadata, ["dbIdentifier", "db_identifier"]),
    extractStringFromMetadata(metadata, ["dbName", "db_name"]),
    extractStringFromMetadata(metadata, ["clusterIdentifier", "cluster_identifier"]),
    extractStringFromMetadata(metadata, ["tableName", "table_name"]),
    extractStringFromMetadata(metadata, ["cacheClusterId", "cache_cluster_id"]),
  ]);

  const directPreferred = cleanIdentifierFromCandidates([
    input.resourceName,
    input.dbIdentifier,
    input.clusterId,
  ]);

  const arnDerived =
    extractArnIdentifier(input.resourceArn)
    ?? extractArnIdentifier(input.resourceId)
    ?? extractArnIdentifier(input.dbIdentifier);

  const shortFallback = cleanIdentifierFromCandidates([
    input.resourceId.includes("/") ? input.resourceId.split("/").pop() ?? null : null,
    input.resourceId.includes(":") ? input.resourceId.split(":").pop() ?? null : null,
  ]);

  return metadataPreferred ?? directPreferred ?? arnDerived ?? shortFallback ?? input.resourceId;
};

const normalizeDbEngine = (input: {
  dbEngine: string | null;
  dbService: string | null;
  resourceType: string | null;
  resourceArn: string | null;
  metadata: Record<string, unknown> | null;
}): string | null => {
  const explicit = toNullableString(input.dbEngine);
  if (explicit && explicit.toLowerCase() !== "unknown") return explicit;

  const service = (input.dbService ?? "").toLowerCase();
  const type = (input.resourceType ?? "").toLowerCase();
  const arn = (input.resourceArn ?? "").toLowerCase();
  const metaEngine = extractStringFromMetadata(input.metadata, ["engine", "dbEngine", "db_engine"])?.toLowerCase() ?? "";

  if (service.includes("dynamodb") || arn.includes(":dynamodb:") || type.includes("dynamodb")) return "DynamoDB";
  if (service.includes("aurora") || metaEngine.includes("aurora")) {
    if (metaEngine.includes("postgres")) return "Aurora PostgreSQL";
    if (metaEngine.includes("mysql")) return "Aurora MySQL";
    if (type.includes("postgres")) return "Aurora PostgreSQL";
    if (type.includes("mysql")) return "Aurora MySQL";
    return "Aurora";
  }
  if (service.includes("elasticache") || arn.includes(":elasticache:")) {
    if (metaEngine.includes("memcached") || type.includes("memcached")) return "Memcached";
    if (metaEngine.includes("valkey") || type.includes("valkey")) return "Valkey";
    if (metaEngine.includes("redis") || type.includes("redis")) return "Redis";
    return "Redis";
  }
  if (service.includes("memorydb") || arn.includes(":memorydb:")) {
    if (metaEngine.includes("valkey") || type.includes("valkey")) return "Valkey";
    return "Redis";
  }

  return explicit;
};

const computeInventorySource = (hasLiveInventory: boolean, hasBillingSignals: boolean): "aws_sdk" | "billing_only" | "mixed" => {
  if (hasLiveInventory && hasBillingSignals) return "mixed";
  if (hasLiveInventory) return "aws_sdk";
  return "billing_only";
};

const computeInventoryFreshnessMinutes = (observedAtIso: string | null): number | null => {
  if (!observedAtIso) return null;
  const observedAt = new Date(observedAtIso);
  if (Number.isNaN(observedAt.getTime())) return null;
  const deltaMs = Date.now() - observedAt.getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return 0;
  return Math.floor(deltaMs / 60000);
};

const toStorageUtilizationPct = (
  usedStorageGb: number | null,
  allocatedStorageGb: number | null,
): number | null => {
  if (
    usedStorageGb === null
    || allocatedStorageGb === null
    || !Number.isFinite(usedStorageGb)
    || !Number.isFinite(allocatedStorageGb)
    || allocatedStorageGb <= 0
  ) {
    return null;
  }
  return (usedStorageGb / allocatedStorageGb) * 100;
};

const costDriverLabel = (row: DetailAggregateRow): string | null => {
  const ranked = [
    { label: "Compute", value: toNumber(row.computeCost) },
    { label: "Storage", value: toNumber(row.storageCost) },
    { label: "I/O", value: toNumber(row.ioCost) },
    { label: "Backup", value: toNumber(row.backupCost) },
    { label: "Data Transfer", value: toNumber(row.dataTransferCost) },
  ].sort((a, b) => b.value - a.value);

  return ranked[0] && ranked[0].value > 0 ? ranked[0].label : null;
};

const NON_SCOPED_FACT_FILTER_SQL = `
COALESCE(LOWER(BTRIM(f.resource_type)), '') <> 'scoped'
      AND f.resource_id NOT LIKE 'db-scope:%'
`;

const buildScopedFactWhere = (params: DatabaseAssetsQueryParams): SqlWhere => {
  const clauses = [
    'f.tenant_id = CAST(:tenantId AS uuid)',
    'f.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)',
    NON_SCOPED_FACT_FILTER_SQL,
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
scoped_util AS (
  SELECT u.*
  FROM db_utilization_daily u
  WHERE u.tenant_id = CAST(:tenantId AS uuid)
    AND u.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
    AND (
      :cloudConnectionId IS NULL
      OR u.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
    )
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
    AVG(
      CASE
        WHEN f.read_iops IS NULL AND f.write_iops IS NULL THEN NULL
        ELSE COALESCE(f.read_iops, 0) + COALESCE(f.write_iops, 0)
      END
    ) AS avg_iops,
    AVG(
      CASE
        WHEN f.read_throughput_bytes IS NULL AND f.write_throughput_bytes IS NULL THEN NULL
        ELSE COALESCE(f.read_throughput_bytes, 0) + COALESCE(f.write_throughput_bytes, 0)
      END
    ) AS avg_throughput_bytes,
    COALESCE(SUM(f.total_billed_cost), 0) AS total_billed_cost,
    COALESCE(SUM(f.total_effective_cost), 0) AS total_effective_cost,
    COALESCE(SUM(f.total_list_cost), 0) AS total_list_cost,
    COALESCE(SUM(f.total_billed_cost), 0) AS total_cost,
    MAX(f.currency_code) AS currency_code,
    MAX(f.usage_date) AS latest_usage_date
  FROM scoped_fact f
  GROUP BY f.tenant_id, f.cloud_connection_id, f.resource_id
),
aggregated_util AS (
  SELECT
    u.tenant_id,
    u.cloud_connection_id,
    u.resource_id,
    AVG(u.cpu_avg) AS avg_cpu,
    MAX(u.cpu_max) AS max_cpu,
    AVG(u.connections_avg) AS avg_connections,
    MAX(u.connections_max) AS max_connections,
    AVG(
      CASE
        WHEN u.read_iops IS NULL AND u.write_iops IS NULL THEN NULL
        ELSE COALESCE(u.read_iops, 0) + COALESCE(u.write_iops, 0)
      END
    ) AS avg_iops,
    AVG(
      CASE
        WHEN u.read_throughput_bytes IS NULL AND u.write_throughput_bytes IS NULL THEN NULL
        ELSE COALESCE(u.read_throughput_bytes, 0) + COALESCE(u.write_throughput_bytes, 0)
      END
    ) AS avg_throughput_bytes
  FROM scoped_util u
  GROUP BY u.tenant_id, u.cloud_connection_id, u.resource_id
),
latest_util AS (
  SELECT ranked.*
  FROM (
    SELECT
      u.tenant_id,
      u.cloud_connection_id,
      u.resource_id,
      u.usage_date,
      u.allocated_storage_gb,
      u.storage_used_gb,
      u.updated_at,
      ROW_NUMBER() OVER (
        PARTITION BY u.tenant_id, u.cloud_connection_id, u.resource_id
        ORDER BY u.usage_date DESC, u.updated_at DESC
      ) AS row_num
    FROM scoped_util u
  ) ranked
  WHERE ranked.row_num = 1
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
    a.cloud_connection_id,
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
    COALESCE(lu.allocated_storage_gb, li.allocated_storage_gb, a.fact_allocated_storage_gb) AS allocated_storage_gb,
    COALESCE(lu.storage_used_gb, a.fact_storage_used_gb) AS storage_used_gb,
    COALESCE(li.data_footprint_gb, a.fact_data_footprint_gb) AS data_footprint_gb,
    COALESCE(au.avg_cpu, a.avg_cpu) AS avg_cpu,
    COALESCE(au.max_cpu, a.max_cpu) AS max_cpu,
    COALESCE(au.avg_connections, a.avg_connections) AS avg_connections,
    COALESCE(au.max_connections, a.max_connections) AS max_connections,
    COALESCE(au.avg_iops, a.avg_iops) AS avg_iops,
    COALESCE(au.avg_throughput_bytes, a.avg_throughput_bytes) AS avg_throughput_bytes,
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
  LEFT JOIN aggregated_util au
    ON au.tenant_id = a.tenant_id
   AND au.resource_id = a.resource_id
   AND (
     au.cloud_connection_id = a.cloud_connection_id
     OR (au.cloud_connection_id IS NULL AND a.cloud_connection_id IS NULL)
   )
  LEFT JOIN latest_util lu
    ON lu.tenant_id = a.tenant_id
   AND lu.resource_id = a.resource_id
   AND (
     lu.cloud_connection_id = a.cloud_connection_id
     OR (lu.cloud_connection_id IS NULL AND a.cloud_connection_id IS NULL)
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
  fa.cloud_connection_id::text AS "cloudConnectionId",
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
  (fa.discovered_at IS NOT NULL) AS "hasLiveInventory",
  COALESCE(
    NULLIF(BTRIM(CAST(fa.metadata->>'endpointAddress' AS text)), ''),
    NULLIF(BTRIM(CAST(fa.metadata->>'endpoint' AS text)), '')
  ) AS endpoint,
  COALESCE(
    NULLIF(BTRIM(CAST(fa.metadata->>'endpointPort' AS text)), ''),
    NULLIF(BTRIM(CAST(fa.metadata->>'port' AS text)), '')
  ) AS "endpointPort",
  (fa.metadata->>'multiAz')::boolean AS "multiAz",
  (fa.metadata->>'storageEncrypted')::boolean AS "storageEncrypted",
  (fa.metadata->>'deletionProtection')::boolean AS "deletionProtection",
  NULLIF(BTRIM(CAST(fa.metadata->>'backupRetentionPeriod' AS text)), '') AS "backupRetentionPeriod",
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
          cloudConnectionId: params.cloudConnectionId ?? null,
          pageSize: params.pageSize,
          offset,
        },
        type: QueryTypes.SELECT,
      },
    );

    const total = toNumber(rows[0]?.totalCount);

    return {
      assets: rows.map((row) => {
        const inventoryObservedAt = toIsoTimestamp(row.discoveredAt);
        const metadata = row.metadata;
        return {
          hasLiveInventory: row.hasLiveInventory === true,
          inventorySource: computeInventorySource(row.hasLiveInventory === true, true),
          inventoryObservedAt,
          inventoryFreshnessMinutes: computeInventoryFreshnessMinutes(inventoryObservedAt),
        cloudConnectionId: row.cloudConnectionId,
        resourceId: row.resourceId,
        resourceArn: row.resourceArn,
        resourceName: row.resourceName,
        dbIdentifier: resolveDbIdentifier({
          resourceName: row.resourceName,
          dbIdentifier: row.dbIdentifier,
          resourceId: row.resourceId,
          resourceArn: row.resourceArn,
          clusterId: row.clusterId,
          metadata,
        }),
        dbService: row.dbService,
        dbEngine: normalizeDbEngine({
          dbEngine: row.dbEngine,
          dbService: row.dbService,
          resourceType: row.resourceType,
          resourceArn: row.resourceArn,
          metadata,
        }),
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
        endpoint: toNullableString(row.endpoint) ?? extractStringFromMetadata(row.metadata, ["endpointAddress", "endpoint"]),
        endpointPort:
          toNullableNumber(row.endpointPort) ??
          extractNumberFromMetadata(row.metadata, ["endpointPort", "port"]),
        multiAz: toNullableBoolean(row.multiAz) ?? extractBooleanFromMetadata(row.metadata, ["multiAz"]),
        storageEncrypted:
          toNullableBoolean(row.storageEncrypted) ?? extractBooleanFromMetadata(row.metadata, ["storageEncrypted"]),
        deletionProtection:
          toNullableBoolean(row.deletionProtection) ?? extractBooleanFromMetadata(row.metadata, ["deletionProtection"]),
        backupRetentionPeriod:
          toNullableNumber(row.backupRetentionPeriod) ??
          extractNumberFromMetadata(row.metadata, ["backupRetentionPeriod"]),
        metadata: row.metadata,
      }}),
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
          cloudConnectionId: params.cloudConnectionId ?? null,
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

  async getAssetDetail(params: DatabaseAssetDetailQueryParams): Promise<DatabaseAssetDetailResponse | null> {
    if (params.resourceId.startsWith("db-scope:")) {
      return null;
    }

    const replacements = {
      tenantId: params.tenantId,
      cloudConnectionId: params.cloudConnectionId,
      resourceId: params.resourceId,
      startDate: params.startDate,
      endDate: params.endDate,
    };

    const [identityRows, aggregateRows, recommendationRows, topologyRows, costTrendRows, usageTrendRows, storageTrendRows, performanceTrendRows] =
      await Promise.all([
        sequelize.query<DetailIdentityRow>(
          `
WITH scoped_fact AS (
  SELECT *
  FROM fact_db_resource_daily f
  WHERE f.tenant_id = CAST(:tenantId AS uuid)
    AND f.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
    AND f.resource_id = :resourceId
    AND COALESCE(LOWER(BTRIM(f.resource_type)), '') <> 'scoped'
    AND f.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
),
latest_inventory AS (
  SELECT ranked.*
  FROM (
    SELECT
      inv.*,
      ROW_NUMBER() OVER (
        PARTITION BY inv.tenant_id, inv.cloud_connection_id, inv.resource_id
        ORDER BY CASE WHEN inv.is_current THEN 0 ELSE 1 END ASC, inv.discovered_at DESC, inv.updated_at DESC
      ) AS row_num
    FROM db_resource_inventory_snapshots inv
    WHERE inv.tenant_id = CAST(:tenantId AS uuid)
      AND inv.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
      AND inv.resource_id = :resourceId
      AND inv.deleted_at IS NULL
  ) ranked
  WHERE ranked.row_num = 1
),
fact_identity AS (
  SELECT
    sf.resource_id,
    MAX(sf.resource_arn) AS resource_arn,
    MAX(sf.resource_name) AS resource_name,
    MAX(sf.db_service) AS db_service,
    MAX(sf.db_engine) AS db_engine,
    MAX(sf.db_engine_version) AS db_engine_version,
    MAX(sf.resource_type) AS resource_type,
    MAX(sf.status) AS status,
    MAX(sf.cluster_id) AS cluster_id,
    COALESCE(BOOL_OR(COALESCE(sf.is_cluster_resource, false)), false) AS is_cluster_resource,
    MAX(sf.region_key) AS region_key,
    MAX(sf.sub_account_key) AS sub_account_key,
    MAX(sf.usage_date) AS latest_usage_date
  FROM scoped_fact sf
  GROUP BY sf.resource_id
)
SELECT
  fi.resource_id AS "resourceId",
  COALESCE(li.resource_arn, fi.resource_arn) AS "resourceArn",
  COALESCE(li.resource_name, fi.resource_name) AS "resourceName",
  COALESCE(NULLIF(BTRIM(COALESCE(li.resource_name, fi.resource_name)), ''), fi.resource_id) AS "dbIdentifier",
  COALESCE(li.db_service, fi.db_service) AS "dbService",
  COALESCE(li.db_engine, fi.db_engine) AS "dbEngine",
  COALESCE(li.db_engine_version, fi.db_engine_version) AS "dbEngineVersion",
  COALESCE(li.resource_type, fi.resource_type) AS "resourceType",
  li.instance_class AS "instanceClass",
  li.capacity_mode AS "capacityMode",
  COALESCE(li.status, fi.status) AS "status",
  COALESCE(li.cluster_id, fi.cluster_id) AS "clusterId",
  COALESCE(li.is_cluster_resource, fi.is_cluster_resource, false) AS "isClusterResource",
  COALESCE(li.region_key::text, fi.region_key::text) AS "regionKey",
  dr.region_name AS "regionName",
  COALESCE(li.sub_account_key::text, fi.sub_account_key::text) AS "subAccountKey",
  dsa.sub_account_name AS "subAccountName",
  CAST(:cloudConnectionId AS text) AS "cloudConnectionId",
  fi.latest_usage_date AS "latestUsageDate",
  li.discovered_at AS "discoveredAt",
  (li.discovered_at IS NOT NULL) AS "hasLiveInventory",
  COALESCE(
    NULLIF(BTRIM(CAST(li.metadata_json->>'endpointAddress' AS text)), ''),
    NULLIF(BTRIM(CAST(li.metadata_json->>'endpoint' AS text)), '')
  ) AS endpoint,
  COALESCE(
    NULLIF(BTRIM(CAST(li.metadata_json->>'endpointPort' AS text)), ''),
    NULLIF(BTRIM(CAST(li.metadata_json->>'port' AS text)), '')
  ) AS "endpointPort",
  (li.metadata_json->>'multiAz')::boolean AS "multiAz",
  (li.metadata_json->>'storageEncrypted')::boolean AS "storageEncrypted",
  (li.metadata_json->>'deletionProtection')::boolean AS "deletionProtection",
  NULLIF(BTRIM(CAST(li.metadata_json->>'backupRetentionPeriod' AS text)), '') AS "backupRetentionPeriod",
  li.tags_json AS tags,
  li.metadata_json AS "rawMetadata"
FROM fact_identity fi
LEFT JOIN latest_inventory li
  ON li.resource_id = fi.resource_id
LEFT JOIN dim_region dr
  ON dr.id = COALESCE(li.region_key, fi.region_key)
LEFT JOIN dim_sub_account dsa
  ON dsa.id = COALESCE(li.sub_account_key, fi.sub_account_key);
`,
          { replacements, type: QueryTypes.SELECT },
        ),
        sequelize.query<DetailAggregateRow>(
          `
SELECT
  cost_summary."totalCost",
  fact_summary."totalBilledCost",
  fact_summary."totalEffectiveCost",
  fact_summary."totalListCost",
  fact_summary."currencyCode",
  CASE
    WHEN fact_summary."dayCount" > 0 THEN cost_summary."totalCost" / fact_summary."dayCount"
    ELSE NULL
  END AS "dailyAverageCost",
  cost_summary."computeCost",
  cost_summary."storageCost",
  cost_summary."ioCost",
  cost_summary."backupCost",
  cost_summary."dataTransferCost",
  cost_summary."taxCost",
  cost_summary."creditAmount",
  cost_summary."refundAmount",
  COALESCE(util_summary."avgCpu", fact_summary."avgCpu") AS "avgCpu",
  COALESCE(util_summary."maxCpu", fact_summary."maxCpu") AS "maxCpu",
  fact_summary."avgLoad",
  fact_summary."maxLoad",
  COALESCE(util_summary."avgConnections", fact_summary."avgConnections") AS "avgConnections",
  COALESCE(util_summary."maxConnections", fact_summary."maxConnections") AS "maxConnections",
  fact_summary."requestCount",
  COALESCE(util_summary."allocatedStorageGb", fact_summary."allocatedStorageGb") AS "allocatedStorageGb",
  COALESCE(util_summary."storageUsedGb", fact_summary."storageUsedGb") AS "storageUsedGb",
  fact_summary."dataFootprintGb",
  COALESCE(util_summary."avgIops", fact_summary."avgIops") AS "avgIops",
  COALESCE(util_summary."maxIops", fact_summary."maxIops") AS "maxIops",
  COALESCE(util_summary."avgThroughputBytes", fact_summary."avgThroughputBytes") AS "avgThroughputBytes",
  COALESCE(util_summary."maxThroughputBytes", fact_summary."maxThroughputBytes") AS "maxThroughputBytes",
  COALESCE(util_summary."readIops", fact_summary."readIops") AS "readIops",
  COALESCE(util_summary."writeIops", fact_summary."writeIops") AS "writeIops",
  COALESCE(util_summary."readThroughputBytes", fact_summary."readThroughputBytes") AS "readThroughputBytes",
  COALESCE(util_summary."writeThroughputBytes", fact_summary."writeThroughputBytes") AS "writeThroughputBytes",
  fact_summary."dayCount"
FROM (
  SELECT
    COALESCE(SUM(f.total_billed_cost), 0) AS "totalBilledCost",
    COALESCE(SUM(f.total_effective_cost), 0) AS "totalEffectiveCost",
    COALESCE(SUM(f.total_list_cost), 0) AS "totalListCost",
    MAX(f.currency_code) AS "currencyCode",
    AVG(f.cpu_avg) AS "avgCpu",
    MAX(f.cpu_max) AS "maxCpu",
    AVG(f.load_avg) AS "avgLoad",
    MAX(f.load_avg) AS "maxLoad",
    AVG(f.connections_avg) AS "avgConnections",
    MAX(f.connections_max) AS "maxConnections",
    SUM(f.request_count) AS "requestCount",
    MAX(f.allocated_storage_gb) AS "allocatedStorageGb",
    MAX(f.storage_used_gb) AS "storageUsedGb",
    MAX(f.data_footprint_gb) AS "dataFootprintGb",
    AVG(
      CASE
        WHEN f.read_iops IS NULL AND f.write_iops IS NULL THEN NULL
        ELSE COALESCE(f.read_iops, 0) + COALESCE(f.write_iops, 0)
      END
    ) AS "avgIops",
    MAX(
      CASE
        WHEN f.read_iops IS NULL AND f.write_iops IS NULL THEN NULL
        ELSE COALESCE(f.read_iops, 0) + COALESCE(f.write_iops, 0)
      END
    ) AS "maxIops",
    AVG(
      CASE
        WHEN f.read_throughput_bytes IS NULL AND f.write_throughput_bytes IS NULL THEN NULL
        ELSE COALESCE(f.read_throughput_bytes, 0) + COALESCE(f.write_throughput_bytes, 0)
      END
    ) AS "avgThroughputBytes",
    MAX(
      CASE
        WHEN f.read_throughput_bytes IS NULL AND f.write_throughput_bytes IS NULL THEN NULL
        ELSE COALESCE(f.read_throughput_bytes, 0) + COALESCE(f.write_throughput_bytes, 0)
      END
    ) AS "maxThroughputBytes",
    AVG(f.read_iops) AS "readIops",
    AVG(f.write_iops) AS "writeIops",
    AVG(f.read_throughput_bytes) AS "readThroughputBytes",
    AVG(f.write_throughput_bytes) AS "writeThroughputBytes",
    COUNT(*) AS "dayCount"
  FROM fact_db_resource_daily f
  WHERE f.tenant_id = CAST(:tenantId AS uuid)
    AND f.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
    AND f.resource_id = :resourceId
    AND COALESCE(LOWER(BTRIM(f.resource_type)), '') <> 'scoped'
    AND f.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
) fact_summary
CROSS JOIN (
  SELECT
    AVG(u.cpu_avg) AS "avgCpu",
    MAX(u.cpu_max) AS "maxCpu",
    AVG(u.connections_avg) AS "avgConnections",
    MAX(u.connections_max) AS "maxConnections",
    MAX(u.allocated_storage_gb) AS "allocatedStorageGb",
    MAX(u.storage_used_gb) AS "storageUsedGb",
    AVG(
      CASE
        WHEN u.read_iops IS NULL AND u.write_iops IS NULL THEN NULL
        ELSE COALESCE(u.read_iops, 0) + COALESCE(u.write_iops, 0)
      END
    ) AS "avgIops",
    MAX(
      CASE
        WHEN u.read_iops IS NULL AND u.write_iops IS NULL THEN NULL
        ELSE COALESCE(u.read_iops, 0) + COALESCE(u.write_iops, 0)
      END
    ) AS "maxIops",
    AVG(
      CASE
        WHEN u.read_throughput_bytes IS NULL AND u.write_throughput_bytes IS NULL THEN NULL
        ELSE COALESCE(u.read_throughput_bytes, 0) + COALESCE(u.write_throughput_bytes, 0)
      END
    ) AS "avgThroughputBytes",
    MAX(
      CASE
        WHEN u.read_throughput_bytes IS NULL AND u.write_throughput_bytes IS NULL THEN NULL
        ELSE COALESCE(u.read_throughput_bytes, 0) + COALESCE(u.write_throughput_bytes, 0)
      END
    ) AS "maxThroughputBytes",
    AVG(u.read_iops) AS "readIops",
    AVG(u.write_iops) AS "writeIops",
    AVG(u.read_throughput_bytes) AS "readThroughputBytes",
    AVG(u.write_throughput_bytes) AS "writeThroughputBytes"
  FROM db_utilization_daily u
  WHERE u.tenant_id = CAST(:tenantId AS uuid)
    AND u.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
    AND u.resource_id = :resourceId
    AND u.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
) util_summary
CROSS JOIN (
  SELECT
    COALESCE(SUM(ch.billed_cost), 0) AS "totalCost",
    COALESCE(SUM(CASE WHEN ch.cost_category = 'compute' THEN ch.billed_cost ELSE 0 END), 0) AS "computeCost",
    COALESCE(SUM(CASE WHEN ch.cost_category = 'storage' THEN ch.billed_cost ELSE 0 END), 0) AS "storageCost",
    COALESCE(SUM(CASE WHEN ch.cost_category = 'io' THEN ch.billed_cost ELSE 0 END), 0) AS "ioCost",
    COALESCE(SUM(CASE WHEN ch.cost_category = 'backup' THEN ch.billed_cost ELSE 0 END), 0) AS "backupCost",
    COALESCE(SUM(CASE WHEN ch.cost_category = 'data_transfer' THEN ch.billed_cost ELSE 0 END), 0) AS "dataTransferCost",
    COALESCE(SUM(CASE WHEN ch.cost_category = 'tax' THEN ch.billed_cost ELSE 0 END), 0) AS "taxCost",
    COALESCE(SUM(CASE WHEN ch.cost_category = 'credit' THEN ch.billed_cost ELSE 0 END), 0) AS "creditAmount",
    COALESCE(SUM(CASE WHEN ch.cost_category = 'refund' THEN ch.billed_cost ELSE 0 END), 0) AS "refundAmount"
  FROM db_cost_history_daily ch
  WHERE ch.tenant_id = CAST(:tenantId AS uuid)
    AND ch.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
    AND ch.resource_id = :resourceId
    AND ch.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
) cost_summary;
`,
          { replacements, type: QueryTypes.SELECT },
        ),
        sequelize.query<RecommendationCountRow>(
          `
SELECT COUNT(*) AS "recommendationCount"
FROM fact_recommendations fr
WHERE fr.tenant_id = CAST(:tenantId AS uuid)
  AND fr.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
  AND fr.resource_id = :resourceId
  AND UPPER(COALESCE(fr.status, 'OPEN')) = 'OPEN';
`,
          { replacements, type: QueryTypes.SELECT },
        ),
        sequelize.query<RelatedResourceCountRow>(
          `
WITH latest_inventory AS (
  SELECT ranked.*
  FROM (
    SELECT
      inv.*,
      ROW_NUMBER() OVER (
        PARTITION BY inv.tenant_id, inv.cloud_connection_id, inv.resource_id
        ORDER BY CASE WHEN inv.is_current THEN 0 ELSE 1 END ASC, inv.discovered_at DESC, inv.updated_at DESC
      ) AS row_num
    FROM db_resource_inventory_snapshots inv
    WHERE inv.tenant_id = CAST(:tenantId AS uuid)
      AND inv.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
      AND inv.deleted_at IS NULL
  ) ranked
  WHERE ranked.row_num = 1
),
target AS (
  SELECT cluster_id
  FROM latest_inventory
  WHERE resource_id = :resourceId
)
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM target WHERE cluster_id IS NOT NULL AND BTRIM(cluster_id) <> '')
      THEN (
        SELECT COUNT(*)::bigint
        FROM latest_inventory li
        WHERE li.cluster_id = (SELECT cluster_id FROM target LIMIT 1)
      )
    ELSE 1::bigint
  END AS "relatedResourceCount";
`,
          { replacements, type: QueryTypes.SELECT },
        ),
        sequelize.query<CostTrendRow>(
          `
SELECT
  ch.usage_date AS date,
  COALESCE(SUM(ch.billed_cost), 0) AS "totalCost",
  COALESCE(SUM(CASE WHEN ch.cost_category = 'compute' THEN ch.billed_cost ELSE 0 END), 0) AS compute,
  COALESCE(SUM(CASE WHEN ch.cost_category = 'storage' THEN ch.billed_cost ELSE 0 END), 0) AS storage,
  COALESCE(SUM(CASE WHEN ch.cost_category = 'io' THEN ch.billed_cost ELSE 0 END), 0) AS io,
  COALESCE(SUM(CASE WHEN ch.cost_category = 'backup' THEN ch.billed_cost ELSE 0 END), 0) AS backup,
  COALESCE(SUM(CASE WHEN ch.cost_category = 'data_transfer' THEN ch.billed_cost ELSE 0 END), 0) AS "dataTransfer",
  COALESCE(SUM(CASE WHEN ch.cost_category = 'tax' THEN ch.billed_cost ELSE 0 END), 0) AS tax,
  COALESCE(SUM(CASE WHEN ch.cost_category = 'credit' THEN ch.billed_cost ELSE 0 END), 0) AS credit,
  COALESCE(SUM(CASE WHEN ch.cost_category = 'refund' THEN ch.billed_cost ELSE 0 END), 0) AS refund,
  GREATEST(
    COALESCE(SUM(ch.billed_cost), 0)
    - COALESCE(SUM(CASE WHEN ch.cost_category = 'compute' THEN ch.billed_cost ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN ch.cost_category = 'storage' THEN ch.billed_cost ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN ch.cost_category = 'io' THEN ch.billed_cost ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN ch.cost_category = 'backup' THEN ch.billed_cost ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN ch.cost_category = 'data_transfer' THEN ch.billed_cost ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN ch.cost_category = 'tax' THEN ch.billed_cost ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN ch.cost_category = 'credit' THEN ch.billed_cost ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN ch.cost_category = 'refund' THEN ch.billed_cost ELSE 0 END), 0),
    0
  ) AS other
FROM db_cost_history_daily ch
WHERE ch.tenant_id = CAST(:tenantId AS uuid)
  AND ch.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
  AND ch.resource_id = :resourceId
  AND ch.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
GROUP BY ch.usage_date
ORDER BY ch.usage_date ASC;
`,
          { replacements, type: QueryTypes.SELECT },
        ),
        sequelize.query<UsageTrendRow>(
          `
WITH fact_daily AS (
  SELECT
    f.usage_date AS date,
    AVG(f.cpu_avg) AS "factAvgCpu",
    MAX(f.cpu_max) AS "factMaxCpu",
    AVG(f.load_avg) AS "avgLoad",
    MAX(f.load_avg) AS "maxLoad",
    AVG(f.connections_avg) AS "factAvgConnections",
    MAX(f.connections_max) AS "factMaxConnections",
    SUM(f.request_count) AS "requestCount"
  FROM fact_db_resource_daily f
  WHERE f.tenant_id = CAST(:tenantId AS uuid)
    AND f.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
    AND f.resource_id = :resourceId
    AND COALESCE(LOWER(BTRIM(f.resource_type)), '') <> 'scoped'
    AND f.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
  GROUP BY f.usage_date
),
util_daily AS (
  SELECT
    u.usage_date AS date,
    AVG(u.cpu_avg) AS "utilAvgCpu",
    MAX(u.cpu_max) AS "utilMaxCpu",
    AVG(u.connections_avg) AS "utilAvgConnections",
    MAX(u.connections_max) AS "utilMaxConnections"
  FROM db_utilization_daily u
  WHERE u.tenant_id = CAST(:tenantId AS uuid)
    AND u.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
    AND u.resource_id = :resourceId
    AND u.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
  GROUP BY u.usage_date
)
SELECT
  COALESCE(fd.date, ud.date) AS date,
  COALESCE(ud."utilAvgCpu", fd."factAvgCpu") AS "avgCpu",
  COALESCE(ud."utilMaxCpu", fd."factMaxCpu") AS "maxCpu",
  fd."avgLoad" AS "avgLoad",
  fd."maxLoad" AS "maxLoad",
  COALESCE(ud."utilAvgConnections", fd."factAvgConnections") AS "avgConnections",
  COALESCE(ud."utilMaxConnections", fd."factMaxConnections") AS "maxConnections",
  fd."requestCount" AS "requestCount"
FROM fact_daily fd
FULL OUTER JOIN util_daily ud
  ON ud.date = fd.date
ORDER BY COALESCE(fd.date, ud.date) ASC;
`,
          { replacements, type: QueryTypes.SELECT },
        ),
        sequelize.query<StorageTrendRow>(
          `
WITH fact_daily AS (
  SELECT
    f.usage_date AS date,
    MAX(f.allocated_storage_gb) AS "factAllocatedStorageGb",
    MAX(f.storage_used_gb) AS "factStorageUsedGb",
    MAX(f.data_footprint_gb) AS "dataFootprintGb"
  FROM fact_db_resource_daily f
  WHERE f.tenant_id = CAST(:tenantId AS uuid)
    AND f.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
    AND f.resource_id = :resourceId
    AND COALESCE(LOWER(BTRIM(f.resource_type)), '') <> 'scoped'
    AND f.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
  GROUP BY f.usage_date
),
util_daily AS (
  SELECT
    u.usage_date AS date,
    MAX(u.allocated_storage_gb) AS "utilAllocatedStorageGb",
    MAX(u.storage_used_gb) AS "utilStorageUsedGb"
  FROM db_utilization_daily u
  WHERE u.tenant_id = CAST(:tenantId AS uuid)
    AND u.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
    AND u.resource_id = :resourceId
    AND u.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
  GROUP BY u.usage_date
)
SELECT
  COALESCE(fd.date, ud.date) AS date,
  COALESCE(ud."utilAllocatedStorageGb", fd."factAllocatedStorageGb") AS "allocatedStorageGb",
  COALESCE(ud."utilStorageUsedGb", fd."factStorageUsedGb") AS "storageUsedGb",
  fd."dataFootprintGb" AS "dataFootprintGb"
FROM fact_daily fd
FULL OUTER JOIN util_daily ud
  ON ud.date = fd.date
ORDER BY COALESCE(fd.date, ud.date) ASC;
`,
          { replacements, type: QueryTypes.SELECT },
        ),
        sequelize.query<PerformanceTrendRow>(
          `
WITH fact_daily AS (
  SELECT
    f.usage_date AS date,
    AVG(f.read_iops) AS "factReadIops",
    AVG(f.write_iops) AS "factWriteIops",
    AVG(
      CASE
        WHEN f.read_iops IS NULL AND f.write_iops IS NULL THEN NULL
        ELSE COALESCE(f.read_iops, 0) + COALESCE(f.write_iops, 0)
      END
    ) AS "factTotalIops",
    AVG(f.read_throughput_bytes) AS "factReadThroughputBytes",
    AVG(f.write_throughput_bytes) AS "factWriteThroughputBytes",
    AVG(
      CASE
        WHEN f.read_throughput_bytes IS NULL AND f.write_throughput_bytes IS NULL THEN NULL
        ELSE COALESCE(f.read_throughput_bytes, 0) + COALESCE(f.write_throughput_bytes, 0)
      END
    ) AS "factTotalThroughputBytes",
    AVG(f.load_avg) AS "avgLoad",
    AVG(f.connections_avg) AS "factAvgConnections"
  FROM fact_db_resource_daily f
  WHERE f.tenant_id = CAST(:tenantId AS uuid)
    AND f.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
    AND f.resource_id = :resourceId
    AND COALESCE(LOWER(BTRIM(f.resource_type)), '') <> 'scoped'
    AND f.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
  GROUP BY f.usage_date
),
util_daily AS (
  SELECT
    u.usage_date AS date,
    AVG(u.read_iops) AS "utilReadIops",
    AVG(u.write_iops) AS "utilWriteIops",
    AVG(
      CASE
        WHEN u.read_iops IS NULL AND u.write_iops IS NULL THEN NULL
        ELSE COALESCE(u.read_iops, 0) + COALESCE(u.write_iops, 0)
      END
    ) AS "utilTotalIops",
    AVG(u.read_throughput_bytes) AS "utilReadThroughputBytes",
    AVG(u.write_throughput_bytes) AS "utilWriteThroughputBytes",
    AVG(
      CASE
        WHEN u.read_throughput_bytes IS NULL AND u.write_throughput_bytes IS NULL THEN NULL
        ELSE COALESCE(u.read_throughput_bytes, 0) + COALESCE(u.write_throughput_bytes, 0)
      END
    ) AS "utilTotalThroughputBytes",
    AVG(u.connections_avg) AS "utilAvgConnections"
  FROM db_utilization_daily u
  WHERE u.tenant_id = CAST(:tenantId AS uuid)
    AND u.cloud_connection_id = CAST(:cloudConnectionId AS uuid)
    AND u.resource_id = :resourceId
    AND u.usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)
  GROUP BY u.usage_date
)
SELECT
  COALESCE(fd.date, ud.date) AS date,
  COALESCE(ud."utilReadIops", fd."factReadIops") AS "readIops",
  COALESCE(ud."utilWriteIops", fd."factWriteIops") AS "writeIops",
  COALESCE(ud."utilTotalIops", fd."factTotalIops") AS "totalIops",
  COALESCE(ud."utilReadThroughputBytes", fd."factReadThroughputBytes") AS "readThroughputBytes",
  COALESCE(ud."utilWriteThroughputBytes", fd."factWriteThroughputBytes") AS "writeThroughputBytes",
  COALESCE(ud."utilTotalThroughputBytes", fd."factTotalThroughputBytes") AS "totalThroughputBytes",
  fd."avgLoad" AS "avgLoad",
  COALESCE(ud."utilAvgConnections", fd."factAvgConnections") AS "avgConnections"
FROM fact_daily fd
FULL OUTER JOIN util_daily ud
  ON ud.date = fd.date
ORDER BY COALESCE(fd.date, ud.date) ASC;
`,
          { replacements, type: QueryTypes.SELECT },
        ),
      ]);

    const identity = identityRows[0];
    if (!identity) {
      return null;
    }

    const aggregate = aggregateRows[0];
    const recommendationCount = toNumber(recommendationRows[0]?.recommendationCount);
    const relatedResourceCount = toNullableNumber(topologyRows[0]?.relatedResourceCount);
    const storageUtilizationPct = toStorageUtilizationPct(
      toNullableNumber(aggregate?.storageUsedGb),
      toNullableNumber(aggregate?.allocatedStorageGb),
    );

    const availabilityChecks = [
      costTrendRows.length > 0,
      usageTrendRows.some((row) => toNullableNumber(row.avgLoad) !== null || toNullableNumber(row.avgCpu) !== null),
      storageTrendRows.some((row) => toNullableNumber(row.allocatedStorageGb) !== null || toNullableNumber(row.storageUsedGb) !== null),
      performanceTrendRows.some((row) => toNullableNumber(row.totalIops) !== null || toNullableNumber(row.totalThroughputBytes) !== null),
    ];
    const availableSignalCount = availabilityChecks.filter(Boolean).length;
    const signalCompleteness = Math.round((availableSignalCount / availabilityChecks.length) * 100);
    const readinessNotes: string[] = [];
    if (!availabilityChecks[1]) readinessNotes.push("Load and connection signals are not available from current billing and usage data.");
    if (!availabilityChecks[2]) readinessNotes.push("Storage allocation and usage history are not available from current billing and inventory data.");
    if (!availabilityChecks[3]) readinessNotes.push("Performance throughput and IOPS signals are not available from current billing and usage data.");
    if (recommendationCount === 0) readinessNotes.push("No open database recommendations are currently available for this resource.");
    const inventoryObservedAt = toIsoTimestamp(identity.discoveredAt);
    const hasLiveInventory = identity.hasLiveInventory === true;
    const normalizedIdentityIdentifier = resolveDbIdentifier({
      resourceName: identity.resourceName,
      dbIdentifier: identity.dbIdentifier,
      resourceId: identity.resourceId,
      resourceArn: identity.resourceArn,
      clusterId: identity.clusterId,
      metadata: identity.rawMetadata ?? null,
    });
    const normalizedIdentityEngine = normalizeDbEngine({
      dbEngine: identity.dbEngine,
      dbService: identity.dbService,
      resourceType: identity.resourceType,
      resourceArn: identity.resourceArn,
      metadata: identity.rawMetadata ?? null,
    });

    return {
      identity: {
        resourceId: identity.resourceId,
        resourceArn: identity.resourceArn,
        resourceName: identity.resourceName,
        dbIdentifier: normalizedIdentityIdentifier,
        dbService: identity.dbService,
        dbEngine: normalizedIdentityEngine,
        dbEngineVersion: identity.dbEngineVersion,
        resourceType: identity.resourceType,
        instanceClass: identity.instanceClass,
        capacityMode: identity.capacityMode,
        status: identity.status,
        clusterId: identity.clusterId,
        isClusterResource: Boolean(identity.isClusterResource),
        regionKey: toNullableString(identity.regionKey),
        regionName: identity.regionName,
        subAccountKey: toNullableString(identity.subAccountKey),
        subAccountName: identity.subAccountName,
        cloudConnectionId: identity.cloudConnectionId,
        latestUsageDate: identity.latestUsageDate ? toDateOnly(identity.latestUsageDate) : null,
        discoveredAt: inventoryObservedAt,
        hasLiveInventory,
        inventorySource: computeInventorySource(hasLiveInventory, true),
        inventoryObservedAt,
        inventoryFreshnessMinutes: computeInventoryFreshnessMinutes(inventoryObservedAt),
        endpoint:
          toNullableString(identity.endpoint) ??
          extractStringFromMetadata(identity.rawMetadata ?? null, ["endpointAddress", "endpoint"]),
        endpointPort:
          toNullableNumber(identity.endpointPort) ??
          extractNumberFromMetadata(identity.rawMetadata ?? null, ["endpointPort", "port"]),
        multiAz:
          toNullableBoolean(identity.multiAz) ??
          extractBooleanFromMetadata(identity.rawMetadata ?? null, ["multiAz"]),
        storageEncrypted:
          toNullableBoolean(identity.storageEncrypted) ??
          extractBooleanFromMetadata(identity.rawMetadata ?? null, ["storageEncrypted"]),
        deletionProtection:
          toNullableBoolean(identity.deletionProtection) ??
          extractBooleanFromMetadata(identity.rawMetadata ?? null, ["deletionProtection"]),
        backupRetentionPeriod:
          toNullableNumber(identity.backupRetentionPeriod) ??
          extractNumberFromMetadata(identity.rawMetadata ?? null, ["backupRetentionPeriod"]),
      },
      costSummary: {
        totalCost: toNumber(aggregate?.totalCost),
        totalBilledCost: toNumber(aggregate?.totalBilledCost),
        totalEffectiveCost: toNumber(aggregate?.totalEffectiveCost),
        totalListCost: toNumber(aggregate?.totalListCost),
        currencyCode: aggregate?.currencyCode ?? null,
        dailyAverageCost: toNullableNumber(aggregate?.dailyAverageCost),
        primaryCostDriver: aggregate ? costDriverLabel(aggregate) : null,
      },
      costBreakdown: {
        compute: toNumber(aggregate?.computeCost),
        storage: toNumber(aggregate?.storageCost),
        io: toNumber(aggregate?.ioCost),
        backup: toNumber(aggregate?.backupCost),
        dataTransfer: toNumber(aggregate?.dataTransferCost),
        tax: toNumber(aggregate?.taxCost),
        credit: toNumber(aggregate?.creditAmount),
        refund: toNumber(aggregate?.refundAmount),
        other: Math.max(
          0,
          toNumber(aggregate?.totalCost)
          - toNumber(aggregate?.computeCost)
          - toNumber(aggregate?.storageCost)
          - toNumber(aggregate?.ioCost)
          - toNumber(aggregate?.backupCost)
          - toNumber(aggregate?.dataTransferCost)
          - toNumber(aggregate?.taxCost)
          - toNumber(aggregate?.creditAmount)
          - toNumber(aggregate?.refundAmount),
        ),
      },
      usageSummary: {
        avgCpu: toNullableNumber(aggregate?.avgCpu),
        maxCpu: toNullableNumber(aggregate?.maxCpu),
        avgLoad: toNullableNumber(aggregate?.avgLoad),
        maxLoad: toNullableNumber(aggregate?.maxLoad),
        avgConnections: toNullableNumber(aggregate?.avgConnections),
        maxConnections: toNullableNumber(aggregate?.maxConnections),
        requestCount: toNullableNumber(aggregate?.requestCount),
      },
      storageSummary: {
        allocatedStorageGb: toNullableNumber(aggregate?.allocatedStorageGb),
        storageUsedGb: toNullableNumber(aggregate?.storageUsedGb),
        dataFootprintGb: toNullableNumber(aggregate?.dataFootprintGb),
        storageUtilizationPct,
      },
      performanceSummary: {
        avgIops: toNullableNumber(aggregate?.avgIops),
        maxIops: toNullableNumber(aggregate?.maxIops),
        avgThroughputBytes: toNullableNumber(aggregate?.avgThroughputBytes),
        maxThroughputBytes: toNullableNumber(aggregate?.maxThroughputBytes),
        readIops: toNullableNumber(aggregate?.readIops),
        writeIops: toNullableNumber(aggregate?.writeIops),
        readThroughputBytes: toNullableNumber(aggregate?.readThroughputBytes),
        writeThroughputBytes: toNullableNumber(aggregate?.writeThroughputBytes),
      },
      topology: {
        clusterId: identity.clusterId,
        isClusterResource: Boolean(identity.isClusterResource),
        resourceType: identity.resourceType,
        relatedResourceCount,
      },
      optimizationReadiness: {
        recommendationCount,
        signalCompleteness,
        confidenceLabel: signalCompleteness >= 75 ? "high" : signalCompleteness >= 50 ? "medium" : "low",
        notes: readinessNotes,
      },
      trends: {
        cost: costTrendRows.map((row) => ({
          date: toDateOnly(row.date),
          totalCost: toNumber(row.totalCost),
          compute: toNumber(row.compute),
          storage: toNumber(row.storage),
          io: toNumber(row.io),
          backup: toNumber(row.backup),
          dataTransfer: toNumber(row.dataTransfer),
          tax: toNumber(row.tax),
          credit: toNumber(row.credit),
          refund: toNumber(row.refund),
          other: toNumber(row.other),
        })),
        usage: usageTrendRows.map((row) => ({
          date: toDateOnly(row.date),
          avgCpu: toNullableNumber(row.avgCpu),
          maxCpu: toNullableNumber(row.maxCpu),
          avgLoad: toNullableNumber(row.avgLoad),
          maxLoad: toNullableNumber(row.maxLoad),
          avgConnections: toNullableNumber(row.avgConnections),
          maxConnections: toNullableNumber(row.maxConnections),
          requestCount: toNullableNumber(row.requestCount),
        })),
        storage: storageTrendRows.map((row) => {
          const allocatedStorageGb = toNullableNumber(row.allocatedStorageGb);
          const storageUsedGb = toNullableNumber(row.storageUsedGb);
          return {
            date: toDateOnly(row.date),
            allocatedStorageGb,
            storageUsedGb,
            dataFootprintGb: toNullableNumber(row.dataFootprintGb),
            storageUtilizationPct: toStorageUtilizationPct(storageUsedGb, allocatedStorageGb),
          };
        }),
        performance: performanceTrendRows.map((row) => ({
          date: toDateOnly(row.date),
          readIops: toNullableNumber(row.readIops),
          writeIops: toNullableNumber(row.writeIops),
          totalIops: toNullableNumber(row.totalIops),
          readThroughputBytes: toNullableNumber(row.readThroughputBytes),
          writeThroughputBytes: toNullableNumber(row.writeThroughputBytes),
          totalThroughputBytes: toNullableNumber(row.totalThroughputBytes),
          avgLoad: toNullableNumber(row.avgLoad),
          avgConnections: toNullableNumber(row.avgConnections),
        })),
      },
      metadata: {
        tags: identity.tags ?? null,
        rawMetadata: identity.rawMetadata ?? null,
      },
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
    AND COALESCE(LOWER(BTRIM(f.resource_type)), '') <> 'scoped'
    AND f.resource_id NOT LIKE 'db-scope:%'
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
