import { EmptyStateBlock } from "../../../common/components/EmptyStateBlock";

type EC2ExplorerTableProps = {
  loading: boolean;
  error: Error | null;
  table: {
    columns: Array<{ key: string; label: string }>;
    rows: Array<{ id: string; [key: string]: string | number | null }>;
  } | null;
  onRetry: () => void;
  onRowClick: (row: { id: string; [key: string]: string | number | null }) => void;
  onRecommendationClick?: (row: { id: string; [key: string]: string | number | null }) => void;
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
      <div className="ec2-explorer-table__scroll">
        <table>
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th key={column.key} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.id} onClick={() => onRowClick(row)} role="button" tabIndex={0}>
                {table.columns.map((column) => (
                  <td key={`${row.id}-${column.key}`}>
                    {(() => {
                      const value = formatCellValue(row[column.key] ?? null);
                      const isRecommendationColumn = /recommendation/i.test(column.key) || /recommendation/i.test(column.label);
                      if (!isRecommendationColumn || !onRecommendationClick) return value;

                      return (
                        <button
                          type="button"
                          className="optimization-rightsizing-view-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRecommendationClick(row);
                          }}
                        >
                          {value}
                        </button>
                      );
                    })()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
