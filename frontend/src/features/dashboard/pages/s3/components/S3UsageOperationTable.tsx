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
        headerName: "Usage Type",
        field: "usageType",
        minWidth: 260,
      },
      {
        headerName: "Operation",
        field: "operation",
        minWidth: 220,
      },
      {
        headerName: "Cost",
        field: "cost",
        minWidth: 160,
        valueFormatter: (params) => currencyFormatter.format(Number(params.value ?? 0)),
      },
      {
        headerName: "Quantity",
        field: "quantity",
        minWidth: 160,
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
