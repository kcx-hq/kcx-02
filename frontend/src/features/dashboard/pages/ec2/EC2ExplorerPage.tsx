import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  getValidGroupByForMetric,
} from "./ec2ExplorerControls.types";

const toApiGroupBy = (
  groupBy: EC2ExplorerControlsState["groupBy"],
): Ec2ExplorerFiltersQuery["groupBy"] =>
  groupBy === "instance-type"
    ? "instance_type"
    : groupBy === "reservation-type"
      ? "reservation_type"
      : groupBy === "cost-category"
        ? "cost_category"
      : groupBy === "availability-zone"
        ? "availability_zone"
        : groupBy === "usage-type"
          ? "usage_type"
          : groupBy === "transfer-type"
            ? "transfer_type"
            : groupBy === "source-region"
              ? "source_region"
              : groupBy === "destination-region"
                ? "destination_region"
            : groupBy === "instance-state"
              ? "instance_state"
              : groupBy;

const toApiCostBasis = (
  costBasis: EC2ExplorerControlsState["costBasis"],
): Ec2ExplorerFiltersQuery["costBasis"] => costBasis;

const toApiAggregation = (
  aggregation: EC2ExplorerControlsState["usageAggregation"],
): Ec2ExplorerFiltersQuery["aggregation"] => aggregation;

const toApiMetric = (
  metric: EC2ExplorerControlsState["metric"],
): Ec2ExplorerFiltersQuery["metric"] => (metric === "data-transfer" ? "data_transfer" : metric);

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
  volumeCount: 0,
  attachedInstanceCount: 0,
  unattachedVolumeCount: 0,
  storageGb: 0,
  storageGbHours: 0,
  avgCpu: 0,
  totalNetworkGb: 0,
};

const INSTANCE_LIST_PATH = "/dashboard/inventory/aws/ec2/instances";
const VOLUMES_LIST_PATH = "/dashboard/inventory/aws/ec2/volumes";
const OPTIMIZATION_PAGE_PATH = "/dashboard/ec2/optimization";
const NAT_GATEWAY_PAGE_PATH = "/dashboard/ec2/network/nat-gateway";
const ELASTIC_IP_PAGE_PATH = "/dashboard/ec2/network/elastic-ip";

const toQueryGroupBy = (groupBy: EC2ExplorerControlsState["groupBy"]): string =>
  groupBy === "instance-type"
    ? "instance_type"
    : groupBy === "reservation-type"
      ? "reservation_type"
      : groupBy === "cost-category"
          ? "cost_category"
          : groupBy === "availability-zone"
            ? "availability_zone"
            : groupBy === "usage-type"
              ? "usage_type"
              : groupBy === "transfer-type"
                ? "transfer_type"
                : groupBy === "source-region"
                  ? "source_region"
                  : groupBy === "destination-region"
                    ? "destination_region"
              : groupBy === "instance-state"
                  ? "instance_state"
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
  const dataTransferDebugEnabled = useMemo(
    () => ["1", "true", "yes", "on"].includes((scopeParams.get("debugDataTransfer") ?? "").trim().toLowerCase()),
    [scopeParams],
  );
  const scopeEndDate =
    scope?.to ??
    scopeParams.get("to") ??
    scopeParams.get("billingPeriodEnd") ??
    scopeParams.get("endDate") ??
    undefined;

  const initialControls = useMemo<EC2ExplorerControlsState>(() => {
    const params = new URLSearchParams(location.search);
    const metricParam = params.get("metric");
    const groupByParam = params.get("groupBy");
    const usageTypeParam = params.get("usageType");
    const metric =
      metricParam === "data_transfer" || metricParam === "data-transfer"
        ? "data-transfer"
        : metricParam === "cost" || metricParam === "usage" || metricParam === "instances" || metricParam === "volumes"
          ? metricParam
          : EC2_EXPLORER_DEFAULT_CONTROLS.metric;
    const rawGroupBy =
      groupByParam === "transfer_type"
        ? "transfer-type"
        : groupByParam === "source_region"
          ? "source-region"
          : groupByParam === "destination_region"
            ? "destination-region"
            : groupByParam === "instance_type"
              ? "instance-type"
              : groupByParam === "reservation_type"
                ? "reservation-type"
                : groupByParam === "cost_category"
                  || groupByParam === "cost_type"
                  || groupByParam === "cost-type"
                  ? "cost-category"
                  : groupByParam === "availability_zone"
                    ? "availability-zone"
                    : groupByParam === "usage_type"
                      ? "usage-type"
                      : groupByParam === "instance_state"
                        ? "instance-state"
                        : (groupByParam as EC2ExplorerControlsState["groupBy"]) ?? EC2_EXPLORER_DEFAULT_CONTROLS.groupBy;
    const groupBy = getValidGroupByForMetric(metric, rawGroupBy);
    const usageType = usageTypeParam === "network" || usageTypeParam === "disk" || usageTypeParam === "cpu"
      ? usageTypeParam
      : EC2_EXPLORER_DEFAULT_CONTROLS.usageType;
    return {
      ...EC2_EXPLORER_DEFAULT_CONTROLS,
      metric,
      groupBy,
      usageType,
    };
  }, [location.search]);
  const [controls, setControls] = useState<EC2ExplorerControlsState>(initialControls);
  useEffect(() => {
    if (controls.metric !== "volumes") return;
    const next = new URLSearchParams(location.search);
    navigate({ pathname: VOLUMES_LIST_PATH, search: next.toString() }, { replace: true });
  }, [controls.metric, location.search, navigate]);
  const filters = useMemo(
    () => ({
      startDate: scopeStartDate,
      endDate: scopeEndDate,
      metric: toApiMetric(controls.metric),
      granularity: controls.granularity,
      volumeView: controls.metric === "volumes" ? controls.volumeView : undefined,
      groupBy: toApiGroupBy(controls.groupBy),
      tagKey: controls.groupBy === "tag" ? controls.scopeFilters.tags[0] ?? "owner" : null,
      regions: controls.scopeFilters.region,
      tags: controls.scopeFilters.tags.map((tagValue) => `tag:${tagValue}`),
      costBasis: controls.metric === "cost" || controls.metric === "data-transfer" ? toApiCostBasis(controls.costBasis) : undefined,
      usageType: controls.metric === "usage" || controls.metric === "data-transfer" ? controls.usageType : undefined,
      aggregation: controls.metric === "usage" || controls.metric === "data-transfer" ? toApiAggregation(controls.usageAggregation) : undefined,
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
      debugDataTransfer: controls.metric === "data-transfer" ? dataTransferDebugEnabled : undefined,
    }),
    [controls, dataTransferDebugEnabled, scopeEndDate, scopeStartDate],
  );

  const query = useEc2ExplorerQuery(filters, Boolean(scope));
  const hasExplorerData = Boolean(query.data);
  const isSectionLoading = query.isFetching || !hasExplorerData;
  const dataTransferView = controls.metric === "data-transfer"
    ? controls.usageType === "disk"
      ? "usage"
      : controls.usageType === "cpu"
        ? "distribution"
        : "cost"
    : null;
  const dataTransferValueKey = dataTransferView === "usage"
    ? "usage_gb"
    : dataTransferView === "distribution"
      ? "percent_share"
      : dataTransferView === "cost"
        ? "cost"
        : null;
  useEffect(() => {
    if (controls.metric !== "data-transfer" || !query.data || !dataTransferDebugEnabled) return;
    const firstRow = query.data.graph.series[0]?.data[0] ?? null;
    const chartTotal = query.data.graph.series.reduce(
      (sum, series) =>
        sum +
        series.data.reduce((inner, point) => {
          if (dataTransferValueKey === "cost") return inner + Number(point.cost ?? point.total_cost ?? point.data_transfer_cost ?? 0);
          if (dataTransferValueKey === "usage_gb") return inner + Number(point.usage_gb ?? point.billed_usage_gb ?? point.total_usage_gb ?? 0);
          return inner + Number(point.percent_share ?? 0);
        }, 0),
      0,
    );
    console.debug("[EC2 Explorer][Data Transfer]", {
      selectedView: dataTransferView,
      selectedValueKey: dataTransferValueKey,
      firstChartRow: firstRow,
      chartTotal,
      kpiCost: query.data.summary.totalCost,
      kpiUsageGb: query.data.summary.storageGb,
    });
    const topUnknown = query.data.dataTransferDebug?.topUnknownContributors ?? [];
    const topUnknownRows = query.data.dataTransferDebug?.topUnknownRows ?? [];
    const topUsageTypes = new Map<string, number>();
    const topDescriptions = new Map<string, number>();
    for (const row of topUnknown) {
      topUsageTypes.set(row.usageType, (topUsageTypes.get(row.usageType) ?? 0) + row.cost);
      topDescriptions.set(row.lineItemDescription, (topDescriptions.get(row.lineItemDescription) ?? 0) + row.cost);
    }
    const sortDesc = (a: [string, number], b: [string, number]) => b[1] - a[1];
    console.debug("[EC2 Explorer][Data Transfer][Unknown Debug]", {
      totalUnknownCost: query.data.dataTransferDebug?.totalUnknownCost ?? 0,
      totalUnknownUsageGb: query.data.dataTransferDebug?.totalUnknownUsageGb ?? 0,
      unknownResourceCount: query.data.dataTransferDebug?.unknownResourceCount ?? 0,
      unmappedResourceCount: query.data.dataTransferDebug?.unmappedResourceCount ?? 0,
      unmappedResourceCost: query.data.dataTransferDebug?.unmappedResourceCost ?? 0,
      unmappedResourceUsageGb: query.data.dataTransferDebug?.unmappedResourceUsageGb ?? 0,
      topUnknownUsageTypes: [...topUsageTypes.entries()].sort(sortDesc).slice(0, 10),
      topUnknownDescriptions: [...topDescriptions.entries()].sort(sortDesc).slice(0, 10),
      topUnknownRows: topUnknownRows.slice(0, 20),
      likelyDemoUnknownRows: topUnknownRows.filter((row) => row.likelyDemoData).length,
      unknownDateBuckets: [...new Set(topUnknownRows.map((row) => row.dateBucket))].slice(0, 50),
    });
  }, [controls.metric, dataTransferDebugEnabled, dataTransferValueKey, dataTransferView, query.data]);
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
      next.set("usageType", controls.usageType);
      next.set("aggregation", controls.usageAggregation);
    } else {
      next.delete("aggregation");
    }
    Object.entries(extras).forEach(([key, value]) => next.set(key, value));
    next.delete("networkType");
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
          : controls.costBasis === "net_amortized_cost"
            ? "Net Amortized Cost"
            : controls.costBasis === "net_unblended_cost"
              ? "Net Unblended Cost"
          : controls.costBasis === "billed_cost"
            ? "Billed Cost"
            : "Effective Cost"
        : controls.metric === "usage"
          ? controls.usageType === "network"
            ? "Network"
            : controls.usageType === "disk"
              ? "Disk"
              : "CPU"
          : controls.metric === "data-transfer"
            ? controls.usageType === "network"
              ? "Cost"
              : controls.usageType === "disk"
                ? "Usage (GB)"
                : "Distribution"
          : controls.metric === "volumes"
            ? controls.volumeView === "storage_hours"
              ? "Storage Hours"
              : controls.volumeView === "cost"
                ? "Cost"
                : controls.volumeView === "count"
                  ? "Count"
                  : "Storage"
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
        label:
          controls.metric === "instances"
            ? "Condition"
            : controls.metric === "usage"
              ? "Usage Metric"
              : controls.metric === "data-transfer"
                ? "View"
              : controls.metric === "volumes"
                ? "View"
                : "Cost Basis",
        value: configLabel,
        onRemove: () =>
          setControls((current) => ({
            ...current,
            costBasis: EC2_EXPLORER_DEFAULT_CONTROLS.costBasis,
            usageType: EC2_EXPLORER_DEFAULT_CONTROLS.usageType,
            volumeView: EC2_EXPLORER_DEFAULT_CONTROLS.volumeView,
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
    <div className="dashboard-page cost-explorer-page ec2-explorer-page">
      <section className="ec2-explorer-head-stack" aria-label="EC2 explorer controls and summary">
        <EC2ExplorerTopControls value={controls} onChange={setControls} loading={isSectionLoading}>
          <div className="cost-explorer-chip-bar" aria-label="Selected filter summary">
            <div className="cost-explorer-chip-row">
              {isSectionLoading ? (
                <>
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--lg" aria-hidden="true" />
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--md" aria-hidden="true" />
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--md2" aria-hidden="true" />
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--clear" aria-hidden="true" />
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </EC2ExplorerTopControls>

        <EC2SummaryCards summary={query.data?.summary ?? defaultSummary} loading={isSectionLoading} metric={controls.metric} />
      </section>

      <section className="ec2-explorer-chart-panel" aria-label="EC2 explorer chart panel">
        {controls.metric === "data-transfer" && dataTransferDebugEnabled && query.data?.dataTransferDebug ? (
          <p className="dashboard-note">
            Unknown cost: {query.data.dataTransferDebug.totalUnknownCost.toFixed(2)} | Unknown usage GB: {query.data.dataTransferDebug.totalUnknownUsageGb.toFixed(2)} | Unmapped resources: {query.data.dataTransferDebug.unmappedResourceCount} ({query.data.dataTransferDebug.unmappedResourceCost.toFixed(2)}){query.data.dataTransferDebug.topUnknownRows.some((row) => row.likelyDemoData) ? " | Includes demo unclassified transfer rows" : ""}
          </p>
        ) : null}
        {(controls.groupBy === "transfer-type" || (controls.metric === "usage" && controls.usageType === "network" && controls.groupBy === "usage-type")) ? (
          <p className="dashboard-note">
            Billed Usage is from AWS billing data and may differ from CloudWatch Network Usage.
          </p>
        ) : null}
        <EC2ExplorerChart
          title={`${metricLabel} Breakdown`}
          chartType={resolvedGraphType}
          canUseStackedBar
          showChartTypeSelector={false}
          valueMode={
            controls.metric === "data-transfer"
              ? controls.usageType === "disk"
                ? "data-transfer-usage"
                : controls.usageType === "cpu"
                  ? "data-transfer-distribution"
                  : "data-transfer-cost"
              : "default"
          }
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
          loading={isSectionLoading}
          error={query.isError ? query.error : null}
          onRetry={() => {
            void query.refetch();
          }}
          onPointClick={({ date, seriesKey, seriesLabel }) => {
            if (!date) return;
            if (
              controls.metric === "cost" &&
              controls.groupBy === "cost-category" &&
              (seriesKey?.trim().toLowerCase() === "data_transfer" || seriesLabel?.trim().toLowerCase() === "data transfer")
            ) {
              setControls((current) => ({ ...current, metric: "data-transfer", groupBy: "transfer-type" }));
              return;
            }
            if (
              controls.metric === "cost" &&
              controls.groupBy === "cost-category" &&
              (seriesKey?.trim().toLowerCase() === "eip" || seriesLabel?.trim().toLowerCase() === "eip")
            ) {
              const next = new URLSearchParams();
              if (scopeStartDate) next.set("startDate", scopeStartDate);
              if (scopeEndDate) next.set("endDate", scopeEndDate);
              const existing = new URLSearchParams(location.search);
              const region = existing.get("region");
              if (region && region.trim().length > 0) next.set("region", region);
              navigate({ pathname: ELASTIC_IP_PAGE_PATH, search: next.toString() });
              return;
            }
            navigateToInstanceList("explorer-graph", {
              selectedDate: date,
              groupValue: seriesLabel ?? seriesKey ?? "all",
              ...((controls.groupBy === "transfer-type" || controls.groupBy === "usage-type") && seriesLabel ? { networkType: seriesLabel } : {}),
            });
          }}
        />
      </section>

      <section className="ec2-explorer-table-panel" aria-label="EC2 explorer table panel">
        <EC2ExplorerTable
          metric={controls.metric}
          groupBy={controls.groupBy}
          loading={isSectionLoading}
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
            const normalizedGroupValue = groupValue.trim().toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
            if (controls.metric === "cost" && controls.groupBy === "cost-category" && normalizedGroupValue === "nat_gateway") {
              navigate({ pathname: NAT_GATEWAY_PAGE_PATH, search: location.search });
              return;
            }
            if (controls.metric === "cost" && controls.groupBy === "cost-category" && normalizedGroupValue === "data_transfer") {
              setControls((current) => ({ ...current, metric: "data-transfer", groupBy: "transfer-type" }));
              return;
            }
            if (controls.metric === "cost" && controls.groupBy === "cost-category" && normalizedGroupValue === "eip") {
              const next = new URLSearchParams();
              if (scopeStartDate) next.set("startDate", scopeStartDate);
              if (scopeEndDate) next.set("endDate", scopeEndDate);
              const existing = new URLSearchParams(location.search);
              const region = existing.get("region");
              if (region && region.trim().length > 0) next.set("region", region);
              navigate({ pathname: ELASTIC_IP_PAGE_PATH, search: next.toString() });
              return;
            }
            navigateToInstanceList("explorer-table", {
              groupValue,
              ...(controls.groupBy === "transfer-type" || controls.groupBy === "usage-type" ? { networkType: groupValue } : {}),
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
