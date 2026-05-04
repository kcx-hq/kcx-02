import { useMemo } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { BaseDataTable } from "../../../common/tables/BaseDataTable";

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export type S3BucketUsageSummaryRow = {
  bucketName: string;
  region: string;
  storageGb: number;
  requestCount: number;
  transferGb: number;
  usageInfo: string;
};

type Props = {
  rows: S3BucketUsageSummaryRow[];
  height?: number;
  onBucketClick?: (bucketName: string) => void;
};

export function S3BucketUsageSummaryTable({ rows, height = 520, onBucketClick }: Props) {
  const columnDefs = useMemo<ColDef<S3BucketUsageSummaryRow>[]>(
    () => [
      {
        headerName: "Bucket Name",
        field: "bucketName",
        width: 260,
        minWidth: 220,
        pinned: "left",
        cellRenderer: (params: ICellRendererParams<S3BucketUsageSummaryRow, string>) => {
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
      {
        headerName: "Region",
        field: "region",
        minWidth: 150,
      },
      {
        headerName: "Storage Usage (GB avg/day)",
        field: "storageGb",
        minWidth: 200,
        valueFormatter: (params) => decimalFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Request Usage (count)",
        field: "requestCount",
        minWidth: 190,
        valueFormatter: (params) => integerFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Transfer Usage (GB)",
        field: "transferGb",
        minWidth: 170,
        valueFormatter: (params) => decimalFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Usage Info",
        field: "usageInfo",
        minWidth: 220,
      },
    ],
    [onBucketClick],
  );

  return (
    <BaseDataTable
      columnDefs={columnDefs}
      rowData={rows}
      height={height}
      emptyMessage="No S3 bucket usage rows available for the selected scope."
      pagination
      paginationPageSize={10}
      autoHeight
    />
  );
}

