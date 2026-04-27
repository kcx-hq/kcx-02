import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useDashboardScope } from "../../hooks/useDashboardScope";
import { useEc2ExplorerQuery } from "../../hooks/useDashboardQueries";
import type { Ec2ExplorerFiltersQuery } from "../../api/dashboardApi";
import {
  EC2_EXPLORER_DEFAULT_CONTROLS,
  EC2ExplorerChart,
  EC2ExplorerTable,
  EC2ExplorerTopControls,
  EC2SummaryCards,
} from "./components";
import {
  METRIC_OPTIONS,
  type EC2ExplorerControlsState,
} from "./ec2ExplorerControls.types";

const toApiGroupBy = (
  groupBy: EC2ExplorerControlsState["groupBy"],
): Ec2ExplorerFiltersQuery["groupBy"] =>
  groupBy === "instance-type"
    ? "instance_type"
    : groupBy === "reservation-type"
      ? "reservation_type"
      : groupBy === "usage-category"
        ? "usage_category"
      : groupBy === "cost-category"
        ? "cost_category"
      : groupBy;

const toApiCostBasis = (
  costBasis: EC2ExplorerControlsState["costBasis"],
): Ec2ExplorerFiltersQuery["costBasis"] => costBasis;

const toApiAggregation = (
  aggregation: EC2ExplorerControlsState["usageAggregation"],
): Ec2ExplorerFiltersQuery["aggregation"] => aggregation;

const parseNumberOrNull = (value: string): number | null => {
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const defaultSummary = {
  totalCost: 0,
  previousCost: 0,
  trendPercent: 0,
  instanceCount: 0,
  avgCpu: 0,
  totalNetworkGb: 0,
};

const INSTANCE_LIST_PATH = "/dashboard/inventory/aws/ec2/instances";
const OPTIMIZATION_PAGE_PATH = "/dashboard/ec2/optimization";

const toQueryGroupBy = (groupBy: EC2ExplorerControlsState["groupBy"]): string =>
  groupBy === "instance-type"
    ? "instance_type"
    : groupBy === "reservation-type"
      ? "reservation_type"
      : groupBy === "usage-category"
        ? "usage_category"
        : groupBy === "cost-category"
          ? "cost_category"
          : groupBy;

export default function EC2ExplorerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { scope } = useDashboardScope();

  const [controls, setControls] = useState<EC2ExplorerControlsState>(EC2_EXPLORER_DEFAULT_CONTROLS);
  const shouldSendUsageMetric =
    controls.metric === "usage" && controls.groupBy !== "usage-category";
  const filters = useMemo(
    () => ({
      startDate: scope?.from,
      endDate: scope?.to,
      metric: controls.metric,
      groupBy: toApiGroupBy(controls.groupBy),
      tagKey: controls.groupBy === "tag" ? controls.scopeFilters.tags[0] ?? "owner" : null,
      regions: controls.scopeFilters.region,
      tags: controls.scopeFilters.tags.map((tagValue) => `tag:${tagValue}`),
      costBasis: controls.metric === "cost" ? toApiCostBasis(controls.costBasis) : undefined,
      usageMetric: shouldSendUsageMetric ? controls.usageMetric : undefined,
      aggregation: controls.metric === "usage" ? toApiAggregation(controls.usageAggregation) : undefined,
      condition: controls.metric === "instances" ? controls.instancesCondition : undefined,
      groupValues: controls.groupByValues,
      minCost: parseNumberOrNull(controls.thresholds.costMin),
      maxCost: parseNumberOrNull(controls.thresholds.costMax),
      minCpu: parseNumberOrNull(controls.thresholds.cpuMin),
      maxCpu: parseNumberOrNull(controls.thresholds.cpuMax),
      minNetwork: parseNumberOrNull(controls.thresholds.networkMin),
      maxNetwork: parseNumberOrNull(controls.thresholds.networkMax),
      states: controls.instancesState ? [controls.instancesState] : [],
      instanceTypes: controls.instanceType && controls.instanceType !== "all" ? [controls.instanceType] : [],
    }),
    [controls, scope?.from, scope?.to, shouldSendUsageMetric],
  );

  const query = useEc2ExplorerQuery(filters, Boolean(scope));
  const resolvedGraphType = useMemo<"line" | "stacked_bar">(() => {
    if (controls.metric === "usage") {
      return controls.groupBy === "none" ? "line" : controls.chartType;
    }
    return controls.chartType === "stacked_bar" && controls.groupBy !== "none" ? "stacked_bar" : "line";
  }, [controls.chartType, controls.groupBy, controls.metric]);

  const metricLabel = METRIC_OPTIONS.find((option) => option.key === controls.metric)?.label ?? "Cost";

  const resetControls = () => {
    setControls(EC2_EXPLORER_DEFAULT_CONTROLS);
  };

  const navigateToInstanceList = (source: "explorer-graph" | "explorer-table", extras: Record<string, string>) => {
    const next = new URLSearchParams(location.search);
    ["selectedDate", "groupValue", "date", "seriesKey", "seriesLabel"].forEach((key) => next.delete(key));
    next.set("source", source);
    if (scope?.from) next.set("startDate", scope.from);
    if (scope?.to) next.set("endDate", scope.to);
    next.set("metric", controls.metric);
    next.set("groupBy", toQueryGroupBy(controls.groupBy));
    if (controls.groupBy === "tag") {
      const tagKey = controls.groupByValues[0] ?? controls.scopeFilters.tags[0] ?? "owner";
      next.set("tagKey", tagKey);
    } else {
      next.delete("tagKey");
    }
    if (controls.scopeFilters.region.length > 0) {
      next.set("region", controls.scopeFilters.region.join(","));
    } else {
      next.delete("region");
    }
    if (controls.scopeFilters.tags.length > 0) {
      next.set("tags", controls.scopeFilters.tags.join(","));
    } else {
      next.delete("tags");
    }
    if (controls.metric === "instances") {
      next.set("condition", controls.instancesCondition);
    } else {
      next.delete("condition");
    }
    if (controls.metric === "cost") {
      next.set("costBasis", controls.costBasis);
    } else {
      next.delete("costBasis");
    }
    if (controls.metric === "usage") {
      next.set("usageMetric", controls.usageMetric);
      next.set("aggregation", controls.usageAggregation);
    } else {
      next.delete("usageMetric");
      next.delete("aggregation");
    }
    Object.entries(extras).forEach(([key, value]) => next.set(key, value));
    navigate({ pathname: INSTANCE_LIST_PATH, search: next.toString() });
  };

  return (
    <div className="dashboard-page cost-explorer-page">
      <section className="cost-explorer-unified-shell">
        <EC2ExplorerTopControls value={controls} onChange={setControls} onReset={resetControls} />
        <div className="cost-explorer-unified-shell__divider" aria-hidden="true" />

        <EC2SummaryCards summary={query.data?.summary ?? defaultSummary} loading={query.isLoading} />

        <EC2ExplorerChart
          title={`${metricLabel} Breakdown`}
          chartType={resolvedGraphType}
          canUseStackedBar={controls.groupBy !== "none"}
          onChartTypeChange={(nextChartType) => {
            setControls((current) => ({ ...current, chartType: nextChartType }));
          }}
          graph={
            query.data?.graph
              ? {
                  ...query.data.graph,
                  type: resolvedGraphType,
                }
              : {
                  type: resolvedGraphType,
                  xKey: "date",
                  series: [],
                }
          }
          loading={query.isLoading}
          error={query.isError ? query.error : null}
          onRetry={() => {
            void query.refetch();
          }}
          onPointClick={({ date, seriesKey, seriesLabel }) => {
            if (!date) return;
            navigateToInstanceList("explorer-graph", {
              selectedDate: date,
              groupValue: seriesLabel ?? seriesKey ?? "all",
            });
          }}
        />

        <EC2ExplorerTable
          loading={query.isLoading}
          error={query.isError ? query.error : null}
          table={query.data?.table ?? null}
          onRetry={() => {
            void query.refetch();
          }}
          onRowClick={(row) => {
            const groupValue =
              controls.groupBy === "none"
                ? String(row.instance ?? row.id)
                : String(row.group ?? row.id);
            navigateToInstanceList("explorer-table", {
              groupValue,
            });
          }}
          onRecommendationClick={() => {
            navigate({ pathname: OPTIMIZATION_PAGE_PATH, search: location.search });
          }}
        />
      </section>
    </div>
  );
}
