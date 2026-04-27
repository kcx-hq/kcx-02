import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { ChevronDown } from "lucide-react";

import { BaseEChart } from "../../../common/charts/BaseEChart";
import { EmptyStateBlock } from "../../../common/components/EmptyStateBlock";
import { CHART_TYPE_OPTIONS, type EC2ChartType } from "../ec2ExplorerControls.types";

type EC2ExplorerGraphSeries = {
  key: string;
  label: string;
  data: Array<{ date: string; value: number }>;
};

type EC2ExplorerChartProps = {
  title: string;
  chartType: EC2ChartType;
  canUseStackedBar: boolean;
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
    const visibleSeries = graph.series;
    const shouldShowLegend = graph.series.length > 1;

    return {
      color: visibleSeries.map((_, index) => SERIES_COLORS[index % SERIES_COLORS.length]),
      tooltip: { trigger: "axis" },
      legend: shouldShowLegend
        ? {
            show: true,
            type: "scroll",
            orient: "horizontal",
            top: 2,
            left: 12,
            right: 12,
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
        left: 64,
        right: 16,
        top: shouldShowLegend ? 58 : 24,
        bottom: 36,
        containLabel: false,
      },
      xAxis: {
        type: "category",
        data: xAxis,
        boundaryGap: graph.type === "stacked_bar" || graph.type === "bar",
        axisLabel: { hideOverlap: true, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 11, margin: 10 },
      },
      series: visibleSeries.map((series) => ({
        name: series.label,
        type: graph.type === "stacked_bar" || graph.type === "bar" ? "bar" : "line",
        stack: graph.type === "stacked_bar" || graph.type === "stacked_area" ? "ec2-explorer-stack" : undefined,
        areaStyle: graph.type === "area" || graph.type === "stacked_area" ? {} : undefined,
        smooth: graph.type !== "stacked_bar" && graph.type !== "bar",
        showSymbol: false,
        barMaxWidth: graph.type === "stacked_bar" || graph.type === "bar" ? 46 : undefined,
        data: series.data.map((point) => point.value),
      })),
    };
  }, [graph]);

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
      </div>
      <BaseEChart
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
