import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type { DashboardScope } from "../dashboard.types.js";
import type {
  CostExplorerBreakdownRow,
  CostExplorerCompareKey,
  CostExplorerEffectiveFilters,
  CostExplorerGranularity,
  CostExplorerGroupBy,
  CostExplorerGroupOptionsResponse,
  CostExplorerMetric,
  CostExplorerSeries,
} from "./cost-explorer.types.js";

type SourceConfig = {
  tableName: "agg_cost_hourly" | "agg_cost_daily" | "agg_cost_monthly" | "fact_cost_line_items";
  alias: "a" | "f";
  bucketExpression: string;
  dateFilterExpression: string;
  dateRangeMode: "day" | "month";
};

type SqlFilterBuild = {
  whereClause: string;
  params: unknown[];
  nextIndex: number;
};

type BucketValueRow = {
  bucket: string | Date;
  value: number | string | null;
};

type GroupTotalRow = {
  dim_key: number | string | null;
  dim_name: string | null;
  total: number | string | null;
};

type BucketDimValueRow = {
  bucket: string | Date;
  dim_key: number | string | null;
  value: number | string | null;
};

type CostByKeyRow = {
  dim_key: number | string | null;
  cost: number | string | null;
};

type CategoryServiceRow = {
  category: string | null;
  service_name: string | null;
};

type ResourceDetailRow = {
  resource_key: number | string | null;
  service_name: string | null;
  resource_type: string | null;
};

type GroupDimensionKey = number | string;

type GroupDimensionSql = {
  keyColumn: string;
  joinClause: string;
  nameExpression: string;
  groupByColumns: string;
  keyType: "number" | "string";
};

type TagGroupContext =
  | { isTagGroup: false; normalizedKey: null }
  | { isTagGroup: true; normalizedKey: string };

type TagFilterContext = {
  normalizedKey: string;
  normalizedValue: string | null;
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

const toIsoDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

const getMonthStart = (value: string): string => `${value.slice(0, 7)}-01`;

const buildPreviousPeriod = (start: string, end: string): { from: string; to: string } => {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const dayDiff = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;

  const prevEnd = new Date(startDate);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);

  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - (dayDiff - 1));

  return {
    from: toIsoDateOnly(prevStart),
    to: toIsoDateOnly(prevEnd),
  };
};

const metricLabel = (metric: CostExplorerMetric): string =>
  metric === "billed" ? "Billed Cost" : metric === "effective" ? "Effective Cost" : "List Cost";

const comparisonLabel = (compareKey: CostExplorerCompareKey): string =>
  compareKey === "previous-month" ? "Previous Month" : compareKey === "budget" ? "Budget" : "Forecast";

const aggregationConfigByGranularity: Record<CostExplorerGranularity, SourceConfig> = {
  hourly: {
    tableName: "agg_cost_hourly",
    alias: "a",
    bucketExpression: "a.hour_start",
    dateFilterExpression: "a.usage_date",
    dateRangeMode: "day",
  },
  daily: {
    tableName: "agg_cost_daily",
    alias: "a",
    bucketExpression: "a.usage_date",
    dateFilterExpression: "a.usage_date",
    dateRangeMode: "day",
  },
  monthly: {
    tableName: "agg_cost_monthly",
    alias: "a",
    bucketExpression: "a.month_start",
    dateFilterExpression: "a.month_start",
    dateRangeMode: "month",
  },
};

const factConfigByGranularity: Record<CostExplorerGranularity, SourceConfig> = {
  hourly: {
    tableName: "fact_cost_line_items",
    alias: "f",
    bucketExpression: "DATE_TRUNC('hour', COALESCE(f.usage_start_time, f.usage_end_time))",
    dateFilterExpression: "DATE(COALESCE(f.usage_start_time, f.usage_end_time))",
    dateRangeMode: "day",
  },
  daily: {
    tableName: "fact_cost_line_items",
    alias: "f",
    bucketExpression: "DATE(COALESCE(f.usage_start_time, f.usage_end_time))",
    dateFilterExpression: "DATE(COALESCE(f.usage_start_time, f.usage_end_time))",
    dateRangeMode: "day",
  },
  monthly: {
    tableName: "fact_cost_line_items",
    alias: "f",
    bucketExpression: "DATE_TRUNC('month', DATE(COALESCE(f.usage_start_time, f.usage_end_time)))::DATE",
    dateFilterExpression: "DATE_TRUNC('month', DATE(COALESCE(f.usage_start_time, f.usage_end_time)))::DATE",
    dateRangeMode: "month",
  },
};

const resolveMetricColumn = (metric: CostExplorerMetric): string =>
  metric === "billed" ? "billed_cost" : metric === "effective" ? "effective_cost" : "list_cost";

const formatBucket = (bucketStart: string, granularity: CostExplorerGranularity): { short: string; long: string } => {
  const date = new Date(bucketStart);
  if (Number.isNaN(date.getTime())) {
    return { short: bucketStart, long: bucketStart };
  }

  if (granularity === "monthly") {
    return {
      short: date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
      long: date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    };
  }

  if (granularity === "daily") {
    return {
      short: date.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" }),
      long: date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
    };
  }

  return {
    short: date.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }),
    long: date.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }),
  };
};

const toBucketStartIso = (value: string | Date): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T00:00:00.000Z`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return parsed.toISOString();
};

export class CostExplorerRepository {
  private parseTagFilter(tagKey?: string | null, tagValue?: string | null): TagFilterContext | null {
    const normalizedKey = (tagKey ?? "").trim().toLowerCase();
    if (!normalizedKey || !/^[a-z0-9]+$/.test(normalizedKey)) {
      return null;
    }
    const normalizedValueCandidate = (tagValue ?? "").trim().toLowerCase();
    const normalizedValue =
      normalizedValueCandidate.length > 0 && /^[a-z0-9._:@/-]+$/.test(normalizedValueCandidate)
        ? normalizedValueCandidate
        : null;
    return { normalizedKey, normalizedValue };
  }

  private parseTagGroupBy(groupBy?: CostExplorerGroupBy): TagGroupContext {
    if (!groupBy || !groupBy.startsWith("tag:")) {
      return { isTagGroup: false, normalizedKey: null };
    }
    const normalizedKey = groupBy.slice(4).trim().toLowerCase();
    if (!normalizedKey || !/^[a-z0-9]+$/.test(normalizedKey)) {
      return { isTagGroup: false, normalizedKey: null };
    }
    return { isTagGroup: true, normalizedKey };
  }

  private getSourceConfig(
    scope: DashboardScope,
    effectiveGranularity: CostExplorerGranularity,
    groupBy?: Exclude<CostExplorerGroupBy, "none">,
    tagFilter?: TagFilterContext | null,
  ): SourceConfig {
    const tagGroup = this.parseTagGroupBy(groupBy);
    if (scope.scopeType === "upload") {
      return factConfigByGranularity[effectiveGranularity];
    }

    if (tagFilter) {
      return factConfigByGranularity[effectiveGranularity];
    }

    if (tagGroup.isTagGroup) {
      return factConfigByGranularity[effectiveGranularity];
    }

    if (groupBy === "resource") {
      return factConfigByGranularity[effectiveGranularity];
    }
    return aggregationConfigByGranularity[effectiveGranularity];
  }

  private buildScopeWhereClause(
    scope: DashboardScope,
    config: SourceConfig,
    from: string,
    to: string,
    startIndex: number = 1,
    tagFilter?: TagFilterContext | null,
  ): SqlFilterBuild {
    const conditions: string[] = [];
    const params: unknown[] = [];

    const pushEq = (column: string, value: unknown): void => {
      params.push(value);
      conditions.push(`${column} = $${startIndex + params.length - 1}`);
    };

    const pushAnyArray = (column: string, values: number[]): void => {
      params.push(values);
      conditions.push(`${column} = ANY($${startIndex + params.length - 1}::bigint[])`);
    };

    const pushRange = (column: string, fromValue: string, toValue: string): void => {
      params.push(fromValue);
      const fromIndex = startIndex + params.length - 1;
      params.push(toValue);
      const toIndex = startIndex + params.length - 1;
      conditions.push(`${column} BETWEEN $${fromIndex} AND $${toIndex}`);
    };

    if (scope.scopeType === "upload") {
      pushAnyArray(`${config.alias}.ingestion_run_id`, scope.ingestionRunIds);
      if (config.dateRangeMode === "month") {
        pushRange(config.dateFilterExpression, getMonthStart(from), getMonthStart(to));
      } else {
        pushRange(config.dateFilterExpression, from, to);
      }
      if (tagFilter) {
        params.push(tagFilter.normalizedKey);
        const keyIndex = startIndex + params.length - 1;
        let existsClause = `
          EXISTS (
            SELECT 1
            FROM fact_cost_line_item_tags flt_filter
            JOIN dim_tag dt_filter ON dt_filter.id = flt_filter.tag_id
            WHERE flt_filter.fact_id = ${config.alias}.id
              AND dt_filter.normalized_key = $${keyIndex}
          )
        `;
        if (tagFilter.normalizedValue) {
          params.push(tagFilter.normalizedValue);
          const valueIndex = startIndex + params.length - 1;
          existsClause = existsClause.replace(
            "\n          )",
            `\n              AND dt_filter.normalized_value = $${valueIndex}\n          )`,
          );
        }
        conditions.push(existsClause);
      }
      return {
        whereClause: conditions.join("\n      AND "),
        params,
        nextIndex: startIndex + params.length,
      };
    }

    pushEq(`${config.alias}.tenant_id`, scope.tenantId);
    if (config.dateRangeMode === "month") {
      pushRange(config.dateFilterExpression, getMonthStart(from), getMonthStart(to));
    } else {
      pushRange(config.dateFilterExpression, from, to);
    }

    if (typeof scope.providerId === "number") {
      pushEq(`${config.alias}.provider_id`, scope.providerId);
    }
    const billingSourceIds =
      "billingSourceIds" in scope ? (scope as { billingSourceIds?: number[] }).billingSourceIds : undefined;
    if (Array.isArray(billingSourceIds) && billingSourceIds.length > 0) {
      pushAnyArray(`${config.alias}.billing_source_id`, billingSourceIds);
    }
    if (typeof scope.subAccountKey === "number") {
      pushEq(`${config.alias}.sub_account_key`, scope.subAccountKey);
    }
    if (typeof scope.serviceKey === "number") {
      pushEq(`${config.alias}.service_key`, scope.serviceKey);
    }
    if (typeof scope.regionKey === "number") {
      pushEq(`${config.alias}.region_key`, scope.regionKey);
    }

    if (tagFilter) {
      params.push(tagFilter.normalizedKey);
      const keyIndex = startIndex + params.length - 1;
      let existsClause = `
        EXISTS (
          SELECT 1
          FROM fact_cost_line_item_tags flt_filter
          JOIN dim_tag dt_filter ON dt_filter.id = flt_filter.tag_id
          WHERE flt_filter.fact_id = ${config.alias}.id
            AND dt_filter.normalized_key = $${keyIndex}
        )
      `;
      if (tagFilter.normalizedValue) {
        params.push(tagFilter.normalizedValue);
        const valueIndex = startIndex + params.length - 1;
        existsClause = existsClause.replace(
          "\n        )",
          `\n            AND dt_filter.normalized_value = $${valueIndex}\n        )`,
        );
      }
      conditions.push(existsClause);
    }

    return {
      whereClause: conditions.join("\n      AND "),
      params,
      nextIndex: startIndex + params.length,
    };
  }

  private async getTotalsByBucket(
    scope: DashboardScope,
    effectiveGranularity: CostExplorerGranularity,
    metric: CostExplorerMetric,
    from: string,
    to: string,
    tagFilter?: TagFilterContext | null,
  ): Promise<Array<{ bucketStart: string; value: number }>> {
    const config = this.getSourceConfig(scope, effectiveGranularity, undefined, tagFilter);
    const where = this.buildScopeWhereClause(scope, config, from, to, 1, tagFilter);
    const metricColumn = resolveMetricColumn(metric);

    const rows = await sequelize.query<BucketValueRow>(
      `
        SELECT
          ${config.bucketExpression} AS bucket,
          COALESCE(SUM(${config.alias}.${metricColumn}), 0)::double precision AS value
        FROM ${config.tableName} ${config.alias}
        WHERE ${where.whereClause}
        GROUP BY 1
        ORDER BY 1;
      `,
      { bind: where.params, type: QueryTypes.SELECT },
    );

    return rows.map((row) => ({
      bucketStart: toBucketStartIso(row.bucket),
      value: toNumber(row.value),
    }));
  }

  private async getTopGroupKeys(
    scope: DashboardScope,
    effectiveGranularity: CostExplorerGranularity,
    metric: CostExplorerMetric,
    from: string,
    to: string,
    groupBy: Exclude<CostExplorerGroupBy, "none">,
    limit: number,
    tagFilter?: TagFilterContext | null,
  ): Promise<Array<{ key: GroupDimensionKey; name: string }>> {
    const config = this.getSourceConfig(scope, effectiveGranularity, groupBy, tagFilter);
    const where = this.buildScopeWhereClause(scope, config, from, to, 1, tagFilter);
    const metricColumn = resolveMetricColumn(metric);

    const dimension = this.getDimensionSql(groupBy, config.alias);

    const rows = await sequelize.query<GroupTotalRow>(
      `
        SELECT
          ${dimension.keyColumn} AS dim_key,
          ${dimension.nameExpression} AS dim_name,
          COALESCE(SUM(${config.alias}.${metricColumn}), 0)::double precision AS total
        FROM ${config.tableName} ${config.alias}
        ${dimension.joinClause}
        WHERE ${where.whereClause}
        GROUP BY ${dimension.groupByColumns}
        ORDER BY total DESC
        LIMIT $${where.nextIndex};
      `,
      { bind: [...where.params, limit], type: QueryTypes.SELECT },
    );

    return rows
      .filter((row) => row.dim_key !== null)
      .map((row) => {
        const rawKey = row.dim_key as number | string;
        const normalizedKey =
          dimension.keyType === "string" ? String(rawKey) : Number(rawKey);
        return {
          key: normalizedKey,
          name: row.dim_name ?? "Unspecified",
        };
      })
      .filter((row) =>
        typeof row.key === "string" ? row.key.trim().length > 0 : Number.isFinite(row.key),
      );
  }

  private async getGroupedValuesByBucket(
    scope: DashboardScope,
    effectiveGranularity: CostExplorerGranularity,
    metric: CostExplorerMetric,
    from: string,
    to: string,
    groupBy: Exclude<CostExplorerGroupBy, "none">,
    groupKeys: GroupDimensionKey[],
    tagFilter?: TagFilterContext | null,
  ): Promise<Array<{ bucketStart: string; key: GroupDimensionKey; value: number }>> {
    if (!groupKeys.length) return [];

    const config = this.getSourceConfig(scope, effectiveGranularity, groupBy, tagFilter);
    const where = this.buildScopeWhereClause(scope, config, from, to, 1, tagFilter);
    const metricColumn = resolveMetricColumn(metric);
    const dimension = this.getDimensionSql(groupBy, config.alias);
    const keyArrayCast = dimension.keyType === "string" ? "text[]" : "bigint[]";
    const normalizeKey = (key: number | string | null): GroupDimensionKey | null => {
      if (key === null) return null;
      return dimension.keyType === "string" ? String(key) : Number(key);
    };

    const rows = await sequelize.query<BucketDimValueRow>(
      `
        SELECT
          ${config.bucketExpression} AS bucket,
          ${dimension.keyColumn} AS dim_key,
          COALESCE(SUM(${config.alias}.${metricColumn}), 0)::double precision AS value
        FROM ${config.tableName} ${config.alias}
        ${dimension.joinClause}
        WHERE ${where.whereClause}
          AND ${dimension.keyColumn} = ANY($${where.nextIndex}::${keyArrayCast})
        GROUP BY 1, 2
        ORDER BY 1;
      `,
      {
        bind: [...where.params, groupKeys],
        type: QueryTypes.SELECT,
      },
    );

    return rows
      .map((row) => {
        const key = normalizeKey(row.dim_key);
        return {
          bucketStart: toBucketStartIso(row.bucket),
          key,
          value: toNumber(row.value),
        };
      })
      .filter((row): row is { bucketStart: string; key: GroupDimensionKey; value: number } => {
        if (row.key === null) return false;
        return typeof row.key === "string" ? row.key.trim().length > 0 : Number.isFinite(row.key);
      });
  }

  private async getBudgetTotal(tenantId: string, from: string, to: string): Promise<number> {
    const rows = await sequelize.query<{ total_budget: number | string | null }>(
      `
        WITH selected_budget AS (
          SELECT b.*
          FROM budgets b
          WHERE b.tenant_id = $1
            AND b.period = 'monthly'
            AND COALESCE(NULLIF(b.scope_filter->>'status', ''), 'active') = 'active'
            AND b.start_date <= CURRENT_DATE
            AND (b.end_date IS NULL OR b.end_date >= CURRENT_DATE)
          ORDER BY b.updated_at DESC, b.created_at DESC
          LIMIT 1
        )
        SELECT
          COALESCE(SUM(sb.budget_amount), 0)::double precision AS total_budget
        FROM selected_budget sb
        WHERE sb.start_date <= $2
          AND (sb.end_date IS NULL OR sb.end_date >= $3);
      `,
      {
        bind: [tenantId, to, from],
        type: QueryTypes.SELECT,
      },
    );
    return toNumber(rows[0]?.total_budget);
  }

  private async getForecastTotal(tenantId: string, from: string, to: string): Promise<number> {
    const rows = await sequelize.query<{ total_forecast: number | string | null }>(
      `
        WITH selected_budget AS (
          SELECT b.*
          FROM budgets b
          WHERE b.tenant_id = $1
            AND b.period = 'monthly'
            AND COALESCE(NULLIF(b.scope_filter->>'status', ''), 'active') = 'active'
            AND b.start_date <= CURRENT_DATE
            AND (b.end_date IS NULL OR b.end_date >= CURRENT_DATE)
          ORDER BY b.updated_at DESC, b.created_at DESC
          LIMIT 1
        )
        SELECT
          COALESCE(SUM(be.forecast_spend), 0)::double precision AS total_forecast
        FROM budget_evaluations be
        JOIN selected_budget sb ON sb.id = be.budget_id
        WHERE be.evaluated_at::date BETWEEN $2 AND $3;
      `,
      {
        bind: [tenantId, from, to],
        type: QueryTypes.SELECT,
      },
    );
    return toNumber(rows[0]?.total_forecast);
  }

  private async getTopServicesByCategory(
    scope: DashboardScope,
    filters: CostExplorerEffectiveFilters,
    categories: string[],
    perCategoryLimit: number,
  ): Promise<Map<string, string[]>> {
    if (!categories.length) {
      return new Map();
    }

    const tagFilter = this.parseTagFilter(filters.tagKey, filters.tagValue);
    const config = this.getSourceConfig(scope, filters.effectiveGranularity, "service-category", tagFilter);
    const metricColumn = resolveMetricColumn(filters.metric);
    const where = this.buildScopeWhereClause(scope, config, filters.from, filters.to, 1, tagFilter);

    const rows = await sequelize.query<CategoryServiceRow>(
      `
        WITH ranked_services AS (
          SELECT
            COALESCE(ds.service_category, 'Unspecified') AS category,
            COALESCE(ds.service_name, 'Unspecified') AS service_name,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(ds.service_category, 'Unspecified')
              ORDER BY COALESCE(SUM(${config.alias}.${metricColumn}), 0)::double precision DESC, COALESCE(ds.service_name, 'Unspecified')
            ) AS rn
          FROM ${config.tableName} ${config.alias}
          LEFT JOIN dim_service ds ON ds.id = ${config.alias}.service_key
          WHERE ${where.whereClause}
            AND COALESCE(ds.service_category, 'Unspecified') = ANY($${where.nextIndex}::text[])
          GROUP BY 1, 2
        )
        SELECT
          category,
          service_name
        FROM ranked_services
        WHERE rn <= $${where.nextIndex + 1}
        ORDER BY category, rn;
      `,
      {
        bind: [...where.params, categories, perCategoryLimit],
        type: QueryTypes.SELECT,
      },
    );

    const byCategory = new Map<string, string[]>();
    rows.forEach((row) => {
      const category = row.category ?? "Unspecified";
      const serviceName = row.service_name ?? "Unspecified";
      const list = byCategory.get(category) ?? [];
      if (!list.includes(serviceName)) {
        list.push(serviceName);
      }
      byCategory.set(category, list);
    });
    return byCategory;
  }

  private async getResourceDetailsByKeys(
    scope: DashboardScope,
    filters: CostExplorerEffectiveFilters,
    resourceKeys: number[],
    perResourceLimit: number,
  ): Promise<Map<number, { services: string[]; resourceTypes: string[] }>> {
    if (!resourceKeys.length) {
      return new Map();
    }

    const tagFilter = this.parseTagFilter(filters.tagKey, filters.tagValue);
    const config = this.getSourceConfig(scope, filters.effectiveGranularity, "resource", tagFilter);
    const metricColumn = resolveMetricColumn(filters.metric);
    const where = this.buildScopeWhereClause(scope, config, filters.from, filters.to, 1, tagFilter);

    const rows = await sequelize.query<ResourceDetailRow>(
      `
        WITH ranked_resource_details AS (
          SELECT
            ${config.alias}.resource_key AS resource_key,
            COALESCE(ds.service_name, 'Unspecified') AS service_name,
            COALESCE(dres.resource_type, 'Unspecified') AS resource_type,
            ROW_NUMBER() OVER (
              PARTITION BY ${config.alias}.resource_key
              ORDER BY COALESCE(SUM(${config.alias}.${metricColumn}), 0)::double precision DESC
            ) AS rn
          FROM ${config.tableName} ${config.alias}
          LEFT JOIN dim_service ds ON ds.id = ${config.alias}.service_key
          LEFT JOIN dim_resource dres ON dres.id = ${config.alias}.resource_key
          WHERE ${where.whereClause}
            AND ${config.alias}.resource_key = ANY($${where.nextIndex}::bigint[])
          GROUP BY 1, 2, 3
        )
        SELECT
          resource_key,
          service_name,
          resource_type
        FROM ranked_resource_details
        WHERE rn <= $${where.nextIndex + 1}
        ORDER BY resource_key, rn;
      `,
      {
        bind: [...where.params, resourceKeys, perResourceLimit],
        type: QueryTypes.SELECT,
      },
    );

    const byResource = new Map<number, { services: string[]; resourceTypes: string[] }>();
    rows.forEach((row) => {
      const key = Number(row.resource_key);
      if (!Number.isFinite(key)) return;

      const detail = byResource.get(key) ?? { services: [], resourceTypes: [] };
      const serviceName = (row.service_name ?? "Unspecified").trim() || "Unspecified";
      const resourceType = (row.resource_type ?? "Unspecified").trim() || "Unspecified";

      if (!detail.services.includes(serviceName)) {
        detail.services.push(serviceName);
      }
      if (!detail.resourceTypes.includes(resourceType)) {
        detail.resourceTypes.push(resourceType);
      }
      byResource.set(key, detail);
    });

    return byResource;
  }

  private getDimensionSql(groupBy: Exclude<CostExplorerGroupBy, "none">, alias: string): GroupDimensionSql {
    const tagGroup = this.parseTagGroupBy(groupBy);
    if (tagGroup.isTagGroup) {
      const normalizedKeyEscaped = tagGroup.normalizedKey.replace(/'/g, "''");
      return {
        keyColumn: "dt.normalized_value",
        joinClause: `
          LEFT JOIN fact_cost_line_item_tags flt ON flt.fact_id = ${alias}.id
          LEFT JOIN dim_tag dt ON dt.id = flt.tag_id AND dt.normalized_key = '${normalizedKeyEscaped}'
        `,
        nameExpression: "COALESCE(MIN(dt.tag_value), 'Unspecified')",
        groupByColumns: "dt.normalized_value",
        keyType: "string",
      };
    }

    if (groupBy === "service") {
      return {
        keyColumn: `${alias}.service_key`,
        joinClause: `LEFT JOIN dim_service ds ON ds.id = ${alias}.service_key`,
        nameExpression: "COALESCE(ds.service_name, 'Unspecified')",
        groupByColumns: `${alias}.service_key, ds.service_name`,
        keyType: "number",
      };
    }

    if (groupBy === "service-category") {
      return {
        keyColumn: "COALESCE(ds.service_category, 'Unspecified')",
        joinClause: `LEFT JOIN dim_service ds ON ds.id = ${alias}.service_key`,
        nameExpression: "COALESCE(ds.service_category, 'Unspecified')",
        groupByColumns: "COALESCE(ds.service_category, 'Unspecified')",
        keyType: "string",
      };
    }

    if (groupBy === "resource") {
      return {
        keyColumn: `${alias}.resource_key`,
        joinClause: `
          LEFT JOIN dim_resource dres ON dres.id = ${alias}.resource_key
          LEFT JOIN dim_service ds ON ds.id = ${alias}.service_key
        `,
        nameExpression: "COALESCE(dres.resource_name, dres.resource_id, 'Unspecified')",
        groupByColumns: `${alias}.resource_key, dres.resource_name, dres.resource_id`,
        keyType: "number",
      };
    }

    if (groupBy === "account") {
      return {
        keyColumn: `${alias}.sub_account_key`,
        joinClause: `LEFT JOIN dim_sub_account dsa ON dsa.id = ${alias}.sub_account_key`,
        nameExpression: "COALESCE(dsa.sub_account_name, dsa.sub_account_id, 'Unspecified')",
        groupByColumns: `${alias}.sub_account_key, dsa.sub_account_name, dsa.sub_account_id`,
        keyType: "number",
      };
    }

    return {
      keyColumn: `${alias}.region_key`,
      joinClause: `LEFT JOIN dim_region dr ON dr.id = ${alias}.region_key`,
      nameExpression: "COALESCE(dr.region_name, 'Unspecified')",
      groupByColumns: `${alias}.region_key, dr.region_name`,
      keyType: "number",
    };
  }

  async getGroupOptions(
    scope: DashboardScope,
    from: string,
    to: string,
    tagKey: string | null,
  ): Promise<CostExplorerGroupOptionsResponse> {
    const config = factConfigByGranularity.daily;
    const where = this.buildScopeWhereClause(scope, config, from, to);

    const tagKeyRows = await sequelize.query<
      { normalized_key: string | null; display_key: string | null; tag_count: number | string | null }
    >(
      `
        SELECT
          dt.normalized_key,
          COALESCE(MIN(dt.tag_key), dt.normalized_key) AS display_key,
          COUNT(*)::double precision AS tag_count
        FROM ${config.tableName} ${config.alias}
        JOIN fact_cost_line_item_tags flt ON flt.fact_id = ${config.alias}.id
        JOIN dim_tag dt ON dt.id = flt.tag_id
        WHERE ${where.whereClause}
        GROUP BY dt.normalized_key
        ORDER BY COUNT(*) DESC, dt.normalized_key ASC;
      `,
      { bind: where.params, type: QueryTypes.SELECT },
    );

    const tagKeyOptions = tagKeyRows
      .filter((row) => typeof row.normalized_key === "string" && row.normalized_key.trim().length > 0)
      .map((row) => ({
        key: `tag:${String(row.normalized_key)}`,
        normalizedKey: String(row.normalized_key),
        count: toNumber(row.tag_count),
        label: String(row.display_key ?? row.normalized_key),
      }));

    const tagValueOptions =
      tagKey && /^[a-z0-9]+$/.test(tagKey)
        ? await sequelize.query<{ normalized_value: string | null; display_value: string | null; tag_count: number | string | null }>(
            `
              SELECT
                dt.normalized_value,
                COALESCE(MIN(dt.tag_value), dt.normalized_value) AS display_value,
                COUNT(*)::double precision AS tag_count
              FROM ${config.tableName} ${config.alias}
              JOIN fact_cost_line_item_tags flt ON flt.fact_id = ${config.alias}.id
              JOIN dim_tag dt ON dt.id = flt.tag_id
              WHERE ${where.whereClause}
                AND dt.normalized_key = $${where.nextIndex}
              GROUP BY dt.normalized_value
              ORDER BY COUNT(*) DESC, dt.normalized_value ASC;
            `,
            { bind: [...where.params, tagKey], type: QueryTypes.SELECT },
          )
        : [];

    return {
      baseOptions: [
        { key: "none", label: "None" },
        { key: "service", label: "Service" },
        { key: "service-category", label: "Service Category" },
        { key: "resource", label: "Resource" },
        { key: "region", label: "Region" },
        { key: "account", label: "Account" },
      ],
      tagKeyOptions: tagKeyOptions.map((entry) => ({
        key: entry.key,
        normalizedKey: entry.normalizedKey,
        count: entry.count,
      })),
      tagValueOptions: tagValueOptions
        .filter((row) => typeof row.normalized_value === "string" && row.normalized_value.trim().length > 0)
        .map((row) => ({
          key: String(row.display_value ?? row.normalized_value),
          normalizedValue: String(row.normalized_value),
          count: toNumber(row.tag_count),
        })),
    };
  }

  async getChartData(
    scope: DashboardScope,
    filters: CostExplorerEffectiveFilters,
  ): Promise<{
    labels: Array<{ bucketStart: string; short: string; long: string }>;
    series: CostExplorerSeries[];
    periodSpend: number;
    previousPeriodSpend: number;
  }> {
    const effectiveTagFilter = this.parseTagFilter(
      filters.tagKey ?? (filters.groupBy.startsWith("tag:") ? filters.groupBy.slice(4) : null),
      filters.tagValue,
    );
    const currentTotals = await this.getTotalsByBucket(
      scope,
      filters.effectiveGranularity,
      filters.metric,
      filters.from,
      filters.to,
      effectiveTagFilter,
    );

    const labels = currentTotals.map((entry) => {
      const label = formatBucket(entry.bucketStart, filters.effectiveGranularity);
      return {
        bucketStart: entry.bucketStart,
        short: label.short,
        long: label.long,
      };
    });

    const periodSpend = currentTotals.reduce((sum, row) => sum + row.value, 0);
    const currentValues = currentTotals.map((entry) => entry.value);
    const series: CostExplorerSeries[] = [];

    if (filters.groupBy === "none") {
      series.push({
        name: metricLabel(filters.metric),
        kind: "primary",
        values: currentValues,
      });
    } else {
      const chartGroupLimit =
        filters.groupBy === "service" || filters.groupBy === "service-category" || filters.groupBy === "resource"
          ? 7
          : 5;
      const topGroups = await this.getTopGroupKeys(
        scope,
        filters.effectiveGranularity,
        filters.metric,
        filters.from,
        filters.to,
        filters.groupBy,
        chartGroupLimit,
        effectiveTagFilter,
      );

      const byBucket = await this.getGroupedValuesByBucket(
        scope,
        filters.effectiveGranularity,
        filters.metric,
        filters.from,
        filters.to,
        filters.groupBy,
        topGroups.map((entry) => entry.key),
        effectiveTagFilter,
      );

      const bucketIndexByStart = new Map(labels.map((label, index) => [label.bucketStart, index]));
      const valuesByGroup = new Map<GroupDimensionKey, number[]>();
      topGroups.forEach((group) => {
        valuesByGroup.set(group.key, Array(labels.length).fill(0));
      });

      for (const row of byBucket) {
        const rowIndex = bucketIndexByStart.get(row.bucketStart);
        const groupValues = valuesByGroup.get(row.key);
        if (typeof rowIndex === "number" && groupValues) {
          groupValues[rowIndex] = row.value;
        }
      }

      topGroups.forEach((group) => {
        series.push({
          name: group.name,
          kind: "group",
          values: valuesByGroup.get(group.key) ?? Array(labels.length).fill(0),
        });
      });
    }

    const previousRange = buildPreviousPeriod(filters.from, filters.to);
    const previousTotals = await this.getTotalsByBucket(
      scope,
      filters.effectiveGranularity,
      filters.metric,
      previousRange.from,
      previousRange.to,
      effectiveTagFilter,
    );
    const previousPeriodSpend = previousTotals.reduce((sum, row) => sum + row.value, 0);

    if (filters.compareKey) {
      const comparisonValues = Array(labels.length).fill(0);

      if (filters.compareKey === "previous-month") {
        for (let index = 0; index < comparisonValues.length; index += 1) {
          comparisonValues[index] = previousTotals[index]?.value ?? 0;
        }
      } else if (filters.compareKey === "budget") {
        const totalBudget = await this.getBudgetTotal(scope.tenantId, filters.from, filters.to);
        const perBucket = labels.length > 0 ? totalBudget / labels.length : 0;
        for (let index = 0; index < comparisonValues.length; index += 1) {
          comparisonValues[index] = perBucket;
        }
      } else if (filters.compareKey === "forecast") {
        const totalForecast = await this.getForecastTotal(scope.tenantId, filters.from, filters.to);
        const perBucket = labels.length > 0 ? totalForecast / labels.length : 0;
        for (let index = 0; index < comparisonValues.length; index += 1) {
          comparisonValues[index] = perBucket;
        }
      }

      series.push({
        name: comparisonLabel(filters.compareKey),
        kind: "comparison",
        compareKey: filters.compareKey,
        values: comparisonValues,
      });
    }

    return {
      labels,
      series,
      periodSpend,
      previousPeriodSpend,
    };
  }

  async getBreakdownByDimension(
    scope: DashboardScope,
    filters: CostExplorerEffectiveFilters,
    dimension: Exclude<CostExplorerGroupBy, "none">,
    limit: number,
  ): Promise<CostExplorerBreakdownRow[]> {
    const effectiveTagFilter = this.parseTagFilter(
      filters.tagKey ?? (filters.groupBy.startsWith("tag:") ? filters.groupBy.slice(4) : null),
      filters.tagValue,
    );
    const config = this.getSourceConfig(scope, filters.effectiveGranularity, dimension, effectiveTagFilter);
    const metricColumn = resolveMetricColumn(filters.metric);
    const currentWhere = this.buildScopeWhereClause(scope, config, filters.from, filters.to, 1, effectiveTagFilter);
    const previous = buildPreviousPeriod(filters.from, filters.to);
    const previousWhere = this.buildScopeWhereClause(
      scope,
      config,
      previous.from,
      previous.to,
      1,
      effectiveTagFilter,
    );
    const dim = this.getDimensionSql(dimension, config.alias);

    const currentRows = await sequelize.query<GroupTotalRow>(
      `
        SELECT
          ${dim.keyColumn} AS dim_key,
          ${dim.nameExpression} AS dim_name,
          COALESCE(SUM(${config.alias}.${metricColumn}), 0)::double precision AS total
        FROM ${config.tableName} ${config.alias}
        ${dim.joinClause}
        WHERE ${currentWhere.whereClause}
        GROUP BY ${dim.groupByColumns}
        ORDER BY total DESC
        LIMIT $${currentWhere.nextIndex};
      `,
      { bind: [...currentWhere.params, limit], type: QueryTypes.SELECT },
    );

    if (!currentRows.length) {
      return [];
    }

    const normalizeKey = (key: number | string | null): GroupDimensionKey | null => {
      if (key === null) return null;
      return dim.keyType === "string" ? String(key) : Number(key);
    };

    const keys = currentRows
      .map((row) => normalizeKey(row.dim_key))
      .filter((value): value is GroupDimensionKey =>
        typeof value === "string" ? value.trim().length > 0 : Number.isFinite(value),
      );

    const keyArrayCast = dim.keyType === "string" ? "text[]" : "bigint[]";

    const previousRows =
      keys.length > 0
        ? await sequelize.query<CostByKeyRow>(
            `
              SELECT
                ${dim.keyColumn} AS dim_key,
                COALESCE(SUM(${config.alias}.${metricColumn}), 0)::double precision AS cost
              FROM ${config.tableName} ${config.alias}
              ${dim.joinClause}
              WHERE ${previousWhere.whereClause}
                AND ${dim.keyColumn} = ANY($${previousWhere.nextIndex}::${keyArrayCast})
              GROUP BY ${dim.keyColumn};
            `,
            { bind: [...previousWhere.params, keys], type: QueryTypes.SELECT },
          )
        : [];

    const previousByKey = new Map<GroupDimensionKey, number>();
    previousRows.forEach((row) => {
      const key = normalizeKey(row.dim_key);
      if (key === null) return;
      previousByKey.set(key, toNumber(row.cost));
    });

    const categoryServiceMap =
      dimension === "service-category"
        ? await this.getTopServicesByCategory(
            scope,
            filters,
            keys.filter((key): key is string => typeof key === "string"),
            6,
          )
        : new Map<string, string[]>();

    const resourceDetailMap =
      dimension === "resource"
        ? await this.getResourceDetailsByKeys(
            scope,
            filters,
            keys.filter((key): key is number => typeof key === "number"),
            6,
          )
        : new Map<number, { services: string[]; resourceTypes: string[] }>();

    return currentRows.map((row) => {
      const key = normalizeKey(row.dim_key);
      const cost = toNumber(row.total);
      const previousCost = key === null ? 0 : previousByKey.get(key) ?? 0;
      const changePct = previousCost > 0 ? ((cost - previousCost) / previousCost) * 100 : 0;
      const resourceDetails =
        dimension === "resource" && typeof key === "number"
          ? resourceDetailMap.get(key) ?? { services: [], resourceTypes: [] }
          : { services: [], resourceTypes: [] };

      return {
        key,
        name: row.dim_name ?? "Unspecified",
        cost,
        changePct,
        relatedServices:
          dimension === "service-category" && typeof key === "string"
            ? categoryServiceMap.get(key) ?? []
            : dimension === "resource"
              ? resourceDetails.services
            : undefined,
        relatedResourceTypes: dimension === "resource" ? resourceDetails.resourceTypes : undefined,
      };
    });
  }
}

export const computeEffectiveGranularity = (
  requestedGranularity: CostExplorerGranularity,
  from: string,
  to: string,
): CostExplorerGranularity => {
  if (requestedGranularity !== "hourly") {
    return requestedGranularity;
  }

  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return "daily";
  }

  const dayDiff = Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  return dayDiff > 14 ? "daily" : "hourly";
};
