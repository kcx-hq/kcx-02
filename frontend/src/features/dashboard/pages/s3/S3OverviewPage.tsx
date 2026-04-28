import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { useS3CostInsightsQuery } from "../../hooks/useDashboardQueries";
import { dashboardApi, type S3CostInsightsFiltersQuery } from "../../api/dashboardApi";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import { S3BucketInsightsTable, type S3BucketTableRow } from "./components/S3BucketInsightsTable";
import { S3CostCategoryTable, type S3CostCategoryTableRow } from "./components/S3CostCategoryTable";
import { S3UsageOperationTable, type S3UsageOperationTableRow } from "./components/S3UsageOperationTable";
import { S3OverviewChartPanel } from "./components/S3OverviewChartPanel";
import { S3OverviewFilters } from "./components/S3OverviewFilters";
import type { S3OverviewFilterValue } from "./components/s3Overview.types";

const DEFAULT_FILTERS: S3OverviewFilterValue = {
  seriesBy: "bucket",
  seriesValues: [],
  storageClass: [],
  region: "",
  costBy: "date",
  yAxisMetric: "billed_cost",
  chartType: "bar",
  compareMode: "none",
};

const SERIES_BY_OPTIONS: Array<S3OverviewFilterValue["seriesBy"]> = [
  "bucket",
  "cost_category",
  "operation",
  "product_family",
  "storage_class",
];
const COST_BY_OPTIONS: Array<S3OverviewFilterValue["costBy"]> = ["date", "bucket", "region", "account"];
const Y_AXIS_OPTIONS: Array<S3OverviewFilterValue["yAxisMetric"]> = ["billed_cost", "effective_cost", "amortized_cost", "usage_quantity"];
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
  const region = (params.get("s3Region") ?? "").trim();
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
    region,
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

export default function S3OverviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();
  const filters = useMemo(() => parseFiltersFromSearch(location.search), [location.search]);

  const applyFiltersToUrl = (nextFilters: S3OverviewFilterValue) => {
    const params = new URLSearchParams(location.search);
    if (nextFilters.seriesBy !== DEFAULT_FILTERS.seriesBy) params.set("s3SeriesBy", nextFilters.seriesBy);
    else params.delete("s3SeriesBy");
    if (nextFilters.seriesValues.length > 0) params.set("s3SeriesValues", nextFilters.seriesValues.join(","));
    else params.delete("s3SeriesValues");
    if (nextFilters.storageClass.length > 0) params.set("s3StorageClass", nextFilters.storageClass.join(","));
    else params.delete("s3StorageClass");
    if (nextFilters.region) params.set("s3Region", nextFilters.region);
    else params.delete("s3Region");
    if (nextFilters.costBy !== DEFAULT_FILTERS.costBy) params.set("s3CostBy", nextFilters.costBy);
    else params.delete("s3CostBy");
    if (nextFilters.yAxisMetric !== DEFAULT_FILTERS.yAxisMetric) params.set("s3YAxisMetric", nextFilters.yAxisMetric);
    else params.delete("s3YAxisMetric");
    if (nextFilters.chartType !== DEFAULT_FILTERS.chartType) params.set("s3ChartType", nextFilters.chartType);
    else params.delete("s3ChartType");
    if (nextFilters.compareMode !== DEFAULT_FILTERS.compareMode) params.set("s3Compare", nextFilters.compareMode);
    else params.delete("s3Compare");
    params.delete("s3TopN");
    params.delete("s3SortOrder");

    const nextSearch = params.toString();
    const currentSearch = location.search.startsWith("?") ? location.search.slice(1) : location.search;
    if (nextSearch !== currentSearch) {
      navigate({ pathname: location.pathname, search: nextSearch }, { replace: true });
    }
  };

  const queryFilters = useMemo<S3CostInsightsFiltersQuery>(
    () => ({
      ...(filters.seriesBy === "cost_category" && filters.seriesValues.length > 0 ? { costCategory: filters.seriesValues } : {}),
      ...(filters.seriesValues.length > 0 ? { seriesValues: filters.seriesValues } : {}),
      ...(filters.storageClass.length > 0 ? { storageClass: filters.storageClass } : {}),
      ...(filters.region ? { region: [filters.region] } : {}),
      costBy: filters.costBy,
      seriesBy: filters.seriesBy,
      yAxisMetric: filters.yAxisMetric,
    }),
    [filters],
  );

  const query = useS3CostInsightsQuery(queryFilters);
  const breakdown = query.data?.chart.breakdown;
  const bucketRows = useMemo(() => (query.data?.bucketTable ?? []) as S3BucketTableRow[], [query.data?.bucketTable]);
  const costCategoryRows = useMemo(
    () => (query.data?.costCategoryTable ?? []) as S3CostCategoryTableRow[],
    [query.data?.costCategoryTable],
  );
  const usageOperationRows = useMemo(
    () => (query.data?.usageOperationTable ?? []) as S3UsageOperationTableRow[],
    [query.data?.usageOperationTable],
  );
  const filteredBucketRows = useMemo(() => {
    if (filters.seriesBy !== "bucket" || filters.seriesValues.length === 0) {
      return bucketRows;
    }
    const selected = new Set(filters.seriesValues.map((item) => item.trim().toLowerCase()).filter((item) => item.length > 0));
    return bucketRows.filter((row) => selected.has(String(row.bucketName ?? "").trim().toLowerCase()));
  }, [bucketRows, filters.seriesBy, filters.seriesValues]);
  const showCostCategoryTable = filters.seriesBy === "cost_category";
  const showCostCategoryUsageInsightTable = showCostCategoryTable && filters.seriesValues.length > 0;
  const showUsageOperationTable = filters.seriesBy === "usage_type" || filters.seriesBy === "operation";
  const isInitialLoading = query.isLoading && !query.data;
  const hasBlockingError = query.isError && !query.data;

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

  const comparisonQuery = useQuery({
    queryKey: ["dashboard", "s3", "cost-insights", "previous-period", previousScope, queryFilters, filters.compareMode],
    queryFn: () => dashboardApi.getS3CostInsights(previousScope as NonNullable<typeof previousScope>, queryFilters),
    enabled: filters.compareMode === "previous_period" && Boolean(previousScope),
  });

  const comparisonTotal = comparisonQuery.data?.kpis.totalS3Cost ?? null;

  return (
    <div className="dashboard-page s3-overview-page">
      <S3OverviewFilters
        value={filters}
        onChange={applyFiltersToUrl}
        filterOptions={query.data?.filterOptions}
        isLoading={isInitialLoading}
        isError={hasBlockingError}
        errorMessage={query.error?.message}
        onRetry={() => {
          void query.refetch();
        }}
      />
      <S3OverviewChartPanel
        breakdown={breakdown}
        costBy={filters.costBy}
        yAxisMetric={filters.yAxisMetric}
        chartType={filters.chartType}
        compareMode={filters.compareMode}
        currentPeriodTotal={query.data?.kpis.totalS3Cost ?? null}
        previousPeriodTotal={comparisonTotal}
        comparisonLoading={filters.compareMode === "previous_period" && comparisonQuery.isLoading}
        comparisonError={filters.compareMode === "previous_period" && comparisonQuery.isError}
        comparisonErrorMessage={comparisonQuery.error?.message}
        isLoading={isInitialLoading}
        isError={hasBlockingError}
        errorMessage={query.error?.message}
        onRetry={() => {
          void query.refetch();
        }}
        onReset={() => applyFiltersToUrl(DEFAULT_FILTERS)}
        onChartTypeChange={(nextType) => applyFiltersToUrl({ ...filters, chartType: nextType })}
      />
      {!hasBlockingError ? (
        <section
          className="s3-overview-table-panel"
          aria-label={
            showCostCategoryUsageInsightTable || showUsageOperationTable
              ? "S3 usage operation insights table"
              : showCostCategoryTable
              ? "S3 cost category insights table"
              : "S3 bucket insights table"
          }
        >
          {isInitialLoading ? (
            <p className="dashboard-note">
              {showCostCategoryUsageInsightTable || showUsageOperationTable
                ? "Loading S3 usage type operation insights..."
                : showCostCategoryTable
                ? "Loading S3 cost category insights..."
                : "Loading S3 bucket insights..."}
            </p>
          ) : showCostCategoryUsageInsightTable ? (
            <S3UsageOperationTable rows={usageOperationRows} />
          ) : showCostCategoryTable ? (
            <S3CostCategoryTable rows={costCategoryRows} />
          ) : showUsageOperationTable ? (
            <S3UsageOperationTable rows={usageOperationRows} />
          ) : (
            <S3BucketInsightsTable
              rows={filteredBucketRows}
              totalS3Cost={query.data?.kpis.totalS3Cost ?? 0}
              onBucketClick={(bucketName) => {
                navigate({
                  pathname: `/dashboard/s3/cost/bucket/${encodeURIComponent(bucketName)}`,
                  search: location.search,
                });
              }}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
