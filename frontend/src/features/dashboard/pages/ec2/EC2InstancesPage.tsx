import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { InventoryEc2InstanceRow } from "@/features/client-home/api/inventory-instances.api";
import type { Ec2ExplorerFiltersQuery } from "../../api/dashboardTypes";
import { useInventoryEc2Instances } from "@/features/client-home/hooks/useInventoryEc2Instances";
import { useInventoryEc2Volumes } from "@/features/client-home/hooks/useInventoryEc2Volumes";
import { useEc2ExplorerQuery } from "../../hooks/useDashboardQueries";
import { useDashboardScope } from "../../hooks/useDashboardScope";

import { EC2InstancesContextChips } from "./components/EC2InstancesContextChips";
import { EC2ExplorerChart } from "./components/EC2ExplorerChart";
import { EC2ExplorerTable } from "./components/EC2ExplorerTable";
import { EC2ExplorerThresholdsPopover } from "./components/EC2ExplorerThresholdsPopover";
import { EC2InstancesTable } from "./components/EC2InstancesTable";
import { EC2InstancesTopBar } from "./components/EC2InstancesTopBar";
import { EC2SummaryCards } from "./components/EC2SummaryCards";
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

const toApiGroupBy = (groupBy: EC2ExplorerControlsState["groupBy"]): Ec2ExplorerFiltersQuery["groupBy"] =>
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

export default function EC2InstancesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const defaults = getDefaultDateRange();
  const startDateFromParams = queryParams.get("startDate") ?? queryParams.get("from") ?? queryParams.get("billingPeriodStart") ?? defaults.start;
  const endDateFromParams = queryParams.get("endDate") ?? queryParams.get("to") ?? queryParams.get("billingPeriodEnd") ?? defaults.end;
  const source = queryParams.get("source");
  const isExplorerNavigation = source === "explorer-graph" || source === "explorer-table";
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
    instancesState: initialControls.state === "stopped" || initialControls.state === "terminated" ? initialControls.state : "running",
    instanceType: initialControls.instanceType,
    scopeFilters: {
      region: [...initialControls.scopeFilters.region],
      tags: [...initialControls.scopeFilters.tags],
    },
    thresholds: { ...initialControls.thresholds },
  });
  const [insightsThresholdsOpen, setInsightsThresholdsOpen] = useState(false);
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

  const volumesQuery = useInventoryEc2Volumes({
    attachedInstanceId: null,
    startDate: startDateFromParams,
    endDate: endDateFromParams,
    page: 1,
    pageSize: 500,
  });

  const allItems = instancesQuery.data?.items ?? [];
  const volumeCostByInstanceId = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const volume of volumesQuery.data?.items ?? []) {
      const instanceId = volume.attachedInstanceId;
      if (!instanceId) continue;
      grouped.set(instanceId, (grouped.get(instanceId) ?? 0) + volume.mtdCost);
    }
    return grouped;
  }, [volumesQuery.data?.items]);

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

  const explorerInstancesQuery = useEc2ExplorerQuery(
    {
      startDate: startDateFromParams,
      endDate: endDateFromParams,
      metric: "instances",
      granularity: insightsControls.granularity,
      groupBy: toApiGroupBy(insightsControls.groupBy),
      condition: insightsControls.instancesCondition,
      regions: insightsControls.scopeFilters.region,
      tags: insightsControls.scopeFilters.tags.map((tagValue) => `tag:${tagValue}`),
      states: [insightsControls.instancesState],
      instanceTypes: insightsControls.instanceType === "all" ? [] : [insightsControls.instanceType],
      minCost: parseThreshold(insightsControls.thresholds.costMin),
      maxCost: parseThreshold(insightsControls.thresholds.costMax),
      minCpu: parseThreshold(insightsControls.thresholds.cpuMin),
      maxCpu: parseThreshold(insightsControls.thresholds.cpuMax),
    },
    Boolean(scope),
  );
  const isInsightsLoading = explorerInstancesQuery.isFetching || !explorerInstancesQuery.data;
  const isListLoading = instancesQuery.isFetching || !instancesQuery.data;

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

  const activeChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove?: () => void }> = [];

    if (controls.scopeFilters.region.length > 0) {
      controls.scopeFilters.region.forEach((region) => {
        chips.push({
          id: `region-${region}`,
          label: `Region: ${region}`,
          onRemove: () =>
            setControls((current) => ({
              ...current,
              scopeFilters: {
                ...current.scopeFilters,
                region: current.scopeFilters.region.filter((item) => item !== region),
              },
            })),
        });
      });
    }

    if (controls.scopeFilters.tags.length > 0) {
      controls.scopeFilters.tags.forEach((tag) => {
        chips.push({
          id: `tag-${tag}`,
          label: `Tag: ${tag}`,
          onRemove: () =>
            setControls((current) => ({
              ...current,
              scopeFilters: {
                ...current.scopeFilters,
                tags: current.scopeFilters.tags.filter((item) => item !== tag),
              },
            })),
        });
      });
    }

    if (controls.state !== "all") {
      chips.push({
        id: "state",
        label: `State: ${toTitle(controls.state)}`,
        onRemove: () => setControls((current) => ({ ...current, state: "all" })),
      });
    }

    if (controls.instanceType !== "all") {
      chips.push({
        id: "instance-type",
        label: `Instance Type: ${controls.instanceType}`,
        onRemove: () => setControls((current) => ({ ...current, instanceType: "all" })),
      });
    }

    if (
      queryTransferType === "internet" ||
      queryTransferType === "inter_region" ||
      queryTransferType === "inter_az" ||
      queryTransferType === "regional" ||
      queryTransferType === "unknown"
    ) {
      const transferLabel =
        queryTransferType === "inter_region"
          ? "Inter-Region"
          : queryTransferType === "inter_az"
            ? "Inter-AZ"
            : queryTransferType === "regional"
              ? "Regional"
            : queryTransferType.charAt(0).toUpperCase() + queryTransferType.slice(1);
      chips.push({
        id: "transfer-type",
        label: `Transfer Type: ${transferLabel}`,
        onRemove: () => {
          const next = new URLSearchParams(location.search);
          next.delete("transferType");
          navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
        },
      });
    }

    return chips;
  }, [controls.instanceType, controls.scopeFilters.region, controls.scopeFilters.tags, controls.state, location.pathname, location.search, navigate, queryTransferType]);

  const openInstanceDetail = (instanceId: string) => {
    const next = new URLSearchParams(location.search);
    next.set("instanceId", instanceId);
    next.set("search", instanceId);
    navigate({ pathname: `${INSTANCES_PAGE_PATH}/${instanceId}`, search: next.toString() });
  };

  return (
    <div className="dashboard-page cost-explorer-page ec2-instances-page-layout">
      <section className="ec2-instances-panel ec2-instances-panel--filters" aria-label="EC2 instances insights filters">
        <EC2ExplorerTopControls
          value={insightsControls}
          onChange={setInsightsControls}
          loading={isInsightsLoading}
          showMetricTabs={false}
          showThresholdButton={false}
        >
          <div className="cost-explorer-chip-bar" aria-label="Selected filter summary">
            <div className="cost-explorer-chip-row">
              {isInsightsLoading ? (
                <>
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--lg" aria-hidden="true" />
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--md" aria-hidden="true" />
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--clear" aria-hidden="true" />
                </>
              ) : (
                <>
                  <span className="cost-explorer-chip">
                    <span className="cost-explorer-chip__edit">
                      Condition: {insightsControls.instancesCondition}
                    </span>
                    <button
                      type="button"
                      className="cost-explorer-chip__remove"
                      onClick={() => setInsightsControls((current) => ({ ...current, instancesCondition: "all" }))}
                      aria-label="Remove condition"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </span>
                  <span className="cost-explorer-chip">
                    <span className="cost-explorer-chip__edit">
                      Group By: {insightsControls.groupBy}
                    </span>
                    <button
                      type="button"
                      className="cost-explorer-chip__remove"
                      onClick={() => setInsightsControls((current) => ({ ...current, groupBy: "instance", groupByValues: [] }))}
                      aria-label="Remove group by"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </span>
                  <button
                    type="button"
                    className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline"
                    onClick={() =>
                      setInsightsControls((current) => ({
                        ...EC2_EXPLORER_DEFAULT_CONTROLS,
                        metric: "instances",
                        groupBy: "instance",
                        scopeFilters: { ...current.scopeFilters, region: [], tags: [] },
                      }))
                    }
                  >
                    Clear all
                  </button>
                  <button
                    type="button"
                    className="ec2-explorer-toolbar-action"
                    aria-label="Thresholds"
                    title="Thresholds"
                    onClick={() => setInsightsThresholdsOpen(true)}
                  >
                    <SlidersHorizontal size={14} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
        </EC2ExplorerTopControls>
      </section>

      <section className="ec2-instances-panel ec2-instances-panel--kpis" aria-label="EC2 instances insights summary">
        <EC2SummaryCards
          summary={
            explorerInstancesQuery.data?.summary ?? {
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
            }
          }
          loading={isInsightsLoading}
          metric="instances"
        />
      </section>

      <section className="ec2-instances-panel ec2-instances-panel--chart" aria-label="EC2 instances insights chart">
        <EC2ExplorerChart
          title="Instances Breakdown"
          chartType="stacked_bar"
          canUseStackedBar
          showChartTypeSelector={false}
          graph={
            explorerInstancesQuery.data?.graph
              ? {
                  ...explorerInstancesQuery.data.graph,
                  type: "stacked_bar",
                }
              : {
                  type: "stacked_bar",
                  xKey: "date",
                  series: [],
                }
          }
          loading={isInsightsLoading}
          error={explorerInstancesQuery.isError ? explorerInstancesQuery.error : null}
          onRetry={() => {
            void explorerInstancesQuery.refetch();
          }}
          onChartTypeChange={() => {}}
          onPointClick={() => {}}
        />
      </section>

      <section className="ec2-instances-panel ec2-instances-panel--insights-table" aria-label="EC2 instances insights table panel">
        <EC2ExplorerTable
          metric="instances"
          groupBy={insightsControls.groupBy}
          loading={isInsightsLoading}
          error={explorerInstancesQuery.isError ? explorerInstancesQuery.error : null}
          table={explorerInstancesQuery.data?.table ?? null}
          onRetry={() => {
            void explorerInstancesQuery.refetch();
          }}
          onRowClick={() => {}}
        />
      </section>

      <section className="ec2-instances-panel ec2-instances-panel--list" aria-label="EC2 instances list">
        <EC2InstancesTopBar
          value={controls}
          instanceTypeOptions={instanceTypeOptions}
          loading={isListLoading}
          visibleControls={[
            "filters",
            "status",
            "state",
            "instanceType",
            "reservationType",
            "search",
            "thresholds",
            "reset",
          ]}
          onChange={(next) => {
            setControls(next);
            setPage(1);
          }}
          onReset={() => {
            setControls({ ...EC2_INSTANCES_DEFAULT_CONTROLS });
            setPage(1);
          }}
        >
          <EC2InstancesContextChips
            chips={activeChips}
            onClearAll={() => {
              const next = new URLSearchParams(location.search);
              next.delete("transferType");
              navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
              setControls((current) => ({
                ...current,
                status: "all",
                state: "all",
                instanceType: "all",
                reservationType: "all",
                scopeFilters: { region: [], tags: [] },
                thresholds: {
                  cpuMin: "",
                  cpuMax: "",
                  costMin: "",
                  costMax: "",
                  networkMin: "",
                  networkMax: "",
                },
              }));
              setPage(1);
            }}
          />
        </EC2InstancesTopBar>

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
      <Dialog open={insightsThresholdsOpen} onOpenChange={setInsightsThresholdsOpen}>
        <DialogContent className="w-[min(92vw,46rem)] max-w-none border border-[color:var(--border-light)] rounded-none p-4">
          <DialogHeader className="space-y-1 border-b border-[color:var(--border-light)] pb-4">
            <DialogTitle className="text-2xl font-semibold text-text-primary">Thresholds</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <EC2ExplorerThresholdsPopover
              value={insightsControls.thresholds}
              onChange={(nextThresholds) =>
                setInsightsControls((current) => ({
                  ...current,
                  thresholds: nextThresholds,
                }))
              }
              onReset={() =>
                setInsightsControls((current) => ({
                  ...current,
                  thresholds: { ...EC2_EXPLORER_DEFAULT_CONTROLS.thresholds },
                }))
              }
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

