import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import { Check, ChevronDown } from "lucide-react";

import { BaseEChart } from "../../../common/charts/BaseEChart";
import { EmptyStateBlock } from "../../../common/components/EmptyStateBlock";
import type { EC2ChartType } from "../ec2ExplorerControls.types";

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

const xAxisFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});

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
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isChartTypeMenuOpen, setIsChartTypeMenuOpen] = useState(false);

  useEffect(() => {
    if (!isChartTypeMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
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

  const isLineChart = chartType === "line";
  const shouldShowLegend = graph.series.length > 1;
  const chartHeight = graph.series.length > 8 ? 500 : graph.series.length > 5 ? 450 : 400;
  const xLabels = graph.series[0]?.data.map((item) => item.date) ?? [];
  const displayLabels = xLabels.map((label) => {
    const parsed = new Date(`${label}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? label : xAxisFormatter.format(parsed);
  });

  const option = useMemo<EChartsOption>(() => {
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

    const seriesData = graph.series.map((series) => ({
      ...series,
      data: series.data.map((point) => toNumericValue(point)),
    }));

    return {
      color: seriesData.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
      tooltip: {
        trigger: "item",
        axisPointer: { type: isLineChart ? "line" : "shadow" },
        confine: true,
        backgroundColor: "#102744",
        borderColor: "rgba(140, 182, 232, 0.36)",
        borderWidth: 1,
        textStyle: { color: "#e7eef8", fontSize: 12, fontWeight: 500 },
        extraCssText:
          "border-radius:10px; box-shadow:0 12px 28px rgba(2,10,24,0.48); padding:12px 14px;",
        formatter: (params: unknown) => {
          const point = params as { axisValueLabel?: string; name?: string; marker?: string; seriesName?: string; value?: unknown };
          const headerValue = String(point.axisValueLabel ?? point.name ?? "");
          const numericValue = Number(point.value ?? 0);
          const valueText =
            valueMode === "data-transfer-cost" || valueMode === "default"
              ? currencyFormatter.format(numericValue)
              : valueMode === "data-transfer-distribution"
                ? `${numberFormatter.format(numericValue)}%`
                : `${numberFormatter.format(numericValue)} GB`;
          return `${headerValue}<br/>${String(point.marker ?? "")}${String(point.seriesName ?? "")}: ${valueText}`;
        },
      },
      legend: shouldShowLegend
        ? {
            type: "scroll",
            top: 0,
            icon: "roundRect",
            itemHeight: 6,
            itemWidth: 18,
            textStyle: { color: "#58706d", fontSize: 11 },
          }
        : { show: false },
      grid: { left: 40, right: 12, top: 58, bottom: 36, containLabel: true },
      xAxis: {
        type: "category",
        name: "Date",
        nameLocation: "middle",
        nameGap: 24,
        nameTextStyle: { color: "#6d837e", fontSize: 11 },
        data: displayLabels,
        axisLine: { lineStyle: { color: "#d7e4df" } },
        axisLabel: { color: "#5c7370", fontSize: 11, hideOverlap: true, rotate: displayLabels.length > 24 ? 28 : 0 },
      },
      yAxis: {
        type: "value",
        min: isLineChart ? undefined : 0,
        name: yAxisLabel || "Cost ($)",
        nameLocation: "middle",
        nameRotate: 90,
        nameGap: 64,
        nameTextStyle: { color: "#6d837e", fontSize: 11 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#e1eae7", type: "dashed" } },
        axisLabel: {
          color: "#6d837e",
          fontSize: 11,
          formatter: (value: number) =>
            valueMode === "data-transfer-cost" || valueMode === "default"
              ? currencyFormatter.format(value)
              : valueMode === "data-transfer-distribution"
                ? `${numberFormatter.format(value)}%`
                : `${numberFormatter.format(value)} GB`,
        },
      },
      series: seriesData.map((series) => ({
        name: series.label,
        type: isLineChart ? "line" : "bar",
        stack: isLineChart ? undefined : "ec2-overview",
        smooth: isLineChart,
        showSymbol: isLineChart ? displayLabels.length <= 60 : false,
        symbolSize: isLineChart ? 5 : undefined,
        barWidth: isLineChart ? undefined : "86%",
        barMaxWidth: isLineChart ? undefined : 80,
        barCategoryGap: isLineChart ? undefined : "8%",
        barGap: isLineChart ? undefined : "0%",
        lineStyle: isLineChart ? { width: 2.3 } : undefined,
        itemStyle: isLineChart ? undefined : { borderRadius: [0, 0, 0, 0] },
        data: series.data,
      })),
    };
  }, [displayLabels, graph.series, isLineChart, valueMode, yAxisLabel]);

  if (loading) {
    return (
      <section className="ec2-explorer-chart__skeleton" aria-hidden="true">
        <div className="cost-explorer-chart-stack">
          <div className="cost-explorer-chart-canvas cost-explorer-chart-canvas--plain">
            <div className="cost-explorer-chart-skeleton cost-explorer-chart-skeleton--bars ec2-explorer-chart__history-skeleton-canvas" />
          </div>
        </div>
      </section>
    );
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
    <section className="cost-explorer-chart-panel s3-overview-chart-panel ec2-overview-chart-panel" aria-label="EC2 explorer chart">
      <div className="cost-explorer-chart-panel__header">
        <h2 className="cost-explorer-chart-panel__title">{title}</h2>
        {showChartTypeSelector ? (
          <div className="s3-overview-chart-panel__chart-type" ref={menuRef}>
            <button
              type="button"
              className={`cost-explorer-state-btn s3-overview-chart-panel__chart-type-trigger${isChartTypeMenuOpen ? " is-open" : ""}`}
              onClick={() => setIsChartTypeMenuOpen((current) => !current)}
              aria-haspopup="dialog"
              aria-expanded={isChartTypeMenuOpen}
            >
              {isLineChart ? "Line Chart" : "Bar Chart"}
              <ChevronDown className="s3-overview-chart-panel__chart-type-caret" size={15} aria-hidden="true" />
            </button>
            {isChartTypeMenuOpen ? (
              <div className="s3-overview-chart-panel__chart-type-popover" role="dialog" aria-label="Select chart type">
                {[
                  { key: "stacked_bar", label: "Bar Chart" },
                  { key: "line", label: "Line Chart" },
                ]
                  .filter((option) => option.key === "line" || canUseStackedBar)
                  .map((option) => {
                    const selected = option.key === chartType;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`s3-overview-chart-panel__chart-type-option${selected ? " is-active" : ""}`}
                        onClick={() => {
                          onChartTypeChange(option.key as EC2ChartType);
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
        ) : null}
      </div>
      <div className="cost-explorer-chart-panel__body">
        <BaseEChart
          option={option}
          height={chartHeight}
          className="s3-overview-chart-panel__canvas"
          onPointClick={(event) => {
            const point = event as { name?: string; seriesName?: string; seriesIndex?: number };
            const series = graph.series[typeof point.seriesIndex === "number" ? point.seriesIndex : 0];
            const label = typeof point.name === "string" ? point.name : null;
            const dateIndex = label ? displayLabels.indexOf(label) : -1;
            const rawDate = dateIndex >= 0 ? xLabels[dateIndex] : label;
            onPointClick({
              date: rawDate ?? null,
              seriesKey: series?.key ?? null,
              seriesLabel: typeof point.seriesName === "string" ? point.seriesName : null,
            });
          }}
        />
      </div>
    </section>
  );
}
