import { useMemo } from "react";
import type { ColDef, ValueFormatterParams } from "ag-grid-community";

import { BaseDataTable } from "../../../common/tables/BaseDataTable";
import { TableShell } from "../../../common/tables/TableShell";
import type { DatabaseExplorerTableRow } from "../../../api/dashboardTypes";
import { formatCurrency, formatInteger, formatNumber } from "./databaseExplorer.formatters";

type DatabaseExplorerGroupedTableProps = {
  rows: DatabaseExplorerTableRow[];
  isLoading?: boolean;
};

export function DatabaseExplorerGroupedTable({ rows, isLoading = false }: DatabaseExplorerGroupedTableProps) {
  const columnDefs = useMemo<ColDef<DatabaseExplorerTableRow>[]>(
    () => [
      { headerName: "Group", field: "group", minWidth: 180, sort: undefined },
      {
        headerName: "Total Cost",
        field: "totalCost",
        sort: "desc",
        cellClass: "ag-right-aligned-cell",
        valueFormatter: (params: ValueFormatterParams<DatabaseExplorerTableRow>) => formatCurrency(params.value),
      },
      {
        headerName: "Compute",
        field: "computeCost",
        cellClass: "ag-right-aligned-cell",
        valueFormatter: (params: ValueFormatterParams<DatabaseExplorerTableRow>) => formatCurrency(params.value),
      },
      {
        headerName: "Storage",
        field: "storageCost",
        cellClass: "ag-right-aligned-cell",
        valueFormatter: (params: ValueFormatterParams<DatabaseExplorerTableRow>) => formatCurrency(params.value),
      },
      {
        headerName: "IO",
        field: "ioCost",
        cellClass: "ag-right-aligned-cell",
        valueFormatter: (params: ValueFormatterParams<DatabaseExplorerTableRow>) => formatCurrency(params.value),
      },
      {
        headerName: "Backup",
        field: "backupCost",
        cellClass: "ag-right-aligned-cell",
        valueFormatter: (params: ValueFormatterParams<DatabaseExplorerTableRow>) => formatCurrency(params.value),
      },
      {
        headerName: "Resource Count",
        field: "resourceCount",
        cellClass: "ag-right-aligned-cell",
        valueFormatter: (params: ValueFormatterParams<DatabaseExplorerTableRow>) => formatInteger(params.value),
      },
      {
        headerName: "Avg Load",
        field: "avgLoad",
        cellClass: "ag-right-aligned-cell",
        valueFormatter: (params: ValueFormatterParams<DatabaseExplorerTableRow>) => formatNumber(params.value),
      },
      {
        headerName: "Connections",
        field: "connections",
        cellClass: "ag-right-aligned-cell",
        valueFormatter: (params: ValueFormatterParams<DatabaseExplorerTableRow>) => formatNumber(params.value),
      },
    ],
    [],
  );

  return (
    <TableShell title="Grouped Database Costs" subtitle="Database cost and usage grouped by the selected dimension">
      {isLoading ? (
        <p className="dashboard-note">Loading database table...</p>
      ) : (
        <BaseDataTable
          rowData={rows}
          columnDefs={columnDefs}
          height={360}
          emptyMessage="No database data for selected filters"
        />
      )}
    </TableShell>
  );
}
