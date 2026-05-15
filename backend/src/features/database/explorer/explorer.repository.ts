import { QueryTypes } from "sequelize";

import { BadRequestError } from "../../../errors/http-errors.js";
import { sequelize } from "../../../models/index.js";
import {
  buildExplorerScopeReplacements,
  buildScopeDiscoveryFilters,
  servicesToAvailableDatabaseScopes,
} from "./explorer.database-scope.js";
import type {
  ExplorerCards,
  ExplorerFilterOptions,
  ExplorerGroupBy,
  ExplorerQueryParams,
  ExplorerTableRow,
  ExplorerTrendGrouped,
  ExplorerTrendGroupedSeries,
  ExplorerTrendItem,
} from "./explorer.types.js";

const EMPTY_CARDS: ExplorerCards = {
  totalCost: 0,
  costTrendPct: null,
  activeResources: 0,
  dataFootprintGb: 0,
  avgLoad: null,
  connections: null,
};

type CardsAggregateRow = {
  totalCost: string | number | null;
  activeResources: string | number | null;
  dataFootprintGb: string | number | null;
  avgLoad: string | number | null;
  connections: string | number | null;
  previousCost: string | number | null;
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
    const normalizedService = params.dbService.trim().toLowerCase();
    if (normalizedService.includes("aurora")) {
      filters.push(
        `(${pref}db_service = 'AmazonRDS' AND LOWER(COALESCE(${pref}db_engine, '')) LIKE 'aurora%')`,
      );
    } else if (normalizedService === "amazon rds" || normalizedService === "amazonrds") {
      filters.push(
        `(${pref}db_service = 'AmazonRDS' AND LOWER(COALESCE(${pref}db_engine, '')) NOT LIKE 'aurora%')`,
      );
    } else {
      filters.push(`${pref}db_service = :dbService`);
    }
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
    const normalizedService = params.dbService.trim().toLowerCase();
    if (normalizedService.includes("aurora")) {
      filters.push(
        `(${pref}db_service = 'AmazonRDS' AND LOWER(COALESCE(${pref}db_engine, '')) LIKE 'aurora%')`,
      );
    } else if (normalizedService === "amazon rds" || normalizedService === "amazonrds") {
      filters.push(
        `(${pref}db_service = 'AmazonRDS' AND LOWER(COALESCE(${pref}db_engine, '')) NOT LIKE 'aurora%')`,
      );
    } else {
      filters.push(`${pref}db_service = :dbService`);
    }
  }

  if (params.databaseScope && params.databaseScope !== "all") {
    filters.push(`${pref}db_service IN (:scopeDbServices)`);
  }

  if (params.dbEngine) {
    filters.push(`${pref}db_engine = :dbEngine`);
  }

  return filters.join("\n    AND ");
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
  db_type: {
    selectExpression: DB_TYPE_CLASSIFICATION_CASE,
    groupExpression: DB_TYPE_CLASSIFICATION_CASE,
    keyExpression:
      "COALESCE(NULLIF(LOWER(REGEXP_REPLACE((" + DB_TYPE_CLASSIFICATION_CASE + "), '[^a-z0-9]+', '-', 'g')), ''), 'unknown-database-type')",
    requiresInventory: false,
    requiresRegion: false,
  },
  db_service: {
    selectExpression: `CASE
      WHEN LOWER(COALESCE(f.db_engine, '')) LIKE 'aurora%' THEN 'Amazon Aurora'
      WHEN COALESCE(NULLIF(BTRIM(f.db_service), ''), '') <> '' THEN 'Amazon RDS'
      ELSE 'Unknown service'
    END`,
    groupExpression: `CASE
      WHEN LOWER(COALESCE(f.db_engine, '')) LIKE 'aurora%' THEN 'Amazon Aurora'
      WHEN COALESCE(NULLIF(BTRIM(f.db_service), ''), '') <> '' THEN 'Amazon RDS'
      ELSE 'Unknown service'
    END`,
    keyExpression: `CASE
      WHEN LOWER(COALESCE(f.db_engine, '')) LIKE 'aurora%' THEN 'amazon-aurora'
      WHEN COALESCE(NULLIF(BTRIM(f.db_service), ''), '') <> '' THEN 'amazon-rds'
      ELSE 'unknown-service'
    END`,
    requiresInventory: false,
    requiresRegion: false,
  },
  db_engine: {
    selectExpression: "COALESCE(NULLIF(BTRIM(f.db_engine), ''), 'Unknown engine')",
    groupExpression: "COALESCE(NULLIF(BTRIM(f.db_engine), ''), 'Unknown engine')",
    keyExpression: "COALESCE(NULLIF(BTRIM(f.db_engine), ''), 'unknown-engine')",
    requiresInventory: false,
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
  db_type: "Unknown database type",
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

const buildResourceDrilldownFilters = (params: ExplorerQueryParams, tableAlias = ""): string => {
  const pref = tableAlias ? `${tableAlias}.` : "";
  return `${buildTrendFilters(params, tableAlias)}
    AND COALESCE(LOWER(BTRIM(${pref}resource_type)), '') <> 'scoped'
    AND ${pref}resource_id NOT LIKE 'db-scope:%'`;
};

const buildCostHistoryDrilldownFilters = (params: ExplorerQueryParams, tableAlias = ""): string => {
  const pref = tableAlias ? `${tableAlias}.` : "";
  return `${buildTrendFilters(params, tableAlias)}
    AND ${pref}resource_id NOT LIKE 'db-scope:%'
    AND ${pref}resource_id NOT LIKE 'db-unattributed:%'`;
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

    const [discoveryServiceRows, serviceRows, engineRows, regionRows, resourceTypeRows, instanceClassRows, clusterRows, costCategoryRows, dbTypeRows, dbServicePreviewRows] = await Promise.all([
      sequelize.query<FilterOptionValueRow>(
        `
SELECT DISTINCT db_service AS value
FROM fact_db_resource_daily
WHERE ${discoveryFilters}
  AND db_service IS NOT NULL
  AND BTRIM(db_service) <> ''
ORDER BY value ASC;
`,
        {
          replacements: discoveryParams,
          type: QueryTypes.SELECT,
        },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
SELECT DISTINCT db_service AS value
FROM fact_db_resource_daily
WHERE ${filters}
  AND db_service IS NOT NULL
  AND BTRIM(db_service) <> ''
ORDER BY value ASC;
`,
        {
          replacements: queryParams,
          type: QueryTypes.SELECT,
        },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
SELECT DISTINCT db_engine AS value
FROM fact_db_resource_daily
WHERE ${filters}
  AND db_engine IS NOT NULL
  AND BTRIM(db_engine) <> ''
  AND LOWER(BTRIM(db_engine)) <> 'unknown'
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
SELECT DISTINCT ${DB_TYPE_CLASSIFICATION_CASE} AS value
FROM fact_db_resource_daily f
WHERE ${buildTrendFilters(queryParams, "f")}
ORDER BY value ASC;
`,
        { replacements: queryParams, type: QueryTypes.SELECT },
      ),
      sequelize.query<FilterOptionValueRow>(
        `
SELECT DISTINCT
  CASE
    WHEN LOWER(COALESCE(f.db_engine, '')) LIKE 'aurora%' THEN 'Amazon Aurora'
    WHEN COALESCE(NULLIF(BTRIM(f.db_service), ''), '') <> '' THEN 'Amazon RDS'
    ELSE 'Unknown service'
  END AS value
FROM fact_db_resource_daily f
WHERE ${buildTrendFilters(queryParams, "f")}
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
        db_type: dbTypeRows.map((row) => (typeof row.value === "string" ? row.value.trim() : "")).filter((value) => value.length > 0),
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

  async getCards(params: ExplorerQueryParams): Promise<ExplorerCards> {
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
    COALESCE(SUM(total_billed_cost), 0) AS "totalCost",
    COUNT(DISTINCT resource_id) AS "activeResources",
    COALESCE(SUM(data_footprint_gb), 0) AS "dataFootprintGb",
    AVG(load_avg) AS "avgLoad",
    AVG(connections_avg) AS "connections"
  FROM fact_db_resource_daily
  WHERE ${currentFilters}
),
previous_period AS (
  SELECT
    COALESCE(SUM(total_billed_cost), 0) AS "previousCost"
  FROM fact_db_resource_daily
  WHERE ${previousFilters}
)
SELECT
  current_period."totalCost",
  current_period."activeResources",
  current_period."dataFootprintGb",
  current_period."avgLoad",
  current_period."connections",
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
      return EMPTY_CARDS;
    }

    const totalCost = toNumber(row.totalCost);
    const previousCost = toNumber(row.previousCost);

    return {
      totalCost,
      costTrendPct: previousCost === 0 ? null : (totalCost - previousCost) / previousCost,
      activeResources: toNumber(row.activeResources),
      dataFootprintGb: toNumber(row.dataFootprintGb),
      avgLoad: toNullableNumber(row.avgLoad),
      connections: toNullableNumber(row.connections),
    };
  }

  async getTrend(params: ExplorerQueryParams): Promise<ExplorerTrendItem[]> {
    const queryParams = buildExplorerReplacements(buildTrendQueryParams(params));
    const filters = buildTrendFilters(queryParams);

    if (queryParams.metric === "usage") {
      const rows = await sequelize.query<UsageTrendRow>(
        `
SELECT
  usage_date AS date,
  AVG(load_avg) AS load,
  AVG(connections_avg) AS connections
FROM fact_db_resource_daily
WHERE ${filters}
  AND (load_avg IS NOT NULL OR connections_avg IS NOT NULL)
GROUP BY usage_date
ORDER BY usage_date ASC;
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
  COALESCE(SUM(CASE WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'compute' THEN ch.billed_cost ELSE 0 END), 0) AS compute,
  COALESCE(SUM(CASE WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'storage' THEN ch.billed_cost ELSE 0 END), 0) AS storage,
  COALESCE(SUM(CASE WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'io' THEN ch.billed_cost ELSE 0 END), 0) AS io,
  COALESCE(SUM(CASE WHEN LOWER(BTRIM(COALESCE(ch.cost_category, ''))) = 'backup' THEN ch.billed_cost ELSE 0 END), 0) AS backup,
  COALESCE(SUM(ch.billed_cost), 0) AS total
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
  COALESCE(SUM(ch.billed_cost), 0) AS "totalCost",
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
  COALESCE(SUM(f.total_billed_cost), 0) AS "totalCost",
  COALESCE(SUM(f.compute_cost), 0) AS "computeCost",
  COALESCE(SUM(f.storage_cost), 0) AS "storageCost",
  COALESCE(SUM(f.io_cost), 0) AS "ioCost",
  COALESCE(SUM(f.backup_cost), 0) AS "backupCost",
  COUNT(DISTINCT f.resource_id) AS "resourceCount",
  AVG(f.load_avg) AS "avgLoad",
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
  COALESCE(SUM(ch.billed_cost), 0) AS "totalCost"
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
      ? "AVG(f.load_avg)"
      : "COALESCE(SUM(f.total_billed_cost), SUM(f.total_effective_cost), 0)";

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
