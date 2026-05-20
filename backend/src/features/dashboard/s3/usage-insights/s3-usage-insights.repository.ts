import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";
import type { DashboardScope } from "../../dashboard.types.js";
import { S3CostInsightsRepository } from "../cost-insights/s3-cost-insights.repository.js";
import type { S3CostInsightsFilters } from "../cost-insights/s3-cost-insights.types.js";
import type { S3UsageInsightsFilters, S3UsageInsightsRepositoryInput, S3UsageInsightsResponse } from "./s3-usage-insights.types.js";

type UsageDailySeriesRow = {
  usage_date: string | null;
  series_value: string | null;
  value: number | string | null;
};

type OperationGroupTooltipRow = {
  usage_date: string | null;
  operation_group: string | null;
  operation_name: string | null;
  usage_value: number | string | null;
};

type BucketUsageRow = {
  bucket_name: string | null;
  storage_gb: number | string | null;
  object_count: number | string | null;
  transfer_gb: number | string | null;
  request_count: number | string | null;
  region: string | null;
  dominant_usage_type: string | null;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toCostInsightsFilters = (input: S3UsageInsightsRepositoryInput): S3CostInsightsFilters => ({
  costCategory: [],
  seriesValues: input.filters.seriesValues ?? [],
  bucket: input.filters.bucket ?? null,
  storageClass: [],
  region: input.filters.region ?? [],
  account: input.filters.account ?? [],
  costBy: "date",
  seriesBy: (input.filters.seriesBy as S3CostInsightsFilters["seriesBy"]) ?? "bucket",
  yAxisMetric: "usage_quantity",
  usageYAxis:
    input.filters.usageYAxis === "storage_gb"
    || input.filters.usageYAxis === "request_count"
    || input.filters.usageYAxis === "transfer_gb"
    || input.filters.usageYAxis === "object_count"
      ? input.filters.usageYAxis
      : null,
});

const normalizeSeriesValues = (filters: S3UsageInsightsFilters): string[] =>
  Array.from(
    new Set(
      (filters.seriesValues ?? [])
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  );

const generateDateRange = (from: string, to: string): string[] => {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const labels: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    labels.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return labels;
};

const OPERATION_GROUP_SQL = `
CASE
  WHEN (
    LOWER(COALESCE(operation, '')) LIKE '%put%'
    OR LOWER(COALESCE(operation, '')) LIKE '%post%'
    OR LOWER(COALESCE(operation, '')) LIKE '%copy%'
    OR LOWER(COALESCE(operation, '')) LIKE '%upload%'
    OR LOWER(COALESCE(operation, '')) LIKE '%write%'
    OR LOWER(COALESCE(operation, '')) LIKE '%multipart%'
  ) THEN 'Write'
  WHEN (
    LOWER(COALESCE(operation, '')) LIKE '%list%'
    OR LOWER(COALESCE(operation, '')) LIKE '%head%'
    OR LOWER(COALESCE(operation, '')) LIKE '%acl%'
    OR LOWER(COALESCE(operation, '')) LIKE '%tag%'
    OR LOWER(COALESCE(operation, '')) LIKE '%policy%'
    OR LOWER(COALESCE(operation, '')) LIKE '%metadata%'
    OR LOWER(COALESCE(operation, '')) LIKE '%inventory%'
    OR LOWER(COALESCE(operation, '')) LIKE '%analytics%'
    OR LOWER(COALESCE(operation, '')) LIKE '%metrics%'
    OR LOWER(COALESCE(operation, '')) LIKE '%location%'
    OR LOWER(COALESCE(operation, '')) LIKE '%notification%'
  ) THEN 'List & Metadata'
  WHEN (
    LOWER(COALESCE(operation, '')) LIKE '%get%'
    OR LOWER(COALESCE(operation, '')) LIKE '%read%'
    OR LOWER(COALESCE(operation, '')) LIKE '%select%'
    OR LOWER(COALESCE(operation, '')) LIKE '%retrieve%'
    OR LOWER(COALESCE(operation, '')) LIKE '%restore%'
    OR LOWER(COALESCE(operation, '')) LIKE '%download%'
  ) THEN 'Read'
  ELSE 'Other'
END
`;

const ALLOWED_USAGE_BY_TO_Y_AXIS: Record<string, Set<NonNullable<S3UsageInsightsFilters["usageYAxis"]>>> = {
  bucket: new Set(["storage_gb", "request_count", "transfer_gb", "object_count"]),
  operation: new Set(["request_count", "transfer_gb"]),
};

export class S3UsageInsightsRepository {
  constructor(
    private readonly costInsightsRepository: S3CostInsightsRepository = new S3CostInsightsRepository(),
  ) {}

  async getUsageInsights(input: S3UsageInsightsRepositoryInput): Promise<S3UsageInsightsResponse> {
    const usageSummaryKpis = await this.costInsightsRepository.getUsageSummaryKpis(
      input.scope,
      toCostInsightsFilters(input),
    );
    const bucketTable = await this.getBucketUsageTable(input.scope, input.filters);
    const breakdown = await this.getBreakdown(input.scope, input.filters);
    const filterOptions = await this.getFilterOptions(input.scope, input.filters, bucketTable);

    return {
      section: "s3-usage-insights",
      kpis: {
        usageSummaryKpis,
      },
      bucketTable,
      chart: {
        breakdown,
      },
      filterOptions,
    };
  }

  private buildS3DailyScopedWhere(scope: DashboardScope): { whereClause: string; params: unknown[]; nextIndex: number } {
    const conditions: string[] = [
      "tenant_id = $1::uuid",
      "usage_date >= $2::date",
      "usage_date <= $3::date",
    ];
    const params: unknown[] = [scope.tenantId, scope.from, scope.to];

    if (scope.scopeType === "global") {
      if (typeof scope.providerId === "number") {
        params.push(scope.providerId);
        conditions.push(`provider_id = $${params.length}`);
      }
      if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
        params.push(scope.billingSourceIds);
        conditions.push(`billing_source_id = ANY($${params.length}::bigint[])`);
      }
      if (typeof scope.subAccountKey === "number") {
        params.push(scope.subAccountKey);
        conditions.push(`sub_account_key = $${params.length}`);
      }
      if (typeof scope.regionKey === "number") {
        params.push(scope.regionKey);
        conditions.push(`region_key = $${params.length}`);
      }
    }

    return {
      whereClause: conditions.join("\n        AND "),
      params,
      nextIndex: params.length + 1,
    };
  }

  private buildCostDailyFilterPredicates(
    filters: S3UsageInsightsFilters,
    startIndex: number,
  ): { clause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const push = (condition: string, value: unknown) => {
      params.push(value);
      conditions.push(condition.replaceAll("?", `$${startIndex + params.length - 1}`));
    };

    if (filters.bucket && filters.bucket.trim().length > 0) {
      push("LOWER(bucket_name) LIKE LOWER(?)", `%${filters.bucket.trim()}%`);
    }
    if (Array.isArray(filters.region) && filters.region.length > 0) {
      push("COALESCE(NULLIF(region, ''), 'global') = ANY(?::text[])", filters.region);
    }
    if (Array.isArray(filters.account) && filters.account.length > 0) {
      push("COALESCE(NULLIF(account_id, ''), 'Unspecified') = ANY(?::text[])", filters.account);
    }

    return { clause: conditions.length > 0 ? conditions.join("\n          AND ") : "1=1", params };
  }

  private buildStorageLensFilterPredicates(
    filters: S3UsageInsightsFilters,
    startIndex: number,
    alias = "sld",
  ): { clause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const push = (condition: string, value: unknown) => {
      params.push(value);
      conditions.push(condition.replaceAll("?", `$${startIndex + params.length - 1}`));
    };

    if (filters.bucket && filters.bucket.trim().length > 0) {
      push(`LOWER(${alias}.bucket_name) LIKE LOWER(?)`, `%${filters.bucket.trim()}%`);
    }
    if (Array.isArray(filters.region) && filters.region.length > 0) {
      push(
        `
        COALESCE(
          (SELECT COALESCE(dr.region_name, dr.region_id, 'global') FROM dim_region dr WHERE dr.id = ${alias}.region_key),
          'global'
        ) = ANY(?::text[])
        `,
        filters.region,
      );
    }
    if (Array.isArray(filters.account) && filters.account.length > 0) {
      push(
        `
        COALESCE(
          (SELECT COALESCE(dsa.sub_account_name, dsa.sub_account_id, 'Unspecified') FROM dim_sub_account dsa WHERE dsa.id = ${alias}.sub_account_key),
          'Unspecified'
        ) = ANY(?::text[])
        `,
        filters.account,
      );
    }

    return { clause: conditions.length > 0 ? conditions.join("\n          AND ") : "1=1", params };
  }

  private async getBreakdown(
    scope: DashboardScope,
    filters: S3UsageInsightsFilters,
  ): Promise<{
    labels: string[];
    series: Array<{ name: string; values: number[] }>;
    operationGroupTooltip?: Array<{
      usageDate: string;
      operationGroup: "Read" | "Write" | "List & Metadata" | "Other";
      operation: string;
      cost: number;
    }>;
  }> {
    const usageByRaw = String(filters.usageBy ?? filters.seriesBy ?? "bucket").trim().toLowerCase();
    const usageBy = usageByRaw === "operation_group" ? "operation" : usageByRaw;
    const selectedSeriesValues = normalizeSeriesValues(filters);
    const usageYAxis = (filters.yAxis ?? filters.usageYAxis ?? "storage_gb") as NonNullable<S3UsageInsightsFilters["usageYAxis"]>;
    const labels = generateDateRange(scope.from, scope.to);
    const allowed = ALLOWED_USAGE_BY_TO_Y_AXIS[usageBy];
    if (!allowed || !allowed.has(usageYAxis)) {
      return { labels, series: [], operationGroupTooltip: [] };
    }

    if (usageBy === "bucket") {
      if (usageYAxis === "storage_gb" || usageYAxis === "object_count") {
        const rows = await this.getBucketLensSeries(scope, filters, usageYAxis, selectedSeriesValues);
        return { ...this.buildSeriesResponse(labels, rows), operationGroupTooltip: [] };
      }
      if (usageYAxis === "request_count" || usageYAxis === "transfer_gb") {
        const rows = await this.getBucketCostDailySeries(scope, filters, usageYAxis, selectedSeriesValues);
        return { ...this.buildSeriesResponse(labels, rows), operationGroupTooltip: [] };
      }
      return { labels, series: [], operationGroupTooltip: [] };
    }

    if (usageBy === "operation") {
      if (usageYAxis === "request_count" || usageYAxis === "transfer_gb") {
        const rows = await this.getOperationGroupSeries(scope, filters, usageYAxis, selectedSeriesValues);
        const operationGroupTooltip =
          usageYAxis === "request_count" || usageYAxis === "transfer_gb"
            ? await this.getOperationGroupUsageTooltip(scope, filters, usageYAxis)
            : [];
        return { ...this.buildSeriesResponse(labels, rows), operationGroupTooltip };
      }
      return { labels, series: [], operationGroupTooltip: [] };
    }

    return { labels, series: [], operationGroupTooltip: [] };
  }

  private async getOperationGroupUsageTooltip(
    scope: DashboardScope,
    filters: S3UsageInsightsFilters,
    usageYAxis: "request_count" | "transfer_gb",
  ): Promise<
    Array<{
      usageDate: string;
      operationGroup: "Read" | "Write" | "List & Metadata" | "Other";
      operation: string;
      cost: number;
    }>
  > {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const filterPredicates = this.buildCostDailyFilterPredicates(filters, scoped.nextIndex);
    const usageCondition =
      usageYAxis === "request_count"
        ? `
          LOWER(TRIM(COALESCE(NULLIF(pricing_unit, ''), ''))) = 'requests'
          AND operation IS NOT NULL
          AND NULLIF(BTRIM(operation), '') IS NOT NULL
          AND LOWER(TRIM(COALESCE(operation, ''))) NOT IN ('unspecified', 'none')
        `
        : `
          LOWER(TRIM(COALESCE(NULLIF(cost_category, ''), ''))) = 'transfer'
          AND LOWER(TRIM(COALESCE(NULLIF(pricing_unit, ''), ''))) = 'gb'
          AND COALESCE(NULLIF(operation, ''), '') NOT IN ('Unspecified', 'None', '')
          AND NOT (COALESCE(total_cost, 0) = 0 AND COALESCE(usage_quantity, 0) >= 1)
        `;
    const rows = await sequelize.query<OperationGroupTooltipRow>(
      `
      SELECT
        usage_date::text AS usage_date,
        ${OPERATION_GROUP_SQL} AS operation_group,
        COALESCE(NULLIF(operation, ''), 'Unspecified') AS operation_name,
        COALESCE(SUM(COALESCE(usage_quantity, 0)), 0)::double precision AS usage_value
      FROM s3_cost_daily
      WHERE ${scoped.whereClause}
        AND ${filterPredicates.clause}
        AND ${usageCondition}
        AND bucket_name IS NOT NULL
        AND NULLIF(BTRIM(bucket_name), '') IS NOT NULL
        AND LOWER(COALESCE(usage_type, '')) <> 'use1-storagelens-objcount'
        AND LOWER(COALESCE(operation, '')) <> 'storagelens'
      GROUP BY usage_date, ${OPERATION_GROUP_SQL}, operation_name
      ORDER BY usage_date ASC, operation_group ASC, usage_value DESC, operation_name ASC;
      `,
      { bind: [...scoped.params, ...filterPredicates.params], type: QueryTypes.SELECT },
    );

    const allowedGroups = new Set(["Read", "Write", "List & Metadata", "Other"]);
    return rows
      .map((row) => {
        const operationGroup = String(row.operation_group ?? "Other").trim();
        return {
          usageDate: String(row.usage_date ?? ""),
          operationGroup: (allowedGroups.has(operationGroup) ? operationGroup : "Other") as
            | "Read"
            | "Write"
            | "List & Metadata"
            | "Other",
          operation: String(row.operation_name ?? "Unspecified"),
          cost: toNumber(row.usage_value),
        };
      })
      .filter((row) => row.usageDate.length > 0);
  }

  private async getBucketUsageTable(
    scope: DashboardScope,
    filters: S3UsageInsightsFilters,
  ): Promise<S3UsageInsightsResponse["bucketTable"]> {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const params: unknown[] = [...scoped.params];
    const bucketFilters: string[] = [];
    if (filters.bucket && filters.bucket.trim().length > 0) {
      params.push(`%${filters.bucket.trim()}%`);
      bucketFilters.push(`LOWER(b.bucket_name) LIKE LOWER($${params.length})`);
    }

    const storageLensScopedWhere = scoped.whereClause.replaceAll("usage_date", "sl.usage_date");
    const storageFilterPredicates = this.buildStorageLensFilterPredicates(filters, params.length + 1, "sl");
    const costFilterPredicates = this.buildCostDailyFilterPredicates(
      filters,
      params.length + storageFilterPredicates.params.length + 1,
    );
    const selectedSeriesValues = normalizeSeriesValues(filters);
    const usageByRaw = String(filters.usageBy ?? filters.seriesBy ?? "bucket").trim().toLowerCase();
    const usageBy = usageByRaw === "operation_group" ? "operation_group" : usageByRaw;
    const bind = [...params, ...storageFilterPredicates.params, ...costFilterPredicates.params];
    const seriesValueWhere: string[] = [];
    if (selectedSeriesValues.length > 0 && usageBy === "bucket") {
      bind.push(selectedSeriesValues);
      seriesValueWhere.push(`b.bucket_name = ANY($${bind.length}::text[])`);
    }

    const rows = await sequelize.query<BucketUsageRow>(
      `
      WITH latest_lens_date AS (
        SELECT MAX(usage_date::date) AS usage_date
        FROM s3_storage_lens_daily
        WHERE ${scoped.whereClause}
      ),
      storage_by_bucket AS (
        SELECT
          sl.bucket_name,
          SUM(
            COALESCE(sl.bytes_standard, 0)
            + COALESCE(sl.bytes_standard_ia, 0)
            + COALESCE(sl.bytes_onezone_ia, 0)
            + COALESCE(sl.bytes_intelligent_tiering, 0)
            + COALESCE(sl.bytes_glacier, 0)
            + COALESCE(sl.bytes_deep_archive, 0)
          )::double precision / POWER(1024, 3)::double precision AS storage_gb,
          SUM(COALESCE(sl.object_count, 0))::double precision AS object_count
        FROM s3_storage_lens_daily sl
        JOIN latest_lens_date l ON sl.usage_date::date = l.usage_date
        WHERE ${storageLensScopedWhere}
          AND ${storageFilterPredicates.clause}
          AND sl.bucket_name IS NOT NULL
          AND NULLIF(BTRIM(sl.bucket_name), '') IS NOT NULL
        GROUP BY sl.bucket_name
      ),
      request_by_bucket AS (
        SELECT
          bucket_name,
          SUM(COALESCE(usage_quantity, 0))::double precision AS request_count
        FROM s3_cost_daily
        WHERE ${scoped.whereClause}
          AND ${costFilterPredicates.clause}
          AND LOWER(TRIM(COALESCE(NULLIF(pricing_unit, ''), ''))) = 'requests'
          AND bucket_name IS NOT NULL
          AND NULLIF(BTRIM(bucket_name), '') IS NOT NULL
          AND COALESCE(total_cost, 0) >= 0
          AND LOWER(COALESCE(usage_type, '')) <> 'use1-storagelens-objcount'
          AND LOWER(COALESCE(operation, '')) <> 'storagelens'
        GROUP BY bucket_name
      ),
      transfer_by_bucket AS (
        SELECT
          bucket_name,
          SUM(COALESCE(usage_quantity, 0))::double precision AS transfer_gb
        FROM s3_cost_daily
        WHERE ${scoped.whereClause}
          AND ${costFilterPredicates.clause}
          AND LOWER(TRIM(COALESCE(NULLIF(cost_category, ''), ''))) = 'transfer'
          AND LOWER(TRIM(COALESCE(NULLIF(pricing_unit, ''), ''))) = 'gb'
          AND COALESCE(NULLIF(operation, ''), '') NOT IN ('Unspecified', 'None', '')
          AND NOT (COALESCE(total_cost, 0) = 0 AND COALESCE(usage_quantity, 0) >= 1)
          AND bucket_name IS NOT NULL
          AND NULLIF(BTRIM(bucket_name), '') IS NOT NULL
          AND COALESCE(total_cost, 0) >= 0
          AND LOWER(COALESCE(usage_type, '')) <> 'use1-storagelens-objcount'
          AND LOWER(COALESCE(operation, '')) <> 'storagelens'
        GROUP BY bucket_name
      ),
      bucket_list AS (
        SELECT bucket_name FROM storage_by_bucket
        UNION
        SELECT bucket_name FROM request_by_bucket
        UNION
        SELECT bucket_name FROM transfer_by_bucket
      ),
      bucket_regions AS (
        SELECT
          bucket_name,
          MAX(COALESCE(NULLIF(region, ''), 'global')) AS region
        FROM s3_cost_daily
        WHERE ${scoped.whereClause}
          AND ${costFilterPredicates.clause}
          AND bucket_name IS NOT NULL
          AND NULLIF(BTRIM(bucket_name), '') IS NOT NULL
        GROUP BY bucket_name
      )
      SELECT
        b.bucket_name,
        COALESCE(s.storage_gb, 0)::double precision AS storage_gb,
        COALESCE(s.object_count, 0)::double precision AS object_count,
        COALESCE(t.transfer_gb, 0)::double precision AS transfer_gb,
        COALESCE(r.request_count, 0)::double precision AS request_count,
        COALESCE(br.region, 'global') AS region,
        CASE
          WHEN COALESCE(r.request_count, 0) = 0
            AND COALESCE(s.storage_gb, 0) = 0
            AND COALESCE(t.transfer_gb, 0) = 0
            THEN 'Mixed Heavy'
          WHEN COALESCE(r.request_count, 0) >= GREATEST(COALESCE(s.storage_gb, 0) * 1000, COALESCE(t.transfer_gb, 0) * 1000)
            THEN 'Request Heavy'
          WHEN COALESCE(s.storage_gb, 0) >= GREATEST(COALESCE(t.transfer_gb, 0), COALESCE(r.request_count, 0) / 1000)
            THEN 'Storage Heavy'
          WHEN COALESCE(t.transfer_gb, 0) >= GREATEST(COALESCE(s.storage_gb, 0), COALESCE(r.request_count, 0) / 1000)
            THEN 'Transfer Heavy'
          ELSE 'Mixed Heavy'
        END AS dominant_usage_type
      FROM bucket_list b
      LEFT JOIN storage_by_bucket s ON s.bucket_name = b.bucket_name
      LEFT JOIN request_by_bucket r ON r.bucket_name = b.bucket_name
      LEFT JOIN transfer_by_bucket t ON t.bucket_name = b.bucket_name
      LEFT JOIN bucket_regions br ON br.bucket_name = b.bucket_name
      ${bucketFilters.length > 0 || seriesValueWhere.length > 0 ? `WHERE ${[...bucketFilters, ...seriesValueWhere].join("\n        AND ")}` : ""}
      ORDER BY storage_gb DESC, request_count DESC, transfer_gb DESC;
      `,
      { bind, type: QueryTypes.SELECT },
    );

    return rows
      .map((row) => {
        const bucketName = String(row.bucket_name ?? "").trim();
        if (!bucketName) return null;
        const dominantRaw = String(row.dominant_usage_type ?? "Mixed Heavy").trim();
        const dominantUsageType: "Request Heavy" | "Storage Heavy" | "Transfer Heavy" | "Mixed Heavy" =
          dominantRaw === "Request Heavy" || dominantRaw === "Storage Heavy" || dominantRaw === "Transfer Heavy"
            ? dominantRaw
            : "Mixed Heavy";
        return {
          bucketName,
          storageGb: toNumber(row.storage_gb),
          transferGb: toNumber(row.transfer_gb),
          requestCount: toNumber(row.request_count),
          objectCount: toNumber(row.object_count),
          region: String(row.region ?? "global"),
          dominantUsageType,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }

  private buildSeriesResponse(
    labels: string[],
    rows: UsageDailySeriesRow[],
  ): { labels: string[]; series: Array<{ name: string; values: number[] }> } {
    const dateSeriesMap = new Map<string, Map<string, number>>();
    const totalsBySeries = new Map<string, number>();
    for (const row of rows) {
      const date = String(row.usage_date ?? "").trim();
      const seriesName = String(row.series_value ?? "").trim();
      if (!date || !seriesName) continue;
      if (!dateSeriesMap.has(date)) dateSeriesMap.set(date, new Map<string, number>());
      const dateMap = dateSeriesMap.get(date)!;
      const value = toNumber(row.value);
      dateMap.set(seriesName, (dateMap.get(seriesName) ?? 0) + value);
      totalsBySeries.set(seriesName, (totalsBySeries.get(seriesName) ?? 0) + value);
    }

    const sortedSeries = [...totalsBySeries.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    return {
      labels,
      series: sortedSeries.map((name) => ({
        name,
        values: labels.map((label) => dateSeriesMap.get(label)?.get(name) ?? 0),
      })),
    };
  }

  private async getBucketLensSeries(
    scope: DashboardScope,
    filters: S3UsageInsightsFilters,
    usageYAxis: "storage_gb" | "object_count",
    selectedSeriesValues: string[],
  ): Promise<UsageDailySeriesRow[]> {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const filterPredicates = this.buildStorageLensFilterPredicates(filters, scoped.nextIndex);
    const bind: unknown[] = [...scoped.params, ...filterPredicates.params];
    const seriesFilter =
      selectedSeriesValues.length > 0
        ? (() => {
            bind.push(selectedSeriesValues);
            return `AND sld.bucket_name = ANY($${bind.length}::text[])`;
          })()
        : "";
    const metricExpr =
      usageYAxis === "object_count"
        ? "COALESCE(SUM(COALESCE(sld.object_count, 0)), 0)::double precision"
        : `
          COALESCE(
            SUM(
              COALESCE(sld.bytes_standard, 0)
              + COALESCE(sld.bytes_standard_ia, 0)
              + COALESCE(sld.bytes_onezone_ia, 0)
              + COALESCE(sld.bytes_intelligent_tiering, 0)
              + COALESCE(sld.bytes_glacier, 0)
              + COALESCE(sld.bytes_deep_archive, 0)
            ),
            0
          )::double precision / POWER(1024, 3)::double precision
        `;

    return sequelize.query<UsageDailySeriesRow>(
      `
      SELECT
        sld.usage_date::text AS usage_date,
        sld.bucket_name AS series_value,
        ${metricExpr} AS value
      FROM s3_storage_lens_daily sld
      WHERE ${scoped.whereClause}
        AND ${filterPredicates.clause}
        ${seriesFilter}
        AND sld.bucket_name IS NOT NULL
        AND NULLIF(BTRIM(sld.bucket_name), '') IS NOT NULL
      GROUP BY sld.usage_date, sld.bucket_name
      ORDER BY sld.usage_date ASC, value DESC;
      `,
      { bind, type: QueryTypes.SELECT },
    );
  }

  private async getBucketCostDailySeries(
    scope: DashboardScope,
    filters: S3UsageInsightsFilters,
    usageYAxis: "request_count" | "transfer_gb",
    selectedSeriesValues: string[],
  ): Promise<UsageDailySeriesRow[]> {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const filterPredicates = this.buildCostDailyFilterPredicates(filters, scoped.nextIndex);
    const bind: unknown[] = [...scoped.params, ...filterPredicates.params];
    const seriesFilter =
      selectedSeriesValues.length > 0
        ? (() => {
            bind.push(selectedSeriesValues);
            return `AND bucket_name = ANY($${bind.length}::text[])`;
          })()
        : "";

    const usageCondition =
      usageYAxis === "request_count"
        ? "LOWER(TRIM(COALESCE(NULLIF(pricing_unit, ''), ''))) = 'requests'"
        : `
          LOWER(TRIM(COALESCE(NULLIF(cost_category, ''), ''))) = 'transfer'
          AND LOWER(TRIM(COALESCE(NULLIF(pricing_unit, ''), ''))) = 'gb'
          AND COALESCE(NULLIF(operation, ''), '') NOT IN ('Unspecified', 'None', '')
          AND NOT (COALESCE(total_cost, 0) = 0 AND COALESCE(usage_quantity, 0) >= 1)
        `;

    return sequelize.query<UsageDailySeriesRow>(
      `
      SELECT
        usage_date::text AS usage_date,
        bucket_name AS series_value,
        COALESCE(SUM(COALESCE(usage_quantity, 0)), 0)::double precision AS value
      FROM s3_cost_daily
      WHERE ${scoped.whereClause}
        AND ${filterPredicates.clause}
        AND ${usageCondition}
        ${seriesFilter}
        AND bucket_name IS NOT NULL
        AND NULLIF(BTRIM(bucket_name), '') IS NOT NULL
        AND LOWER(COALESCE(usage_type, '')) <> 'use1-storagelens-objcount'
        AND LOWER(COALESCE(operation, '')) <> 'storagelens'
      GROUP BY usage_date, bucket_name
      ORDER BY usage_date ASC, value DESC;
      `,
      { bind, type: QueryTypes.SELECT },
    );
  }

  private async getOperationGroupSeries(
    scope: DashboardScope,
    filters: S3UsageInsightsFilters,
    usageYAxis: "request_count" | "transfer_gb",
    selectedSeriesValues: string[],
  ): Promise<UsageDailySeriesRow[]> {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const filterPredicates = this.buildCostDailyFilterPredicates(filters, scoped.nextIndex);
    const bind: unknown[] = [...scoped.params, ...filterPredicates.params];
    const seriesFilter =
      selectedSeriesValues.length > 0
        ? (() => {
            bind.push(selectedSeriesValues);
            return `AND (${OPERATION_GROUP_SQL}) = ANY($${bind.length}::text[])`;
          })()
        : "";
    const usageCondition =
      usageYAxis === "transfer_gb"
        ? `
          LOWER(TRIM(COALESCE(NULLIF(cost_category, ''), ''))) = 'transfer'
          AND LOWER(TRIM(COALESCE(NULLIF(pricing_unit, ''), ''))) = 'gb'
          AND COALESCE(NULLIF(operation, ''), '') NOT IN ('Unspecified', 'None', '')
          AND NOT (COALESCE(total_cost, 0) = 0 AND COALESCE(usage_quantity, 0) >= 1)
        `
        : "LOWER(TRIM(COALESCE(NULLIF(pricing_unit, ''), ''))) = 'requests'";

    return sequelize.query<UsageDailySeriesRow>(
      `
      SELECT
        usage_date::text AS usage_date,
        ${OPERATION_GROUP_SQL} AS series_value,
        COALESCE(SUM(COALESCE(usage_quantity, 0)), 0)::double precision AS value
      FROM s3_cost_daily
      WHERE ${scoped.whereClause}
        AND ${filterPredicates.clause}
        AND ${usageCondition}
        ${seriesFilter}
        AND bucket_name IS NOT NULL
        AND NULLIF(BTRIM(bucket_name), '') IS NOT NULL
        AND LOWER(COALESCE(usage_type, '')) <> 'use1-storagelens-objcount'
        AND LOWER(COALESCE(operation, '')) <> 'storagelens'
      GROUP BY usage_date, ${OPERATION_GROUP_SQL}
      ORDER BY usage_date ASC, value DESC;
      `,
      { bind, type: QueryTypes.SELECT },
    );
  }

  private async getFilterOptions(
    scope: DashboardScope,
    filters: S3UsageInsightsFilters,
    bucketTable: S3UsageInsightsResponse["bucketTable"],
  ): Promise<S3UsageInsightsResponse["filterOptions"]> {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const costFilterPredicates = this.buildCostDailyFilterPredicates(filters, scoped.nextIndex);
    const bind = [...scoped.params, ...costFilterPredicates.params];

    const operationRows = await sequelize.query<{ value: string }>(
      `
      SELECT DISTINCT ${OPERATION_GROUP_SQL} AS value
      FROM s3_cost_daily
      WHERE ${scoped.whereClause}
        AND ${costFilterPredicates.clause}
        AND operation IS NOT NULL
        AND NULLIF(BTRIM(operation), '') IS NOT NULL
      ORDER BY value;
      `,
      { bind, type: QueryTypes.SELECT },
    );

    const regionRows = await sequelize.query<{ value: string }>(
      `
      SELECT DISTINCT COALESCE(NULLIF(region, ''), 'global') AS value
      FROM s3_cost_daily
      WHERE ${scoped.whereClause}
        AND ${costFilterPredicates.clause}
      ORDER BY value;
      `,
      { bind, type: QueryTypes.SELECT },
    );

    const accountRows = await sequelize.query<{ value: string }>(
      `
      SELECT DISTINCT COALESCE(NULLIF(account_id, ''), 'Unspecified') AS value
      FROM s3_cost_daily
      WHERE ${scoped.whereClause}
        AND ${costFilterPredicates.clause}
      ORDER BY value;
      `,
      { bind, type: QueryTypes.SELECT },
    );

    return {
      operation: Array.from(new Set(operationRows.map((row) => String(row.value ?? "").trim()).filter((value) => value.length > 0))),
      bucket: Array.from(new Set(bucketTable.map((row) => String(row.bucketName ?? "").trim()).filter((value) => value.length > 0))),
      region: Array.from(new Set(regionRows.map((row) => String(row.value ?? "").trim()).filter((value) => value.length > 0))),
      account: Array.from(new Set(accountRows.map((row) => String(row.value ?? "").trim()).filter((value) => value.length > 0))),
    };
  }
}

