import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { S3UsageInsightsFiltersQuery } from "../../api/dashboardApi";
import { useS3UsageInsightsQuery } from "../../hooks/useDashboardQueries";
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
import { CostExplorerSkeleton } from "./components/CostExplorerSkeleton";

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
const ALLOWED_CATEGORY_BY_SERIES: Record<S3UsageFilterValue["seriesBy"], Array<Exclude<S3UsageFilterValue["category"], "">>> = {
  bucket: ["storage", "request", "data_transfer", "object_count", "api_operations"],
  operation_group: ["request", "data_transfer", "api_operations"],
  storage_class: ["storage_gb_mo", "retrieval_gb"],
};

const formatAsQueryDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const normalizeUsageView = (next: S3UsageFilterValue): S3UsageFilterValue => {
  const allowedCategories = ALLOWED_CATEGORY_BY_SERIES[next.seriesBy];
  const normalizedCategory = allowedCategories.includes(next.category as Exclude<S3UsageFilterValue["category"], "">)
    ? next.category
    : allowedCategories[0];
  if (next.compareMode === "previous_period") {
    return { ...next, category: normalizedCategory, xAxis: "date", chartType: "line" };
  }
  return { ...next, category: normalizedCategory, xAxis: "date" };
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
    seriesBy: seriesBy === "bucket" || seriesBy === "operation_group" || seriesBy === "storage_class" ? seriesBy : "bucket",
    seriesValue: seriesValues[0] ?? "",
    category:
      category === "storage"
      || category === "data_transfer"
      || category === "request"
      || category === "object_count"
      || category === "api_operations"
      || category === "storage_gb_mo"
      || category === "retrieval_gb"
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
  const isDebouncingFilters = debouncedFilters !== filters;
  const billingRangeKey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const start = params.get("billingPeriodStart") || params.get("from") || "";
    const end = params.get("billingPeriodEnd") || params.get("to") || "";
    return `${start}|${end}`;
  }, [location.search]);
  const previousBillingRangeRef = useRef<string | null>(null);
  const [isDateRangeRefreshing, setIsDateRangeRefreshing] = useState(false);

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

  const queryFilters = useMemo<S3UsageInsightsFiltersQuery>(
    () => {
      const yAxis: S3UsageInsightsFiltersQuery["yAxis"] =
        debouncedFilters.category === "request"
          ? "request_count"
          : debouncedFilters.category === "data_transfer"
            ? "transfer_gb"
            : debouncedFilters.category === "object_count"
              ? "object_count"
              : debouncedFilters.category === "api_operations"
                ? "api_operations"
                : debouncedFilters.category === "storage_gb_mo"
                  ? "storage_gb_month"
                  : debouncedFilters.category === "retrieval_gb"
                    ? "retrieval_gb"
                    : "storage_gb";

      return {
        xAxis: "date",
        usageBy: debouncedFilters.seriesBy,
        yAxis,
        compareBy: debouncedFilters.compareMode,
        ...(debouncedFilters.storageClass ? { storageClass: [debouncedFilters.storageClass] } : {}),
      };
    },
    [debouncedFilters],
  );

  const query = useS3UsageInsightsQuery(queryFilters, { staleTime: 120_000 });

  useEffect(() => {
    if (previousBillingRangeRef.current === null) {
      previousBillingRangeRef.current = billingRangeKey;
      return;
    }
    if (previousBillingRangeRef.current !== billingRangeKey) {
      previousBillingRangeRef.current = billingRangeKey;
      setIsDateRangeRefreshing(true);
    }
  }, [billingRangeKey]);

  useEffect(() => {
    if (!query.isFetching) {
      setIsDateRangeRefreshing(false);
    }
  }, [query.isFetching]);

  const usageRows = useMemo(() => (query.data?.usageOperationTable ?? []) as S3UsageInsightsRow[], [query.data?.usageOperationTable]);
  const bucketUsageRows = useMemo<S3BucketUsageRow[]>(() => {
    const bucketRows = query.data?.bucketTable ?? [];

    const rows = bucketRows.map((item) => {
      const bucketName = String(item.bucketName ?? "").trim();
      const objectCount = Number(item.objectCount ?? 0);
      const storageGb = Number(item.storageGb ?? item.storageSizeGb ?? 0);
      const transferGb = Number(item.transferGb ?? 0);
      const requestCount = Number(item.requestCount ?? 0);
      const dominantUsageType = String(item.dominantUsageType ?? "Mixed Heavy");
      const normalizedDominantUsageType: S3BucketUsageRow["dominantUsageType"] =
        dominantUsageType === "Request Heavy" || dominantUsageType === "Storage Heavy" || dominantUsageType === "Transfer Heavy" || dominantUsageType === "Retrieval Heavy"
          ? dominantUsageType
          : "Mixed Heavy";
      return {
        bucketName,
        quantity: requestCount,
        storageGb,
        transferGb,
        requestCount,
        objectCount,
        region: String(item.region ?? "global"),
        dominantUsageType: normalizedDominantUsageType,
      };
    });

    return rows
      .filter((row) => row.bucketName.length > 0)
      .sort((a, b) => b.storageGb - a.storageGb || b.requestCount - a.requestCount || b.transferGb - a.transferGb);
  }, [
    query.data?.bucketTable,
  ]);
  const isInitialLoading = query.isLoading && !query.data;
  const showRefreshSkeleton = isDateRangeRefreshing && query.isFetching;
  const isFilterUpdateLoading = Boolean(query.data) && query.isFetching && !isDateRangeRefreshing;
  const isFullSkeletonLoading = isInitialLoading || showRefreshSkeleton;
  const isBelowOnlyLoading = !isFullSkeletonLoading && (isDebouncingFilters || isFilterUpdateLoading);
  const hasBlockingError = query.isError && !query.data;

  if (isFullSkeletonLoading) {
    return (
      <div className="dashboard-page s3-overview-page">
        <CostExplorerSkeleton showFilter />
      </div>
    );
  }

  return (
    <div className="dashboard-page s3-overview-page">
      <S3UsageFilters
        value={filters}
        filterOptions={query.data?.filterOptions}
        onChange={applyFilters}
        onReset={() => applyFilters(DEFAULT_FILTERS)}
        isLoading={false}
      />

      {isBelowOnlyLoading ? <CostExplorerSkeleton showFilter={false} /> : null}

      {!isBelowOnlyLoading ? <S3UsageKpiSection kpis={query.data?.kpis.usageSummaryKpis} isLoading={false} /> : null}

      {!isBelowOnlyLoading ? (
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
          isLoading={false}
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
      ) : null}

      {!isBelowOnlyLoading && !hasBlockingError ? (
        <section className="s3-overview-table-panel" aria-label="S3 usage table">
          <S3UsageInsightsTable
            rows={usageRows}
            bucketRows={bucketUsageRows}
            usageCategory={filters.category}
            onBucketClick={(bucketName) => {
              const searchParams = new URLSearchParams(location.search);
              searchParams.set("s3Section", "usage");
              navigate({
                pathname: `/dashboard/s3/bucket/${encodeURIComponent(bucketName)}`,
                search: searchParams.toString(),
              });
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
