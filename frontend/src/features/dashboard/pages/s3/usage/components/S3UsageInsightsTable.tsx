import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";

import { BaseDataTable } from "../../../../common/tables/BaseDataTable";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const quantityFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const quantityFormatterPrecise = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

export type S3UsageInsightsRow = {
  usageType: string;
  operation: string;
  cost: number;
  quantity: number;
  unit: string;
};

export type S3BucketUsageRow = {
  bucketName: string;
  quantity: number;
  storageGb?: number;
  transferGb?: number;
  requestCount?: number;
  region: string;
  usageInfo: string;
};

type Props = {
  rows: S3UsageInsightsRow[];
  bucketRows?: S3BucketUsageRow[];
  bucketQuantityLabel?: string;
  usageCategory?: "" | "storage" | "data_transfer" | "request";
  showAllCategoryBreakdown?: boolean;
  onBucketClick?: (bucketName: string) => void;
};

export function S3UsageInsightsTable({
  rows,
  bucketRows,
  bucketQuantityLabel = "Usage Quantity",
  usageCategory = "",
  showAllCategoryBreakdown = false,
  onBucketClick,
}: Props) {
  const usageColumnDefs = useMemo<ColDef<any>[]>(
    () => [
      { headerName: "Usage Type", field: "usageType", minWidth: 260 },
      { headerName: "Operation", field: "operation", minWidth: 220 },
      {
        headerName: usageCategory === "storage" ? "Storage (GB)" : usageCategory === "request" ? "Requests (Count)" : "Usage Quantity",
        field: "quantity",
        minWidth: 170,
        valueFormatter: (params) => quantityFormatter.format(Number(params.value ?? 0)),
      },
      { headerName: "Unit", field: "unit", minWidth: 140 },
      {
        headerName: "Cost",
        field: "cost",
        minWidth: 170,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
    ],
    [usageCategory],
  );
  const bucketColumnDefs = useMemo<ColDef<any>[]>(
    () => [
      {
        headerName: "Bucket",
        field: "bucketName",
        minWidth: 280,
        cellRenderer: (params: { value: string }) => {
          const bucketName = String(params.value ?? "");
          if (!bucketName) return <span>-</span>;
          return (
            <button
              type="button"
              onClick={() => onBucketClick?.(bucketName)}
              style={{
                border: 0,
                background: "transparent",
                padding: 0,
                color: "#1f5c86",
                textDecoration: "underline",
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {bucketName}
            </button>
          );
        },
      },
      ...(showAllCategoryBreakdown
        ? ([
            {
              headerName: "Storage (GB)",
              field: "storageGb",
              minWidth: 170,
              valueFormatter: (params: { value: number }) => quantityFormatterPrecise.format(Number(params.value ?? 0)),
            },
            {
              headerName: "Transfer (GB)",
              field: "transferGb",
              minWidth: 170,
              valueFormatter: (params: { value: number }) => quantityFormatterPrecise.format(Number(params.value ?? 0)),
            },
            {
              headerName: "Request (Count)",
              field: "requestCount",
              minWidth: 180,
              valueFormatter: (params: { value: number }) => quantityFormatterPrecise.format(Number(params.value ?? 0)),
            },
          ] as ColDef<any>[])
        : []),
      { headerName: "Region", field: "region", minWidth: 150 },
      { headerName: "Usage Info", field: "usageInfo", minWidth: 240 },
    ],
    [bucketQuantityLabel, onBucketClick, showAllCategoryBreakdown],
  );

  const showingBucketTable = Array.isArray(bucketRows) && bucketRows.length > 0;

  return (
    <BaseDataTable
      columnDefs={showingBucketTable ? bucketColumnDefs : usageColumnDefs}
      rowData={showingBucketTable ? ((bucketRows ?? []) as any[]) : (rows as any[])}
      emptyMessage="No usage rows available for the selected filters."
      pagination
      paginationPageSize={10}
      autoHeight
    />
  );
}
