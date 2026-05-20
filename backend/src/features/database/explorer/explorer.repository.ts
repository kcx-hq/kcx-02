import { QueryTypes } from "sequelize";

import { BadRequestError } from "../../../errors/http-errors.js";
import { sequelize } from "../../../models/index.js";
import {
  buildExplorerScopeReplacements,
  buildScopeDiscoveryFilters,
  servicesToAvailableDatabaseScopes,
} from "./explorer.database-scope.js";
import type {
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
  ExplorerUsageTrendItem,
} from "./explorer.types.js";

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
  load: string | number | null;
  connections: string | number | null;
};

type TableAggregateRow = {
  group: string | number | null;
  totalCost: string | number | null;
  computeCost: string | number | null;
  storageCost: string | number | null;
  ioCost: string | number | null;
  backupCost: string | number | null;
  resourceCount: string | number | null;
  avgLoad: string | number | null;
  connections: string | number | null;
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
    filters.push(`${pref}db_engine = :dbEngine`);
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
    filters.push(`${pref}db_engine = :dbEngine`);
  }

  return filters.join("\n    AND ");
};

const groupedExpressionForFact = (groupBy: ExplorerGroupBy): string | null => {
  if (groupBy === "cost_category") return null;
  return GROUP_BY_COLUMNS[groupBy].selectExpression;
};

const groupedExpressionForCostHistory = (groupBy: ExplorerGroupBy): string | null => {
  if (groupBy !== "cost_category") return null;
  return COST_CATEGORY_LABEL_CASE;
};

const buildGroupedValuesFilter = (
  params: ExplorerQueryParams,
  source: "fact" | "cost_history",
  tableAlias = "",
): string | null => {
  if (!Array.isArray(params.groupValues) || params.groupValues.length === 0) {
    return null;
  }

  const expression = source === "fact" ? groupedExpressionForFact(params.groupBy) : groupedExpressionForCostHistory(params.groupBy);
  if (!expression) {
    return null;
  }

  const trimmed = [...new Set(params.groupValues.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0))];
  if (trimmed.length === 0) {
    return null;
  }

  params.groupValues = trimmed;

  if (source === "fact" && tableAlias) {
    const expr = expression.replaceAll("f.", `${tableAlias}.`);
    return `LOWER(BTRIM(${expr})) IN (:groupValues)`;
  }

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
    selectExpression: "COALESCE(NULLIF(BTRIM(f.resource_type), ''), 'Unknown resource type')",
    groupExpression: "COALESCE(NULLIF(BTRIM(f.resource_type), ''), 'Unknown resource type')",
    keyExpression: "COALESCE(NULLIF(BTRIM(f.resource_type), ''), 'unknown-resource-type')",
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

const COST_CATEGORY_LABEL_CASE = `
CASE
  WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'compute' THEN 'Compute'
  WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'storage' THEN 'Storage'
  WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'io' THEN 'I/O'
  WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'backup' THEN 'Backup'
  WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'data_transfer' THEN 'Data Transfer'
  WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'tax' THEN 'Tax'
  WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'credit' THEN 'Credit'
  WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'refund' THEN 'Refund'
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
  const base = `${buildTrendFilters(params, tableAlias)}
    AND COALESCE(LOWER(BTRIM(${pref}resource_type)), '') <> 'scoped'
    AND ${pref}resource_id NOT LIKE 'db-scope:%'`;
  const groupedValuesFilter = buildGroupedValuesFilter(params, "fact", tableAlias || "fact_db_resource_daily");
  const resourceTypeValues = normalizeFilterValues(params.resourceTypeValues);
  const resourceTypeFilter = resourceTypeValues.length > 0
    ? `LOWER(BTRIM(COALESCE(${pref}resource_type, ''))) IN (:resourceTypeValues)`
    : null;
  const parts = [base];
  if (groupedValuesFilter) parts.push(groupedValuesFilter);
  if (resourceTypeFilter) {
    params.resourceTypeValues = resourceTypeValues;
    parts.push(resourceTypeFilter);
  }
  return `${parts[0]}${parts.slice(1).map((part) => `\n    AND ${part}`).join("")}`;
};

const buildCostHistoryDrilldownFilters = (params: ExplorerQueryParams, tableAlias = ""): string => {
  const pref = tableAlias ? `${tableAlias}.` : "";
  const base = `${buildTrendFilters(params, tableAlias)}
    AND ${pref}resource_id NOT LIKE 'db-scope:%'
    AND ${pref}resource_id NOT LIKE 'db-unattributed:%'`;
  const groupedValuesFilter = buildGroupedValuesFilter(params, "cost_history", tableAlias);
  const costCategoryValues = normalizeFilterValues(params.costCategoryValues);
  const costCategoryFilter = costCategoryValues.length > 0
    ? `LOWER(BTRIM(COALESCE(${pref}cost_category, ''))) IN (:costCategoryValues)`
    : null;
  const parts = [base];
  if (groupedValuesFilter) parts.push(groupedValuesFilter);
  if (costCategoryFilter) {
    params.costCategoryValues = costCategoryValues;
    parts.push(costCategoryFilter);
  }
  return `${parts[0]}${parts.slice(1).map((part) => `\n    AND ${part}`).join("")}`;
};

export class DatabaseExplorerRepository {
  async getFilterOptions(params: ExplorerQueryParams): Promise<ExplorerFilterOptions> {
    const queryParams = buildExplorerReplacements(buildTrendQueryParams(params));
    const filters = buildFilterOptionsFilters(queryParams);

    const discoveryParams = buildExplorerReplacements(
      buildTrendQueryParams({
        ...params,
        databaseScope: "all",
      }),
    );
    const discoveryFilters = buildScopeDiscoveryFilters(discoveryParams);

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
WHERE ${filters}
  AND ${buildDbServiceDisplaySql("f")} <> 'Unknown service'
ORDER BY value ASC;
`,
        {
          replacements: queryParams,
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
WHERE ${buildTrendFilters(queryParams, "f")}
  AND COALESCE(
    NULLIF(NULLIF(LOWER(BTRIM(f.db_engine)), 'unknown'), ''),
    NULLIF(LOWER(BTRIM(li.db_engine)), '')
  ) IS NOT NULL
ORDER BY value ASC;
`,
        {
          replacements: queryParams,
          type: QueryTypes.SELECT,
        },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
SELECT DISTINCT
  COALESCE(NULLIF(BTRIM(dr.region_id), ''), NULLIF(BTRIM(dr.region_name), ''), 'Unknown region') AS value
FROM fact_db_resource_daily f
LEFT JOIN dim_region dr ON dr.id = f.region_key
WHERE ${buildTrendFilters(queryParams, "f")}
ORDER BY value ASC;
`,
        { replacements: queryParams, type: QueryTypes.SELECT },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
SELECT DISTINCT COALESCE(NULLIF(BTRIM(f.resource_type), ''), 'Unknown resource type') AS value
FROM fact_db_resource_daily f
WHERE ${buildTrendFilters(queryParams, "f")}
ORDER BY value ASC;
`,
        { replacements: queryParams, type: QueryTypes.SELECT },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
WITH ${latestInventoryCteSql}
SELECT DISTINCT COALESCE(NULLIF(BTRIM(li.instance_class), ''), 'Unknown class') AS value
${fromFactBaseSql({ withInventory: true, withRegion: false })}
WHERE ${buildResourceDrilldownFilters(queryParams, "f")}
ORDER BY value ASC;
`,
        { replacements: queryParams, type: QueryTypes.SELECT },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
WITH ${latestInventoryCteSql}
SELECT DISTINCT COALESCE(NULLIF(BTRIM(f.cluster_id), ''), NULLIF(BTRIM(li.cluster_id), ''), 'Standalone / No cluster') AS value
${fromFactBaseSql({ withInventory: true, withRegion: false })}
WHERE ${buildResourceDrilldownFilters(queryParams, "f")}
ORDER BY value ASC;
`,
        { replacements: queryParams, type: QueryTypes.SELECT },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
SELECT DISTINCT ${COST_CATEGORY_LABEL_CASE} AS value
FROM db_cost_history_daily ch
WHERE ${buildCostHistoryDrilldownFilters(queryParams, "ch")}
ORDER BY value ASC;
`,
        { replacements: queryParams, type: QueryTypes.SELECT },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
SELECT DISTINCT
  ${buildDbServiceDisplaySql("f")} AS value
FROM fact_db_resource_daily f
WHERE ${buildTrendFilters(queryParams, "f")}
  AND ${buildDbServiceDisplaySql("f")} <> 'Unknown service'
ORDER BY value ASC;
`,
        { replacements: queryParams, type: QueryTypes.SELECT },
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
        instance_class: instanceClassRows.map((row) => (typeof row.value === "string" ? row.value.trim() : "")).filter((value) => value.length > 0),
        cluster: clusterRows.map((row) => (typeof row.value === "string" ? row.value.trim() : "")).filter((value) => value.length > 0),
        cost_category: costCategoryRows.map((row) => (typeof row.value === "string" ? row.value.trim() : "")).filter((value) => value.length > 0),
      },
      availableDatabaseScopes: servicesToAvailableDatabaseScopes(discoveryServices),
    };
  }

  async getCards(params: ExplorerQueryParams): Promise<ExplorerKpiCard[]> {
    const previousPeriod = getPreviousPeriod(params);
    const queryParams = buildExplorerReplacements({
      ...params,
      startDate: toUtcDateOnly(params.startDate, "start_date"),
      endDate: toUtcDateOnly(params.endDate, "end_date"),
      ...previousPeriod,
    });
    const currentFilters = buildFactFilters(queryParams, "current");
    const previousFilters = buildFactFilters(queryParams, "previous");

    const rows = await sequelize.query<CardsAggregateRow>(
      `
WITH current_period AS (
  SELECT
    COALESCE(SUM(${factTotalCostExpression("", queryParams.costBasis)}), 0) AS "totalCost",
    COUNT(DISTINCT resource_id) AS "activeResources",
    COALESCE(SUM(data_footprint_gb), 0) AS "dataFootprintGb",
    AVG(COALESCE(load_avg, cpu_avg)) AS "avgLoad",
    AVG(connections_avg) AS "connections",
    COUNT(*) AS "totalRows",
    COUNT(*) FILTER (WHERE COALESCE(load_avg, cpu_avg) IS NOT NULL) AS "usageRowsWithLoad",
    COUNT(*) FILTER (WHERE connections_avg IS NOT NULL) AS "usageRowsWithConnections",
    COUNT(*) FILTER (WHERE data_footprint_gb IS NOT NULL) AS "usageRowsWithStorage"
  FROM fact_db_resource_daily
  WHERE ${currentFilters}
),
previous_period AS (
  SELECT
    COALESCE(SUM(${factTotalCostExpression("", queryParams.costBasis)}), 0) AS "previousCost"
  FROM fact_db_resource_daily
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

    const totalCost = toNumber(row.totalCost);
    const previousCost = toNumber(row.previousCost);
    const costTrend = previousCost === 0 ? null : (totalCost - previousCost) / previousCost;
    const activeResources = toNumber(row.activeResources);
    const dataFootprintGb = toNumber(row.dataFootprintGb);
    const connections = toNullableNumber(row.connections);
    const totalRows = toNumber(row.totalRows);
    const loadRows = toNumber(row.usageRowsWithLoad);
    const connectionRows = toNumber(row.usageRowsWithConnections);
    const storageRows = toNumber(row.usageRowsWithStorage);

    if (params.metric === "cost") {
      const topTableRows = await this.getTable({ ...params, metric: "cost", groupBy: "db_service" });
      const topRegionRows = await this.getTable({ ...params, metric: "cost", groupBy: "region" });
      const topCostCategoryRows = await this.getTable({ ...params, metric: "cost", groupBy: "cost_category" });
      const topCostDriver = topCostCategoryRows[0];
      const topService = topTableRows[0];
      const topRegion = topRegionRows[0];
      const isEmpty = activeResources <= 0 && totalCost <= 0;

      return [
        {
          id: "total_database_spend",
          title: "Total Database Spend",
          value: formatCurrency(totalCost),
          subValue: `Active resources: ${formatInteger(activeResources)}`,
          state: isEmpty ? "empty" : "normal",
          note: "Source: db_cost_history_daily / fact_db_resource_daily",
        },
        {
          id: "cost_trend_pct",
          title: "Cost Trend %",
          value: costTrend === null ? "N/A" : formatPercent(costTrend),
          subValue: previousCost === 0 ? "No previous-period baseline" : `Previous period: ${formatCurrency(previousCost)}`,
          trend: {
            value: costTrend,
            direction: costTrend === null ? "unknown" : costTrend > 0 ? "up" : costTrend < 0 ? "down" : "flat",
          },
          state: previousCost === 0 ? (isEmpty ? "empty" : "partial") : "normal",
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
        subValue: peakLoad === null ? "No load telemetry" : `Peak avg load: ${formatCompact(peakLoad)}`,
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

  async getTrend(params: ExplorerQueryParams): Promise<ExplorerTrendItem[]> {
    const queryParams = buildExplorerReplacements(buildTrendQueryParams(params));
    const filters = buildTrendFilters(queryParams);

    if (queryParams.metric === "usage") {
      const groupedValuesFilter = buildGroupedValuesFilter(queryParams, "fact", "f");
      const usageFilters = groupedValuesFilter ? `${filters}\n  AND ${groupedValuesFilter}` : filters;
      const rows = await sequelize.query<UsageTrendRow>(
        `
SELECT
  f.usage_date AS date,
  AVG(COALESCE(f.load_avg, f.cpu_avg)) AS load,
  AVG(f.connections_avg) AS connections
FROM fact_db_resource_daily f
WHERE ${usageFilters}
  AND (f.load_avg IS NOT NULL OR f.cpu_avg IS NOT NULL OR f.connections_avg IS NOT NULL)
GROUP BY f.usage_date
ORDER BY f.usage_date ASC;
`,
        {
          replacements: queryParams,
          type: QueryTypes.SELECT,
        },
      );

      return rows.map((row) => ({
        date: toDateOnly(row.date),
        load: toNullableNumber(row.load),
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
SELECT
  ${COST_CATEGORY_LABEL_CASE} AS "group",
  COALESCE(SUM(${costHistoryBaseExpression("ch", queryParams.costBasis)}), 0) AS "totalCost",
  COUNT(DISTINCT ch.resource_id) AS "resourceCount"
FROM db_cost_history_daily ch
WHERE ${drilldownFilters}
GROUP BY ${COST_CATEGORY_LABEL_CASE}
ORDER BY "totalCost" DESC;
`,
        {
          replacements: queryParams,
          type: QueryTypes.SELECT,
        },
      );
      return rows.map((row) => ({
        group: String(row.group ?? row.groupLabel ?? row.groupKey ?? "Other"),
        totalCost: toNumber(row.totalCost),
        computeCost: 0,
        storageCost: 0,
        ioCost: 0,
        backupCost: 0,
        resourceCount: toNumber(row.resourceCount),
        avgLoad: null,
        connections: null,
      }));
    }

    const groupBy = GROUP_BY_COLUMNS[queryParams.groupBy];
    const filters = buildResourceDrilldownFilters(queryParams, "f");
    const withInventory = groupBy.requiresInventory;
    const withRegion = groupBy.requiresRegion;

    const rows = await sequelize.query<TableAggregateRow>(
      `
${withInventory ? `WITH ${latestInventoryCteSql}` : ""}
SELECT
  ${groupBy.selectExpression} AS "group",
  COALESCE(SUM(${factTotalCostExpression("f", queryParams.costBasis)}), 0) AS "totalCost",
  COALESCE(SUM(f.compute_cost), 0) AS "computeCost",
  COALESCE(SUM(f.storage_cost), 0) AS "storageCost",
  COALESCE(SUM(f.io_cost), 0) AS "ioCost",
  COALESCE(SUM(f.backup_cost), 0) AS "backupCost",
  COUNT(DISTINCT f.resource_id) AS "resourceCount",
  AVG(COALESCE(f.load_avg, f.cpu_avg)) AS "avgLoad",
  AVG(f.connections_avg) AS "connections"
${fromFactBaseSql({ withInventory, withRegion })}
WHERE ${filters}
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

    const groupBy = GROUP_BY_COLUMNS[queryParams.groupBy];
    const filters = buildResourceDrilldownFilters(queryParams, "f");
    const unknownLabel = GROUPED_UNKNOWN_LABELS[queryParams.groupBy];
    const isUsage = queryParams.metric === "usage";
    const withInventory = groupBy.requiresInventory;
    const withRegion = groupBy.requiresRegion;

    const valueExpression = isUsage
      ? "AVG(COALESCE(f.load_avg, f.cpu_avg))"
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
WHERE ${filters}
GROUP BY f.usage_date, ${groupBy.groupExpression}, ${groupBy.keyExpression}
ORDER BY f.usage_date ASC;
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
    const includeOther = rest.length > 0;
    const dateSet = new Set<string>();
    for (const series of sorted) {
      for (const point of series.points) dateSet.add(point.date);
    }
    const dates = [...dateSet].sort((a, b) => a.localeCompare(b));

    const fillSeries = (series: { key: string; label: string; total: number; points: Array<{ date: string; value: number }> }): ExplorerTrendGroupedSeries => {
      const pointByDate = new Map(series.points.map((point) => [point.date, point.value]));
      return {
        key: series.key,
        label: series.label,
        total: series.total,
        data: dates.map((date) => ({
          date,
          value: pointByDate.get(date) ?? 0,
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
      chartType: isUsage ? "line" : "stacked_bar",
      xKey: "date",
      usageMetric: isUsage ? "load_avg" : undefined,
      series: outputSeries,
    };
  }
}
