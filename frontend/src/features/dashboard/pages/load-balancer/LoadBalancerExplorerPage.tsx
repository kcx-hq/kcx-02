import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
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
  type LoadBalancerExplorerControlsState,
} from "./loadBalancerExplorer.types";
import { LoadBalancerExplorerTopControls } from "./components/LoadBalancerExplorerTopControls";
import { LoadBalancerSummaryCards } from "./components/LoadBalancerSummaryCards";

const parseGroupByQueryValue = (value: string | null): LoadBalancerExplorerControlsState["groupBy"] => {
  const valid = new Set(LOAD_BALANCER_GROUP_BY_OPTIONS.map((entry) => entry.key));
  if (value === "load-balancer") return "load_balancer";
  if (value === "none") return "cost_type";
  if (value && valid.has(value as LoadBalancerExplorerControlsState["groupBy"])) {
    return value as LoadBalancerExplorerControlsState["groupBy"];
  }
  return LOAD_BALANCER_DEFAULT_CONTROLS.groupBy;
};

const parseMetricQueryValue = (value: string | null): LoadBalancerExplorerControlsState["metric"] => {
  return value === "load_balancers" ? "load_balancers" : "cost";
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
): ExplorerGraph => {
  const fallback: ExplorerGraph = { type: chartType, xKey: "date", series: [] };
  const graph = rawGraph as { series?: unknown[] } | undefined;
  if (!graph || !Array.isArray(graph.series)) return fallback;

  const normalized = graph.series
    .map((series) => {
      const raw = series as { key?: unknown; label?: unknown; data?: unknown[] };
      if (!Array.isArray(raw.data)) return null;
      const points = raw.data
        .map((point) => {
          const item = point as Record<string, unknown>;
          const date = toStringValue(item.date);
          if (!date) return null;
          return { date, value: toNumber(item.value) };
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

const toReadableGroup = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "Unspecified";
  if (trimmed.startsWith("arn:")) {
    const arnPart = trimmed.split("/").pop();
    return arnPart && arnPart.trim().length > 0 ? arnPart : trimmed;
  }
  return trimmed;
};

const normalizeGroupByTable = (rawTable: unknown): ExplorerTable | null => {
  const table = rawTable as { columns?: unknown[]; rows?: unknown[] } | undefined;
  if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows)) return null;
  const columns = table.columns
    .map((column) => {
      const item = column as { key?: unknown; label?: unknown };
      const key = toStringValue(item.key);
      const label = toStringValue(item.label);
      if (!key || !label) return null;
      return { key, label };
    })
    .filter((column): column is { key: string; label: string } => column !== null);
  const rows = table.rows.map((row, index) => {
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
    } as { id: string; [key: string]: string | number | null };
  });
  return { columns, rows };
};

export default function LoadBalancerExplorerPage() {
  const location = useLocation();
  const { scope } = useDashboardScope();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const initialControls = useMemo<LoadBalancerExplorerControlsState>(
    () => ({
      ...LOAD_BALANCER_DEFAULT_CONTROLS,
      metric: parseMetricQueryValue(queryParams.get("metric")),
      groupBy: parseGroupByQueryValue(queryParams.get("groupBy")),
    }),
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

  const filters = useMemo<LoadBalancerExplorerFiltersQuery>(
    () => ({
      startDate,
      endDate,
      metric: controls.metric,
      granularity: controls.granularity,
      groupBy: controls.groupBy,
      tagKey: controls.groupBy === "tag" ? controls.tagKey.trim() || "owner" : null,
      accountId: controls.scopeFilters.account[0] ?? null,
      regions: controls.scopeFilters.region,
      types: controls.scopeFilters.type,
      schemes: controls.scopeFilters.scheme,
      states: controls.scopeFilters.state,
      teams: controls.scopeFilters.team,
      products: controls.scopeFilters.product,
      environments: controls.scopeFilters.environment,
      tags: controls.scopeFilters.tags,
      groupValues: controls.groupByValues,
    }),
    [controls, endDate, startDate],
  );

  const summaryQuery = useLoadBalancerExplorerSummaryQuery(filters, Boolean(scope));
  const trendQuery = useLoadBalancerExplorerTrendQuery(filters, Boolean(scope));
  const groupByQuery = useLoadBalancerExplorerGroupByQuery(filters, Boolean(scope));
  const resolvedGraphType = controls.chartType;
  const groupByTable = useMemo(() => normalizeGroupByTable(groupByQuery.data?.table), [groupByQuery.data?.table]);
  const chartGraph = useMemo(
    () => normalizeTrendGraph(trendQuery.data?.graph, resolvedGraphType, controls.metric),
    [controls.metric, resolvedGraphType, trendQuery.data?.graph],
  );

  const chips = useMemo(() => {
    const list: Array<{ id: string; label: string; value: string; onRemove: () => void }> = [
      {
        id: "metric",
        label: "Metric",
        value: LOAD_BALANCER_METRIC_OPTIONS.find((entry) => entry.key === controls.metric)?.label ?? "Cost",
        onRemove: () => setControls((current) => ({ ...current, metric: LOAD_BALANCER_DEFAULT_CONTROLS.metric })),
      },
      {
        id: "groupBy",
        label: "Group By",
        value: LOAD_BALANCER_GROUP_BY_OPTIONS.find((entry) => entry.key === controls.groupBy)?.label ?? "Account",
        onRemove: () =>
          setControls((current) => ({
            ...current,
            groupBy: LOAD_BALANCER_DEFAULT_CONTROLS.groupBy,
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
    addChip("team", "Team", controls.scopeFilters.team, () =>
      setControls((current) => ({ ...current, scopeFilters: { ...current.scopeFilters, team: [] } })),
    );
    addChip("product", "Product", controls.scopeFilters.product, () =>
      setControls((current) => ({ ...current, scopeFilters: { ...current.scopeFilters, product: [] } })),
    );
    addChip("environment", "Environment", controls.scopeFilters.environment, () =>
      setControls((current) => ({ ...current, scopeFilters: { ...current.scopeFilters, environment: [] } })),
    );
    addChip("tags", "Tags", controls.scopeFilters.tags, () =>
      setControls((current) => ({ ...current, scopeFilters: { ...current.scopeFilters, tags: [] } })),
    );
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
          summary={summaryQuery.data?.summary ?? summaryFallback}
          loading={summaryQuery.isLoading}
        />
      </section>

      <section className="ec2-explorer-chart-panel" aria-label="Load balancer explorer trend chart">
        <EC2ExplorerChart
          title={controls.metric === "cost" ? "Cost Trend" : "Load Balancer Trend"}
          chartType={resolvedGraphType}
          canUseStackedBar
          onChartTypeChange={(nextChartType) => setControls((current) => ({ ...current, chartType: nextChartType }))}
          graph={chartGraph}
          loading={trendQuery.isLoading}
          error={trendQuery.isError ? trendQuery.error : null}
          onRetry={() => {
            void trendQuery.refetch();
          }}
          onPointClick={() => {
            // Explorer shell only for now.
          }}
        />
      </section>

      <section className="ec2-explorer-table-panel" aria-label="Load balancer explorer group-by table">
        <EC2ExplorerTable
          metric={controls.metric === "cost" ? "cost" : "instances"}
          groupBy={controls.groupBy}
          loading={groupByQuery.isLoading}
          error={groupByQuery.isError ? groupByQuery.error : null}
          table={groupByTable}
          onRetry={() => {
            void groupByQuery.refetch();
          }}
          onRowClick={() => {
            // Explorer shell only for now.
          }}
        />
      </section>
    </div>
  );
}
