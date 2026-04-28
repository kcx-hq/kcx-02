import { QueryTypes } from "sequelize";

import { BadRequestError } from "../../../errors/http-errors.js";
import { sequelize } from "../../../models/index.js";
import type {
  ExplorerCards,
  ExplorerQueryParams,
  ExplorerTableRow,
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
): string => {
  const startDateParam = period === "current" ? "startDate" : "previousStartDate";
  const endDateParam = period === "current" ? "endDate" : "previousEndDate";
  const filters = [
    "tenant_id = CAST(:tenantId AS uuid)",
    `usage_date BETWEEN CAST(:${startDateParam} AS date) AND CAST(:${endDateParam} AS date)`,
  ];

  if (params.cloudConnectionId) {
    filters.push("cloud_connection_id = CAST(:cloudConnectionId AS uuid)");
  }

  if (params.regionKey) {
    filters.push("region_key = CAST(:regionKey AS bigint)");
  }

  if (params.dbService) {
    filters.push("db_service = :dbService");
  }

  if (params.dbEngine) {
    filters.push("db_engine = :dbEngine");
  }

  return filters.join("\n    AND ");
};

const buildTrendFilters = (params: ExplorerQueryParams): string => {
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

  if (params.dbService) {
    filters.push("db_service = :dbService");
  }

  if (params.dbEngine) {
    filters.push("db_engine = :dbEngine");
  }

  return filters.join("\n    AND ");
};

const buildTrendQueryParams = (params: ExplorerQueryParams): ExplorerQueryParams => ({
  ...params,
  startDate: toUtcDateOnly(params.startDate, "start_date"),
  endDate: toUtcDateOnly(params.endDate, "end_date"),
});

const GROUP_BY_COLUMNS = {
  db_service: {
    selectExpression: "db_service",
    groupExpression: "db_service",
  },
  db_engine: {
    selectExpression: "db_engine",
    groupExpression: "db_engine",
  },
  region: {
    selectExpression: "CAST(region_key AS text)",
    groupExpression: "region_key",
  },
} as const;

export class DatabaseExplorerRepository {
  async getCards(params: ExplorerQueryParams): Promise<ExplorerCards> {
    const previousPeriod = getPreviousPeriod(params);
    const queryParams: ExplorerCardsQueryParams = {
      ...params,
      startDate: toUtcDateOnly(params.startDate, "start_date"),
      endDate: toUtcDateOnly(params.endDate, "end_date"),
      ...previousPeriod,
    };
    const currentFilters = buildFactFilters(queryParams, "current");
    const previousFilters = buildFactFilters(queryParams, "previous");

    const rows = await sequelize.query<CardsAggregateRow>(
      `
WITH current_period AS (
  SELECT
    COALESCE(SUM(total_effective_cost), 0) AS "totalCost",
    COUNT(DISTINCT resource_id) AS "activeResources",
    COALESCE(SUM(data_footprint_gb), 0) AS "dataFootprintGb",
    AVG(load_avg) AS "avgLoad",
    AVG(connections_avg) AS "connections"
  FROM fact_db_resource_daily
  WHERE ${currentFilters}
),
previous_period AS (
  SELECT
    COALESCE(SUM(total_effective_cost), 0) AS "previousCost"
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
    const queryParams = buildTrendQueryParams(params);
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
  usage_date AS date,
  COALESCE(SUM(compute_cost), 0) AS compute,
  COALESCE(SUM(storage_cost), 0) AS storage,
  COALESCE(SUM(io_cost), 0) AS io,
  COALESCE(SUM(backup_cost), 0) AS backup,
  COALESCE(SUM(total_effective_cost), 0) AS total
FROM fact_db_resource_daily
WHERE ${filters}
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
      compute: toNumber(row.compute),
      storage: toNumber(row.storage),
      io: toNumber(row.io),
      backup: toNumber(row.backup),
      total: toNumber(row.total),
    }));
  }

  async getTable(params: ExplorerQueryParams): Promise<ExplorerTableRow[]> {
    const queryParams = buildTrendQueryParams(params);
    const filters = buildTrendFilters(queryParams);
    const groupBy = GROUP_BY_COLUMNS[queryParams.groupBy];

    const rows = await sequelize.query<TableAggregateRow>(
      `
SELECT
  ${groupBy.selectExpression} AS "group",
  COALESCE(SUM(total_effective_cost), 0) AS "totalCost",
  COALESCE(SUM(compute_cost), 0) AS "computeCost",
  COALESCE(SUM(storage_cost), 0) AS "storageCost",
  COALESCE(SUM(io_cost), 0) AS "ioCost",
  COALESCE(SUM(backup_cost), 0) AS "backupCost",
  COUNT(DISTINCT resource_id) AS "resourceCount",
  AVG(load_avg) AS "avgLoad",
  AVG(connections_avg) AS "connections"
FROM fact_db_resource_daily
WHERE ${filters}
  AND ${groupBy.groupExpression} IS NOT NULL
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
}
