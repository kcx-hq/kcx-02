import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import { Check, ChevronDown } from "lucide-react";

import { BaseEChart } from "../../../../common/charts/BaseEChart";
import type { S3CostInsightsResponse } from "../../../../api/dashboardApi";
import type { S3UsageFilterValue } from "./s3Usage.types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const numberFormatterPrecise = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});
const numberFormatterCount = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
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
  seriesBy: S3UsageFilterValue["seriesBy"];
  category: S3UsageFilterValue["category"];
  xAxis: S3UsageFilterValue["xAxis"];
  yAxisMetric: S3UsageFilterValue["yAxisMetric"];
  chartType: S3UsageFilterValue["chartType"];
  onChartTypeChange?: (next: S3UsageFilterValue["chartType"]) => void;
  onReset?: () => void;
  onRetry?: () => void;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onBucketClick?: (bucketName: string) => void;
};

const getYAxisLabel = (metric: S3UsageFilterValue["yAxisMetric"]) => {
  if (metric === "usage_quantity") return "Usage Quantity";
  if (metric === "effective_cost") return "Effective Cost ($)";
  if (metric === "amortized_cost") return "Amortized Cost ($)";
  return "Billed Cost ($)";
};

export function S3UsageChartPanel({
  breakdown,
  seriesBy,
  category,
  xAxis,
  yAxisMetric,
  chartType,
  onChartTypeChange,
  onReset,
  onRetry,
  isLoading = false,
  isError = false,
  errorMessage,
  onBucketClick,
}: Props) {
  const chartTypeMenuRef = useRef<HTMLDivElement | null>(null);
  const hoveredPointRef = useRef<{ seriesName: string; dataIndex: number } | null>(null);
  const [isChartTypeMenuOpen, setIsChartTypeMenuOpen] = useState(false);

  useEffect(() => {
    if (!isChartTypeMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (chartTypeMenuRef.current?.contains(event.target as Node)) return;
      setIsChartTypeMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsChartTypeMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isChartTypeMenuOpen]);

  const isBucketStorageView = seriesBy === "bucket" && yAxisMetric === "usage_quantity" && category === "storage";
  const isRequestCountView = yAxisMetric === "usage_quantity" && (category === "request" || category === "api_operations");
  const isObjectCountView = yAxisMetric === "usage_quantity" && category === "object_count";
  const usageQuantityUnitLabel = useMemo(() => {
    if (yAxisMetric !== "usage_quantity") return "Units";
    if (category === "request" || category === "object_count" || category === "api_operations") return "Count";
    return "GB";
  }, [category, yAxisMetric]);

  const normalizedBreakdownSeries = useMemo(() => {
    const series = breakdown?.series ?? [];
    return series.map((item) => ({
      ...item,
      values: item.values.map((value) => Number(value ?? 0)),
    }));
  }, [breakdown?.series]);

  const chartReady = Boolean(breakdown && breakdown.labels.length > 0 && breakdown.series.length > 0);
  const seriesCount = breakdown?.series.length ?? 0;
  const chartHeight = seriesCount > 8 ? 500 : seriesCount > 5 ? 450 : 400;

  const labels = useMemo(
    () =>
      (breakdown?.labels ?? []).map((label) => {
        if (xAxis !== "date") return label;
        const parsed = new Date(`${label}T00:00:00.000Z`);
        return Number.isNaN(parsed.getTime()) ? label : xAxisFormatter.format(parsed);
      }),
    [breakdown?.labels, xAxis],
  );

  const option = useMemo<EChartsOption>(() => {
    const isLine = chartType === "line";
    const isQuantity = yAxisMetric === "usage_quantity";
    const xAxisName =
      xAxis === "bucket"
        ? "Bucket"
        : xAxis === "region"
          ? "Region"
          : xAxis === "account"
            ? "Account"
            : "Date";

    return {
      color: CHART_COLORS,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: isLine ? "line" : "shadow" },
        confine: true,
        backgroundColor: "#102744",
        borderColor: "rgba(140, 182, 232, 0.36)",
        borderWidth: 1,
        textStyle: { color: "#e7eef8", fontSize: 12, fontWeight: 500 },
        extraCssText:
          "border-radius:10px; box-shadow:0 12px 28px rgba(2,10,24,0.48); padding:12px 14px; max-width:460px; max-height:360px; overflow-y:auto; overflow-x:hidden; white-space:normal; word-break:break-word; overflow-wrap:anywhere;",
        formatter: (params: unknown) => {
          const axisParams = Array.isArray(params) ? params : [params];
          if (axisParams.length === 0) return "";

          const formatValue = (value: unknown) =>
            isQuantity
              ? isRequestCountView || isObjectCountView
                ? numberFormatterCount.format(Number(value ?? 0))
                : numberFormatterPrecise.format(Number(value ?? 0))
              : currencyFormatter.format(Number(value ?? 0));

          const first = axisParams[0] as { axisValueLabel?: unknown };
          const title = String(first?.axisValueLabel ?? "");

          const hovered = hoveredPointRef.current;
          if (hovered) {
            const match = axisParams.find((entry) => {
              const point = entry as { seriesName?: unknown; dataIndex?: unknown };
              return String(point?.seriesName ?? "") === hovered.seriesName && Number(point?.dataIndex ?? -1) === hovered.dataIndex;
            }) as { marker?: unknown; seriesName?: unknown; value?: unknown } | undefined;

            if (match) {
              const matchValue = Number(match.value ?? 0);
              if (matchValue === 0) return "";
              return [
                title,
                `${String(match.marker ?? "")} ${String(match.seriesName ?? "")}: ${formatValue(matchValue)}`,
              ].join("<br/>");
            }
          }

          const lines = axisParams
            .filter((entry) => Number((entry as { value?: unknown }).value ?? 0) !== 0)
            .map((entry) => {
            const point = entry as { marker?: unknown; seriesName?: unknown; value?: unknown };
            return `${String(point.marker ?? "")} ${String(point.seriesName ?? "")}: ${formatValue(point.value)}`;
          });
          if (lines.length === 0) return "";
          return [title, ...lines].join("<br/>");
        },
      },
      legend: {
        type: "scroll",
        top: 0,
        icon: "roundRect",
        itemHeight: 6,
        itemWidth: 18,
        textStyle: { color: "#58706d", fontSize: 11 },
      },
      grid: { left: isRequestCountView ? 36 : 52, right: 12, top: 54, bottom: 36, containLabel: true },
      xAxis: {
        type: "category",
        name: xAxisName,
        nameLocation: "middle",
        nameGap: 24,
        nameTextStyle: { color: "#6d837e", fontSize: 11 },
        data: labels,
        axisLine: { lineStyle: { color: "#d7e4df" } },
        axisLabel: {
          color: "#5c7370",
          fontSize: 11,
          hideOverlap: true,
          rotate: 0,
          margin: 12,
          interval: labels.length > 20 ? 1 : 0,
        },
      },
      yAxis: {
        type: "value",
        min: isLine ? undefined : 0,
        name:
          yAxisMetric === "usage_quantity"
            ? category === "storage"
              ? "Storage (GB)"
              : category === "storage_gb_mo"
                ? "Storage (GB-Mo)"
              : category === "data_transfer"
                ? "Transfer (GB)"
                : category === "retrieval_gb"
                  ? "Retrieval (GB)"
                : category === "request"
                  ? "Requests (Count)"
                  : category === "api_operations"
                    ? "API Operations (Count)"
                  : category === "object_count"
                    ? "Object Count"
                    : `Usage Quantity (${usageQuantityUnitLabel})`
            : getYAxisLabel(yAxisMetric),
        nameLocation: "middle",
        nameRotate: 90,
        nameGap: isRequestCountView ? 52 : 66,
        nameTextStyle: { color: "#6d837e", fontSize: isRequestCountView ? 10 : 11 },
        axisLine: { show: false },
        splitLine: { show: true, lineStyle: { color: "#e1eae7", type: "solid", width: 1 } },
        axisLabel: {
          color: "#6d837e",
          fontSize: 11,
          formatter: (value: number) =>
            isQuantity
              ? isRequestCountView || isObjectCountView
                ? numberFormatterCount.format(value)
                : numberFormatterPrecise.format(value)
              : currencyFormatter.format(value),
        },
      },
      dataZoom: labels.length > 45 ? [{ type: "inside", start: 0, end: 100 }] : undefined,
      series: normalizedBreakdownSeries.map((series) => ({
        name: series.name,
        type: isLine ? "line" : "bar",
        stack: isLine ? undefined : "s3-usage",
        smooth: isLine,
        showSymbol: isLine ? labels.length <= 60 : false,
        symbolSize: isLine ? 5 : undefined,
        barWidth: isLine ? undefined : "86%",
        barMaxWidth: isLine ? undefined : 80,
        barCategoryGap: isLine ? undefined : "8%",
        barGap: isLine ? undefined : "0%",
        lineStyle: isLine ? { width: 2.3 } : undefined,
        itemStyle: isLine ? undefined : { borderRadius: 0 },
        data: series.values.map((value) => Number(value ?? 0)),
      })),
    };
  }, [
    category,
    chartType,
    isBucketStorageView,
    isObjectCountView,
    isRequestCountView,
    labels,
    normalizedBreakdownSeries,
    usageQuantityUnitLabel,
    xAxis,
    yAxisMetric,
  ]);

  const handleChartPointClick = (params: unknown) => {
    if (!onBucketClick) return;
    if (!params || typeof params !== "object") return;

    const payload = params as { componentType?: string; name?: unknown; seriesName?: unknown };
    if (payload.componentType !== "series") return;

    const rawBucketName =
      xAxis === "bucket"
        ? String(payload.name ?? "").trim()
        : seriesBy === "bucket"
          ? String(payload.seriesName ?? "").trim()
          : "";
    if (!rawBucketName) return;

    const normalized = rawBucketName.toLowerCase();
    if (normalized === "others" || normalized === "unattributed") return;

    onBucketClick(rawBucketName);
  };

  const handleChartPointHover = (params: unknown) => {
    if (!params || typeof params !== "object") {
      hoveredPointRef.current = null;
      return;
    }
    const payload = params as { componentType?: unknown; seriesName?: unknown; dataIndex?: unknown };
    if (payload.componentType !== "series") {
      hoveredPointRef.current = null;
      return;
    }
    hoveredPointRef.current = {
      seriesName: String(payload.seriesName ?? ""),
      dataIndex: Number(payload.dataIndex ?? -1),
    };
  };

  const handleChartPointLeave = () => {
    hoveredPointRef.current = null;
  };

  return (
    <section className="cost-explorer-chart-panel s3-overview-chart-panel s3-usage-chart-panel" aria-label="S3 usage chart">
      <div className="cost-explorer-chart-panel__header">
        <h2 className="cost-explorer-chart-panel__title">
          {isObjectCountView ? "S3 Object Count vs Date" : isBucketStorageView ? "S3 Usage by Date" : "S3 Usage vs Date"}
        </h2>
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
              ].map((entry) => {
                const selected = entry.key === chartType;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    className={`s3-overview-chart-panel__chart-type-option${selected ? " is-active" : ""}`}
                    onClick={() => {
                      onChartTypeChange?.(entry.key as S3UsageFilterValue["chartType"]);
                      setIsChartTypeMenuOpen(false);
                    }}
                  >
                    <span>{entry.label}</span>
                    {selected ? <Check size={16} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      <div className="cost-explorer-chart-panel__body">
        {isLoading ? (
          <div className="cost-explorer-chart-skeleton" style={{ minHeight: `${chartHeight}px` }} />
        ) : isError ? (
          <div className="dashboard-empty-state-block">
            <p className="dashboard-empty-state-block__title">Could not load S3 usage data</p>
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
          <BaseEChart
            option={option}
            height={chartHeight}
            onPointClick={handleChartPointClick}
            onPointHover={handleChartPointHover}
            onPointLeave={handleChartPointLeave}
          />
        ) : (
          <div className="dashboard-empty-state-block">
            <p className="dashboard-empty-state-block__title">
              {isObjectCountView ? "No object count data available for this selection." : "No S3 usage data for this selection"}
            </p>
            <p className="dashboard-empty-state-block__message">
              {isObjectCountView ? "Try changing the usage split or date range." : "Try changing the usage split or metric filters."}
            </p>
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
