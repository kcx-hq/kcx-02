import type { DatabaseExplorerGroupBy, DatabaseExplorerMetric } from "../../../api/dashboardTypes";

type DatabaseExplorerFiltersProps = {
  metric: DatabaseExplorerMetric;
  groupBy: DatabaseExplorerGroupBy;
  dbService: string;
  dbEngine: string;
  dbServiceOptions: string[];
  dbEngineOptions: string[];
  onMetricChange: (metric: DatabaseExplorerMetric) => void;
  onGroupByChange: (groupBy: DatabaseExplorerGroupBy) => void;
  onDbServiceChange: (dbService: string) => void;
  onDbEngineChange: (dbEngine: string) => void;
};

const metricOptions: Array<{ value: DatabaseExplorerMetric; label: string }> = [
  { value: "cost", label: "Cost" },
  { value: "usage", label: "Usage" },
];

const groupByOptions: Array<{ value: DatabaseExplorerGroupBy; label: string }> = [
  { value: "db_service", label: "DB Service" },
  { value: "db_engine", label: "Engine" },
  { value: "region", label: "Region" },
];

export function DatabaseExplorerFilters({
  metric,
  groupBy,
  dbService,
  dbEngine,
  dbServiceOptions,
  dbEngineOptions,
  onMetricChange,
  onGroupByChange,
  onDbServiceChange,
  onDbEngineChange,
}: DatabaseExplorerFiltersProps) {
  const chips = [
    { key: "metric", label: "Metric", value: metricOptions.find((option) => option.value === metric)?.label ?? metric },
    { key: "groupBy", label: "Group", value: groupByOptions.find((option) => option.value === groupBy)?.label ?? groupBy },
    ...(dbService ? [{ key: "dbService", label: "DB Service", value: dbService }] : []),
    ...(dbEngine ? [{ key: "dbEngine", label: "Engine", value: dbEngine }] : []),
  ];

  const clearAll = () => {
    onMetricChange("cost");
    onGroupByChange("db_service");
    onDbServiceChange("");
    onDbEngineChange("");
  };

  return (
    <section className="cost-explorer-control-surface" aria-label="Database explorer controls">
      <div className="cost-explorer-toolbar-row">
        <div className="cost-explorer-toolbar-item">
          <span className="cost-explorer-field__label">Metric</span>
          <div
            className="cost-explorer-segmented cost-explorer-segmented--tray"
            role="group"
            aria-label="Database explorer metric"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
            {metricOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`cost-explorer-segmented__item${metric === option.value ? " is-active" : ""}`}
                onClick={() => onMetricChange(option.value)}
                aria-pressed={metric === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">Group By</span>
          <select
            className="cost-explorer-field__control"
            value={groupBy}
            onChange={(event) => onGroupByChange(event.target.value as DatabaseExplorerGroupBy)}
          >
            {groupByOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">DB Service</span>
          <select
            className="cost-explorer-field__control"
            value={dbService}
            onChange={(event) => onDbServiceChange(event.target.value)}
          >
            <option value="">All DB Services</option>
            {dbServiceOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">DB Engine</span>
          <select
            className="cost-explorer-field__control"
            value={dbEngine}
            onChange={(event) => onDbEngineChange(event.target.value)}
          >
            <option value="">All Engines</option>
            {dbEngineOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="cost-explorer-chip-bar" aria-label="Selected filter summary">
        <div className="cost-explorer-chip-row">
          {chips.map((chip) => (
            <span key={chip.key} className="cost-explorer-chip">
              <span className="cost-explorer-chip__edit">
                {chip.label}: {chip.value}
              </span>
            </span>
          ))}
          <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={clearAll}>
            Clear all
          </button>
        </div>
      </div>
    </section>
  );
}
