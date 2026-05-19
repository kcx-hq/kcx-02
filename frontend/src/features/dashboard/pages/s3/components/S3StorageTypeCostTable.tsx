import { useMemo } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";

import { BaseDataTable } from "../../../common/tables/BaseDataTable";

const currencyFormatterStandard = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormatterPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type S3StorageTypeCostTableRow = {
  storageType: string;
  grossCost: number;
  percentOfStorageCost: number;
  trendPct: number;
  topBucketName: string;
  optimizationSignal: "Storage Heavy" | "Request Heavy" | "Transfer Heavy" | "Retrieval Heavy" | "Other Heavy" | "Balanced";
};

const formatCurrency = (value: number): string => {
  const safeValue = Number.isFinite(value) ? value : 0;
  if (Math.abs(safeValue) < 0.1 && safeValue !== 0) {
    return currencyFormatterPrecise.format(safeValue);
  }
  return currencyFormatterStandard.format(safeValue);
};

function TrendCell(params: ICellRendererParams<S3StorageTypeCostTableRow, number>) {
  const trendPct = Number(params.value ?? 0);
  const direction = trendPct > 0 ? "Increase" : trendPct < 0 ? "Decrease" : "No change";
  const formatted = `${trendPct >= 0 ? "+" : ""}${percentFormatter.format(trendPct)}%`;
  return <span>{`${direction} (${formatted})`}</span>;
}

type Props = {
  rows: S3StorageTypeCostTableRow[];
  height?: number;
  emptyMessage?: string;
};

export function S3StorageTypeCostTable({
  rows,
  height = 460,
  emptyMessage = "No storage type rows available for this selection.",
}: Props) {
  const columnDefs = useMemo<ColDef<S3StorageTypeCostTableRow>[]>(
    () => [
      {
        headerName: "Storage Type",
        field: "storageType",
        minWidth: 220,
        pinned: "left",
      },
      {
        headerName: "Gross Cost",
        field: "grossCost",
        minWidth: 170,
        cellClass: "s3-analytics-number-cell",
        valueFormatter: (params) => formatCurrency(Number(params.value ?? 0)),
      },
      {
        headerName: "% of Storage Cost",
        field: "percentOfStorageCost",
        minWidth: 180,
        cellClass: "s3-analytics-number-cell",
        valueFormatter: (params) => `${percentFormatter.format(Number(params.value ?? 0))}%`,
      },
      {
        headerName: "Top Bucket",
        field: "topBucketName",
        minWidth: 250,
      },
      {
        headerName: "Trend",
        field: "trendPct",
        minWidth: 190,
        cellClass: "s3-analytics-number-cell",
        cellRenderer: TrendCell,
      },
      {
        headerName: "Optimization Signal",
        field: "optimizationSignal",
        minWidth: 210,
      },
    ],
    [],
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

