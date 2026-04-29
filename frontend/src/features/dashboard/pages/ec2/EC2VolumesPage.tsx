import { useDeferredValue, useMemo, useState } from "react";
import type { ColDef, ICellRendererParams, ValueFormatterParams } from "ag-grid-community";
import { useLocation, useNavigate } from "react-router-dom";

import type { InventoryEc2VolumeRow } from "@/features/client-home/api/inventory-volumes.api";
import { useInventoryEc2Volumes } from "@/features/client-home/hooks/useInventoryEc2Volumes";
import { EmptyStateBlock } from "@/features/dashboard/common/components/EmptyStateBlock";
import { BaseDataTable } from "@/features/dashboard/common/tables/BaseDataTable";
import { EC2InstancesContextChips } from "@/features/dashboard/pages/ec2/components/EC2InstancesContextChips";
import { EC2VolumesTopBar } from "@/features/dashboard/pages/ec2/components/EC2VolumesTopBar";
import {
  EC2_VOLUMES_DEFAULT_CONTROLS,
  type EC2VolumesControlsState,
} from "@/features/dashboard/pages/ec2/components/ec2Volumes.types";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const VOLUMES_PAGE_PATH = "/dashboard/inventory/aws/ec2/volumes";
const OPTIMIZATION_PAGE_PATH = "/dashboard/ec2/optimization";
const INSTANCE_DETAIL_PATH = "/dashboard/inventory/aws/ec2/instances";

const parseNumberOrNull = (value: string): number | null => {
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toTitle = (value: string | null | undefined): string => {
  if (!value) return "-";
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return CURRENCY_FORMATTER.format(value);
};

const formatSize = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString()} GB`;
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "-";
  return DATE_TIME_FORMATTER.format(new Date(parsed));
};

const getAttachmentLabel = (volume: InventoryEc2VolumeRow): "Attached" | "Unattached" =>
  volume.isAttached ? "Attached" : "Unattached";

const getRecommendation = (volume: InventoryEc2VolumeRow): string => {
  if (volume.isUnattached) return "Delete Unattached";
  if (volume.isAttachedToStoppedInstance) return "Review Stopped Instance";
  if (volume.isIdleCandidate) return "Idle Volume";
  if (volume.isUnderutilizedCandidate) return "Downsize Volume";
  return "Healthy";
};

const getRecommendationTone = (volume: InventoryEc2VolumeRow): string => {
  if (volume.isUnattached || volume.isAttachedToStoppedInstance) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (volume.isIdleCandidate || volume.isUnderutilizedCandidate) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const matchesScopeRegion = (volume: InventoryEc2VolumeRow, regions: string[]): boolean => {
  if (regions.length === 0) return true;
  const normalized = regions.map((entry) => entry.toLowerCase());
  const candidates = [volume.regionKey, volume.regionId, volume.regionName]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  return candidates.some((candidate) => normalized.includes(candidate));
};

const matchesScopeTags = (volume: InventoryEc2VolumeRow, tags: string[]): boolean => {
  if (tags.length === 0) return true;
  const source = volume.tags;
  if (!source || typeof source !== "object") return false;
  const tagEntries = Object.entries(source).flatMap(([key, raw]) => {
    const value = typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean" ? String(raw) : "";
    return [key.toLowerCase(), value.toLowerCase(), `${key}:${value}`.toLowerCase()];
  });
  return tags.every((tag) => {
    const normalized = tag.trim().toLowerCase();
    if (normalized.length === 0) return true;
    return tagEntries.some((entry) => entry.includes(normalized));
  });
};

const matchesThresholds = (volume: InventoryEc2VolumeRow, thresholds: EC2VolumesControlsState["thresholds"]): boolean => {
  const costMin = parseNumberOrNull(thresholds.costMin);
  const costMax = parseNumberOrNull(thresholds.costMax);
  const sizeMin = parseNumberOrNull(thresholds.sizeMin);
  const sizeMax = parseNumberOrNull(thresholds.sizeMax);

  const cost = volume.mtdCost;
  const size = volume.sizeGb;

  if (costMin !== null && cost < costMin) return false;
  if (costMax !== null && cost > costMax) return false;
  if (sizeMin !== null && (size === null || size < sizeMin)) return false;
  if (sizeMax !== null && (size === null || size > sizeMax)) return false;
  return true;
};

const matchesSearch = (volume: InventoryEc2VolumeRow, search: string): boolean => {
  const query = search.trim().toLowerCase();
  if (query.length === 0) return true;
  const fields = [volume.volumeId, volume.volumeName, volume.attachedInstanceId, volume.attachedInstanceName]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  return fields.some((field) => field.includes(query));
};

export default function EC2VolumesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const source = queryParams.get("source");
  const isInstancesVolumeNavigation = source === "instances-volume-link";
  const selectedStartDate =
    queryParams.get("billingPeriodStart") ?? queryParams.get("from") ?? queryParams.get("startDate");
  const selectedEndDate =
    queryParams.get("billingPeriodEnd") ?? queryParams.get("to") ?? queryParams.get("endDate");
  const attachedInstanceIdFilter = isInstancesVolumeNavigation ? queryParams.get("attachedInstanceId") : null;

  const [controls, setControls] = useState<EC2VolumesControlsState>({
    ...EC2_VOLUMES_DEFAULT_CONTROLS,
    search: isInstancesVolumeNavigation ? queryParams.get("search") ?? "" : "",
  });
  const deferredSearch = useDeferredValue(controls.search.trim());

  const query = useInventoryEc2Volumes({
    attachedInstanceId: attachedInstanceIdFilter,
    startDate: selectedStartDate,
    endDate: selectedEndDate,
    state: controls.state === "all" ? null : controls.state,
    volumeType: controls.volumeType === "all" ? null : controls.volumeType,
    attachmentState: controls.attachment === "all" ? null : controls.attachment,
    region: controls.scopeFilters.region.length === 1 ? controls.scopeFilters.region[0] : null,
    search: deferredSearch.length > 0 ? deferredSearch : null,
    sortBy: "mtdCost",
    sortDirection: "desc",
    page: 1,
    pageSize: 500,
  });

  const rows = useMemo(
    () =>
      (query.data?.items ?? []).filter((volume) => {
        if (controls.state !== "all" && (volume.state ?? "").trim().toLowerCase() !== controls.state) return false;
        if (controls.volumeType !== "all" && (volume.volumeType ?? "").trim().toLowerCase() !== controls.volumeType) return false;
        if (controls.attachment === "attached" && volume.isAttached !== true) return false;
        if (controls.attachment === "unattached" && volume.isAttached === true) return false;
        if (!matchesScopeRegion(volume, controls.scopeFilters.region)) return false;
        if (!matchesScopeTags(volume, controls.scopeFilters.tags)) return false;
        if (!matchesThresholds(volume, controls.thresholds)) return false;
        if (!matchesSearch(volume, deferredSearch)) return false;
        return true;
      }),
    [controls.attachment, controls.scopeFilters.region, controls.scopeFilters.tags, controls.state, controls.thresholds, controls.volumeType, deferredSearch, query.data?.items],
  );

  const columnDefs = useMemo<ColDef<InventoryEc2VolumeRow>[]>(
    () => [
      {
        headerName: "Volume",
        field: "volumeId",
        minWidth: 220,
        cellRenderer: (params: ICellRendererParams<InventoryEc2VolumeRow>) => {
          const row = params.data;
          if (!row) return "-";
          return (
            <div className="ec2-instances-table__instance-cell">
              <strong>{row.volumeName ?? row.volumeId}</strong>
              <span>{row.volumeId}</span>
            </div>
          );
        },
      },
      {
        headerName: "Cost",
        field: "mtdCost",
        minWidth: 130,
        valueFormatter: (params: ValueFormatterParams<InventoryEc2VolumeRow, number | null | undefined>) =>
          formatCurrency(params.value),
      },
      {
        headerName: "Size",
        field: "sizeGb",
        minWidth: 120,
        valueFormatter: (params: ValueFormatterParams<InventoryEc2VolumeRow, number | null | undefined>) =>
          formatSize(params.value),
      },
      {
        headerName: "Type",
        field: "volumeType",
        minWidth: 110,
        valueFormatter: (params: ValueFormatterParams<InventoryEc2VolumeRow, string | null | undefined>) =>
          params.value ?? "-",
      },
      {
        headerName: "State",
        field: "state",
        minWidth: 120,
        valueFormatter: (params: ValueFormatterParams<InventoryEc2VolumeRow, string | null | undefined>) =>
          toTitle(params.value),
      },
      {
        headerName: "Attachment",
        minWidth: 130,
        valueGetter: (params) => (params.data ? getAttachmentLabel(params.data) : "-"),
      },
      {
        headerName: "Attached Instance",
        minWidth: 220,
        cellRenderer: (params: ICellRendererParams<InventoryEc2VolumeRow>) => {
          const row = params.data;
          if (!row) return "-";
          if (!row.attachedInstanceId || row.isAttached !== true) return "Unattached";
          return (
            <button
              type="button"
              className="ec2-linked-cell-btn"
              onClick={(event) => {
                event.stopPropagation();
                const next = new URLSearchParams(location.search);
                next.delete("attachedInstanceId");
                next.delete("volumeId");
                next.set("instanceId", row.attachedInstanceId ?? "");
                next.set("search", row.attachedInstanceId ?? "");
                navigate({ pathname: `${INSTANCE_DETAIL_PATH}/${row.attachedInstanceId}`, search: next.toString() });
              }}
            >
              <span className="ec2-instances-table__instance-cell">
                <strong>{row.attachedInstanceName ?? row.attachedInstanceId}</strong>
                <span>{row.attachedInstanceId}</span>
              </span>
            </button>
          );
        },
      },
      {
        headerName: "Instance State",
        field: "attachedInstanceState",
        minWidth: 130,
        valueFormatter: (params: ValueFormatterParams<InventoryEc2VolumeRow, string | null | undefined>) =>
          toTitle(params.value),
      },
      {
        headerName: "Last Attached Time",
        minWidth: 190,
        valueGetter: (params) => {
          const metadata = params.data?.metadata;
          if (!metadata || typeof metadata !== "object") return "-";
          const candidate = metadata.lastAttachedTime ?? metadata.lastAttachedAt ?? metadata.attachTime ?? null;
          return typeof candidate === "string" ? formatDateTime(candidate) : "-";
        },
      },
      {
        headerName: "Region",
        minWidth: 180,
        valueGetter: (params) => params.data?.regionName ?? params.data?.regionId ?? params.data?.regionKey ?? "-",
      },
      {
        headerName: "Created Time",
        minWidth: 190,
        valueGetter: (params) => formatDateTime(params.data?.discoveredAt ?? params.data?.usageDate),
      },
      {
        headerName: "Recommendation",
        minWidth: 220,
        cellRenderer: (params: ICellRendererParams<InventoryEc2VolumeRow>) => {
          const row = params.data;
          if (!row) return "-";
          return (
            <button
              type="button"
              className={cn("rounded-full border px-2 py-1 text-xs font-medium", getRecommendationTone(row))}
              onClick={(event) => {
                event.stopPropagation();
                const next = new URLSearchParams(location.search);
                next.set("source", "volume-recommendation");
                next.set("volumeId", row.volumeId);
                navigate({ pathname: OPTIMIZATION_PAGE_PATH, search: next.toString() });
              }}
            >
              {getRecommendation(row)}
            </button>
          );
        },
      },
    ],
    [location.search, navigate],
  );

  const activeChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove?: () => void }> = [];

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

    if (controls.state !== "all") {
      chips.push({
        id: "state",
        label: `State: ${controls.state === "in-use" ? "In Use" : "Available"}`,
        onRemove: () => setControls((current) => ({ ...current, state: "all" })),
      });
    }

    if (controls.volumeType !== "all") {
      chips.push({
        id: "volume-type",
        label: `Type: ${controls.volumeType}`,
        onRemove: () => setControls((current) => ({ ...current, volumeType: "all" })),
      });
    }

    if (controls.attachment !== "all") {
      chips.push({
        id: "attachment",
        label: `Attachment: ${controls.attachment === "attached" ? "Attached" : "Unattached"}`,
        onRemove: () => setControls((current) => ({ ...current, attachment: "all" })),
      });
    }

    const thresholds: Array<{ key: keyof EC2VolumesControlsState["thresholds"]; label: string }> = [
      { key: "costMin", label: "Cost Min" },
      { key: "costMax", label: "Cost Max" },
      { key: "sizeMin", label: "Size Min" },
      { key: "sizeMax", label: "Size Max" },
    ];

    thresholds.forEach(({ key, label }) => {
      const value = controls.thresholds[key].trim();
      if (!value) return;
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
  }, [controls.attachment, controls.scopeFilters.region, controls.scopeFilters.tags, controls.state, controls.thresholds, controls.volumeType]);

  const volumesErrorMessage =
    query.error instanceof ApiError
      ? query.error.message
      : query.error instanceof Error
        ? query.error.message
        : "Failed to load EC2 volumes.";

  return (
    <div className="dashboard-page cost-explorer-page">
      <section aria-label="EC2 volumes inventory">
        <EC2VolumesTopBar
          value={controls}
          onChange={(next) => setControls(next)}
          onReset={() => setControls({ ...EC2_VOLUMES_DEFAULT_CONTROLS })}
        >
          <EC2InstancesContextChips
            chips={activeChips}
            onClearAll={() =>
              setControls((current) => ({
                ...current,
                state: "all",
                volumeType: "all",
                attachment: "all",
                scopeFilters: { region: [], tags: [] },
                thresholds: {
                  costMin: "",
                  costMax: "",
                  sizeMin: "",
                  sizeMax: "",
                },
              }))
            }
          />
        </EC2VolumesTopBar>

        <section className="ec2-explorer-table-panel" aria-label="EC2 volumes table">
          {query.isLoading ? (
            <div className="ec2-explorer-table__skeleton" aria-hidden="true" />
          ) : query.isError ? (
            <EmptyStateBlock
              title="Unable to load volumes"
              message={volumesErrorMessage}
              actions={
                <button
                  type="button"
                  className="cost-explorer-state-btn"
                  onClick={() => {
                    void query.refetch();
                  }}
                >
                  Retry
                </button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyStateBlock
              title="No volumes found"
              message="No EC2 volumes match the active filters. Try resetting some filters."
            />
          ) : (
            <BaseDataTable
              columnDefs={columnDefs}
              rowData={rows}
              pagination
              paginationPageSize={10}
              autoHeight
              onRowClick={(row) => {
                const next = new URLSearchParams(location.search);
                next.set("volumeId", row.volumeId);
                next.set("search", row.volumeId);
                next.set("volumeName", row.volumeName ?? row.volumeId);
                navigate({ pathname: `${VOLUMES_PAGE_PATH}/${row.volumeId}`, search: next.toString() });
              }}
            />
          )}
        </section>
      </section>
    </div>
  );
}
