import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { BaseDataTable, currencyFormatter } from "./BaseDataTable";

type CostRow = {
  service: string;
  provider: string;
  cost: number;
  delta: string;
};

type CostTableProps = {
  rows: CostRow[];
};

export function CostTable({ rows }: CostTableProps) {
  const columnDefs = useMemo<ColDef<CostRow>[]>(
    () => [
      { headerName: "Service", field: "service", minWidth: 150 },
      { headerName: "Provider", field: "provider", minWidth: 120 },
      { headerName: "Cost", field: "cost", valueFormatter: currencyFormatter, minWidth: 120 },
      { headerName: "Delta", field: "delta", minWidth: 110 },
    ],
    [],
  );

  return <BaseDataTable rowData={rows} columnDefs={columnDefs} emptyMessage="No cost rows to display." />;
}
