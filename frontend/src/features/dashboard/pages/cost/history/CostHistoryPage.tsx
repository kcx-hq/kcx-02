import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";

import { CostExplorerChartOnlySection } from "../../cost-explorer/components";
import { formatAxisCost, formatTooltipCost } from "../../cost-explorer/costExplorer.utils";
import type { CostHistoryFiltersQuery } from "../../../api/dashboardTypes";
import { useCostHistoryFilterOptionsQuery, useCostHistoryQuery } from "../../../hooks/useDashboardQueries";
import { CostHistoryFiltersPanel } from "./components/CostHistoryFiltersPanel";
import { HistorySectionSkeleton } from "./components/HistorySectionSkeleton";
import {
  DEFAULT_COST_HISTORY_FILTERS,
  Y_AXIS_LABELS,
} from "./config/costHistory.constants";

const MONTH_WINDOW = 13;

const monthStartUtc = (value: Date): Date => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const shiftMonthUtc = (value: Date, deltaMonths: number): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + deltaMonths, 1));

const formatMonthShort = (value: Date): string =>
  value.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

const formatMonthLong = (value: Date): string =>
  value.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

const COST_EPSILON = 1e-9;
const hasCost = (value: number): boolean => Math.abs(Number(value ?? 0)) > COST_EPSILON;
const normalizeAndFilterSeries = (seriesList: Array<{ name: string; values: number[] }>) =>
  seriesList
    .filter((item) => item.values.some((value) => hasCost(value)))
    .sort((left, right) => {
      const leftTotal = left.values.reduce((sum, value) => sum + Math.abs(Number(value ?? 0)), 0);
      const rightTotal = right.values.reduce((sum, value) => sum + Math.abs(Number(value ?? 0)), 0);
      if (rightTotal !== leftTotal) return rightTotal - leftTotal;
      return left.name.localeCompare(right.name);
    });

export default function CostHistoryPage() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [chartMode, setChartMode] = useState<"line" | "bar">("bar");
  const [activePopover, setActivePopover] = useState<"granularity" | "groupBy" | "xAxis" | "yAxisMetric" | null>(null);
  const [filters, setFilters] = useState<Required<CostHistoryFiltersQuery>>(DEFAULT_COST_HISTORY_FILTERS);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      setActivePopover(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePopover(null);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const filtersQuery = useCostHistoryFilterOptionsQuery();
  const historyQuery = useCostHistoryQuery(filters);

  const rawLabels = historyQuery.data?.chart.labels ?? [];
  const rawSeries = historyQuery.data?.chart.series ?? [];

  const { labels, series } = useMemo(() => {
    if (!(filters.xAxis === "date" && filters.granularity === "month")) {
      return { labels: rawLabels, series: normalizeAndFilterSeries(rawSeries) };
    }

    const nowMonth = monthStartUtc(new Date());
    const latestKnownMonth = rawLabels.reduce<Date | null>((latest, label) => {
      const parsed = new Date(label.bucketStart);
      if (Number.isNaN(parsed.getTime())) return latest;
      const bucketMonth = monthStartUtc(parsed);
      if (!latest) return bucketMonth;
      return bucketMonth.getTime() > latest.getTime() ? bucketMonth : latest;
    }, null);
    const endMonth = latestKnownMonth ?? nowMonth;
    const startMonth = shiftMonthUtc(endMonth, -(MONTH_WINDOW - 1));

    const fixedLabels = Array.from({ length: MONTH_WINDOW }, (_, index) => {
      const month = shiftMonthUtc(startMonth, index);
      const iso = month.toISOString();
      return {
        bucketStart: iso,
        short: formatMonthShort(month),
        long: formatMonthLong(month),
      };
    });

    const monthIndexByBucket = new Map(
      fixedLabels.map((item, index) => [monthStartUtc(new Date(item.bucketStart)).toISOString(), index]),
    );

    const normalizedSeries = rawSeries.map((item) => {
      const nextValues = Array(MONTH_WINDOW).fill(0);
      rawLabels.forEach((label, labelIndex) => {
        const parsed = new Date(label.bucketStart);
        if (Number.isNaN(parsed.getTime())) return;
        const monthKey = monthStartUtc(parsed).toISOString();
        const fixedIndex = monthIndexByBucket.get(monthKey);
        if (typeof fixedIndex !== "number") return;
        nextValues[fixedIndex] = Number(item.values[labelIndex] ?? 0);
      });
      return {
        ...item,
        values: nextValues,
      };
    });

    return {
      labels: fixedLabels,
      series: normalizeAndFilterSeries(normalizedSeries),
    };
  }, [filters.granularity, filters.xAxis, rawLabels, rawSeries]);

  const option = useMemo<EChartsOption>(
    () => ({
      color: ["#4f7088", "#58b368", "#3f68c6", "#c27d2f", "#8a66cf", "#da6f40", "#557a43", "#9f5f80"],
      tooltip: {
        trigger: chartMode === "bar" ? "item" : "axis",
        confine: true,
        backgroundColor: "rgba(21, 35, 48, 0.95)",
        borderWidth: 0,
        textStyle: { color: "#f7fbfb", fontSize: 12 },
        formatter: (raw: unknown) => {
          const points = (Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : []) as Array<{
            seriesName: string;
            value: number | [string | number, string | number] | null | undefined;
            marker?: string;
            dataIndex?: number;
          }>;
          if (!points.length) return "";
          const pointIndex = points[0]?.dataIndex ?? 0;
          const title = labels[pointIndex]?.long ?? "";
          const rows = points
            .map((point) => {
              const numericValue = Array.isArray(point.value)
                ? Number(point.value[point.value.length - 1] ?? 0)
                : Number(point.value ?? 0);
              if (numericValue === 0) return "";
              return `<div style="display:flex; gap:6px; align-items:center; margin-top:4px;">${point.marker ?? ""}<span>${point.seriesName}:</span><strong>${formatTooltipCost(numericValue)}</strong></div>`;
            })
            .filter(Boolean)
            .join("");
          if (!rows) {
            return `<div style="min-width:220px;"><div style="font-weight:600; margin-bottom:4px;">${title}</div><div style="opacity:0.86;">No data</div></div>`;
          }
          return `<div style="min-width:220px;"><div style="font-weight:600; margin-bottom:4px;">${title}</div>${rows}</div>`;
        },
      },
      legend: {
        type: "scroll",
        top: 2,
        icon: "roundRect",
        itemHeight: 6,
        itemWidth: 18,
        pageIconColor: "#4f7088",
        pageIconInactiveColor: "#9db2ae",
        pageTextStyle: { color: "#6d837e", fontSize: 10 },
        textStyle: { color: "#58706d", fontSize: 11 },
      },
      grid: { left: 10, right: 10, top: 30, bottom: 10, containLabel: true },
      xAxis: {
        type: "category",
        name: filters.xAxis === "date" ? "Date" : filters.xAxis === "account" ? "Account" : "Region",
        nameLocation: "middle",
        nameGap: 34,
        nameTextStyle: { color: "#4f6664", fontSize: 12, fontWeight: 600 },
        boundaryGap: chartMode === "bar",
        data: labels.map((label) => label.short),
        axisLine: { show: true, lineStyle: { color: "#c7d8d3", width: 1.1 } },
        axisLabel: { color: "#5c7370", fontSize: 11, hideOverlap: true },
      },
      yAxis: {
        type: "value",
        name: `${Y_AXIS_LABELS[filters.yAxisMetric]} (USD)`,
        nameLocation: "middle",
        nameGap: 62,
        nameRotate: 90,
        nameTextStyle: { color: "#4f6664", fontSize: 12, fontWeight: 600 },
        axisLine: { show: true, lineStyle: { color: "#c7d8d3", width: 1.1 } },
        splitLine: { lineStyle: { color: "#e1eae7", type: "dashed" } },
        axisLabel: { color: "#6d837e", fontSize: 11, formatter: (value: number) => formatAxisCost(value) },
      },
      series: series.map((item, index) => {
        const renderAsBar = chartMode === "bar";
        return {
          name: item.name,
          type: renderAsBar ? "bar" : "line",
          stack: renderAsBar ? "history-stack" : undefined,
          smooth: !renderAsBar,
          showSymbol: renderAsBar ? false : labels.length <= 35,
          symbolSize: 5,
          universalTransition: true,
          animationDuration: renderAsBar ? 780 : 520,
          animationDurationUpdate: renderAsBar ? 560 : 380,
          animationEasing: "cubicOut",
          animationEasingUpdate: "cubicOut",
          animationDelay: (idx: number) => Math.min(index * 36 + idx * 22, 640),
          barMinHeight: renderAsBar ? 0 : undefined,
          barWidth: renderAsBar ? "86%" : undefined,
          barMaxWidth: renderAsBar ? 80 : undefined,
          barCategoryGap: renderAsBar ? "8%" : undefined,
          barGap: renderAsBar ? "0%" : undefined,
          itemStyle: renderAsBar ? { opacity: 1, borderWidth: 0 } : undefined,
          emphasis: renderAsBar
            ? {
                disabled: true,
                scale: false,
                itemStyle: {
                  opacity: 1,
                  borderWidth: 0,
                  shadowBlur: 0,
                  shadowColor: "transparent",
                },
              }
            : undefined,
          data: item.values.map((value) => Number(value ?? 0)),
        };
      }),
    }),
    [chartMode, filters.xAxis, filters.yAxisMetric, labels, series],
  );

  const hasRenderableChartData = labels.length > 0 && series.some((item) => item.values.some((value) => hasCost(value)));
  const isInitialLoading = historyQuery.isLoading || filtersQuery.isLoading;
  const isFilterApplying = historyQuery.isFetching || filtersQuery.isFetching;
  const isChartReady = historyQuery.isSuccess && filtersQuery.isSuccess;
  const hasInitialData = Boolean(historyQuery.data) && Boolean(filtersQuery.data);
  const showHistorySkeleton = !hasInitialData && (isInitialLoading || isFilterApplying || !isChartReady);

  return (
    <div className="dashboard-page cost-history-page">
      {showHistorySkeleton ? (
        <HistorySectionSkeleton />
      ) : (
        <>
          <div className="cost-history-filter-container">
            <CostHistoryFiltersPanel
              rootRef={rootRef}
              filters={filters}
              setFilters={setFilters}
              activePopover={activePopover}
              setActivePopover={setActivePopover}
              options={filtersQuery.data}
            />
          </div>

          <CostExplorerChartOnlySection
            title="Cost History"
            option={option}
            isLoading={isInitialLoading}
            isError={historyQuery.isError || filtersQuery.isError}
            errorMessage={(historyQuery.error as Error | undefined)?.message ?? (filtersQuery.error as Error | undefined)?.message}
            isFetching={isFilterApplying}
            showApplySkeleton={isFilterApplying}
            showFetchStatusLabel={false}
            chartReady={hasRenderableChartData}
            chartMode={chartMode}
            onChartModeChange={setChartMode}
            onRetry={() => {
              void historyQuery.refetch();
              void filtersQuery.refetch();
            }}
            onReset={() => setFilters(DEFAULT_COST_HISTORY_FILTERS)}
          />
        </>
      )}
    </div>
  );
}
