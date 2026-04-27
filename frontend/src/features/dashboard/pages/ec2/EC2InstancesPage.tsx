import { useDeferredValue, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { InventoryEc2InstanceRow } from "@/features/client-home/api/inventory-instances.api";
import { TablePagination } from "@/features/client-home/components/TablePagination";
import { useInventoryEc2Instances } from "@/features/client-home/hooks/useInventoryEc2Instances";

import { EC2InstancesContextChips } from "./components/EC2InstancesContextChips";
import { EC2InstancesTable } from "./components/EC2InstancesTable";
import { EC2InstancesTopBar } from "./components/EC2InstancesTopBar";
import {
  EC2_INSTANCES_DEFAULT_CONTROLS,
  type EC2InstancesCondition,
  type EC2InstancesControlsState,
} from "./components/ec2Instances.types";

const PAGE_SIZE = 25;

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

const toPricingType = (value: EC2InstancesControlsState["reservationType"]) =>
  value === "all" ? null : value;

const normalizeGroupByLabel = (value: string): string => toTitle(value);

const EXPLORER_GRAPH_SOURCE = "explorer-graph";
const EXPLORER_TABLE_SOURCE = "explorer-table";

const parseCsvParam = (value: string | null): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const normalizeExplorerGroupBy = (value: string | null): string =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_");

const isIsoDate = (value: string | null): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const toReservationType = (value: string | null): EC2InstancesControlsState["reservationType"] => {
  if (value === "on_demand" || value === "reserved" || value === "savings_plan" || value === "spot") {
    return value;
  }
  return "all";
};

const toCondition = (value: string | null): EC2InstancesCondition =>
  value === "idle" || value === "underutilized" || value === "overutilized" || value === "uncovered" ? value : "all";

export default function EC2InstancesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const defaults = getDefaultDateRange();
  const startDateFromParams = queryParams.get("startDate") ?? queryParams.get("from") ?? defaults.start;
  const endDateFromParams = queryParams.get("endDate") ?? queryParams.get("to") ?? defaults.end;
  const querySearch = queryParams.get("search") ?? queryParams.get("instanceId") ?? "";
  const source = queryParams.get("source");
  const isFromExplorer =
    source === EXPLORER_GRAPH_SOURCE || source === EXPLORER_TABLE_SOURCE || Boolean(source?.startsWith("ec2-explorer"));
  const isGraphSource = source === EXPLORER_GRAPH_SOURCE || source === "ec2-explorer-chart";
  const selectedDate = queryParams.get("selectedDate") ?? queryParams.get("date");

  const explorerGroupBy = normalizeExplorerGroupBy(queryParams.get("groupBy") ?? queryParams.get("ec2GroupBy"));
  const explorerGroupValue =
    queryParams.get("groupValue") ?? queryParams.get("seriesLabel") ?? queryParams.get("seriesKey");
  const explorerTagKey = queryParams.get("tagKey");
  const explorerRegions = parseCsvParam(queryParams.get("region"));
  const explorerTags = parseCsvParam(queryParams.get("tags"));

  const scopedStartDate = isFromExplorer && isGraphSource && isIsoDate(selectedDate) ? selectedDate : startDateFromParams;
  const scopedEndDate = isFromExplorer && isGraphSource && isIsoDate(selectedDate) ? selectedDate : endDateFromParams;

  const initialControls = useMemo<EC2InstancesControlsState>(() => {
    const next: EC2InstancesControlsState = {
      ...EC2_INSTANCES_DEFAULT_CONTROLS,
      search: querySearch,
      scopeFilters: {
        region: [...explorerRegions],
        tags: [...explorerTags],
      },
      condition: toCondition(queryParams.get("condition")),
    };

    if (!isFromExplorer || !explorerGroupValue) {
      return next;
    }

    if (explorerGroupBy === "region") {
      if (!next.scopeFilters.region.includes(explorerGroupValue)) {
        next.scopeFilters.region.push(explorerGroupValue);
      }
      return next;
    }

    if (explorerGroupBy === "instance_type") {
      next.instanceType = explorerGroupValue;
      return next;
    }

    if (explorerGroupBy === "reservation_type") {
      next.reservationType = toReservationType(explorerGroupValue);
      return next;
    }

    if (explorerGroupBy === "tag") {
      const tagToken = explorerTagKey ? `${explorerTagKey}:${explorerGroupValue}` : explorerGroupValue;
      if (!next.scopeFilters.tags.includes(tagToken)) {
        next.scopeFilters.tags.push(tagToken);
      }
    }

    return next;
  }, [explorerGroupBy, explorerGroupValue, explorerRegions, explorerTagKey, explorerTags, isFromExplorer, queryParams, querySearch]);

  const [controls, setControls] = useState<EC2InstancesControlsState>(initialControls);
  const [page, setPage] = useState(1);

  const deferredSearch = useDeferredValue(controls.search.trim());

  const instancesQuery = useInventoryEc2Instances({
    state: controls.state === "all" ? null : controls.state,
    instanceType: controls.instanceType === "all" ? null : controls.instanceType,
    pricingType: toPricingType(controls.reservationType),
    search: deferredSearch.length > 0 ? deferredSearch : null,
    startDate: scopedStartDate,
    endDate: scopedEndDate,
    page,
    pageSize: PAGE_SIZE,
  });

  const items = instancesQuery.data?.items ?? [];
  const filteredRows = useMemo(
    () =>
      items.filter((instance) => {
        if (!matchesCondition(instance, controls.condition)) return false;
        if (!matchesState(instance, controls.state)) return false;
        if (!matchesRegion(instance, controls.scopeFilters.region)) return false;
        if (!matchesThresholds(instance, controls.thresholds)) return false;
        return true;
      }),
    [controls.condition, controls.scopeFilters.region, controls.state, controls.thresholds, items],
  );

  const instanceTypeOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        items
          .map((item) => item.instanceType)
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => a.localeCompare(b)),
      ),
    );

    if (controls.instanceType !== "all" && !unique.includes(controls.instanceType)) {
      unique.unshift(controls.instanceType);
    }

    return [{ key: "all", label: "All" }, ...unique.map((entry) => ({ key: entry, label: entry }))];
  }, [controls.instanceType, items]);

  const explorerContextLabel = useMemo(() => {
    if (!isFromExplorer) return null;
    const metric = queryParams.get("metric") ?? queryParams.get("ec2Metric");
    const groupBy = queryParams.get("groupBy") ?? queryParams.get("ec2GroupBy");
    const groupValue =
      queryParams.get("groupValue") ?? queryParams.get("seriesLabel") ?? queryParams.get("seriesKey");
    const dateValue = queryParams.get("selectedDate") ?? queryParams.get("date");

    if (metric && groupBy && groupValue) {
      const base = `From Explorer: ${toTitle(metric)} / ${normalizeGroupByLabel(groupBy)} = ${groupValue}`;
      if (isGraphSource && dateValue) return `${base} (${dateValue})`;
      return base;
    }

    if (metric) {
      const base = `From Explorer: ${toTitle(metric)}`;
      if (isGraphSource && dateValue) return `${base} (${dateValue})`;
      return base;
    }

    return "From Explorer";
  }, [isFromExplorer, isGraphSource, queryParams]);

  const clearExplorerContext = () => {
    const next = new URLSearchParams(location.search);
    [
      "source",
      "metric",
      "groupBy",
      "selectedDate",
      "startDate",
      "endDate",
      "tagKey",
      "region",
      "tags",
      "condition",
      "costBasis",
      "usageMetric",
      "aggregation",
      "ec2Metric",
      "ec2GroupBy",
      "groupValue",
      "seriesKey",
      "seriesLabel",
      "date",
    ].forEach((key) => next.delete(key));
    navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
    setControls((current) => ({ ...EC2_INSTANCES_DEFAULT_CONTROLS, search: current.search }));
    setPage(1);
  };

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

    if (controls.condition !== "all") {
      chips.push({
        id: "condition",
        label: `Condition: ${toTitle(controls.condition)}`,
        onRemove: () => setControls((current) => ({ ...current, condition: "all" })),
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

    if (controls.reservationType !== "all") {
      chips.push({
        id: "reservation-type",
        label: `Reservation Type: ${toTitle(controls.reservationType)}`,
        onRemove: () => setControls((current) => ({ ...current, reservationType: "all" })),
      });
    }

    const thresholdEntries: Array<{ key: keyof EC2InstancesControlsState["thresholds"]; label: string }> = [
      { key: "costMin", label: "Cost Min" },
      { key: "costMax", label: "Cost Max" },
      { key: "cpuMin", label: "CPU Min" },
      { key: "cpuMax", label: "CPU Max" },
      { key: "networkMin", label: "Network Min" },
      { key: "networkMax", label: "Network Max" },
    ];

    thresholdEntries.forEach(({ key, label }) => {
      const value = controls.thresholds[key].trim();
      if (value.length === 0) return;
      chips.push({
        id: key,
        label: `${label}: ${value}`,
        onRemove: () =>
          setControls((current) => ({
            ...current,
            thresholds: {
              ...current.thresholds,
              [key]: "",
            },
          })),
      });
    });

    return chips;
  }, [controls.condition, controls.instanceType, controls.reservationType, controls.scopeFilters, controls.state, controls.thresholds]);

  const hasThresholdFilters = Object.values(controls.thresholds).some((value) => value.trim().length > 0);
  const hasClientOnlyFilters =
    controls.condition !== "all" ||
    controls.scopeFilters.region.length > 0 ||
    controls.scopeFilters.tags.length > 0 ||
    hasThresholdFilters;

  const totalItems = hasClientOnlyFilters ? filteredRows.length : instancesQuery.data?.pagination.total ?? items.length;
  const totalPages = hasClientOnlyFilters ? 1 : instancesQuery.data?.pagination.totalPages ?? 1;
  const currentPage = hasClientOnlyFilters ? 1 : instancesQuery.data?.pagination.page ?? page;

  return (
    <div className="dashboard-page cost-explorer-page">
      <section className="cost-explorer-unified-shell" aria-label="EC2 instances list">
        <header className="space-y-1">
          <h1 className="text-[1.45rem] font-semibold leading-tight text-text-primary">Instances</h1>
          <p className="text-sm text-text-secondary">Showing EC2 instances for selected scope</p>
        </header>

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
        />

        <EC2InstancesContextChips
          chips={activeChips}
          explorerContextLabel={explorerContextLabel}
          onClearExplorerContext={isFromExplorer ? clearExplorerContext : undefined}
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

        <EC2InstancesTable
          rows={filteredRows}
          loading={instancesQuery.isLoading}
          error={instancesQuery.isError ? instancesQuery.error : null}
          onRetry={() => {
            void instancesQuery.refetch();
          }}
        />

        <TablePagination
          currentPage={currentPage}
          totalPages={Math.max(1, totalPages)}
          totalItems={Math.max(0, totalItems)}
          pageSize={PAGE_SIZE}
          onPrevious={() => {
            if (hasClientOnlyFilters) return;
            setPage((current) => Math.max(1, current - 1));
          }}
          onNext={() => {
            if (hasClientOnlyFilters) return;
            setPage((current) => Math.min(Math.max(1, totalPages), current + 1));
          }}
        />
      </section>
    </div>
  );
}
