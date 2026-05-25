import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { InventoryEc2InstanceRow } from "@/features/client-home/api/inventory-instances.api";
import { useInventoryEc2Instances } from "@/features/client-home/hooks/useInventoryEc2Instances";
import { EC2ExplorerChart } from "./components/EC2ExplorerChart";
import { EC2InstancesTable } from "./components/EC2InstancesTable";
import { EC2ExplorerTopControls, EC2_EXPLORER_DEFAULT_CONTROLS } from "./components";
import type { EC2ExplorerControlsState } from "./ec2ExplorerControls.types";
import {
  EC2_INSTANCES_RESERVATION_OPTIONS,
  EC2_INSTANCES_DEFAULT_CONTROLS,
  EC2_INSTANCES_STATUS_OPTIONS,
  EC2_INSTANCES_STATE_OPTIONS,
  type EC2InstancesStatus,
  type EC2InstancesControlsState,
} from "./components/ec2Instances.types";

const PAGE_SIZE = 25;
const VOLUMES_PAGE_PATH = "/dashboard/inventory/aws/ec2/volumes";
const INSTANCES_PAGE_PATH = "/dashboard/inventory/aws/ec2/instances";

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const getDefaultDateRange = (): { start: string; end: string } => {
  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return {
    start: toIsoDate(startOfMonth),
    end: toIsoDate(today),
  };
};

const parseThreshold = (value: string): number | null => {
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toTitle = (value: string): string =>
  value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const parseCsvParam = (value: string | null): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const isValidStatus = (value: string | null): value is EC2InstancesStatus =>
  Boolean(value) && EC2_INSTANCES_STATUS_OPTIONS.some((option) => option.key === value);

const isValidState = (value: string | null): value is EC2InstancesControlsState["state"] =>
  Boolean(value) && EC2_INSTANCES_STATE_OPTIONS.some((option) => option.key === value);

const isValidReservationType = (value: string | null): value is EC2InstancesControlsState["reservationType"] =>
  Boolean(value) && EC2_INSTANCES_RESERVATION_OPTIONS.some((option) => option.key === value);

const toExplorerCondition = (
  status: EC2InstancesStatus,
): "all" | "idle" | "underutilized" | "overutilized" | "uncovered" | undefined => {
  if (status === "all") return "all";
  if (status === "idle") return "idle";
  if (status === "underutilized") return "underutilized";
  if (status === "overutilized") return "overutilized";
  if (status === "uncovered") return "uncovered";
  return undefined;
};

const toInstancesStatus = (
  condition: EC2ExplorerControlsState["instancesCondition"],
): EC2InstancesStatus => {
  if (condition === "idle") return "idle";
  if (condition === "underutilized") return "underutilized";
  if (condition === "overutilized") return "overutilized";
  if (condition === "uncovered") return "uncovered";
  return "all";
};

const matchesState = (instance: InventoryEc2InstanceRow, state: EC2InstancesControlsState["state"]): boolean => {
  if (state === "all") return true;
  return (instance.state ?? "").toLowerCase() === state;
};

const matchesRegion = (instance: InventoryEc2InstanceRow, regions: string[]): boolean => {
  if (regions.length === 0) return true;
  const normalizedRegions = regions.map((region) => region.toLowerCase());
  const candidates = [instance.regionKey, instance.regionId, instance.regionName]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  return candidates.some((candidate) => normalizedRegions.includes(candidate));
};

const matchesThresholds = (instance: InventoryEc2InstanceRow, thresholds: EC2InstancesControlsState["thresholds"]): boolean => {
  const minCost = parseThreshold(thresholds.costMin);
  const maxCost = parseThreshold(thresholds.costMax);
  const minCpu = parseThreshold(thresholds.cpuMin);
  const maxCpu = parseThreshold(thresholds.cpuMax);

  const cost = instance.monthToDateCost;
  const cpu = instance.cpuAvg;

  if (minCost !== null && cost < minCost) return false;
  if (maxCost !== null && cost > maxCost) return false;
  if (minCpu !== null && (cpu === null || cpu < minCpu)) return false;
  if (maxCpu !== null && (cpu === null || cpu > maxCpu)) return false;
  return true;
};

const toInstanceGroupKey = (
  row: InventoryEc2InstanceRow,
  groupBy: EC2ExplorerControlsState["groupBy"],
): { key: string; label: string } => {
  if (groupBy === "instance") {
    const label = row.instanceName?.trim() || row.instanceId;
    return { key: row.instanceId, label };
  }
  if (groupBy === "region") {
    const label = row.regionName ?? row.regionId ?? row.regionKey ?? "Unknown";
    return { key: label, label };
  }
  if (groupBy === "account") {
    const label = row.subAccountName ?? row.subAccountKey ?? "Unknown";
    return { key: label, label };
  }
  if (groupBy === "instance-type") {
    const label = row.instanceType ?? "Unknown";
    return { key: label, label };
  }
  if (groupBy === "reservation-type") {
    const label =
      row.pricingType === "on_demand"
        ? "On-Demand"
        : row.pricingType === "savings_plan"
          ? "Savings Plan"
          : row.pricingType === "reserved"
            ? "Reserved"
            : row.pricingType === "spot"
              ? "Spot"
              : "Unknown";
    return { key: label, label };
  }
  if (groupBy === "instance-state") {
    const label = toTitle(row.state ?? "unknown");
    return { key: label, label };
  }
  if (groupBy === "recommendation") {
    const label = row.statusLabel ?? "Healthy";
    return { key: label, label };
  }
  if (groupBy === "tag") {
    const tags = row.tags ?? {};
    const firstTag = Object.entries(tags)[0];
    const label = firstTag ? `${firstTag[0]}:${String(firstTag[1])}` : "Untagged";
    return { key: label, label };
  }
  return { key: "all", label: "All Instances" };
};

export default function EC2InstancesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const defaults = getDefaultDateRange();
  const startDateFromParams = queryParams.get("startDate") ?? queryParams.get("from") ?? queryParams.get("billingPeriodStart") ?? defaults.start;
  const endDateFromParams = queryParams.get("endDate") ?? queryParams.get("to") ?? queryParams.get("billingPeriodEnd") ?? defaults.end;
  const source = queryParams.get("source");
  const isExplorerNavigation = source === "explorer-graph" || source === "explorer-table";
  const isExplorerDrilldown = isExplorerNavigation || source === "explorer" || queryParams.get("drilldown") === "true";
  const querySearch = isExplorerNavigation ? queryParams.get("search") ?? "" : "";

  const explorerRegions = isExplorerNavigation ? parseCsvParam(queryParams.get("region")) : [];
  const explorerTags = isExplorerNavigation ? parseCsvParam(queryParams.get("tags")) : [];
  const queryStatus = isExplorerNavigation ? queryParams.get("status") ?? queryParams.get("condition") : null;
  const queryState = isExplorerNavigation ? queryParams.get("state") : null;
  const queryInstanceType = isExplorerNavigation ? queryParams.get("instanceType") : null;
  const queryReservationType = isExplorerNavigation ? queryParams.get("reservationType") : null;
  const queryTransferType = queryParams.get("transferType");

  const initialControls = useMemo<EC2InstancesControlsState>(() => ({
    ...EC2_INSTANCES_DEFAULT_CONTROLS,
    status: isValidStatus(queryStatus) ? queryStatus : EC2_INSTANCES_DEFAULT_CONTROLS.status,
    state: isValidState(queryState) ? queryState : EC2_INSTANCES_DEFAULT_CONTROLS.state,
    instanceType: queryInstanceType && queryInstanceType.trim().length > 0 ? queryInstanceType : EC2_INSTANCES_DEFAULT_CONTROLS.instanceType,
    reservationType: isValidReservationType(queryReservationType)
      ? queryReservationType
      : EC2_INSTANCES_DEFAULT_CONTROLS.reservationType,
    search: querySearch,
    scopeFilters: {
      region: [...explorerRegions],
      tags: [...explorerTags],
    },
  }), [explorerRegions, explorerTags, queryStatus, queryInstanceType, queryReservationType, querySearch, queryState]);

  const [controls, setControls] = useState<EC2InstancesControlsState>(initialControls);
  const [insightsControls, setInsightsControls] = useState<EC2ExplorerControlsState>({
    ...EC2_EXPLORER_DEFAULT_CONTROLS,
    metric: "instances",
    groupBy: "instance",
    instancesCondition: toExplorerCondition(initialControls.status) ?? "all",
    instancesState: initialControls.state,
    instanceType: initialControls.instanceType,
    scopeFilters: {
      region: [...initialControls.scopeFilters.region],
      tags: [...initialControls.scopeFilters.tags],
    },
    thresholds: { ...initialControls.thresholds },
  });
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(controls.search.trim());

  const instancesQuery = useInventoryEc2Instances({
    state: controls.state === "all" ? null : controls.state,
    instanceType: controls.instanceType === "all" ? null : controls.instanceType,
    pricingType: controls.reservationType === "all" ? null : controls.reservationType,
    status: controls.status,
    search: deferredSearch.length > 0 ? deferredSearch : null,
    transferType:
      queryTransferType === "internet" ||
      queryTransferType === "inter_region" ||
      queryTransferType === "inter_az" ||
      queryTransferType === "regional" ||
      queryTransferType === "unknown"
        ? queryTransferType
        : null,
    startDate: startDateFromParams,
    endDate: endDateFromParams,
    page,
    pageSize: PAGE_SIZE,
  });

  const allItems = instancesQuery.data?.items ?? [];

  const filteredRows = useMemo(
    () =>
      allItems.filter((instance) => {
        if (!matchesState(instance, controls.state)) return false;
        if (!matchesRegion(instance, controls.scopeFilters.region)) return false;
        if (!matchesThresholds(instance, controls.thresholds)) return false;
        return true;
      }),
    [allItems, controls.scopeFilters.region, controls.state, controls.thresholds],
  );
  const volumeCostByInstanceId = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of filteredRows) {
      grouped.set(row.instanceId, Number.isFinite(row.attachedVolumeCost) ? row.attachedVolumeCost : 0);
    }
    return grouped;
  }, [filteredRows]);

  const isListLoading = instancesQuery.isFetching || !instancesQuery.data;
  const isInsightsLoading = isListLoading;

  const instancesKpis = useMemo(() => {
    const computeCost = filteredRows.reduce((sum, row) => sum + (Number.isFinite(row.computeCost) ? row.computeCost : 0), 0);
    const totalNetworkBytes = filteredRows.reduce(
      (sum, row) => sum + (Number.isFinite(row.networkUsageBytes) ? row.networkUsageBytes : 0),
      0,
    );
    const totalNetworkGb = totalNetworkBytes / (1024 * 1024 * 1024);
    const totalVolumeCount = filteredRows.reduce(
      (sum, row) => sum + (Number.isFinite(row.attachedVolumeCount) ? Math.trunc(row.attachedVolumeCount ?? 0) : 0),
      0,
    );

    return {
      computeCost,
      instances: filteredRows.length,
      totalNetworkGb,
      totalVolumeCount,
    };
  }, [filteredRows]);

  const fleetChartModel = useMemo(() => {
    const groupBy = insightsControls.groupBy;
    if (groupBy === "instance") {
      const topRows = filteredRows.slice(0, 20);

      return {
        title: "Instance Distribution",
        unit: "count" as const,
        yAxisLabel: "Instance Count",
        xAxisLabel: "Instance",
        horizontalBars: true,
        graph: {
          type: "bar" as const,
          xKey: "date" as const,
          series: [
            {
              key: "instance-count",
              label: "Instance Count",
              data: topRows.map((row) => ({
                date: row.instanceName?.trim() || row.instanceId,
                value: 1,
              })),
            },
          ],
        },
      };
    }

    const grouped = new Map<string, { label: string; count: number }>();
    for (const row of filteredRows) {
      const group = toInstanceGroupKey(row, groupBy);
      const current = grouped.get(group.key) ?? { label: group.label, count: 0 };
      current.count += 1;
      grouped.set(group.key, current);
    }

    const entries = [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, 10);
    const title =
      groupBy === "instance-state"
        ? "Instances by State"
        : groupBy === "recommendation"
          ? "Instances by Condition"
          : groupBy === "instance-type"
            ? "Instances by Type"
            : groupBy === "reservation-type"
              ? "Instances by Reservation Type"
              : groupBy === "region"
                ? "Instances by Region"
                : "Fleet Distribution";

    return {
      title,
      unit: "count" as const,
      yAxisLabel: "Instance Count",
      xAxisLabel: "Group",
      horizontalBars: true,
      graph: {
        type: "bar" as const,
        xKey: "date" as const,
        series: [
          {
            key: "count",
            label: "Instance Count",
            data: entries.map((entry) => ({
              date: entry.label,
              value: entry.count,
            })),
          },
        ],
      },
    };
  }, [filteredRows, insightsControls.groupBy]);

  const shouldHideInstanceCountChart = false;

  useEffect(() => {
    console.debug("[EC2 Instances][Summary Debug]", {
      instanceRowsLength: filteredRows.length,
      calculatedKpis: instancesKpis,
      chartRowsLength: fleetChartModel.graph.series[0]?.data.length ?? 0,
      filtersApplied: {
        startDate: startDateFromParams,
        endDate: endDateFromParams,
        status: controls.status,
        state: controls.state,
        instanceType: controls.instanceType,
        reservationType: controls.reservationType,
        search: deferredSearch,
        transferType: queryTransferType ?? null,
        regions: controls.scopeFilters.region,
        tags: controls.scopeFilters.tags,
        thresholds: controls.thresholds,
        chartGroupBy: insightsControls.groupBy,
        chartHidden: shouldHideInstanceCountChart,
      },
    });
  }, [
    controls.instanceType,
    controls.reservationType,
    controls.scopeFilters.region,
    controls.scopeFilters.tags,
    controls.state,
    controls.status,
    controls.thresholds,
    deferredSearch,
    endDateFromParams,
    filteredRows.length,
    fleetChartModel.graph.series,
    insightsControls.groupBy,
    instancesKpis,
    shouldHideInstanceCountChart,
    queryTransferType,
    startDateFromParams,
  ]);

  useEffect(() => {
    const next = new URLSearchParams(location.search);
    if (controls.status === "all") {
      next.delete("status");
    } else {
      next.set("status", controls.status);
    }
    if (next.has("condition")) {
      next.delete("condition");
    }
    if (next.toString() !== queryParams.toString()) {
      navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
    }
  }, [controls.status, location.pathname, location.search, navigate, queryParams]);

  useEffect(() => {
    const mappedStatus = toInstancesStatus(insightsControls.instancesCondition);
    setControls((current) => {
      const nextState = insightsControls.instancesState === "all" || insightsControls.instancesState === "running" || insightsControls.instancesState === "stopped" || insightsControls.instancesState === "terminated"
        ? insightsControls.instancesState
        : current.state;
      if (current.status === mappedStatus && current.state === nextState) {
        return current;
      }
      return {
        ...current,
        status: mappedStatus,
        state: nextState,
      };
    });
  }, [insightsControls.instancesCondition, insightsControls.instancesState]);

  const instanceTypeOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        allItems
          .map((item) => item.instanceType)
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => a.localeCompare(b)),
      ),
    );

    if (controls.instanceType !== "all" && !unique.includes(controls.instanceType)) {
      unique.unshift(controls.instanceType);
    }

    return [{ key: "all", label: "All" }, ...unique.map((entry) => ({ key: entry, label: entry }))];
  }, [allItems, controls.instanceType]);

  const openInstanceDetail = (instanceId: string) => {
    const next = new URLSearchParams(location.search);
    next.set("instanceId", instanceId);
    next.set("search", instanceId);
    navigate({ pathname: `${INSTANCES_PAGE_PATH}/${instanceId}`, search: next.toString() });
  };

  return (
    <div className="dashboard-page cost-explorer-page ec2-instances-page-layout">
      <section className="ec2-instances-panel ec2-instances-panel--filters" aria-label="EC2 instances controls">
        <EC2ExplorerTopControls
          value={insightsControls}
          onChange={setInsightsControls}
          loading={isInsightsLoading}
          showMetricTabs={false}
          showThresholdButton={false}
          compactInstancesMode
          instancesListControls={{
            instanceType: controls.instanceType,
            reservationType: controls.reservationType,
            search: controls.search,
            instanceTypeOptions,
            showInstanceType: false,
            onChange: (patch) => {
              setControls((current) => ({ ...current, ...patch }));
              setPage(1);
            },
          }}
        />
      </section>

      <section className="ec2-instances-panel ec2-instances-panel--kpis" aria-label="EC2 instances insights summary">
        <section className="cost-explorer-kpi-surface s3-overview-kpi-surface" aria-label="EC2 instances summary cards">
          <div className="cost-explorer-chart-insights s3-overview-kpi-row">
            {[
              { label: "Instances", value: instancesKpis.instances.toLocaleString() },
              { label: "Compute Cost", value: `$${instancesKpis.computeCost.toFixed(2)}` },
              { label: "Network Usage", value: `${instancesKpis.totalNetworkGb.toFixed(2)} GB` },
              { label: "Volume Count", value: instancesKpis.totalVolumeCount.toLocaleString() },
            ].map((card) => (
              <article key={card.label} className={`cost-explorer-insight-tile s3-overview-kpi-tile${isInsightsLoading ? " is-loading" : ""}`}>
                {isInsightsLoading ? (
                  <div className="ec2-explorer-summary__skeleton" aria-hidden="true">
                    <span className="ec2-explorer-summary__skeleton-line ec2-explorer-summary__skeleton-line--label" />
                    <span className="ec2-explorer-summary__skeleton-line ec2-explorer-summary__skeleton-line--value" />
                  </div>
                ) : (
                  <>
                    <p className="cost-explorer-insight-tile__label">{card.label}</p>
                    <p className="cost-explorer-insight-tile__value">{card.value}</p>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      </section>

      {insightsControls.groupBy === "instance" && filteredRows.length <= 1 ? null : (
        <section className="ec2-instances-panel ec2-instances-panel--chart" aria-label="EC2 instances operational chart">
          <EC2ExplorerChart
            title={fleetChartModel.title}
            explorerType="usage"
            unit={fleetChartModel.unit}
            chartType="stacked_bar"
            canUseStackedBar
            showChartTypeSelector={false}
            yAxisLabel={fleetChartModel.yAxisLabel}
            xAxisLabel={fleetChartModel.xAxisLabel}
            horizontalBars={fleetChartModel.horizontalBars}
            graph={fleetChartModel.graph}
            loading={isInsightsLoading}
            error={instancesQuery.isError ? instancesQuery.error : null}
            onRetry={() => {
              void instancesQuery.refetch();
            }}
            onChartTypeChange={() => {}}
            onPointClick={() => {}}
          />
        </section>
      )}

      <section className="ec2-instances-panel ec2-instances-panel--list" aria-label="EC2 instances list">
        <EC2InstancesTable
          rows={filteredRows}
          volumeCostByInstanceId={volumeCostByInstanceId}
          loading={isListLoading}
          error={instancesQuery.isError ? instancesQuery.error : null}
          onRetry={() => {
            void instancesQuery.refetch();
          }}
          onOpenVolumesForInstance={(instanceId) => {
            const next = new URLSearchParams(location.search);
            next.set("source", "instances-volume-link");
            next.set("attachedInstanceId", instanceId);
            next.set("search", instanceId);
            navigate({ pathname: VOLUMES_PAGE_PATH, search: next.toString() });
          }}
          onOpenInstance={openInstanceDetail}
        />
      </section>
    </div>
  );
}

