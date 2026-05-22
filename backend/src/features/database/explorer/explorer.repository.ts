import { QueryTypes } from "sequelize";

import { BadRequestError } from "../../../errors/http-errors.js";
import { sequelize } from "../../../models/index.js";
import {
  buildExplorerScopeReplacements,
  buildScopeDiscoveryFilters,
  servicesToAvailableDatabaseScopes,
} from "./explorer.database-scope.js";
import type {
  ExplorerCapabilityAvailability,
  ExplorerCoverageSummary,
  ExplorerWarning,
  ExplorerFilterOptions,
  ExplorerGroupBy,
  ExplorerCostBasis,
  ExplorerKpiCard,
  ExplorerKpiState,
  ExplorerQueryParams,
  ExplorerTableRow,
  ExplorerTrendGrouped,
  ExplorerTrendGroupedSeries,
  ExplorerTrendItem,
  ExplorerUsageKpi,
  ExplorerUsageTrendItem,
} from "./explorer.types.js";
import {
  USAGE_CAPABILITY_REGISTRY,
  type UsageCapabilityFamily,
  type UsageMetric,
} from "./usage-capabilities.js";

type CardsAggregateRow = {
  totalCost: string | number | null;
  activeResources: string | number | null;
  dataFootprintGb: string | number | null;
  avgLoad: string | number | null;
  connections: string | number | null;
  previousCost: string | number | null;
  totalRows: string | number | null;
  usageRowsWithLoad: string | number | null;
  usageRowsWithConnections: string | number | null;
  usageRowsWithStorage: string | number | null;
};

type CostTrendRow = {
  date: Date | string;
  compute: string | number | null;
  storage: string | number | null;
  io: string | number | null;
  backup: string | number | null;
  total: string | number | null;
};

type UsageTrendRow = {
  date: Date | string;
  value: string | number | null;
  connections: string | number | null;
};

type CoverageAggregateRow = {
  eligibleResources: string | number | null;
  coveredResources: string | number | null;
};

type TableAggregateRow = {
  group: string | number | null;
  groupKey?: string | number | null;
  groupLabel?: string | null;
  totalCost: string | number | null;
  computeCost: string | number | null;
  storageCost: string | number | null;
  ioCost: string | number | null;
  backupCost: string | number | null;
  resourceCount: string | number | null;
  avgLoad: string | number | null;
  connections: string | number | null;
  inScopeResources?: string | number | null;
  telemetryCoveredResources?: string | number | null;
  avgCpu?: string | number | null;
  peakCpu?: string | number | null;
  avgConnections?: string | number | null;
  peakConnections?: string | number | null;
  readIops?: string | number | null;
  writeIops?: string | number | null;
  totalIops?: string | number | null;
  readThroughputBytes?: string | number | null;
  writeThroughputBytes?: string | number | null;
  totalThroughputBytes?: string | number | null;
  storageUsedGb?: string | number | null;
  allocatedStorageGb?: string | number | null;
  primaryMetricValue?: string | number | null;
};

type GroupedTrendAggregateRow = {
  date: Date | string;
  groupKey: string | number | null;
  groupLabel: string | null;
  value: string | number | null;
};

type CostCategoryGroupedRow = {
  date?: Date | string;
  group?: string | null;
  groupKey: string | null;
  groupLabel: string | null;
  totalCost: string | number | null;
  costSharePct?: string | number | null;
  topService?: string | null;
  topEngine?: string | null;
  computeCost?: string | number | null;
  storageCost?: string | number | null;
  ioCost?: string | number | null;
  backupCost?: string | number | null;
  resourceCount?: string | number | null;
};

type FilterOptionValueRow = {
  value: string | null;
};

type ExplorerCardsQueryParams = ExplorerQueryParams & {
  previousStartDate: string;
  previousEndDate: string;
};

const toNumber = (value: string | number | null | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const COMPACT_NUMBER = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const INTEGER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const CURRENCY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

const formatCurrency = (value: number): string => CURRENCY.format(value);
const formatInteger = (value: number): string => INTEGER.format(value);
const formatCompact = (value: number): string => COMPACT_NUMBER.format(value);
const formatDecimal = (value: number): string => DECIMAL.format(value);
const formatPercent = (value: number): string => `${value >= 0 ? "+" : ""}${formatDecimal(value * 100)}%`;

const resolveCoverageState = (
  totalRows: number,
  rowsWithSignal: number,
): { state: ExplorerKpiState; note: string | null } => {
  if (totalRows <= 0) {
    return { state: "empty", note: "No resources matched the current filters/date window." };
  }
  if (rowsWithSignal <= 0) {
    return { state: "unavailable", note: "CloudWatch/live utilization signal is unavailable for this selection." };
  }
  if (rowsWithSignal < totalRows) {
    return { state: "partial", note: `Signal coverage is partial (${formatInteger(rowsWithSignal)}/${formatInteger(totalRows)} rows).` };
  }
  return { state: "normal", note: null };
};

const confidenceFromCoverage = (
  coverage: ExplorerCoverageSummary,
): ExplorerCoverageSummary["confidence"] => {
  if (coverage.unsupported) return "unsupported";
  if (coverage.unavailable) return "unavailable";
  if (coverage.coverageRate === null) return "degraded";
  if (coverage.coverageRate >= 0.9) return "high";
  if (coverage.coverageRate >= 0.6) return "medium";
  if (coverage.coverageRate > 0) return "low";
  return "degraded";
};

const usageMetricSql = (metric: UsageMetric, alias = "f"): string => {
  const a = `${alias}.`;
  switch (metric) {
    case "avg_cpu": return `${a}cpu_avg`;
    case "peak_cpu": return `${a}cpu_max`;
    case "avg_connections": return `${a}connections_avg`;
    case "peak_connections": return `${a}connections_max`;
    case "read_iops": return `${a}read_iops`;
    case "write_iops": return `${a}write_iops`;
    case "total_iops": return `CASE WHEN ${a}read_iops IS NULL AND ${a}write_iops IS NULL THEN NULL ELSE COALESCE(${a}read_iops, 0) + COALESCE(${a}write_iops, 0) END`;
    case "read_throughput": return `${a}read_throughput_bytes`;
    case "write_throughput": return `${a}write_throughput_bytes`;
    case "total_throughput": return `CASE WHEN ${a}read_throughput_bytes IS NULL AND ${a}write_throughput_bytes IS NULL THEN NULL ELSE COALESCE(${a}read_throughput_bytes, 0) + COALESCE(${a}write_throughput_bytes, 0) END`;
    case "storage_used_gb": return `${a}storage_used_gb`;
    case "allocated_storage_gb": return `${a}allocated_storage_gb`;
  }
};

const usageMetricSqlWithFallback = (metric: UsageMetric, factAlias = "f", utilAlias = "u"): string =>
  `COALESCE(${usageMetricSql(metric, factAlias)}, ${usageMetricSql(metric, utilAlias)})`;

const usageServicePredicateSql = (alias: string): string =>
  `${buildDbServiceDisplaySql(alias)} IN (:usageSupportedServices)`;

const usageMetricSourceFields = (metric: UsageMetric): string[] => {
  switch (metric) {
    case "avg_cpu": return ["cpu_avg"];
    case "peak_cpu": return ["cpu_max"];
    case "avg_connections": return ["connections_avg"];
    case "peak_connections": return ["connections_max"];
    case "read_iops": return ["read_iops"];
    case "write_iops": return ["write_iops"];
    case "total_iops": return ["read_iops", "write_iops"];
    case "read_throughput": return ["read_throughput_bytes"];
    case "write_throughput": return ["write_throughput_bytes"];
    case "total_throughput": return ["read_throughput_bytes", "write_throughput_bytes"];
    case "storage_used_gb": return ["storage_used_gb"];
    case "allocated_storage_gb": return ["allocated_storage_gb"];
  }
};

const usageStateFromCoverage = (coverage: ExplorerCoverageSummary): "normal" | "degraded" | "informational" | "unavailable" | "unsupported" => {
  if (coverage.unsupported) return "unsupported";
  if (coverage.unavailable) return "unavailable";
  if (coverage.degraded) return "degraded";
  return "normal";
};

const isUsageTrendItem = (item: ExplorerTrendItem): item is ExplorerUsageTrendItem =>
  "load" in item && "connections" in item;

const toUtcDateOnly = (value: string, fieldName: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date`);
  }
  return parsed.toISOString().slice(0, 10);
};

const toDateOnly = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
};

const shiftUtcDateByDays = (date: Date, days: number): Date => {
  const shifted = new Date(date.getTime());
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
};

const shiftUtcDateByMonths = (date: Date, months: number): Date => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const targetMonthLastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, targetMonthLastDay)));
};

const getPreviousPeriod = (params: ExplorerQueryParams): { previousStartDate: string; previousEndDate: string } => {
  const startDate = new Date(`${toUtcDateOnly(params.startDate, "start_date")}T00:00:00.000Z`);
  const endDate = new Date(`${toUtcDateOnly(params.endDate, "end_date")}T00:00:00.000Z`);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const durationDays = Math.floor((endDate.getTime() - startDate.getTime()) / millisecondsPerDay) + 1;

  if (durationDays <= 0) {
    throw new BadRequestError("start_date must be less than or equal to end_date");
  }

  const previousStartDate = shiftUtcDateByMonths(startDate, -1);

  return {
    previousStartDate: previousStartDate.toISOString().slice(0, 10),
    previousEndDate: shiftUtcDateByDays(previousStartDate, durationDays - 1).toISOString().slice(0, 10),
  };
};

const buildFactFilters = (
  params: ExplorerCardsQueryParams,
  period: "current" | "previous",
  tableAlias = "",
): string => {
  const pref = tableAlias ? `${tableAlias}.` : "";
  const startDateParam = period === "current" ? "startDate" : "previousStartDate";
  const endDateParam = period === "current" ? "endDate" : "previousEndDate";
  const filters = [
    `${pref}tenant_id = CAST(:tenantId AS uuid)`,
    `${pref}usage_date BETWEEN CAST(:${startDateParam} AS date) AND CAST(:${endDateParam} AS date)`,
  ];

  if (params.cloudConnectionId) {
    filters.push(`${pref}cloud_connection_id = CAST(:cloudConnectionId AS uuid)`);
  }

  if (params.regionKey) {
    filters.push(`${pref}region_key = CAST(:regionKey AS bigint)`);
  }

  if (params.dbService) {
    const alias = pref ? pref.slice(0, -1) : "";
    filters.push(`${alias ? buildDbServiceDisplaySql(alias) : buildDbServiceDisplaySqlUnqualified()} = :dbService`);
  }

  if (params.databaseScope && params.databaseScope !== "all") {
    filters.push(`${pref}db_service IN (:scopeDbServices)`);
  }

  if (params.dbEngine) {
    filters.push(dbEngineFilterSql(`${pref}db_engine`));
  }

  filters.push(`COALESCE(LOWER(BTRIM(${pref}resource_type)), '') <> 'scoped'`);
  filters.push(`${pref}resource_id NOT LIKE 'db-scope:%'`);
  filters.push(`${pref}resource_id NOT LIKE 'db-unattributed:%'`);

  return filters.join("\n    AND ");
};

const buildTrendFilters = (params: ExplorerQueryParams, tableAlias = ""): string => {
  const pref = tableAlias ? `${tableAlias}.` : "";
  const filters = [
    `${pref}tenant_id = CAST(:tenantId AS uuid)`,
    `${pref}usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)`,
  ];

  if (params.cloudConnectionId) {
    filters.push(`${pref}cloud_connection_id = CAST(:cloudConnectionId AS uuid)`);
  }

  if (params.regionKey) {
    filters.push(`${pref}region_key = CAST(:regionKey AS bigint)`);
  }

  if (params.dbService) {
    const alias = pref ? pref.slice(0, -1) : "";
    filters.push(`${alias ? buildDbServiceDisplaySql(alias) : buildDbServiceDisplaySqlUnqualified()} = :dbService`);
  }

  if (params.databaseScope && params.databaseScope !== "all") {
    filters.push(`${pref}db_service IN (:scopeDbServices)`);
  }

  if (params.dbEngine) {
    filters.push(dbEngineFilterSql(`${pref}db_engine`));
  }

  return filters.join("\n    AND ");
};

type GroupedFilterFactContext = {
  tableAlias?: string;
  withInventory?: boolean;
  withRegion?: boolean;
};

const groupedExpressionForFact = (
  groupBy: ExplorerGroupBy,
  context: GroupedFilterFactContext = {},
): string | null => {
  if (groupBy === "cost_category") return null;
  if (groupBy === "db_engine") {
    const baseAlias = context.tableAlias && context.tableAlias.trim().length > 0 ? context.tableAlias.trim() : "f";
    if (context.withInventory) {
      return `COALESCE(NULLIF(NULLIF(LOWER(BTRIM(${baseAlias}.db_engine)), 'unknown'), ''), NULLIF(LOWER(BTRIM(li.db_engine)), ''), 'Unknown engine')`;
    }
    return `COALESCE(NULLIF(NULLIF(LOWER(BTRIM(${baseAlias}.db_engine)), 'unknown'), ''), 'Unknown engine')`;
  }
  if (groupBy === "region") {
    const baseAlias = context.tableAlias && context.tableAlias.trim().length > 0 ? context.tableAlias.trim() : "f";
    if (context.withRegion) {
      return "COALESCE(NULLIF(BTRIM(dr.region_id), ''), NULLIF(BTRIM(dr.region_name), ''), 'Unknown region')";
    }
    return `CASE WHEN ${baseAlias}.region_key IS NULL THEN 'Unknown region' ELSE ${baseAlias}.region_key::text END`;
  }
  const expression = GROUP_BY_COLUMNS[groupBy].selectExpression;
  if (context.tableAlias && context.tableAlias.trim().length > 0 && context.tableAlias.trim() !== "f") {
    return expression.replaceAll("f.", `${context.tableAlias.trim()}.`);
  }
  return expression;
};

const groupedExpressionForCostHistory = (groupBy: ExplorerGroupBy): string | null => {
  if (groupBy !== "cost_category") return null;
  return COST_CATEGORY_LABEL_CASE;
};

const buildGroupedValuesFilter = (
  params: ExplorerQueryParams,
  source: "fact" | "cost_history",
  tableAlias = "",
  factContext: Omit<GroupedFilterFactContext, "tableAlias"> = {},
): string | null => {
  if (!Array.isArray(params.groupValues) || params.groupValues.length === 0) {
    return null;
  }

  const expression = source === "fact"
    ? groupedExpressionForFact(params.groupBy, { tableAlias, ...factContext })
    : groupedExpressionForCostHistory(params.groupBy);
  if (!expression) {
    return null;
  }

  let trimmed = [...new Set(params.groupValues.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0))];
  if (params.groupBy === "resource_type") {
    trimmed = trimmed.filter(
      (value) =>
        value !== "scoped"
        && value !== "unknown resource type"
        && value !== "unknown-resource-type",
    );
  }
  if (params.groupBy === "cost_category") {
    trimmed = trimmed.filter((value) => value !== "other");
  }
  if (trimmed.length === 0) {
    return null;
  }

  params.groupValues = trimmed;

  return `LOWER(BTRIM(${expression})) IN (:groupValues)`;
};

const buildFilterOptionsFilters = (
  params: Pick<
    ExplorerQueryParams,
    "tenantId" | "startDate" | "endDate" | "cloudConnectionId" | "regionKey" | "databaseScope"
  >,
): string => {
  const filters = [
    "tenant_id = CAST(:tenantId AS uuid)",
    "usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)",
  ];

  if (params.cloudConnectionId) {
    filters.push("cloud_connection_id = CAST(:cloudConnectionId AS uuid)");
  }

  if (params.regionKey) {
    filters.push("region_key = CAST(:regionKey AS bigint)");
  }

  if (params.databaseScope && params.databaseScope !== "all") {
    filters.push("db_service IN (:scopeDbServices)");
  }

  return filters.join("\n    AND ");
};

const buildTrendQueryParams = (params: ExplorerQueryParams): ExplorerQueryParams => ({
  ...params,
  startDate: toUtcDateOnly(params.startDate, "start_date"),
  endDate: toUtcDateOnly(params.endDate, "end_date"),
});

const buildExplorerReplacements = <T extends ExplorerQueryParams>(params: T) => buildExplorerScopeReplacements(params);

const latestInventoryCteSql = `
latest_inventory AS (
  SELECT DISTINCT ON (s.tenant_id, s.cloud_connection_id, s.resource_id)
    s.tenant_id,
    s.cloud_connection_id,
    s.resource_id,
    s.db_engine,
    s.instance_class,
    s.cluster_id
  FROM db_resource_inventory_snapshots s
  WHERE s.deleted_at IS NULL
  ORDER BY
    s.tenant_id,
    s.cloud_connection_id,
    s.resource_id,
    s.is_current DESC,
    s.discovered_at DESC NULLS LAST,
    s.updated_at DESC NULLS LAST
)
`;

const fromFactBaseSql = (options: { withInventory: boolean; withRegion: boolean }): string => `
FROM fact_db_resource_daily f
${options.withRegion ? "LEFT JOIN dim_region dr ON dr.id = f.region_key" : ""}
${options.withInventory ? `LEFT JOIN latest_inventory li
  ON li.tenant_id = f.tenant_id
 AND li.resource_id = f.resource_id
 AND li.cloud_connection_id IS NOT DISTINCT FROM f.cloud_connection_id` : ""}
`;

const buildDbServiceDisplaySql = (tableAlias: string): string => `
CASE
  WHEN LOWER(COALESCE(${tableAlias}.db_engine, '')) LIKE 'aurora%' THEN 'Amazon Aurora'
  WHEN LOWER(COALESCE(${tableAlias}.db_service, '')) IN ('amazonrds', 'amazon rds', 'amazonrelationaldatabaseservice') THEN 'Amazon RDS'
  WHEN LOWER(COALESCE(${tableAlias}.db_service, '')) IN ('amazonelasticache', 'amazon elasticache', 'elasticache') THEN 'Amazon ElastiCache'
  WHEN LOWER(COALESCE(${tableAlias}.db_service, '')) IN ('amazonmemorydb', 'amazon memorydb', 'memorydb') THEN 'Amazon MemoryDB'
  WHEN LOWER(COALESCE(${tableAlias}.db_service, '')) IN ('amazondynamodb', 'amazon dynamodb', 'dynamodb') THEN 'Amazon DynamoDB'
  WHEN LOWER(COALESCE(${tableAlias}.db_service, '')) IN ('amazondocdb', 'amazon docdb', 'amazon documentdb', 'documentdb') THEN 'Amazon DocumentDB'
  WHEN LOWER(COALESCE(${tableAlias}.db_service, '')) IN ('amazonneptune', 'amazon neptune', 'neptune') THEN 'Amazon Neptune'
  WHEN LOWER(COALESCE(${tableAlias}.db_service, '')) IN ('amazonkeyspaces', 'amazon keyspaces', 'keyspaces') THEN 'Amazon Keyspaces'
  WHEN LOWER(COALESCE(${tableAlias}.db_service, '')) IN ('amazontimestream', 'amazon timestream', 'timestream') THEN 'Amazon Timestream'
  ELSE 'Unknown service'
END
`;

const buildDbServiceDisplaySqlUnqualified = (): string => `
CASE
  WHEN LOWER(COALESCE(db_engine, '')) LIKE 'aurora%' THEN 'Amazon Aurora'
  WHEN LOWER(COALESCE(db_service, '')) IN ('amazonrds', 'amazon rds', 'amazonrelationaldatabaseservice') THEN 'Amazon RDS'
  WHEN LOWER(COALESCE(db_service, '')) IN ('amazonelasticache', 'amazon elasticache', 'elasticache') THEN 'Amazon ElastiCache'
  WHEN LOWER(COALESCE(db_service, '')) IN ('amazonmemorydb', 'amazon memorydb', 'memorydb') THEN 'Amazon MemoryDB'
  WHEN LOWER(COALESCE(db_service, '')) IN ('amazondynamodb', 'amazon dynamodb', 'dynamodb') THEN 'Amazon DynamoDB'
  WHEN LOWER(COALESCE(db_service, '')) IN ('amazondocdb', 'amazon docdb', 'amazon documentdb', 'documentdb') THEN 'Amazon DocumentDB'
  WHEN LOWER(COALESCE(db_service, '')) IN ('amazonneptune', 'amazon neptune', 'neptune') THEN 'Amazon Neptune'
  WHEN LOWER(COALESCE(db_service, '')) IN ('amazonkeyspaces', 'amazon keyspaces', 'keyspaces') THEN 'Amazon Keyspaces'
  WHEN LOWER(COALESCE(db_service, '')) IN ('amazontimestream', 'amazon timestream', 'timestream') THEN 'Amazon Timestream'
  ELSE 'Unknown service'
END
`;

const normalizedEngineTokenSql = (expression: string): string => `
REGEXP_REPLACE(
  LOWER(BTRIM(COALESCE(${expression}, ''))),
  '[^a-z0-9]+',
  '',
  'g'
)
`;

const dbEngineFilterSql = (expression: string): string => `
(
  LOWER(BTRIM(COALESCE(${expression}, ''))) = LOWER(BTRIM(:dbEngine))
  OR ${normalizedEngineTokenSql(expression)} = REGEXP_REPLACE(LOWER(BTRIM(:dbEngine)), '[^a-z0-9]+', '', 'g')
)
`;

const buildDbServiceDisplayKeySql = (tableAlias: string): string => `
COALESCE(
  NULLIF(LOWER(REGEXP_REPLACE((${buildDbServiceDisplaySql(tableAlias)}), '[^a-z0-9]+', '-', 'g')), ''),
  'unknown-service'
)
`;

const DB_TYPE_SERVICE_SOURCE_SQL = `
COALESCE(
  NULLIF(BTRIM(f.db_service), ''),
  CASE
    WHEN LOWER(COALESCE(f.resource_arn, '')) LIKE 'arn:aws:rds:%' THEN 'AmazonRDS'
    WHEN LOWER(COALESCE(f.resource_arn, '')) LIKE 'arn:aws:dynamodb:%' THEN 'AmazonDynamoDB'
    WHEN LOWER(COALESCE(f.resource_arn, '')) LIKE 'arn:aws:elasticache:%' THEN 'AmazonElastiCache'
    WHEN LOWER(COALESCE(f.resource_arn, '')) LIKE 'arn:aws:memorydb:%' THEN 'AmazonMemoryDB'
    WHEN LOWER(COALESCE(f.resource_arn, '')) LIKE 'arn:aws:docdb:%' THEN 'AmazonDocDB'
    WHEN LOWER(COALESCE(f.resource_arn, '')) LIKE 'arn:aws:neptune:%' THEN 'AmazonNeptune'
    WHEN LOWER(COALESCE(f.resource_arn, '')) LIKE 'arn:aws:cassandra:%' THEN 'AmazonKeyspaces'
    WHEN LOWER(COALESCE(f.resource_arn, '')) LIKE 'arn:aws:timestream:%' THEN 'AmazonTimestream'
    WHEN LOWER(COALESCE(f.resource_id, '')) LIKE 'db-scope:amazonrds%' THEN 'AmazonRDS'
    WHEN LOWER(COALESCE(f.resource_id, '')) LIKE 'db-scope:amazondynamodb%' THEN 'AmazonDynamoDB'
    WHEN LOWER(COALESCE(f.resource_id, '')) LIKE 'db-scope:amazonelasticache%' THEN 'AmazonElastiCache'
    WHEN LOWER(COALESCE(f.resource_id, '')) LIKE 'db-scope:amazonmemorydb%' THEN 'AmazonMemoryDB'
    WHEN LOWER(COALESCE(f.resource_id, '')) LIKE 'db-scope:amazondocdb%' THEN 'AmazonDocDB'
    WHEN LOWER(COALESCE(f.resource_id, '')) LIKE 'db-scope:amazonneptune%' THEN 'AmazonNeptune'
    WHEN LOWER(COALESCE(f.resource_id, '')) LIKE 'db-scope:amazonkeyspaces%' THEN 'AmazonKeyspaces'
    WHEN LOWER(COALESCE(f.resource_id, '')) LIKE 'db-scope:amazontimestream%' THEN 'AmazonTimestream'
    ELSE NULL
  END
)
`;

const DB_TYPE_SERVICE_TOKEN_SQL = `
REGEXP_REPLACE(
  LOWER(${DB_TYPE_SERVICE_SOURCE_SQL}),
  '[^a-z0-9]',
  '',
  'g'
)
`;

const DB_TYPE_FAMILY_TOKEN_SQL = `
CASE
  WHEN ${DB_TYPE_SERVICE_TOKEN_SQL} IN (
    'amazonrds',
    'amazonrdsservice',
    'rds',
    'amazonrelationaldatabaseservice',
    'aurora',
    'amazonaurora',
    'aurorapostgresql',
    'auroramysql'
  )
    OR LOWER(COALESCE(f.db_engine, '')) LIKE 'aurora%'
    THEN 'relational'
  WHEN ${DB_TYPE_SERVICE_TOKEN_SQL} IN ('amazondynamodb', 'dynamodb') THEN 'keyvalue'
  WHEN ${DB_TYPE_SERVICE_TOKEN_SQL} IN ('amazonelasticache', 'elasticache', 'amazonmemorydb', 'memorydb') THEN 'inmemory'
  WHEN ${DB_TYPE_SERVICE_TOKEN_SQL} IN ('amazondocdb', 'docdb', 'amazondocumentdb', 'documentdb') THEN 'document'
  WHEN ${DB_TYPE_SERVICE_TOKEN_SQL} IN ('amazonneptune', 'neptune') THEN 'graph'
  WHEN ${DB_TYPE_SERVICE_TOKEN_SQL} IN ('amazonkeyspaces', 'keyspaces') THEN 'widecolumn'
  WHEN ${DB_TYPE_SERVICE_TOKEN_SQL} IN ('amazontimestream', 'timestream') THEN 'timeseries'
  ELSE 'unknown'
END
`;

const DB_TYPE_CLASSIFICATION_CASE = `
CASE
  WHEN ${DB_TYPE_FAMILY_TOKEN_SQL} = 'relational' THEN 'Relational'
  WHEN ${DB_TYPE_FAMILY_TOKEN_SQL} = 'keyvalue' THEN 'Key-Value'
  WHEN ${DB_TYPE_FAMILY_TOKEN_SQL} = 'inmemory' THEN 'In-Memory'
  WHEN ${DB_TYPE_FAMILY_TOKEN_SQL} = 'document' THEN 'Document'
  WHEN ${DB_TYPE_FAMILY_TOKEN_SQL} = 'graph' THEN 'Graph'
  WHEN ${DB_TYPE_FAMILY_TOKEN_SQL} = 'widecolumn' THEN 'Wide Column'
  WHEN ${DB_TYPE_FAMILY_TOKEN_SQL} = 'timeseries' THEN 'Time Series'
  ELSE 'Unknown database type'
END
`;

const resourceTypeCanonicalExpression = (tableAlias = "f"): string => `
CASE
  WHEN LOWER(COALESCE(${tableAlias}.resource_id, '')) LIKE 'db-scope:%' THEN 'unknown resource type'
  WHEN LOWER(COALESCE(${tableAlias}.resource_id, '')) LIKE 'arn:aws:rds:%:db:%' THEN 'instance'
  WHEN LOWER(COALESCE(${tableAlias}.resource_id, '')) LIKE 'arn:aws:rds:%:cluster:%' THEN 'cluster'
  WHEN LOWER(COALESCE(${tableAlias}.resource_id, '')) LIKE 'arn:aws:elasticache:%' THEN 'cache'
  ELSE COALESCE(NULLIF(LOWER(BTRIM(${tableAlias}.resource_type)), ''), 'unknown resource type')
END
`;

const GROUP_BY_COLUMNS = {
  db_service: {
    selectExpression: buildDbServiceDisplaySql("f"),
    groupExpression: buildDbServiceDisplaySql("f"),
    keyExpression: buildDbServiceDisplayKeySql("f"),
    requiresInventory: false,
    requiresRegion: false,
  },
  db_engine: {
    selectExpression:
      "COALESCE(NULLIF(NULLIF(LOWER(BTRIM(f.db_engine)), 'unknown'), ''), NULLIF(LOWER(BTRIM(li.db_engine)), ''), 'Unknown engine')",
    groupExpression:
      "COALESCE(NULLIF(NULLIF(LOWER(BTRIM(f.db_engine)), 'unknown'), ''), NULLIF(LOWER(BTRIM(li.db_engine)), ''), 'Unknown engine')",
    keyExpression:
      "COALESCE(NULLIF(NULLIF(LOWER(BTRIM(f.db_engine)), 'unknown'), ''), NULLIF(LOWER(BTRIM(li.db_engine)), ''), 'unknown-engine')",
    requiresInventory: true,
    requiresRegion: false,
  },
  region: {
    selectExpression: "COALESCE(NULLIF(BTRIM(dr.region_id), ''), NULLIF(BTRIM(dr.region_name), ''), 'Unknown region')",
    groupExpression: "COALESCE(NULLIF(BTRIM(dr.region_id), ''), NULLIF(BTRIM(dr.region_name), ''), 'Unknown region')",
    keyExpression: "COALESCE(NULLIF(BTRIM(dr.region_id), ''), NULLIF(BTRIM(dr.region_name), ''), 'unknown-region')",
    requiresInventory: false,
    requiresRegion: true,
  },
  resource_type: {
    selectExpression: resourceTypeCanonicalExpression("f"),
    groupExpression: resourceTypeCanonicalExpression("f"),
    keyExpression: "COALESCE(NULLIF(BTRIM(LOWER(REGEXP_REPLACE((" + resourceTypeCanonicalExpression("f") + "), '[^a-z0-9]+', '-', 'g'))), ''), 'unknown-resource-type')",
    requiresInventory: false,
    requiresRegion: false,
  },
  instance_class: {
    selectExpression: "COALESCE(NULLIF(BTRIM(li.instance_class), ''), 'Unknown class')",
    groupExpression: "COALESCE(NULLIF(BTRIM(li.instance_class), ''), 'Unknown class')",
    keyExpression: "COALESCE(NULLIF(BTRIM(li.instance_class), ''), 'unknown-class')",
    requiresInventory: true,
    requiresRegion: false,
  },
  cluster: {
    selectExpression: "COALESCE(NULLIF(BTRIM(f.cluster_id), ''), NULLIF(BTRIM(li.cluster_id), ''), 'Standalone / No cluster')",
    groupExpression: "COALESCE(NULLIF(BTRIM(f.cluster_id), ''), NULLIF(BTRIM(li.cluster_id), ''), 'Standalone / No cluster')",
    keyExpression: "COALESCE(NULLIF(BTRIM(f.cluster_id), ''), NULLIF(BTRIM(li.cluster_id), ''), 'standalone-no-cluster')",
    requiresInventory: true,
    requiresRegion: false,
  },
} as const;

const GROUPED_UNKNOWN_LABELS: Record<ExplorerGroupBy, string> = {
  db_service: "Unknown service",
  db_engine: "Unknown engine",
  region: "Unknown region",
  resource_type: "Unknown resource type",
  instance_class: "Unknown class",
  cluster: "Standalone / No cluster",
  cost_category: "Other",
};

const isUnknownInstanceClassGroup = (groupBy: ExplorerGroupBy, key: string, label: string): boolean => {
  if (groupBy !== "instance_class") return false;
  const normalizedKey = key.trim().toLowerCase();
  const normalizedLabel = label.trim().toLowerCase();
  return normalizedKey === "unknown-class" || normalizedLabel === "unknown class";
};

const isUnknownDbEngineGroup = (groupBy: ExplorerGroupBy, key: string, label: string): boolean => {
  if (groupBy !== "db_engine") return false;
  const normalizedKey = key.trim().toLowerCase();
  const normalizedLabel = label.trim().toLowerCase();
  return normalizedKey === "unknown-engine" || normalizedLabel === "unknown engine";
};

const COST_CATEGORY_CANONICAL_KEY_SQL = "REGEXP_REPLACE(LOWER(BTRIM(COALESCE(ch.cost_category, ''))), '[^a-z0-9]+', '_', 'g')";

const COST_CATEGORY_LABEL_CASE = `
CASE
  WHEN ${COST_CATEGORY_CANONICAL_KEY_SQL} = 'compute' OR ${COST_CATEGORY_CANONICAL_KEY_SQL} LIKE 'compute_%' THEN 'Compute'
  WHEN ${COST_CATEGORY_CANONICAL_KEY_SQL} = 'storage' OR ${COST_CATEGORY_CANONICAL_KEY_SQL} LIKE 'storage_%' THEN 'Storage'
  WHEN ${COST_CATEGORY_CANONICAL_KEY_SQL} IN ('io', 'i_o') OR ${COST_CATEGORY_CANONICAL_KEY_SQL} LIKE 'io_%' OR ${COST_CATEGORY_CANONICAL_KEY_SQL} LIKE 'i_o_%' THEN 'I/O'
  WHEN ${COST_CATEGORY_CANONICAL_KEY_SQL} = 'backup' OR ${COST_CATEGORY_CANONICAL_KEY_SQL} LIKE 'backup_%' THEN 'Backup'
  WHEN ${COST_CATEGORY_CANONICAL_KEY_SQL} = 'data_transfer' OR ${COST_CATEGORY_CANONICAL_KEY_SQL} LIKE 'data_transfer_%' THEN 'Data Transfer'
  WHEN ${COST_CATEGORY_CANONICAL_KEY_SQL} = 'tax' OR ${COST_CATEGORY_CANONICAL_KEY_SQL} LIKE 'tax_%' THEN 'Tax'
  WHEN ${COST_CATEGORY_CANONICAL_KEY_SQL} = 'credit' OR ${COST_CATEGORY_CANONICAL_KEY_SQL} LIKE 'credit_%' THEN 'Credit'
  WHEN ${COST_CATEGORY_CANONICAL_KEY_SQL} = 'refund' OR ${COST_CATEGORY_CANONICAL_KEY_SQL} LIKE 'refund_%' THEN 'Refund'
  ELSE 'Other'
END
`;

const OPERATIONAL_COST_CATEGORIES = ["compute", "storage", "io", "backup", "data_transfer"] as const;
const normalizeFilterValues = (values?: string[]): string[] => {
  if (!Array.isArray(values) || values.length === 0) return [];
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0))];
};

const costHistoryBaseExpression = (tableAlias: string, costBasis: ExplorerCostBasis): string => {
  const pref = tableAlias ? `${tableAlias}.` : "";
  if (costBasis === "billed_cost") return `COALESCE(${pref}billed_cost, 0)`;
  if (costBasis === "effective_cost") return `COALESCE(${pref}effective_cost, ${pref}billed_cost, 0)`;
  if (costBasis === "amortized_cost") return `COALESCE(${pref}list_cost, ${pref}effective_cost, ${pref}billed_cost, 0)`;
  if (costBasis === "net_amortized_cost") {
    return `COALESCE(${pref}list_cost, ${pref}effective_cost, ${pref}billed_cost, 0)`;
  }
  return `COALESCE(${pref}effective_cost, ${pref}billed_cost, 0)`;
};

const factTotalCostExpression = (tableAlias: string, costBasis: ExplorerCostBasis): string => {
  const pref = tableAlias ? `${tableAlias}.` : "";
  if (costBasis === "billed_cost") return `COALESCE(${pref}total_billed_cost, 0)`;
  if (costBasis === "effective_cost") return `COALESCE(${pref}total_effective_cost, ${pref}total_billed_cost, 0)`;
  if (costBasis === "amortized_cost") return `COALESCE(${pref}total_list_cost, ${pref}total_effective_cost, ${pref}total_billed_cost, 0)`;
  if (costBasis === "net_amortized_cost") {
    return `COALESCE(${pref}total_list_cost, ${pref}total_effective_cost, ${pref}total_billed_cost, 0)`;
  }
  return `COALESCE(${pref}total_effective_cost, ${pref}total_billed_cost, 0)`;
};

const buildResourceDrilldownFilters = (params: ExplorerQueryParams, tableAlias = ""): string => {
  const pref = tableAlias ? `${tableAlias}.` : "";
  const resourceTypeValues = normalizeFilterValues(params.resourceTypeValues);
  const shouldExcludeScopedByDefault = params.groupBy === "resource_type" ? true : !resourceTypeValues.includes("scoped");
  const base = `${buildTrendFilters(params, tableAlias)}
    ${shouldExcludeScopedByDefault ? `AND COALESCE(LOWER(BTRIM(${pref}resource_type)), '') <> 'scoped'` : ""}
    ${shouldExcludeScopedByDefault ? `AND ${pref}resource_id NOT LIKE 'db-scope:%'` : ""}`;
  const groupedValuesFilter = buildGroupedValuesFilter(params, "fact", tableAlias || "f");
  const resourceTypeFilter = resourceTypeValues.length > 0
    ? `LOWER(BTRIM((${resourceTypeCanonicalExpression(tableAlias || "f")}))) IN (:resourceTypeValues)`
    : null;
  const excludeUnknownWhenGroupingResourceType =
    params.groupBy === "resource_type"
      ? `${resourceTypeCanonicalExpression(tableAlias || "f")} <> 'unknown resource type'`
      : null;
  const parts = [base];
  if (groupedValuesFilter) parts.push(groupedValuesFilter);
  if (resourceTypeFilter) {
    params.resourceTypeValues = resourceTypeValues;
    parts.push(resourceTypeFilter);
  }
  if (excludeUnknownWhenGroupingResourceType) parts.push(excludeUnknownWhenGroupingResourceType);
  return `${parts[0]}${parts.slice(1).map((part) => `\n    AND ${part}`).join("")}`;
};

const buildCostHistoryDrilldownFilters = (params: ExplorerQueryParams, tableAlias = ""): string => {
  const pref = tableAlias ? `${tableAlias}.` : "";
  const resourceTypeValues = normalizeFilterValues(params.resourceTypeValues);
  const shouldExcludeScopedByDefault = params.groupBy === "resource_type" ? true : !resourceTypeValues.includes("scoped");
  const base = `${buildTrendFilters(params, tableAlias)}
    ${shouldExcludeScopedByDefault ? `AND ${pref}resource_id NOT LIKE 'db-scope:%'` : ""}
    AND ${pref}resource_id NOT LIKE 'db-unattributed:%'`;
  const groupedValuesFilter = buildGroupedValuesFilter(params, "cost_history", tableAlias);
  const resourceTypeFilter = resourceTypeValues.length > 0
    ? `EXISTS (
      SELECT 1
      FROM fact_db_resource_daily f_rt
      WHERE f_rt.tenant_id = ${pref}tenant_id
        AND f_rt.usage_date = ${pref}usage_date
        AND f_rt.resource_id = ${pref}resource_id
        AND f_rt.cloud_connection_id IS NOT DISTINCT FROM ${pref}cloud_connection_id
        AND LOWER(BTRIM((${resourceTypeCanonicalExpression("f_rt")}))) IN (:resourceTypeValues)
    )`
    : null;
  const costCategoryValues = normalizeFilterValues(params.costCategoryValues);
  const costCategoryFilter = costCategoryValues.length > 0
    ? `LOWER(BTRIM(COALESCE(${pref}cost_category, ''))) IN (:costCategoryValues)`
    : null;
  const parts = [base];
  if (groupedValuesFilter) parts.push(groupedValuesFilter);
  if (resourceTypeFilter) {
    params.resourceTypeValues = resourceTypeValues;
    parts.push(resourceTypeFilter);
  }
  if (costCategoryFilter) {
    params.costCategoryValues = costCategoryValues;
    parts.push(costCategoryFilter);
  }
  return `${parts[0]}${parts.slice(1).map((part) => `\n    AND ${part}`).join("")}`;
};

export class DatabaseExplorerRepository {
  private utilizationTableExistsPromise: Promise<boolean> | null = null;

  private async hasDbUtilizationDailyTable(): Promise<boolean> {
    if (!this.utilizationTableExistsPromise) {
      this.utilizationTableExistsPromise = sequelize
        .query<{ exists: boolean }>(
          `
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'db_utilization_daily'
) AS "exists";
`,
          { type: QueryTypes.SELECT },
        )
        .then((rows) => Boolean(rows[0]?.exists))
        .catch(() => false);
    }

    return this.utilizationTableExistsPromise;
  }

  async getFilterOptions(params: ExplorerQueryParams): Promise<ExplorerFilterOptions> {
    const queryParams = buildExplorerReplacements(buildTrendQueryParams(params));
    // Keep explorer payload (cards/trend/table) scoped by group_values, but do not
    // let filter-option universes collapse to currently selected values.
    const filterPreviewParams = buildExplorerReplacements(
      buildTrendQueryParams({
        ...params,
        groupValues: undefined,
      }),
    );
    const filters = buildFilterOptionsFilters(filterPreviewParams);
    const costCategoryPreviewParams = buildExplorerReplacements(
      buildTrendQueryParams({
        ...params,
        groupValues: undefined,
        costCategoryValues: undefined,
      }),
    );

    const discoveryParams = buildExplorerReplacements(
      buildTrendQueryParams({
        ...params,
        databaseScope: "all",
      }),
    );
    const discoveryFilters = buildScopeDiscoveryFilters(discoveryParams);
    const databaseSelectorParams = buildExplorerReplacements(
      buildTrendQueryParams({
        ...params,
        databaseScope: "all",
        dbService: undefined,
        dbEngine: undefined,
      }),
    );
    const databaseSelectorFilters = buildScopeDiscoveryFilters(databaseSelectorParams);

    const [discoveryServiceRows, serviceRows, engineRows, regionRows, resourceTypeRows, instanceClassRows, clusterRows, costCategoryRows, dbServicePreviewRows] = await Promise.all([
      sequelize.query<FilterOptionValueRow>(
        `
SELECT DISTINCT ${buildDbServiceDisplaySql("f")} AS value
FROM fact_db_resource_daily f
WHERE ${discoveryFilters}
  AND ${buildDbServiceDisplaySql("f")} <> 'Unknown service'
ORDER BY value ASC;
`,
        {
          replacements: discoveryParams,
          type: QueryTypes.SELECT,
        },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
SELECT DISTINCT ${buildDbServiceDisplaySql("f")} AS value
FROM fact_db_resource_daily f
WHERE ${databaseSelectorFilters}
  AND ${buildDbServiceDisplaySql("f")} <> 'Unknown service'
ORDER BY value ASC;
`,
        {
          replacements: databaseSelectorParams,
          type: QueryTypes.SELECT,
        },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
WITH ${latestInventoryCteSql}
SELECT DISTINCT
  COALESCE(
    NULLIF(NULLIF(LOWER(BTRIM(f.db_engine)), 'unknown'), ''),
    NULLIF(LOWER(BTRIM(li.db_engine)), '')
  ) AS value
${fromFactBaseSql({ withInventory: true, withRegion: false })}
WHERE ${buildTrendFilters(databaseSelectorParams, "f")}
  AND COALESCE(
    NULLIF(NULLIF(LOWER(BTRIM(f.db_engine)), 'unknown'), ''),
    NULLIF(LOWER(BTRIM(li.db_engine)), '')
  ) IS NOT NULL
ORDER BY value ASC;
`,
        {
          replacements: databaseSelectorParams,
          type: QueryTypes.SELECT,
        },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
SELECT DISTINCT
  COALESCE(NULLIF(BTRIM(dr.region_id), ''), NULLIF(BTRIM(dr.region_name), ''), 'Unknown region') AS value
FROM fact_db_resource_daily f
LEFT JOIN dim_region dr ON dr.id = f.region_key
WHERE ${buildTrendFilters(filterPreviewParams, "f")}
  AND COALESCE(NULLIF(BTRIM(dr.region_id), ''), NULLIF(BTRIM(dr.region_name), ''), 'Unknown region') <> 'Unknown region'
ORDER BY value ASC;
`,
        { replacements: filterPreviewParams, type: QueryTypes.SELECT },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
SELECT DISTINCT ${resourceTypeCanonicalExpression("f")} AS value
FROM fact_db_resource_daily f
WHERE ${buildTrendFilters(filterPreviewParams, "f")}
  AND LOWER(COALESCE(f.resource_id, '')) NOT LIKE 'db-scope:%'
  AND ${resourceTypeCanonicalExpression("f")} <> 'scoped'
  AND ${resourceTypeCanonicalExpression("f")} <> 'unknown resource type'
ORDER BY value ASC;
`,
        { replacements: filterPreviewParams, type: QueryTypes.SELECT },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
WITH ${latestInventoryCteSql}
SELECT DISTINCT COALESCE(NULLIF(BTRIM(li.instance_class), ''), 'Unknown class') AS value
${fromFactBaseSql({ withInventory: true, withRegion: false })}
WHERE ${buildResourceDrilldownFilters(filterPreviewParams, "f")}
ORDER BY value ASC;
`,
        { replacements: filterPreviewParams, type: QueryTypes.SELECT },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
WITH ${latestInventoryCteSql}
SELECT DISTINCT COALESCE(NULLIF(BTRIM(f.cluster_id), ''), NULLIF(BTRIM(li.cluster_id), ''), 'Standalone / No cluster') AS value
${fromFactBaseSql({ withInventory: true, withRegion: false })}
WHERE ${buildResourceDrilldownFilters(filterPreviewParams, "f")}
ORDER BY value ASC;
`,
        { replacements: filterPreviewParams, type: QueryTypes.SELECT },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
SELECT DISTINCT ${COST_CATEGORY_LABEL_CASE} AS value
FROM db_cost_history_daily ch
WHERE ${buildCostHistoryDrilldownFilters(costCategoryPreviewParams, "ch")}
  AND LOWER(BTRIM(COALESCE(ch.cost_category, ''))) <> 'other'
ORDER BY value ASC;
`,
        { replacements: costCategoryPreviewParams, type: QueryTypes.SELECT },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
SELECT DISTINCT
  ${buildDbServiceDisplaySql("f")} AS value
FROM fact_db_resource_daily f
WHERE ${databaseSelectorFilters}
  AND ${buildDbServiceDisplaySql("f")} <> 'Unknown service'
ORDER BY value ASC;
`,
        { replacements: databaseSelectorParams, type: QueryTypes.SELECT },
      ),
    ]);

    const discoveryServices = discoveryServiceRows
      .map((row) => (typeof row.value === "string" ? row.value.trim() : ""))
      .filter((value) => value.length > 0);

    return {
      dbServices: serviceRows
        .map((row) => (typeof row.value === "string" ? row.value.trim() : ""))
        .filter((value) => value.length > 0),
      dbEngines: engineRows
        .map((row) => (typeof row.value === "string" ? row.value.trim() : ""))
        .filter((value) => value.length > 0),
      groupedValuePreview: {
        db_service: dbServicePreviewRows.map((row) => (typeof row.value === "string" ? row.value.trim() : "")).filter((value) => value.length > 0),
        db_engine: engineRows.map((row) => (typeof row.value === "string" ? row.value.trim() : "")).filter((value) => value.length > 0),
        region: regionRows.map((row) => (typeof row.value === "string" ? row.value.trim() : "")).filter((value) => value.length > 0),
        resource_type: resourceTypeRows.map((row) => (typeof row.value === "string" ? row.value.trim() : "")).filter((value) => value.length > 0),
        instance_class: instanceClassRows
          .map((row) => (typeof row.value === "string" ? row.value.trim() : ""))
          .filter((value) => value.length > 0 && value.toLowerCase() !== "unknown class"),
        cluster: clusterRows.map((row) => (typeof row.value === "string" ? row.value.trim() : "")).filter((value) => value.length > 0),
        cost_category: costCategoryRows.map((row) => (typeof row.value === "string" ? row.value.trim() : "")).filter((value) => value.length > 0),
      },
      availableDatabaseScopes: servicesToAvailableDatabaseScopes(discoveryServices),
    };
  }

  private async computeUsageCoverageSummary(
    params: ExplorerQueryParams,
    capabilityFamily: UsageCapabilityFamily,
    usageMetric: UsageMetric,
  ): Promise<ExplorerCoverageSummary> {
    const queryParams = buildExplorerReplacements(buildTrendQueryParams(params));
    const definition = USAGE_CAPABILITY_REGISTRY[capabilityFamily];
    const metricExpr = usageMetricSql(usageMetric, "f");
    const baseFilters = buildResourceDrilldownFilters(queryParams, "f");
    const rows = await sequelize.query<CoverageAggregateRow>(
      `
SELECT
  COUNT(DISTINCT f.resource_id) FILTER (WHERE f.db_service IN (:supportedServices)) AS "eligibleResources",
  COUNT(DISTINCT f.resource_id) FILTER (WHERE f.db_service IN (:supportedServices) AND (${metricExpr}) IS NOT NULL) AS "coveredResources"
FROM fact_db_resource_daily f
WHERE ${baseFilters};
`,
      {
        replacements: { ...queryParams, supportedServices: definition.supportedServices },
        type: QueryTypes.SELECT,
      },
    );
    const row = rows[0];
    const eligibleResources = toNumber(row?.eligibleResources);
    const coveredResources = toNumber(row?.coveredResources);
    const coverageRate = eligibleResources > 0 ? coveredResources / eligibleResources : null;
    const unsupported = eligibleResources <= 0;
    const unavailable = eligibleResources > 0 && coveredResources <= 0;
    const degraded = coverageRate !== null && coverageRate > 0 && coverageRate < 0.9;
    const summary: ExplorerCoverageSummary = {
      eligibleResources,
      coveredResources,
      coverageRate,
      confidence: "degraded",
      degraded,
      unavailable,
      unsupported,
    };
    summary.confidence = confidenceFromCoverage(summary);
    return summary;
  }

  async getCapabilityAvailability(params: ExplorerQueryParams): Promise<ExplorerCapabilityAvailability[]> {
    if (params.metric !== "usage") return [];
    const families = Object.values(USAGE_CAPABILITY_REGISTRY);
    const output: ExplorerCapabilityAvailability[] = [];
    for (const family of families) {
      const coverageSummary = await this.computeUsageCoverageSummary(params, family.id, family.defaultMetric);
      const selectable = !coverageSummary.unsupported;
      output.push({
        capabilityFamily: family.id,
        label: family.label,
        maturity: family.maturity,
        supportedServices: [...family.supportedServices],
        supportedMetrics: [...family.supportedMetrics],
        selectable,
        disabled: !selectable,
        warnings: coverageSummary.unsupported ? ["No supported services in scope for this capability family."] : [],
        coverageSummary,
      });
    }
    return output;
  }

  async getCards(params: ExplorerQueryParams): Promise<ExplorerKpiCard[]> {
    const previousPeriod = getPreviousPeriod(params);
    const queryParams = buildExplorerReplacements({
      ...params,
      startDate: toUtcDateOnly(params.startDate, "start_date"),
      endDate: toUtcDateOnly(params.endDate, "end_date"),
      ...previousPeriod,
    });
    const currentFilters = buildFactFilters(queryParams, "current", "f");
    const previousFilters = buildFactFilters(queryParams, "previous", "f");
    const selectedUsageMetric: UsageMetric = params.usageMetric ?? "avg_cpu";
    const selectedUsageExpr = usageMetricSql(selectedUsageMetric);

    const rows = await sequelize.query<CardsAggregateRow>(
      `
WITH current_period AS (
  SELECT
    COALESCE(SUM(${factTotalCostExpression("", queryParams.costBasis)}), 0) AS "totalCost",
    COUNT(DISTINCT resource_id) AS "activeResources",
    COALESCE(SUM(data_footprint_gb), 0) AS "dataFootprintGb",
    AVG(${selectedUsageExpr}) AS "avgLoad",
    AVG(connections_avg) AS "connections",
    COUNT(*) AS "totalRows",
    COUNT(*) FILTER (WHERE ${selectedUsageExpr} IS NOT NULL) AS "usageRowsWithLoad",
    COUNT(*) FILTER (WHERE connections_avg IS NOT NULL) AS "usageRowsWithConnections",
    COUNT(*) FILTER (WHERE data_footprint_gb IS NOT NULL) AS "usageRowsWithStorage"
  FROM fact_db_resource_daily f
  WHERE ${currentFilters}
),
previous_period AS (
  SELECT
    COALESCE(SUM(${factTotalCostExpression("", queryParams.costBasis)}), 0) AS "previousCost"
  FROM fact_db_resource_daily f
  WHERE ${previousFilters}
)
SELECT
  current_period."totalCost",
  current_period."activeResources",
  current_period."dataFootprintGb",
  current_period."avgLoad",
  current_period."connections",
  current_period."totalRows",
  current_period."usageRowsWithLoad",
  current_period."usageRowsWithConnections",
  current_period."usageRowsWithStorage",
  previous_period."previousCost"
FROM current_period
CROSS JOIN previous_period;
`,
      {
        replacements: queryParams,
        type: QueryTypes.SELECT,
      },
    );

    const row = rows[0];
    if (!row) {
      return [];
    }

    const activeResources = toNumber(row.activeResources);
    const dataFootprintGb = toNumber(row.dataFootprintGb);
    const connections = toNullableNumber(row.connections);
    const totalRows = toNumber(row.totalRows);
    const loadRows = toNumber(row.usageRowsWithLoad);
    const connectionRows = toNumber(row.usageRowsWithConnections);
    const storageRows = toNumber(row.usageRowsWithStorage);

    if (params.metric === "cost") {
      const costCurrentParams = buildExplorerReplacements(buildTrendQueryParams({
        ...params,
        startDate: queryParams.startDate,
        endDate: queryParams.endDate,
      }));
      const costPreviousParams = buildExplorerReplacements(buildTrendQueryParams({
        ...params,
        startDate: queryParams.previousStartDate,
        endDate: queryParams.previousEndDate,
      }));
      const groupedFactMeta = params.groupBy === "cost_category" ? null : GROUP_BY_COLUMNS[params.groupBy];
      const withFactInventoryJoin = groupedFactMeta?.requiresInventory ?? false;
      const withFactRegionJoin = groupedFactMeta?.requiresRegion ?? false;
      const factJoinClauses = `
${withFactRegionJoin ? "LEFT JOIN dim_region dr ON dr.id = f.region_key" : ""}
${withFactInventoryJoin ? `LEFT JOIN latest_inventory li
  ON li.tenant_id = f.tenant_id
 AND li.resource_id = f.resource_id
 AND li.cloud_connection_id IS NOT DISTINCT FROM f.cloud_connection_id` : ""}
`;
      const factGroupedValuesFilterCurrentSafe = buildGroupedValuesFilter(costCurrentParams, "fact", "f", {
        withInventory: withFactInventoryJoin,
        withRegion: withFactRegionJoin,
      });
      const factGroupedValuesFilterPreviousSafe = buildGroupedValuesFilter(costPreviousParams, "fact", "f", {
        withInventory: withFactInventoryJoin,
        withRegion: withFactRegionJoin,
      });
      const currentCostRows = await sequelize.query<{ totalCost: string | number | null; activeResources: string | number | null }>(
        `
${withFactInventoryJoin ? `WITH ${latestInventoryCteSql}` : ""}
SELECT
  COALESCE(SUM(${costHistoryBaseExpression("ch", queryParams.costBasis)}), 0) AS "totalCost",
  COUNT(DISTINCT ch.resource_id) AS "activeResources"
FROM db_cost_history_daily ch
JOIN fact_db_resource_daily f
  ON f.tenant_id = ch.tenant_id
 AND f.usage_date = ch.usage_date
 AND f.resource_id = ch.resource_id
 AND f.cloud_connection_id IS NOT DISTINCT FROM ch.cloud_connection_id
${factJoinClauses}
WHERE ${buildCostHistoryDrilldownFilters(costCurrentParams, "ch")}
${factGroupedValuesFilterCurrentSafe ? `  AND ${factGroupedValuesFilterCurrentSafe}` : ""};
`,
        {
          replacements: costCurrentParams,
          type: QueryTypes.SELECT,
        },
      );
      const previousCostRows = await sequelize.query<{ totalCost: string | number | null }>(
        `
${withFactInventoryJoin ? `WITH ${latestInventoryCteSql}` : ""}
SELECT
  COALESCE(SUM(${costHistoryBaseExpression("ch", queryParams.costBasis)}), 0) AS "totalCost"
FROM db_cost_history_daily ch
JOIN fact_db_resource_daily f
  ON f.tenant_id = ch.tenant_id
 AND f.usage_date = ch.usage_date
 AND f.resource_id = ch.resource_id
 AND f.cloud_connection_id IS NOT DISTINCT FROM ch.cloud_connection_id
${factJoinClauses}
WHERE ${buildCostHistoryDrilldownFilters(costPreviousParams, "ch")}
${factGroupedValuesFilterPreviousSafe ? `  AND ${factGroupedValuesFilterPreviousSafe}` : ""};
`,
        {
          replacements: costPreviousParams,
          type: QueryTypes.SELECT,
        },
      );
      const currentCostRow = currentCostRows[0];
      const previousCostRow = previousCostRows[0];
      const filteredTotalCost = toNumber(currentCostRow?.totalCost);
      const filteredPreviousCost = toNumber(previousCostRow?.totalCost);
      const filteredActiveResources = toNumber(currentCostRow?.activeResources);
      const filteredCostTrend = filteredPreviousCost === 0 ? null : (filteredTotalCost - filteredPreviousCost) / filteredPreviousCost;
      const topTableRows = await this.getTable({ ...params, metric: "cost", groupBy: "db_service" });
      const topRegionRows = await this.getTable({ ...params, metric: "cost", groupBy: "region" });
      const topCostCategoryRows = await this.getTable({ ...params, metric: "cost", groupBy: "cost_category" });
      const meaningfulCostRows = topCostCategoryRows.filter((row) => row.group !== "Other");
      const topCostDriver = (meaningfulCostRows.length > 0 ? meaningfulCostRows : topCostCategoryRows)
        .slice()
        .sort((a, b) => b.totalCost - a.totalCost)[0];
      const topService = topTableRows[0];
      const topRegion = topRegionRows[0];
      const isEmpty = filteredActiveResources <= 0 && filteredTotalCost <= 0;

      return [
        {
          id: "total_database_spend",
          title: "Total Database Spend",
          value: formatCurrency(filteredTotalCost),
          subValue: `Active resources: ${formatInteger(filteredActiveResources)}`,
          state: isEmpty ? "empty" : "normal",
          note: "Source: db_cost_history_daily / fact_db_resource_daily",
        },
        {
          id: "cost_trend_pct",
          title: "Cost Trend %",
          value: filteredCostTrend === null ? "N/A" : formatPercent(filteredCostTrend),
          subValue: filteredPreviousCost === 0 ? "No previous-period baseline" : `Previous period: ${formatCurrency(filteredPreviousCost)}`,
          trend: {
            value: filteredCostTrend,
            direction: filteredCostTrend === null ? "unknown" : filteredCostTrend > 0 ? "up" : filteredCostTrend < 0 ? "down" : "flat",
          },
          state: filteredPreviousCost === 0 ? (isEmpty ? "empty" : "partial") : "normal",
          note: "Compares current window vs previous aligned window.",
        },
        {
          id: "top_cost_driver",
          title: "Top Cost Driver",
          value: topCostDriver ? topCostDriver.group : "N/A",
          subValue: topCostDriver ? formatCurrency(topCostDriver.totalCost) : "No cost-category data",
          state: topCostDriver ? "normal" : (isEmpty ? "empty" : "partial"),
          note: "From db_cost_history_daily grouped by cost_category.",
        },
        {
          id: "top_charging_service",
          title: "Top Charging Service",
          value: topService ? topService.group : "N/A",
          subValue: topService ? formatCurrency(topService.totalCost) : "No service cost data",
          state: topService ? "normal" : (isEmpty ? "empty" : "partial"),
          note: "From fact_db_resource_daily grouped by db_service.",
        },
        {
          id: "highest_cost_region",
          title: "Highest Cost Region",
          value: topRegion ? topRegion.group : "N/A",
          subValue: topRegion ? formatCurrency(topRegion.totalCost) : "No regional cost data",
          state: topRegion ? "normal" : (isEmpty ? "empty" : "partial"),
          note: "From fact_db_resource_daily grouped by region.",
        },
      ];
    }

    const loadCoverage = resolveCoverageState(totalRows, loadRows);
    const connCoverage = resolveCoverageState(totalRows, connectionRows);
    const storageCoverage = resolveCoverageState(totalRows, storageRows);
    const usageServiceTrendGrouped = await this.getTrendGrouped({ ...params, metric: "usage", groupBy: "db_service" });
    const usageRegionTrendGrouped = await this.getTrendGrouped({ ...params, metric: "usage", groupBy: "region" });
    const topUsageService = usageServiceTrendGrouped.series
      .slice()
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))[0];
    const topUsageRegion = usageRegionTrendGrouped.series
      .slice()
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))[0];
      const trendRows = (await this.getTrend({ ...params, metric: "usage" })).filter(isUsageTrendItem);
    const peakLoad = trendRows.reduce<number | null>((peak, item) => {
      if (item.load === null) return peak;
      if (peak === null || item.load > peak) return item.load;
      return peak;
    }, null);
    const firstLoad = trendRows.find((item) => item.load !== null);
    const lastLoad = [...trendRows].reverse().find((item) => item.load !== null);
    const activityTrend = firstLoad && lastLoad && firstLoad.load !== null && lastLoad.load !== null
      ? (lastLoad.load - firstLoad.load) / (firstLoad.load === 0 ? 1 : firstLoad.load)
      : null;

    return [
      {
        id: "active_db_resources",
        title: "Active DB Resources",
        value: formatInteger(activeResources),
        subValue: `Rows in scope: ${formatInteger(totalRows)}`,
        state: activeResources <= 0 ? "empty" : "normal",
        note: "Distinct resources from fact_db_resource_daily.",
      },
      {
        id: "peak_usage_driver",
        title: "Peak Usage Driver",
        value: topUsageService?.label ?? "N/A",
        subValue: peakLoad === null ? "No selected metric telemetry" : `Peak value: ${formatCompact(peakLoad)}`,
        trend: {
          value: activityTrend,
          direction: activityTrend === null ? "unknown" : activityTrend > 0 ? "up" : activityTrend < 0 ? "down" : "flat",
        },
        state: loadCoverage.state,
        note: loadCoverage.note ?? "Derived from usage trend grouped by DB service.",
      },
      {
        id: "operational_hotspot",
        title: "Operational Hotspot",
        value: topUsageRegion?.label ?? "N/A",
        subValue: topUsageRegion?.total ? `Usage score: ${formatCompact(topUsageRegion.total)}` : "No region usage signal",
        state: loadCoverage.state,
        note: loadCoverage.note ?? "Derived from usage trend grouped by region.",
      },
      {
        id: "storage_footprint",
        title: "Storage Footprint",
        value: `${formatCompact(dataFootprintGb)} GB`,
        subValue: storageRows > 0 ? `Telemetry rows: ${formatInteger(storageRows)}` : "No storage telemetry",
        state: storageCoverage.state,
        note: storageCoverage.note ?? "From data_footprint_gb in fact_db_resource_daily.",
      },
      {
        id: "activity_trend",
        title: "Activity Trend",
        value: activityTrend === null ? "N/A" : formatPercent(activityTrend),
        subValue: connections === null ? "Connections unavailable" : `Avg connections: ${formatCompact(connections)}`,
        trend: {
          value: activityTrend,
          direction: activityTrend === null ? "unknown" : activityTrend > 0 ? "up" : activityTrend < 0 ? "down" : "flat",
        },
        state: connCoverage.state === "normal" ? loadCoverage.state : connCoverage.state,
        note: connCoverage.note ?? loadCoverage.note ?? "From load/connections daily trend in fact_db_resource_daily.",
      },
    ];
  }

  async getUsageCoverageSummary(params: ExplorerQueryParams): Promise<ExplorerCoverageSummary | undefined> {
    if (params.metric !== "usage") return undefined;
    const family = params.capabilityFamily ?? "compute_pressure";
    const metric = params.usageMetric ?? USAGE_CAPABILITY_REGISTRY[family].defaultMetric;
    return this.computeUsageCoverageSummary(params, family, metric);
  }

  async getUsageWarnings(params: ExplorerQueryParams): Promise<ExplorerWarning[]> {
    if (params.metric !== "usage") return [];
    const family = params.capabilityFamily ?? "compute_pressure";
    const metric = params.usageMetric ?? USAGE_CAPABILITY_REGISTRY[family].defaultMetric;
    const coverage = await this.computeUsageCoverageSummary(params, family, metric);
    const warnings: ExplorerWarning[] = [];
    if (coverage.unsupported) {
      warnings.push({
        code: "USAGE_UNSUPPORTED_SCOPE",
        message: "Selected scope does not include services with supported telemetry for this capability.",
        state: "unsupported",
      });
    } else if (coverage.unavailable) {
      warnings.push({
        code: "USAGE_TELEMETRY_UNAVAILABLE",
        message: "No telemetry samples were found for the selected usage metric.",
        state: "unavailable",
      });
    } else if (coverage.degraded) {
      warnings.push({
        code: "USAGE_TELEMETRY_DEGRADED",
        message: "Telemetry coverage is partial; KPI confidence is reduced.",
        state: "degraded",
      });
    }
    return warnings;
  }

  async getUsageKpis(params: ExplorerQueryParams): Promise<ExplorerUsageKpi[]> {
    if (params.metric !== "usage") return [];
    const family = params.capabilityFamily ?? "compute_pressure";
    const metric = params.usageMetric ?? USAGE_CAPABILITY_REGISTRY[family].defaultMetric;
    const familyDef = USAGE_CAPABILITY_REGISTRY[family];
    const queryParams = buildExplorerReplacements(buildTrendQueryParams(params));
    const filters = buildResourceDrilldownFilters(queryParams, "f");
    const metricExpr = usageMetricSql(metric, "f");
    const rows = await sequelize.query<{ metricValue: string | number | null }>(
      `
SELECT AVG(${metricExpr}) AS "metricValue"
FROM fact_db_resource_daily f
WHERE ${filters}
  AND ${usageServicePredicateSql("f")};
`,
      {
        replacements: { ...queryParams, usageSupportedServices: familyDef.supportedServices },
        type: QueryTypes.SELECT,
      },
    );
    const coverage = await this.computeUsageCoverageSummary(params, family, metric);
    const warnings = await this.getUsageWarnings(params);
    const confidence = coverage.confidence;
    const reasons: string[] = [];
    if (coverage.unsupported) reasons.push("No supported service telemetry in selected scope.");
    if (coverage.unavailable) reasons.push("Telemetry fields are present but currently missing in the selected window.");
    if (coverage.degraded) reasons.push("Coverage is partial, aggregate is computed on covered subset only.");
    const state: ExplorerUsageKpi["state"] =
      coverage.unsupported ? "unsupported" : coverage.unavailable ? "unavailable" : coverage.degraded ? "degraded" : "normal";
    return [
      {
        id: `usage_metric_${metric}`,
        title: "Selected Usage Metric",
        capabilityFamily: family,
        metricId: metric,
        value: toNullableNumber(rows[0]?.metricValue),
        unit: familyDef.unitDefaults[metric] ?? null,
        coverage,
        confidence,
        maturity: familyDef.maturity,
        state,
        reasons,
        warnings: warnings.map((w) => w.message),
        sourceFields: usageMetricSourceFields(metric),
      },
      {
        id: "telemetry_coverage_rate",
        title: "Telemetry Coverage Rate",
        capabilityFamily: family,
        metricId: metric,
        value: coverage.coverageRate,
        unit: "ratio",
        coverage,
        confidence,
        maturity: familyDef.maturity,
        state,
        reasons,
        warnings: warnings.map((w) => w.message),
        sourceFields: usageMetricSourceFields(metric),
      },
    ];
  }

  async getTrend(params: ExplorerQueryParams): Promise<ExplorerTrendItem[]> {
    const queryParams = buildExplorerReplacements(buildTrendQueryParams(params));
    const filters = buildTrendFilters(queryParams, "f");

    if (queryParams.metric === "usage") {
      const hasUtilizationFallback = await this.hasDbUtilizationDailyTable();
      const selectedUsageMetric: UsageMetric = queryParams.usageMetric ?? "avg_cpu";
      const selectedFamily = queryParams.capabilityFamily ?? "compute_pressure";
      const familyDef = USAGE_CAPABILITY_REGISTRY[selectedFamily];
      const coverageSummary = await this.computeUsageCoverageSummary(queryParams, selectedFamily, selectedUsageMetric);
      const metricExpr = hasUtilizationFallback
        ? usageMetricSqlWithFallback(selectedUsageMetric, "f", "u")
        : usageMetricSql(selectedUsageMetric, "f");
      const connectionsExpr = hasUtilizationFallback ? "COALESCE(f.connections_avg, u.connections_avg)" : "f.connections_avg";
      const groupedValuesFilter = buildGroupedValuesFilter(queryParams, "fact", "f");
      const usageFilters = groupedValuesFilter ? `${filters}\n  AND ${groupedValuesFilter}` : filters;
      const rows = await sequelize.query<UsageTrendRow>(
        `
SELECT
  f.usage_date AS date,
  AVG(${metricExpr}) AS value,
  AVG(${connectionsExpr}) AS connections
FROM fact_db_resource_daily f
${hasUtilizationFallback ? `LEFT JOIN db_utilization_daily u
  ON u.tenant_id = f.tenant_id
 AND u.usage_date = f.usage_date
 AND u.resource_id = f.resource_id
 AND u.cloud_connection_id IS NOT DISTINCT FROM f.cloud_connection_id` : ""}
WHERE ${usageFilters}
  AND ${usageServicePredicateSql("f")}
  AND (${metricExpr} IS NOT NULL OR ${connectionsExpr} IS NOT NULL)
GROUP BY f.usage_date
ORDER BY f.usage_date ASC;
`,
        {
          replacements: { ...queryParams, usageSupportedServices: familyDef.supportedServices },
          type: QueryTypes.SELECT,
        },
      );

      return rows.map((row) => ({
        date: toDateOnly(row.date),
        capabilityFamily: selectedFamily,
        usageMetric: selectedUsageMetric,
        unit: familyDef.unitDefaults[selectedUsageMetric] ?? null,
        value: toNullableNumber(row.value),
        coverageRate: coverageSummary.coverageRate,
        confidence: coverageSummary.confidence,
        deprecatedLoadAlias: true,
        load: toNullableNumber(row.value),
        connections: toNullableNumber(row.connections),
      }));
    }

    const rows = await sequelize.query<CostTrendRow>(
      `
SELECT
  ch.usage_date AS date,
  COALESCE(SUM(CASE WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'compute' THEN ${costHistoryBaseExpression("ch", queryParams.costBasis)} ELSE 0 END), 0) AS compute,
  COALESCE(SUM(CASE WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'storage' THEN ${costHistoryBaseExpression("ch", queryParams.costBasis)} ELSE 0 END), 0) AS storage,
  COALESCE(SUM(CASE WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'io' THEN ${costHistoryBaseExpression("ch", queryParams.costBasis)} ELSE 0 END), 0) AS io,
  COALESCE(SUM(CASE WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'backup' THEN ${costHistoryBaseExpression("ch", queryParams.costBasis)} ELSE 0 END), 0) AS backup,
  COALESCE(SUM(${costHistoryBaseExpression("ch", queryParams.costBasis)}), 0) AS total
FROM db_cost_history_daily ch
WHERE ${buildCostHistoryDrilldownFilters(queryParams, "ch")}
GROUP BY ch.usage_date
ORDER BY ch.usage_date ASC;
`,
      {
        replacements: queryParams,
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      date: toDateOnly(row.date),
      compute: toNumber(row.compute),
      storage: toNumber(row.storage),
      io: toNumber(row.io),
      backup: toNumber(row.backup),
      total: toNumber(row.total),
    }));
  }

  async getTable(params: ExplorerQueryParams): Promise<ExplorerTableRow[]> {
    const queryParams = buildExplorerReplacements(buildTrendQueryParams(params));
    if (queryParams.groupBy === "cost_category") {
      if (queryParams.metric === "usage") {
        return [];
      }
      const drilldownFilters = buildCostHistoryDrilldownFilters(queryParams, "ch");
      const rows = await sequelize.query<CostCategoryGroupedRow>(
        `
WITH base AS (
  SELECT
    LOWER(BTRIM(COALESCE(ch.cost_category, ''))) AS category_key,
    ${COST_CATEGORY_LABEL_CASE} AS category_label,
    ch.resource_id AS resource_id,
    ${costHistoryBaseExpression("ch", queryParams.costBasis)} AS cost_value,
    ${buildDbServiceDisplaySql("f")} AS service_label,
    COALESCE(NULLIF(NULLIF(LOWER(BTRIM(COALESCE(f.db_engine, ''))), 'unknown'), ''), 'n/a') AS engine_label
  FROM db_cost_history_daily ch
  LEFT JOIN fact_db_resource_daily f
    ON f.tenant_id = ch.tenant_id
   AND f.usage_date = ch.usage_date
   AND f.resource_id = ch.resource_id
   AND f.cloud_connection_id IS NOT DISTINCT FROM ch.cloud_connection_id
  WHERE ${drilldownFilters}
),
category_agg AS (
  SELECT
    category_key,
    category_label,
    COALESCE(SUM(cost_value), 0) AS "totalCost",
    COALESCE(SUM(CASE WHEN category_key = 'compute' THEN cost_value ELSE 0 END), 0) AS "computeCost",
    COALESCE(SUM(CASE WHEN category_key = 'storage' THEN cost_value ELSE 0 END), 0) AS "storageCost",
    COALESCE(SUM(CASE WHEN category_key = 'io' THEN cost_value ELSE 0 END), 0) AS "ioCost",
    COALESCE(SUM(CASE WHEN category_key = 'backup' THEN cost_value ELSE 0 END), 0) AS "backupCost",
    COUNT(DISTINCT resource_id) AS "resourceCount"
  FROM base
  GROUP BY category_key, category_label
),
top_service_ranked AS (
  SELECT
    category_key,
    service_label AS top_service,
    ROW_NUMBER() OVER (
      PARTITION BY category_key
      ORDER BY SUM(cost_value) DESC, service_label ASC
    ) AS rn
  FROM base
  WHERE service_label IS NOT NULL
    AND BTRIM(service_label) <> ''
    AND service_label <> 'Unknown service'
  GROUP BY category_key, service_label
),
top_engine_ranked AS (
  SELECT
    category_key,
    engine_label AS top_engine,
    ROW_NUMBER() OVER (
      PARTITION BY category_key
      ORDER BY SUM(cost_value) DESC, engine_label ASC
    ) AS rn
  FROM base
  WHERE engine_label IS NOT NULL
    AND BTRIM(engine_label) <> ''
    AND engine_label <> 'n/a'
  GROUP BY category_key, engine_label
)
SELECT
  a.category_key AS "groupKey",
  a.category_label AS "group",
  a."totalCost",
  CASE
    WHEN COALESCE(SUM(a."totalCost") OVER (), 0) > 0
      THEN a."totalCost" / SUM(a."totalCost") OVER ()
    ELSE 0
  END AS "costSharePct",
  COALESCE(ts.top_service, 'N/A') AS "topService",
  COALESCE(te.top_engine, 'N/A') AS "topEngine",
  a."computeCost",
  a."storageCost",
  a."ioCost",
  a."backupCost",
  a."resourceCount"
FROM category_agg a
LEFT JOIN top_service_ranked ts
  ON ts.category_key = a.category_key
 AND ts.rn = 1
LEFT JOIN top_engine_ranked te
  ON te.category_key = a.category_key
 AND te.rn = 1
ORDER BY a."totalCost" DESC, a.category_label ASC;
`,
        {
          replacements: queryParams,
          type: QueryTypes.SELECT,
        },
      );
      return rows.map((row) => ({
        group: String(row.group ?? row.groupLabel ?? row.groupKey ?? "Other"),
        costSharePct: toNullableNumber(row.costSharePct),
        topService: typeof row.topService === "string" && row.topService.trim().length > 0 ? row.topService.trim() : "N/A",
        topEngine: typeof row.topEngine === "string" && row.topEngine.trim().length > 0 ? row.topEngine.trim() : "N/A",
        totalCost: toNumber(row.totalCost),
        computeCost: toNumber(row.computeCost),
        storageCost: toNumber(row.storageCost),
        ioCost: toNumber(row.ioCost),
        backupCost: toNumber(row.backupCost),
        resourceCount: toNumber(row.resourceCount),
        avgLoad: null,
        connections: null,
      }));
    }

    if (queryParams.metric === "cost") {
      const groupBy = GROUP_BY_COLUMNS[queryParams.groupBy];
      const withInventory = groupBy.requiresInventory;
      const withRegion = groupBy.requiresRegion;
      const factGroupedValuesFilter = buildGroupedValuesFilter(queryParams, "fact", "f", {
        withInventory,
        withRegion,
      });
      const excludeUnknownResourceType =
        queryParams.groupBy === "resource_type"
          ? `  AND ${resourceTypeCanonicalExpression("f")} <> 'unknown resource type'`
          : "";

      const rows = await sequelize.query<TableAggregateRow>(
        `
${withInventory ? `WITH ${latestInventoryCteSql}` : ""}
SELECT
  ${groupBy.selectExpression} AS "group",
  COALESCE(SUM(${costHistoryBaseExpression("ch", queryParams.costBasis)}), 0) AS "totalCost",
  COALESCE(SUM(CASE WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'compute' THEN ${costHistoryBaseExpression("ch", queryParams.costBasis)} ELSE 0 END), 0) AS "computeCost",
  COALESCE(SUM(CASE WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'storage' THEN ${costHistoryBaseExpression("ch", queryParams.costBasis)} ELSE 0 END), 0) AS "storageCost",
  COALESCE(SUM(CASE WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'io' THEN ${costHistoryBaseExpression("ch", queryParams.costBasis)} ELSE 0 END), 0) AS "ioCost",
  COALESCE(SUM(CASE WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'backup' THEN ${costHistoryBaseExpression("ch", queryParams.costBasis)} ELSE 0 END), 0) AS "backupCost",
  COUNT(DISTINCT ch.resource_id) AS "resourceCount",
  AVG(f.cpu_avg) AS "avgLoad",
  AVG(f.connections_avg) AS "connections"
FROM db_cost_history_daily ch
JOIN fact_db_resource_daily f
  ON f.tenant_id = ch.tenant_id
 AND f.usage_date = ch.usage_date
 AND f.resource_id = ch.resource_id
 AND f.cloud_connection_id IS NOT DISTINCT FROM ch.cloud_connection_id
${withRegion ? "LEFT JOIN dim_region dr ON dr.id = f.region_key" : ""}
${withInventory ? `LEFT JOIN latest_inventory li
  ON li.tenant_id = f.tenant_id
 AND li.resource_id = f.resource_id
 AND li.cloud_connection_id IS NOT DISTINCT FROM f.cloud_connection_id` : ""}
WHERE ${buildCostHistoryDrilldownFilters(queryParams, "ch")}
${factGroupedValuesFilter ? `  AND ${factGroupedValuesFilter}` : ""}
${excludeUnknownResourceType}
GROUP BY ${groupBy.groupExpression}
ORDER BY "totalCost" DESC;
`,
        {
          replacements: queryParams,
          type: QueryTypes.SELECT,
        },
      );

      return rows.map((row) => ({
        group: String(row.group),
        totalCost: toNumber(row.totalCost),
        computeCost: toNumber(row.computeCost),
        storageCost: toNumber(row.storageCost),
        ioCost: toNumber(row.ioCost),
        backupCost: toNumber(row.backupCost),
        resourceCount: toNumber(row.resourceCount),
        avgLoad: toNullableNumber(row.avgLoad),
        connections: toNullableNumber(row.connections),
      }));
    }

    const groupBy = GROUP_BY_COLUMNS[queryParams.groupBy];
    const filters = buildResourceDrilldownFilters(queryParams, "f");
    const withInventory = groupBy.requiresInventory;
    const withRegion = groupBy.requiresRegion;
    const selectedFamily = queryParams.capabilityFamily ?? "compute_pressure";
    const selectedUsageMetric: UsageMetric = queryParams.usageMetric ?? USAGE_CAPABILITY_REGISTRY[selectedFamily].defaultMetric;
    const familyDef = USAGE_CAPABILITY_REGISTRY[selectedFamily];
    const executeEmergencyClusterTableQuery = async (): Promise<TableAggregateRow[]> => {
      const hasUtilizationFallback = await this.hasDbUtilizationDailyTable();
      const primaryMetricExpr = hasUtilizationFallback
        ? usageMetricSqlWithFallback(selectedUsageMetric, "f", "u")
        : usageMetricSql(selectedUsageMetric, "f");
      const avgCpuExpr = hasUtilizationFallback ? "COALESCE(f.cpu_avg, u.cpu_avg)" : "f.cpu_avg";
      const peakCpuExpr = hasUtilizationFallback ? "COALESCE(f.cpu_max, u.cpu_max)" : "f.cpu_max";
      const avgConnectionsExpr = hasUtilizationFallback ? "COALESCE(f.connections_avg, u.connections_avg)" : "f.connections_avg";
      const peakConnectionsExpr = hasUtilizationFallback ? "COALESCE(f.connections_max, u.connections_max)" : "f.connections_max";
      const readIopsExpr = hasUtilizationFallback ? "COALESCE(f.read_iops, u.read_iops)" : "f.read_iops";
      const writeIopsExpr = hasUtilizationFallback ? "COALESCE(f.write_iops, u.write_iops)" : "f.write_iops";
      const readThroughputExpr = hasUtilizationFallback ? "COALESCE(f.read_throughput_bytes, u.read_throughput_bytes)" : "f.read_throughput_bytes";
      const writeThroughputExpr = hasUtilizationFallback ? "COALESCE(f.write_throughput_bytes, u.write_throughput_bytes)" : "f.write_throughput_bytes";
      const storageUsedExpr = hasUtilizationFallback ? "COALESCE(f.storage_used_gb, u.storage_used_gb)" : "f.storage_used_gb";
      const allocatedStorageExpr = hasUtilizationFallback ? "COALESCE(f.allocated_storage_gb, u.allocated_storage_gb)" : "f.allocated_storage_gb";
      return sequelize.query<TableAggregateRow>(
        `
WITH ${latestInventoryCteSql}
SELECT
  COALESCE(NULLIF(BTRIM(f.cluster_id), ''), NULLIF(BTRIM(li.cluster_id), ''), 'standalone-no-cluster') AS "groupKey",
  COALESCE(NULLIF(BTRIM(f.cluster_id), ''), NULLIF(BTRIM(li.cluster_id), ''), 'Standalone / No cluster') AS "groupLabel",
  COALESCE(SUM(${factTotalCostExpression("f", queryParams.costBasis)}), 0) AS "totalCost",
  COALESCE(SUM(f.compute_cost), 0) AS "computeCost",
  COALESCE(SUM(f.storage_cost), 0) AS "storageCost",
  COALESCE(SUM(f.io_cost), 0) AS "ioCost",
  COALESCE(SUM(f.backup_cost), 0) AS "backupCost",
  COUNT(DISTINCT f.resource_id) AS "resourceCount",
  COUNT(DISTINCT f.resource_id) FILTER (WHERE ${usageServicePredicateSql("f")}) AS "inScopeResources",
  COUNT(DISTINCT f.resource_id) FILTER (WHERE ${usageServicePredicateSql("f")} AND (${primaryMetricExpr}) IS NOT NULL) AS "telemetryCoveredResources",
  AVG(f.cpu_avg) AS "avgLoad",
  AVG(f.connections_avg) AS "connections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${avgCpuExpr} ELSE NULL END) AS "avgCpu",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${peakCpuExpr} ELSE NULL END) AS "peakCpu",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${avgConnectionsExpr} ELSE NULL END) AS "avgConnections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${peakConnectionsExpr} ELSE NULL END) AS "peakConnections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${readIopsExpr} ELSE NULL END) AS "readIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${writeIopsExpr} ELSE NULL END) AS "writeIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} AND NOT (${readIopsExpr} IS NULL AND ${writeIopsExpr} IS NULL) THEN COALESCE(${readIopsExpr}, 0) + COALESCE(${writeIopsExpr}, 0) ELSE NULL END) AS "totalIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${readThroughputExpr} ELSE NULL END) AS "readThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${writeThroughputExpr} ELSE NULL END) AS "writeThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} AND NOT (${readThroughputExpr} IS NULL AND ${writeThroughputExpr} IS NULL) THEN COALESCE(${readThroughputExpr}, 0) + COALESCE(${writeThroughputExpr}, 0) ELSE NULL END) AS "totalThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${storageUsedExpr} ELSE NULL END) AS "storageUsedGb",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${allocatedStorageExpr} ELSE NULL END) AS "allocatedStorageGb",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${primaryMetricExpr} ELSE NULL END) AS "primaryMetricValue"
FROM fact_db_resource_daily f
LEFT JOIN latest_inventory li
  ON li.tenant_id = f.tenant_id
 AND li.resource_id = f.resource_id
 AND li.cloud_connection_id IS NOT DISTINCT FROM f.cloud_connection_id
${hasUtilizationFallback ? `LEFT JOIN db_utilization_daily u
  ON u.tenant_id = f.tenant_id
 AND u.usage_date = f.usage_date
 AND u.resource_id = f.resource_id
 AND u.cloud_connection_id IS NOT DISTINCT FROM f.cloud_connection_id` : ""}
WHERE ${filters}
  AND ${usageServicePredicateSql("f")}
GROUP BY
  COALESCE(NULLIF(BTRIM(f.cluster_id), ''), NULLIF(BTRIM(li.cluster_id), ''), 'Standalone / No cluster'),
  COALESCE(NULLIF(BTRIM(f.cluster_id), ''), NULLIF(BTRIM(li.cluster_id), ''), 'standalone-no-cluster')
ORDER BY "primaryMetricValue" DESC NULLS LAST, "resourceCount" DESC;
`,
        {
          replacements: { ...queryParams, usageSupportedServices: familyDef.supportedServices },
          type: QueryTypes.SELECT,
        },
      );
    };
    const executeEmergencyInstanceClassTableQuery = async (): Promise<TableAggregateRow[]> => {
      const hasUtilizationFallback = await this.hasDbUtilizationDailyTable();
      const primaryMetricExpr = hasUtilizationFallback
        ? usageMetricSqlWithFallback(selectedUsageMetric, "f", "u")
        : usageMetricSql(selectedUsageMetric, "f");
      const avgCpuExpr = hasUtilizationFallback ? "COALESCE(f.cpu_avg, u.cpu_avg)" : "f.cpu_avg";
      const peakCpuExpr = hasUtilizationFallback ? "COALESCE(f.cpu_max, u.cpu_max)" : "f.cpu_max";
      const avgConnectionsExpr = hasUtilizationFallback ? "COALESCE(f.connections_avg, u.connections_avg)" : "f.connections_avg";
      const peakConnectionsExpr = hasUtilizationFallback ? "COALESCE(f.connections_max, u.connections_max)" : "f.connections_max";
      const readIopsExpr = hasUtilizationFallback ? "COALESCE(f.read_iops, u.read_iops)" : "f.read_iops";
      const writeIopsExpr = hasUtilizationFallback ? "COALESCE(f.write_iops, u.write_iops)" : "f.write_iops";
      const readThroughputExpr = hasUtilizationFallback ? "COALESCE(f.read_throughput_bytes, u.read_throughput_bytes)" : "f.read_throughput_bytes";
      const writeThroughputExpr = hasUtilizationFallback ? "COALESCE(f.write_throughput_bytes, u.write_throughput_bytes)" : "f.write_throughput_bytes";
      const storageUsedExpr = hasUtilizationFallback ? "COALESCE(f.storage_used_gb, u.storage_used_gb)" : "f.storage_used_gb";
      const allocatedStorageExpr = hasUtilizationFallback ? "COALESCE(f.allocated_storage_gb, u.allocated_storage_gb)" : "f.allocated_storage_gb";
      return sequelize.query<TableAggregateRow>(
        `
WITH ${latestInventoryCteSql}
SELECT
  COALESCE(NULLIF(BTRIM(li.instance_class), ''), 'unknown-class') AS "groupKey",
  COALESCE(NULLIF(BTRIM(li.instance_class), ''), 'Unknown class') AS "groupLabel",
  COALESCE(SUM(${factTotalCostExpression("f", queryParams.costBasis)}), 0) AS "totalCost",
  COALESCE(SUM(f.compute_cost), 0) AS "computeCost",
  COALESCE(SUM(f.storage_cost), 0) AS "storageCost",
  COALESCE(SUM(f.io_cost), 0) AS "ioCost",
  COALESCE(SUM(f.backup_cost), 0) AS "backupCost",
  COUNT(DISTINCT f.resource_id) AS "resourceCount",
  COUNT(DISTINCT f.resource_id) FILTER (WHERE ${usageServicePredicateSql("f")}) AS "inScopeResources",
  COUNT(DISTINCT f.resource_id) FILTER (WHERE ${usageServicePredicateSql("f")} AND (${primaryMetricExpr}) IS NOT NULL) AS "telemetryCoveredResources",
  AVG(f.cpu_avg) AS "avgLoad",
  AVG(f.connections_avg) AS "connections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${avgCpuExpr} ELSE NULL END) AS "avgCpu",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${peakCpuExpr} ELSE NULL END) AS "peakCpu",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${avgConnectionsExpr} ELSE NULL END) AS "avgConnections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${peakConnectionsExpr} ELSE NULL END) AS "peakConnections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${readIopsExpr} ELSE NULL END) AS "readIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${writeIopsExpr} ELSE NULL END) AS "writeIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} AND NOT (${readIopsExpr} IS NULL AND ${writeIopsExpr} IS NULL) THEN COALESCE(${readIopsExpr}, 0) + COALESCE(${writeIopsExpr}, 0) ELSE NULL END) AS "totalIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${readThroughputExpr} ELSE NULL END) AS "readThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${writeThroughputExpr} ELSE NULL END) AS "writeThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} AND NOT (${readThroughputExpr} IS NULL AND ${writeThroughputExpr} IS NULL) THEN COALESCE(${readThroughputExpr}, 0) + COALESCE(${writeThroughputExpr}, 0) ELSE NULL END) AS "totalThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${storageUsedExpr} ELSE NULL END) AS "storageUsedGb",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${allocatedStorageExpr} ELSE NULL END) AS "allocatedStorageGb",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${primaryMetricExpr} ELSE NULL END) AS "primaryMetricValue"
FROM fact_db_resource_daily f
LEFT JOIN latest_inventory li
  ON li.tenant_id = f.tenant_id
 AND li.resource_id = f.resource_id
 AND li.cloud_connection_id IS NOT DISTINCT FROM f.cloud_connection_id
${hasUtilizationFallback ? `LEFT JOIN db_utilization_daily u
  ON u.tenant_id = f.tenant_id
 AND u.usage_date = f.usage_date
 AND u.resource_id = f.resource_id
 AND u.cloud_connection_id IS NOT DISTINCT FROM f.cloud_connection_id` : ""}
WHERE ${filters}
  AND ${usageServicePredicateSql("f")}
GROUP BY
  COALESCE(NULLIF(BTRIM(li.instance_class), ''), 'Unknown class'),
  COALESCE(NULLIF(BTRIM(li.instance_class), ''), 'unknown-class')
ORDER BY "primaryMetricValue" DESC NULLS LAST, "resourceCount" DESC;
`,
        {
          replacements: { ...queryParams, usageSupportedServices: familyDef.supportedServices },
          type: QueryTypes.SELECT,
        },
      );
    };
    const executeEmergencyRegionTableQuery = async (): Promise<TableAggregateRow[]> => {
      const hasUtilizationFallback = await this.hasDbUtilizationDailyTable();
      const primaryMetricExpr = hasUtilizationFallback
        ? usageMetricSqlWithFallback(selectedUsageMetric, "f", "u")
        : usageMetricSql(selectedUsageMetric, "f");
      const avgCpuExpr = hasUtilizationFallback ? "COALESCE(f.cpu_avg, u.cpu_avg)" : "f.cpu_avg";
      const peakCpuExpr = hasUtilizationFallback ? "COALESCE(f.cpu_max, u.cpu_max)" : "f.cpu_max";
      const avgConnectionsExpr = hasUtilizationFallback ? "COALESCE(f.connections_avg, u.connections_avg)" : "f.connections_avg";
      const peakConnectionsExpr = hasUtilizationFallback ? "COALESCE(f.connections_max, u.connections_max)" : "f.connections_max";
      const readIopsExpr = hasUtilizationFallback ? "COALESCE(f.read_iops, u.read_iops)" : "f.read_iops";
      const writeIopsExpr = hasUtilizationFallback ? "COALESCE(f.write_iops, u.write_iops)" : "f.write_iops";
      const readThroughputExpr = hasUtilizationFallback ? "COALESCE(f.read_throughput_bytes, u.read_throughput_bytes)" : "f.read_throughput_bytes";
      const writeThroughputExpr = hasUtilizationFallback ? "COALESCE(f.write_throughput_bytes, u.write_throughput_bytes)" : "f.write_throughput_bytes";
      const storageUsedExpr = hasUtilizationFallback ? "COALESCE(f.storage_used_gb, u.storage_used_gb)" : "f.storage_used_gb";
      const allocatedStorageExpr = hasUtilizationFallback ? "COALESCE(f.allocated_storage_gb, u.allocated_storage_gb)" : "f.allocated_storage_gb";
      return sequelize.query<TableAggregateRow>(
        `
SELECT
  COALESCE(NULLIF(BTRIM(dr.region_id), ''), NULLIF(BTRIM(dr.region_name), ''), CASE WHEN f.region_key IS NULL THEN 'unknown-region' ELSE f.region_key::text END) AS "groupKey",
  COALESCE(NULLIF(BTRIM(dr.region_id), ''), NULLIF(BTRIM(dr.region_name), ''), 'Unknown region') AS "groupLabel",
  COALESCE(SUM(${factTotalCostExpression("f", queryParams.costBasis)}), 0) AS "totalCost",
  COALESCE(SUM(f.compute_cost), 0) AS "computeCost",
  COALESCE(SUM(f.storage_cost), 0) AS "storageCost",
  COALESCE(SUM(f.io_cost), 0) AS "ioCost",
  COALESCE(SUM(f.backup_cost), 0) AS "backupCost",
  COUNT(DISTINCT f.resource_id) AS "resourceCount",
  COUNT(DISTINCT f.resource_id) FILTER (WHERE ${usageServicePredicateSql("f")}) AS "inScopeResources",
  COUNT(DISTINCT f.resource_id) FILTER (WHERE ${usageServicePredicateSql("f")} AND (${primaryMetricExpr}) IS NOT NULL) AS "telemetryCoveredResources",
  AVG(f.cpu_avg) AS "avgLoad",
  AVG(f.connections_avg) AS "connections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${avgCpuExpr} ELSE NULL END) AS "avgCpu",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${peakCpuExpr} ELSE NULL END) AS "peakCpu",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${avgConnectionsExpr} ELSE NULL END) AS "avgConnections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${peakConnectionsExpr} ELSE NULL END) AS "peakConnections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${readIopsExpr} ELSE NULL END) AS "readIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${writeIopsExpr} ELSE NULL END) AS "writeIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} AND NOT (${readIopsExpr} IS NULL AND ${writeIopsExpr} IS NULL) THEN COALESCE(${readIopsExpr}, 0) + COALESCE(${writeIopsExpr}, 0) ELSE NULL END) AS "totalIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${readThroughputExpr} ELSE NULL END) AS "readThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${writeThroughputExpr} ELSE NULL END) AS "writeThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} AND NOT (${readThroughputExpr} IS NULL AND ${writeThroughputExpr} IS NULL) THEN COALESCE(${readThroughputExpr}, 0) + COALESCE(${writeThroughputExpr}, 0) ELSE NULL END) AS "totalThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${storageUsedExpr} ELSE NULL END) AS "storageUsedGb",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${allocatedStorageExpr} ELSE NULL END) AS "allocatedStorageGb",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${primaryMetricExpr} ELSE NULL END) AS "primaryMetricValue"
FROM fact_db_resource_daily f
LEFT JOIN dim_region dr ON dr.id = f.region_key
${hasUtilizationFallback ? `LEFT JOIN db_utilization_daily u
  ON u.tenant_id = f.tenant_id
 AND u.usage_date = f.usage_date
 AND u.resource_id = f.resource_id
 AND u.cloud_connection_id IS NOT DISTINCT FROM f.cloud_connection_id` : ""}
WHERE ${filters}
  AND ${usageServicePredicateSql("f")}
GROUP BY
  COALESCE(NULLIF(BTRIM(dr.region_id), ''), NULLIF(BTRIM(dr.region_name), ''), 'Unknown region'),
  COALESCE(NULLIF(BTRIM(dr.region_id), ''), NULLIF(BTRIM(dr.region_name), ''), CASE WHEN f.region_key IS NULL THEN 'unknown-region' ELSE f.region_key::text END)
ORDER BY "primaryMetricValue" DESC NULLS LAST, "resourceCount" DESC;
`,
        {
          replacements: { ...queryParams, usageSupportedServices: familyDef.supportedServices },
          type: QueryTypes.SELECT,
        },
      );
    };
    const executeEmergencyDbEngineTableQuery = async (): Promise<TableAggregateRow[]> => {
      const hasUtilizationFallback = await this.hasDbUtilizationDailyTable();
      const primaryMetricExpr = hasUtilizationFallback
        ? usageMetricSqlWithFallback(selectedUsageMetric, "f", "u")
        : usageMetricSql(selectedUsageMetric, "f");
      const avgCpuExpr = hasUtilizationFallback ? "COALESCE(f.cpu_avg, u.cpu_avg)" : "f.cpu_avg";
      const peakCpuExpr = hasUtilizationFallback ? "COALESCE(f.cpu_max, u.cpu_max)" : "f.cpu_max";
      const avgConnectionsExpr = hasUtilizationFallback ? "COALESCE(f.connections_avg, u.connections_avg)" : "f.connections_avg";
      const peakConnectionsExpr = hasUtilizationFallback ? "COALESCE(f.connections_max, u.connections_max)" : "f.connections_max";
      const readIopsExpr = hasUtilizationFallback ? "COALESCE(f.read_iops, u.read_iops)" : "f.read_iops";
      const writeIopsExpr = hasUtilizationFallback ? "COALESCE(f.write_iops, u.write_iops)" : "f.write_iops";
      const readThroughputExpr = hasUtilizationFallback ? "COALESCE(f.read_throughput_bytes, u.read_throughput_bytes)" : "f.read_throughput_bytes";
      const writeThroughputExpr = hasUtilizationFallback ? "COALESCE(f.write_throughput_bytes, u.write_throughput_bytes)" : "f.write_throughput_bytes";
      const storageUsedExpr = hasUtilizationFallback ? "COALESCE(f.storage_used_gb, u.storage_used_gb)" : "f.storage_used_gb";
      const allocatedStorageExpr = hasUtilizationFallback ? "COALESCE(f.allocated_storage_gb, u.allocated_storage_gb)" : "f.allocated_storage_gb";
      return sequelize.query<TableAggregateRow>(
        `
SELECT
  COALESCE(NULLIF(NULLIF(LOWER(BTRIM(f.db_engine)), 'unknown'), ''), 'unknown-engine') AS "groupKey",
  COALESCE(NULLIF(NULLIF(LOWER(BTRIM(f.db_engine)), 'unknown'), ''), 'Unknown engine') AS "groupLabel",
  COALESCE(SUM(${factTotalCostExpression("f", queryParams.costBasis)}), 0) AS "totalCost",
  COALESCE(SUM(f.compute_cost), 0) AS "computeCost",
  COALESCE(SUM(f.storage_cost), 0) AS "storageCost",
  COALESCE(SUM(f.io_cost), 0) AS "ioCost",
  COALESCE(SUM(f.backup_cost), 0) AS "backupCost",
  COUNT(DISTINCT f.resource_id) AS "resourceCount",
  COUNT(DISTINCT f.resource_id) FILTER (WHERE ${usageServicePredicateSql("f")}) AS "inScopeResources",
  COUNT(DISTINCT f.resource_id) FILTER (WHERE ${usageServicePredicateSql("f")} AND (${primaryMetricExpr}) IS NOT NULL) AS "telemetryCoveredResources",
  AVG(f.cpu_avg) AS "avgLoad",
  AVG(f.connections_avg) AS "connections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${avgCpuExpr} ELSE NULL END) AS "avgCpu",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${peakCpuExpr} ELSE NULL END) AS "peakCpu",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${avgConnectionsExpr} ELSE NULL END) AS "avgConnections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${peakConnectionsExpr} ELSE NULL END) AS "peakConnections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${readIopsExpr} ELSE NULL END) AS "readIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${writeIopsExpr} ELSE NULL END) AS "writeIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} AND NOT (${readIopsExpr} IS NULL AND ${writeIopsExpr} IS NULL) THEN COALESCE(${readIopsExpr}, 0) + COALESCE(${writeIopsExpr}, 0) ELSE NULL END) AS "totalIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${readThroughputExpr} ELSE NULL END) AS "readThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${writeThroughputExpr} ELSE NULL END) AS "writeThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} AND NOT (${readThroughputExpr} IS NULL AND ${writeThroughputExpr} IS NULL) THEN COALESCE(${readThroughputExpr}, 0) + COALESCE(${writeThroughputExpr}, 0) ELSE NULL END) AS "totalThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${storageUsedExpr} ELSE NULL END) AS "storageUsedGb",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${allocatedStorageExpr} ELSE NULL END) AS "allocatedStorageGb",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${primaryMetricExpr} ELSE NULL END) AS "primaryMetricValue"
FROM fact_db_resource_daily f
${hasUtilizationFallback ? `LEFT JOIN db_utilization_daily u
  ON u.tenant_id = f.tenant_id
 AND u.usage_date = f.usage_date
 AND u.resource_id = f.resource_id
 AND u.cloud_connection_id IS NOT DISTINCT FROM f.cloud_connection_id` : ""}
WHERE ${filters}
  AND ${usageServicePredicateSql("f")}
GROUP BY
  COALESCE(NULLIF(NULLIF(LOWER(BTRIM(f.db_engine)), 'unknown'), ''), 'Unknown engine'),
  COALESCE(NULLIF(NULLIF(LOWER(BTRIM(f.db_engine)), 'unknown'), ''), 'unknown-engine')
ORDER BY "primaryMetricValue" DESC NULLS LAST, "resourceCount" DESC;
`,
        {
          replacements: { ...queryParams, usageSupportedServices: familyDef.supportedServices },
          type: QueryTypes.SELECT,
        },
      );
    };
    const executeUsageTableQuery = async (
      useUtilizationFallback: boolean,
      simpleMode: "none" | "db_engine" | "region" = "none",
    ): Promise<TableAggregateRow[]> => {
      const localGroupBy = simpleMode === "db_engine"
        ? {
            selectExpression: "COALESCE(NULLIF(NULLIF(LOWER(BTRIM(f.db_engine)), 'unknown'), ''), 'Unknown engine')",
            groupExpression: "COALESCE(NULLIF(NULLIF(LOWER(BTRIM(f.db_engine)), 'unknown'), ''), 'Unknown engine')",
            keyExpression: "COALESCE(NULLIF(NULLIF(LOWER(BTRIM(f.db_engine)), 'unknown'), ''), 'unknown-engine')",
            requiresInventory: false,
            requiresRegion: false,
          }
        : simpleMode === "region"
          ? {
              selectExpression: "CASE WHEN f.region_key IS NULL THEN 'Unknown region' ELSE f.region_key::text END",
              groupExpression: "CASE WHEN f.region_key IS NULL THEN 'Unknown region' ELSE f.region_key::text END",
              keyExpression: "CASE WHEN f.region_key IS NULL THEN 'unknown-region' ELSE f.region_key::text END",
              requiresInventory: false,
              requiresRegion: false,
            }
        : groupBy;
      const localWithInventory = simpleMode === "none" ? withInventory : false;
      const localWithRegion = simpleMode === "none" ? withRegion : false;
      const selectedMetricExpr = useUtilizationFallback
        ? usageMetricSqlWithFallback(selectedUsageMetric, "f", "u")
        : usageMetricSql(selectedUsageMetric, "f");
      const avgCpuExpr = useUtilizationFallback ? "COALESCE(f.cpu_avg, u.cpu_avg)" : "f.cpu_avg";
      const peakCpuExpr = useUtilizationFallback ? "COALESCE(f.cpu_max, u.cpu_max)" : "f.cpu_max";
      const avgConnectionsExpr = useUtilizationFallback ? "COALESCE(f.connections_avg, u.connections_avg)" : "f.connections_avg";
      const peakConnectionsExpr = useUtilizationFallback ? "COALESCE(f.connections_max, u.connections_max)" : "f.connections_max";
      const readIopsExpr = useUtilizationFallback ? "COALESCE(f.read_iops, u.read_iops)" : "f.read_iops";
      const writeIopsExpr = useUtilizationFallback ? "COALESCE(f.write_iops, u.write_iops)" : "f.write_iops";
      const readThroughputExpr = useUtilizationFallback ? "COALESCE(f.read_throughput_bytes, u.read_throughput_bytes)" : "f.read_throughput_bytes";
      const writeThroughputExpr = useUtilizationFallback ? "COALESCE(f.write_throughput_bytes, u.write_throughput_bytes)" : "f.write_throughput_bytes";
      const storageUsedExpr = useUtilizationFallback ? "COALESCE(f.storage_used_gb, u.storage_used_gb)" : "f.storage_used_gb";
      const allocatedStorageExpr = useUtilizationFallback ? "COALESCE(f.allocated_storage_gb, u.allocated_storage_gb)" : "f.allocated_storage_gb";
      return sequelize.query<TableAggregateRow>(
      `
${localWithInventory ? `WITH ${latestInventoryCteSql}` : ""}
SELECT
  ${localGroupBy.keyExpression}::text AS "groupKey",
  ${localGroupBy.selectExpression} AS "groupLabel",
  COALESCE(SUM(${factTotalCostExpression("f", queryParams.costBasis)}), 0) AS "totalCost",
  COALESCE(SUM(f.compute_cost), 0) AS "computeCost",
  COALESCE(SUM(f.storage_cost), 0) AS "storageCost",
  COALESCE(SUM(f.io_cost), 0) AS "ioCost",
  COALESCE(SUM(f.backup_cost), 0) AS "backupCost",
  COUNT(DISTINCT f.resource_id) AS "resourceCount",
  COUNT(DISTINCT f.resource_id) FILTER (WHERE ${usageServicePredicateSql("f")}) AS "inScopeResources",
  COUNT(DISTINCT f.resource_id) FILTER (WHERE ${usageServicePredicateSql("f")} AND (${selectedMetricExpr}) IS NOT NULL) AS "telemetryCoveredResources",
  AVG(f.cpu_avg) AS "avgLoad",
  AVG(f.connections_avg) AS "connections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${avgCpuExpr} ELSE NULL END) AS "avgCpu",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${peakCpuExpr} ELSE NULL END) AS "peakCpu",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${avgConnectionsExpr} ELSE NULL END) AS "avgConnections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${peakConnectionsExpr} ELSE NULL END) AS "peakConnections",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${readIopsExpr} ELSE NULL END) AS "readIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${writeIopsExpr} ELSE NULL END) AS "writeIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} AND NOT (${readIopsExpr} IS NULL AND ${writeIopsExpr} IS NULL) THEN COALESCE(${readIopsExpr}, 0) + COALESCE(${writeIopsExpr}, 0) ELSE NULL END) AS "totalIops",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${readThroughputExpr} ELSE NULL END) AS "readThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${writeThroughputExpr} ELSE NULL END) AS "writeThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} AND NOT (${readThroughputExpr} IS NULL AND ${writeThroughputExpr} IS NULL) THEN COALESCE(${readThroughputExpr}, 0) + COALESCE(${writeThroughputExpr}, 0) ELSE NULL END) AS "totalThroughputBytes",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${storageUsedExpr} ELSE NULL END) AS "storageUsedGb",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${allocatedStorageExpr} ELSE NULL END) AS "allocatedStorageGb",
  AVG(CASE WHEN ${usageServicePredicateSql("f")} THEN ${selectedMetricExpr} ELSE NULL END) AS "primaryMetricValue"
${fromFactBaseSql({ withInventory: localWithInventory, withRegion: localWithRegion })}
${useUtilizationFallback ? `LEFT JOIN db_utilization_daily u
  ON u.tenant_id = f.tenant_id
 AND u.usage_date = f.usage_date
 AND u.resource_id = f.resource_id
 AND u.cloud_connection_id IS NOT DISTINCT FROM f.cloud_connection_id` : ""}
WHERE ${filters}
GROUP BY ${localGroupBy.groupExpression}
ORDER BY "primaryMetricValue" DESC NULLS LAST, "resourceCount" DESC;
`,
      {
        replacements: { ...queryParams, usageSupportedServices: familyDef.supportedServices },
        type: QueryTypes.SELECT,
      },
    );
    };

    const hasUtilizationFallback = await this.hasDbUtilizationDailyTable();
    let rows: TableAggregateRow[] = [];
    try {
      rows = await executeUsageTableQuery(hasUtilizationFallback);
    } catch {
      try {
        rows = await executeUsageTableQuery(false);
      } catch {
        if (queryParams.groupBy === "db_engine") {
          try {
            rows = await executeUsageTableQuery(false, "db_engine");
          } catch {
            rows = await executeEmergencyDbEngineTableQuery();
          }
        } else if (queryParams.groupBy === "region") {
          try {
            rows = await executeUsageTableQuery(false, "region");
          } catch {
            rows = await executeEmergencyRegionTableQuery();
          }
        } else if (queryParams.groupBy === "instance_class") {
          rows = await executeEmergencyInstanceClassTableQuery();
        } else if (queryParams.groupBy === "cluster") {
          rows = await executeEmergencyClusterTableQuery();
        } else {
          rows = [];
        }
      }
    }
    if (queryParams.groupBy === "db_engine" && rows.length === 0) {
      try {
        rows = await executeUsageTableQuery(false, "db_engine");
      } catch {
        rows = await executeEmergencyDbEngineTableQuery();
      }
    }
    if (queryParams.groupBy === "region" && rows.length === 0) {
      try {
        rows = await executeUsageTableQuery(false, "region");
      } catch {
        rows = await executeEmergencyRegionTableQuery();
      }
    }
    if (queryParams.groupBy === "instance_class" && rows.length === 0) {
      rows = await executeEmergencyInstanceClassTableQuery();
    }
    if (queryParams.groupBy === "cluster" && rows.length === 0) {
      rows = await executeEmergencyClusterTableQuery();
    }

    const rowsForRanking =
      queryParams.groupBy === "instance_class"
        ? rows.filter((row) => String(row.groupLabel ?? "").trim().toLowerCase() !== "unknown class")
        : queryParams.groupBy === "db_engine"
          ? rows.filter((row) => String(row.groupLabel ?? "").trim().toLowerCase() !== "unknown engine")
        : rows;

    const withRanking = rowsForRanking
      .map((row) => {
        const inScopeResources = toNumber(row.inScopeResources);
        const telemetryCoveredResources = toNumber(row.telemetryCoveredResources);
        const coverageRate = inScopeResources > 0 ? telemetryCoveredResources / inScopeResources : null;
        const coverage: ExplorerCoverageSummary = {
          eligibleResources: inScopeResources,
          coveredResources: telemetryCoveredResources,
          coverageRate,
          confidence: "degraded",
          degraded: coverageRate !== null && coverageRate > 0 && coverageRate < 0.9,
          unavailable: inScopeResources > 0 && telemetryCoveredResources <= 0,
          unsupported: inScopeResources <= 0,
        };
        coverage.confidence = confidenceFromCoverage(coverage);
        return { row, coverage };
      })
      .sort((a, b) => {
        const aRank = toNullableNumber(a.row.primaryMetricValue);
        const bRank = toNullableNumber(b.row.primaryMetricValue);
        if (aRank === null && bRank === null) return 0;
        if (aRank === null) return 1;
        if (bRank === null) return -1;
        return bRank - aRank;
      });

    return withRanking.map(({ row, coverage }, idx) => {
      const primaryMetricValue = toNullableNumber(row.primaryMetricValue);
      const state = usageStateFromCoverage(coverage);
      const reasons: string[] = [];
      if (coverage.eligibleResources < toNumber(row.resourceCount)) {
        reasons.push("Mixed-service scope detected; metrics are aggregated from supported telemetry subset only.");
      }
      if (coverage.unsupported) reasons.push("Unsupported service telemetry for selected capability in this group.");
      if (coverage.unavailable) reasons.push("No telemetry available for selected metric in this group.");
      if (coverage.degraded) reasons.push("Partial telemetry coverage in this group.");
      const rank = primaryMetricValue === null || coverage.confidence === "unsupported" || coverage.confidence === "unavailable"
        ? null
        : idx + 1;
      return {
        group: String(row.groupLabel ?? row.groupKey ?? "Unknown"),
        groupKey: String(row.groupKey ?? ""),
        groupLabel: String(row.groupLabel ?? row.groupKey ?? "Unknown"),
        totalCost: toNumber(row.totalCost),
        computeCost: toNumber(row.computeCost),
        storageCost: toNumber(row.storageCost),
        ioCost: toNumber(row.ioCost),
        backupCost: toNumber(row.backupCost),
        resourceCount: toNumber(row.resourceCount),
        inScopeResources: coverage.eligibleResources,
        telemetryCoveredResources: coverage.coveredResources,
        coverageRate: coverage.coverageRate,
        confidence: coverage.confidence,
        state,
        reasons,
        warnings: reasons,
        primaryMetricValue,
        primaryMetricUnit: familyDef.unitDefaults[selectedUsageMetric] ?? null,
        rankingValue: primaryMetricValue,
        rank,
        avgCpu: toNullableNumber(row.avgCpu),
        peakCpu: toNullableNumber(row.peakCpu),
        avgConnections: toNullableNumber(row.avgConnections),
        peakConnections: toNullableNumber(row.peakConnections),
        readIops: toNullableNumber(row.readIops),
        writeIops: toNullableNumber(row.writeIops),
        totalIops: toNullableNumber(row.totalIops),
        readThroughputBytes: toNullableNumber(row.readThroughputBytes),
        writeThroughputBytes: toNullableNumber(row.writeThroughputBytes),
        totalThroughputBytes: toNullableNumber(row.totalThroughputBytes),
        storageUsedGb: toNullableNumber(row.storageUsedGb),
        allocatedStorageGb: toNullableNumber(row.allocatedStorageGb),
        avgLoad: toNullableNumber(row.avgLoad),
        connections: toNullableNumber(row.connections),
      };
    });
  }

  async getTrendGrouped(params: ExplorerQueryParams): Promise<ExplorerTrendGrouped> {
    const queryParams = buildExplorerReplacements(buildTrendQueryParams(params));
    if (queryParams.groupBy === "cost_category") {
      if (queryParams.metric === "usage") {
        return {
          metric: queryParams.metric,
          groupBy: queryParams.groupBy,
          chartType: "line",
          xKey: "date",
          series: [],
        };
      }
      const drilldownFilters = buildCostHistoryDrilldownFilters(queryParams, "ch");
      const rows = await sequelize.query<CostCategoryGroupedRow>(
        `
SELECT
  ch.usage_date AS date,
  LOWER(BTRIM(COALESCE(ch.cost_category, ''))) AS "groupKey",
  ${COST_CATEGORY_LABEL_CASE} AS "groupLabel",
  COALESCE(SUM(${costHistoryBaseExpression("ch", queryParams.costBasis)}), 0) AS "totalCost"
FROM db_cost_history_daily ch
WHERE ${drilldownFilters}
  AND LOWER(BTRIM(COALESCE(ch.cost_category, ''))) IN (:operationalCostCategories)
GROUP BY ch.usage_date, LOWER(BTRIM(COALESCE(ch.cost_category, ''))), ${COST_CATEGORY_LABEL_CASE}
ORDER BY ch.usage_date ASC;
`,
        {
          replacements: {
            ...queryParams,
            operationalCostCategories: [...OPERATIONAL_COST_CATEGORIES],
          },
          type: QueryTypes.SELECT,
        },
      );
      const bySeries = new Map<string, { key: string; label: string; total: number; points: Array<{ date: string; value: number }> }>();
      for (const row of rows) {
        const date = toDateOnly(row.date as Date | string);
        const rawKey = String(row.groupKey ?? "").trim();
        const key = rawKey.length > 0 ? rawKey : "other";
        const label = String(row.groupLabel ?? "Other").trim() || "Other";
        const value = toNumber(row.totalCost);
        const current = bySeries.get(key) ?? { key, label, total: 0, points: [] };
        current.points.push({ date, value });
        current.total += value;
        bySeries.set(key, current);
      }
      const sorted = [...bySeries.values()].sort((a, b) => b.total - a.total);
      const top = sorted.slice(0, 8);
      const rest = sorted.slice(8);
      const dateSet = new Set<string>();
      for (const series of sorted) for (const point of series.points) dateSet.add(point.date);
      const dates = [...dateSet].sort((a, b) => a.localeCompare(b));
      const outputSeries: ExplorerTrendGroupedSeries[] = top.map((series) => {
        const pointByDate = new Map(series.points.map((point) => [point.date, point.value]));
        return {
          key: series.key,
          label: series.label,
          total: series.total,
          data: dates.map((date) => ({ date, value: pointByDate.get(date) ?? 0 })),
        };
      });
      if (rest.length > 0) {
        const otherByDate = new Map<string, number>();
        let otherTotal = 0;
        for (const series of rest) {
          otherTotal += series.total;
          for (const point of series.points) otherByDate.set(point.date, (otherByDate.get(point.date) ?? 0) + point.value);
        }
        outputSeries.push({
          key: "other",
          label: "Other",
          total: otherTotal,
          data: dates.map((date) => ({ date, value: otherByDate.get(date) ?? 0 })),
        });
      }
      return {
        metric: queryParams.metric,
        groupBy: queryParams.groupBy,
        chartType: "stacked_bar",
        xKey: "date",
        series: outputSeries,
      };
    }

    if (queryParams.metric === "cost") {
      const groupBy = GROUP_BY_COLUMNS[queryParams.groupBy];
      const unknownLabel = GROUPED_UNKNOWN_LABELS[queryParams.groupBy];
      const withInventory = groupBy.requiresInventory;
      const withRegion = groupBy.requiresRegion;
      const factGroupedValuesFilter = buildGroupedValuesFilter(queryParams, "fact", "f", {
        withInventory,
        withRegion,
      });
      const excludeUnknownResourceType =
        queryParams.groupBy === "resource_type"
          ? `  AND ${resourceTypeCanonicalExpression("f")} <> 'unknown resource type'`
          : "";

      const rows = await sequelize.query<GroupedTrendAggregateRow>(
        `
${withInventory ? `WITH ${latestInventoryCteSql}` : ""}
SELECT
  ch.usage_date AS date,
  ${groupBy.keyExpression}::text AS "groupKey",
  ${groupBy.selectExpression} AS "groupLabel",
  COALESCE(SUM(${costHistoryBaseExpression("ch", queryParams.costBasis)}), 0) AS value
FROM db_cost_history_daily ch
JOIN fact_db_resource_daily f
  ON f.tenant_id = ch.tenant_id
 AND f.usage_date = ch.usage_date
 AND f.resource_id = ch.resource_id
 AND f.cloud_connection_id IS NOT DISTINCT FROM ch.cloud_connection_id
${withRegion ? "LEFT JOIN dim_region dr ON dr.id = f.region_key" : ""}
${withInventory ? `LEFT JOIN latest_inventory li
  ON li.tenant_id = f.tenant_id
 AND li.resource_id = f.resource_id
 AND li.cloud_connection_id IS NOT DISTINCT FROM f.cloud_connection_id` : ""}
WHERE ${buildCostHistoryDrilldownFilters(queryParams, "ch")}
${factGroupedValuesFilter ? `  AND ${factGroupedValuesFilter}` : ""}
${excludeUnknownResourceType}
GROUP BY ch.usage_date, ${groupBy.groupExpression}, ${groupBy.keyExpression}
ORDER BY ch.usage_date ASC;
`,
        {
          replacements: queryParams,
          type: QueryTypes.SELECT,
        },
      );

      const bySeries = new Map<string, { key: string; label: string; total: number; points: Array<{ date: string; value: number }> }>();
      for (const row of rows) {
        const date = toDateOnly(row.date);
        const rawKey = String(row.groupKey ?? "").trim();
        const rawLabel = String(row.groupLabel ?? "").trim();
        const label = rawLabel.length > 0 ? rawLabel : unknownLabel;
        const key = rawKey.length > 0 ? rawKey : `unknown-${queryParams.groupBy}`;
        const value = toNumber(row.value);
        const current = bySeries.get(key) ?? { key, label, total: 0, points: [] };
        current.points.push({ date, value });
        current.total += value;
        bySeries.set(key, current);
      }

      const sorted = [...bySeries.values()].sort((a, b) => b.total - a.total);
      const top = sorted.slice(0, 8);
      const rest = sorted.slice(8);
      const dateSet = new Set<string>();
      for (const series of sorted) {
        for (const point of series.points) dateSet.add(point.date);
      }
      const dates = [...dateSet].sort((a, b) => a.localeCompare(b));
      const outputSeries: ExplorerTrendGroupedSeries[] = top.map((series) => {
        const pointByDate = new Map(series.points.map((point) => [point.date, point.value]));
        return {
          key: series.key,
          label: series.label,
          total: series.total,
          data: dates.map((date) => ({ date, value: pointByDate.get(date) ?? 0 })),
        };
      });
      if (rest.length > 0) {
        const otherByDate = new Map<string, number>();
        let otherTotal = 0;
        for (const series of rest) {
          otherTotal += series.total;
          for (const point of series.points) {
            otherByDate.set(point.date, (otherByDate.get(point.date) ?? 0) + point.value);
          }
        }
        outputSeries.push({
          key: "other",
          label: "Other",
          total: otherTotal,
          data: dates.map((date) => ({ date, value: otherByDate.get(date) ?? 0 })),
        });
      }

      return {
        metric: queryParams.metric,
        groupBy: queryParams.groupBy,
        chartType: "stacked_bar",
        xKey: "date",
        series: outputSeries,
      };
    }

    const groupBy = GROUP_BY_COLUMNS[queryParams.groupBy];
    const filters = buildResourceDrilldownFilters(queryParams, "f");
    const unknownLabel = GROUPED_UNKNOWN_LABELS[queryParams.groupBy];
    const isUsage = queryParams.metric === "usage";
    const withInventory = groupBy.requiresInventory;
    const withRegion = groupBy.requiresRegion;

    const selectedUsageMetric: UsageMetric = queryParams.usageMetric ?? "avg_cpu";
    const selectedFamily = queryParams.capabilityFamily ?? "compute_pressure";
    const familyDef = USAGE_CAPABILITY_REGISTRY[selectedFamily];
    const hasUtilizationFallback = isUsage ? await this.hasDbUtilizationDailyTable() : false;
    const valueExpression = isUsage
      ? `AVG(${hasUtilizationFallback ? usageMetricSqlWithFallback(selectedUsageMetric, "f", "u") : usageMetricSql(selectedUsageMetric, "f")})`
      : `COALESCE(SUM(${factTotalCostExpression("f", queryParams.costBasis)}), 0)`;

    const rows = await sequelize.query<GroupedTrendAggregateRow>(
      `
${withInventory ? `WITH ${latestInventoryCteSql}` : ""}
SELECT
  f.usage_date AS date,
  ${groupBy.keyExpression}::text AS "groupKey",
  ${groupBy.selectExpression} AS "groupLabel",
  ${valueExpression} AS value
${fromFactBaseSql({ withInventory, withRegion })}
${isUsage && hasUtilizationFallback ? `LEFT JOIN db_utilization_daily u
  ON u.tenant_id = f.tenant_id
 AND u.usage_date = f.usage_date
 AND u.resource_id = f.resource_id
 AND u.cloud_connection_id IS NOT DISTINCT FROM f.cloud_connection_id` : ""}
WHERE ${filters}
${isUsage ? `  AND ${usageServicePredicateSql("f")}` : ""}
GROUP BY f.usage_date, ${groupBy.groupExpression}, ${groupBy.keyExpression}
ORDER BY f.usage_date ASC;
`,
      {
        replacements: isUsage
          ? { ...queryParams, usageSupportedServices: familyDef.supportedServices }
          : queryParams,
        type: QueryTypes.SELECT,
      },
    );

    const bySeries = new Map<string, { key: string; label: string; total: number; points: Array<{ date: string; value: number | null }> }>();
    for (const row of rows) {
      const date = toDateOnly(row.date);
      const rawKey = String(row.groupKey ?? "").trim();
      const rawLabel = String(row.groupLabel ?? "").trim();
      const label = rawLabel.length > 0 ? rawLabel : unknownLabel;
      const key = rawKey.length > 0 ? rawKey : `unknown-${queryParams.groupBy}`;
      if (isUnknownInstanceClassGroup(queryParams.groupBy, key, label)) continue;
      if (isUnknownDbEngineGroup(queryParams.groupBy, key, label)) continue;
      const value = isUsage ? toNullableNumber(row.value) : toNumber(row.value);
      const current = bySeries.get(key) ?? { key, label, total: 0, points: [] };
      current.points.push({ date, value });
      if (value !== null) current.total += value;
      bySeries.set(key, current);
    }

    const sorted = [...bySeries.values()].sort((a, b) => b.total - a.total);
    const top = sorted.slice(0, 8);
    const rest = sorted.slice(8);
    const includeOther = rest.length > 0;
    const dateSet = new Set<string>();
    for (const series of sorted) {
      for (const point of series.points) dateSet.add(point.date);
    }
    const dates = [...dateSet].sort((a, b) => a.localeCompare(b));

    const fillSeries = (series: { key: string; label: string; total: number; points: Array<{ date: string; value: number | null }> }): ExplorerTrendGroupedSeries => {
      const pointByDate = new Map(series.points.map((point) => [point.date, point.value]));
      return {
        key: series.key,
        label: series.label,
        total: series.total,
        data: dates.map((date) => ({
          date,
          value: pointByDate.has(date) ? (pointByDate.get(date) ?? null) : (isUsage ? null : 0),
        })),
      };
    };

    const outputSeries: ExplorerTrendGroupedSeries[] = top.map(fillSeries);

    if (includeOther) {
      const otherByDate = new Map<string, number>();
      let otherTotal = 0;
      for (const series of rest) {
        otherTotal += series.total;
        for (const point of series.points) {
          if (point.value !== null) {
            otherByDate.set(point.date, (otherByDate.get(point.date) ?? 0) + point.value);
          }
        }
      }
      outputSeries.push({
        key: "other",
        label: "Other",
        total: otherTotal,
        data: dates.map((date) => ({
          date,
          value: otherByDate.has(date) ? (otherByDate.get(date) ?? null) : (isUsage ? null : 0),
        })),
      });
    }

    const coverageSummary = isUsage
      ? await this.computeUsageCoverageSummary(queryParams, selectedFamily, selectedUsageMetric)
      : undefined;
    const warningMessages = isUsage ? (await this.getUsageWarnings(queryParams)).map((warning) => warning.message) : undefined;

    return {
      metric: queryParams.metric,
      groupBy: queryParams.groupBy,
      chartType: isUsage ? "line" : "stacked_bar",
      xKey: "date",
      capabilityFamily: isUsage ? selectedFamily : undefined,
      usageMetric: isUsage ? selectedUsageMetric : undefined,
      unit: isUsage ? (familyDef.unitDefaults[selectedUsageMetric] ?? null) : undefined,
      coverageSummary,
      warnings: warningMessages,
      series: outputSeries,
    };
  }
}
