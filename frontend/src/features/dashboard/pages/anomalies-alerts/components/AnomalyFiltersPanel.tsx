import { ChevronDown } from "lucide-react";

export type AnomalyFiltersState = {
  timePeriod: string;
  accountName: string;
  service: string;
  region: string;
  marketplace: string;
  costImpactType: string;
  costImpactOperator: string;
  costImpactValue: string;
};

type AnomalyFiltersPanelProps = {
  open: boolean;
  filters: AnomalyFiltersState;
  onChange: (next: AnomalyFiltersState) => void;
  onReset: () => void;
  onCancel: () => void;
  onApply: () => void;
};

function FilterRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="anomaly-filter-panel__row" onClick={onClick}>
      <span className="anomaly-filter-panel__row-label">{label}</span>
      <span className="anomaly-filter-panel__row-value">
        {value}
        <ChevronDown size={16} />
      </span>
    </button>
  );
}

export function AnomalyFiltersPanel({
  open,
  filters,
  onChange,
  onReset,
  onCancel,
  onApply,
}: AnomalyFiltersPanelProps) {
  if (!open) return null;

  return (
    <div className="anomaly-filter-overlay" role="dialog" aria-modal="true" aria-label="All Filters">
      <button type="button" className="anomaly-filter-overlay__backdrop" onClick={onCancel} aria-label="Close filters" />

      <aside className="anomaly-filter-panel">
        <header className="anomaly-filter-panel__header">
          <h2>All Filters</h2>
          <div className="anomaly-filter-panel__actions">
            <button type="button" className="anomaly-filter-panel__action anomaly-filter-panel__action--ghost" onClick={onReset}>
              Reset
            </button>
            <button type="button" className="anomaly-filter-panel__action anomaly-filter-panel__action--outline" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="anomaly-filter-panel__action anomaly-filter-panel__action--primary" onClick={onApply}>
              Apply
            </button>
          </div>
        </header>

        <div className="anomaly-filter-panel__body">
          <FilterRow label="Time Period" value={filters.timePeriod} />
          <FilterRow label="Account Name" value={filters.accountName} />
          <FilterRow label="Service" value={filters.service} />
          <FilterRow label="Region" value={filters.region} />
          <FilterRow label="Marketplace" value={filters.marketplace} />
          <FilterRow label="Cost Impact Type" value={filters.costImpactType} />

          <div className="anomaly-filter-panel__cost-row">
            <span className="anomaly-filter-panel__row-label">Cost Impact</span>
            <div className="anomaly-filter-panel__cost-controls">
              <button type="button" className="anomaly-filter-panel__cost-select">
                <span>{filters.costImpactOperator}</span>
                <ChevronDown size={16} />
              </button>
              <input
                className="anomaly-filter-panel__cost-input"
                type="text"
                inputMode="decimal"
                value={filters.costImpactValue}
                onChange={(event) => onChange({ ...filters, costImpactValue: event.target.value })}
                placeholder="Amount"
              />
              <button type="button" className="anomaly-filter-panel__add-btn">
                + Add
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
