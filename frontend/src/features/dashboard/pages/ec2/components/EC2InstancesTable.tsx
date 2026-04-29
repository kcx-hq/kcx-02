import { useMemo } from "react";
import type { ColDef, ICellRendererParams, ValueFormatterParams } from "ag-grid-community";

import type { InventoryEc2InstanceRow } from "@/features/client-home/api/inventory-instances.api";
import { EmptyStateBlock } from "@/features/dashboard/common/components/EmptyStateBlock";
import { BaseDataTable } from "@/features/dashboard/common/tables/BaseDataTable";

type EC2InstancesTableProps = {
  rows: InventoryEc2InstanceRow[];
  volumeCostByInstanceId: Map<string, number>;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onOpenVolumesForInstance: (instanceId: string) => void;
  onOpenInstance: (instanceId: string) => void;
};

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return CURRENCY_FORMATTER.format(value);
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "-";
  return DATE_TIME_FORMATTER.format(new Date(parsed));
};

const getReservationType = (value: InventoryEc2InstanceRow["pricingType"]): string => {
  if (value === "on_demand") return "On-Demand";
  if (value === "savings_plan") return "Savings Plan";
  if (value === "reserved") return "Reserved";
  if (value === "spot") return "Spot";
  return "-";
};

const toTitle = (value: string | null): string => {
  if (!value) return "-";
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getRecommendation = (instance: InventoryEc2InstanceRow): string => {
  if (instance.isIdleCandidate) return "Idle: Stop or downsize";
  if (instance.isOverutilizedCandidate) return "Overutilized: Rightsize up";
  if (instance.isUnderutilizedCandidate) return "Underutilized: Rightsize down";
  return "Healthy";
};

const formatCount = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return Math.trunc(value).toLocaleString();
};

const formatSize = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString()} GB`;
};

const formatBytesToGb = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export function EC2InstancesTable({
  rows,
  volumeCostByInstanceId,
  loading,
  error,
  onRetry,
  onOpenVolumesForInstance,
  onOpenInstance,
}: EC2InstancesTableProps) {
  const columnDefs = useMemo<ColDef<InventoryEc2InstanceRow>[]>(
    () => [
      {
        headerName: "Instance",
        field: "instanceId",
        minWidth: 240,
        cellRenderer: (params: ICellRendererParams<InventoryEc2InstanceRow>) => {
          const instance = params.data;
          if (!instance) return "-";
          return (
            <div className="ec2-instances-table__instance-cell">
              <strong>{instance.instanceName ?? instance.instanceId}</strong>
              <span>{instance.instanceId}</span>
            </div>
          );
        },
      },
      {
        headerName: "Total Cost",
        field: "monthToDateCost",
        minWidth: 132,
        valueFormatter: (params: ValueFormatterParams<InventoryEc2InstanceRow, number | null | undefined>) =>
          formatCurrency(params.value),
      },
      {
        headerName: "Compute Cost",
        field: "computeCost",
        minWidth: 132,
        valueFormatter: (params: ValueFormatterParams<InventoryEc2InstanceRow, number | null | undefined>) =>
          formatCurrency(params.value),
      },
      {
        headerName: "CPU %",
        field: "cpuAvg",
        minWidth: 110,
        valueFormatter: (params: ValueFormatterParams<InventoryEc2InstanceRow, number | null | undefined>) =>
          formatPercent(params.value),
      },
      {
        headerName: "Network Usage",
        field: "networkUsageBytes",
        minWidth: 130,
        valueFormatter: (params: ValueFormatterParams<InventoryEc2InstanceRow, number | null | undefined>) =>
          formatBytesToGb(params.value),
      },
      {
        headerName: "Network Cost",
        minWidth: 120,
        field: "dataTransferCost",
        valueFormatter: (params: ValueFormatterParams<InventoryEc2InstanceRow, number | null | undefined>) =>
          formatCurrency(params.value),
      },
      {
        headerName: "Volume Cost",
        minWidth: 128,
        cellRenderer: (params: ICellRendererParams<InventoryEc2InstanceRow>) => {
          const row = params.data;
          if (!row) return "-";
          const cost = volumeCostByInstanceId.get(row.instanceId);
          return (
            <button
              type="button"
              className="ec2-linked-cell-btn"
              onClick={(event) => {
                event.stopPropagation();
                onOpenVolumesForInstance(row.instanceId);
              }}
            >
              {formatCurrency(cost)}
            </button>
          );
        },
      },
      {
        headerName: "Volume Count",
        field: "attachedVolumeCount",
        minWidth: 132,
        cellRenderer: (params: ICellRendererParams<InventoryEc2InstanceRow>) => {
          const row = params.data;
          if (!row) return "-";
          return (
            <button
              type="button"
              className="ec2-linked-cell-btn"
              onClick={(event) => {
                event.stopPropagation();
                onOpenVolumesForInstance(row.instanceId);
              }}
            >
              {formatCount(row.attachedVolumeCount)}
            </button>
          );
        },
      },
      {
        headerName: "Attached Volume Size",
        field: "attachedVolumeTotalSizeGb",
        minWidth: 172,
        cellRenderer: (params: ICellRendererParams<InventoryEc2InstanceRow>) => {
          const row = params.data;
          if (!row) return "-";
          return (
            <button
              type="button"
              className="ec2-linked-cell-btn"
              onClick={(event) => {
                event.stopPropagation();
                onOpenVolumesForInstance(row.instanceId);
              }}
            >
              {formatSize(row.attachedVolumeTotalSizeGb)}
            </button>
          );
        },
      },
      {
        headerName: "State",
        field: "state",
        minWidth: 110,
        valueFormatter: (params: ValueFormatterParams<InventoryEc2InstanceRow, string | null | undefined>) =>
          toTitle(params.value ?? null),
      },
      {
        headerName: "Instance Type",
        field: "instanceType",
        minWidth: 140,
        valueFormatter: (params: ValueFormatterParams<InventoryEc2InstanceRow, string | null | undefined>) =>
          params.value ?? "-",
      },
      {
        headerName: "Reservation Type",
        field: "pricingType",
        minWidth: 162,
        valueFormatter: (
          params: ValueFormatterParams<InventoryEc2InstanceRow, InventoryEc2InstanceRow["pricingType"]>,
        ) => getReservationType(params.value),
      },
      {
        headerName: "Region",
        minWidth: 190,
        valueGetter: (params) => params.data?.regionName ?? params.data?.regionId ?? params.data?.regionKey ?? "-",
      },
      {
        headerName: "Launch Time",
        field: "launchTime",
        minWidth: 178,
        valueFormatter: (params: ValueFormatterParams<InventoryEc2InstanceRow, string | null | undefined>) =>
          formatDateTime(params.value ?? null),
      },
      {
        headerName: "Recommendation",
        minWidth: 190,
        valueGetter: (params) => (params.data ? getRecommendation(params.data) : "-"),
      },
    ],
    [onOpenVolumesForInstance, volumeCostByInstanceId],
  );

  if (loading) {
    return <div className="ec2-explorer-table__skeleton" aria-hidden="true" />;
  }

  if (error) {
    return (
      <EmptyStateBlock
        title="Unable to load instances"
        message={error.message || "An unexpected error occurred."}
        actions={
          <button type="button" className="cost-explorer-state-btn" onClick={onRetry}>
            Retry
          </button>
        }
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyStateBlock
        title="No instances found"
        message="No EC2 instances match the active filters. Try resetting some filters."
      />
    );
  }

  return (
    <section className="ec2-explorer-table ec2-instances-table" aria-label="EC2 instances table">
      <BaseDataTable
        columnDefs={columnDefs}
        rowData={rows}
        pagination
        paginationPageSize={10}
        autoHeight
        onRowClick={(row) => onOpenInstance(row.instanceId)}
      />
    </section>
  );
}
