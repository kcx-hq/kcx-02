import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type { DashboardScope } from "../dashboard.types.js";
import { buildDashboardFilter } from "../shared/filter-builder.js";
import type {
  BudgetActualForecastPoint,
  CostBreakdownItem,
  CostSummary,
  FiltersResponse,
  OverviewAnomaly,
  OverviewFilters,
  OverviewRecommendation,
  PaginatedResult,
  TopSpendEntity,
} from "./overview.types.js";

type SqlFilterBuild = {
  whereClause: string;
  params: unknown[];
  nextIndex: number;
};

type CostSummaryRow = {
  billed_cost: number | string | null;
  list_cost: number | string | null;
  effective_cost: number | string | null;
};

type TopEntityRow = {
  entity_key: number | string | null;
  entity_name: string | null;
  billed_cost: number | string | null;
};

type CountRow = {
  total: number | string | null;
};

type MonthlySeriesRow = {
  month: string;
  budget: number | string | null;
  actual: number | string | null;
  forecast: number | string | null;
};

type BreakdownRow = {
  item_key: number | string | null;
  item_name: string | null;
  billed_cost: number | string | null;
};

type RegionBreakdownRow = BreakdownRow & {
  region_id: string | null;
};

type AnomalyRow = {
  anomaly_id: string;
  anomaly_date: string;
  service_key: number | string | null;
  service_name: string | null;
  region_key: number | string | null;
  region_name: string | null;
  cost_impact: number | string | null;
  severity: string;
  status: string;
  root_cause_hint: string | null;
  total_count: number | string | null;
};

type RecommendationRow = {
  recommendation_id: string;
  recommendation_type: string | null;
  service_name: string | null;
  estimated_savings: number | string | null;
  effort_level: string | null;
  risk_level: string | null;
  status: string;
  reason: string | null;
  total_count: number | string | null;
};

type DateRangeRow = {
  min_date: string | null;
  max_date: string | null;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

type RegionCoordinates = {
  latitude: number;
  longitude: number;
};

const REGION_COORDINATES_BY_ID: Record<string, RegionCoordinates> = {
  "us-east-1": { latitude: 38.9072, longitude: -77.0369 },
  "us-east-2": { latitude: 39.9612, longitude: -82.9988 },
  "us-west-1": { latitude: 37.7749, longitude: -122.4194 },
  "us-west-2": { latitude: 45.5152, longitude: -122.6784 },
  "eu-west-1": { latitude: 53.3498, longitude: -6.2603 },
  "eu-west-2": { latitude: 51.5072, longitude: -0.1276 },
  "eu-central-1": { latitude: 50.1109, longitude: 8.6821 },
  "eu-west-3": { latitude: 48.8566, longitude: 2.3522 },
  "eu-north-1": { latitude: 59.3293, longitude: 18.0686 },
  "ap-south-1": { latitude: 19.076, longitude: 72.8777 },
  "ap-northeast-1": { latitude: 35.6762, longitude: 139.6503 },
  "ap-southeast-1": { latitude: 1.3521, longitude: 103.8198 },
  "ap-southeast-2": { latitude: -33.8688, longitude: 151.2093 },
  "ap-northeast-2": { latitude: 37.5665, longitude: 126.978 },
  "sa-east-1": { latitude: -23.5558, longitude: -46.6396 },
  "ca-central-1": { latitude: 45.4215, longitude: -75.6972 },
  "me-south-1": { latitude: 26.2285, longitude: 50.5861 },
  "af-south-1": { latitude: -33.9249, longitude: 18.4241 },
};

const REGION_COORDINATES_BY_NAME: Record<string, RegionCoordinates> = {
  "us east (n. virginia)": { latitude: 38.9072, longitude: -77.0369 },
  "us east (ohio)": { latitude: 39.9612, longitude: -82.9988 },
  "us west (n. california)": { latitude: 37.7749, longitude: -122.4194 },
  "us west (oregon)": { latitude: 45.5152, longitude: -122.6784 },
  "eu (ireland)": { latitude: 53.3498, longitude: -6.2603 },
  "eu (london)": { latitude: 51.5072, longitude: -0.1276 },
  "eu (frankfurt)": { latitude: 50.1109, longitude: 8.6821 },
  "eu (paris)": { latitude: 48.8566, longitude: 2.3522 },
  "eu (stockholm)": { latitude: 59.3293, longitude: 18.0686 },
  "asia pacific (mumbai)": { latitude: 19.076, longitude: 72.8777 },
  "asia pacific (tokyo)": { latitude: 35.6762, longitude: 139.6503 },
  "asia pacific (singapore)": { latitude: 1.3521, longitude: 103.8198 },
  "asia pacific (sydney)": { latitude: -33.8688, longitude: 151.2093 },
  "asia pacific (seoul)": { latitude: 37.5665, longitude: 126.978 },
  "south america (sao paulo)": { latitude: -23.5558, longitude: -46.6396 },
  "canada (central)": { latitude: 45.4215, longitude: -75.6972 },
  "middle east (bahrain)": { latitude: 26.2285, longitude: 50.5861 },
  "africa (cape town)": { latitude: -33.9249, longitude: 18.4241 },
};

const resolveRegionCoordinates = (regionId: string | null, regionName: string | null): RegionCoordinates | null => {
  const normalizedId = regionId?.trim().toLowerCase();
  if (normalizedId && REGION_COORDINATES_BY_ID[normalizedId]) {
    return REGION_COORDINATES_BY_ID[normalizedId];
  }

  const normalizedName = regionName?.trim().toLowerCase();
  if (normalizedName && REGION_COORDINATES_BY_NAME[normalizedName]) {
    return REGION_COORDINATES_BY_NAME[normalizedName];
  }

  if (normalizedName?.includes("virginia")) return REGION_COORDINATES_BY_NAME["us east (n. virginia)"];
  if (normalizedName?.includes("oregon")) return REGION_COORDINATES_BY_NAME["us west (oregon)"];
  if (normalizedName?.includes("ireland")) return REGION_COORDINATES_BY_NAME["eu (ireland)"];
  if (normalizedName?.includes("london")) return REGION_COORDINATES_BY_NAME["eu (london)"];
  if (normalizedName?.includes("frankfurt")) return REGION_COORDINATES_BY_NAME["eu (frankfurt)"];
  if (normalizedName?.includes("paris")) return REGION_COORDINATES_BY_NAME["eu (paris)"];
  if (normalizedName?.includes("mumbai")) return REGION_COORDINATES_BY_NAME["asia pacific (mumbai)"];
  if (normalizedName?.includes("tokyo")) return REGION_COORDINATES_BY_NAME["asia pacific (tokyo)"];
  if (normalizedName?.includes("singapore")) return REGION_COORDINATES_BY_NAME["asia pacific (singapore)"];
  if (normalizedName?.includes("sydney")) return REGION_COORDINATES_BY_NAME["asia pacific (sydney)"];
  if (normalizedName?.includes("seoul")) return REGION_COORDINATES_BY_NAME["asia pacific (seoul)"];
  if (normalizedName?.includes("sao paulo")) return REGION_COORDINATES_BY_NAME["south america (sao paulo)"];

  return null;
};

const buildCostWhereClause = (
  filters: OverviewFilters,
  alias: string,
  dateColumn: string,
  startIndex: number = 1,
): SqlFilterBuild => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const pushEq = (column: string, value: unknown): void => {
    params.push(value);
    conditions.push(`${column} = $${startIndex + params.length - 1}`);
  };

  const pushRange = (column: string, start: string, end: string): void => {
    params.push(start);
    const firstIdx = startIndex + params.length - 1;
    params.push(end);
    const secondIdx = startIndex + params.length - 1;
    conditions.push(`${column} BETWEEN $${firstIdx} AND $${secondIdx}`);
  };

  const pushAnyArray = (column: string, values: number[]): void => {
    params.push(values);
    conditions.push(`${column} = ANY($${startIndex + params.length - 1}::bigint[])`);
  };

  pushEq(`${alias}.tenant_id`, filters.tenantId);
  pushRange(dateColumn, filters.billingPeriodStart, filters.billingPeriodEnd);

  if (Array.isArray(filters.accountKeys) && filters.accountKeys.length > 0) {
    pushAnyArray(`${alias}.sub_account_key`, filters.accountKeys);
  }
  if (Array.isArray(filters.serviceKeys) && filters.serviceKeys.length > 0) {
    pushAnyArray(`${alias}.service_key`, filters.serviceKeys);
  }
  if (Array.isArray(filters.regionKeys) && filters.regionKeys.length > 0) {
    pushAnyArray(`${alias}.region_key`, filters.regionKeys);
  }

  return {
    whereClause: conditions.join("\n      AND "),
    params,
    nextIndex: startIndex + params.length,
  };
};

const buildAnomalyWhereClause = (
  filters: OverviewFilters,
  alias: string,
  dateColumn: string,
  startIndex: number = 1,
): SqlFilterBuild => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const pushEq = (column: string, value: unknown): void => {
    params.push(value);
    conditions.push(`${column} = $${startIndex + params.length - 1}`);
  };

  const pushRange = (column: string, start: string, end: string): void => {
    params.push(start);
    const firstIdx = startIndex + params.length - 1;
    params.push(end);
    const secondIdx = startIndex + params.length - 1;
    conditions.push(`${column} BETWEEN $${firstIdx} AND $${secondIdx}`);
  };

  const pushAnyArray = (column: string, values: number[]): void => {
    params.push(values);
    conditions.push(`${column} = ANY($${startIndex + params.length - 1}::bigint[])`);
  };

  pushEq(`${alias}.tenant_id`, filters.tenantId);
  pushRange(dateColumn, filters.billingPeriodStart, filters.billingPeriodEnd);

  if (Array.isArray(filters.serviceKeys) && filters.serviceKeys.length > 0) {
    pushAnyArray(`${alias}.service_key`, filters.serviceKeys);
  }
  if (Array.isArray(filters.regionKeys) && filters.regionKeys.length > 0) {
    pushAnyArray(`${alias}.region_key`, filters.regionKeys);
  }

  return {
    whereClause: conditions.join("\n      AND "),
    params,
    nextIndex: startIndex + params.length,
  };
};

const buildPreviousPeriod = (start: string, end: string): { from: string; to: string } => {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const dayDiff = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;

  const prevEnd = new Date(startDate);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);

  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - (dayDiff - 1));

  return {
    from: prevStart.toISOString().slice(0, 10),
    to: prevEnd.toISOString().slice(0, 10),
  };
};

export class OverviewRepository {
  async getTotalSpendByScope(scope: DashboardScope): Promise<number> {
    const { whereClause, params } = buildDashboardFilter(scope);
    const rows = await sequelize.query<{ total_spend: number | string | null }>(
      `
        SELECT COALESCE(SUM(fcli.billed_cost), 0)::double precision AS total_spend
        FROM fact_cost_line_items fcli
        JOIN dim_date dd ON dd.id = fcli.usage_date_key
        WHERE ${whereClause};
      `,
      { bind: params, type: QueryTypes.SELECT },
    );

    return toNumber(rows[0]?.total_spend);
  }

  async getCostSummary(filters: OverviewFilters): Promise<CostSummary> {
    const { whereClause, params } = buildCostWhereClause(filters, "fcli", "dd.full_date");

    const rows = await sequelize.query<CostSummaryRow>(
      `
        SELECT
          COALESCE(SUM(fcli.billed_cost), 0)::double precision AS billed_cost,
          COALESCE(SUM(fcli.list_cost), 0)::double precision AS list_cost,
          COALESCE(SUM(fcli.effective_cost), 0)::double precision AS effective_cost
        FROM fact_cost_line_items fcli
        JOIN dim_date dd ON dd.id = fcli.usage_date_key
        WHERE ${whereClause};
      `,
      { bind: params, type: QueryTypes.SELECT },
    );

    const first = rows[0];
    return {
      billedCost: toNumber(first?.billed_cost),
      listCost: toNumber(first?.list_cost),
      effectiveCost: toNumber(first?.effective_cost),
    };
  }

  async getPreviousPeriodSpend(filters: OverviewFilters): Promise<number> {
    const previousPeriod = buildPreviousPeriod(filters.billingPeriodStart, filters.billingPeriodEnd);
    const previousFilters: OverviewFilters = {
      ...filters,
      billingPeriodStart: previousPeriod.from,
      billingPeriodEnd: previousPeriod.to,
    };
    const summary = await this.getCostSummary(previousFilters);
    return summary.billedCost;
  }

  async getTopRegion(filters: OverviewFilters): Promise<TopSpendEntity | null> {
    const totalCost = (await this.getCostSummary(filters)).billedCost;
    const { whereClause, params } = buildCostWhereClause(filters, "fcli", "dd.full_date");

    const rows = await sequelize.query<TopEntityRow>(
      `
        SELECT
          dr.id AS entity_key,
          dr.region_name AS entity_name,
          COALESCE(SUM(fcli.billed_cost), 0)::double precision AS billed_cost
        FROM fact_cost_line_items fcli
        JOIN dim_date dd ON dd.id = fcli.usage_date_key
        LEFT JOIN dim_region dr ON dr.id = fcli.region_key
        WHERE ${whereClause}
        GROUP BY dr.id, dr.region_name
        ORDER BY billed_cost DESC
        LIMIT 1;
      `,
      { bind: params, type: QueryTypes.SELECT },
    );

    const first = rows[0];
    if (!first) {
      return null;
    }

    const billedCost = toNumber(first.billed_cost);
    const contributionPct = totalCost > 0 ? roundTo((billedCost / totalCost) * 100, 2) : 0;

    return {
      key: first.entity_key === null ? null : Number(first.entity_key),
      name: first.entity_name ?? "Unspecified",
      billedCost,
      contributionPct,
    };
  }

  async getTopAccount(filters: OverviewFilters): Promise<TopSpendEntity | null> {
    const totalCost = (await this.getCostSummary(filters)).billedCost;
    const { whereClause, params } = buildCostWhereClause(filters, "fcli", "dd.full_date");

    const rows = await sequelize.query<TopEntityRow>(
      `
        SELECT
          dsa.id AS entity_key,
          COALESCE(dsa.sub_account_name, dsa.sub_account_id, 'Unspecified') AS entity_name,
          COALESCE(SUM(fcli.billed_cost), 0)::double precision AS billed_cost
        FROM fact_cost_line_items fcli
        JOIN dim_date dd ON dd.id = fcli.usage_date_key
        LEFT JOIN dim_sub_account dsa ON dsa.id = fcli.sub_account_key
        WHERE ${whereClause}
        GROUP BY dsa.id, dsa.sub_account_name, dsa.sub_account_id
        ORDER BY billed_cost DESC
        LIMIT 1;
      `,
      { bind: params, type: QueryTypes.SELECT },
    );

    const first = rows[0];
    if (!first) {
      return null;
    }

    const billedCost = toNumber(first.billed_cost);
    const contributionPct = totalCost > 0 ? roundTo((billedCost / totalCost) * 100, 2) : 0;

    return {
      key: first.entity_key === null ? null : Number(first.entity_key),
      name: first.entity_name ?? "Unspecified",
      billedCost,
      contributionPct,
    };
  }

  async getActiveAnomaliesCount(filters: OverviewFilters): Promise<number> {
    const { whereClause, params, nextIndex } = buildAnomalyWhereClause(filters, "fa", "fa.usage_date");
    const rows = await sequelize.query<CountRow>(
      `
        SELECT COALESCE(COUNT(*), 0)::bigint AS total
        FROM fact_anomalies fa
        WHERE ${whereClause}
          AND fa.status = $${nextIndex};
      `,
      { bind: [...params, "open"], type: QueryTypes.SELECT },
    );
    return toNumber(rows[0]?.total);
  }

  async getHighSeverityAnomalyCount(filters: OverviewFilters): Promise<number> {
    const { whereClause, params, nextIndex } = buildAnomalyWhereClause(filters, "fa", "fa.usage_date");
    const rows = await sequelize.query<CountRow>(
      `
        SELECT COALESCE(COUNT(*), 0)::bigint AS total
        FROM fact_anomalies fa
        WHERE ${whereClause}
          AND fa.status = $${nextIndex}
          AND fa.severity = $${nextIndex + 1};
      `,
      { bind: [...params, "open", "high"], type: QueryTypes.SELECT },
    );
    return toNumber(rows[0]?.total);
  }

  async getActiveRecommendationsCount(filters: OverviewFilters): Promise<number> {
    const rows = await sequelize.query<CountRow>(
      `
        SELECT COALESCE(COUNT(*), 0)::bigint AS total
        FROM fact_recommendations fr
        WHERE fr.tenant_id = $1
          AND fr.status = $2
          AND fr.created_at::date BETWEEN $3 AND $4;
      `,
      {
        bind: [filters.tenantId, "open", filters.billingPeriodStart, filters.billingPeriodEnd],
        type: QueryTypes.SELECT,
      },
    );
    return toNumber(rows[0]?.total);
  }

  async getRecommendationsEstimatedSavingsTotal(filters: OverviewFilters): Promise<number> {
    const bindValues: unknown[] = [filters.tenantId, filters.billingPeriodStart, filters.billingPeriodEnd];
    let statusCondition = "";
    if (Array.isArray(filters.status) && filters.status.length > 0) {
      bindValues.push(filters.status);
      statusCondition = `AND fr.status = ANY($${bindValues.length}::text[])`;
    }

    const rows = await sequelize.query<{ total_savings: number | string | null }>(
      `
        SELECT COALESCE(SUM(fr.potential_monthly_savings), 0)::double precision AS total_savings
        FROM fact_recommendations fr
        WHERE fr.tenant_id = $1
          AND fr.created_at::date BETWEEN $2 AND $3
          ${statusCondition};
      `,
      { bind: bindValues, type: QueryTypes.SELECT },
    );

    return toNumber(rows[0]?.total_savings);
  }

  async getBudgetVsActualForecast(filters: OverviewFilters): Promise<BudgetActualForecastPoint[]> {
    const actualFilter = buildCostWhereClause(filters, "fcli", "dd.full_date");

    const [budgetForecastRows, actualRows] = await Promise.all([
      sequelize.query<MonthlySeriesRow>(
        `
          WITH months AS (
            SELECT generate_series(
              date_trunc('month', $2::date),
              date_trunc('month', $3::date),
              interval '1 month'
            )::date AS month_start
          ),
          selected_budget AS (
            SELECT b.*
            FROM budgets b
            WHERE b.tenant_id = $1
              AND b.period = 'monthly'
              AND COALESCE(NULLIF(b.scope_filter->>'status', ''), 'active') = 'active'
              AND b.start_date <= CURRENT_DATE
              AND (b.end_date IS NULL OR b.end_date >= CURRENT_DATE)
            ORDER BY b.updated_at DESC, b.created_at DESC
            LIMIT 1
          ),
          budgets_monthly AS (
            SELECT
              m.month_start,
              COALESCE(SUM(sb.budget_amount), 0)::double precision AS budget
            FROM months m
            LEFT JOIN selected_budget sb
              ON sb.start_date <= (m.month_start + interval '1 month - 1 day')::date
             AND (sb.end_date IS NULL OR sb.end_date >= m.month_start)
            GROUP BY 1
          ),
          forecast_monthly AS (
            SELECT
              date_trunc('month', be.evaluated_at)::date AS month_start,
              COALESCE(SUM(be.forecast_spend), 0)::double precision AS forecast
            FROM budget_evaluations be
            JOIN selected_budget sb ON sb.id = be.budget_id
            WHERE be.evaluated_at::date BETWEEN $2 AND $3
            GROUP BY 1
          )
          SELECT
            to_char(m.month_start, 'YYYY-MM') AS month,
            COALESCE(bm.budget, 0)::double precision AS budget,
            0::double precision AS actual,
            COALESCE(fm.forecast, 0)::double precision AS forecast
          FROM months m
          LEFT JOIN budgets_monthly bm ON bm.month_start = m.month_start
          LEFT JOIN forecast_monthly fm ON fm.month_start = m.month_start
          ORDER BY m.month_start;
        `,
        {
          bind: [filters.tenantId, filters.billingPeriodStart, filters.billingPeriodEnd],
          type: QueryTypes.SELECT,
        },
      ),
      sequelize.query<{ month: string; actual: number | string | null }>(
        `
          SELECT
            to_char(date_trunc('month', dd.full_date), 'YYYY-MM') AS month,
            COALESCE(SUM(fcli.billed_cost), 0)::double precision AS actual
          FROM fact_cost_line_items fcli
          JOIN dim_date dd ON dd.id = fcli.usage_date_key
          WHERE ${actualFilter.whereClause}
          GROUP BY 1;
        `,
        {
          bind: actualFilter.params,
          type: QueryTypes.SELECT,
        },
      ),
    ]);

    const actualByMonth = new Map<string, number>();
    actualRows.forEach((row) => {
      actualByMonth.set(row.month, toNumber(row.actual));
    });

    return budgetForecastRows.map((row) => ({
      month: row.month,
      budget: toNumber(row.budget),
      actual: actualByMonth.get(row.month) ?? 0,
      forecast: toNumber(row.forecast),
    }));
  }

  async getTopServices(filters: OverviewFilters, limit: number): Promise<CostBreakdownItem[]> {
    return this.getBreakdownItems(filters, limit, "service");
  }

  async getTopAccounts(filters: OverviewFilters, limit: number): Promise<CostBreakdownItem[]> {
    return this.getBreakdownItems(filters, limit, "account");
  }

  async getTopRegions(filters: OverviewFilters, limit?: number): Promise<CostBreakdownItem[]> {
    const { whereClause, params } = buildCostWhereClause(filters, "fcli", "dd.full_date");
    const summary = await this.getCostSummary(filters);
    const totalBilledCost = summary.billedCost;

    const limitClause = typeof limit === "number" && Number.isInteger(limit) && limit > 0 ? `LIMIT $${params.length + 1}` : "";
    const bindValues = typeof limitClause === "string" && limitClause.length > 0 ? [...params, limit] : params;

    const rows = await sequelize.query<RegionBreakdownRow>(
      `
        SELECT
          dr.id AS item_key,
          COALESCE(dr.region_name, 'Unspecified') AS item_name,
          LOWER(dr.region_id) AS region_id,
          COALESCE(SUM(fcli.billed_cost), 0)::double precision AS billed_cost
        FROM fact_cost_line_items fcli
        JOIN dim_date dd ON dd.id = fcli.usage_date_key
        LEFT JOIN dim_region dr ON dr.id = fcli.region_key
        WHERE ${whereClause}
        GROUP BY dr.id, dr.region_name, dr.region_id
        ORDER BY billed_cost DESC
        ${limitClause};
      `,
      {
        bind: bindValues,
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => {
      const billedCost = toNumber(row.billed_cost);
      const contributionPct = totalBilledCost > 0 ? roundTo((billedCost / totalBilledCost) * 100, 2) : 0;
      const coordinates = resolveRegionCoordinates(row.region_id, row.item_name);

      return {
        key: row.item_key === null ? null : Number(row.item_key),
        name: row.item_name ?? "Unspecified",
        billedCost,
        contributionPct,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
      };
    });
  }

  async getAnomalies(filters: OverviewFilters): Promise<PaginatedResult<OverviewAnomaly>> {
    const sortBy = filters.sortBy === "costImpact" ? "cost_impact" : "anomaly_date";
    const sortOrder = filters.sortOrder === "asc" ? "ASC" : "DESC";
    const offset = (filters.page - 1) * filters.pageSize;

    const { whereClause, params, nextIndex } = buildAnomalyWhereClause(filters, "fa", "fa.usage_date");
    const severityCondition =
      Array.isArray(filters.severity) && filters.severity.length > 0
        ? `AND fa.severity = ANY($${nextIndex}::text[])`
        : "";
    const statusCondition =
      Array.isArray(filters.status) && filters.status.length > 0
        ? `AND fa.status = ANY($${nextIndex + (severityCondition ? 1 : 0)}::text[])`
        : "";

    const bindValues: unknown[] = [...params];
    if (Array.isArray(filters.severity) && filters.severity.length > 0) {
      bindValues.push(filters.severity);
    }
    if (Array.isArray(filters.status) && filters.status.length > 0) {
      bindValues.push(filters.status);
    }

    bindValues.push(filters.pageSize);
    bindValues.push(offset);

    const rows = await sequelize.query<AnomalyRow>(
      `
        SELECT
          fa.id AS anomaly_id,
          fa.usage_date AS anomaly_date,
          fa.service_key,
          ds.service_name,
          fa.region_key,
          dr.region_name,
          COALESCE(fa.delta_cost, 0)::double precision AS cost_impact,
          fa.severity,
          fa.status,
          fa.root_cause_hint,
          COUNT(*) OVER() AS total_count
        FROM fact_anomalies fa
        LEFT JOIN dim_service ds ON ds.id = fa.service_key
        LEFT JOIN dim_region dr ON dr.id = fa.region_key
        WHERE ${whereClause}
          ${severityCondition}
          ${statusCondition}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${bindValues.length - 1} OFFSET $${bindValues.length};
      `,
      {
        bind: bindValues,
        type: QueryTypes.SELECT,
      },
    );

    const total = toNumber(rows[0]?.total_count);
    return {
      items: rows.map((row) => ({
        anomalyId: row.anomaly_id,
        anomalyDate: row.anomaly_date,
        serviceKey: row.service_key === null ? null : Number(row.service_key),
        serviceName: row.service_name,
        regionKey: row.region_key === null ? null : Number(row.region_key),
        regionName: row.region_name,
        costImpact: toNumber(row.cost_impact),
        severity: row.severity,
        status: row.status,
        isActive: row.status === "open",
        isHighSeverity: row.severity === "high",
        rootCauseHint: row.root_cause_hint,
      })),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: total > 0 ? Math.ceil(total / filters.pageSize) : 0,
      },
    };
  }

  async getRecommendations(filters: OverviewFilters): Promise<PaginatedResult<OverviewRecommendation>> {
    const sortBy = filters.sortBy === "createdAt" ? "created_at" : "estimated_savings";
    const sortOrder = filters.sortOrder === "asc" ? "ASC" : "DESC";
    const offset = (filters.page - 1) * filters.pageSize;

    const bindValues: unknown[] = [filters.tenantId, filters.billingPeriodStart, filters.billingPeriodEnd];
    let statusCondition = "";
    if (Array.isArray(filters.status) && filters.status.length > 0) {
      bindValues.push(filters.status);
      statusCondition = `AND fr.status = ANY($${bindValues.length}::text[])`;
    }
    bindValues.push(filters.pageSize, offset);

    const rows = await sequelize.query<RecommendationRow>(
      `
        SELECT
          fr.id AS recommendation_id,
          fr.recommendation_type,
          fr.service_name,
          COALESCE(fr.potential_monthly_savings, 0)::double precision AS estimated_savings,
          NULL::text AS effort_level,
          fr.risk_level,
          fr.status,
          fr.reason,
          COUNT(*) OVER() AS total_count
        FROM fact_recommendations fr
        WHERE fr.tenant_id = $1
          AND fr.created_at::date BETWEEN $2 AND $3
          ${statusCondition}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${bindValues.length - 1} OFFSET $${bindValues.length};
      `,
      { bind: bindValues, type: QueryTypes.SELECT },
    );

    const total = toNumber(rows[0]?.total_count);
    return {
      items: rows.map((row) => {
        const isActive = row.status === "open";
        const riskLevel = row.risk_level ?? "unknown";
        return {
          recommendationId: row.recommendation_id,
          recommendationType: row.recommendation_type,
          serviceName: row.service_name,
          estimatedSavings: toNumber(row.estimated_savings),
          effortLevel: row.effort_level,
          riskLevel: riskLevel,
          status: row.status,
          isActive,
          actions: {
            viewEnabled: true,
            applyEnabled: isActive && riskLevel !== "high",
          },
          reason: row.reason,
        };
      }),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: total > 0 ? Math.ceil(total / filters.pageSize) : 0,
      },
    };
  }

  async getFilterOptions(filters: OverviewFilters): Promise<FiltersResponse> {
    const { whereClause, params } = buildCostWhereClause(filters, "fcli", "dd.full_date");

    const [dateRangeRows, accountRows, serviceRows, regionRows] = await Promise.all([
      sequelize.query<DateRangeRow>(
        `
          SELECT
            MIN(dd.full_date) AS min_date,
            MAX(dd.full_date) AS max_date
          FROM fact_cost_line_items fcli
          JOIN dim_date dd ON dd.id = fcli.usage_date_key
          WHERE fcli.tenant_id = $1;
        `,
        { bind: [filters.tenantId], type: QueryTypes.SELECT },
      ),
      sequelize.query<{ item_key: number | string; item_name: string | null }>(
        `
          SELECT DISTINCT
            dsa.id AS item_key,
            COALESCE(dsa.sub_account_name, dsa.sub_account_id, 'Unspecified') AS item_name
          FROM fact_cost_line_items fcli
          JOIN dim_date dd ON dd.id = fcli.usage_date_key
          LEFT JOIN dim_sub_account dsa ON dsa.id = fcli.sub_account_key
          WHERE ${whereClause}
          ORDER BY item_name ASC;
        `,
        { bind: params, type: QueryTypes.SELECT },
      ),
      sequelize.query<{ item_key: number | string; item_name: string | null }>(
        `
          SELECT DISTINCT
            ds.id AS item_key,
            COALESCE(ds.service_name, 'Unspecified') AS item_name
          FROM fact_cost_line_items fcli
          JOIN dim_date dd ON dd.id = fcli.usage_date_key
          LEFT JOIN dim_service ds ON ds.id = fcli.service_key
          WHERE ${whereClause}
          ORDER BY item_name ASC;
        `,
        { bind: params, type: QueryTypes.SELECT },
      ),
      sequelize.query<{ item_key: number | string; item_name: string | null }>(
        `
          SELECT DISTINCT
            dr.id AS item_key,
            COALESCE(dr.region_name, 'Unspecified') AS item_name
          FROM fact_cost_line_items fcli
          JOIN dim_date dd ON dd.id = fcli.usage_date_key
          LEFT JOIN dim_region dr ON dr.id = fcli.region_key
          WHERE ${whereClause}
          ORDER BY item_name ASC;
        `,
        { bind: params, type: QueryTypes.SELECT },
      ),
    ]);

    const minDate = dateRangeRows[0]?.min_date ?? null;
    const maxDate = dateRangeRows[0]?.max_date ?? null;

    return {
      billingPeriod: {
        min: minDate,
        max: maxDate,
        defaultStart: filters.billingPeriodStart,
        defaultEnd: filters.billingPeriodEnd,
      },
      accounts: accountRows
        .filter((row) => row.item_key !== null)
        .map((row) => ({ key: Number(row.item_key), name: row.item_name ?? "Unspecified" })),
      services: serviceRows
        .filter((row) => row.item_key !== null)
        .map((row) => ({ key: Number(row.item_key), name: row.item_name ?? "Unspecified" })),
      regions: regionRows
        .filter((row) => row.item_key !== null)
        .map((row) => ({ key: Number(row.item_key), name: row.item_name ?? "Unspecified" })),
    };
  }

  private async getBreakdownItems(
    filters: OverviewFilters,
    limit: number,
    dimension: "service" | "account" | "region",
  ): Promise<CostBreakdownItem[]> {
    const { whereClause, params } = buildCostWhereClause(filters, "fcli", "dd.full_date");
    const summary = await this.getCostSummary(filters);
    const totalBilledCost = summary.billedCost;

    const selectMap: Record<"service" | "account" | "region", string> = {
      service: "ds.id AS item_key, COALESCE(ds.service_name, 'Unspecified') AS item_name",
      account: "dsa.id AS item_key, COALESCE(dsa.sub_account_name, dsa.sub_account_id, 'Unspecified') AS item_name",
      region: "dr.id AS item_key, COALESCE(dr.region_name, 'Unspecified') AS item_name",
    };

    const joinMap: Record<"service" | "account" | "region", string> = {
      service: "LEFT JOIN dim_service ds ON ds.id = fcli.service_key",
      account: "LEFT JOIN dim_sub_account dsa ON dsa.id = fcli.sub_account_key",
      region: "LEFT JOIN dim_region dr ON dr.id = fcli.region_key",
    };

    const groupByMap: Record<"service" | "account" | "region", string> = {
      service: "ds.id, ds.service_name",
      account: "dsa.id, dsa.sub_account_name, dsa.sub_account_id",
      region: "dr.id, dr.region_name",
    };

    const rows = await sequelize.query<BreakdownRow>(
      `
        SELECT
          ${selectMap[dimension]},
          COALESCE(SUM(fcli.billed_cost), 0)::double precision AS billed_cost
        FROM fact_cost_line_items fcli
        JOIN dim_date dd ON dd.id = fcli.usage_date_key
        ${joinMap[dimension]}
        WHERE ${whereClause}
        GROUP BY ${groupByMap[dimension]}
        ORDER BY billed_cost DESC
        LIMIT $${params.length + 1};
      `,
      {
        bind: [...params, limit],
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => {
      const billedCost = toNumber(row.billed_cost);
      const contributionPct = totalBilledCost > 0 ? roundTo((billedCost / totalBilledCost) * 100, 2) : 0;

      return {
        key: row.item_key === null ? null : Number(row.item_key),
        name: row.item_name ?? "Unspecified",
        billedCost,
        contributionPct,
      };
    });
  }
}

export const toCostInsightText = (
  totalSpend: number,
  absoluteSavings: number,
  savingsPct: number,
  topService: Pick<CostBreakdownItem, "name"> | null,
): string => {
  if (totalSpend <= 0) {
    return "No spend data is available for the selected filters.";
  }

  if (absoluteSavings <= 0) {
    return "No savings were observed in the selected billing window.";
  }

  if (!topService) {
    return `Savings are ${roundTo(savingsPct, 2)}% of list cost in the selected billing window.`;
  }

  return `Savings are ${roundTo(savingsPct, 2)}% of list cost, led by optimization opportunities in ${topService.name}.`;
};
