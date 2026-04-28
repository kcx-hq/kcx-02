import { useMemo } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";

import { BaseDataTable } from "../../../common/tables/BaseDataTable";
import { EmptyStateBlock } from "../../../common/components/EmptyStateBlock";

type EC2ExplorerTableRow = { id: string; [key: string]: string | number | null };

type EC2ExplorerTableProps = {
  loading: boolean;
  error: Error | null;
  table: {
    columns: Array<{ key: string; label: string }>;
    rows: EC2ExplorerTableRow[];
  } | null;
  onRetry: () => void;
  onRowClick: (row: EC2ExplorerTableRow) => void;
  onRecommendationClick?: (row: EC2ExplorerTableRow) => void;
};

const formatCellValue = (value: string | number | null): string => {
  if (value === null || typeof value === "undefined") return "-";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value;
};

export function EC2ExplorerTable({ loading, error, table, onRetry, onRowClick, onRecommendationClick }: EC2ExplorerTableProps) {
  const columnDefs = useMemo<ColDef<EC2ExplorerTableRow>[]>(() => {
    if (!table) return [];
    return table.columns.map((column) => {
      const isRecommendationColumn = /recommendation/i.test(column.key) || /recommendation/i.test(column.label);
      return {
        headerName: column.label,
        field: column.key,
        minWidth: 160,
        valueFormatter: (params) => formatCellValue(params.value as string | number | null),
        cellRenderer: isRecommendationColumn && onRecommendationClick
          ? (params: ICellRendererParams<EC2ExplorerTableRow, string | number | null>) => (
              <button
                type="button"
                className="optimization-rightsizing-view-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  if (params.data) onRecommendationClick(params.data);
                }}
              >
                {formatCellValue(params.value ?? null)}
              </button>
            )
          : undefined,
      } satisfies ColDef<EC2ExplorerTableRow>;
    });
  }, [onRecommendationClick, table]);

  if (loading) {
    return <div className="ec2-explorer-table__skeleton" aria-hidden="true" />;
  }

  if (error) {
    return (
      <EmptyStateBlock
        title="Unable to load explorer table"
        message={error.message || "An unexpected error occurred."}
        actions={
          <button type="button" className="cost-explorer-state-btn" onClick={onRetry}>
            Retry
          </button>
        }
      />
    );
  }

  if (!table || table.columns.length === 0 || table.rows.length === 0) {
    return (
      <EmptyStateBlock
        title="No data found"
        message="No data found for current filters. Try removing thresholds or filters."
      />
    );
  }

  return (
    <section className="ec2-explorer-table" aria-label="EC2 explorer table">
      <BaseDataTable
        columnDefs={columnDefs}
        rowData={table.rows}
        pagination
        paginationPageSize={10}
        autoHeight
        onRowClick={onRowClick}
      />
    </section>
  );
}
