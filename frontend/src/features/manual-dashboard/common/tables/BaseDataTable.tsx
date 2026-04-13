import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, type ColDef, type ValueFormatterParams } from "ag-grid-community";
import { TableEmptyState } from "./TableEmptyState";

type BaseDataTableProps<TData extends object> = {
  columnDefs: ColDef<TData>[];
  rowData: TData[];
  height?: number;
  emptyMessage?: string;
};

export function currencyFormatter(params: ValueFormatterParams) {
  const value = Number(params.value ?? 0);
  return `$${value.toLocaleString()}`;
}

export function BaseDataTable<TData extends object>({
  columnDefs,
  rowData,
  height = 284,
  emptyMessage,
}: BaseDataTableProps<TData>) {
  const defaultColDef = useMemo<ColDef<TData>>(
    () => ({
      sortable: true,
      filter: false,
      resizable: true,
      suppressHeaderMenuButton: true,
      flex: 1,
      minWidth: 120,
    }),
    [],
  );

  if (!rowData.length) {
    return <TableEmptyState {...(emptyMessage ? { message: emptyMessage } : {})} />;
  }

  return (
    <div className="dashboard-data-table" style={{ height }}>
      <AgGridReact<TData>
        theme={themeQuartz}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowHeight={34}
        headerHeight={36}
        suppressCellFocus
      />
    </div>
  );
}
