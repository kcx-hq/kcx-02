import { Suspense, lazy, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { useS3CostInsightsQuery } from "../../hooks/useDashboardQueries";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { dashboardApi, type S3CostInsightsFiltersQuery } from "../../api/dashboardApi";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import type { S3BucketTableRow } from "./components/S3BucketInsightsTable.types";
import type { S3CostCategoryTableRow } from "./components/S3CostCategoryTable";
import type { S3UsageOperationTableRow } from "./components/S3UsageOperationTable";
import type { S3UsageTypeCostTableRow } from "./components/S3UsageTypeCostTable";
import type { S3StorageTypeCostTableRow } from "./components/S3StorageTypeCostTable";
import type { S3OverviewFilterOptions, S3OverviewFilterValue } from "./components/s3Overview.types";
import { S3OverviewFilters } from "./components/S3OverviewFilters";
import { S3BucketKpiSection } from "./components/S3BucketKpiSection";
import { S3UsageTypeCostTable } from "./components/S3UsageTypeCostTable";

const S3OverviewChartPanel = lazy(async () => {
  const module = await import("./components/S3OverviewChartPanel");
  return { default: module.S3OverviewChartPanel };
});

const S3BucketInsightsTable = lazy(async () => {
  const module = await import("./components/S3BucketInsightsTable");
  return { default: module.S3BucketInsightsTable };
});

const S3CostCategoryTable = lazy(async () => {
  const module = await import("./components/S3CostCategoryTable");
  return { default: module.S3CostCategoryTable };
});

const S3UsageOperationTable = lazy(async () => {
  const module = await import("./components/S3UsageOperationTable");
  return { default: module.S3UsageOperationTable };
});

const S3StorageTypeCostTable = lazy(async () => {
  const module = await import("./components/S3StorageTypeCostTable");
  return { default: module.S3StorageTypeCostTable };
});

const DEFAULT_FILTERS: S3OverviewFilterValue = {
  seriesBy: "bucket",
  seriesValues: [],
  storageClass: [],
  costBy: "date",
  yAxisMetric: "gross_cost",
  chartType: "bar",
  compareMode: "none",
};

const SERIES_BY_OPTIONS: Array<S3OverviewFilterValue["seriesBy"]> = [
  "none",
  "bucket",
  "usage_type",
  "operation",
  "storage_class",
];
const COST_BY_OPTIONS: Array<S3OverviewFilterValue["costBy"]> = ["date", "bucket", "region", "account"];
const Y_AXIS_OPTIONS: Array<S3OverviewFilterValue["yAxisMetric"]> = ["gross_cost", "effective_cost"];
const CHART_TYPE_OPTIONS: Array<S3OverviewFilterValue["chartType"]> = ["bar", "line"];
const COMPARE_MODE_OPTIONS: Array<S3OverviewFilterValue["compareMode"]> = ["none", "previous_period"];

const parseListParam = (value: string | null): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const parseIsoDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatAsQueryDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatIsoDate = (value: Date): string => {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseFiltersFromSearch = (search: string): S3OverviewFilterValue => {
  const params = new URLSearchParams(search);
  const seriesBy = params.get("s3SeriesBy");
  const seriesValues = parseListParam(params.get("s3SeriesValues"));
  const storageClass = parseListParam(params.get("s3StorageClass"));
  const costBy = params.get("s3CostBy");
  const yAxisMetric = params.get("s3YAxisMetric");
  const chartType = params.get("s3ChartType");
  const compareMode = params.get("s3Compare");

  return {
    seriesBy: SERIES_BY_OPTIONS.includes(seriesBy as S3OverviewFilterValue["seriesBy"])
      ? (seriesBy as S3OverviewFilterValue["seriesBy"])
      : DEFAULT_FILTERS.seriesBy,
    seriesValues,
    storageClass,
    costBy: COST_BY_OPTIONS.includes(costBy as S3OverviewFilterValue["costBy"])
      ? (costBy as S3OverviewFilterValue["costBy"])
      : DEFAULT_FILTERS.costBy,
    yAxisMetric: Y_AXIS_OPTIONS.includes(yAxisMetric as S3OverviewFilterValue["yAxisMetric"])
      ? (yAxisMetric as S3OverviewFilterValue["yAxisMetric"])
      : DEFAULT_FILTERS.yAxisMetric,
    chartType: CHART_TYPE_OPTIONS.includes(chartType as S3OverviewFilterValue["chartType"])
      ? (chartType as S3OverviewFilterValue["chartType"])
      : DEFAULT_FILTERS.chartType,
    compareMode: COMPARE_MODE_OPTIONS.includes(compareMode as S3OverviewFilterValue["compareMode"])
      ? (compareMode as S3OverviewFilterValue["compareMode"])
      : DEFAULT_FILTERS.compareMode,
  };
};

const normalizeOverviewFilters = (
  current: S3OverviewFilterValue,
  next: S3OverviewFilterValue,
): S3OverviewFilterValue => {
  const enteringCompare = current.compareMode !== "previous_period" && next.compareMode === "previous_period";
  const isCompare = next.compareMode === "previous_period";

  if (isCompare) {
    return {
      ...next,
      // Compare mode is a fixed trend comparison view (current vs previous).
      seriesBy: "none",
      seriesValues: [],
      costBy: "date",
      yAxisMetric: "gross_cost",
      chartType: "line",
    };
  }

  return {
    ...next,
    seriesValues: next.seriesBy === "none" ? [] : next.seriesValues,
    costBy: next.seriesBy === "none" ? "date" : next.costBy,
    yAxisMetric: next.seriesBy === "none" ? "gross_cost" : next.yAxisMetric,
    chartType:
      next.seriesBy === "none"
        ? "line"
        : enteringCompare
          ? "line"
          : next.chartType,
  };
};

const uniqueNonEmpty = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.map((item) => String(item ?? "").trim()).filter((item) => item.length > 0))].sort((a, b) =>
    a.localeCompare(b),
  );

function S3OverviewTableSkeleton() {
  return (
    <div className="s3-usage-table-skeleton" aria-hidden="true">
      <div className="s3-usage-table-skeleton__toolbar" />
      <div className="s3-usage-table-skeleton__header" />
      <div className="s3-usage-table-skeleton__row" />
      <div className="s3-usage-table-skeleton__row" />
      <div className="s3-usage-table-skeleton__row" />
      <div className="s3-usage-table-skeleton__row" />
      <div className="s3-usage-table-skeleton__row" />
      <div className="s3-usage-table-skeleton__row" />
      <div className="s3-usage-table-skeleton__row" />
    </div>
  );
}

export default function S3OverviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();
  const filters = useMemo(() => parseFiltersFromSearch(location.search), [location.search]);
  const debouncedFilters = useDebouncedValue(filters, 220);
  const isDebouncingFilters = debouncedFilters !== filters;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasStart = Boolean(params.get("billingPeriodStart") || params.get("from"));
    const hasEnd = Boolean(params.get("billingPeriodEnd") || params.get("to"));
    if (hasStart && hasEnd) return;

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    const from = formatAsQueryDate(start);
    const to = formatAsQueryDate(today);

    params.set("billingPeriodStart", from);
    params.set("from", from);
    params.set("billingPeriodEnd", to);
    params.set("to", to);

    const nextSearch = params.toString();
    const currentSearch = location.search.startsWith("?") ? location.search.slice(1) : location.search;
    if (nextSearch !== currentSearch) {
      navigate({ pathname: location.pathname, search: nextSearch }, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const applyFiltersToUrl = (nextFilters: S3OverviewFilterValue) => {
    const normalizedNext = normalizeOverviewFilters(filters, nextFilters);
    const params = new URLSearchParams(location.search);
    if (normalizedNext.seriesBy !== DEFAULT_FILTERS.seriesBy) params.set("s3SeriesBy", normalizedNext.seriesBy);
    else params.delete("s3SeriesBy");
    if (normalizedNext.seriesValues.length > 0) params.set("s3SeriesValues", normalizedNext.seriesValues.join(","));
    else params.delete("s3SeriesValues");
    if (normalizedNext.storageClass.length > 0) params.set("s3StorageClass", normalizedNext.storageClass.join(","));
    else params.delete("s3StorageClass");
    if (normalizedNext.costBy !== DEFAULT_FILTERS.costBy) params.set("s3CostBy", normalizedNext.costBy);
    else params.delete("s3CostBy");
    if (normalizedNext.yAxisMetric !== DEFAULT_FILTERS.yAxisMetric) params.set("s3YAxisMetric", normalizedNext.yAxisMetric);
    else params.delete("s3YAxisMetric");
    if (normalizedNext.chartType !== DEFAULT_FILTERS.chartType) params.set("s3ChartType", normalizedNext.chartType);
    else params.delete("s3ChartType");
    if (normalizedNext.compareMode !== DEFAULT_FILTERS.compareMode) params.set("s3Compare", normalizedNext.compareMode);
    else params.delete("s3Compare");
    params.delete("s3TopN");
    params.delete("s3SortOrder");

    const nextSearch = params.toString();
    const currentSearch = location.search.startsWith("?") ? location.search.slice(1) : location.search;
    if (nextSearch !== currentSearch) {
      navigate({ pathname: location.pathname, search: nextSearch }, { replace: true });
    }
  };

  useEffect(() => {
    const normalized = normalizeOverviewFilters(filters, filters);
    const hasDrift =
      normalized.seriesBy !== filters.seriesBy ||
      normalized.costBy !== filters.costBy ||
      normalized.yAxisMetric !== filters.yAxisMetric ||
      normalized.chartType !== filters.chartType ||
      normalized.seriesValues.join("|") !== filters.seriesValues.join("|");
    if (!hasDrift) return;
    applyFiltersToUrl(normalized);
  }, [filters]);

  const queryFilters = useMemo<S3CostInsightsFiltersQuery>(
    () => ({
      ...(debouncedFilters.seriesBy !== "none" && debouncedFilters.seriesValues.length > 0
        ? { seriesValues: debouncedFilters.seriesValues }
        : {}),
      ...(debouncedFilters.storageClass.length > 0 ? { storageClass: debouncedFilters.storageClass } : {}),
      costBy: debouncedFilters.costBy,
      // `none` is a UI-only mode. Query as bucket and aggregate to one total line in chart rendering.
      seriesBy: debouncedFilters.seriesBy === "none" ? "bucket" : debouncedFilters.seriesBy,
      yAxisMetric: debouncedFilters.yAxisMetric,
    }),
    [debouncedFilters],
  );

  const overviewFilters = useMemo<S3CostInsightsFiltersQuery>(
    () => ({ ...queryFilters, responseMode: "overview" }),
    [queryFilters],
  );
  const overviewQuery = useS3CostInsightsQuery(overviewFilters, { staleTime: 120_000 });

  const graphSource = overviewQuery.data ?? null;
  const tableSource = overviewQuery.data ?? null;
  const filterOptions = overviewQuery.data?.filterOptions;

  const breakdown = graphSource?.chart.breakdown;
  const bucketRows = useMemo(
    () => (tableSource?.bucketTable ?? []) as S3BucketTableRow[],
    [tableSource?.bucketTable],
  );
  const costCategoryRows = useMemo(
    () => (tableSource?.costCategoryTable ?? []) as S3CostCategoryTableRow[],
    [tableSource?.costCategoryTable],
  );
  const usageOperationRows = useMemo(
    () => (tableSource?.usageOperationTable ?? []) as S3UsageOperationTableRow[],
    [tableSource?.usageOperationTable],
  );
  const topOperationKpi = useMemo(() => {
    if (usageOperationRows.length === 0) return null;
    const topRow = [...usageOperationRows]
      .sort((a, b) => Number(b.cost ?? 0) - Number(a.cost ?? 0))[0];
    if (!topRow) return null;
    const grossS3Cost = Number(overviewQuery.data?.kpis.usageTypeCostKpis.grossS3Cost ?? 0);
    const topCost = Number(topRow.cost ?? 0);
    return {
      operation: String(topRow.operation ?? "").trim() || "n/a",
      cost: topCost,
      percentOfTotal: grossS3Cost > 0 ? (topCost / grossS3Cost) * 100 : 0,
    };
  }, [overviewQuery.data?.kpis.usageTypeCostKpis.grossS3Cost, usageOperationRows]);
  const usageTypeCostRows = useMemo(
    () => (tableSource?.usageTypeCostTable ?? []) as S3UsageTypeCostTableRow[],
    [tableSource?.usageTypeCostTable],
  );
  const storageTypeCostRows = useMemo(
    () => (tableSource?.storageTypeCostTable ?? []) as S3StorageTypeCostTableRow[],
    [tableSource?.storageTypeCostTable],
  );
  const topStorageClassLabel = useMemo(() => {
    if (storageTypeCostRows.length === 0) return "n/a";
    const top = [...storageTypeCostRows].sort((a, b) => Number(b.grossCost ?? 0) - Number(a.grossCost ?? 0))[0];
    return String(top?.storageType ?? "").trim() || "n/a";
  }, [storageTypeCostRows]);

  const resolvedFilterOptions = useMemo<S3OverviewFilterOptions>(() => {
    const bucketsFromTable = uniqueNonEmpty(bucketRows.map((row) => row.bucketName));
    const bucketsFromSeries = uniqueNonEmpty(
      (graphSource?.chart.breakdown.series ?? []).map((series) => series.name),
    ).filter((name) => {
      const normalized = name.toLowerCase();
      return normalized !== "others" && normalized !== "unattributed";
    });
    const costCategoriesFromTable = uniqueNonEmpty(costCategoryRows.map((row) => row.costCategory));
    const usageTypesFromTable = uniqueNonEmpty(usageOperationRows.map((row) => row.usageType));
    const operationsFromTable = uniqueNonEmpty(usageOperationRows.map((row) => row.operation));
    const storageClassesFromTable = uniqueNonEmpty(
      bucketRows.flatMap((row) => (row.storageLens?.storageClassDistribution ?? []).map((item) => item.name)),
    );
    return {
      ...(filterOptions ?? {
        costCategory: [],
        usageType: [],
        operation: [],
        bucket: [],
        storageClass: [],
        region: [],
        account: [],
        costBy: ["date", "bucket", "region", "account"],
        seriesBy: ["none", "usage_type", "operation", "bucket", "storage_class"],
        yAxisMetric: ["gross_cost", "effective_cost"],
      }),
      bucket: (filterOptions?.bucket?.length ?? 0) > 0 ? filterOptions?.bucket ?? [] : uniqueNonEmpty([...bucketsFromTable, ...bucketsFromSeries]),
      costCategory:
        (filterOptions?.costCategory?.length ?? 0) > 0
          ? filterOptions?.costCategory ?? []
          : costCategoriesFromTable,
      usageType: (filterOptions?.usageType?.length ?? 0) > 0 ? filterOptions?.usageType ?? [] : usageTypesFromTable,
      operation: (filterOptions?.operation?.length ?? 0) > 0 ? filterOptions?.operation ?? [] : operationsFromTable,
      storageClass:
        (filterOptions?.storageClass?.length ?? 0) > 0 ? filterOptions?.storageClass ?? [] : storageClassesFromTable,
    };
  }, [bucketRows, costCategoryRows, filterOptions, filters.seriesBy, graphSource?.chart.breakdown.series, usageOperationRows]);

  const filteredBucketRows = useMemo(() => {
    if (filters.seriesBy !== "bucket" || filters.seriesValues.length === 0) {
      return bucketRows;
    }
    const selected = new Set(filters.seriesValues.map((item) => item.trim().toLowerCase()).filter((item) => item.length > 0));
    return bucketRows.filter((row) => selected.has(String(row.bucketName ?? "").trim().toLowerCase()));
  }, [bucketRows, filters.seriesBy, filters.seriesValues]);

  const showCostCategoryTable = filters.seriesBy === "cost_category";
  const showCostCategoryUsageInsightTable = showCostCategoryTable && filters.seriesValues.length > 0;
  const showUsageTypeCostTable = filters.seriesBy === "usage_type";
  const showUsageOperationTable = filters.seriesBy === "operation";
  const showStorageTypeCostTable = filters.seriesBy === "storage_class";

  const hasAnyData = Boolean(graphSource || tableSource);
  const isInitialLoading = !hasAnyData && overviewQuery.isLoading;
  const isRefreshing = hasAnyData && overviewQuery.isFetching;
  const isGraphLoading = !graphSource && (overviewQuery.isLoading || isDebouncingFilters);
  const isTableLoading = !tableSource && (overviewQuery.isLoading || overviewQuery.isFetching || isDebouncingFilters);
  const hasBlockingError = overviewQuery.isError && !graphSource && !tableSource;

  const previousRange = useMemo(() => {
    if (!scope?.from || !scope?.to) return null;
    const start = parseIsoDate(scope.from);
    const end = parseIsoDate(scope.to);
    if (!start || !end || end < start) return null;
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;
    const previousEnd = new Date(start.getTime() - dayMs);
    const previousStart = new Date(previousEnd.getTime() - (days - 1) * dayMs);
    return {
      from: formatIsoDate(previousStart),
      to: formatIsoDate(previousEnd),
      days,
    };
  }, [scope]);

  const previousScope = useMemo(() => {
    if (!scope || !previousRange) return null;
    return { ...scope, from: previousRange.from, to: previousRange.to };
  }, [previousRange, scope]);
  const quickComparisonFilters = useMemo<S3CostInsightsFiltersQuery>(
    () => ({ ...queryFilters, responseMode: "quick" }),
    [queryFilters],
  );

  const comparisonQuery = useQuery({
    queryKey: ["dashboard", "s3", "cost-insights", "previous-period", previousScope, quickComparisonFilters, filters.compareMode],
    queryFn: ({ signal }) =>
      dashboardApi.getS3CostInsights(previousScope as NonNullable<typeof previousScope>, quickComparisonFilters, { signal }),
    enabled: filters.compareMode === "previous_period" && Boolean(previousScope),
    placeholderData: (previousData) => previousData,
    staleTime: 90_000,
    refetchOnWindowFocus: false,
  });

  const comparisonTotal = comparisonQuery.data?.kpis.totalS3Cost ?? null;

  return (
    <div className="dashboard-page s3-overview-page">
      <S3OverviewFilters
        value={filters}
        onChange={applyFiltersToUrl}
        filterOptions={resolvedFilterOptions}
        isLoading={isInitialLoading}
        isError={hasBlockingError}
        errorMessage={overviewQuery.error?.message}
        onRetry={() => {
          void overviewQuery.refetch();
        }}
      />
      <S3BucketKpiSection
        mode={
          filters.seriesBy === "usage_type"
            ? "usage_type"
            : filters.seriesBy === "operation"
              ? "operation"
              : filters.seriesBy === "storage_class"
                ? "storage_class"
                : "default"
        }
        grossBucketCost={overviewQuery.data?.kpis.bucketCostKpis.grossBucketCost ?? 0}
        creditAdjustedCost={overviewQuery.data?.kpis.bucketCostKpis.creditAdjustedCost ?? 0}
        netBucketCost={overviewQuery.data?.kpis.bucketCostKpis.netBucketCost ?? 0}
        totalBuckets={overviewQuery.data?.kpis.bucketCostKpis.totalBuckets ?? 0}
        usageTypeCostKpis={overviewQuery.data?.kpis.usageTypeCostKpis}
        topOperation={topOperationKpi}
        topStorageClassLabel={topStorageClassLabel}
      />

      <Suspense
        fallback={
            <section className="cost-explorer-chart-panel s3-overview-chart-panel" aria-label="S3 date vs cost chart">
              <div className="cost-explorer-chart-panel__body">
              <div className="cost-explorer-chart-skeleton" style={{ minHeight: "420px" }} />
              </div>
            </section>
        }
      >
        <S3OverviewChartPanel
          breakdown={breakdown}
          seriesBy={filters.seriesBy}
          costBy={filters.costBy}
          yAxisMetric={filters.yAxisMetric}
          chartType={filters.chartType}
          compareMode={filters.compareMode}
          currentPeriodTotal={graphSource?.kpis.totalS3Cost ?? null}
          previousPeriodTotal={comparisonTotal}
          previousPeriodBreakdown={comparisonQuery.data?.chart.breakdown}
          comparisonLoading={filters.compareMode === "previous_period" && comparisonQuery.isLoading}
          comparisonError={filters.compareMode === "previous_period" && comparisonQuery.isError}
          comparisonErrorMessage={comparisonQuery.error?.message}
          isLoading={isGraphLoading}
          isRefreshing={isRefreshing}
          isError={hasBlockingError}
          errorMessage={overviewQuery.error?.message}
          onRetry={() => {
            void overviewQuery.refetch();
            if (filters.compareMode === "previous_period") {
              void comparisonQuery.refetch();
            }
          }}
          onReset={() => applyFiltersToUrl(DEFAULT_FILTERS)}
          onChartTypeChange={(nextType) => applyFiltersToUrl({ ...filters, chartType: nextType })}
          onBucketClick={(bucketName) => {
            const searchParams = new URLSearchParams(location.search);
            searchParams.set("s3Section", "cost");
            navigate({
              pathname: `/dashboard/s3/bucket/${encodeURIComponent(bucketName)}`,
              search: searchParams.toString(),
            });
          }}
        />
      </Suspense>

      {!hasBlockingError ? (
        <section
          className="s3-overview-table-panel s3-overview-table-panel--cost"
          aria-label={
            showCostCategoryUsageInsightTable || showUsageOperationTable
              ? "S3 usage operation insights table"
              : showCostCategoryTable
                ? "S3 cost category insights table"
                : "S3 bucket insights table"
          }
        >
          {isTableLoading ? (
            <S3OverviewTableSkeleton />
          ) : (
            <div className={`s3-overview-table-panel__content${isRefreshing ? " is-refreshing" : ""}`}>
              <Suspense fallback={<S3OverviewTableSkeleton />}>
                {showCostCategoryUsageInsightTable ? (
                  <S3UsageOperationTable rows={usageOperationRows} />
                ) : showCostCategoryTable ? (
                  <S3CostCategoryTable rows={costCategoryRows} />
                ) : showUsageTypeCostTable ? (
                  <S3UsageTypeCostTable
                    rows={usageTypeCostRows}
                    totalGrossS3Cost={overviewQuery.data?.kpis.usageTypeCostKpis.grossS3Cost ?? 0}
                  />
                ) : showUsageOperationTable ? (
                  <S3UsageOperationTable rows={usageOperationRows} />
                ) : showStorageTypeCostTable ? (
                  <S3StorageTypeCostTable rows={storageTypeCostRows} />
                ) : (
                  <S3BucketInsightsTable
                    rows={filteredBucketRows}
                    totalGrossCost={graphSource?.kpis.bucketCostKpis.grossBucketCost ?? 0}
                    onBucketClick={(bucketName) => {
                      const searchParams = new URLSearchParams(location.search);
                      searchParams.set("s3Section", "cost");
                      navigate({
                        pathname: `/dashboard/s3/bucket/${encodeURIComponent(bucketName)}`,
                        search: searchParams.toString(),
                      });
                    }}
                  />
                )}
              </Suspense>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
