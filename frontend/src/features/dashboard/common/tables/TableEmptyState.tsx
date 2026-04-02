type TableEmptyStateProps = {
  message?: string;
};

export function TableEmptyState({ message = "No rows available for the current selection." }: TableEmptyStateProps) {
  return (
    <div className="dashboard-table-empty-state">
      <p className="dashboard-table-empty-state__title">No data</p>
      <p className="dashboard-table-empty-state__message">{message}</p>
    </div>
  );
}
