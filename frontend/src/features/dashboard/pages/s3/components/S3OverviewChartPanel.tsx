import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
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
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  onReset?: () => void;
  onChartTypeChange?: (next: S3OverviewFilterValue["chartType"]) => void;
};

export function S3OverviewChartPanel({
  breakdown,
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
  isError = false,
  errorMessage,
  onRetry,
  onReset,
  onChartTypeChange,
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

  const chartReady = Boolean(breakdown && breakdown.labels.length > 0 && breakdown.series.length > 0);
  const seriesCount = breakdown?.series.length ?? 0;
  const chartHeight = seriesCount > 8 ? 500 : seriesCount > 5 ? 450 : 400;

  const labels = useMemo(
    () =>
      (breakdown?.labels ?? []).map((label) => {
        if (costBy !== "date") return label;
        const parsed = new Date(`${label}T00:00:00.000Z`);
        return Number.isNaN(parsed.getTime()) ? label : xAxisFormatter.format(parsed);
      }),
    [breakdown?.labels, costBy],
  );
  const xAxisName =
    costBy === "bucket"
      ? "Bucket"
      : costBy === "region"
        ? "Region"
        : costBy === "account"
          ? "Account"
          : "Date";

  const chartOption = useMemo<EChartsOption>(() => {
    const series = breakdown?.series ?? [];
    const isLineChart = chartType === "line";
    return {
      color: series.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
      tooltip: {
        trigger: "axis",
        axisPointer: { type: isLineChart ? "line" : "shadow" },
        valueFormatter: (value: unknown) => graphCurrencyFormatter.format(Number(value ?? 0)),
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
        name:
          yAxisMetric === "effective_cost"
            ? "Effective Cost ($)"
            : yAxisMetric === "amortized_cost"
              ? "Amortized Cost ($)"
              : "Billed Cost ($)",
        nameLocation: "middle",
        nameRotate: 90,
        nameGap: 64,
        nameTextStyle: { color: "#6d837e", fontSize: 11 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#e1eae7", type: "dashed" } },
        axisLabel: {
          color: "#6d837e",
          fontSize: 11,
          formatter: (value: number) => graphCurrencyFormatter.format(value),
        },
      },
      dataZoom: labels.length > 45 ? [{ type: "inside", start: 0, end: 100 }] : undefined,
      series: series.map((item) => ({
        name: item.name,
        type: isLineChart ? "line" : "bar",
        stack: isLineChart ? undefined : "s3-overview",
        smooth: isLineChart,
        showSymbol: isLineChart ? labels.length <= 60 : false,
        symbolSize: isLineChart ? 5 : undefined,
        barWidth: isLineChart ? undefined : 44,
        barMaxWidth: isLineChart ? undefined : 52,
        barCategoryGap: isLineChart ? undefined : "34%",
        barGap: isLineChart ? undefined : "10%",
        lineStyle: isLineChart ? { width: 2.3 } : undefined,
        itemStyle: isLineChart ? undefined : { borderRadius: 0 },
        data: item.values.map((value) => Number(value ?? 0)),
      })),
    };
  }, [breakdown?.series, chartType, labels, xAxisName, yAxisMetric]);

  const delta = useMemo(() => {
    if (compareMode !== "previous_period") return null;
    if (typeof currentPeriodTotal !== "number" || typeof previousPeriodTotal !== "number") return null;
    const deltaValue = currentPeriodTotal - previousPeriodTotal;
    const deltaPct = previousPeriodTotal !== 0 ? (deltaValue / previousPeriodTotal) * 100 : null;
    return { deltaValue, deltaPct };
  }, [compareMode, currentPeriodTotal, previousPeriodTotal]);

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
      <div className="cost-explorer-chart-panel__body">
        {isLoading ? (
          <div className="cost-explorer-chart-skeleton" style={{ minHeight: `${chartHeight}px` }} />
        ) : isError ? (
          <div className="dashboard-empty-state-block">
            <p className="dashboard-empty-state-block__title">Could not load S3 overview data</p>
            <p className="dashboard-empty-state-block__message">{errorMessage ?? "Something went wrong while loading this chart."}</p>
            {onRetry ? (
              <div className="dashboard-empty-state-block__actions">
                <button type="button" className="cost-explorer-state-btn" onClick={onRetry}>
                  Retry
                </button>
              </div>
            ) : null}
          </div>
        ) : chartReady ? (
          <BaseEChart option={chartOption} height={chartHeight} />
        ) : (
          <div className="dashboard-empty-state-block">
            <p className="dashboard-empty-state-block__title">No S3 data for this selection</p>
            <p className="dashboard-empty-state-block__message">Try changing the bucket split, region, or metric filters.</p>
            {onReset ? (
              <div className="dashboard-empty-state-block__actions">
                <button type="button" className="cost-explorer-state-btn" onClick={onReset}>
                  Reset filters
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
