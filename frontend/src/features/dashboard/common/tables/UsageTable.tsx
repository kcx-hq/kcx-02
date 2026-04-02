import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { BaseDataTable } from "./BaseDataTable";

type UsageRow = {
  resource: string;
  region: string;
  usage: string;
  utilization: string;
};

type UsageTableProps = {
  rows: UsageRow[];
};

export function UsageTable({ rows }: UsageTableProps) {
  const columnDefs = useMemo<ColDef<UsageRow>[]>(
    () => [
      { headerName: "Resource", field: "resource", minWidth: 160 },
      { headerName: "Region", field: "region", minWidth: 120 },
      { headerName: "Usage", field: "usage", minWidth: 120 },
      { headerName: "Utilization", field: "utilization", minWidth: 120 },
    ],
    [],
  );

  return <BaseDataTable rowData={rows} columnDefs={columnDefs} emptyMessage="No usage rows to display." />;
}
