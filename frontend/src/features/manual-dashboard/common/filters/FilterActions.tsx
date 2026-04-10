type FilterActionsProps = {
  onReset: () => void;
  onApply: () => void;
};

export function FilterActions({ onReset, onApply }: FilterActionsProps) {
  return (
    <div className="dashboard-template-filter-actions">
      <button type="button" className="dashboard-template-filter-actions__button dashboard-template-filter-actions__button--ghost" onClick={onReset}>
        Reset
      </button>
      <button type="button" className="dashboard-template-filter-actions__button dashboard-template-filter-actions__button--primary" onClick={onApply}>
        Apply
      </button>
    </div>
  );
}
