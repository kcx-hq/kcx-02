import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { ChevronDown } from "lucide-react";

import { BaseEChart } from "../../../common/charts/BaseEChart";
import { EmptyStateBlock } from "../../../common/components/EmptyStateBlock";
import { CHART_TYPE_OPTIONS, type EC2ChartType } from "../ec2ExplorerControls.types";

type EC2ExplorerGraphSeries = {
  key: string;
  label: string;
  data: Array<{
    date: string;
    value: number;
    cost?: number;
    total_cost?: number;
    data_transfer_cost?: number;
    usage_gb?: number;
    billed_usage_gb?: number;
    total_usage_gb?: number;
    percent_share?: number;
  }>;
};

type EC2ExplorerChartProps = {
  title: string;
  chartType: EC2ChartType;
  canUseStackedBar: boolean;
  showChartTypeSelector?: boolean;
  yAxisLabel?: string;
  valueMode?: "default" | "data-transfer-cost" | "data-transfer-usage" | "data-transfer-distribution";
  onChartTypeChange: (nextChartType: EC2ChartType) => void;
  graph: {
    type: "bar" | "stacked_bar" | "line" | "area" | "stacked_area";
    xKey: "date";
    series: EC2ExplorerGraphSeries[];
  };
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onPointClick: (payload: { date: string | null; seriesKey: string | null; seriesLabel: string | null }) => void;
};

const SERIES_COLORS = ["#2f8f88", "#3f68c6", "#c27d2f", "#8a66cf", "#da6f40", "#557a43", "#9f5f80"];

export function EC2ExplorerChart({
  title,
  chartType,
  canUseStackedBar,
  showChartTypeSelector = true,
  yAxisLabel,
  valueMode = "default",
  onChartTypeChange,
  graph,
  loading,
  error,
  onRetry,
  onPointClick,
}: EC2ExplorerChartProps) {
  const chartTypeLabel =
    CHART_TYPE_OPTIONS.find((option) => option.key === chartType)?.label ?? "Line";

  const option = useMemo<EChartsOption>(() => {
    const xAxis = graph.series[0]?.data.map((item) => item.date) ?? [];
    const rawSeries = graph.series;
    const visibleSeries = rawSeries.map((series) => ({ ...series, data: [...series.data] }));
    if (valueMode === "data-transfer-distribution") {
      const perBucketTotals = new Map<string, number>();
      for (const series of rawSeries) {
        for (const point of series.data) {
          perBucketTotals.set(point.date, (perBucketTotals.get(point.date) ?? 0) + (Number(point.cost ?? point.value) || 0));
        }
      }
      for (const series of visibleSeries) {
        series.data = series.data.map((point) => {
          const explicitPercent = Number(point.percent_share);
          const total = perBucketTotals.get(point.date) ?? 0;
          const value = Number.isFinite(explicitPercent)
            ? explicitPercent
            : total > 0
              ? ((Number(point.cost ?? point.value) || 0) / total) * 100
              : 0;
          return { ...point, value };
        });
      }
    }
    const shouldShowLegend = graph.series.length > 1;
    const axisName =
      typeof yAxisLabel === "string" && yAxisLabel.trim().length > 0
        ? yAxisLabel
        : valueMode === "data-transfer-cost"
        ? "Cost ($)"
        : valueMode === "data-transfer-usage"
          ? "Data Transfer (GB)"
          : valueMode === "data-transfer-distribution"
            ? "Share (%)"
            : "";
    const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
    const currencyFormatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
    const toNumericValue = (point: EC2ExplorerGraphSeries["data"][number]): number => {
      if (valueMode === "data-transfer-cost") {
        return Number(point.cost ?? point.total_cost ?? point.data_transfer_cost ?? point.value ?? 0);
      }
      if (valueMode === "data-transfer-usage") {
        return Number(point.usage_gb ?? point.billed_usage_gb ?? point.total_usage_gb ?? point.value ?? 0);
      }
      if (valueMode === "data-transfer-distribution") {
        return Number(point.percent_share ?? point.value ?? 0);
      }
      return Number(point.value ?? 0);
    };
    const allValues = visibleSeries.flatMap((series) => series.data.map((point) => toNumericValue(point)));
    const finiteValues = allValues.filter((value) => Number.isFinite(value));
    const minValue = finiteValues.length > 0 ? Math.min(...finiteValues) : 0;
    const maxValue = finiteValues.length > 0 ? Math.max(...finiteValues) : 0;
    const isFlatSeries = finiteValues.length > 0 && Math.abs(maxValue - minValue) < 1e-9;
    const paddedRange = Math.max(Math.abs(maxValue) * 0.25, 1);
    const isStacked = graph.type === "stacked_bar" || graph.type === "stacked_area";
    const stackedDailyMax = isStacked
      ? Math.max(
          0,
          ...xAxis.map((date) =>
            visibleSeries.reduce((sum, series) => {
              const point = series.data.find((entry) => entry.date === date);
              return sum + (point ? toNumericValue(point) : 0);
            }, 0),
          ),
        )
      : 0;
    const computedMin =
      valueMode === "data-transfer-distribution"
        ? 0
        : isStacked
          ? 0
        : isFlatSeries
          ? Math.max(0, minValue - paddedRange)
          : undefined;
    const computedMax =
      valueMode === "data-transfer-distribution"
        ? 100
        : isStacked
          ? Math.max(1, Math.ceil(stackedDailyMax))
        : isFlatSeries
          ? maxValue + paddedRange
          : undefined;

    return {
      color: visibleSeries.map((_, index) => SERIES_COLORS[index % SERIES_COLORS.length]),
      tooltip: {
        trigger: "axis",
        valueFormatter: (value) => {
          const numeric = Number(value ?? 0);
          if (valueMode === "data-transfer-cost") return currencyFormatter.format(numeric);
          if (valueMode === "data-transfer-usage") return `${numberFormatter.format(numeric)} GB`;
          if (valueMode === "data-transfer-distribution") return `${numberFormatter.format(numeric)}%`;
          return numberFormatter.format(numeric);
        },
      },
      legend: shouldShowLegend
        ? {
            show: true,
            type: "scroll",
            orient: "horizontal",
            top: 2,
            left: "center",
            itemWidth: 12,
            itemHeight: 8,
            textStyle: {
              fontSize: 11,
              overflow: "truncate",
              width: 170,
            },
          }
        : { show: false },
      grid: {
        left: 52,
        right: 12,
        top: shouldShowLegend ? 30 : 20,
        bottom: 36,
        containLabel: false,
      },
      xAxis: {
        type: "category",
        data: xAxis,
        boundaryGap: graph.type === "stacked_bar" || graph.type === "bar",
        axisLine: {
          show: true,
          lineStyle: { color: "#9fb3b8", width: 1 },
        },
        axisLabel: {
          hideOverlap: true,
          fontSize: 11,
          formatter: (value: string) => formatDateMonthLabel(value),
        },
      },
      yAxis: {
        type: "value",
        name: axisName,
        min: computedMin,
        max: computedMax,
        axisLine: {
          show: true,
          lineStyle: { color: "#9fb3b8", width: 1 },
        },
        splitLine: {
          show: false,
        },
        axisLabel: { fontSize: 11, margin: 10 },
      },
      series: visibleSeries.map((series) => ({
        name: series.label,
        type: graph.type === "stacked_bar" || graph.type === "bar" ? "bar" : "line",
        stack: graph.type === "stacked_bar" || graph.type === "stacked_area" ? "ec2-explorer-stack" : undefined,
        areaStyle: graph.type === "area" || graph.type === "stacked_area" ? {} : undefined,
        smooth: graph.type !== "stacked_bar" && graph.type !== "bar",
        showSymbol: false,
        barMaxWidth: graph.type === "stacked_bar" || graph.type === "bar" ? 56 : undefined,
        barMinWidth: graph.type === "stacked_bar" || graph.type === "bar" ? 16 : undefined,
        barCategoryGap: graph.type === "stacked_bar" || graph.type === "bar" ? "18%" : undefined,
        barGap: graph.type === "stacked_bar" || graph.type === "bar" ? "0%" : undefined,
        data: series.data.map((point) => {
          return toNumericValue(point);
        }),
      })),
    };
  }, [graph, valueMode, yAxisLabel]);
  const chartRenderKey = useMemo(
    () =>
      [
        graph.type,
        valueMode,
        graph.xKey,
        graph.series.length,
        graph.series.map((series) => `${series.key}:${series.data.length}`).join("|"),
      ].join("::"),
    [graph, valueMode],
  );

  if (loading) {
    return <div className="ec2-explorer-chart__skeleton" aria-hidden="true" />;
  }

  if (error) {
    return (
      <EmptyStateBlock
        title="Unable to load EC2 Explorer"
        message={error.message || "An unexpected error occurred."}
        actions={
          <button type="button" className="cost-explorer-state-btn" onClick={onRetry}>
            Retry
          </button>
        }
      />
    );
  }

  if (graph.series.length === 0 || graph.series.every((series) => series.data.length === 0)) {
    return (
      <EmptyStateBlock
        title="No data found"
        message="No data found for current filters. Try removing thresholds or filters."
      />
    );
  }

  return (
    <section className="ec2-explorer-chart" aria-label="EC2 explorer chart">
      <div className="ec2-explorer-chart__header">
        <h3 className="ec2-explorer-chart__title">{title}</h3>
        {showChartTypeSelector ? (
          <label className="ec2-explorer-chart__chart-type">
            <span className="ec2-explorer-chart__chart-type-label">{chartTypeLabel}</span>
            <select
              value={chartType}
              onChange={(event) => onChartTypeChange(event.target.value as EC2ChartType)}
              aria-label="Chart type"
            >
              {CHART_TYPE_OPTIONS.filter((option) => option.key === "line" || canUseStackedBar).map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="ec2-explorer-chart__chart-type-caret" aria-hidden="true" />
          </label>
        ) : null}
      </div>
      <BaseEChart
        key={chartRenderKey}
        option={option}
        height={410}
        onPointClick={(event) => {
          const point = event as { name?: string; seriesName?: string; seriesIndex?: number };
          const series = graph.series[typeof point.seriesIndex === "number" ? point.seriesIndex : 0];
          onPointClick({
            date: typeof point.name === "string" ? point.name : null,
            seriesKey: series?.key ?? null,
            seriesLabel: typeof point.seriesName === "string" ? point.seriesName : null,
          });
        }}
      />
    </section>
  );
}
    const formatDateMonthLabel = (raw: string): string => {
      const parsed = new Date(raw);
      if (!Number.isFinite(parsed.getTime())) return raw;
      return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short" }).format(parsed);
    };
