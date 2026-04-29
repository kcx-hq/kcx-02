import { X } from "lucide-react";
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

const normalizeReservationType = (value: string): string | null => {
  const normalized = value.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (normalized === "on_demand" || normalized === "reserved" || normalized === "savings_plan" || normalized === "spot") {
    return normalized;
  }
  return null;
};

export default function EC2ExplorerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { scope } = useDashboardScope();
  const scopeParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const scopeStartDate =
    scope?.from ??
    scopeParams.get("from") ??
    scopeParams.get("billingPeriodStart") ??
    scopeParams.get("startDate") ??
    undefined;
  const scopeEndDate =
    scope?.to ??
    scopeParams.get("to") ??
    scopeParams.get("billingPeriodEnd") ??
    scopeParams.get("endDate") ??
    undefined;

  const [controls, setControls] = useState<EC2ExplorerControlsState>(EC2_EXPLORER_DEFAULT_CONTROLS);
  const shouldSendUsageMetric =
    controls.metric === "usage" && controls.groupBy !== "usage-category";
  const filters = useMemo(
    () => ({
      startDate: scopeStartDate,
      endDate: scopeEndDate,
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
    [controls, scopeEndDate, scopeStartDate, shouldSendUsageMetric],
  );

  const query = useEc2ExplorerQuery(filters, Boolean(scope));
  const resolvedGraphType = useMemo<"line" | "stacked_bar">(
    () => controls.chartType,
    [controls.chartType],
  );

  const metricLabel = METRIC_OPTIONS.find((option) => option.key === controls.metric)?.label ?? "Cost";

  const resetControls = () => {
    setControls(EC2_EXPLORER_DEFAULT_CONTROLS);
  };

  const navigateToInstanceList = (source: "explorer-graph" | "explorer-table", extras: Record<string, string>) => {
    const next = new URLSearchParams(location.search);
    ["selectedDate", "groupValue", "date", "seriesKey", "seriesLabel"].forEach((key) => next.delete(key));
    next.set("source", source);
    if (scopeStartDate) next.set("startDate", scopeStartDate);
    if (scopeEndDate) next.set("endDate", scopeEndDate);
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
      next.set("state", controls.instancesState);
      if (controls.instanceType !== "all") {
        next.set("instanceType", controls.instanceType);
      } else {
        next.delete("instanceType");
      }
    } else {
      next.delete("condition");
      next.delete("state");
      next.delete("instanceType");
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
    if (extras.groupValue) {
      const groupValue = extras.groupValue.trim();
      if (controls.groupBy === "reservation-type") {
        const reservationType = normalizeReservationType(groupValue);
        if (reservationType) {
          next.set("reservationType", reservationType);
          next.delete("search");
        }
      } else if (controls.groupBy === "instance-type") {
        next.set("instanceType", groupValue);
        next.delete("search");
      } else if (controls.groupBy === "region") {
        next.set("region", groupValue);
        next.delete("search");
      } else if (controls.groupBy === "none") {
        next.set("search", groupValue);
      } else {
        next.delete("search");
      }
    } else {
      next.delete("search");
    }
    navigate({ pathname: INSTANCE_LIST_PATH, search: next.toString() });
  };

  const chips = useMemo(() => {
    const metricLabel = METRIC_OPTIONS.find((option) => option.key === controls.metric)?.label ?? "Cost";
    const configLabel =
      controls.metric === "cost"
        ? controls.costBasis === "amortized_cost"
          ? "Amortized Cost"
          : controls.costBasis === "billed_cost"
            ? "Billed Cost"
            : "Effective Cost"
        : controls.metric === "usage"
          ? controls.usageMetric === "network_in"
            ? "Network In"
            : controls.usageMetric === "network_out"
              ? "Network Out"
              : controls.usageMetric === "disk_read"
                ? "Disk Read"
                : controls.usageMetric === "disk_write"
                  ? "Disk Write"
                  : "CPU"
          : controls.instancesCondition === "underutilized"
            ? "Underutilized"
            : controls.instancesCondition === "overutilized"
              ? "Overutilized"
              : controls.instancesCondition === "uncovered"
                ? "Uncovered"
                : controls.instancesCondition === "idle"
                  ? "Idle"
                  : "All";
    const groupByLabel = toApiGroupBy(controls.groupBy).replace(/_/g, " ");
    const stateLabel = controls.instancesState;
    const list: Array<{ id: string; label: string; value: string; onRemove: () => void }> = [
      {
        id: "metric",
        label: "Metric",
        value: metricLabel,
        onRemove: resetControls,
      },
      {
        id: "config",
        label: controls.metric === "instances" ? "Condition" : controls.metric === "usage" ? "Usage Metric" : "Cost Basis",
        value: configLabel,
        onRemove: () =>
          setControls((current) => ({
            ...current,
            costBasis: EC2_EXPLORER_DEFAULT_CONTROLS.costBasis,
            usageMetric: EC2_EXPLORER_DEFAULT_CONTROLS.usageMetric,
            instancesCondition: EC2_EXPLORER_DEFAULT_CONTROLS.instancesCondition,
          })),
      },
      {
        id: "groupBy",
        label: "Group By",
        value: groupByLabel.replace(/\b\w/g, (match) => match.toUpperCase()),
        onRemove: () =>
          setControls((current) => ({
            ...current,
            groupBy: EC2_EXPLORER_DEFAULT_CONTROLS.groupBy,
            groupByValues: [],
          })),
      },
    ];
    if (controls.metric === "instances") {
      list.push({
        id: "state",
        label: "State",
        value: stateLabel.charAt(0).toUpperCase() + stateLabel.slice(1),
        onRemove: () => setControls((current) => ({ ...current, instancesState: EC2_EXPLORER_DEFAULT_CONTROLS.instancesState })),
      });
    }
    if (controls.scopeFilters.region.length > 0) {
      list.push({
        id: "region",
        label: "Region",
        value: `${controls.scopeFilters.region.length} selected`,
        onRemove: () =>
          setControls((current) => ({ ...current, scopeFilters: { ...current.scopeFilters, region: [] } })),
      });
    }
    if (controls.groupByValues.length > 0) {
      list.push({
        id: "groupValues",
        label: "Values",
        value: `${controls.groupByValues.length} selected`,
        onRemove: () => setControls((current) => ({ ...current, groupByValues: [] })),
      });
    }
    return list;
  }, [controls, resetControls]);

  return (
    <div className="dashboard-page cost-explorer-page">
      <section className="ec2-explorer-head-stack" aria-label="EC2 explorer controls and summary">
        <EC2ExplorerTopControls value={controls} onChange={setControls} onReset={resetControls}>
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
              <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={resetControls}>
                Clear all
              </button>
            </div>
          </div>
        </EC2ExplorerTopControls>

        <EC2SummaryCards summary={query.data?.summary ?? defaultSummary} loading={query.isLoading} />
      </section>

      <section className="ec2-explorer-chart-panel" aria-label="EC2 explorer chart panel">
        <EC2ExplorerChart
          title={`${metricLabel} Breakdown`}
          chartType={resolvedGraphType}
          canUseStackedBar
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
      </section>

      <section className="ec2-explorer-table-panel" aria-label="EC2 explorer table panel">
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
