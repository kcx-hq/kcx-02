import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { DatabaseAssetsFilterOptions } from "../../../api/dashboardTypes";

type DatabaseAssetsFiltersValue = {
  search: string;
  regionKey: string;
  dbService: string;
  dbEngine: string;
  instanceClass: string;
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
  const services = normalizeFilterOptions(filterOptions.dbServices);
  const engines = normalizeFilterOptions(filterOptions.dbEngines);
  const classes = normalizeFilterOptions(filterOptions.classes);
  const [activePopover, setActivePopover] = useState<null | "region" | "service" | "engine" | "class">(null);

  const chips = useMemo(
    () => [
      { key: "search", label: "Search", value: value.search.trim() || "Any" },
      { key: "region", label: "Region", value: regions.find((r) => r.value === value.regionKey)?.label ?? "All Regions" },
      { key: "service", label: "DB Service", value: services.find((s) => s.value === value.dbService)?.label ?? "All Services" },
      { key: "engine", label: "Engine", value: engines.find((e) => e.value === value.dbEngine)?.label ?? "All Engines" },
      { key: "class", label: "Instance Class", value: classes.find((c) => c.value === value.instanceClass)?.label ?? "All Classes" },
    ],
    [classes, engines, regions, services, value.dbEngine, value.dbService, value.instanceClass, value.regionKey, value.search],
  );

  const renderOptionList = (
    title: string,
    options: NormalizedOption[],
    selectedValue: string,
    allLabel: string,
    onSelect: (next: string) => void,
  ) => (
    <div className="cost-explorer-filter-popover" role="dialog" aria-label={`${title} options`}>
      <p className="cost-explorer-filter-popover__title">{title}</p>
      <div className="cost-explorer-filter-popover__list" role="listbox">
        <button type="button" className={`cost-explorer-filter-option${selectedValue === "" ? " is-active" : ""}`} onClick={() => onSelect("")}>
          <span className="cost-explorer-filter-option__label">{allLabel}</span>
          {selectedValue === "" ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`cost-explorer-filter-option${selectedValue === option.value ? " is-active" : ""}`}
            onClick={() => onSelect(option.value)}
          >
            <span className="cost-explorer-filter-option__label">{option.label}</span>
            {selectedValue === option.value ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </div>
  );

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

        <div className="cost-explorer-toolbar-item" style={{ position: "relative" }}>
          <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "region" ? " is-active" : ""}`} onClick={() => setActivePopover(activePopover === "region" ? null : "region")}>
            <span className="cost-explorer-toolbar-trigger__label">Region</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{regions.find((r) => r.value === value.regionKey)?.label ?? "All Regions"}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "region"
            ? renderOptionList("Region", regions, value.regionKey, "All Regions", (next) => {
                onChange({ ...value, regionKey: next });
                setActivePopover(null);
              })
            : null}
        </div>

        <div className="cost-explorer-toolbar-item" style={{ position: "relative" }}>
          <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "service" ? " is-active" : ""}`} onClick={() => setActivePopover(activePopover === "service" ? null : "service")}>
            <span className="cost-explorer-toolbar-trigger__label">DB Service</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{services.find((s) => s.value === value.dbService)?.label ?? "All Services"}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "service"
            ? renderOptionList("DB Service", services, value.dbService, "All Services", (next) => {
                onChange({ ...value, dbService: next });
                setActivePopover(null);
              })
            : null}
        </div>

        <div className="cost-explorer-toolbar-item" style={{ position: "relative" }}>
          <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "engine" ? " is-active" : ""}`} onClick={() => setActivePopover(activePopover === "engine" ? null : "engine")}>
            <span className="cost-explorer-toolbar-trigger__label">Engine</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{engines.find((e) => e.value === value.dbEngine)?.label ?? "All Engines"}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "engine"
            ? renderOptionList("Engine", engines, value.dbEngine, "All Engines", (next) => {
                onChange({ ...value, dbEngine: next });
                setActivePopover(null);
              })
            : null}
        </div>

        <div className="cost-explorer-toolbar-item" style={{ position: "relative" }}>
          <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "class" ? " is-active" : ""}`} onClick={() => setActivePopover(activePopover === "class" ? null : "class")}>
            <span className="cost-explorer-toolbar-trigger__label">Instance Class</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{classes.find((c) => c.value === value.instanceClass)?.label ?? "All Classes"}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "class"
            ? renderOptionList("Instance Class", classes, value.instanceClass, "All Classes", (next) => {
                onChange({ ...value, instanceClass: next });
                setActivePopover(null);
              })
            : null}
        </div>

        <div className="db-assets-filters-row__clear-wrap">
          <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={onClear}>
            Clear filters
          </button>
        </div>
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
          <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={onClear}>
            Clear all
          </button>
        </div>
      </div>
    </section>
  );
}

export type { DatabaseAssetsFiltersValue };
