import { useMemo } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { BaseDataTable } from "../../../common/tables/BaseDataTable";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 5,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 5,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export type S3BucketCombinedRow = {
  bucketName: string;
  account: string;
  region: string;
  totalCost: number;
  storageCost: number;
  requestCost: number;
  transferCost: number;
  storageGb: number;
  requestCount: number;
  transferGb: number;
  usageInfo: string;
};

type Props = {
  rows: S3BucketCombinedRow[];
  height?: number;
  onBucketClick?: (bucketName: string) => void;
};

export function S3BucketCombinedTable({ rows, height = 520, onBucketClick }: Props) {
  const columnDefs = useMemo<ColDef<S3BucketCombinedRow>[]>(
    () => [
      {
        headerName: "Bucket Name",
        field: "bucketName",
        width: 260,
        minWidth: 220,
        pinned: "left",
        cellRenderer: (params: ICellRendererParams<S3BucketCombinedRow, string>) => {
          const bucketName = String(params.value ?? "");
          if (!bucketName) return <span>-</span>;
          return (
            <button
              type="button"
              title={`Open details for ${bucketName}`}
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
      { headerName: "Account", field: "account", minWidth: 170 },
      { headerName: "Region", field: "region", minWidth: 150 },
      {
        headerName: "Total Cost",
        field: "totalCost",
        minWidth: 145,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Storage Cost",
        field: "storageCost",
        minWidth: 145,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Request Cost",
        field: "requestCost",
        minWidth: 145,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Transfer Cost",
        field: "transferCost",
        minWidth: 145,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Storage Usage (GB avg/day)",
        field: "storageGb",
        minWidth: 190,
        valueFormatter: (params) => decimalFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Request Usage (count)",
        field: "requestCount",
        minWidth: 170,
        valueFormatter: (params) => integerFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Transfer Usage (GB)",
        field: "transferGb",
        minWidth: 160,
        valueFormatter: (params) => decimalFormatter.format(Number(params.value ?? 0)),
      },
      { headerName: "Usage Info", field: "usageInfo", minWidth: 220 },
    ],
    [onBucketClick],
  );

  return (
    <BaseDataTable
      columnDefs={columnDefs}
      rowData={rows}
      height={height}
      emptyMessage="No S3 bucket rows available for the selected scope."
      pagination
      paginationPageSize={10}
      autoHeight
    />
  );
}
