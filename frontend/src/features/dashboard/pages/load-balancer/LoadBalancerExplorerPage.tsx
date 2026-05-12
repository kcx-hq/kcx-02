import { X } from "lucide-react";
import type { EChartsOption } from "echarts";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BaseEChart } from "../../common/charts/BaseEChart";
import { EmptyStateBlock } from "../../common/components/EmptyStateBlock";
import { EC2ExplorerChart } from "../ec2/components/EC2ExplorerChart";
import { EC2ExplorerTable } from "../ec2/components/EC2ExplorerTable";
import {
  useLoadBalancerExplorerGroupByQuery,
  useLoadBalancerExplorerSummaryQuery,
  useLoadBalancerExplorerTrendQuery,
} from "../../hooks/useDashboardQueries";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import type { LoadBalancerExplorerFiltersQuery } from "../../api/dashboardApi";
import {
  LOAD_BALANCER_DEFAULT_CONTROLS,
  LOAD_BALANCER_GROUP_BY_OPTIONS,
  LOAD_BALANCER_METRIC_OPTIONS,
  LOAD_BALANCER_USAGE_TYPE_OPTIONS,
  getValidLoadBalancerGroupByForMetric,
  type LoadBalancerExplorerControlsState,
  type LoadBalancerMetric,
} from "./loadBalancerExplorer.types";
import { LoadBalancerExplorerTopControls } from "./components/LoadBalancerExplorerTopControls";
import { LoadBalancerSummaryCards } from "./components/LoadBalancerSummaryCards";

const LIST_PATH = "/dashboard/inventory/aws/load-balancer/list";

const parseGroupByQueryValue = (
  value: string | null,
  metric: LoadBalancerMetric,
): LoadBalancerExplorerControlsState["groupBy"] => {
  const valid = new Set(LOAD_BALANCER_GROUP_BY_OPTIONS.map((entry) => entry.key));
  const fallback = getValidLoadBalancerGroupByForMetric(metric, LOAD_BALANCER_DEFAULT_CONTROLS.groupBy);
  if (value === "load-balancer") return "load_balancer";
  if (value === "none") return getValidLoadBalancerGroupByForMetric(metric, "cost_type");
  if (value && valid.has(value as LoadBalancerExplorerControlsState["groupBy"])) {
    return getValidLoadBalancerGroupByForMetric(metric, value as LoadBalancerExplorerControlsState["groupBy"]);
  }
  return fallback;
};

const parseMetricQueryValue = (value: string | null): LoadBalancerExplorerControlsState["metric"] => {
  if (value === "usage") return "usage";
  return value === "load_balancers" ? "load_balancers" : "cost";
};

const parseUsageTypeQueryValue = (value: string | null): LoadBalancerExplorerControlsState["usageType"] => {
  const valid = new Set(LOAD_BALANCER_USAGE_TYPE_OPTIONS.map((option) => option.key));
  if (value && valid.has(value as LoadBalancerExplorerControlsState["usageType"])) {
    return value as LoadBalancerExplorerControlsState["usageType"];
  }
  return LOAD_BALANCER_DEFAULT_CONTROLS.usageType;
};

const summaryFallback = {
  totalCost: 0,
  fixedCost: 0,
  lcuCost: 0,
  dataProcessingCost: 0,
  previousCost: 0,
  trendPercent: 0,
  loadBalancerCount: 0,
  totalLoadBalancers: 0,
  albCount: 0,
  nlbCount: 0,
  activeLoadBalancerCount: 0,
  internetFacingCount: 0,
  internalCount: 0,
  totalProcessedBytesGb: 0,
  avgDailyCost: 0,
};

type ExplorerSeriesPoint = {
  date: string;
  value: number;
  group?: string;
  loadBalancerCount?: number;
  requestCount?: number;
  processedGB?: number;
  activeConnections?: number;
  newConnections?: number;
  healthyHosts?: number;
  unhealthyHosts?: number;
  errorCount?: number;
};

type ExplorerSeries = {
  key: string;
  label: string;
  data: ExplorerSeriesPoint[];
};

type ExplorerGraph = {
  type: "bar" | "stacked_bar" | "line" | "area" | "stacked_area";
  xKey: "date";
  series: ExplorerSeries[];
};

type ExplorerTable = {
  columns: Array<{ key: string; label: string }>;
  rows: Array<{ id: string; [key: string]: string | number | null }>;
};

type UsageGroupStats = {
  average: number;
  peak: number;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const toStringValue = (value: unknown): string => (typeof value === "string" ? value : "");

const normalizeTrendGraph = (
  rawGraph: unknown,
  chartType: LoadBalancerExplorerControlsState["chartType"],
  metric: LoadBalancerExplorerControlsState["metric"],
  usageType: LoadBalancerExplorerControlsState["usageType"],
): ExplorerGraph => {
  const fallback: ExplorerGraph = { type: chartType, xKey: "date", series: [] };
  const graph = rawGraph as { series?: unknown[] } | undefined;
  if (!graph || !Array.isArray(graph.series)) return fallback;

  const normalized = graph.series
    .map((series): ExplorerSeries | null => {
      const raw = series as { key?: unknown; label?: unknown; data?: unknown[] };
      if (!Array.isArray(raw.data)) return null;
      const points = raw.data
        .map((point): ExplorerSeriesPoint | null => {
          const item = point as Record<string, unknown>;
          const date = toStringValue(item.date);
          if (!date) return null;
          const loadBalancerCount = toNumber(item.loadBalancerCount ?? item.load_balancer_count);
          const requestCount = toNumber(item.requestCount ?? item.request_count);
          const processedGB = toNumber(item.processedGB ?? item.processed_gb);
          const activeConnections = toNumber(item.activeConnections ?? item.active_connections);
          const newConnections = toNumber(item.newConnections ?? item.new_connections);
          const healthyHosts = toNumber(item.healthyHosts ?? item.healthy_hosts);
          const unhealthyHosts = toNumber(item.unhealthyHosts ?? item.unhealthy_hosts);
          const errorCount = toNumber(item.errorCount ?? item.error_count);
          const usageValue = usageType === "processed_gb"
            ? processedGB
            : usageType === "active_connections"
              ? activeConnections
              : usageType === "new_connections"
                ? newConnections
                : usageType === "healthy_hosts"
                  ? healthyHosts
                  : usageType === "unhealthy_hosts"
                    ? unhealthyHosts
                    : usageType === "errors"
                      ? errorCount
                      : requestCount;
          return {
            date,
            value: metric === "usage" ? usageValue : toNumber(item.value),
            group: toStringValue(item.group),
            loadBalancerCount,
            requestCount,
            processedGB,
            activeConnections,
            newConnections,
            healthyHosts,
            unhealthyHosts,
            errorCount,
          };
        })
        .filter((point): point is ExplorerSeriesPoint => point !== null);
      return {
        key: toStringValue(raw.key),
        label: toStringValue(raw.label),
        data: points,
      };
    })
    .filter((series): series is ExplorerSeries => Boolean(series));

  if (metric !== "cost") {
    return {
      type: chartType,
      xKey: "date",
      series: normalized,
    };
  }

  const componentKeys = new Set(["fixed", "lcu", "data_processing", "fixed_cost", "lcu_cost", "data_processing_cost"]);
  const componentSeries = normalized.filter((series) => componentKeys.has(series.key));

  return {
    type: chartType,
    xKey: "date",
    series: componentSeries.length > 0 ? componentSeries : normalized,
  };
};

const usageAxisLabel = (usageType: LoadBalancerExplorerControlsState["usageType"]): string => {
  if (usageType === "processed_gb") return "GB";
  if (usageType === "active_connections" || usageType === "new_connections") return "Connections";
  if (usageType === "healthy_hosts" || usageType === "unhealthy_hosts") return "Hosts";
  if (usageType === "errors") return "Errors";
  return "Requests";
};

const usageTableConfig = (usageType: LoadBalancerExplorerControlsState["usageType"]): {
  totalKey: string;
  totalLabel: string;
  avgKey: string;
  avgLabel: string;
  peakKey: string;
  peakLabel: string;
} => {
  if (usageType === "processed_gb") {
    return {
      totalKey: "processedGB",
      totalLabel: "Processed GB",
      avgKey: "avgProcessedGB",
      avgLabel: "Avg GB",
      peakKey: "peakProcessedGB",
      peakLabel: "Peak GB",
    };
  }
  if (usageType === "active_connections") {
    return {
      totalKey: "activeConnections",
      totalLabel: "Active Connections",
      avgKey: "avgActiveConnections",
      avgLabel: "Avg Active Connections",
      peakKey: "peakActiveConnections",
      peakLabel: "Peak Active Connections",
    };
  }
  if (usageType === "new_connections") {
    return {
      totalKey: "newConnections",
      totalLabel: "New Connections",
      avgKey: "avgNewConnections",
      avgLabel: "Avg New Connections",
      peakKey: "peakNewConnections",
      peakLabel: "Peak New Connections",
    };
  }
  if (usageType === "healthy_hosts") {
    return {
      totalKey: "healthyHosts",
      totalLabel: "Healthy Hosts",
      avgKey: "avgHealthyHosts",
      avgLabel: "Avg Healthy Hosts",
      peakKey: "peakHealthyHosts",
      peakLabel: "Peak Healthy Hosts",
    };
  }
  if (usageType === "unhealthy_hosts") {
    return {
      totalKey: "unhealthyHosts",
      totalLabel: "Unhealthy Hosts",
      avgKey: "avgUnhealthyHosts",
      avgLabel: "Avg Unhealthy Hosts",
      peakKey: "peakUnhealthyHosts",
      peakLabel: "Peak Unhealthy Hosts",
    };
  }
  if (usageType === "errors") {
    return {
      totalKey: "errorCount",
      totalLabel: "Errors",
      avgKey: "avgErrors",
      avgLabel: "Avg Errors",
      peakKey: "peakErrors",
      peakLabel: "Peak Errors",
    };
  }
  return {
    totalKey: "requestCount",
    totalLabel: "Requests",
    avgKey: "avgRequests",
    avgLabel: "Avg Requests",
    peakKey: "peakRequests",
    peakLabel: "Peak Requests",
  };
};

const toReadableGroup = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "Unspecified";
  if (trimmed.startsWith("arn:")) {
    const arnPart = trimmed.split("/").pop();
    return arnPart && arnPart.trim().length > 0 ? arnPart : trimmed;
  }
  return trimmed;
};

const normalizeGroupByTable = (
  rawTable: unknown,
  metric: LoadBalancerExplorerControlsState["metric"],
  usageType: LoadBalancerExplorerControlsState["usageType"],
  usageStatsByGroup: Map<string, UsageGroupStats>,
): ExplorerTable | null => {
  const table = rawTable as { columns?: unknown[]; rows?: unknown[] } | undefined;
  if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows)) return null;
  const rawColumns = table.columns
    .map((column) => {
      const item = column as { key?: unknown; label?: unknown };
      const key = toStringValue(item.key);
      const label = toStringValue(item.label);
      if (!key || !label) return null;
      return { key, label };
    })
    .filter((column): column is { key: string; label: string } => column !== null);
  const normalizedRows = table.rows.map((row, index) => {
    const item = (row ?? {}) as Record<string, unknown>;
    const groupRaw = item.group;
    const group = typeof groupRaw === "string" ? toReadableGroup(groupRaw) : groupRaw;
    return {
      id: toStringValue(item.id) || `row-${index}`,
      ...item,
      group: typeof group === "string" ? group : String(group ?? "Unspecified"),
      totalCost: toNumber(item.totalCost ?? item.total_cost),
      fixedCost: toNumber(item.fixedCost ?? item.fixed_cost),
      lcuCost: toNumber(item.lcuCost ?? item.lcu_cost),
      dataProcessingCost: toNumber(item.dataProcessingCost ?? item.data_processing_cost),
      loadBalancerCount: toNumber(item.loadBalancerCount ?? item.load_balancer_count),
      avgCost: toNumber(item.avgCost ?? item.avg_cost),
      requestCount: toNumber(item.requestCount ?? item.request_count),
      processedGB: toNumber(item.processedGB ?? item.processed_gb),
      activeConnections: toNumber(item.activeConnections ?? item.active_connections),
      newConnections: toNumber(item.newConnections ?? item.new_connections),
      healthyHosts: toNumber(item.healthyHosts ?? item.healthy_hosts),
      unhealthyHosts: toNumber(item.unhealthyHosts ?? item.unhealthy_hosts),
      errorCount: toNumber(item.errorCount ?? item.error_count),
    } as { id: string; [key: string]: string | number | null };
  });

  if (metric === "usage") {
    const usageConfig = usageTableConfig(usageType);
    const usageColumns: Array<{ key: string; label: string }> = [
      { key: "group", label: "Group" },
      { key: usageConfig.totalKey, label: usageConfig.totalLabel },
      { key: usageConfig.avgKey, label: usageConfig.avgLabel },
      { key: usageConfig.peakKey, label: usageConfig.peakLabel },
    ];

    const rows = normalizedRows.map((row) => ({
      id: row.id,
      group: row.group,
      [usageConfig.totalKey]: toNumber(row[usageConfig.totalKey]),
      [usageConfig.avgKey]: usageStatsByGroup.get(String(row.group ?? ""))?.average ?? 0,
      [usageConfig.peakKey]: usageStatsByGroup.get(String(row.group ?? ""))?.peak ?? 0,
    }));

    return { columns: usageColumns, rows };
  }

  return { columns: rawColumns, rows: normalizedRows };
};

const COUNT_TREND_COLORS = ["#2f8f88", "#3f68c6", "#c27d2f", "#8a66cf", "#da6f40", "#557a43", "#9f5f80"];

const buildLoadBalancerCountTrendOption = (graph: ExplorerGraph): EChartsOption => {
  const dates = [
    ...new Set(graph.series.flatMap((series) => series.data.map((point) => point.date))),
  ].sort();
  const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  return {
    color: COUNT_TREND_COLORS,
    tooltip: {
      trigger: "axis",
      valueFormatter: (value) => numberFormatter.format(Number(value ?? 0)),
    },
    legend: graph.series.length > 1
      ? {
          show: true,
          type: "scroll",
          orient: "horizontal",
          top: 2,
          left: "center",
          itemWidth: 12,
          itemHeight: 8,
          textStyle: { fontSize: 11, overflow: "truncate", width: 170 },
        }
      : { show: false },
    grid: {
      left: 64,
      right: 16,
      top: graph.series.length > 1 ? 58 : 24,
      bottom: 48,
      containLabel: false,
    },
    xAxis: {
      type: "category",
      data: dates,
      axisLabel: { hideOverlap: true, fontSize: 11 },
    },
    yAxis: {
      type: "value",
      name: "Load Balancers",
      minInterval: 1,
      axisLabel: { fontSize: 11, margin: 10, formatter: (value: number) => numberFormatter.format(value) },
    },
    series: graph.series.map((series) => {
      const valuesByDate = new Map(series.data.map((point) => [point.date, point.loadBalancerCount ?? point.value]));
      return {
        name: series.label,
        type: "bar",
        stack: graph.series.length > 1 ? "load-balancers" : undefined,
        barMaxWidth: 46,
        data: dates.map((date) => toNumber(valuesByDate.get(date))),
      };
    }),
  };
};

export default function LoadBalancerExplorerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { scope } = useDashboardScope();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const initialControls = useMemo<LoadBalancerExplorerControlsState>(
    () => {
      const metric = parseMetricQueryValue(queryParams.get("metric"));
      return {
        ...LOAD_BALANCER_DEFAULT_CONTROLS,
        metric,
        usageType: parseUsageTypeQueryValue(queryParams.get("usageType")),
        groupBy: parseGroupByQueryValue(queryParams.get("groupBy"), metric),
      };
    },
    [queryParams],
  );
  const [controls, setControls] = useState<LoadBalancerExplorerControlsState>(initialControls);

  const startDate =
    scope?.from ??
    queryParams.get("from") ??
    queryParams.get("billingPeriodStart") ??
    queryParams.get("startDate") ??
    undefined;
  const endDate =
    scope?.to ??
    queryParams.get("to") ??
    queryParams.get("billingPeriodEnd") ??
    queryParams.get("endDate") ??
    undefined;

  const navigateToLoadBalancerList = (input: {
    source: "explorer-chart" | "explorer-table";
    groupValue: string;
    date?: string | null;
  }) => {
    const groupValueRaw = input.groupValue.trim();
    if (!groupValueRaw) return;
    const groupValue = groupValueRaw.toLowerCase() === "total" ? "" : groupValueRaw;

    const next = new URLSearchParams(location.search);
    if (startDate) next.set("startDate", startDate);
    if (endDate) next.set("endDate", endDate);
    next.set("source", input.source);
    next.set("metric", controls.metric);
    next.set("groupBy", controls.groupBy);
    if (controls.metric === "usage") next.set("usageType", controls.usageType);
    else next.delete("usageType");
    if (input.date) next.set("selectedDate", input.date);
    else next.delete("selectedDate");

    ["search", "loadBalancerId", "loadBalancerArn", "account", "region", "type", "scheme", "state", "tags", "tag"].forEach((key) =>
      next.delete(key),
    );

    if (controls.groupBy === "account" && groupValue) next.set("account", groupValue);
    if (controls.groupBy === "region" && groupValue) next.set("region", groupValue);
    if (controls.groupBy === "type" && groupValue) next.set("type", groupValue);
    if (controls.groupBy === "scheme" && groupValue) next.set("scheme", groupValue);
    if (controls.groupBy === "state" && groupValue) next.set("state", groupValue);
    if (controls.groupBy === "tag" && groupValue) {
      const tagKey = controls.tagKey.trim() || "owner";
      next.set("tag", `${tagKey}:${groupValue}`);
    }

    if (controls.groupBy === "load_balancer" && groupValue) {
      if (groupValue.startsWith("arn:")) {
        next.set("loadBalancerName", groupValue);
        navigate({ pathname: `${LIST_PATH}/${encodeURIComponent(groupValue)}`, search: next.toString() });
        return;
      }
      if (groupValue.includes("/")) {
        next.set("loadBalancerId", groupValue);
      } else {
        next.set("search", groupValue);
      }
      navigate({ pathname: LIST_PATH, search: next.toString() });
      return;
    }

    if (controls.groupBy === "cost_type" || controls.groupBy === "none") {
      navigate({ pathname: LIST_PATH, search: next.toString() });
      return;
    }

    navigate({ pathname: LIST_PATH, search: next.toString() });
  };

  const filters = useMemo<LoadBalancerExplorerFiltersQuery>(
    () => ({
      startDate,
      endDate,
      metric: controls.metric,
      usageType: controls.usageType,
      granularity: controls.granularity,
      groupBy: controls.groupBy,
      tagKey: controls.groupBy === "tag" ? controls.tagKey.trim() || "owner" : null,
      accountId: controls.scopeFilters.account[0] ?? null,
      regions: controls.scopeFilters.region,
      types: controls.scopeFilters.type,
      schemes: controls.scopeFilters.scheme,
      states: controls.scopeFilters.state,
      tags: controls.scopeFilters.tags,
      groupValues: controls.groupByValues,
    }),
    [controls, endDate, startDate],
  );

  const summaryQuery = useLoadBalancerExplorerSummaryQuery(filters, Boolean(scope));
  const trendQuery = useLoadBalancerExplorerTrendQuery(filters, Boolean(scope));
  const groupByQuery = useLoadBalancerExplorerGroupByQuery(filters, Boolean(scope));
  const resolvedGraphType = controls.chartType;
  const loadBalancerCountChartTitle = `Load Balancers by ${
    LOAD_BALANCER_GROUP_BY_OPTIONS.find((entry) => entry.key === controls.groupBy)?.label ?? "Group"
  }`;
  const chartGraph = useMemo(
    () => normalizeTrendGraph(trendQuery.data?.graph, resolvedGraphType, controls.metric, controls.usageType),
    [controls.metric, controls.usageType, resolvedGraphType, trendQuery.data?.graph],
  );
  const usageStatsByGroup = useMemo(() => {
    const stats = new Map<string, UsageGroupStats>();
    if (controls.metric !== "usage") return stats;
    for (const series of chartGraph.series) {
      const values = series.data.map((point) => toNumber(point.value));
      const sum = values.reduce((acc, value) => acc + value, 0);
      const average = values.length > 0 ? sum / values.length : 0;
      const peak = values.length > 0 ? Math.max(...values) : 0;
      stats.set(series.label, { average, peak });
    }
    return stats;
  }, [chartGraph.series, controls.metric]);
  const groupByTable = useMemo(
    () => normalizeGroupByTable(groupByQuery.data?.table, controls.metric, controls.usageType, usageStatsByGroup),
    [controls.metric, controls.usageType, groupByQuery.data?.table, usageStatsByGroup],
  );
  const countChartGraph = useMemo<ExplorerGraph>(
    () => ({
      ...normalizeTrendGraph(trendQuery.data?.graph, "stacked_bar", controls.metric, controls.usageType),
      type: "stacked_bar",
    }),
    [controls.metric, controls.usageType, trendQuery.data?.graph],
  );
  const loadBalancerCountTrendOption = useMemo(() => buildLoadBalancerCountTrendOption(countChartGraph), [countChartGraph]);
  const hasLoadBalancerCountTrendData = countChartGraph.series.some((series) => series.data.length > 0);
  const usageDailyStats = useMemo(() => {
    if (controls.metric !== "usage") {
      return { averagePerDay: 0, peakPerDay: 0 };
    }
    const totalsByDate = new Map<string, number>();
    for (const series of chartGraph.series) {
      for (const point of series.data) {
        totalsByDate.set(point.date, (totalsByDate.get(point.date) ?? 0) + toNumber(point.value));
      }
    }
    if (totalsByDate.size === 0) {
      return { averagePerDay: 0, peakPerDay: 0 };
    }
    const values = [...totalsByDate.values()];
    const sum = values.reduce((acc, value) => acc + value, 0);
    const peakPerDay = Math.max(...values);
    return {
      averagePerDay: values.length > 0 ? sum / values.length : 0,
      peakPerDay,
    };
  }, [chartGraph.series, controls.metric]);

  const chips = useMemo(() => {
    const list: Array<{ id: string; label: string; value: string; onRemove: () => void }> = [
      {
        id: "metric",
        label: "Metric",
        value: LOAD_BALANCER_METRIC_OPTIONS.find((entry) => entry.key === controls.metric)?.label ?? "Cost",
        onRemove: () =>
          setControls((current) => ({
            ...current,
            metric: LOAD_BALANCER_DEFAULT_CONTROLS.metric,
            groupBy: getValidLoadBalancerGroupByForMetric(LOAD_BALANCER_DEFAULT_CONTROLS.metric, current.groupBy),
            groupByValues: [],
          })),
      },
      {
        id: "groupBy",
        label: "Group By",
        value: LOAD_BALANCER_GROUP_BY_OPTIONS.find((entry) => entry.key === controls.groupBy)?.label ?? "Group",
        onRemove: () =>
          setControls((current) => ({
            ...current,
            groupBy: getValidLoadBalancerGroupByForMetric(current.metric, LOAD_BALANCER_DEFAULT_CONTROLS.groupBy),
            groupByValues: [],
          })),
      },
    ];

    const addChip = (
      id: string,
      label: string,
      value: string[],
      onRemove: () => void,
    ) => {
      if (value.length === 0) return;
      list.push({
        id,
        label,
        value: `${value.length} selected`,
        onRemove,
      });
    };

    addChip("account", "Account", controls.scopeFilters.account, () =>
      setControls((current) => ({ ...current, scopeFilters: { ...current.scopeFilters, account: [] } })),
    );
    addChip("region", "Region", controls.scopeFilters.region, () =>
      setControls((current) => ({ ...current, scopeFilters: { ...current.scopeFilters, region: [] } })),
    );
    addChip("type", "Type", controls.scopeFilters.type, () =>
      setControls((current) => ({ ...current, scopeFilters: { ...current.scopeFilters, type: [] } })),
    );
    addChip("scheme", "Scheme", controls.scopeFilters.scheme, () =>
      setControls((current) => ({ ...current, scopeFilters: { ...current.scopeFilters, scheme: [] } })),
    );
    addChip("state", "State", controls.scopeFilters.state, () =>
      setControls((current) => ({ ...current, scopeFilters: { ...current.scopeFilters, state: [] } })),
    );
    addChip("tags", "Tags", controls.scopeFilters.tags, () =>
      setControls((current) => ({ ...current, scopeFilters: { ...current.scopeFilters, tags: [] } })),
    );
    if (controls.metric === "usage") {
      list.splice(1, 0, {
        id: "usageType",
        label: "Usage Type",
        value: LOAD_BALANCER_USAGE_TYPE_OPTIONS.find((entry) => entry.key === controls.usageType)?.label ?? "Requests",
        onRemove: () =>
          setControls((current) => ({
            ...current,
            usageType: LOAD_BALANCER_DEFAULT_CONTROLS.usageType,
          })),
      });
    }
    return list;
  }, [controls]);
  return (
    <div className="dashboard-page cost-explorer-page">
      <section className="ec2-explorer-head-stack" aria-label="Load balancer explorer controls and summary">
        <LoadBalancerExplorerTopControls
          value={controls}
          onChange={setControls}
          onReset={() => setControls(LOAD_BALANCER_DEFAULT_CONTROLS)}
        >
          <div className="cost-explorer-chip-bar" aria-label="Selected filter summary">
            <div className="cost-explorer-chip-row">
              {chips.map((chip) => (
                <span key={chip.id} className="cost-explorer-chip">
                  <span className="cost-explorer-chip__edit">
                    {chip.label}: {chip.value}
                  </span>
                  <button type="button" className="cost-explorer-chip__remove" onClick={chip.onRemove} aria-label={`Remove ${chip.label}`}>
                    <X size={13} aria-hidden="true" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline"
                onClick={() => setControls(LOAD_BALANCER_DEFAULT_CONTROLS)}
              >
                Clear all
              </button>
            </div>
          </div>
        </LoadBalancerExplorerTopControls>

        <LoadBalancerSummaryCards
          metric={controls.metric}
          usageType={controls.usageType}
          summary={summaryQuery.data?.summary ?? summaryFallback}
          usageDailyStats={usageDailyStats}
          loading={summaryQuery.isLoading || (controls.metric === "usage" && trendQuery.isLoading)}
        />
      </section>

      <section className="ec2-explorer-chart-panel" aria-label="Load balancer explorer chart">
        {controls.metric === "cost" ? (
          <EC2ExplorerChart
            title="Cost Trend"
            chartType={resolvedGraphType}
            canUseStackedBar
            onChartTypeChange={(nextChartType) => setControls((current) => ({ ...current, chartType: nextChartType }))}
            graph={chartGraph}
            loading={trendQuery.isLoading}
            error={trendQuery.isError ? trendQuery.error : null}
            onRetry={() => {
              void trendQuery.refetch();
            }}
            onPointClick={({ date, seriesKey, seriesLabel }) => {
              const groupValue = (seriesLabel ?? seriesKey ?? "").trim();
              if (!groupValue) return;
              navigateToLoadBalancerList({ source: "explorer-chart", groupValue, date });
            }}
          />
        ) : controls.metric === "usage" ? (
          <EC2ExplorerChart
            title="Usage Trend"
            chartType={resolvedGraphType}
            canUseStackedBar
            yAxisLabel={usageAxisLabel(controls.usageType)}
            onChartTypeChange={(nextChartType) => setControls((current) => ({ ...current, chartType: nextChartType }))}
            graph={chartGraph}
            loading={trendQuery.isLoading}
            error={trendQuery.isError ? trendQuery.error : null}
            onRetry={() => {
              void trendQuery.refetch();
            }}
            onPointClick={({ date, seriesKey, seriesLabel }) => {
              const groupValue = (seriesLabel ?? seriesKey ?? "").trim();
              if (!groupValue) return;
              navigateToLoadBalancerList({ source: "explorer-chart", groupValue, date });
            }}
          />
        ) : trendQuery.isLoading ? (
          <div className="ec2-explorer-chart__skeleton" aria-hidden="true" />
        ) : trendQuery.isError ? (
          <EmptyStateBlock
            title="Unable to load load balancer chart"
            message={trendQuery.error.message || "An unexpected error occurred."}
            actions={
              <button type="button" className="cost-explorer-state-btn" onClick={() => void trendQuery.refetch()}>
                Retry
              </button>
            }
          />
        ) : hasLoadBalancerCountTrendData ? (
          <section className="ec2-explorer-chart" aria-label="Load balancer count chart">
            <div className="ec2-explorer-chart__header">
              <h3 className="ec2-explorer-chart__title">{loadBalancerCountChartTitle}</h3>
            </div>
            <BaseEChart
              option={loadBalancerCountTrendOption}
              height={410}
              onPointClick={(event) => {
                const point = event as { seriesName?: string; name?: string };
                const groupValue = String(point.seriesName ?? "").trim();
                if (!groupValue) return;
                navigateToLoadBalancerList({
                  source: "explorer-chart",
                  groupValue,
                  date: typeof point.name === "string" ? point.name : null,
                });
              }}
            />
          </section>
        ) : (
          <EmptyStateBlock
            title="No data found"
            message="No load balancer groups found for current filters. Try removing filters."
          />
        )}
      </section>

      <section className="ec2-explorer-table-panel" aria-label="Load balancer explorer group-by table">
        <EC2ExplorerTable
          metric={controls.metric === "usage" ? "usage" : controls.metric === "cost" ? "cost" : "instances"}
          groupBy={controls.groupBy}
          loading={groupByQuery.isLoading}
          error={groupByQuery.isError ? groupByQuery.error : null}
          table={groupByTable}
          onRetry={() => {
            void groupByQuery.refetch();
          }}
          onRowClick={(row) => {
            const groupValue =
              controls.groupBy === "none"
                ? String(row.loadBalancer ?? row.load_balancer ?? row.group ?? row.id ?? "")
                : String(row.group ?? row.id ?? "");
            if (!groupValue.trim()) return;
            navigateToLoadBalancerList({ source: "explorer-table", groupValue });
          }}
        />
      </section>
    </div>
  );
}
