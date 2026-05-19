import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { S3CostInsightsFiltersQuery } from "../../api/dashboardApi";
import { useS3CostInsightsQuery } from "../../hooks/useDashboardQueries";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { S3UsageFilters } from "./usage/components/S3UsageFilters";
import { S3UsageChartPanel } from "./usage/components/S3UsageChartPanel";
import { S3UsageKpiSection } from "./usage/components/S3UsageKpiSection";
import {
  S3UsageInsightsTable,
  type S3BucketUsageRow,
  type S3UsageInsightsRow,
} from "./usage/components/S3UsageInsightsTable";
import type { S3UsageFilterValue } from "./usage/components/s3Usage.types";

const DEFAULT_FILTERS: S3UsageFilterValue = {
  seriesBy: "bucket",
  seriesValue: "",
  category: "storage",
  compareMode: "none",
  storageClass: "",
  xAxis: "date",
  yAxisMetric: "usage_quantity",
  chartType: "bar",
};

const X_AXIS_OPTIONS: Array<S3UsageFilterValue["xAxis"]> = ["date", "bucket", "region", "account"];
const CHART_OPTIONS: Array<S3UsageFilterValue["chartType"]> = ["bar", "line"];

const normalizeUsageView = (next: S3UsageFilterValue): S3UsageFilterValue => {
  if (next.category === "object_count") {
    return { ...next, seriesBy: "bucket", xAxis: "date" };
  }
  if (next.compareMode === "previous_period") {
    return { ...next, xAxis: "date", chartType: "line" };
  }
  if (next.seriesBy === "bucket" && next.yAxisMetric === "usage_quantity" && next.xAxis !== "date") {
    return { ...next, xAxis: "date" };
  }
  return next;
};

const parseFiltersFromSearch = (search: string): S3UsageFilterValue => {
  const params = new URLSearchParams(search);
  const seriesBy = params.get("s3SeriesBy");
  const seriesValues = (params.get("s3SeriesValues") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const storageClass = (params.get("s3StorageClass") ?? "")
    .split(",")
    .map((item) => item.trim())
    .find((item) => item.length > 0) ?? "";
  const xAxis = params.get("s3CostBy");
  const chartType = params.get("s3ChartType");
  const category = params.get("s3Category");
  const compareMode = params.get("s3Compare");

  return {
    seriesBy:
      seriesBy === "bucket" || seriesBy === "usage_type" || seriesBy === "operation" || seriesBy === "storage_class"
        ? seriesBy
        : "bucket",
    seriesValue: seriesValues[0] ?? "",
    category:
      category === "storage" || category === "data_transfer" || category === "request" || category === "object_count" || category === "api_operations"
        ? category
        : DEFAULT_FILTERS.category,
    compareMode: compareMode === "previous_period" ? "previous_period" : "none",
    storageClass,
    xAxis: X_AXIS_OPTIONS.includes(xAxis as S3UsageFilterValue["xAxis"])
      ? (xAxis as S3UsageFilterValue["xAxis"])
      : DEFAULT_FILTERS.xAxis,
    yAxisMetric: "usage_quantity",
    chartType: CHART_OPTIONS.includes(chartType as S3UsageFilterValue["chartType"])
      ? (chartType as S3UsageFilterValue["chartType"])
      : DEFAULT_FILTERS.chartType,
  };
};

export default function S3UsagePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const filters = useMemo(() => normalizeUsageView(parseFiltersFromSearch(location.search)), [location.search]);
  const debouncedFilters = useDebouncedValue(filters, 220);

  const applyFilters = (next: S3UsageFilterValue) => {
    const normalizedNext = normalizeUsageView(next);
    const params = new URLSearchParams(location.search);
    if (normalizedNext.seriesBy !== DEFAULT_FILTERS.seriesBy) params.set("s3SeriesBy", normalizedNext.seriesBy);
    else params.delete("s3SeriesBy");
    if (normalizedNext.seriesValue) params.set("s3SeriesValues", normalizedNext.seriesValue);
    else params.delete("s3SeriesValues");
    if (normalizedNext.category) params.set("s3Category", normalizedNext.category);
    else params.delete("s3Category");
    params.delete("s3Region");
    if (normalizedNext.storageClass) params.set("s3StorageClass", normalizedNext.storageClass);
    else params.delete("s3StorageClass");
    if (normalizedNext.xAxis !== DEFAULT_FILTERS.xAxis) params.set("s3CostBy", normalizedNext.xAxis);
    else params.delete("s3CostBy");
    params.delete("s3YAxisMetric");
    if (normalizedNext.chartType !== DEFAULT_FILTERS.chartType) params.set("s3ChartType", normalizedNext.chartType);
    else params.delete("s3ChartType");
    if (normalizedNext.compareMode !== DEFAULT_FILTERS.compareMode) params.set("s3Compare", normalizedNext.compareMode);
    else params.delete("s3Compare");
    params.delete("s3TopN");
    params.delete("s3SortOrder");

    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const queryFilters = useMemo<S3CostInsightsFiltersQuery>(
    () => {
      const isBucketUsage = debouncedFilters.seriesBy === "bucket";
      const usageYAxis: S3CostInsightsFiltersQuery["usageYAxis"] | undefined =
        debouncedFilters.yAxisMetric === "usage_quantity"
          ? debouncedFilters.category === "request"
            ? "request_count"
            : debouncedFilters.category === "data_transfer"
              ? "transfer_gb"
              : debouncedFilters.category === "object_count"
                ? "object_count"
                : debouncedFilters.category === "api_operations"
                  ? "api_operations"
                : "storage_gb"
          : undefined;

      return {
        ...(debouncedFilters.seriesValue ? { seriesValues: [debouncedFilters.seriesValue] } : {}),
        ...(debouncedFilters.category && !isBucketUsage
          && debouncedFilters.category !== "object_count"
          ? {
              costCategory: [
                debouncedFilters.category === "storage"
                  ? "Storage"
                  : debouncedFilters.category === "data_transfer"
                    ? "Transfer"
                    : "Request",
              ],
            }
          : debouncedFilters.seriesBy === "cost_category" && debouncedFilters.seriesValue
            ? { costCategory: [debouncedFilters.seriesValue] }
            : {}),
        ...(debouncedFilters.storageClass ? { storageClass: [debouncedFilters.storageClass] } : {}),
        seriesBy: debouncedFilters.seriesBy,
        costBy: debouncedFilters.xAxis,
        ...(usageYAxis ? { usageYAxis } : {}),
        yAxisMetric: debouncedFilters.yAxisMetric,
        responseMode: "overview",
      };
    },
    [debouncedFilters],
  );

  const query = useS3CostInsightsQuery(queryFilters, { staleTime: 120_000 });
  const [enableSecondaryBreakdowns, setEnableSecondaryBreakdowns] = useState(false);
  const shouldLoadUsageBreakdowns = !query.isLoading && !query.isError && (query.data?.bucketTable?.length ?? 0) > 0;
  const shouldLoadStorageBreakdown = shouldLoadUsageBreakdowns && (filters.category === "" || filters.category === "storage");
  const shouldLoadTransferBreakdown =
    shouldLoadUsageBreakdowns &&
    (filters.category === "data_transfer" || (filters.category === "" && enableSecondaryBreakdowns));
  const shouldLoadRequestBreakdown =
    shouldLoadUsageBreakdowns &&
    (filters.category === "request" || (filters.category === "" && enableSecondaryBreakdowns));

  useEffect(() => {
    if (!shouldLoadUsageBreakdowns || filters.category !== "") {
      setEnableSecondaryBreakdowns(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setEnableSecondaryBreakdowns(true);
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [filters.category, shouldLoadUsageBreakdowns]);

  const storageBreakdownQuery = useS3CostInsightsQuery({
    ...queryFilters,
    costCategory: ["Storage"],
    seriesBy: "bucket",
    costBy: "date",
    responseMode: "quick",
  }, { enabled: shouldLoadStorageBreakdown, staleTime: 120_000 });
  const transferBreakdownQuery = useS3CostInsightsQuery({
    ...queryFilters,
    costCategory: ["Transfer"],
    seriesBy: "bucket",
    costBy: "date",
    responseMode: "quick",
  }, { enabled: shouldLoadTransferBreakdown, staleTime: 120_000 });
  const requestBreakdownQuery = useS3CostInsightsQuery({
    ...queryFilters,
    costCategory: ["Request"],
    seriesBy: "bucket",
    costBy: "date",
    responseMode: "quick",
  }, { enabled: shouldLoadRequestBreakdown, staleTime: 120_000 });
  const usageRows = useMemo(() => (query.data?.usageOperationTable ?? []) as S3UsageInsightsRow[], [query.data?.usageOperationTable]);
  const bucketUsageRows = useMemo<S3BucketUsageRow[]>(() => {
    const bucketRows = query.data?.bucketTable ?? [];
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
    const objectCountByBucket = new Map(
      bucketRows.map((item) => {
        const bucketName = String(item.bucketName ?? "").trim();
        const objectCount = Number(item.objectCount ?? item.storageLens?.objectCount ?? 0);
        return [bucketName, objectCount];
      }),
    );

    const rows = bucketRows.map((item) => {
      const bucketName = String(item.bucketName ?? "").trim();
      const objectCount = Number(objectCountByBucket.get(bucketName) ?? 0);
      const storageGb = Number(item.storageGb ?? item.storageSizeGb ?? storageByBucket.get(bucketName) ?? 0);
      const transferGb = Number(item.transferGb ?? transferByBucket.get(bucketName) ?? 0);
      const requestCount = Number(item.requestCount ?? requestByBucket.get(bucketName) ?? 0);
      const dominantUsageType = String(item.dominantUsageType ?? "Mixed Heavy");
      return {
        bucketName,
        quantity: requestCount,
        storageGb,
        transferGb,
        requestCount,
        objectCount,
        region: String(item.region ?? "global"),
        dominantUsageType:
          dominantUsageType === "Request Heavy" || dominantUsageType === "Storage Heavy" || dominantUsageType === "Transfer Heavy" || dominantUsageType === "Retrieval Heavy"
            ? dominantUsageType
            : "Mixed Heavy",
      };
    });

    return rows
      .filter((row) => row.bucketName.length > 0)
      .sort((a, b) => b.storageGb - a.storageGb || b.requestCount - a.requestCount || b.transferGb - a.transferGb);
  }, [
    filters.category,
    query.data?.bucketTable,
    query.data?.chart.breakdown.series,
    requestBreakdownQuery.data?.chart.breakdown.series,
    storageBreakdownQuery.data?.chart.breakdown.series,
    transferBreakdownQuery.data?.chart.breakdown.series,
  ]);
  const showAllCategoryBreakdown = false;
  const bucketQuantityLabel = "Request Count";
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

      <S3UsageKpiSection kpis={query.data?.kpis.usageSummaryKpis} isLoading={isInitialLoading} />

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
        onBucketClick={(bucketName) => {
          const searchParams = new URLSearchParams(location.search);
          searchParams.set("s3Section", "usage");
          navigate({
            pathname: `/dashboard/s3/bucket/${encodeURIComponent(bucketName)}`,
            search: searchParams.toString(),
          });
        }}
      />

      {!hasBlockingError ? (
        <section className="s3-overview-table-panel" aria-label="S3 usage table">
          {isInitialLoading ? (
            <div className="s3-usage-table-skeleton" aria-hidden="true">
              <div className="s3-usage-table-skeleton__toolbar" />
              <div className="s3-usage-table-skeleton__row" />
              <div className="s3-usage-table-skeleton__row" />
              <div className="s3-usage-table-skeleton__row" />
              <div className="s3-usage-table-skeleton__row" />
              <div className="s3-usage-table-skeleton__row" />
              <div className="s3-usage-table-skeleton__row" />
              <div className="s3-usage-table-skeleton__row" />
            </div>
          ) : (
            <S3UsageInsightsTable
              rows={usageRows}
              bucketRows={bucketUsageRows}
              bucketQuantityLabel={bucketQuantityLabel}
              usageCategory={filters.category}
              showAllCategoryBreakdown={showAllCategoryBreakdown}
              onBucketClick={(bucketName) => {
                const searchParams = new URLSearchParams(location.search);
                searchParams.set("s3Section", "usage");
                navigate({
                  pathname: `/dashboard/s3/bucket/${encodeURIComponent(bucketName)}`,
                  search: searchParams.toString(),
                });
              }}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
