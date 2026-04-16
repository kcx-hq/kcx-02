import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";

import { useCostExplorerGroupOptionsQuery, useCostExplorerQuery } from "../../hooks/useDashboardQueries";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import {
  COMPARE_OPTIONS,
  GROUP_BY_OPTIONS,
  METRIC_OPTIONS,
  type ChartSeries,
  type CompareKey,
  type CostExplorerChip,
  type Granularity,
  type GroupBy,
  type Metric,
} from "./costExplorer.types";
import {
  calculateDeltaPercent,
  compactCurrencyFormatter,
  currencyFormatter,
  percentFormatter,
  parseInputDate,
} from "./costExplorer.utils";
import { CostExplorerChartSection, CostExplorerFiltersPanel } from "./components";

type ChartMode = "line" | "bar";
type RowsPerPage = 5 | 10 | 15;

const ENTITY_SERIES_PALETTE = [
  "#1f77b4",
  "#d62728",
  "#2ca02c",
  "#9467bd",
  "#ff7f0e",
  "#17becf",
  "#8c564b",
  "#e377c2",
  "#bcbd22",
  "#7f7f7f",
  "#393b79",
  "#637939",
  "#8c6d31",
  "#843c39",
  "#7b4173",
];

const COMPARISON_SERIES_COLORS: Record<CompareKey, string> = {
  "previous-month": "#4f46e5",
  budget: "#b45309",
  forecast: "#7e22ce",
};

export default function CostExplorerPage() {
  const { scope } = useDashboardScope();

  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [selectedMetrics, setSelectedMetrics] = useState<Metric[]>(["billed"]);
  const [compare, setCompare] = useState<CompareKey[]>([]);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [rowsPerPage, setRowsPerPage] = useState<RowsPerPage>(5);
  const [breakdownPage, setBreakdownPage] = useState(1);
  const activeTagKey = groupBy.startsWith("tag:") ? groupBy.slice(4) : null;
  const groupOptionsQuery = useCostExplorerGroupOptionsQuery(activeTagKey);

  const multiMetricMode = selectedMetrics.length > 1;
  const activeGroupBy: GroupBy = multiMetricMode ? "none" : groupBy;
  const activeCompareKey: CompareKey | null = multiMetricMode ? null : (compare[0] ?? null);

  const billedQuery = useCostExplorerQuery(
    { granularity, groupBy: activeGroupBy, metric: "billed", compareKey: activeCompareKey },
    selectedMetrics.includes("billed"),
  );
  const effectiveQuery = useCostExplorerQuery(
    { granularity, groupBy: activeGroupBy, metric: "effective", compareKey: activeCompareKey },
    selectedMetrics.includes("effective"),
  );
  const listQuery = useCostExplorerQuery(
    { granularity, groupBy: activeGroupBy, metric: "list", compareKey: activeCompareKey },
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

  const granularityRef = useRef<HTMLButtonElement | null>(null);
  const groupRef = useRef<HTMLButtonElement | null>(null);
  const compareRef = useRef<HTMLButtonElement | null>(null);
  const metricRef = useRef<HTMLButtonElement | null>(null);

  const scopeFrom = scope?.from ? parseInputDate(scope.from) : null;
  const scopeTo = scope?.to ? parseInputDate(scope.to) : null;

  const days = useMemo(() => {
    if (!scopeFrom || !scopeTo || scopeFrom > scopeTo) return 0;
    return Math.floor((scopeTo.getTime() - scopeFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [scopeFrom, scopeTo]);

  const effectiveGranularity = (primaryQuery.data?.filtersApplied.effectiveGranularity ??
    (granularity === "hourly" && days > 14 ? "daily" : granularity)) as Granularity;

  const dynamicGroupOptions = useMemo<Array<{ key: GroupBy; label: string }>>(() => {
    const base = GROUP_BY_OPTIONS.map((item) => ({ key: item.key as GroupBy, label: item.label }));
    const noneOption = base.find((item) => item.key === "none") ?? { key: "none" as GroupBy, label: "None" };
    const baseWithoutNone = base.filter((item) => item.key !== "none");
    const tags =
      groupOptionsQuery.data?.tagKeyOptions.map((option) => ({
        key: option.key as GroupBy,
        label:
          option.normalizedKey.length > 0
            ? `Tag: ${option.normalizedKey[0].toUpperCase() + option.normalizedKey.slice(1)}`
            : option.normalizedKey,
      })) ?? [];
    return [noneOption, ...tags, ...baseWithoutNone];
  }, [groupOptionsQuery.data?.tagKeyOptions]);

  const labels = primaryQuery.data?.chart.labels ?? [];
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

      const values = labels.map(
        (label, index) => metricValuesByBucket.get(label.bucketStart) ?? Number(metricSeries.values[index] ?? 0),
      );

      lines.push({
        name: METRIC_OPTIONS.find((item) => item.key === selectedMetric)?.label ?? metricSeries.name,
        kind: "primary",
        values,
      });
    });

    return lines;
  }, [labels, multiMetricMode, primarySeries, queryByMetric, selectedMetrics]);

  const seriesColorByName = useMemo(() => {
    const map = new Map<string, string>();
    let entityColorIndex = 0;

    for (const item of series) {
      if (item.kind === "comparison") {
        const comparisonColor =
          (item.compareKey ? COMPARISON_SERIES_COLORS[item.compareKey] : undefined) ?? "#4f7088";
        map.set(item.name, comparisonColor);
        continue;
      }

      if (!map.has(item.name)) {
        map.set(item.name, ENTITY_SERIES_PALETTE[entityColorIndex % ENTITY_SERIES_PALETTE.length]);
        entityColorIndex += 1;
      }
    }

    return map;
  }, [series]);

  const baseValues = useMemo(() => {
    if (!labels.length) return [];
    const chartSeries = series.filter((item) => item.kind !== "comparison");
    return labels.map((_, index) =>
      chartSeries.reduce((sum, item) => sum + Number(item.values[index] ?? 0), 0),
    );
  }, [labels, series]);

  const seriesMeta = useMemo(() => new Map(series.map((item) => [item.name, item])), [series]);

  const option = useMemo<EChartsOption>(
    () => ({
      color: series.map((item) => seriesColorByName.get(item.name) ?? "#4f7088"),
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(21, 35, 48, 0.95)",
        borderWidth: 0,
        textStyle: { color: "#f7fbfb", fontSize: 12 },
        formatter: (raw: unknown) => {
          const points = (Array.isArray(raw) ? raw : []) as Array<{
            seriesName: string;
            value: number;
            marker: string;
            dataIndex: number;
          }>;

          if (!points.length) return "";

          const pointIndex = points[0]?.dataIndex ?? 0;
          const base = baseValues[pointIndex] ?? 0;
          const title = labels[pointIndex]?.long ?? "";
          const rows = points
            .map((point) => {
              const entry = seriesMeta.get(point.seriesName);
              if (!entry) return "";

              const comparisonDelta =
                entry.kind === "comparison" && base > 0
                  ? ` <span style="color:#b8c8d2;">(${calculateDeltaPercent(Number(point.value), base) >= 0 ? "+" : ""}${percentFormatter.format(calculateDeltaPercent(Number(point.value), base))}%)</span>`
                  : "";

              return `<div style="display:flex; gap:6px; align-items:center; margin-top:4px;">${point.marker}<span>${point.seriesName}:</span><strong>${currencyFormatter.format(Number(point.value))}</strong>${comparisonDelta}</div>`;
            })
            .join("");

          const context =
            activeGroupBy !== "none"
              ? `<div style="margin-top:6px; color:#a7bcc8;">Grouped by ${activeGroupBy}</div>`
              : "";
          return `<div style="min-width:220px;"><div style="font-weight:600; margin-bottom:4px;">${title}</div>${rows}${context}</div>`;
        },
      },
      legend: {
        top: 0,
        icon: "roundRect",
        itemHeight: 6,
        itemWidth: 18,
        textStyle: { color: "#58706d", fontSize: 11 },
      },
      grid: { left: 10, right: 10, top: 34, bottom: 14, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: chartMode === "bar",
        data: labels.map((label) => label.short),
        axisLine: { lineStyle: { color: "#d7e4df" } },
        axisLabel: {
          color: "#5c7370",
          fontSize: 11,
          hideOverlap: true,
          rotate: labels.length > 22 ? 28 : 0,
        },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#e5efec" } },
        axisLabel: { color: "#6d837e", fontSize: 11, formatter: (value: number) => compactCurrencyFormatter.format(value) },
      },
      dataZoom: labels.length > 45 ? [{ type: "inside", start: 0, end: 100 }] : undefined,
      series: series.map((item, index) => {
        const comparisonLineType = item.compareKey === "previous-month" ? "dashed" : item.compareKey === "budget" ? "dotted" : "solid";
        const isComparison = item.kind === "comparison";
        const isBar = chartMode === "bar";
        const seriesColor = seriesColorByName.get(item.name) ?? "#4f7088";
        return {
          name: item.name,
          type: isBar ? "bar" : "line",
          stack: undefined,
          smooth: !isBar,
          showSymbol: isBar ? false : labels.length <= 35,
          symbolSize: 5,
          emphasis: { focus: "series" },
          animationDurationUpdate: 220,
          animationEasingUpdate: "cubicOut",
          lineStyle: isBar
            ? undefined
            : {
                color: seriesColor,
                width: isComparison ? 1.9 : 2.4,
                type: comparisonLineType,
                opacity: isComparison ? 0.9 : 1,
              },
          areaStyle:
            chartMode === "line" && index === 0 && activeGroupBy === "none"
              ? { color: seriesColor, opacity: 0.08 }
              : undefined,
          barMaxWidth: isBar ? 22 : undefined,
          itemStyle: isBar ? { color: seriesColor, borderRadius: [4, 4, 0, 0] } : { color: seriesColor },
          data: item.values.map((value) => Number(value ?? 0)),
          z: isComparison ? 2 : 3,
        };
      }),
    }),
    [activeGroupBy, baseValues, chartMode, labels, series, seriesColorByName, seriesMeta],
  );

  const compareLabel = activeCompareKey
    ? COMPARE_OPTIONS.find((item) => item.key === activeCompareKey)?.label ?? activeCompareKey
    : "None";

  const periodSpend = primaryQuery.data?.kpis.periodSpend ?? 0;
  const previousPeriodSpend = primaryQuery.data?.kpis.previousPeriodSpend ?? 0;
  const trend = primaryQuery.data?.kpis.trendPct ?? 0;
  const trendLabel = `${trend >= 0 ? "+" : ""}${percentFormatter.format(trend)}%`;
  const trendTone: "positive" | "negative" = trend >= 0 ? "negative" : "positive";

  const chartKpis = [
    {
      label: "Total Spend",
      value: compactCurrencyFormatter.format(periodSpend),
      tone: "default" as const,
    },
    {
      label: "Prev Spend",
      value: compactCurrencyFormatter.format(previousPeriodSpend),
      tone: "default" as const,
    },
    {
      label: "Trend",
      value: trendLabel,
      tone: trendTone,
    },
  ];

  const allBreakdowns = useMemo(() => {
    const mergeRowsByName = (
      rows: Array<{
        name: string;
        cost: number;
        changePct: number;
        relatedServices?: string[];
        relatedResourceTypes?: string[];
      }>,
    ) => {
      const byName = new Map<
        string,
        {
          name: string;
          cost: number;
          weightedChangeSum: number;
          weight: number;
          relatedServices: Set<string>;
          relatedResourceTypes: Set<string>;
        }
      >();

      rows.forEach((row) => {
        const normalizedName = row.name?.trim() || "Unspecified";
        const key = normalizedName.toLowerCase();
        const existing = byName.get(key);
        const weight = row.cost > 0 ? row.cost : 1;

        if (!existing) {
          byName.set(key, {
            name: normalizedName,
            cost: row.cost,
            weightedChangeSum: row.changePct * weight,
            weight,
            relatedServices: new Set((row.relatedServices ?? []).filter((item) => item.trim().length > 0)),
            relatedResourceTypes: new Set((row.relatedResourceTypes ?? []).filter((item) => item.trim().length > 0)),
          });
          return;
        }

        existing.cost += row.cost;
        existing.weightedChangeSum += row.changePct * weight;
        existing.weight += weight;
        (row.relatedServices ?? []).forEach((serviceName) => {
          if (serviceName.trim().length > 0) {
            existing.relatedServices.add(serviceName);
          }
        });
        (row.relatedResourceTypes ?? []).forEach((resourceType) => {
          if (resourceType.trim().length > 0) {
            existing.relatedResourceTypes.add(resourceType);
          }
        });
      });

      return [...byName.values()]
        .map((item) => ({
          name: item.name,
          cost: item.cost,
          changePct: item.weight > 0 ? item.weightedChangeSum / item.weight : 0,
          relatedServices: [...item.relatedServices].slice(0, 6),
          relatedResourceTypes: [...item.relatedResourceTypes].slice(0, 6),
        }))
        .sort((a, b) => b.cost - a.cost);
    };

    return [
      {
        key: "service" as const,
        label: "Services by Cost",
        rows: mergeRowsByName(primaryQuery.data?.breakdowns.service ?? []),
      },
      {
        key: "service-category" as const,
        label: "Service Categories by Cost",
        rows: mergeRowsByName(primaryQuery.data?.breakdowns.serviceCategory ?? []),
      },
      {
        key: "resource" as const,
        label: "Resources by Cost",
        rows: mergeRowsByName(primaryQuery.data?.breakdowns.resource ?? []),
      },
      {
        key: "account" as const,
        label: "Accounts by Cost",
        rows: mergeRowsByName(primaryQuery.data?.breakdowns.account ?? []),
      },
      {
        key: "region" as const,
        label: "Regions by Cost",
        rows: mergeRowsByName(primaryQuery.data?.breakdowns.region ?? []),
      },
    ];
  }, [primaryQuery.data]);

  const selectedBreakdown = useMemo(() => {
    if (
      activeGroupBy !== "service" &&
      activeGroupBy !== "service-category" &&
      activeGroupBy !== "resource" &&
      activeGroupBy !== "account" &&
      activeGroupBy !== "region"
    ) {
      return null;
    }
    return allBreakdowns.find((item) => item.key === activeGroupBy) ?? null;
  }, [activeGroupBy, allBreakdowns]);

  const totalRows = selectedBreakdown?.rows.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const safePage = Math.min(Math.max(breakdownPage, 1), totalPages);

  useEffect(() => {
    setBreakdownPage(1);
  }, [activeGroupBy, rowsPerPage]);

  useEffect(() => {
    if (breakdownPage > totalPages) {
      setBreakdownPage(totalPages);
    }
  }, [breakdownPage, totalPages]);

  const visibleBreakdowns = useMemo(() => {
    if (!selectedBreakdown) {
      return [];
    }

    const pageStartIndex = (safePage - 1) * rowsPerPage;
    const pageEndIndex = pageStartIndex + rowsPerPage;
    const pageRows = selectedBreakdown.rows.slice(pageStartIndex, pageEndIndex).map((row) => {
      const changeTone: "positive" | "negative" | "neutral" =
        row.changePct < 0 ? "positive" : row.changePct > 0 ? "negative" : "neutral";
      return {
        name: row.name,
        subtitle: (() => {
          if (activeGroupBy === "service-category") {
            return Array.isArray(row.relatedServices) && row.relatedServices.length > 0
              ? row.relatedServices.join(", ")
              : undefined;
          }
          if (activeGroupBy === "resource") {
            const serviceText =
              Array.isArray(row.relatedServices) && row.relatedServices.length > 0
                ? `Service: ${row.relatedServices.join(", ")}`
                : "";
            const typeText =
              Array.isArray(row.relatedResourceTypes) && row.relatedResourceTypes.length > 0
                ? `Type: ${row.relatedResourceTypes.join(", ")}`
                : "";
            const combined = [serviceText, typeText].filter(Boolean).join(" | ");
            return combined.length > 0 ? combined : undefined;
          }
          return undefined;
        })(),
        costLabel: compactCurrencyFormatter.format(row.cost),
        changeLabel: `${row.changePct >= 0 ? "+" : ""}${percentFormatter.format(row.changePct)}%`,
        changeTone,
      };
    });

    return [
      {
        key: selectedBreakdown.key,
        label: selectedBreakdown.label,
        rows: pageRows,
      },
    ];
  }, [activeGroupBy, rowsPerPage, safePage, selectedBreakdown]);

  const chips: CostExplorerChip[] = [
    {
      key: "granularity",
      label: "Granularity",
      value: effectiveGranularity[0].toUpperCase() + effectiveGranularity.slice(1),
    },
    {
      key: "group",
      label: "Group",
      value: dynamicGroupOptions.find((item) => item.key === activeGroupBy)?.label ?? "None",
    },
    {
      key: "compare",
      label: "Compare",
      value: compareLabel,
    },
    {
      key: "metric",
      label: "Metric",
      value: selectedMetrics
        .map((key) => METRIC_OPTIONS.find((item) => item.key === key)?.label ?? key)
        .join(" VS "),
    },
  ];

  const toggleCompare = (key: CompareKey) => {
    if (multiMetricMode) {
      setSelectedMetrics([selectedMetrics[0] ?? "billed"]);
    }
    setCompare((current) => (current[0] === key ? [] : [key]));
  };

  const toggleMetricSelection = (next: Metric) => {
    setSelectedMetrics((current) => {
      const exists = current.includes(next);
      if (exists) {
        if (current.length === 1) {
          return current;
        }
        return current.filter((item) => item !== next);
      }
      const updated = [...current, next];
      if (updated.length > 1) {
        setGroupBy("none");
        setCompare([]);
      }
      return updated;
    });
  };

  const setGroupByWithMetricMode = (next: GroupBy) => {
    if (multiMetricMode && next !== "none") {
      setSelectedMetrics([selectedMetrics[0] ?? "billed"]);
    }
    setGroupBy(next);
  };

  const clearAll = () => {
    setGranularity("daily");
    setGroupBy("none");
    setSelectedMetrics(["billed"]);
    setCompare([]);
    setRowsPerPage(5);
    setBreakdownPage(1);
  };

  const editChip = (key: CostExplorerChip["key"]) => {
    if (key === "granularity") {
      granularityRef.current?.focus();
      return;
    }
    if (key === "group") {
      groupRef.current?.focus();
      return;
    }
    if (key === "compare") {
      compareRef.current?.focus();
      return;
    }
    metricRef.current?.focus();
  };

  const removeChip = (key: CostExplorerChip["key"]) => {
    if (key === "granularity") {
      setGranularity("daily");
      return;
    }
    if (key === "group") {
      setGroupBy("none");
      return;
    }
    if (key === "compare") {
      setCompare([]);
      return;
    }
    setSelectedMetrics(["billed"]);
  };

  const chartReady = labels.length > 0 && series.some((item) => item.values.length > 0);
  const isLoading = activeQueries.some((item) => item.isLoading);
  const isError = activeQueries.some((item) => item.isError);
  const firstError = activeQueries.find((item) => item.error);
  const errorMessage = (firstError?.error as Error | undefined)?.message;
  const isFetching = activeQueries.some((item) => item.isFetching);

  return (
    <div className="dashboard-page cost-explorer-page">
      <section className="cost-explorer-unified-shell">
        <CostExplorerFiltersPanel
          effectiveGranularity={effectiveGranularity}
          days={days}
          groupBy={groupBy}
          selectedMetrics={selectedMetrics}
          compare={compare}
          chips={chips}
          onSetGranularity={setGranularity}
          onSetGroupBy={setGroupByWithMetricMode}
          onToggleMetric={toggleMetricSelection}
          onToggleCompare={toggleCompare}
          onEditChip={editChip}
          onRemoveChip={removeChip}
          onClearAll={clearAll}
          granularityRef={granularityRef}
          groupRef={groupRef}
          compareRef={compareRef}
          metricRef={metricRef}
          groupOptions={dynamicGroupOptions}
          tagValueOptions={groupBy.startsWith("tag:") ? (groupOptionsQuery.data?.tagValueOptions ?? []) : []}
        />

        <div className="cost-explorer-unified-shell__divider" aria-hidden="true" />

        <CostExplorerChartSection
          option={option}
          isLoading={isLoading}
          isError={isError}
          errorMessage={errorMessage}
          isFetching={isFetching}
          chartReady={chartReady}
          chartMode={chartMode}
          onChartModeChange={setChartMode}
          kpis={chartKpis}
          topBreakdowns={visibleBreakdowns}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={setRowsPerPage}
          breakdownPagination={
            selectedBreakdown
              ? {
                  currentPage: safePage,
                  totalPages,
                  totalRows,
                  startRow: totalRows > 0 ? (safePage - 1) * rowsPerPage + 1 : 0,
                  endRow: totalRows > 0 ? Math.min(safePage * rowsPerPage, totalRows) : 0,
                }
              : null
          }
          onBreakdownPageChange={setBreakdownPage}
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
