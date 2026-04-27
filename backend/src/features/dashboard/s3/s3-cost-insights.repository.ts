import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type { DashboardScope } from "../dashboard.types.js";
import { buildDashboardFilter } from "../shared/filter-builder.js";
import type {
  S3CostBucketInsight,
  S3CostBucketTableInsight,
  S3CostCategory,
  S3CostChartBy,
  S3CostInsightsFilters,
  S3CostSeriesBy,
  S3CostFeatureTrendInsight,
  S3CostTrendInsight,
} from "./s3-cost-insights.types.js";

type S3KpiRow = {
  total_s3_cost: number | string | null;
};

type S3EffectiveKpiRow = {
  total_effective_s3_cost: number | string | null;
};

type S3BucketRow = {
  bucket_name: string | null;
  billed_cost: number | string | null;
  effective_cost: number | string | null;
};

type S3TrendRow = {
  usage_start_time: string | null;
  billed_cost: number | string | null;
  effective_cost: number | string | null;
};

type S3BucketBreakdownRow = {
  bucket_name: string | null;
  cost: number | string | null;
  storage: number | string | null;
  requests: number | string | null;
  transfer: number | string | null;
  region: string | null;
  owner: string | null;
  driver: string | null;
  savings: number | string | null;
  retrieval: number | string | null;
  other: number | string | null;
};

type S3FeatureTrendRow = {
  usage_start_time: string | null;
  storage: number | string | null;
  requests: number | string | null;
  retrieval: number | string | null;
  transfer: number | string | null;
  bucket: number | string | null;
  bucket_storage_class: number | string | null;
  other: number | string | null;
  total: number | string | null;
};

type S3BreakdownRow = {
  x_value: string | null;
  series_value: string | null;
  billed_cost: number | string | null;
};

type S3OptionRow = {
  value: string | null;
};

const S3_FILTER_SQL = `
(
  LOWER(COALESCE(ds.service_name, '')) LIKE '%s3%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%simple storage service%'
  OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%s3%'
  OR LOWER(COALESCE(dres.resource_id, '')) LIKE 'arn:aws:s3:::%'
  OR LOWER(COALESCE(dres.resource_id, '')) LIKE 's3://%'
)
`;

const S3_SERVICE_NAME_FILTER_SQL = `
(
  LOWER(COALESCE(ds.service_name, '')) LIKE '%s3%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%simple storage service%'
)
`;

const S3_BUCKET_NAME_SQL = `
CASE
  WHEN COALESCE(dres.resource_id, '') = '' THEN 'unattributed'
  WHEN LOWER(dres.resource_id) LIKE 'arn:aws:s3:::%' THEN NULLIF(SPLIT_PART(dres.resource_id, ':::', 2), '')
  WHEN LOWER(dres.resource_id) LIKE 's3://%' THEN NULLIF(SPLIT_PART(SUBSTRING(dres.resource_id FROM 6), '/', 1), '')
  ELSE dres.resource_id
END
`;

const S3_TRANSFER_COST_CONDITION_SQL = `
(
  LOWER(COALESCE(usage_type, '')) LIKE '%data%transfer%'
  OR LOWER(COALESCE(line_item_description, '')) LIKE '%data transfer%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%datatransfer%'
  OR LOWER(COALESCE(operation, '')) LIKE '%datatransfer%'
)
`;

const S3_REQUEST_COST_CONDITION_SQL = `
(
  LOWER(COALESCE(operation, '')) LIKE '%put%'
  OR LOWER(COALESCE(operation, '')) LIKE '%get%'
  OR LOWER(COALESCE(operation, '')) LIKE '%list%'
  OR LOWER(COALESCE(operation, '')) LIKE '%head%'
  OR LOWER(COALESCE(operation, '')) LIKE '%post%'
  OR LOWER(COALESCE(operation, '')) LIKE '%delete%'
  OR LOWER(COALESCE(operation, '')) LIKE '%select%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%requests%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%request%'
)
`;

const S3_STORAGE_COST_CONDITION_SQL = `
(
  LOWER(COALESCE(usage_type, '')) LIKE '%timedstorage%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%storage%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%bytehrs%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%gb-month%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%gbytehrs%'
)
`;

const S3_RETRIEVAL_COST_CONDITION_SQL = `
(
  LOWER(COALESCE(usage_type, '')) LIKE '%retrieval%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%dataretrieval%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%restore%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%glacier%retrieval%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%select%-scanned%'
  OR LOWER(COALESCE(line_item_description, '')) LIKE '%retrieval%'
  OR LOWER(COALESCE(line_item_description, '')) LIKE '%restore%'
  OR LOWER(COALESCE(line_item_description, '')) LIKE '%restore object%'
  OR LOWER(COALESCE(line_item_description, '')) LIKE '%data retrieval%'
  OR LOWER(COALESCE(operation, '')) LIKE '%restore%'
  OR LOWER(COALESCE(operation, '')) LIKE '%retrieval%'
  OR LOWER(COALESCE(operation, '')) LIKE '%restoreobject%'
  OR LOWER(COALESCE(operation, '')) LIKE '%selectobjectcontent%'
)
`;

const S3_BUCKET_COST_CONDITION_SQL = `
(
  LOWER(COALESCE(operation, '')) LIKE '%bucket%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%bucket%'
  OR LOWER(COALESCE(line_item_description, '')) LIKE '%bucket%'
)
`;

const S3_BUCKET_STORAGE_CLASS_CONDITION_SQL = `
(
  ${S3_STORAGE_COST_CONDITION_SQL}
  AND COALESCE(bucket_name, 'unattributed') <> 'unattributed'
  AND (
    LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%timedstorage%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%standardstorage%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%standardia%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%onezoneia%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%intelligenttiering%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%glacier%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%deeparchive%'
  )
)
`;

const S3_STORAGE_CLASS_LABEL_SQL = `
CASE
  WHEN LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%intelligenttieringfastorage-bytehrs%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%intelligenttieringfa%'
    THEN 'Intelligent Tiering (Frequent)'
  WHEN LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%intelligenttieringiastorage-bytehrs%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%intelligenttieringia%'
    THEN 'Intelligent Tiering (Infrequent)'
  WHEN LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%onezoneiastorage-bytehrs%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%onezone-ia%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%one zone-ia%'
    THEN 'One Zone-IA'
  WHEN LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%standardiastorage-bytehrs%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%standard-ia%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%standard ia%'
    THEN 'Standard-IA'
  WHEN LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%deeparchivestorage-bytehrs%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%deeparchive%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%deep archive%'
    THEN 'Deep Archive'
  WHEN LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%glacierstorage-bytehrs%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%glacier%'
    OR LOWER(COALESCE(operation, '')) LIKE '%glacier%'
    THEN 'Glacier'
  WHEN LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%timedstorage-bytehrs%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%timedstorage%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%standardstorage%'
    THEN 'S3 Standard'
  ELSE 'Unknown'
END
`;

const S3_COST_CATEGORY_SQL = `
CASE
  WHEN ${S3_TRANSFER_COST_CONDITION_SQL} THEN 'Transfer'
  WHEN ${S3_RETRIEVAL_COST_CONDITION_SQL} THEN 'Retrieval'
  WHEN ${S3_REQUEST_COST_CONDITION_SQL} THEN 'Request'
  WHEN ${S3_STORAGE_COST_CONDITION_SQL} THEN 'Storage'
  ELSE 'Other'
END
`;

const S3_COST_CATEGORY_OPTIONS: S3CostCategory[] = [
  "Storage",
  "Request",
  "Transfer",
  "Retrieval",
  "Other",
];

const S3_COST_BY_OPTIONS: S3CostChartBy[] = ["date", "bucket", "region", "account"];
const S3_SERIES_BY_OPTIONS: S3CostSeriesBy[] = ["cost_category", "usage_type", "operation", "product_family"];

const OWNER_TAG_KEYS_SQL = `
(
  'owner',
  'resource_owner',
  'business_owner',
  'owner_name',
  'team'
)
`;

const DRIVER_TAG_KEYS_SQL = `
(
  'cost_driver',
  'driver',
  'application',
  'app',
  'workload',
  'project'
)
`;

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export class S3CostInsightsRepository {
  private buildS3ScopedWhere(scope: DashboardScope): { whereClause: string; params: unknown[]; nextIndex: number } {
    const filter = buildDashboardFilter(scope);
    return {
      whereClause: `${filter.whereClause} AND ${S3_FILTER_SQL}`,
      params: filter.params,
      nextIndex: filter.params.length + 1,
    };
  }

  private buildS3FilterPredicates(
    filters: S3CostInsightsFilters,
    startIndex: number,
  ): { clause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const push = (condition: string, value: unknown) => {
      params.push(value);
      conditions.push(condition.replaceAll("?", `$${startIndex + params.length - 1}`));
    };

    if (filters.costCategory.length > 0) {
      push(`cost_category = ANY(?::text[])`, filters.costCategory);
    }
    if (filters.bucket && filters.bucket.trim().length > 0) {
      push(`LOWER(bucket_name) LIKE LOWER(?)`, `%${filters.bucket.trim()}%`);
    }
    if (filters.storageClass.length > 0) {
      push(`storage_class = ANY(?::text[])`, filters.storageClass);
    }
    if (filters.region.length > 0) {
      push(`region_name = ANY(?::text[])`, filters.region);
    }
    if (filters.account.length > 0) {
      push(`account_name = ANY(?::text[])`, filters.account);
    }

    return {
      clause: conditions.length > 0 ? conditions.join("\n          AND ") : "1=1",
      params,
    };
  }

  private getXAxisExpression(costBy: S3CostChartBy): string {
    switch (costBy) {
      case "bucket":
        return "bucket_name";
      case "region":
        return "region_name";
      case "account":
        return "account_name";
      case "date":
      default:
        return "usage_date";
    }
  }

  private getSeriesExpression(seriesBy: S3CostSeriesBy): string {
    switch (seriesBy) {
      case "usage_type":
        return "COALESCE(NULLIF(usage_type, ''), 'Unspecified')";
      case "operation":
        return "COALESCE(NULLIF(operation, ''), 'Unspecified')";
      case "product_family":
        return "COALESCE(NULLIF(product_family, ''), 'Unspecified')";
      case "cost_category":
      default:
        return "cost_category";
    }
  }

  async getBreakdownChart(
    scope: DashboardScope,
    filters: S3CostInsightsFilters,
  ): Promise<{
    labels: string[];
    series: Array<{ name: string; values: number[] }>;
  }> {
    const scoped = this.buildS3ScopedWhere(scope);
    const filterPredicates = this.buildS3FilterPredicates(filters, scoped.nextIndex);
    const xExpr = this.getXAxisExpression(filters.costBy);
    const seriesExpr = this.getSeriesExpression(filters.seriesBy);

    const rows = await sequelize.query<S3BreakdownRow>(
      `
      WITH base_scoped AS (
        SELECT
          COALESCE(DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)), dd.full_date)::text AS usage_date,
          COALESCE(NULLIF(${S3_BUCKET_NAME_SQL}, ''), 'unattributed') AS bucket_name,
          COALESCE(NULLIF(dr.region_name, ''), NULLIF(dr.region_id, ''), 'global') AS region_name,
          COALESCE(dsa.sub_account_name, dsa.sub_account_id, 'Unspecified') AS account_name,
          COALESCE(fcli.usage_type, '') AS usage_type,
          COALESCE(fcli.operation, '') AS operation,
          COALESCE(fcli.product_family, '') AS product_family,
          COALESCE(fcli.product_usage_type, '') AS product_usage_type,
          COALESCE(fcli.line_item_description, '') AS line_item_description,
          COALESCE(fcli.billed_cost, 0)::double precision AS billed_cost
        FROM fact_cost_line_items fcli
        LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
        LEFT JOIN dim_service ds ON ds.id = fcli.service_key
        LEFT JOIN dim_resource dres ON dres.id = fcli.resource_key
        LEFT JOIN dim_region dr ON dr.id = fcli.region_key
        LEFT JOIN dim_sub_account dsa ON dsa.id = fcli.sub_account_key
        WHERE ${scoped.whereClause}
      ),
      scoped AS (
        SELECT
          base_scoped.*,
          ${S3_STORAGE_CLASS_LABEL_SQL} AS storage_class,
          ${S3_COST_CATEGORY_SQL} AS cost_category
        FROM base_scoped
      ),
      filtered AS (
        SELECT *
        FROM scoped
        WHERE ${filterPredicates.clause}
      ),
      ranked_x AS (
        SELECT
          ${xExpr} AS x_value,
          SUM(billed_cost)::double precision AS total_cost,
          ROW_NUMBER() OVER (ORDER BY SUM(billed_cost) DESC, ${xExpr} ASC) AS rn
        FROM filtered
        GROUP BY ${xExpr}
      ),
      reduced AS (
        SELECT
          f.*,
          CASE
            WHEN $${scoped.nextIndex + filterPredicates.params.length}::text = 'date' THEN TRUE
            ELSE COALESCE(rx.rn, 999999) <= 30
          END AS keep_x
        FROM filtered f
        LEFT JOIN ranked_x rx ON rx.x_value = ${xExpr}
      )
      SELECT
        ${xExpr} AS x_value,
        ${seriesExpr} AS series_value,
        SUM(billed_cost)::double precision AS billed_cost
      FROM reduced
      WHERE keep_x = TRUE
      GROUP BY ${xExpr}, ${seriesExpr}
      ORDER BY
        CASE WHEN $${scoped.nextIndex + filterPredicates.params.length}::text = 'date' THEN ${xExpr} END ASC,
        CASE WHEN $${scoped.nextIndex + filterPredicates.params.length}::text <> 'date' THEN SUM(billed_cost) END DESC;
      `,
      {
        bind: [...scoped.params, ...filterPredicates.params, filters.costBy],
        type: QueryTypes.SELECT,
      },
    );

    const byX = new Map<string, Map<string, number>>();
    const totalsByX = new Map<string, number>();
    const totalsBySeries = new Map<string, number>();

    for (const row of rows) {
      const x = String(row.x_value ?? "Unspecified");
      const series = String(row.series_value ?? "Unspecified");
      const cost = toNumber(row.billed_cost);
      if (!byX.has(x)) {
        byX.set(x, new Map());
      }
      const seriesMap = byX.get(x)!;
      seriesMap.set(series, (seriesMap.get(series) ?? 0) + cost);
      totalsByX.set(x, (totalsByX.get(x) ?? 0) + cost);
      totalsBySeries.set(series, (totalsBySeries.get(series) ?? 0) + cost);
    }

    const labels = [...byX.keys()];
    if (filters.costBy === "date") {
      labels.sort((a, b) => a.localeCompare(b));
    } else {
      labels.sort((a, b) => (totalsByX.get(b) ?? 0) - (totalsByX.get(a) ?? 0));
    }

    const topSeries = [...totalsBySeries.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
    const topSeriesSet = new Set(topSeries);
    const includeOther = [...totalsBySeries.keys()].some((name) => !topSeriesSet.has(name));

    const series = topSeries.map((name) => ({
      name,
      values: labels.map((label) => byX.get(label)?.get(name) ?? 0),
    }));

    if (includeOther) {
      series.push({
        name: "Other",
        values: labels.map((label) => {
          const items = byX.get(label) ?? new Map<string, number>();
          let sum = 0;
          for (const [name, value] of items.entries()) {
            if (!topSeriesSet.has(name)) {
              sum += value;
            }
          }
          return sum;
        }),
      });
    }

    return { labels, series };
  }

  async getBreakdownFilterOptions(scope: DashboardScope): Promise<{
    costCategory: S3CostCategory[];
    bucket: string[];
    storageClass: string[];
    region: string[];
    account: string[];
    costBy: S3CostChartBy[];
    seriesBy: S3CostSeriesBy[];
  }> {
    const scoped = this.buildS3ScopedWhere(scope);
    const baseCte = `
      WITH base_scoped AS (
        SELECT
          COALESCE(NULLIF(${S3_BUCKET_NAME_SQL}, ''), 'unattributed') AS bucket_name,
          COALESCE(NULLIF(dr.region_name, ''), NULLIF(dr.region_id, ''), 'global') AS region_name,
          COALESCE(dsa.sub_account_name, dsa.sub_account_id, 'Unspecified') AS account_name,
          COALESCE(fcli.usage_type, '') AS usage_type,
          COALESCE(fcli.operation, '') AS operation,
          COALESCE(fcli.product_family, '') AS product_family,
          COALESCE(fcli.product_usage_type, '') AS product_usage_type,
          COALESCE(fcli.line_item_description, '') AS line_item_description,
          COALESCE(fcli.billed_cost, 0)::double precision AS billed_cost
        FROM fact_cost_line_items fcli
        LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
        LEFT JOIN dim_service ds ON ds.id = fcli.service_key
        LEFT JOIN dim_resource dres ON dres.id = fcli.resource_key
        LEFT JOIN dim_region dr ON dr.id = fcli.region_key
        LEFT JOIN dim_sub_account dsa ON dsa.id = fcli.sub_account_key
        WHERE ${scoped.whereClause}
      ),
      scoped AS (
        SELECT
          base_scoped.*,
          ${S3_STORAGE_CLASS_LABEL_SQL} AS storage_class,
          ${S3_COST_CATEGORY_SQL} AS cost_category
        FROM base_scoped
      )
    `;

    const [bucketRows, storageRows, regionRows, accountRows] = await Promise.all([
      sequelize.query<S3OptionRow>(
        `
        ${baseCte}
        SELECT bucket_name AS value
        FROM scoped
        GROUP BY bucket_name
        ORDER BY SUM(billed_cost) DESC, bucket_name ASC
        LIMIT 100;
        `,
        { bind: scoped.params, type: QueryTypes.SELECT },
      ),
      sequelize.query<S3OptionRow>(
        `
        ${baseCte}
        SELECT storage_class AS value
        FROM scoped
        GROUP BY storage_class
        ORDER BY storage_class ASC;
        `,
        { bind: scoped.params, type: QueryTypes.SELECT },
      ),
      sequelize.query<S3OptionRow>(
        `
        ${baseCte}
        SELECT region_name AS value
        FROM scoped
        GROUP BY region_name
        ORDER BY SUM(billed_cost) DESC, region_name ASC;
        `,
        { bind: scoped.params, type: QueryTypes.SELECT },
      ),
      sequelize.query<S3OptionRow>(
        `
        ${baseCte}
        SELECT account_name AS value
        FROM scoped
        GROUP BY account_name
        ORDER BY SUM(billed_cost) DESC, account_name ASC;
        `,
        { bind: scoped.params, type: QueryTypes.SELECT },
      ),
    ]);

    const normalize = (rows: S3OptionRow[]) =>
      rows
        .map((row) => String(row.value ?? "").trim())
        .filter((value) => value.length > 0);

    return {
      costCategory: S3_COST_CATEGORY_OPTIONS,
      bucket: normalize(bucketRows),
      storageClass: normalize(storageRows),
      region: normalize(regionRows),
      account: normalize(accountRows),
      costBy: S3_COST_BY_OPTIONS,
      seriesBy: S3_SERIES_BY_OPTIONS,
    };
  }

  async getTotalS3Cost(scope: DashboardScope): Promise<number> {
    const filter = buildDashboardFilter(scope);
    const rows = await sequelize.query<S3KpiRow>(
      `
      SELECT COALESCE(SUM(COALESCE(fcli.billed_cost, 0)), 0)::double precision AS total_s3_cost
      FROM fact_cost_line_items fcli
      LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
      LEFT JOIN dim_service ds ON ds.id = fcli.service_key
      LEFT JOIN dim_resource dres ON dres.id = fcli.resource_key
      WHERE ${filter.whereClause}
        AND ${S3_FILTER_SQL};
      `,
      { bind: filter.params, type: QueryTypes.SELECT },
    );

    return toNumber(rows[0]?.total_s3_cost);
  }

  async getTotalS3EffectiveCost(scope: DashboardScope): Promise<number> {
    const filter = buildDashboardFilter(scope);
    const rows = await sequelize.query<S3EffectiveKpiRow>(
      `
      SELECT COALESCE(SUM(COALESCE(fcli.effective_cost, 0)), 0)::double precision AS total_effective_s3_cost
      FROM fact_cost_line_items fcli
      LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
      LEFT JOIN dim_service ds ON ds.id = fcli.service_key
      LEFT JOIN dim_resource dres ON dres.id = fcli.resource_key
      WHERE ${filter.whereClause}
        AND ${S3_FILTER_SQL};
      `,
      { bind: filter.params, type: QueryTypes.SELECT },
    );

    return toNumber(rows[0]?.total_effective_s3_cost);
  }

  async getBucketCosts(scope: DashboardScope, limit: number = 250): Promise<S3CostBucketInsight[]> {
    const filter = buildDashboardFilter(scope);
    const rows = await sequelize.query<S3BucketRow>(
      `
      SELECT
        COALESCE(NULLIF(${S3_BUCKET_NAME_SQL}, ''), 'unattributed') AS bucket_name,
        COALESCE(SUM(COALESCE(fcli.billed_cost, 0)), 0)::double precision AS billed_cost,
        COALESCE(SUM(COALESCE(fcli.effective_cost, 0)), 0)::double precision AS effective_cost
      FROM fact_cost_line_items fcli
      LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
      LEFT JOIN dim_service ds ON ds.id = fcli.service_key
      LEFT JOIN dim_resource dres ON dres.id = fcli.resource_key
      WHERE ${filter.whereClause}
        AND ${S3_SERVICE_NAME_FILTER_SQL}
      GROUP BY COALESCE(NULLIF(${S3_BUCKET_NAME_SQL}, ''), 'unattributed')
      ORDER BY billed_cost DESC
      LIMIT $${filter.params.length + 1};
      `,
      { bind: [...filter.params, limit], type: QueryTypes.SELECT },
    );

    return rows.map((row) => ({
      bucketName: String(row.bucket_name ?? "unattributed"),
      billedCost: toNumber(row.billed_cost),
      effectiveCost: toNumber(row.effective_cost),
    }));
  }

  async getTrend(scope: DashboardScope): Promise<S3CostTrendInsight[]> {
    const filter = buildDashboardFilter(scope);
    const rows = await sequelize.query<S3TrendRow>(
      `
      SELECT
        COALESCE(DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)), dd.full_date)::text AS usage_start_time,
        COALESCE(SUM(COALESCE(fcli.billed_cost, 0)), 0)::double precision AS billed_cost,
        COALESCE(SUM(COALESCE(fcli.effective_cost, 0)), 0)::double precision AS effective_cost
      FROM fact_cost_line_items fcli
      LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
      LEFT JOIN dim_service ds ON ds.id = fcli.service_key
      LEFT JOIN dim_resource dres ON dres.id = fcli.resource_key
      WHERE ${filter.whereClause}
        AND ${S3_FILTER_SQL}
      GROUP BY COALESCE(DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)), dd.full_date)
      ORDER BY usage_start_time ASC;
      `,
      { bind: filter.params, type: QueryTypes.SELECT },
    );

    return rows
      .filter((row) => typeof row.usage_start_time === "string" && row.usage_start_time.length > 0)
      .map((row) => ({
        usageStartTime: String(row.usage_start_time),
        billedCost: toNumber(row.billed_cost),
        effectiveCost: toNumber(row.effective_cost),
      }));
  }

  async getFeatureTrend(scope: DashboardScope): Promise<S3CostFeatureTrendInsight[]> {
    const filter = buildDashboardFilter(scope);
    const rows = await sequelize.query<S3FeatureTrendRow>(
      `
      WITH filtered AS (
        SELECT
          COALESCE(DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)), dd.full_date)::text AS usage_start_time,
          COALESCE(NULLIF(${S3_BUCKET_NAME_SQL}, ''), 'unattributed') AS bucket_name,
          COALESCE(fcli.billed_cost, 0)::double precision AS billed_cost,
          COALESCE(fcli.usage_type, '') AS usage_type,
          COALESCE(fcli.product_usage_type, '') AS product_usage_type,
          COALESCE(fcli.operation, '') AS operation,
          COALESCE(fcli.line_item_description, '') AS line_item_description
        FROM fact_cost_line_items fcli
        LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
        LEFT JOIN dim_service ds ON ds.id = fcli.service_key
        LEFT JOIN dim_resource dres ON dres.id = fcli.resource_key
        WHERE ${filter.whereClause}
          AND ${S3_FILTER_SQL}
      ),
      categorized AS (
        SELECT
          usage_start_time,
          billed_cost,
          CASE
            WHEN ${S3_TRANSFER_COST_CONDITION_SQL} THEN 'transfer'
            WHEN ${S3_RETRIEVAL_COST_CONDITION_SQL} THEN 'retrieval'
            WHEN ${S3_BUCKET_STORAGE_CLASS_CONDITION_SQL} THEN 'bucket_storage_class'
            WHEN ${S3_BUCKET_COST_CONDITION_SQL} THEN 'bucket'
            WHEN ${S3_REQUEST_COST_CONDITION_SQL} THEN 'requests'
            WHEN ${S3_STORAGE_COST_CONDITION_SQL} THEN 'storage'
            ELSE 'other'
          END AS feature
        FROM filtered
      )
      SELECT
        usage_start_time,
        COALESCE(SUM(CASE WHEN feature = 'storage' THEN billed_cost ELSE 0 END), 0)::double precision AS storage,
        COALESCE(SUM(CASE WHEN feature = 'requests' THEN billed_cost ELSE 0 END), 0)::double precision AS requests,
        COALESCE(SUM(CASE WHEN feature = 'retrieval' THEN billed_cost ELSE 0 END), 0)::double precision AS retrieval,
        COALESCE(SUM(CASE WHEN feature = 'transfer' THEN billed_cost ELSE 0 END), 0)::double precision AS transfer,
        COALESCE(SUM(CASE WHEN feature = 'bucket' THEN billed_cost ELSE 0 END), 0)::double precision AS bucket,
        COALESCE(SUM(CASE WHEN feature = 'bucket_storage_class' THEN billed_cost ELSE 0 END), 0)::double precision AS bucket_storage_class,
        COALESCE(SUM(CASE WHEN feature = 'other' THEN billed_cost ELSE 0 END), 0)::double precision AS other,
        COALESCE(SUM(billed_cost), 0)::double precision AS total
      FROM categorized
      GROUP BY usage_start_time
      ORDER BY usage_start_time ASC;
      `,
      { bind: filter.params, type: QueryTypes.SELECT },
    );

    return rows
      .filter((row) => typeof row.usage_start_time === "string" && row.usage_start_time.length > 0)
      .map((row) => ({
        usageStartTime: String(row.usage_start_time),
        storage: toNumber(row.storage),
        requests: toNumber(row.requests),
        retrieval: toNumber(row.retrieval),
        transfer: toNumber(row.transfer),
        bucket: toNumber(row.bucket),
        bucketStorageClass: toNumber(row.bucket_storage_class),
        other: toNumber(row.other),
        total: toNumber(row.total),
      }));
  }

  async getBucketCostBreakdown(scope: DashboardScope, limit: number = 5000): Promise<Omit<S3CostBucketTableInsight, "trendPct">[]> {
    const filter = buildDashboardFilter(scope);
    const rows = await sequelize.query<S3BucketBreakdownRow>(
      `
      WITH filtered AS (
        SELECT
          COALESCE(NULLIF(${S3_BUCKET_NAME_SQL}, ''), 'unattributed') AS bucket_name,
          COALESCE(NULLIF(dr.region_name, ''), NULLIF(dr.region_id, ''), 'global') AS region_name,
          COALESCE(fcli.billed_cost, 0)::double precision AS billed_cost,
          COALESCE(fcli.effective_cost, 0)::double precision AS effective_cost,
          COALESCE(fcli.list_cost, 0)::double precision AS list_cost,
          COALESCE(fcli.usage_type, '') AS usage_type,
          COALESCE(fcli.product_usage_type, '') AS product_usage_type,
          COALESCE(fcli.operation, '') AS operation,
          COALESCE(fcli.line_item_description, '') AS line_item_description,
          owner_tag.owner_value AS owner_value,
          driver_tag.driver_value AS driver_value
        FROM fact_cost_line_items fcli
        LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
        LEFT JOIN dim_service ds ON ds.id = fcli.service_key
        LEFT JOIN dim_resource dres ON dres.id = fcli.resource_key
        LEFT JOIN dim_region dr ON dr.id = fcli.region_key
        LEFT JOIN LATERAL (
          SELECT dt.tag_value AS owner_value
          FROM (
            SELECT flt.tag_id
            FROM fact_cost_line_item_tags flt
            WHERE flt.fact_id = fcli.id
            UNION
            SELECT fcli.tag_id
            WHERE fcli.tag_id IS NOT NULL
          ) fact_tags
          JOIN dim_tag dt ON dt.id = fact_tags.tag_id
          WHERE dt.normalized_key IN ${OWNER_TAG_KEYS_SQL}
          ORDER BY
            CASE dt.normalized_key
              WHEN 'owner' THEN 1
              WHEN 'resource_owner' THEN 2
              WHEN 'business_owner' THEN 3
              WHEN 'owner_name' THEN 4
              ELSE 5
            END
          LIMIT 1
        ) owner_tag ON TRUE
        LEFT JOIN LATERAL (
          SELECT dt.tag_value AS driver_value
          FROM (
            SELECT flt.tag_id
            FROM fact_cost_line_item_tags flt
            WHERE flt.fact_id = fcli.id
            UNION
            SELECT fcli.tag_id
            WHERE fcli.tag_id IS NOT NULL
          ) fact_tags
          JOIN dim_tag dt ON dt.id = fact_tags.tag_id
          WHERE dt.normalized_key IN ${DRIVER_TAG_KEYS_SQL}
          ORDER BY
            CASE dt.normalized_key
              WHEN 'cost_driver' THEN 1
              WHEN 'driver' THEN 2
              WHEN 'application' THEN 3
              WHEN 'app' THEN 4
              WHEN 'workload' THEN 5
              ELSE 6
            END
          LIMIT 1
        ) driver_tag ON TRUE
        WHERE ${filter.whereClause}
          AND ${S3_SERVICE_NAME_FILTER_SQL}
      ),
      bucket_agg AS (
        SELECT
          bucket_name,
          COALESCE(SUM(billed_cost), 0)::double precision AS cost,
          COALESCE(SUM(CASE WHEN ${S3_STORAGE_COST_CONDITION_SQL} THEN billed_cost ELSE 0 END), 0)::double precision AS storage,
          COALESCE(SUM(CASE WHEN ${S3_REQUEST_COST_CONDITION_SQL} THEN billed_cost ELSE 0 END), 0)::double precision AS requests,
          COALESCE(SUM(CASE WHEN ${S3_TRANSFER_COST_CONDITION_SQL} THEN billed_cost ELSE 0 END), 0)::double precision AS transfer,
          COALESCE(SUM(CASE WHEN ${S3_RETRIEVAL_COST_CONDITION_SQL} THEN billed_cost ELSE 0 END), 0)::double precision AS retrieval,
          COALESCE(
            SUM(
              CASE
                WHEN ${S3_STORAGE_COST_CONDITION_SQL}
                  OR ${S3_REQUEST_COST_CONDITION_SQL}
                  OR ${S3_TRANSFER_COST_CONDITION_SQL}
                  OR ${S3_RETRIEVAL_COST_CONDITION_SQL}
                THEN 0
                ELSE billed_cost
              END
            ),
            0
          )::double precision AS other,
          GREATEST(COALESCE(SUM(list_cost - effective_cost), 0), 0)::double precision AS savings
        FROM filtered
        GROUP BY bucket_name
      ),
      region_rank AS (
        SELECT
          bucket_name,
          region_name,
          SUM(billed_cost)::double precision AS billed_cost,
          ROW_NUMBER() OVER (
            PARTITION BY bucket_name
            ORDER BY SUM(billed_cost) DESC, region_name ASC
          ) AS rn
        FROM filtered
        GROUP BY bucket_name, region_name
      ),
      owner_rank AS (
        SELECT
          bucket_name,
          owner_value,
          SUM(billed_cost)::double precision AS billed_cost,
          ROW_NUMBER() OVER (
            PARTITION BY bucket_name
            ORDER BY SUM(billed_cost) DESC, owner_value ASC
          ) AS rn
        FROM filtered
        WHERE COALESCE(NULLIF(owner_value, ''), '') <> ''
        GROUP BY bucket_name, owner_value
      ),
      driver_tag_rank AS (
        SELECT
          bucket_name,
          driver_value,
          SUM(billed_cost)::double precision AS billed_cost,
          ROW_NUMBER() OVER (
            PARTITION BY bucket_name
            ORDER BY SUM(billed_cost) DESC, driver_value ASC
          ) AS rn
        FROM filtered
        WHERE COALESCE(NULLIF(driver_value, ''), '') <> ''
        GROUP BY bucket_name, driver_value
      )
      SELECT
        ba.bucket_name,
        ba.cost,
        ba.storage,
        ba.requests,
        ba.transfer,
        ba.retrieval,
        ba.other,
        ba.savings,
        COALESCE(rr.region_name, 'global') AS region,
        COALESCE(orank.owner_value, 'Unassigned') AS owner,
        COALESCE(
          drank.driver_value,
          CASE
            WHEN GREATEST(ba.storage, ba.requests, ba.transfer, ba.retrieval, ba.other) = ba.storage THEN 'Storage'
            WHEN GREATEST(ba.storage, ba.requests, ba.transfer, ba.retrieval, ba.other) = ba.requests THEN 'Request'
            WHEN GREATEST(ba.storage, ba.requests, ba.transfer, ba.retrieval, ba.other) = ba.transfer THEN 'Transfer'
            WHEN GREATEST(ba.storage, ba.requests, ba.transfer, ba.retrieval, ba.other) = ba.retrieval THEN 'Retrieval'
            ELSE 'Other'
          END
        ) AS driver
      FROM bucket_agg ba
      LEFT JOIN region_rank rr
        ON rr.bucket_name = ba.bucket_name
       AND rr.rn = 1
      LEFT JOIN owner_rank orank
        ON orank.bucket_name = ba.bucket_name
       AND orank.rn = 1
      LEFT JOIN driver_tag_rank drank
        ON drank.bucket_name = ba.bucket_name
       AND drank.rn = 1
      ORDER BY ba.cost DESC
      LIMIT $${filter.params.length + 1};
      `,
      { bind: [...filter.params, limit], type: QueryTypes.SELECT },
    );

    return rows.map((row) => ({
      bucketName: String(row.bucket_name ?? "unattributed"),
      cost: toNumber(row.cost),
      storage: toNumber(row.storage),
      requests: toNumber(row.requests),
      transfer: toNumber(row.transfer),
      region: String(row.region ?? "global"),
      owner: String(row.owner ?? "Unassigned"),
      driver: String(row.driver ?? "Other"),
      savings: toNumber(row.savings),
      retrieval: toNumber(row.retrieval),
      other: toNumber(row.other),
    }));
  }
}
