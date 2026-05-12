import { useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";

import { useCostExplorerQuery } from "../../../hooks/useDashboardQueries";
import { useDashboardScope } from "../../../hooks/useDashboardScope";
import { CostExplorerChartSection, CostExplorerFiltersPanel } from "../../cost-explorer/components";
import {
  calculateDeltaPercent,
  compactCurrencyFormatter,
  formatAxisCost,
  formatTooltipCost,
  parseInputDate,
  percentFormatter,
} from "../../cost-explorer/costExplorer.utils";
import {
  COMPARE_OPTIONS,
  METRIC_OPTIONS,
  type ChartSeries,
  type CompareKey,
  type CostExplorerChip,
  type GroupBy,
  type Metric,
} from "../../cost-explorer/costExplorer.types";

type RowsPerPage = 5 | 10 | 15;

const COMPARISON_SERIES_COLORS: Record<CompareKey, string> = {
  "previous-month": "#4f46e5",
  budget: "#b45309",
  forecast: "#7e22ce",
};

const stringToHue = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % 360;
};

const colorForSeriesName = (name: string): string => {
  const normalized = name.trim().toLowerCase();
  if (normalized === "amazons3") {
    return "#1f77b4";
  }
  return `hsl(${stringToHue(normalized)} 62% 45%)`;
};

export default function CostHistoryPage() {
  const { scope } = useDashboardScope();

  const [selectedMetrics, setSelectedMetrics] = useState<Metric[]>(["billed"]);
  const [compare, setCompare] = useState<CompareKey[]>([]);
  const [rowsPerPage] = useState<RowsPerPage>(10);
  const [chartMode, setChartMode] = useState<"line" | "bar">("bar");

  const granularityRef = useRef<HTMLButtonElement | null>(null);
  const groupRef = useRef<HTMLButtonElement | null>(null);
  const compareRef = useRef<HTMLButtonElement | null>(null);
  const metricRef = useRef<HTMLButtonElement | null>(null);

  const multiMetricMode = selectedMetrics.length > 1;
  const activeCompareKey: CompareKey | null = multiMetricMode ? null : (compare[0] ?? null);

  const billedQuery = useCostExplorerQuery(
    {
      granularity: "monthly",
      groupBy: "service",
      metric: "billed",
      compareKey: activeCompareKey,
    },
    selectedMetrics.includes("billed"),
  );
  const effectiveQuery = useCostExplorerQuery(
    {
      granularity: "monthly",
      groupBy: "service",
      metric: "effective",
      compareKey: activeCompareKey,
    },
    selectedMetrics.includes("effective"),
  );
  const listQuery = useCostExplorerQuery(
    {
      granularity: "monthly",
      groupBy: "service",
      metric: "list",
      compareKey: activeCompareKey,
    },
    selectedMetrics.includes("list"),
  );

  const queryByMetric = useMemo(
    () => ({
      billed: billedQuery,
      effective: effectiveQuery,
      list: listQuery,
    }),
    [billedQuery, effectiveQuery, listQuery],
  );

  const primaryMetric = selectedMetrics[0] ?? "billed";
  const primaryQuery = queryByMetric[primaryMetric];
  const activeQueries = selectedMetrics.map((item) => queryByMetric[item]);

  const fullLabels = primaryQuery.data?.chart.labels ?? [];
  const primarySeries = (primaryQuery.data?.chart.series ?? []) as ChartSeries[];
  const series = useMemo<ChartSeries[]>(() => {
    if (!multiMetricMode) {
      return primarySeries;
    }

    const lines: ChartSeries[] = [];
    selectedMetrics.forEach((selectedMetric) => {
      const metricQuery = queryByMetric[selectedMetric];
      const data = metricQuery.data;
      if (!data) return;

      const metricSeries = data.chart.series.find((item) => item.kind !== "comparison");
      if (!metricSeries) return;

      const metricValuesByBucket = new Map<string, number>();
      data.chart.labels.forEach((label, index) => {
        metricValuesByBucket.set(label.bucketStart, Number(metricSeries.values[index] ?? 0));
      });

      const values = fullLabels.map(
        (label, index) => metricValuesByBucket.get(label.bucketStart) ?? Number(metricSeries.values[index] ?? 0),
      );

      lines.push({
        name: METRIC_OPTIONS.find((item) => item.key === selectedMetric)?.label ?? metricSeries.name,
        kind: "primary",
        values,
      });
    });

    return lines;
  }, [fullLabels, multiMetricMode, primarySeries, queryByMetric, selectedMetrics]);

  const trimStartIndex = Math.max(0, fullLabels.length - 13);
  const labels = useMemo(() => fullLabels.slice(trimStartIndex), [fullLabels, trimStartIndex]);
  const trimmedSeries = useMemo(
    () =>
      series.map((item) => ({
        ...item,
        values: item.values.slice(trimStartIndex),
      })),
    [series, trimStartIndex],
  );

  const seriesColorByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of trimmedSeries) {
      if (item.kind === "comparison") {
        map.set(item.name, (item.compareKey ? COMPARISON_SERIES_COLORS[item.compareKey] : undefined) ?? "#4f7088");
        continue;
      }

      map.set(item.name, colorForSeriesName(item.name));
    }
    return map;
  }, [trimmedSeries]);

  const baseValues = useMemo(() => {
    if (!labels.length) return [];
    const chartSeries = trimmedSeries.filter((item) => item.kind !== "comparison");
    return labels.map((_, index) => chartSeries.reduce((sum, item) => sum + Number(item.values[index] ?? 0), 0));
  }, [labels, trimmedSeries]);

  const seriesMeta = useMemo(() => new Map(trimmedSeries.map((item) => [item.name, item])), [trimmedSeries]);

  const yAxisBounds = useMemo(() => {
    if (!labels.length || !trimmedSeries.length) {
      return { min: -1, max: 1 };
    }

    let maxValue = Number.NEGATIVE_INFINITY;
    let minValue = Number.POSITIVE_INFINITY;
    const nonComparisonSeries = trimmedSeries.filter((item) => item.kind !== "comparison");

    for (let index = 0; index < labels.length; index += 1) {
      let bucketPositive = 0;
      let bucketNegative = 0;
      nonComparisonSeries.forEach((item) => {
        const value = Number(item.values[index] ?? 0);
        if (value >= 0) bucketPositive += value;
        else bucketNegative += value;
      });
      if (bucketPositive > maxValue) maxValue = bucketPositive;
      if (bucketNegative < minValue) minValue = bucketNegative;
    }

    trimmedSeries
      .filter((item) => item.kind === "comparison")
      .forEach((item) => {
        item.values.forEach((value) => {
          const numeric = Number(value ?? 0);
          if (numeric > maxValue) maxValue = numeric;
          if (numeric < minValue) minValue = numeric;
        });
      });

    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      return { min: -1, max: 1 };
    }

    if (minValue === maxValue) {
      const bump = Math.abs(minValue) > 0 ? Math.abs(minValue) * 0.08 : 1;
      return { min: minValue - bump, max: maxValue + bump };
    }

    const span = maxValue - minValue;
    const pad = span * 0.08;
    return { min: minValue - pad, max: maxValue + pad };
  }, [labels, trimmedSeries]);

  const option = useMemo<EChartsOption>(
    () => ({
      color: trimmedSeries.map((item) => seriesColorByName.get(item.name) ?? "#4f7088"),
      animation: true,
      animationDuration: 640,
      animationEasing: "cubicOut",
      animationDurationUpdate: 460,
      animationEasingUpdate: "cubicOut",
      stateAnimation: { duration: 260, easing: "cubicOut" },
      tooltip: {
        trigger: chartMode === "bar" ? "item" : "axis",
        axisPointer:
          chartMode === "bar"
            ? { type: "shadow", shadowStyle: { color: "rgba(79, 112, 136, 0.08)" } }
            : { type: "line" },
        confine: true,
        backgroundColor: "rgba(21, 35, 48, 0.95)",
        borderWidth: 0,
        textStyle: { color: "#f7fbfb", fontSize: 12 },
        formatter: (raw: unknown) => {
          const points = (Array.isArray(raw)
            ? raw
            : raw && typeof raw === "object"
              ? [raw]
              : []) as Array<{
            seriesName: string;
            value: number | [string | number, string | number] | null | undefined;
            marker?: string;
            dataIndex?: number;
          }>;
          if (!points.length) return "";

          const pointIndex = points[0]?.dataIndex ?? 0;
          const base = baseValues[pointIndex] ?? 0;
          const title = labels[pointIndex]?.long ?? "";
          const rows = points
            .map((point) => {
              const entry = seriesMeta.get(point.seriesName);
              if (!entry) return "";
              const numericValue = Array.isArray(point.value)
                ? Number(point.value[point.value.length - 1] ?? 0)
                : Number(point.value ?? 0);
              const comparisonDelta =
                entry.kind === "comparison" && base > 0
                  ? ` <span style="color:#b8c8d2;">(${calculateDeltaPercent(numericValue, base) >= 0 ? "+" : ""}${percentFormatter.format(calculateDeltaPercent(numericValue, base))}%)</span>`
                  : "";
              return `<div style="display:flex; gap:6px; align-items:center; margin-top:4px;">${point.marker ?? ""}<span>${point.seriesName}:</span><strong>${formatTooltipCost(numericValue)}</strong>${comparisonDelta}</div>`;
            })
            .join("");
          return `<div style="min-width:220px;"><div style="font-weight:600; margin-bottom:4px;">${title}</div>${rows}</div>`;
        },
      },
      legend: {
        type: "scroll",
        top: 0,
        icon: "roundRect",
        itemHeight: 6,
        itemWidth: 18,
        pageIconColor: "#4f7088",
        pageIconInactiveColor: "#9db2ae",
        pageTextStyle: { color: "#6d837e", fontSize: 10 },
        textStyle: { color: "#58706d", fontSize: 11 },
      },
      grid: { left: 10, right: 10, top: 58, bottom: 14, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: chartMode === "bar",
        data: labels.map((label) => label.short),
        axisLine: { lineStyle: { color: "#d7e4df" } },
        axisLabel: { color: "#5c7370", fontSize: 11, hideOverlap: true },
      },
      yAxis: {
        type: "value",
        min: yAxisBounds.min,
        max: yAxisBounds.max,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#e1eae7", type: "dashed" } },
        axisLabel: { color: "#6d837e", fontSize: 11, formatter: (value: number) => formatAxisCost(value) },
      },
      series: trimmedSeries.map((item, index) => {
        const isComparison = item.kind === "comparison";
        const renderAsBar = chartMode === "bar" && !isComparison;
        const seriesColor = seriesColorByName.get(item.name) ?? "#4f7088";
        return {
          name: item.name,
          type: renderAsBar ? "bar" : "line",
          stack: renderAsBar ? "history-stack" : undefined,
          smooth: !renderAsBar,
          showSymbol: renderAsBar ? false : labels.length <= 35,
          symbolSize: 5,
          emphasis: { focus: "series", itemStyle: { color: seriesColor } },
          blur: { itemStyle: { opacity: 0.4 }, lineStyle: { opacity: 0.45 } },
          progressive: 5000,
          progressiveThreshold: 3000,
          universalTransition: true,
          animationDuration: renderAsBar ? 780 : 520,
          animationDurationUpdate: renderAsBar ? 560 : 380,
          animationEasing: "cubicOut",
          animationEasingUpdate: "cubicOut",
          animationDelay: (idx: number) => Math.min(index * 36 + idx * 22, 640),
          barMinHeight: renderAsBar ? 2 : undefined,
          barWidth: renderAsBar ? "86%" : undefined,
          barMaxWidth: renderAsBar ? 80 : undefined,
          barCategoryGap: renderAsBar ? "8%" : undefined,
          barGap: renderAsBar ? "0%" : undefined,
          lineStyle: renderAsBar ? undefined : { color: seriesColor, width: isComparison ? 1.9 : 2.4 },
          itemStyle: renderAsBar
            ? { color: seriesColor, borderRadius: 0, borderColor: "rgba(255,255,255,0.4)", borderWidth: 0.4 }
            : { color: seriesColor },
          data: item.values.map((value) => Number(value ?? 0)),
          z: isComparison ? 4 : 3,
        };
      }),
    }),
    [baseValues, chartMode, labels, seriesColorByName, seriesMeta, trimmedSeries, yAxisBounds.max, yAxisBounds.min],
  );

  const periodSpend = primaryQuery.data?.kpis.periodSpend ?? 0;
  const previousPeriodSpend = primaryQuery.data?.kpis.previousPeriodSpend ?? 0;
  const trend = primaryQuery.data?.kpis.trendPct ?? 0;
  const trendLabel = `${trend >= 0 ? "+" : ""}${percentFormatter.format(trend)}%`;
  const trendTone: "positive" | "negative" = trend >= 0 ? "negative" : "positive";

  const chartKpis = [
    { label: "Total Spend", value: compactCurrencyFormatter.format(periodSpend), tone: "default" as const },
    { label: "Prev Spend", value: compactCurrencyFormatter.format(previousPeriodSpend), tone: "default" as const },
    { label: "Trend", value: trendLabel, tone: trendTone },
  ];

  const scopeFrom = scope?.from ? parseInputDate(scope.from) : null;
  const scopeTo = scope?.to ? parseInputDate(scope.to) : null;
  const days = useMemo(() => {
    if (!scopeFrom || !scopeTo || scopeFrom > scopeTo) return 0;
    return Math.floor((scopeTo.getTime() - scopeFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [scopeFrom, scopeTo]);

  const compareLabel = activeCompareKey
    ? COMPARE_OPTIONS.find((item) => item.key === activeCompareKey)?.label ?? activeCompareKey
    : "None";

  const chips: CostExplorerChip[] = [
    { key: "group", label: "Group", value: "Service" },
    {
      key: "compare",
      label: "Compare",
      value: compareLabel,
    },
    {
      key: "metric",
      label: "Metric",
      value: selectedMetrics.map((key) => METRIC_OPTIONS.find((item) => item.key === key)?.label ?? key).join(" VS "),
    },
  ];

  const isLoading = activeQueries.some((item) => item.isLoading);
  const isError = activeQueries.some((item) => item.isError);
  const firstError = activeQueries.find((item) => item.error);
  const errorMessage = (firstError?.error as Error | undefined)?.message;
  const isFetching = activeQueries.some((item) => item.isFetching);
  const chartReady = labels.length > 0 && trimmedSeries.some((item) => item.values.length > 0);

  const toggleMetric = (metric: Metric) => {
    setSelectedMetrics([metric]);
    setCompare([]);
  };

  const toggleCompare = (key: CompareKey) => {
    if (selectedMetrics.length > 1) {
      setSelectedMetrics([selectedMetrics[0] ?? "billed"]);
    }
    setCompare((current) => (current[0] === key ? [] : [key]));
  };

  const clearAll = () => {
    setSelectedMetrics(["billed"]);
    setCompare([]);
    setChartMode("bar");
  };

  return (
    <div className="dashboard-page cost-history-page">
      <section className="cost-explorer-unified-shell">
        <CostExplorerFiltersPanel
          effectiveGranularity="monthly"
          days={days}
          groupBy={"service" as GroupBy}
          selectedMetrics={selectedMetrics}
          compare={compare}
          chips={chips}
          onSetGranularity={() => {}}
          onSetGroupBy={() => {}}
          onToggleMetric={toggleMetric}
          onToggleCompare={toggleCompare}
          onEditChip={() => {}}
          onRemoveChip={(key) => {
            if (key === "compare") {
              setCompare([]);
              return;
            }
            if (key === "metric") {
              setSelectedMetrics(["billed"]);
            }
          }}
          onClearAll={clearAll}
          hideGranularity
          granularityRef={granularityRef}
          groupRef={groupRef}
          compareRef={compareRef}
          metricRef={metricRef}
          groupOptions={[{ key: "service", label: "Service" }]}
          groupValueOptions={[]}
          selectedGroupValues={[]}
          onToggleGroupValue={() => {}}
          onClearGroupValues={() => {}}
          onApplyGroupFilters={() => {}}
          hasPendingGroupChanges={false}
          groupValuesLoading={false}
          enableGroupValueFiltering={false}
        />

        <div className="cost-explorer-unified-shell__divider" aria-hidden="true" />

        <CostExplorerChartSection
          option={option}
          isLoading={isLoading}
          isError={isError}
          errorMessage={errorMessage}
          isFetching={isFetching}
          showApplySkeleton={isFetching}
          chartReady={chartReady}
          chartMode={chartMode}
          onChartModeChange={setChartMode}
          kpis={chartKpis}
          topBreakdowns={[]}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={() => {}}
          breakdownPagination={null}
          onBreakdownPageChange={() => {}}
          onRetry={() => {
            activeQueries.forEach((query) => {
              void query.refetch();
            });
          }}
          onReset={clearAll}
        />
      </section>
    </div>
  );
}
