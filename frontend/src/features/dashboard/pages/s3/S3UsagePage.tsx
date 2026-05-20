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
  type S3OperationGroupUsageRow,
  type S3UsageInsightsRow,
} from "./usage/components/S3UsageInsightsTable";
import type { S3UsageFilterValue } from "./usage/components/s3Usage.types";
import { CostExplorerSkeleton } from "./components/CostExplorerSkeleton";

const DEFAULT_FILTERS: S3UsageFilterValue = {
  seriesBy: "bucket",
  seriesValue: "",
  category: "storage",
  compareMode: "none",
  xAxis: "date",
  yAxisMetric: "usage_quantity",
  chartType: "bar",
};

const X_AXIS_OPTIONS: Array<S3UsageFilterValue["xAxis"]> = ["date", "bucket", "region", "account"];
const CHART_OPTIONS: Array<S3UsageFilterValue["chartType"]> = ["bar", "line"];
const ALLOWED_CATEGORY_BY_SERIES: Record<S3UsageFilterValue["seriesBy"], Array<Exclude<S3UsageFilterValue["category"], "">>> = {
  bucket: ["storage", "request", "data_transfer", "object_count"],
  operation_group: ["request", "data_transfer"],
};

const formatAsQueryDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const uniqueNonEmpty = (values: Array<string | null | undefined>): string[] =>
  Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  );

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
  const xAxis = params.get("s3CostBy");
  const chartType = params.get("s3ChartType");
  const category = params.get("s3Category");
  const compareMode = params.get("s3Compare");

  return {
    seriesBy: seriesBy === "bucket" || seriesBy === "operation_group" ? seriesBy : "bucket",
    seriesValue: seriesValues[0] ?? "",
    category:
      category === "storage"
      || category === "data_transfer"
      || category === "request"
      || category === "object_count"
        ? category
        : DEFAULT_FILTERS.category,
    compareMode: compareMode === "previous_period" ? "previous_period" : "none",
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
    params.delete("s3StorageClass");
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
              : "storage_gb";

      return {
        xAxis: "date",
        usageBy: debouncedFilters.seriesBy,
        ...(debouncedFilters.seriesValue ? { seriesValues: [debouncedFilters.seriesValue] } : {}),
        yAxis,
        compareBy: debouncedFilters.compareMode,
      };
    },
    [debouncedFilters],
  );

  const query = useS3UsageInsightsQuery(queryFilters, { staleTime: 120_000 });
  const secondaryOperationGroupFilters = useMemo<S3UsageInsightsFiltersQuery | undefined>(() => {
    if (debouncedFilters.seriesBy !== "operation_group") return undefined;
    if (debouncedFilters.category !== "request" && debouncedFilters.category !== "data_transfer") return undefined;
    const oppositeYAxis: S3UsageInsightsFiltersQuery["yAxis"] =
      debouncedFilters.category === "request" ? "transfer_gb" : "request_count";
    return {
      xAxis: "date",
      usageBy: debouncedFilters.seriesBy,
      ...(debouncedFilters.seriesValue ? { seriesValues: [debouncedFilters.seriesValue] } : {}),
      yAxis: oppositeYAxis,
      compareBy: debouncedFilters.compareMode,
    };
  }, [debouncedFilters]);
  const secondaryOperationGroupQuery = useS3UsageInsightsQuery(secondaryOperationGroupFilters, {
    enabled: Boolean(secondaryOperationGroupFilters),
    staleTime: 120_000,
  });

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
  const operationGroupRows = useMemo<S3OperationGroupUsageRow[]>(() => {
    if (filters.seriesBy !== "operation_group") return [];
    const primarySeries = query.data?.chart.breakdown.series ?? [];
    const secondarySeries = secondaryOperationGroupQuery.data?.chart.breakdown.series ?? [];

    const requestSeries = filters.category === "request" ? primarySeries : secondarySeries;
    const transferSeries = filters.category === "data_transfer" ? primarySeries : secondarySeries;
    const requestMap = new Map<string, number>();
    const transferMap = new Map<string, number>();

    for (const series of requestSeries) {
      const key = String(series.name ?? "").trim();
      if (!key) continue;
      const total = (series.values ?? []).reduce((sum, value) => sum + Number(value ?? 0), 0);
      requestMap.set(key, total);
    }
    for (const series of transferSeries) {
      const key = String(series.name ?? "").trim();
      if (!key) continue;
      const total = (series.values ?? []).reduce((sum, value) => sum + Number(value ?? 0), 0);
      transferMap.set(key, total);
    }

    const groups = Array.from(new Set([...requestMap.keys(), ...transferMap.keys()]));
    const totalRequest = Array.from(requestMap.values()).reduce((sum, value) => sum + value, 0);
    const totalTransfer = Array.from(transferMap.values()).reduce((sum, value) => sum + value, 0);

    return groups
      .map((group) => {
        const requestCount = Number(requestMap.get(group) ?? 0);
        const transferGb = Number(transferMap.get(group) ?? 0);
        return {
          operationGroup: group,
          requestCount,
          transferGb,
          requestPct: totalRequest > 0 ? (requestCount / totalRequest) * 100 : 0,
          transferPct: totalTransfer > 0 ? (transferGb / totalTransfer) * 100 : 0,
        };
      })
      .sort((a, b) => b.requestCount - a.requestCount || b.transferGb - a.transferGb || a.operationGroup.localeCompare(b.operationGroup));
  }, [filters.category, filters.seriesBy, query.data?.chart.breakdown.series, secondaryOperationGroupQuery.data?.chart.breakdown.series]);
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
  const resolvedFilterOptions = useMemo(() => {
    const filterOptions = query.data?.filterOptions;
    const bucketsFromTable = bucketUsageRows.map((row) => row.bucketName);
    const operationsFromChart = (query.data?.chart.breakdown.series ?? []).map((series) => String(series.name ?? "").trim());
    const operationsFromApi = ((filterOptions as { operation?: string[] } | undefined)?.operation ?? []);
    const regionsFromApi = ((filterOptions as { region?: string[] } | undefined)?.region ?? []);
    const accountsFromApi = ((filterOptions as { account?: string[] } | undefined)?.account ?? []);

    return {
      ...(filterOptions ?? {}),
      costCategory: filterOptions?.costCategory ?? [],
      usageType: filterOptions?.usageType ?? [],
      bucket: (filterOptions?.bucket?.length ?? 0) > 0 ? filterOptions?.bucket ?? [] : uniqueNonEmpty(bucketsFromTable),
      operation: uniqueNonEmpty([...operationsFromApi, ...operationsFromChart]),
      storageClass: [],
      region: uniqueNonEmpty(regionsFromApi),
      account: uniqueNonEmpty(accountsFromApi),
      costBy: filterOptions?.costBy ?? ["date", "bucket", "region", "account"],
      seriesBy: filterOptions?.seriesBy ?? ["bucket", "operation"],
      yAxisMetric: filterOptions?.yAxisMetric ?? ["usage_quantity"],
    };
  }, [bucketUsageRows, query.data?.chart.breakdown.series, query.data?.filterOptions]);
  const topRequestGroup = useMemo(() => {
    if (filters.seriesBy !== "operation_group" || filters.category !== "request") return "--";
    const series = query.data?.chart.breakdown.series ?? [];
    if (series.length === 0) return "--";
    const top = series
      .map((item) => ({
        name: String(item.name ?? "").trim(),
        total: (item.values ?? []).reduce((sum, value) => sum + Number(value ?? 0), 0),
      }))
      .filter((item) => item.name.length > 0)
      .sort((a, b) => b.total - a.total)[0];
    return top?.name || "--";
  }, [filters.category, filters.seriesBy, query.data?.chart.breakdown.series]);
  const highestRequestBucket = useMemo(() => {
    if (filters.seriesBy !== "operation_group" || filters.category !== "request") return "--";
    const topBucket = (bucketUsageRows ?? [])
      .map((row) => ({
        bucketName: String(row.bucketName ?? "").trim(),
        requestCount: Number(row.requestCount ?? 0),
      }))
      .filter((row) => row.bucketName.length > 0)
      .sort((a, b) => b.requestCount - a.requestCount)[0];
    return topBucket?.bucketName || "--";
  }, [bucketUsageRows, filters.category, filters.seriesBy]);
  const topTransferOperationGroup = useMemo(() => {
    if (filters.seriesBy !== "operation_group" || filters.category !== "data_transfer") return "--";
    const series = query.data?.chart.breakdown.series ?? [];
    if (series.length === 0) return "--";
    const top = series
      .map((item) => ({
        name: String(item.name ?? "").trim(),
        total: (item.values ?? []).reduce((sum, value) => sum + Number(value ?? 0), 0),
      }))
      .filter((item) => item.name.length > 0)
      .sort((a, b) => b.total - a.total)[0];
    return top?.name || "--";
  }, [filters.category, filters.seriesBy, query.data?.chart.breakdown.series]);
  const highestTransferBucket = useMemo(() => {
    if (filters.seriesBy !== "operation_group" || filters.category !== "data_transfer") return "--";
    const topBucket = (bucketUsageRows ?? [])
      .map((row) => ({
        bucketName: String(row.bucketName ?? "").trim(),
        transferGb: Number(row.transferGb ?? 0),
      }))
      .filter((row) => row.bucketName.length > 0)
      .sort((a, b) => b.transferGb - a.transferGb)[0];
    return topBucket?.bucketName || "--";
  }, [bucketUsageRows, filters.category, filters.seriesBy]);
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
        filterOptions={resolvedFilterOptions}
        onChange={applyFilters}
        onReset={() => applyFilters(DEFAULT_FILTERS)}
        isLoading={false}
      />

      {isBelowOnlyLoading ? <CostExplorerSkeleton showFilter={false} /> : null}

      {!isBelowOnlyLoading ? (
        <S3UsageKpiSection
          kpis={query.data?.kpis.usageSummaryKpis}
          seriesBy={filters.seriesBy}
          category={filters.category}
          topRequestGroup={topRequestGroup}
          highestRequestBucket={highestRequestBucket}
          topTransferOperationGroup={topTransferOperationGroup}
          highestTransferBucket={highestTransferBucket}
          isLoading={false}
        />
      ) : null}

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
        <S3UsageInsightsTable
          seriesBy={filters.seriesBy}
          rows={usageRows}
          bucketRows={bucketUsageRows}
          operationGroupRows={operationGroupRows}
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
      ) : null}
    </div>
  );
}
