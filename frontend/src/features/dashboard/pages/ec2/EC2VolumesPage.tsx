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

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const VOLUMES_PAGE_PATH = "/dashboard/inventory/aws/ec2/volumes";
const SNAPSHOTS_PAGE_PATH = "/dashboard/inventory/aws/ec2/snapshots";

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

const getAttachmentLabel = (volume: InventoryEc2VolumeRow): "Attached" | "Unattached" =>
  volume.isAttached ? "Attached" : "Unattached";

const formatVolumeStatus = (volume: InventoryEc2VolumeRow): string => {
  const raw = volume.statusLabel ?? volume.status;
  if (!raw) return "-";
  return toTitle(raw);
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
  const volumeIdFromQuery = queryParams.get("volumeId")?.trim() ?? "";
  const volumeIdFilter = volumeIdFromQuery.length > 0 ? volumeIdFromQuery : null;

  const [controls, setControls] = useState<EC2VolumesControlsState>({
    ...EC2_VOLUMES_DEFAULT_CONTROLS,
    search: isInstancesVolumeNavigation ? queryParams.get("search") ?? "" : "",
  });
  const deferredSearch = useDeferredValue(controls.search.trim());

  const query = useInventoryEc2Volumes({
    volumeId: volumeIdFilter,
    attachedInstanceId: attachedInstanceIdFilter,
    startDate: selectedStartDate,
    endDate: selectedEndDate,
    state: controls.state === "all" ? null : controls.state,
    volumeType: controls.volumeType === "all" ? null : controls.volumeType,
    attachmentState: controls.attachment === "all" ? null : controls.attachment,
    signal: controls.status === "all" ? null : controls.status,
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
        if (controls.status !== "all" && (volume.status ?? "").trim().toLowerCase() !== controls.status) return false;
        if (!matchesScopeRegion(volume, controls.scopeFilters.region)) return false;
        if (!matchesScopeTags(volume, controls.scopeFilters.tags)) return false;
        if (!matchesThresholds(volume, controls.thresholds)) return false;
        if (!matchesSearch(volume, deferredSearch)) return false;
        return true;
      }),
    [controls.attachment, controls.scopeFilters.region, controls.scopeFilters.tags, controls.state, controls.status, controls.thresholds, controls.volumeType, deferredSearch, query.data?.items],
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
        headerName: "Status",
        minWidth: 220,
        valueGetter: (params) => (params.data ? formatVolumeStatus(params.data) : "-"),
      },
      {
        headerName: "Snapshot Count",
        minWidth: 160,
        cellRenderer: (params: ICellRendererParams<InventoryEc2VolumeRow>) => {
          const row = params.data;
          if (!row) return "-";
          if ((row.snapshotCount ?? 0) <= 0) return "0";
          return (
            <button
              type="button"
              className="ec2-linked-cell-btn"
              onClick={(event) => {
                event.stopPropagation();
                const next = new URLSearchParams(location.search);
                next.set("volumeId", row.volumeId);
                navigate({ pathname: SNAPSHOTS_PAGE_PATH, search: next.toString() });
              }}
            >
              {row.snapshotCount}
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

    if (controls.status !== "all") {
      chips.push({
        id: "status",
        label: `Status: ${toTitle(controls.status)}`,
        onRemove: () => setControls((current) => ({ ...current, status: "all" })),
      });
    }

    if (volumeIdFilter) {
      chips.push({
        id: "volume-id",
        label: `Volume: ${volumeIdFilter}`,
        onRemove: () => {
          const next = new URLSearchParams(location.search);
          next.delete("volumeId");
          navigate({ pathname: VOLUMES_PAGE_PATH, search: next.toString() }, { replace: true });
        },
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
  }, [controls.attachment, controls.scopeFilters.region, controls.scopeFilters.tags, controls.state, controls.status, controls.thresholds, controls.volumeType, location.search, navigate, volumeIdFilter]);

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
                status: "all",
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
              title={volumeIdFilter ? "Volume not found" : "No volumes found"}
              message={
                volumeIdFilter
                  ? `No EC2 volume found for volumeId "${volumeIdFilter}".`
                  : "No EC2 volumes match the active filters. Try resetting some filters."
              }
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
