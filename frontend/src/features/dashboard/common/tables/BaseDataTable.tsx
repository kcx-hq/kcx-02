import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, type ColDef, type RowClickedEvent, type ValueFormatterParams } from "ag-grid-community";
import { TableEmptyState } from "./TableEmptyState";

type BaseDataTableProps<TData extends object> = {
  columnDefs: ColDef<TData>[];
  rowData: TData[];
  height?: number;
  emptyMessage?: string;
  pagination?: boolean;
  paginationPageSize?: number;
  autoHeight?: boolean;
  onRowClick?: (row: TData) => void;
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
  pagination = false,
  paginationPageSize = 10,
  autoHeight = false,
  onRowClick,
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
    <div className="dashboard-data-table" style={autoHeight ? undefined : { height }}>
      <AgGridReact<TData>
        theme={themeQuartz}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        pagination={pagination}
        paginationPageSize={paginationPageSize}
        paginationPageSizeSelector={pagination ? [10, 20, 50, 100] : false}
        domLayout={autoHeight ? "autoHeight" : "normal"}
        rowHeight={34}
        headerHeight={36}
        rowClass={onRowClick ? "dashboard-data-table__row--clickable" : undefined}
        onRowClicked={
          onRowClick
            ? (event: RowClickedEvent<TData>) => {
                if (!event.data) return;
                onRowClick(event.data);
              }
            : undefined
        }
        suppressCellFocus
      />
    </div>
  );
}
