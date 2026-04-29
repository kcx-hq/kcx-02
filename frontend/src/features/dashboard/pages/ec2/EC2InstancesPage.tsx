import { useDeferredValue, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { InventoryEc2InstanceRow } from "@/features/client-home/api/inventory-instances.api";
import { useInventoryEc2Instances } from "@/features/client-home/hooks/useInventoryEc2Instances";
import { useInventoryEc2Volumes } from "@/features/client-home/hooks/useInventoryEc2Volumes";

import { EC2InstancesContextChips } from "./components/EC2InstancesContextChips";
import { EC2InstancesTable } from "./components/EC2InstancesTable";
import { EC2InstancesTopBar } from "./components/EC2InstancesTopBar";
import {
  EC2_INSTANCES_RESERVATION_OPTIONS,
  EC2_INSTANCES_DEFAULT_CONTROLS,
  EC2_INSTANCES_CONDITION_OPTIONS,
  EC2_INSTANCES_STATE_OPTIONS,
  type EC2InstancesCondition,
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

const isValidCondition = (value: string | null): value is EC2InstancesCondition =>
  Boolean(value) && EC2_INSTANCES_CONDITION_OPTIONS.some((option) => option.key === value);

const isValidState = (value: string | null): value is EC2InstancesControlsState["state"] =>
  Boolean(value) && EC2_INSTANCES_STATE_OPTIONS.some((option) => option.key === value);

const isValidReservationType = (value: string | null): value is EC2InstancesControlsState["reservationType"] =>
  Boolean(value) && EC2_INSTANCES_RESERVATION_OPTIONS.some((option) => option.key === value);

const matchesCondition = (instance: InventoryEc2InstanceRow, condition: EC2InstancesCondition): boolean => {
  if (condition === "all") return true;
  if (condition === "idle") return instance.isIdleCandidate === true;
  if (condition === "underutilized") return instance.isUnderutilizedCandidate === true;
  if (condition === "overutilized") return instance.isOverutilizedCandidate === true;
  if (condition === "uncovered") return (instance.uncoveredHours ?? 0) > 0;
  return true;
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

const buildFlatTrend = (endDate: string, value: number) => {
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return [] as Array<{ label: string; value: number }>;
  const output: Array<{ label: string; value: number }> = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - i);
    output.push({ label: date.toISOString().slice(5, 10), value });
  }
  return output;
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
  const querySearch = isExplorerNavigation ? queryParams.get("search") ?? "" : "";

  const explorerRegions = isExplorerNavigation ? parseCsvParam(queryParams.get("region")) : [];
  const explorerTags = isExplorerNavigation ? parseCsvParam(queryParams.get("tags")) : [];
  const queryCondition = isExplorerNavigation ? queryParams.get("condition") : null;
  const queryState = isExplorerNavigation ? queryParams.get("state") : null;
  const queryInstanceType = isExplorerNavigation ? queryParams.get("instanceType") : null;
  const queryReservationType = isExplorerNavigation ? queryParams.get("reservationType") : null;

  const initialControls = useMemo<EC2InstancesControlsState>(() => ({
    ...EC2_INSTANCES_DEFAULT_CONTROLS,
    condition: isValidCondition(queryCondition) ? queryCondition : EC2_INSTANCES_DEFAULT_CONTROLS.condition,
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
  }), [explorerRegions, explorerTags, queryCondition, queryInstanceType, queryReservationType, querySearch, queryState]);

  const [controls, setControls] = useState<EC2InstancesControlsState>(initialControls);
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(controls.search.trim());

  const instancesQuery = useInventoryEc2Instances({
    state: controls.state === "all" ? null : controls.state,
    instanceType: controls.instanceType === "all" ? null : controls.instanceType,
    pricingType: controls.reservationType === "all" ? null : controls.reservationType,
    search: deferredSearch.length > 0 ? deferredSearch : null,
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
        if (!matchesCondition(instance, controls.condition)) return false;
        if (!matchesState(instance, controls.state)) return false;
        if (!matchesRegion(instance, controls.scopeFilters.region)) return false;
        if (!matchesThresholds(instance, controls.thresholds)) return false;
        return true;
      }),
    [allItems, controls.condition, controls.scopeFilters.region, controls.state, controls.thresholds],
  );

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

    return chips;
  }, [controls.instanceType, controls.scopeFilters.region, controls.scopeFilters.tags, controls.state]);

  const openInstanceDetail = (instanceId: string) => {
    const next = new URLSearchParams(location.search);
    next.set("instanceId", instanceId);
    next.set("search", instanceId);
    navigate({ pathname: `${INSTANCES_PAGE_PATH}/${instanceId}`, search: next.toString() });
  };

  return (
    <div className="dashboard-page cost-explorer-page">
      <section aria-label="EC2 instances list">
        <EC2InstancesTopBar
          value={controls}
          instanceTypeOptions={instanceTypeOptions}
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
              setControls((current) => ({
                ...current,
                condition: "all",
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
          loading={instancesQuery.isLoading}
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
