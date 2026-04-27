import type { DashboardScope } from "../dashboard.types.js";
import { S3CostInsightsRepository } from "./s3-cost-insights.repository.js";
import type { S3CostInsightsFilters, S3CostInsightsResponse } from "./s3-cost-insights.types.js";

const toDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const buildMonthToDateScope = (scope: DashboardScope): DashboardScope | null => {
  const fromDate = toDate(scope.from);
  const toDateValue = toDate(scope.to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDateValue.getTime()) || fromDate > toDateValue) {
    return null;
  }

  const monthStart = new Date(Date.UTC(toDateValue.getUTCFullYear(), toDateValue.getUTCMonth(), 1));
  const mtdFrom = fromDate > monthStart ? fromDate : monthStart;
  return {
    ...scope,
    from: toIsoDate(mtdFrom),
    to: scope.to,
  };
};

const buildPreviousRange = (from: string, to: string): { from: string; to: string } | null => {
  const fromDate = toDate(from);
  const toDateValue = toDate(to);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDateValue.getTime()) || fromDate > toDateValue) {
    return null;
  }

  const diffDays = Math.floor((toDateValue.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  const previousTo = new Date(fromDate);
  previousTo.setUTCDate(previousTo.getUTCDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - (diffDays - 1));

  return {
    from: toIsoDate(previousFrom),
    to: toIsoDate(previousTo),
  };
};

const sanitizeFilters = (filters?: Partial<S3CostInsightsFilters>): S3CostInsightsFilters => {
  const toUnique = (values: unknown[] | undefined): string[] =>
    Array.from(
      new Set(
        (Array.isArray(values) ? values : [])
          .map((value) => String(value ?? "").trim())
          .filter((value) => value.length > 0),
      ),
    );

  const allowedCostBy: S3CostInsightsFilters["costBy"][] = ["date", "bucket", "region", "account"];
  const allowedSeriesBy: S3CostInsightsFilters["seriesBy"][] = [
    "cost_category",
    "usage_type",
    "operation",
    "product_family",
  ];
  const allowedCostCategory = new Set([
    "Storage",
    "Request",
    "Transfer",
    "Retrieval",
    "Other",
  ]);

  return {
    costCategory: toUnique(filters?.costCategory as string[]).filter((item) =>
      allowedCostCategory.has(item),
    ) as S3CostInsightsFilters["costCategory"],
    bucket: filters?.bucket && String(filters.bucket).trim().length > 0 ? String(filters.bucket).trim() : null,
    storageClass: toUnique(filters?.storageClass as string[]),
    region: toUnique(filters?.region as string[]),
    account: toUnique(filters?.account as string[]),
    costBy: allowedCostBy.includes(filters?.costBy as S3CostInsightsFilters["costBy"])
      ? (filters?.costBy as S3CostInsightsFilters["costBy"])
      : "date",
    seriesBy: allowedSeriesBy.includes(filters?.seriesBy as S3CostInsightsFilters["seriesBy"])
      ? (filters?.seriesBy as S3CostInsightsFilters["seriesBy"])
      : "cost_category",
  };
};

export class S3CostInsightsService {
  constructor(private readonly repository: S3CostInsightsRepository = new S3CostInsightsRepository()) {}

  async getInsights(scope: DashboardScope, filters?: Partial<S3CostInsightsFilters>): Promise<S3CostInsightsResponse> {
    const effectiveFilters = sanitizeFilters(filters);
    const monthToDateScope = buildMonthToDateScope(scope);
    const previousScope =
      scope.scopeType === "global"
        ? (() => {
            const previousRange = buildPreviousRange(scope.from, scope.to);
            if (!previousRange) return null;
            return {
              ...scope,
              from: previousRange.from,
              to: previousRange.to,
            };
          })()
        : null;

    const [
      totalS3Cost,
      monthToDateCost,
      effectiveCost,
      bucketCosts,
      trend,
      featureTrend,
      breakdown,
      filterOptions,
      currentBucketTable,
      previousBucketTable,
    ] =
      await Promise.all([
        this.repository.getTotalS3Cost(scope),
        monthToDateScope ? this.repository.getTotalS3Cost(monthToDateScope) : Promise.resolve(0),
        this.repository.getTotalS3EffectiveCost(scope),
        this.repository.getBucketCosts(scope),
        this.repository.getTrend(scope),
        this.repository.getFeatureTrend(scope),
        this.repository.getBreakdownChart(scope, effectiveFilters),
        this.repository.getBreakdownFilterOptions(scope),
        this.repository.getBucketCostBreakdown(scope),
        previousScope ? this.repository.getBucketCostBreakdown(previousScope) : Promise.resolve([]),
      ]);

    const previousCostByBucket = new Map(previousBucketTable.map((row) => [row.bucketName, row.cost]));
    const bucketTable = currentBucketTable.map((row) => {
      const previousCost = previousCostByBucket.get(row.bucketName) ?? 0;
      const trendPct = previousCost > 0 ? ((row.cost - previousCost) / previousCost) * 100 : 0;
      return {
        ...row,
        trendPct,
      };
    });

    return {
      section: "s3-cost-insights",
      title: "S3 Cost Insights",
      message: "S3 cost insights loaded",
      filtersApplied: {
        from: scope.from,
        to: scope.to,
        scopeType: scope.scopeType,
        s3Filters: effectiveFilters,
      },
      columnsUsed: [
        "service_name",
        "billed_cost",
        "effective_cost",
        "usage_start_time",
        "list_cost",
        "usage_type",
        "product_usage_type",
        "operation",
        "line_item_description",
        "product_family",
        "region_name",
        "sub_account_name",
        "tag_value",
      ],
      kpis: {
        totalS3Cost,
        monthToDateCost,
        effectiveCost,
      },
      bucketTable,
      chart: {
        bucketCosts,
        trend,
        featureTrend,
        breakdown,
      },
      filterOptions,
    };
  }
}
