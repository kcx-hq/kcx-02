import { useMemo } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";

import { BaseDataTable } from "../../../common/tables/BaseDataTable";
import type { S3BucketTableRow } from "./S3BucketInsightsTable.types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DRIVER_LABELS = new Set(["storage", "request", "retrieval", "transfer"]);

type Props = {
  rows: S3BucketTableRow[];
  totalGrossCost?: number;
  height?: number;
  emptyMessage?: string;
  onBucketClick?: (bucketName: string) => void;
};

const getMainDriver = (row: S3BucketTableRow): string => {
  const normalized = String(row.driver ?? "").trim().toLowerCase();
  if (DRIVER_LABELS.has(normalized)) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  const candidates: Array<{ key: "Storage" | "Request" | "Retrieval" | "Transfer"; value: number }> = [
    { key: "Storage", value: Number(row.storage ?? 0) },
    { key: "Request", value: Number(row.requests ?? 0) },
    { key: "Retrieval", value: Number(row.retrieval ?? 0) },
    { key: "Transfer", value: Number(row.transfer ?? 0) },
  ];
  candidates.sort((a, b) => b.value - a.value);
  return candidates[0]?.key ?? "Storage";
};

function TransferCostCell(params: ICellRendererParams<S3BucketTableRow, number>) {
  const row = params.data;
  if (!row) return <span>Shared / Not attributed</span>;
  if (String(row.bucketName).trim().toLowerCase() === "unattributed") {
    return <span>Shared / Not attributed</span>;
  }
  return <span>{currencyFormatter.format(Number(params.value ?? 0))}</span>;
}

function TrendCell(params: ICellRendererParams<S3BucketTableRow, number>) {
  const trendPct = Number(params.value ?? 0);
  const direction = trendPct > 0 ? "Increase" : trendPct < 0 ? "Decrease" : "No change";
  const formatted = `${trendPct >= 0 ? "+" : ""}${percentFormatter.format(trendPct)}%`;
  return <span>{`${direction} (${formatted})`}</span>;
}

export function S3BucketInsightsTable({
  rows,
  totalGrossCost = 0,
  height = 520,
  emptyMessage = "No S3 bucket data available for the selected scope.",
  onBucketClick,
}: Props) {
  const columnDefs = useMemo<ColDef<S3BucketTableRow>[]>(
    () => [
      {
        headerName: "Bucket Name",
        field: "bucketName",
        width: 260,
        minWidth: 220,
        pinned: "left",
        cellRenderer: (params: ICellRendererParams<S3BucketTableRow, string>) => {
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
        headerName: "Gross Cost",
        field: "cost",
        minWidth: 150,
        cellClass: "s3-analytics-number-cell",
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Storage Cost",
        field: "storage",
        minWidth: 150,
        cellClass: "s3-analytics-number-cell",
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Request Cost",
        field: "requests",
        minWidth: 150,
        cellClass: "s3-analytics-number-cell",
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Transfer Cost",
        field: "transfer",
        minWidth: 190,
        cellClass: "s3-analytics-number-cell",
        cellRenderer: TransferCostCell,
      },
      {
        headerName: "% of Bucket Cost",
        colId: "shareOfS3Cost",
        minWidth: 140,
        cellClass: "s3-analytics-number-cell",
        valueGetter: (params) => {
          const rowCost = Number(params.data?.cost ?? 0);
          if (totalGrossCost <= 0) return 0;
          return (rowCost / totalGrossCost) * 100;
        },
        valueFormatter: (params) => `${percentFormatter.format(Number(params.value ?? 0))}%`,
      },
      {
        headerName: "Main Cost Driver",
        colId: "mainCostDriver",
        minWidth: 170,
        valueGetter: (params) => getMainDriver(params.data as S3BucketTableRow),
      },
      {
        headerName: "Trend",
        field: "trendPct",
        minWidth: 190,
        cellClass: "s3-analytics-number-cell",
        cellRenderer: TrendCell,
      },
    ],
    [onBucketClick, totalGrossCost],
  );

  return (
    <BaseDataTable
      columnDefs={columnDefs}
      rowData={rows}
      height={height}
      emptyMessage={emptyMessage}
      pagination
      paginationPageSize={10}
      autoHeight
    />
  );
}

