import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { S3CostInsightsFiltersQuery } from "../../api/dashboardApi";
import { useS3CostInsightsQuery } from "../../hooks/useDashboardQueries";
import { S3UsageFilters } from "./usage/components/S3UsageFilters";
import { S3UsageChartPanel } from "./usage/components/S3UsageChartPanel";
import {
  S3UsageInsightsTable,
  type S3BucketUsageRow,
  type S3UsageInsightsRow,
} from "./usage/components/S3UsageInsightsTable";
import type { S3UsageFilterValue } from "./usage/components/s3Usage.types";

const DEFAULT_FILTERS: S3UsageFilterValue = {
  seriesBy: "bucket",
  seriesValue: "",
  category: "",
  region: "",
  storageClass: "",
  xAxis: "date",
  yAxisMetric: "usage_quantity",
  chartType: "bar",
};

const X_AXIS_OPTIONS: Array<S3UsageFilterValue["xAxis"]> = ["date", "bucket", "region", "account"];
const Y_AXIS_OPTIONS: Array<S3UsageFilterValue["yAxisMetric"]> = ["usage_quantity"];
const CHART_OPTIONS: Array<S3UsageFilterValue["chartType"]> = ["bar", "line"];

const normalizeUsageView = (next: S3UsageFilterValue): S3UsageFilterValue => {
  if (next.seriesBy === "bucket" && next.yAxisMetric === "usage_quantity" && next.xAxis !== "date") {
    return { ...next, xAxis: "date" };
  }
  return next;
};

const parseFiltersFromSearch = (search: string): S3UsageFilterValue => {
  const params = new URLSearchParams(search);
  const seriesValues = (params.get("s3SeriesValues") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const region = (params.get("s3Region") ?? "").trim();
  const storageClass = (params.get("s3StorageClass") ?? "")
    .split(",")
    .map((item) => item.trim())
    .find((item) => item.length > 0) ?? "";
  const xAxis = params.get("s3CostBy");
  const yAxisMetric = params.get("s3YAxisMetric");
  const chartType = params.get("s3ChartType");
  const category = params.get("s3Category");

  return {
    seriesBy: "bucket",
    seriesValue: seriesValues[0] ?? "",
    category:
      category === "storage" || category === "data_transfer" || category === "request"
        ? category
        : DEFAULT_FILTERS.category,
    region,
    storageClass,
    xAxis: X_AXIS_OPTIONS.includes(xAxis as S3UsageFilterValue["xAxis"])
      ? (xAxis as S3UsageFilterValue["xAxis"])
      : DEFAULT_FILTERS.xAxis,
    yAxisMetric: Y_AXIS_OPTIONS.includes(yAxisMetric as S3UsageFilterValue["yAxisMetric"])
      ? (yAxisMetric as S3UsageFilterValue["yAxisMetric"])
      : DEFAULT_FILTERS.yAxisMetric,
    chartType: CHART_OPTIONS.includes(chartType as S3UsageFilterValue["chartType"])
      ? (chartType as S3UsageFilterValue["chartType"])
      : DEFAULT_FILTERS.chartType,
  };
};

export default function S3UsagePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const filters = useMemo(() => normalizeUsageView(parseFiltersFromSearch(location.search)), [location.search]);

  const applyFilters = (next: S3UsageFilterValue) => {
    const normalizedNext = normalizeUsageView(next);
    const params = new URLSearchParams(location.search);
    if (normalizedNext.seriesBy !== DEFAULT_FILTERS.seriesBy) params.set("s3SeriesBy", normalizedNext.seriesBy);
    else params.delete("s3SeriesBy");
    if (normalizedNext.seriesValue) params.set("s3SeriesValues", normalizedNext.seriesValue);
    else params.delete("s3SeriesValues");
    if (normalizedNext.category) params.set("s3Category", normalizedNext.category);
    else params.delete("s3Category");
    if (normalizedNext.region) params.set("s3Region", normalizedNext.region);
    else params.delete("s3Region");
    if (normalizedNext.storageClass) params.set("s3StorageClass", normalizedNext.storageClass);
    else params.delete("s3StorageClass");
    if (normalizedNext.xAxis !== DEFAULT_FILTERS.xAxis) params.set("s3CostBy", normalizedNext.xAxis);
    else params.delete("s3CostBy");
    if (normalizedNext.yAxisMetric !== DEFAULT_FILTERS.yAxisMetric) params.set("s3YAxisMetric", normalizedNext.yAxisMetric);
    else params.delete("s3YAxisMetric");
    if (normalizedNext.chartType !== DEFAULT_FILTERS.chartType) params.set("s3ChartType", normalizedNext.chartType);
    else params.delete("s3ChartType");
    params.delete("s3Compare");
    params.delete("s3TopN");
    params.delete("s3SortOrder");

    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const queryFilters = useMemo<S3CostInsightsFiltersQuery>(
    () => ({
      ...(filters.seriesValue ? { seriesValues: [filters.seriesValue] } : {}),
      ...(filters.category
        ? {
            costCategory: [
              filters.category === "storage"
                ? "Storage"
                : filters.category === "data_transfer"
                  ? "Transfer"
                  : "Request",
            ],
          }
        : filters.seriesBy === "cost_category" && filters.seriesValue
          ? { costCategory: [filters.seriesValue] }
          : {}),
      ...(filters.region ? { region: [filters.region] } : {}),
      ...(filters.storageClass ? { storageClass: [filters.storageClass] } : {}),
      seriesBy: filters.seriesBy,
      costBy: filters.xAxis,
      yAxisMetric: filters.yAxisMetric,
    }),
    [filters],
  );

  const query = useS3CostInsightsQuery(queryFilters);
  const storageBreakdownQuery = useS3CostInsightsQuery({
    ...queryFilters,
    costCategory: ["Storage"],
    seriesBy: "bucket",
    costBy: "date",
    yAxisMetric: "usage_quantity",
  });
  const transferBreakdownQuery = useS3CostInsightsQuery({
    ...queryFilters,
    costCategory: ["Transfer"],
    seriesBy: "bucket",
    costBy: "date",
    yAxisMetric: "usage_quantity",
  });
  const requestBreakdownQuery = useS3CostInsightsQuery({
    ...queryFilters,
    costCategory: ["Request"],
    seriesBy: "bucket",
    costBy: "date",
    yAxisMetric: "usage_quantity",
  });
  const usageRows = useMemo(() => (query.data?.usageOperationTable ?? []) as S3UsageInsightsRow[], [query.data?.usageOperationTable]);
  const bucketUsageRows = useMemo<S3BucketUsageRow[]>(() => {
    const bucketRows = query.data?.bucketTable ?? [];
    const series = query.data?.chart.breakdown.series ?? [];
    const storageSeries = storageBreakdownQuery.data?.chart.breakdown.series ?? [];
    const transferSeries = transferBreakdownQuery.data?.chart.breakdown.series ?? [];
    const requestSeries = requestBreakdownQuery.data?.chart.breakdown.series ?? [];

    const storageByBucket = new Map(
      storageSeries.map((item) => [
        String(item.name ?? "").trim(),
        item.values.reduce((sum, value) => sum + Number(value ?? 0), 0),
      ]),
    );
    const transferByBucket = new Map(
      transferSeries.map((item) => [
        String(item.name ?? "").trim(),
        item.values.reduce((sum, value) => sum + Number(value ?? 0), 0),
      ]),
    );
    const requestByBucket = new Map(
      requestSeries.map((item) => [
        String(item.name ?? "").trim(),
        item.values.reduce((sum, value) => sum + Number(value ?? 0), 0),
      ]),
    );

    const rows = bucketRows.map((item) => {
      const bucketName = String(item.bucketName ?? "").trim();
      const usageKinds = [
        { key: "Storage", value: Number(storageByBucket.get(bucketName) ?? 0) },
        { key: "Transfer", value: Number(transferByBucket.get(bucketName) ?? 0) },
        { key: "Request", value: Number(requestByBucket.get(bucketName) ?? 0) },
      ].sort((a, b) => b.value - a.value);
      return {
        bucketName,
        quantity: Number(usageKinds[0]?.value ?? 0),
        storageGb: Number(storageByBucket.get(bucketName) ?? 0),
        transferGb: Number(transferByBucket.get(bucketName) ?? 0),
        requestCount: Number(requestByBucket.get(bucketName) ?? 0),
        region: String(item.region ?? "global"),
        usageInfo: `Primary usage: ${usageKinds[0]?.key ?? "Storage"}`,
      };
    });

    return series
      .map((item) => String(item.name ?? "").trim())
      .map((bucketName) => rows.find((row) => row.bucketName === bucketName))
      .filter((row): row is S3BucketUsageRow => Boolean(row))
      .filter((row) => row.bucketName.length > 0)
      .sort((a, b) => b.quantity - a.quantity);
  }, [
    query.data?.bucketTable,
    query.data?.chart.breakdown.series,
    requestBreakdownQuery.data?.chart.breakdown.series,
    storageBreakdownQuery.data?.chart.breakdown.series,
    transferBreakdownQuery.data?.chart.breakdown.series,
  ]);
  const showAllCategoryBreakdown = filters.category === "";
  const isInitialLoading = query.isLoading && !query.data;
  const hasBlockingError = query.isError && !query.data;

  return (
    <div className="dashboard-page s3-overview-page">
      <S3UsageFilters
        value={filters}
        filterOptions={query.data?.filterOptions}
        onChange={applyFilters}
        onReset={() => applyFilters(DEFAULT_FILTERS)}
        isLoading={isInitialLoading}
      />

      <S3UsageChartPanel
        breakdown={query.data?.chart.breakdown}
        seriesBy={filters.seriesBy}
        category={filters.category}
        xAxis={filters.xAxis}
        yAxisMetric={filters.yAxisMetric}
        chartType={filters.chartType}
        onChartTypeChange={(nextType) => applyFilters({ ...filters, chartType: nextType })}
        onReset={() => applyFilters(DEFAULT_FILTERS)}
        onRetry={() => void query.refetch()}
        isLoading={isInitialLoading}
        isError={hasBlockingError}
        errorMessage={query.error?.message}
      />

      {!hasBlockingError ? (
        <section className="s3-overview-table-panel" aria-label="S3 usage table">
          {isInitialLoading ? (
            <p className="dashboard-note">Loading S3 buckets...</p>
          ) : (
            <S3UsageInsightsTable
              rows={usageRows}
              bucketRows={bucketUsageRows}
              bucketQuantityLabel="Usage"
              usageCategory={filters.category}
              showAllCategoryBreakdown={showAllCategoryBreakdown}
              onBucketClick={(bucketName) =>
                navigate({
                  pathname: `/dashboard/s3/usage/bucket/${encodeURIComponent(bucketName)}`,
                  search: location.search,
                })
              }
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
