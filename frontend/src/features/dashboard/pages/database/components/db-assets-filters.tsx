import type { DatabaseAssetsFilterOptions } from "../../../api/dashboardTypes";

type DatabaseAssetsFiltersValue = {
  search: string;
  regionKey: string;
  dbEngine: string;
  instanceClass: string;
  status: string;
  subAccountKey: string;
};

type DatabaseAssetsFiltersProps = {
  value: DatabaseAssetsFiltersValue;
  filterOptions: DatabaseAssetsFilterOptions;
  onChange: (next: DatabaseAssetsFiltersValue) => void;
  onClear: () => void;
};

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );

export function DatabaseAssetsFilters({ value, filterOptions, onChange, onClear }: DatabaseAssetsFiltersProps) {
  const regions = uniqueSorted(filterOptions.regions ?? []);
  const engines = uniqueSorted(filterOptions.dbEngines ?? []);
  const classes = uniqueSorted(filterOptions.classes ?? []);
  const statuses = uniqueSorted(filterOptions.statuses ?? []);
  const accounts = uniqueSorted(filterOptions.accounts ?? []);

  return (
    <section className="cost-explorer-control-surface" aria-label="Database assets controls">
      <div className="cost-explorer-toolbar-row">
        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">Search</span>
          <input
            className="cost-explorer-field__control"
            value={value.search}
            placeholder="Search by identifier, resource ID, name"
            onChange={(event) => onChange({ ...value, search: event.target.value })}
          />
        </label>

        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">Region</span>
          <select className="cost-explorer-field__control" value={value.regionKey} onChange={(event) => onChange({ ...value, regionKey: event.target.value })}>
            <option value="">All Regions</option>
            {regions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">Engine</span>
          <select className="cost-explorer-field__control" value={value.dbEngine} onChange={(event) => onChange({ ...value, dbEngine: event.target.value })}>
            <option value="">All Engines</option>
            {engines.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">Class</span>
          <select className="cost-explorer-field__control" value={value.instanceClass} onChange={(event) => onChange({ ...value, instanceClass: event.target.value })}>
            <option value="">All Classes</option>
            {classes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">Status</span>
          <select className="cost-explorer-field__control" value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value })}>
            <option value="">All Statuses</option>
            {statuses.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {accounts.length > 0 ? (
          <label className="cost-explorer-toolbar-item cost-explorer-field">
            <span className="cost-explorer-field__label">Account</span>
            <select className="cost-explorer-field__control" value={value.subAccountKey} onChange={(event) => onChange({ ...value, subAccountKey: event.target.value })}>
              <option value="">All Accounts</option>
              {accounts.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="cost-explorer-chip-bar" aria-label="Selected filter summary">
        <div className="cost-explorer-chip-row">
          <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={onClear}>
            Clear filters
          </button>
        </div>
      </div>
    </section>
  );
}

export type { DatabaseAssetsFiltersValue };
