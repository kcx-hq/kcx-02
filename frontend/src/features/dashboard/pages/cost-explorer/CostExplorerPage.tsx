import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import { useLocation, useNavigate } from "react-router-dom";

import { useCostExplorerGroupOptionsQuery, useCostExplorerQuery } from "../../hooks/useDashboardQueries";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import type { CostExplorerServiceDetailRow } from "../../api/dashboardTypes";
import {
  COMPARE_OPTIONS,
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
  formatAxisCost,
  formatTooltipCost,
  percentFormatter,
  parseInputDate,
} from "./costExplorer.utils";
import {
  CostExplorerBreakdownSection,
  CostExplorerChartOnlySection,
  CostExplorerFiltersPanel,
  CostExplorerKpiSection,
  CostExplorerSkeleton,
} from "./components";

type ChartMode = "line" | "bar";
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
  const hue = stringToHue(normalized);
  return `hsl(${hue} 62% 45%)`;
};

const haveSameStringItems = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
};

const parseOptionalBoolean = (value: string | null): boolean | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "on", "enabled", "yes"].includes(normalized)) return true;
  if (["false", "0", "off", "disabled", "no", "none"].includes(normalized)) return false;
  return undefined;
};

type AllowedGroupId =
  | "env"
  | "app"
  | "team"
  | "cost-center"
  | "project"
  | "service"
  | "region"
  | "charge-type"
  | "usage-type";

const ALLOWED_GROUP_DIMENSIONS: Array<{ id: AllowedGroupId; label: string }> = [
  { id: "env", label: "Env" },
  { id: "app", label: "App" },
  { id: "team", label: "Team" },
  { id: "cost-center", label: "Cost Center" },
  { id: "project", label: "Project" },
  { id: "service", label: "Service" },
  { id: "region", label: "Region" },
  { id: "charge-type", label: "Charge Type" },
  { id: "usage-type", label: "Usage Type" },
];

const detectAllowedGroupFromTagKey = (rawValue: string): AllowedGroupId | null => {
  const raw = rawValue.trim().toLowerCase().replace(/^tag:/, "");
  const stripped = raw
    .replace(/^resourcetagsuser/, "")
    .replace(/^resource_tags_user/, "")
    .replace(/^resourcetags/, "")
    .replace(/^resource_tags/, "")
    .replace(/^tagsuser/, "")
    .replace(/^taguser/, "")
    .replace(/^tags/, "")
    .replace(/^tag/, "")
    .replace(/^user/, "");
  const compact = (stripped.length > 0 ? stripped : raw).replace(/[^a-z0-9]/g, "");

  if (!compact) return null;
  if (compact.includes("costcenter") || compact.includes("costcentre")) return "cost-center";
  if (compact.includes("usagetype") || compact === "usage") return "usage-type";
  if (compact.includes("chargetype") || compact.includes("costtype") || compact.includes("lineitemtype")) {
    return "charge-type";
  }
  if (compact.includes("environment") || compact === "env") return "env";
  if (compact.includes("application") || compact === "app") return "app";
  if (compact.includes("team")) return "team";
  if (compact.includes("project")) return "project";
  if (compact.includes("service")) return "service";
  if (compact.includes("region")) return "region";
  return null;
};

export default function CostExplorerPage() {
  const { scope, isLoading: isScopeLoading, isError: isScopeError, error: scopeError } = useDashboardScope();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const forecastingEnabled = parseOptionalBoolean(
    searchParams.get("forecastingEnabled") ??
      searchParams.get("forecasting") ??
      searchParams.get("forecastEnabled") ??
      searchParams.get("forecastFilter") ??
      searchParams.get("forecastingFilter"),
  );

  const [draftGroupBy, setDraftGroupBy] = useState<GroupBy>("service");
  const [appliedGroupBy, setAppliedGroupBy] = useState<GroupBy>("service");
  const [selectedMetrics, setSelectedMetrics] = useState<Metric[]>(["billed"]);
  const [compare, setCompare] = useState<CompareKey[]>([]);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [chartMode, setChartMode] = useState<ChartMode>("bar");
  const [draftGroupValues, setDraftGroupValues] = useState<string[]>([]);
  const [appliedGroupValues, setAppliedGroupValues] = useState<string[]>([]);
  const [rowsPerPage, setRowsPerPage] = useState<RowsPerPage>(5);
  const [breakdownPage, setBreakdownPage] = useState(1);
  const draftTagKey = draftGroupBy.startsWith("tag:") ? draftGroupBy.slice(4) : null;
  const groupOptionsQuery = useCostExplorerGroupOptionsQuery(draftGroupBy, draftTagKey);

  const multiMetricMode = selectedMetrics.length > 1;
  const activeGroupBy: GroupBy = multiMetricMode ? "none" : appliedGroupBy;
  const activeGroupValues = activeGroupBy !== "none" ? appliedGroupValues : [];
  const activeTagKey = activeGroupBy.startsWith("tag:") ? activeGroupBy.slice(4) : null;
  const activeTagValue = activeTagKey && activeGroupValues.length === 1 ? activeGroupValues[0] : null;
  const activeCompareKey: CompareKey | null = multiMetricMode ? null : (compare[0] ?? null);

  const billedQuery = useCostExplorerQuery(
    {
      granularity,
      groupBy: activeGroupBy,
      metric: "billed",
      compareKey: activeCompareKey,
      ...(typeof forecastingEnabled === "boolean" ? { forecastingEnabled } : {}),
      ...(activeTagKey ? { tagKey: activeTagKey } : {}),
      ...(activeTagValue ? { tagValue: activeTagValue } : {}),
      groupValues: activeGroupValues,
    },
    selectedMetrics.includes("billed"),
  );
  const effectiveQuery = useCostExplorerQuery(
    {
      granularity,
      groupBy: activeGroupBy,
      metric: "effective",
      compareKey: activeCompareKey,
      ...(typeof forecastingEnabled === "boolean" ? { forecastingEnabled } : {}),
      ...(activeTagKey ? { tagKey: activeTagKey } : {}),
      ...(activeTagValue ? { tagValue: activeTagValue } : {}),
      groupValues: activeGroupValues,
    },
    selectedMetrics.includes("effective"),
  );
  const listQuery = useCostExplorerQuery(
    {
      granularity,
      groupBy: activeGroupBy,
      metric: "list",
      compareKey: activeCompareKey,
      ...(typeof forecastingEnabled === "boolean" ? { forecastingEnabled } : {}),
      ...(activeTagKey ? { tagKey: activeTagKey } : {}),
      ...(activeTagValue ? { tagValue: activeTagValue } : {}),
      groupValues: activeGroupValues,
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
    const keyByDimension = new Map<AllowedGroupId, GroupBy>([
      ["service", "service"],
      ["region", "region"],
    ]);

    (groupOptionsQuery.data?.tagKeyOptions ?? []).forEach((option) => {
      const matched = detectAllowedGroupFromTagKey(option.normalizedKey || option.key);
      if (!matched) return;

      const existing = keyByDimension.get(matched);
      if ((matched === "service" || matched === "region") && existing && !existing.startsWith("tag:")) {
        return;
      }
      if (!existing || existing.startsWith("tag:")) {
        keyByDimension.set(matched, option.key as GroupBy);
      }
    });

    return ALLOWED_GROUP_DIMENSIONS.filter((item) => keyByDimension.has(item.id)).map((item) => ({
      key: keyByDimension.get(item.id) as GroupBy,
      label: item.label,
    }));
  }, [groupOptionsQuery.data?.tagKeyOptions]);

  useEffect(() => {
    const allowed = new Set((groupOptionsQuery.data?.groupValueOptions ?? []).map((option) => option.key));
    setDraftGroupValues((current) => current.filter((value) => allowed.has(value)));
  }, [draftGroupBy, groupOptionsQuery.data?.groupValueOptions]);

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

    for (const item of series) {
      if (item.kind === "comparison") {
        const comparisonColor =
          (item.compareKey ? COMPARISON_SERIES_COLORS[item.compareKey] : undefined) ?? "#4f7088";
        map.set(item.name, comparisonColor);
        continue;
      }

      if (!map.has(item.name)) {
        map.set(item.name, colorForSeriesName(item.name));
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
  const yAxisBounds = useMemo(() => {
    if (!labels.length || !series.length) {
      return { min: -1, max: 1 };
    }

    let maxValue = Number.NEGATIVE_INFINITY;
    let minValue = Number.POSITIVE_INFINITY;

    if (chartMode === "bar") {
      const nonComparisonSeries = series.filter((item) => item.kind !== "comparison");
      for (let index = 0; index < labels.length; index += 1) {
        let bucketPositive = 0;
        let bucketNegative = 0;
        nonComparisonSeries.forEach((item) => {
          const value = Number(item.values[index] ?? 0);
          if (value >= 0) {
            bucketPositive += value;
          } else {
            bucketNegative += value;
          }
        });
        if (bucketPositive > maxValue) maxValue = bucketPositive;
        if (bucketNegative < minValue) minValue = bucketNegative;
      }

      series
        .filter((item) => item.kind === "comparison")
        .forEach((item) => {
          item.values.forEach((value) => {
            const numeric = Number(value ?? 0);
            if (numeric > maxValue) maxValue = numeric;
            if (numeric < minValue) minValue = numeric;
          });
        });
    } else {
      series.forEach((item) => {
        item.values.forEach((value) => {
          const numeric = Number(value ?? 0);
          if (numeric > maxValue) maxValue = numeric;
          if (numeric < minValue) minValue = numeric;
        });
      });
    }

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
  }, [chartMode, labels, series]);

  const option = useMemo<EChartsOption>(
    () => ({
      color: series.map((item) => seriesColorByName.get(item.name) ?? "#4f7088"),
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

          const context =
            activeGroupBy !== "none"
              ? `<div style="margin-top:6px; color:#a7bcc8;">Grouped by ${activeGroupBy}</div>`
              : "";
          return `<div style="min-width:220px;"><div style="font-weight:600; margin-bottom:4px;">${title}</div>${rows}${context}</div>`;
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
      grid: { left: 10, right: 10, top: 44, bottom: 14, containLabel: true },
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
        min: yAxisBounds.min,
        max: yAxisBounds.max,
        axisLine: { show: true, lineStyle: { color: "#d7e4df" } },
        splitLine: { lineStyle: { color: "#e1eae7", type: "dashed" } },
        axisLabel: { color: "#6d837e", fontSize: 11, formatter: (value: number) => formatAxisCost(value) },
      },
      dataZoom: labels.length > 45 ? [{ type: "inside", start: 0, end: 100 }] : undefined,
      series: series.map((item, index) => {
        const comparisonLineType = item.compareKey === "previous-month" ? "dashed" : item.compareKey === "budget" ? "dotted" : "solid";
        const isComparison = item.kind === "comparison";
        const renderAsBar = chartMode === "bar" && !isComparison;
        const seriesColor = seriesColorByName.get(item.name) ?? "#4f7088";
        return {
          name: item.name,
          type: renderAsBar ? "bar" : "line",
          stack: renderAsBar ? "cost-stack" : undefined,
          smooth: !renderAsBar,
          showSymbol: renderAsBar ? false : labels.length <= 35,
          symbolSize: 5,
          emphasis: renderAsBar
            ? {
                focus: "series",
                itemStyle: {
                  color: seriesColor,
                  opacity: 1,
                  borderColor: seriesColor,
                  borderWidth: 0,
                  shadowBlur: 10,
                  shadowColor: "rgba(15, 26, 35, 0.35)",
                },
              }
            : { focus: "series" },
          blur: { itemStyle: { opacity: 0.4 }, lineStyle: { opacity: 0.45 } },
          progressive: 5000,
          progressiveThreshold: 3000,
          universalTransition: true,
          animationDuration: renderAsBar ? 780 : 520,
          animationDurationUpdate: renderAsBar ? 560 : 380,
          animationEasing: "cubicOut",
          animationEasingUpdate: "cubicOut",
          animationDelay: (idx: number) => Math.min(index * 36 + idx * 22, 640),
          lineStyle: renderAsBar
            ? undefined
            : {
                color: seriesColor,
                width: isComparison ? 1.9 : 2.4,
                type: comparisonLineType,
                opacity: isComparison ? 0.9 : 1,
              },
          areaStyle:
            !renderAsBar && index === 0 && activeGroupBy === "none"
              ? { color: seriesColor, opacity: 0.08 }
              : undefined,
          barMinHeight: renderAsBar ? 2 : undefined,
          barWidth: renderAsBar ? "86%" : undefined,
          barMaxWidth: renderAsBar ? 80 : undefined,
          barCategoryGap: renderAsBar ? "8%" : undefined,
          barGap: renderAsBar ? "0%" : undefined,
          itemStyle: renderAsBar
            ? { color: seriesColor, borderRadius: 0, borderColor: "rgba(255,255,255,0.4)", borderWidth: 0.4 }
            : { color: seriesColor },
          data: item.values.map((value) => Number(value ?? 0)),
          z: isComparison ? 4 : 3,
        };
      }),
    }),
    [activeGroupBy, baseValues, chartMode, labels, series, seriesColorByName, seriesMeta, yAxisBounds.max, yAxisBounds.min],
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
      value:
        activeGroupBy !== "none" && activeGroupValues.length > 0
          ? `${dynamicGroupOptions.find((item) => item.key === activeGroupBy)?.label ?? "None"} (${activeGroupValues.length})`
          : (dynamicGroupOptions.find((item) => item.key === activeGroupBy)?.label ?? "None"),
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

  const serviceDetailRows = useMemo<CostExplorerServiceDetailRow[]>(
    () => (primaryQuery.data?.serviceDetails ?? []) as CostExplorerServiceDetailRow[],
    [primaryQuery.data?.serviceDetails],
  );

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
        setDraftGroupBy("none");
        setAppliedGroupBy("none");
        setDraftGroupValues([]);
        setAppliedGroupValues([]);
        setCompare([]);
      }
      return updated;
    });
  };

  const setGroupByWithMetricMode = (next: GroupBy) => {
    if (multiMetricMode && next !== "none") {
      setSelectedMetrics([selectedMetrics[0] ?? "billed"]);
    }
    if (next !== draftGroupBy) {
      setDraftGroupValues([]);
    }
    setDraftGroupBy(next);
  };

  const applyGroupFilters = () => {
    const normalizedGroupBy: GroupBy = multiMetricMode ? "none" : draftGroupBy;
    const normalizedGroupValues = normalizedGroupBy === "none" ? [] : draftGroupValues;
    setAppliedGroupBy(normalizedGroupBy);
    setAppliedGroupValues(normalizedGroupValues);
  };

  const clearAll = () => {
    setGranularity("daily");
    setDraftGroupBy("service");
    setAppliedGroupBy("service");
    setDraftGroupValues([]);
    setAppliedGroupValues([]);
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
      setDraftGroupBy("service");
      setAppliedGroupBy("service");
      setDraftGroupValues([]);
      setAppliedGroupValues([]);
      return;
    }
    if (key === "compare") {
      setCompare([]);
      return;
    }
    setSelectedMetrics(["billed"]);
  };

  const chartReady = labels.length > 0 && series.some((item) => item.values.length > 0);
  const normalizedDraftGroupBy: GroupBy = multiMetricMode ? "none" : draftGroupBy;
  const normalizedDraftGroupValues = normalizedDraftGroupBy === "none" ? [] : draftGroupValues;
  const hasPendingGroupChanges =
    normalizedDraftGroupBy !== activeGroupBy || !haveSameStringItems(normalizedDraftGroupValues, activeGroupValues);
  const groupValuesLoading = groupOptionsQuery.isFetching && normalizedDraftGroupBy !== "none";
  const isLoading = activeQueries.some((item) => item.isLoading);
  const isError = activeQueries.some((item) => item.isError);
  const firstError = activeQueries.find((item) => item.error);
  const errorMessage = (firstError?.error as Error | undefined)?.message;
  const isFetching = activeQueries.some((item) => item.isFetching);
  const hasAllActiveData = activeQueries.every((item) => Boolean(item.data));
  const isInitialDataLoading = !hasAllActiveData && (isLoading || isFetching);
  const dashboardStatus: "initializing" | "loading" | "success" | "empty" | "error" = useMemo(() => {
    if (!scope && isScopeLoading) {
      return "initializing";
    }

    if (isScopeError || !scope) {
      return "error";
    }

    if (isInitialDataLoading) {
      return "loading";
    }

    if (isError) {
      return "error";
    }

    if (!chartReady) {
      return "empty";
    }

    return "success";
  }, [scope, isScopeLoading, isScopeError, isInitialDataLoading, isError, chartReady]);
  const handleChartPointClick = useCallback(
    (params: unknown) => {
      if (!params || typeof params !== "object") {
        return;
      }

      const event = params as { seriesName?: unknown; name?: unknown };
      const clickedLabel =
        typeof event.seriesName === "string"
          ? event.seriesName.trim()
          : typeof event.name === "string"
            ? event.name.trim()
            : "";

      const normalized = clickedLabel.toLowerCase().replace(/[^a-z0-9]/g, "");
      const routeByService = new Map<string, string>([
        ["amazons3", "/dashboard/s3/cost"],
        ["s3", "/dashboard/s3/cost"],
        ["amazonec2", "/dashboard/ec2/explorer"],
        ["ec2", "/dashboard/ec2/explorer"],
        ["amazonelasticcomputecloud", "/dashboard/ec2/explorer"],
        ["elasticcomputecloud", "/dashboard/ec2/explorer"],
        ["amazonrds", "/dashboard/services/database"],
        ["rds", "/dashboard/services/database"],
        ["amazonrelationaldatabaseservice", "/dashboard/services/database"],
        ["elasticloadbalancing", "/dashboard/load-balancer/explorer"],
        ["awselasticloadbalancing", "/dashboard/load-balancer/explorer"],
        ["awselb", "/dashboard/load-balancer/explorer"],
        ["amazonelb", "/dashboard/load-balancer/explorer"],
        ["loadbalancer", "/dashboard/load-balancer/explorer"],
        ["loadbalancing", "/dashboard/load-balancer/explorer"],
      ]);

      const targetPath =
        routeByService.get(normalized) ??
        (normalized.includes("rds")
          ? "/dashboard/services/database"
          : normalized.includes("elasticloadbalancing") ||
              normalized.includes("loadbalancer") ||
              normalized.includes("elb")
            ? "/dashboard/load-balancer/explorer"
            : undefined);
      if (!targetPath) {
        return;
      }

      navigate({
        pathname: targetPath,
        search: location.search,
      });
    },
    [location.search, navigate],
  );

  if (dashboardStatus === "initializing" || dashboardStatus === "loading") {
    return (
      <div className="dashboard-page cost-explorer-page">
        <CostExplorerSkeleton />
      </div>
    );
  }

  if (dashboardStatus === "error") {
    return (
      <div className="dashboard-page cost-explorer-page">
        <section className="overview-state-card" role="alert">
          <h2 className="overview-state-card__title">Unable to load Cost Explorer</h2>
          <p className="overview-state-card__message">
            {scopeError?.message ?? errorMessage ?? "An unexpected error occurred while loading cost explorer data."}
          </p>
        </section>
      </div>
    );
  }

  if (dashboardStatus === "empty") {
    return (
      <div className="dashboard-page cost-explorer-page">
        <section className="overview-state-card">
          <h2 className="overview-state-card__title">No cost data for this filter context</h2>
          <p className="overview-state-card__message">Try expanding the date range or reducing comparison layers.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard-page cost-explorer-page">
      <section className="cost-explorer-filter-card">
        <CostExplorerFiltersPanel
          effectiveGranularity={effectiveGranularity}
          days={days}
          groupBy={draftGroupBy}
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
          groupValueOptions={groupOptionsQuery.data?.groupValueOptions ?? []}
          selectedGroupValues={draftGroupValues}
          onToggleGroupValue={(value) =>
            setDraftGroupValues((current) =>
              current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
            )
          }
          onClearGroupValues={() => setDraftGroupValues([])}
          onApplyGroupFilters={applyGroupFilters}
          hasPendingGroupChanges={hasPendingGroupChanges}
          groupValuesLoading={groupValuesLoading}
        />
      </section>

      <CostExplorerKpiSection kpis={chartKpis} />

      <CostExplorerChartOnlySection
        option={option}
        isLoading={false}
        isError={false}
        errorMessage={errorMessage}
        isFetching={false}
        showApplySkeleton={false}
        chartReady
        onPointClick={handleChartPointClick}
        chartMode={chartMode}
        onChartModeChange={setChartMode}
        onRetry={() => {
          activeQueries.forEach((query) => {
            void query.refetch();
          });
        }}
        onReset={clearAll}
      />

      <CostExplorerBreakdownSection
        isLoading={false}
        isError={false}
        errorMessage={errorMessage}
        chartReady
        topBreakdowns={visibleBreakdowns}
        serviceDetailRows={serviceDetailRows}
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
    </div>
  );
}

