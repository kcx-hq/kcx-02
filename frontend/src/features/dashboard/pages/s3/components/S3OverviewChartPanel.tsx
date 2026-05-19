import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

import { BaseEChart } from "../../../common/charts/BaseEChart";
import type { S3CostInsightsResponse } from "../../../api/dashboardApi";
import type { S3OverviewFilterValue } from "./s3Overview.types";

const graphCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const graphUsageFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const xAxisFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});

const CHART_COLORS = [
  "#1f77b4",
  "#2ca02c",
  "#ff7f0e",
  "#d62728",
  "#9467bd",
  "#17becf",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
];

type Props = {
  breakdown: S3CostInsightsResponse["chart"]["breakdown"] | undefined;
  previousPeriodBreakdown?: S3CostInsightsResponse["chart"]["breakdown"] | undefined;
  seriesBy: S3OverviewFilterValue["seriesBy"];
  costBy: S3OverviewFilterValue["costBy"];
  yAxisMetric: S3OverviewFilterValue["yAxisMetric"];
  chartType: S3OverviewFilterValue["chartType"];
  compareMode: S3OverviewFilterValue["compareMode"];
  currentPeriodTotal?: number | null;
  previousPeriodTotal?: number | null;
  comparisonLoading?: boolean;
  comparisonError?: boolean;
  comparisonErrorMessage?: string;
  isLoading?: boolean;
  isRefreshing?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  onReset?: () => void;
  onChartTypeChange?: (next: S3OverviewFilterValue["chartType"]) => void;
  onBucketClick?: (bucketName: string) => void;
};

type ChartModel = {
  chartReady: boolean;
  chartHeight: number;
  labels: string[];
  xAxisName: string;
  option: EChartsOption;
  stateKey: string;
};

const extractTotalSeriesValues = (
  breakdown: S3CostInsightsResponse["chart"]["breakdown"] | undefined,
): number[] => {
  const labels = breakdown?.labels ?? [];
  const series = breakdown?.series ?? [];
  if (series.length === 0 || labels.length === 0) return [];
  if (series.length === 1) {
    return labels.map((_, index) => Number(series[0]?.values[index] ?? 0));
  }
  return labels.map((_, index) => series.reduce((sum, item) => sum + Number(item.values[index] ?? 0), 0));
};

const buildChartModel = (input: {
  breakdown: S3CostInsightsResponse["chart"]["breakdown"] | undefined;
  seriesBy: S3OverviewFilterValue["seriesBy"];
  costBy: S3OverviewFilterValue["costBy"];
  yAxisMetric: S3OverviewFilterValue["yAxisMetric"];
  chartType: S3OverviewFilterValue["chartType"];
}): ChartModel => {
  const { breakdown, seriesBy, costBy, yAxisMetric, chartType } = input;
  const chartReady = Boolean(breakdown && breakdown.labels.length > 0 && breakdown.series.length > 0);
  const seriesCount = breakdown?.series.length ?? 0;
  const chartHeight = seriesCount > 8 ? 500 : seriesCount > 5 ? 450 : 400;
  const labels = (breakdown?.labels ?? []).map((label) => {
    if (costBy !== "date") return label;
    const parsed = new Date(`${label}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? label : xAxisFormatter.format(parsed);
  });
  const xAxisName =
    costBy === "bucket"
      ? "Bucket"
      : costBy === "region"
        ? "Region"
        : costBy === "account"
          ? "Account"
          : "Date";
  const rawSeries = (() => {
    const items = breakdown?.series ?? [];
    if (seriesBy !== "none" || items.length <= 1) return items;
    const totalValues = labels.map((_, index) =>
      items.reduce((sum, item) => sum + Number(item.values[index] ?? 0), 0),
    );
    return [{ name: "Total Cost", values: totalValues }];
  })();
  const isLineChart = chartType === "line";
  const metricIsUsage = yAxisMetric === "usage_quantity";

  const preparedSeries = (() => {
    if (isLineChart) return rawSeries;

    const positiveOnly = rawSeries.map((series) => ({
      name: series.name,
      values: series.values.map((value) => Math.max(0, Number(value ?? 0))),
    }));

    const ranked = [...positiveOnly]
      .map((series) => ({
        ...series,
        total: series.values.reduce((sum, value) => sum + value, 0),
      }))
      .sort((left, right) => right.total - left.total);

    const topSeries = ranked.slice(0, 8).map(({ name, values }) => ({ name, values }));
    if (ranked.length <= 8) return topSeries;

    const remaining = ranked.slice(8);
    const othersValues = labels.map((_, index) =>
      remaining.reduce((sum, series) => sum + Number(series.values[index] ?? 0), 0),
    );
    const othersTotal = othersValues.reduce((sum, value) => sum + value, 0);
    return othersTotal > 0 ? [...topSeries, { name: "Others", values: othersValues }] : topSeries;
  })();

  const option: EChartsOption = {
    color: preparedSeries.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
    animation: true,
    animationDuration: 640,
    animationEasing: "cubicOut",
    animationDurationUpdate: 460,
    animationEasingUpdate: "cubicOut",
    stateAnimation: {
      duration: 260,
      easing: "cubicOut",
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: isLineChart ? "line" : "shadow" },
      valueFormatter: (value: unknown) =>
        metricIsUsage
          ? graphUsageFormatter.format(Number(value ?? 0))
          : graphCurrencyFormatter.format(Number(value ?? 0)),
    },
    legend: {
      type: "scroll",
      top: 0,
      icon: "roundRect",
      itemHeight: 6,
      itemWidth: 18,
      textStyle: { color: "#58706d", fontSize: 11 },
    },
    grid: { left: 42, right: 12, top: 58, bottom: 30, containLabel: true },
    xAxis: {
      type: "category",
      name: xAxisName,
      nameLocation: "middle",
      nameGap: 24,
      nameTextStyle: { color: "#6d837e", fontSize: 11 },
      data: labels,
      axisLine: { lineStyle: { color: "#d7e4df" } },
      axisLabel: { color: "#5c7370", fontSize: 11, hideOverlap: true, rotate: labels.length > 24 ? 28 : 0 },
    },
    yAxis: {
      type: "value",
      min: isLineChart ? undefined : 0,
      name:
        yAxisMetric === "gross_cost"
          ? "Gross Cost ($)"
          : yAxisMetric === "effective_cost"
          ? "Effective Cost ($)"
            : yAxisMetric === "usage_quantity"
              ? "Usage Quantity"
              : "Effective Cost ($)",
      nameLocation: "middle",
      nameRotate: 90,
      nameGap: 64,
      nameTextStyle: { color: "#6d837e", fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#e1eae7", type: "dashed" } },
      axisLabel: {
        color: "#6d837e",
        fontSize: 11,
        formatter: (value: number) => (metricIsUsage ? graphUsageFormatter.format(value) : graphCurrencyFormatter.format(value)),
      },
    },
    dataZoom: labels.length > 45 ? [{ type: "inside", start: 0, end: 100 }] : undefined,
    series: preparedSeries.map((item, seriesIndex) => ({
      name: item.name,
      type: isLineChart ? "line" : "bar",
      stack: isLineChart ? undefined : "s3-overview",
      smooth: isLineChart,
      showSymbol: isLineChart ? labels.length <= 60 : false,
      symbolSize: isLineChart ? 5 : undefined,
      barWidth: isLineChart ? undefined : "86%",
      barMaxWidth: isLineChart ? undefined : 80,
      barCategoryGap: isLineChart ? undefined : "8%",
      barGap: isLineChart ? undefined : "0%",
      lineStyle: isLineChart ? { width: 2.3 } : undefined,
      itemStyle: isLineChart ? undefined : { borderRadius: [2, 2, 0, 0] },
      progressive: 5000,
      progressiveThreshold: 3000,
      universalTransition: true,
      emphasis: { focus: "series" },
      animationDuration: isLineChart ? 520 : 780,
      animationDurationUpdate: isLineChart ? 380 : 560,
      animationEasing: "cubicOut",
      animationEasingUpdate: "cubicOut",
      animationDelay: (idx: number) => Math.min(seriesIndex * 36 + idx * 22, 640),
      data: item.values.map((value) => Number(value ?? 0)),
    })),
  };

  const labelKey = labels.join("|");
  const seriesKey = (breakdown?.series ?? []).map((item) => `${item.name}:${item.values.length}`).join("|");
  const stateKey = `${chartType}|${costBy}|${yAxisMetric}|${labelKey}|${seriesKey}`;

  return {
    chartReady,
    chartHeight,
    labels,
    xAxisName,
    option,
    stateKey,
  };
};

export function S3OverviewChartPanel({
  breakdown,
  previousPeriodBreakdown,
  seriesBy,
  costBy,
  yAxisMetric,
  chartType,
  compareMode,
  currentPeriodTotal = null,
  previousPeriodTotal = null,
  comparisonLoading = false,
  comparisonError = false,
  comparisonErrorMessage,
  isLoading = false,
  isRefreshing = false,
  isError = false,
  errorMessage,
  onRetry,
  onReset,
  onChartTypeChange,
  onBucketClick,
}: Props) {
  const chartTypeMenuRef = useRef<HTMLDivElement | null>(null);
  const [isChartTypeMenuOpen, setIsChartTypeMenuOpen] = useState(false);

  useEffect(() => {
    if (!isChartTypeMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!chartTypeMenuRef.current) return;
      if (chartTypeMenuRef.current.contains(event.target as Node)) return;
      setIsChartTypeMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsChartTypeMenuOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isChartTypeMenuOpen]);

  const currentChart = useMemo(
    () => buildChartModel({ breakdown, seriesBy, costBy, yAxisMetric, chartType }),
    [breakdown, seriesBy, costBy, yAxisMetric, chartType],
  );
  const previousChart = useMemo(
    () => buildChartModel({ breakdown: previousPeriodBreakdown, seriesBy, costBy, yAxisMetric, chartType }),
    [previousPeriodBreakdown, seriesBy, costBy, yAxisMetric, chartType],
  );
  const compareOverlayOption = useMemo<EChartsOption | null>(() => {
    if (compareMode !== "previous_period" || seriesBy !== "none") return null;
    if (!currentChart.chartReady) return null;
    if (comparisonLoading || comparisonError || !previousChart.chartReady) return null;

    const currentValues = extractTotalSeriesValues(breakdown);
    const previousValuesRaw = extractTotalSeriesValues(previousPeriodBreakdown);
    if (currentValues.length === 0 || previousValuesRaw.length === 0) return null;

    const alignedPreviousValues = currentValues.map((_, index) =>
      Number(previousValuesRaw[index] ?? previousValuesRaw[previousValuesRaw.length - 1] ?? 0),
    );

    const base = currentChart.option;
    return {
      ...base,
      color: ["#1f77b4", "#ff7f0e"],
      legend: {
        ...(base.legend && typeof base.legend === "object" ? base.legend : {}),
      },
      series: [
        {
          name: "Current Period",
          type: "line",
          smooth: true,
          showSymbol: currentValues.length <= 60,
          symbolSize: 5,
          lineStyle: { width: 2.6 },
          emphasis: { focus: "series" },
          data: currentValues,
        },
        {
          name: "Previous Period",
          type: "line",
          smooth: true,
          showSymbol: alignedPreviousValues.length <= 60,
          symbolSize: 5,
          lineStyle: { width: 2.4, type: "dashed" },
          emphasis: { focus: "series" },
          data: alignedPreviousValues,
        },
      ],
    };
  }, [
    breakdown,
    compareMode,
    comparisonError,
    comparisonLoading,
    currentChart.chartReady,
    currentChart.option,
    previousChart.chartReady,
    previousPeriodBreakdown,
    seriesBy,
  ]);

  const delta = useMemo(() => {
    if (compareMode !== "previous_period") return null;
    if (typeof currentPeriodTotal !== "number" || typeof previousPeriodTotal !== "number") return null;
    const deltaValue = currentPeriodTotal - previousPeriodTotal;
    const deltaPct = previousPeriodTotal !== 0 ? (deltaValue / previousPeriodTotal) * 100 : null;
    return { deltaValue, deltaPct };
  }, [compareMode, currentPeriodTotal, previousPeriodTotal]);

  const handleChartPointClick = (params: unknown) => {
    if (!onBucketClick) return;
    if (!params || typeof params !== "object") return;

    const payload = params as { componentType?: string; name?: unknown; seriesName?: unknown };
    if (payload.componentType !== "series") return;

    const rawBucketName =
      costBy === "bucket"
        ? String(payload.name ?? "").trim()
        : seriesBy === "bucket"
          ? String(payload.seriesName ?? "").trim()
          : "";
    if (!rawBucketName) return;

    const normalized = rawBucketName.toLowerCase();
    if (normalized === "others" || normalized === "unattributed") return;

    onBucketClick(rawBucketName);
  };

  return (
    <section className="cost-explorer-chart-panel s3-overview-chart-panel" aria-label="S3 date vs cost chart">
      <div className="cost-explorer-chart-panel__header">
        <h2 className="cost-explorer-chart-panel__title">S3 Cost Breakdown</h2>
        <div className="s3-overview-chart-panel__chart-type" ref={chartTypeMenuRef}>
          <button
            type="button"
            className={`cost-explorer-state-btn s3-overview-chart-panel__chart-type-trigger${isChartTypeMenuOpen ? " is-open" : ""}`}
            onClick={() => setIsChartTypeMenuOpen((current) => !current)}
            aria-haspopup="dialog"
            aria-expanded={isChartTypeMenuOpen}
          >
            {chartType === "line" ? "Line Chart" : "Bar Chart"}
            <ChevronDown className="s3-overview-chart-panel__chart-type-caret" size={15} aria-hidden="true" />
          </button>
          {isChartTypeMenuOpen ? (
            <div className="s3-overview-chart-panel__chart-type-popover" role="dialog" aria-label="Select chart type">
              {[
                { key: "line", label: "Line Chart" },
                { key: "bar", label: "Bar Chart" },
              ].map((option) => {
                const selected = option.key === chartType;
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`s3-overview-chart-panel__chart-type-option${selected ? " is-active" : ""}`}
                    onClick={() => {
                      onChartTypeChange?.(option.key as S3OverviewFilterValue["chartType"]);
                      setIsChartTypeMenuOpen(false);
                    }}
                  >
                    <span>{option.label}</span>
                    {selected ? <Check size={16} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      {compareMode === "previous_period" ? (
        <div className="cost-explorer-chart-insights s3-overview-chart-panel__compare-strip" aria-label="Previous period comparison">
          <article className="cost-explorer-insight-tile">
            <p className="cost-explorer-insight-tile__label">Current Period</p>
            <p className="cost-explorer-insight-tile__value">
              {typeof currentPeriodTotal === "number" ? graphCurrencyFormatter.format(currentPeriodTotal) : "--"}
            </p>
          </article>
          <article className="cost-explorer-insight-tile">
            <p className="cost-explorer-insight-tile__label">Previous Period</p>
            <p className="cost-explorer-insight-tile__value">
              {comparisonLoading ? "Loading..." : typeof previousPeriodTotal === "number" ? graphCurrencyFormatter.format(previousPeriodTotal) : "--"}
            </p>
          </article>
          <article className="cost-explorer-insight-tile">
            <p className="cost-explorer-insight-tile__label">Delta</p>
            <p className="cost-explorer-insight-tile__value">
              {delta
                ? `${delta.deltaValue >= 0 ? "+" : ""}${graphCurrencyFormatter.format(delta.deltaValue)}${typeof delta.deltaPct === "number" ? ` (${delta.deltaPct >= 0 ? "+" : ""}${delta.deltaPct.toFixed(2)}%)` : ""}`
                : "--"}
            </p>
          </article>
          {comparisonError ? (
            <p className="dashboard-note s3-overview-chart-panel__compare-note">
              Failed to load previous period comparison{comparisonErrorMessage ? `: ${comparisonErrorMessage}` : ""}.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className={`cost-explorer-chart-panel__body${isRefreshing ? " is-refreshing" : ""}`}>
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="cost-explorer-chart-skeleton"
              style={{ minHeight: `${currentChart.chartHeight}px` }}
            />
          ) : isError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="dashboard-empty-state-block"
            >
              <p className="dashboard-empty-state-block__title">Could not load S3 overview data</p>
              <p className="dashboard-empty-state-block__message">{errorMessage ?? "Something went wrong while loading this chart."}</p>
              {onRetry ? (
                <div className="dashboard-empty-state-block__actions">
                  <button type="button" className="cost-explorer-state-btn" onClick={onRetry}>
                    Retry
                  </button>
                </div>
              ) : null}
            </motion.div>
          ) : currentChart.chartReady ? (
            <motion.div
              key={`${currentChart.stateKey}|${seriesBy}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="s3-overview-chart-panel__canvas-wrap"
            >
              {compareMode === "previous_period" && seriesBy !== "none" ? (
                <div style={{ display: "grid", gap: "16px" }}>
                  <article>
                    <p className="dashboard-note" style={{ marginBottom: "8px" }}>Current period</p>
                    <BaseEChart
                      option={currentChart.option}
                      height={currentChart.chartHeight}
                      className="s3-overview-chart-panel__canvas"
                      onPointClick={handleChartPointClick}
                    />
                  </article>
                  <article>
                    <p className="dashboard-note" style={{ marginBottom: "8px" }}>Previous period</p>
                    {comparisonLoading ? (
                      <div className="cost-explorer-chart-skeleton" style={{ minHeight: `${previousChart.chartHeight}px` }} />
                    ) : comparisonError ? (
                      <div className="dashboard-empty-state-block">
                        <p className="dashboard-empty-state-block__title">Could not load previous period chart</p>
                        <p className="dashboard-empty-state-block__message">{comparisonErrorMessage ?? "Something went wrong while loading previous-period data."}</p>
                      </div>
                    ) : previousChart.chartReady ? (
                      <BaseEChart
                        option={previousChart.option}
                        height={previousChart.chartHeight}
                        className="s3-overview-chart-panel__canvas"
                        onPointClick={handleChartPointClick}
                      />
                    ) : (
                      <div className="dashboard-empty-state-block">
                        <p className="dashboard-empty-state-block__title">No previous period data</p>
                        <p className="dashboard-empty-state-block__message">Try widening the date range to include earlier activity.</p>
                      </div>
                    )}
                  </article>
                </div>
              ) : (
                <BaseEChart
                  option={compareOverlayOption ?? currentChart.option}
                  height={currentChart.chartHeight}
                  className="s3-overview-chart-panel__canvas"
                  onPointClick={handleChartPointClick}
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="dashboard-empty-state-block"
            >
              <p className="dashboard-empty-state-block__title">No S3 data for this selection</p>
              <p className="dashboard-empty-state-block__message">Try changing the bucket split, region, or metric filters.</p>
              {onReset ? (
                <div className="dashboard-empty-state-block__actions">
                  <button type="button" className="cost-explorer-state-btn" onClick={onReset}>
                    Reset filters
                  </button>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
