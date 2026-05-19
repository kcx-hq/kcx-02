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

export type S3UsageTypeCostTableRow = {
  usageType: string;
  grossCost: number;
  trendPct: number;
  topBucketName: string;
};

type Props = {
  rows: S3UsageTypeCostTableRow[];
  totalGrossS3Cost: number;
  height?: number;
  emptyMessage?: string;
};

function TrendCell(params: ICellRendererParams<S3UsageTypeCostTableRow, number>) {
  const trendPct = Number(params.value ?? 0);
  const direction = trendPct > 0 ? "Increase" : trendPct < 0 ? "Decrease" : "No change";
  const formatted = `${trendPct >= 0 ? "+" : ""}${percentFormatter.format(trendPct)}%`;
  return <span>{`${direction} (${formatted})`}</span>;
}

const formatCurrency = (value: number): string => {
  const safeValue = Number.isFinite(value) ? value : 0;
  if (Math.abs(safeValue) < 0.1 && safeValue !== 0) {
    return currencyFormatterPrecise.format(safeValue);
  }
  return currencyFormatterStandard.format(safeValue);
};

export function S3UsageTypeCostTable({
  rows,
  totalGrossS3Cost,
  height = 460,
  emptyMessage = "No usage type rows available for this selection.",
}: Props) {
  const columnDefs = useMemo<ColDef<S3UsageTypeCostTableRow>[]>(
    () => [
      {
        headerName: "Usage Type",
        field: "usageType",
        minWidth: 260,
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
        headerName: "% of S3 Cost",
        colId: "shareOfS3Cost",
        minWidth: 160,
        cellClass: "s3-analytics-number-cell",
        valueGetter: (params) => {
          const grossCost = Number(params.data?.grossCost ?? 0);
          if (totalGrossS3Cost <= 0) return 0;
          return (grossCost / totalGrossS3Cost) * 100;
        },
        valueFormatter: (params) => `${percentFormatter.format(Number(params.value ?? 0))}%`,
      },
      {
        headerName: "Trend",
        field: "trendPct",
        minWidth: 190,
        cellClass: "s3-analytics-number-cell",
        cellRenderer: TrendCell,
      },
      {
        headerName: "Top Bucket Name",
        field: "topBucketName",
        minWidth: 260,
      },
    ],
    [totalGrossS3Cost],
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
