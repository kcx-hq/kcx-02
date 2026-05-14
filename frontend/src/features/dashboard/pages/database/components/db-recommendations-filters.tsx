import type { DatabaseRecommendationListResponse } from "../../../api/dashboardTypes";
import { statusLabel } from "./db-recommendations.formatters";

export type DatabaseRecommendationsFiltersValue = {
  search: string;
  status: string;
  region: string;
  engine: string;
};

type DatabaseRecommendationsFiltersProps = {
  value: DatabaseRecommendationsFiltersValue;
  filterOptions?: DatabaseRecommendationListResponse["filterOptions"];
  onChange: (next: DatabaseRecommendationsFiltersValue) => void;
  onClear: () => void;
};

const sortValues = (values?: string[]): string[] => [...new Set(values ?? [])].sort((a, b) => a.localeCompare(b));

export function DatabaseRecommendationsFilters({ value, filterOptions, onChange, onClear }: DatabaseRecommendationsFiltersProps) {
  const statuses = sortValues(filterOptions?.statuses);
  const regions = sortValues(filterOptions?.regions);
  const engines = sortValues(filterOptions?.engines);
  const hasAdvancedFilters = regions.length > 0 || engines.length > 0;

  return (
    <section className="cost-explorer-control-surface" aria-label="Database recommendations controls">
      <div className="cost-explorer-toolbar-row db-assets-filters-row">
        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">Search</span>
          <input
            className="cost-explorer-field__control"
            value={value.search}
            placeholder="Search recommendation or resource"
            onChange={(event) => onChange({ ...value, search: event.target.value })}
          />
        </label>
        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">Status</span>
          <select className="cost-explorer-field__control" value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value })}>
            <option value="">All Statuses</option>
            {statuses.map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}
          </select>
        </label>
        {hasAdvancedFilters ? (
          <>
            {regions.length > 0 ? (
              <label className="cost-explorer-toolbar-item cost-explorer-field">
                <span className="cost-explorer-field__label">Region</span>
                <select className="cost-explorer-field__control" value={value.region} onChange={(event) => onChange({ ...value, region: event.target.value })}>
                  <option value="">All</option>
                  {regions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ) : null}
            {engines.length > 0 ? (
              <label className="cost-explorer-toolbar-item cost-explorer-field">
                <span className="cost-explorer-field__label">Engine</span>
                <select className="cost-explorer-field__control" value={value.engine} onChange={(event) => onChange({ ...value, engine: event.target.value })}>
                  <option value="">All</option>
                  {engines.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ) : null}
          </>
        ) : null}
        <div className="db-assets-filters-row__clear-wrap">
          <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={onClear}>
            Clear filters
          </button>
        </div>
      </div>
    </section>
  );
}
