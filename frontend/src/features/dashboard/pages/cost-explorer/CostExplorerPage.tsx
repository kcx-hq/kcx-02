import { useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import { useLocation, useNavigate } from "react-router-dom";

import { useCostExplorerQuery } from "../../hooks/useDashboardQueries";
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
  buildTimeLabels,
  calculateDeltaPercent,
  compactCurrencyFormatter,
  currencyFormatter,
  generatePrimaryValues,
  parseInputDate,
  parseMoneyToken,
  parsePercentToken,
  percentFormatter,
  rangeByPreset,
  shiftAsPreviousPeriod,
  formatInputDate,
  summaryToMap,
} from "./costExplorer.utils";
import { CostExplorerChartSection, CostExplorerFiltersPanel } from "./components";

type ChartMode = "line" | "bar";

export default function CostExplorerPage() {
  const query = useCostExplorerQuery();
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();

  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [metric, setMetric] = useState<Metric>("billed");
  const [compare, setCompare] = useState<CompareKey[]>(["previous-month"]);
  const [chartMode, setChartMode] = useState<ChartMode>("line");

  const granularityRef = useRef<HTMLButtonElement | null>(null);
  const groupRef = useRef<HTMLButtonElement | null>(null);
  const compareRef = useRef<HTMLButtonElement | null>(null);
  const metricRef = useRef<HTMLButtonElement | null>(null);

  const fallbackRange = rangeByPreset("last-30d");
  const params = new URLSearchParams(location.search);
  const queryFrom = params.get("billingPeriodStart") ?? params.get("from");
  const queryTo = params.get("billingPeriodEnd") ?? params.get("to");
  const granularityParam = params.get("granularity");

  const parsedFrom = queryFrom ? parseInputDate(queryFrom) : null;
  const parsedTo = queryTo ? parseInputDate(queryTo) : null;
  const scopeFrom = scope?.from ? parseInputDate(scope.from) : null;
  const scopeTo = scope?.to ? parseInputDate(scope.to) : null;

  const resolvedRange =
    parsedFrom && parsedTo && parsedFrom <= parsedTo
      ? { from: formatInputDate(parsedFrom), to: formatInputDate(parsedTo) }
      : scopeFrom && scopeTo && scopeFrom <= scopeTo
        ? { from: formatInputDate(scopeFrom), to: formatInputDate(scopeTo) }
        : fallbackRange;

  const from = resolvedRange.from;
  const to = resolvedRange.to;

  const summary = useMemo(() => summaryToMap(query.data), [query.data]);
  const topService = summary.topService ?? "Compute";
  const monthToDate = parseMoneyToken(summary.monthToDate) ?? 96_400;
  const trend = parsePercentToken(summary.trend) ?? 3.2;

  const start = parseInputDate(from);
  const end = parseInputDate(to);
  const validRange = Boolean(start && end && start <= end);

  const days = useMemo(() => {
    if (!start || !end || start > end) return 0;
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [end, start]);

  const autoGranularity: Granularity = days <= 2 ? "hourly" : days >= 90 ? "monthly" : "daily";
  const requestedGranularity: Granularity | null =
    granularityParam === "hourly" || granularityParam === "daily" || granularityParam === "monthly"
      ? granularityParam
      : null;
  const granularity = requestedGranularity ?? autoGranularity;

  const setGranularityPreference = (next: Granularity) => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set("granularity", next);
    navigate({ pathname: location.pathname, search: nextParams.toString() }, { replace: true });
  };

  const effectiveGranularity: Granularity = granularity === "hourly" && days > 14 ? "daily" : granularity;

  const labels = useMemo(
    () => (validRange ? buildTimeLabels(from, to, effectiveGranularity) : []),
    [effectiveGranularity, from, to, validRange],
  );

  const primary = useMemo(
    () => generatePrimaryValues(labels.length, monthToDate, trend, effectiveGranularity, metric),
    [effectiveGranularity, labels.length, metric, monthToDate, trend],
  );

  const series = useMemo<ChartSeries[]>(() => {
    if (!labels.length) return [];

    const list: ChartSeries[] = [];

    if (groupBy === "none") {
      list.push({
        name: metric === "billed" ? "Billed Cost" : "Effective Cost",
        values: primary,
        kind: "primary",
      });
    } else {
      const byService = [
        { name: topService, weight: 0.43, wobble: 1.06 },
        { name: "Storage", weight: 0.31, wobble: 0.98 },
        { name: "Network", weight: 0.26, wobble: 1.01 },
      ];
      const byRegion = [
        { name: "us-east-1", weight: 0.46, wobble: 1.05 },
        { name: "us-west-2", weight: 0.32, wobble: 0.98 },
        { name: "eu-west-1", weight: 0.22, wobble: 0.95 },
      ];
      const byAccount = [
        { name: "Production", weight: 0.52, wobble: 1.08 },
        { name: "Shared Services", weight: 0.28, wobble: 0.93 },
        { name: "Sandbox", weight: 0.2, wobble: 0.88 },
      ];

      const definitions = groupBy === "service" ? byService : groupBy === "region" ? byRegion : byAccount;

      for (const definition of definitions) {
        list.push({
          name: definition.name,
          kind: "group",
          values: primary.map((value, index) =>
            Math.max(0, value * definition.weight * (definition.wobble + Math.sin(index / 4) * 0.02)),
          ),
        });
      }
    }

    const orderedCompare = [...compare].sort((a, b) => (a < b ? -1 : 1));
    for (const key of orderedCompare) {
      if (key === "previous-month") {
        list.push({
          name: "Previous Month",
          kind: "comparison",
          compareKey: key,
          values: shiftAsPreviousPeriod(primary, effectiveGranularity),
        });
      } else if (key === "budget") {
        list.push({
          name: "Budget",
          kind: "comparison",
          compareKey: key,
          values: primary.map((value, index) => value * (1.06 + Math.sin(index / 7) * 0.01)),
        });
      } else {
        list.push({
          name: "Forecast",
          kind: "comparison",
          compareKey: key,
          values: primary.map((value, index) => value * (1.03 + index / Math.max(labels.length, 1) / 90)),
        });
      }
    }

    return list;
  }, [compare, effectiveGranularity, groupBy, labels.length, metric, primary, topService]);

  const seriesMeta = useMemo(() => new Map(series.map((item) => [item.name, item])), [series]);

  const option = useMemo<EChartsOption>(
    () => ({
      color: ["#1f8b7a", "#2f6fdb", "#ca8b17", "#4f7088", "#d06453", "#4f8ca6", "#6d7f8a"],
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
          const base = primary[pointIndex] ?? 0;
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

          const context = groupBy !== "none" ? `<div style="margin-top:6px; color:#a7bcc8;">Grouped by ${groupBy}</div>` : "";
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
                width: isComparison ? 1.9 : 2.4,
                type: comparisonLineType,
                opacity: isComparison ? 0.9 : 1,
              },
          areaStyle: chartMode === "line" && index === 0 && groupBy === "none" ? { opacity: 0.08 } : undefined,
          barMaxWidth: isBar ? 22 : undefined,
          itemStyle: isBar ? { borderRadius: [4, 4, 0, 0] } : undefined,
          data: item.values,
          z: isComparison ? 2 : 3,
        };
      }),
    }),
    [chartMode, groupBy, labels, primary, series, seriesMeta],
  );

  const compareLabel = compare.length
    ? compare.map((key) => COMPARE_OPTIONS.find((item) => item.key === key)?.label ?? key).join(" + ")
    : "None";

  const periodSpend = primary.reduce((total, value) => total + value, 0);
  const trendLabel = `${trend >= 0 ? "+" : ""}${percentFormatter.format(trend)}%`;
  const trendTone: "positive" | "negative" = trend >= 0 ? "negative" : "positive";

  const chartKpis = [
    {
      label: "Period Spend",
      value: compactCurrencyFormatter.format(periodSpend),
      tone: "default" as const,
    },
    {
      label: "Trend",
      value: trendLabel,
      tone: trendTone,
    },
    {
      label: "Top Service",
      value: topService,
      tone: "default" as const,
    },
  ];

  const topBreakdowns = useMemo(() => {
    const compareImpact =
      compare[0] === "budget" ? 1.2 : compare[0] === "forecast" ? 0.8 : compare[0] === "previous-month" ? 0.4 : 0;
    const metricImpact = metric === "effective" ? -0.6 : 0.2;
    const volumeFactor = Math.max(0.76, Math.min(1.22, labels.length / 30));

    const buildRows = (
      dimension: GroupBy,
      defs: Array<{ name: string; weight: number; deltaBias: number }>,
      baseScale: number,
    ) =>
      defs
        .map((def, index) => {
          const wave = 1 + Math.sin((days + (index + 2) * 3) / 6) * 0.06 + Math.cos((labels.length + index * 4) / 7) * 0.04;
          const groupBoost = groupBy === dimension ? 1.08 - index * 0.012 : 1;
          const cost = Math.max(0, periodSpend * def.weight * baseScale * wave * groupBoost * volumeFactor);
          const change = trend + def.deltaBias + compareImpact + metricImpact + (groupBy === dimension ? 0.9 : 0);
          return { name: def.name, cost, change };
        })
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5)
        .map((row, index) => {
          const changeTone: "positive" | "negative" | "neutral" =
            row.change < 0 ? "positive" : row.change > 0 ? "negative" : "neutral";
          return {
            rank: index + 1,
            name: row.name,
            costLabel: compactCurrencyFormatter.format(row.cost),
            changeLabel: `${row.change >= 0 ? "+" : ""}${percentFormatter.format(row.change)}%`,
            changeTone,
          };
        });

    return [
      {
        key: "service" as const,
        label: "Top 5 Services",
        rows: buildRows(
          "service",
          [
            { name: topService, weight: 0.24, deltaBias: 1.3 },
            { name: "Storage", weight: 0.2, deltaBias: -0.2 },
            { name: "Network", weight: 0.15, deltaBias: 0.5 },
            { name: "Database", weight: 0.13, deltaBias: 0.8 },
            { name: "Analytics", weight: 0.1, deltaBias: 0.2 },
            { name: "Security", weight: 0.09, deltaBias: -0.4 },
            { name: "AI Platform", weight: 0.09, deltaBias: 1.5 },
          ],
          1,
        ),
      },
      {
        key: "account" as const,
        label: "Top 5 Accounts",
        rows: buildRows(
          "account",
          [
            { name: "Production", weight: 0.34, deltaBias: 1.1 },
            { name: "Shared Services", weight: 0.19, deltaBias: 0.1 },
            { name: "Sandbox", weight: 0.12, deltaBias: -1.2 },
            { name: "Data Platform", weight: 0.11, deltaBias: 0.7 },
            { name: "Customer Apps", weight: 0.1, deltaBias: 0.4 },
            { name: "Internal Tools", weight: 0.08, deltaBias: -0.3 },
            { name: "Analytics", weight: 0.06, deltaBias: 0.5 },
          ],
          1,
        ),
      },
      {
        key: "region" as const,
        label: "Top 5 Regions",
        rows: buildRows(
          "region",
          [
            { name: "us-east-1", weight: 0.28, deltaBias: 0.9 },
            { name: "us-west-2", weight: 0.18, deltaBias: 0.4 },
            { name: "eu-west-1", weight: 0.15, deltaBias: 0.2 },
            { name: "ap-south-1", weight: 0.12, deltaBias: 1.2 },
            { name: "ap-southeast-1", weight: 0.11, deltaBias: 0.6 },
            { name: "eu-central-1", weight: 0.1, deltaBias: 0.1 },
            { name: "sa-east-1", weight: 0.06, deltaBias: -0.5 },
          ],
          1,
        ),
      },
    ];
  }, [compare, days, groupBy, labels.length, metric, periodSpend, topService, trend]);

  const visibleBreakdowns = useMemo(() => {
    if (groupBy === "service" || groupBy === "account" || groupBy === "region") {
      return topBreakdowns.filter((item) => item.key === groupBy);
    }
    return [];
  }, [groupBy, topBreakdowns]);

  const chips: CostExplorerChip[] = [
    {
      key: "granularity",
      label: "Granularity",
      value: effectiveGranularity[0].toUpperCase() + effectiveGranularity.slice(1),
    },
    {
      key: "group",
      label: "Group",
      value: GROUP_BY_OPTIONS.find((item) => item.key === groupBy)?.label ?? "None",
    },
    {
      key: "compare",
      label: "Compare",
      value: compareLabel,
    },
    {
      key: "metric",
      label: "Metric",
      value: METRIC_OPTIONS.find((item) => item.key === metric)?.label ?? "Billed Cost",
    },
  ];

  const toggleCompare = (key: CompareKey) => {
    setCompare((current) => (current[0] === key ? [] : [key]));
  };

  const clearAll = () => {
    setGranularityPreference("daily");
    setGroupBy("none");
    setCompare(["previous-month"]);
    setMetric("billed");
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
      setGranularityPreference("daily");
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
    setMetric("billed");
  };

  const chartReady = validRange && labels.length > 0 && series.length > 0;

  return (
    <div className="dashboard-page cost-explorer-page">
      <section className="cost-explorer-unified-shell">
        <CostExplorerFiltersPanel
          effectiveGranularity={effectiveGranularity}
          days={days}
          groupBy={groupBy}
          metric={metric}
          compare={compare}
          chips={chips}
          onSetGranularity={setGranularityPreference}
          onSetGroupBy={setGroupBy}
          onSetMetric={setMetric}
          onToggleCompare={toggleCompare}
          onEditChip={editChip}
          onRemoveChip={removeChip}
          onClearAll={clearAll}
          granularityRef={granularityRef}
          groupRef={groupRef}
          compareRef={compareRef}
          metricRef={metricRef}
        />

        <div className="cost-explorer-unified-shell__divider" aria-hidden="true" />

        <CostExplorerChartSection
          option={option}
          isLoading={query.isLoading}
          isError={query.isError}
          errorMessage={query.error?.message}
          isFetching={query.isFetching}
          chartReady={chartReady}
          chartMode={chartMode}
          onChartModeChange={setChartMode}
          kpis={chartKpis}
          topBreakdowns={visibleBreakdowns}
          onRetry={() => query.refetch()}
          onReset={clearAll}
        />
      </section>
    </div>
  );
}
