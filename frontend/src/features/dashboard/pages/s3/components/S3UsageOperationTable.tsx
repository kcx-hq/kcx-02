import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";

import { BaseDataTable } from "../../../common/tables/BaseDataTable";

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

export type S3UsageOperationTableRow = {
  usageType: string;
  operation: string;
  cost: number;
  quantity: number;
  unit: string;
};

const mapUsageTypeLabel = (raw: string): string => {
  const value = String(raw ?? "").trim();
  const lower = value.toLowerCase();
  if (lower.includes("aps3-requests-tier1")) return "S3 Express Requests";
  if (lower.includes("aps3-timedstorage-bytehrs")) return "S3 Express Storage";
  if (lower.includes("requests-tier1")) return "Standard Requests";
  if (lower.includes("requests-tier2")) return "Advanced Requests";
  if (lower.includes("timedstorage-bytehrs")) return "Standard Storage";
  return value || "Unspecified";
};

type Props = {
  rows: S3UsageOperationTableRow[];
  height?: number;
  emptyMessage?: string;
};

export function S3UsageOperationTable({
  rows,
  height = 420,
  emptyMessage = "No usage type/operation rows available for this selection.",
}: Props) {
  const columnDefs = useMemo<ColDef<S3UsageOperationTableRow>[]>(
    () => [
      {
        headerName: "Operation",
        field: "operation",
        minWidth: 220,
      },
      {
        headerName: "Usage Type",
        field: "usageType",
        minWidth: 260,
        valueFormatter: (params) => mapUsageTypeLabel(String(params.value ?? "")),
      },
      {
        headerName: "Gross Cost",
        field: "cost",
        minWidth: 160,
        cellClass: "s3-analytics-number-cell",
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Quantity",
        field: "quantity",
        minWidth: 160,
        cellClass: "s3-analytics-number-cell",
        valueFormatter: (params) => quantityFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Unit",
        field: "unit",
        minWidth: 130,
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

