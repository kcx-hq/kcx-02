import type { DatabaseAssetsFilterOptions } from "../../../api/dashboardTypes";

type DatabaseAssetsFiltersValue = {
  search: string;
  regionKey: string;
  dbEngine: string;
};

type DatabaseAssetsFiltersProps = {
  value: DatabaseAssetsFiltersValue;
  filterOptions: DatabaseAssetsFilterOptions;
  onChange: (next: DatabaseAssetsFiltersValue) => void;
  onClear: () => void;
};

type NormalizedOption = { label: string; value: string };

const normalizeFilterOptions = (options: unknown): NormalizedOption[] => {
  if (!Array.isArray(options)) return [];
  const normalized = options
    .map((item): NormalizedOption | null => {
      if (typeof item === "string") {
        const value = item.trim();
        if (!value) return null;
        return { label: value, value };
      }
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const rawLabel =
          record.label ??
          record.name ??
          record.regionName ??
          record.regionId ??
          record.value ??
          record.id ??
          record.key ??
          record.regionKey ??
          "-";
        const rawValue =
          record.regionKey ??
          record.value ??
          record.id ??
          record.key ??
          record.label ??
          record.name;
        const label = String(rawLabel ?? "").trim() || "-";
        const value = String(rawValue ?? "").trim();
        if (!value) return null;
        return { label, value };
      }
      return null;
    })
    .filter((entry): entry is NormalizedOption => Boolean(entry));

  const dedup = new Map<string, NormalizedOption>();
  for (const option of normalized) {
    if (!dedup.has(option.value)) dedup.set(option.value, option);
  }
  return [...dedup.values()].sort((left, right) => left.label.localeCompare(right.label));
};

export function DatabaseAssetsFilters({ value, filterOptions, onChange, onClear }: DatabaseAssetsFiltersProps) {
  const regions = normalizeFilterOptions(filterOptions.regions);
  const engines = normalizeFilterOptions(filterOptions.dbEngines);

  return (
    <section className="cost-explorer-control-surface" aria-label="Database assets controls">
      <div className="cost-explorer-toolbar-row db-assets-filters-row">
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
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">Engine</span>
          <select className="cost-explorer-field__control" value={value.dbEngine} onChange={(event) => onChange({ ...value, dbEngine: event.target.value })}>
            <option value="">All Engines</option>
            {engines.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="db-assets-filters-row__clear-wrap">
          <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={onClear}>
            Clear filters
          </button>
        </div>
      </div>
    </section>
  );
}

export type { DatabaseAssetsFiltersValue };
