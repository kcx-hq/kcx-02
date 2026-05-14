import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
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
  const [activePopover, setActivePopover] = useState<null | "status" | "region" | "engine">(null);
  const chips = useMemo(
    () => [
      { key: "search", label: "Search", value: value.search.trim() || "Any" },
      { key: "status", label: "Status", value: value.status ? statusLabel(value.status) : "All Statuses" },
      { key: "region", label: "Region", value: value.region || "All Regions" },
      { key: "engine", label: "Engine", value: value.engine || "All Engines" },
    ],
    [value.engine, value.region, value.search, value.status],
  );

  const renderOptionList = (
    title: string,
    options: string[],
    selectedValue: string,
    allLabel: string,
    labelFn?: (value: string) => string,
    onSelect?: (next: string) => void,
  ) => (
    <div className="cost-explorer-filter-popover" role="dialog" aria-label={`${title} options`}>
      <p className="cost-explorer-filter-popover__title">{title}</p>
      <div className="cost-explorer-filter-popover__list" role="listbox">
        <button type="button" className={`cost-explorer-filter-option${selectedValue === "" ? " is-active" : ""}`} onClick={() => onSelect?.("")}>
          <span className="cost-explorer-filter-option__label">{allLabel}</span>
          {selectedValue === "" ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
        </button>
        {options.map((option) => (
          <button key={option} type="button" className={`cost-explorer-filter-option${selectedValue === option ? " is-active" : ""}`} onClick={() => onSelect?.(option)}>
            <span className="cost-explorer-filter-option__label">{labelFn ? labelFn(option) : option}</span>
            {selectedValue === option ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className="cost-explorer-control-surface" aria-label="Database recommendations controls">
      <div className="cost-explorer-toolbar-row db-assets-filters-row">
        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">Search</span>
          <Search size={14} aria-hidden="true" style={{ position: "absolute", margin: "31px 0 0 10px", opacity: 0.65 }} />
          <input
            className="cost-explorer-field__control"
            style={{ paddingLeft: "30px" }}
            value={value.search}
            placeholder="Search recommendation or resource"
            onChange={(event) => onChange({ ...value, search: event.target.value })}
          />
        </label>
        <div className="cost-explorer-toolbar-item" style={{ position: "relative" }}>
          <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "status" ? " is-active" : ""}`} onClick={() => setActivePopover(activePopover === "status" ? null : "status")}>
            <span className="cost-explorer-toolbar-trigger__label">Status</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{value.status ? statusLabel(value.status) : "All Statuses"}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "status"
            ? renderOptionList("Status", statuses, value.status, "All Statuses", statusLabel, (next) => {
                onChange({ ...value, status: next });
                setActivePopover(null);
              })
            : null}
        </div>
        <div className="cost-explorer-toolbar-item" style={{ position: "relative" }}>
          <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "region" ? " is-active" : ""}`} onClick={() => setActivePopover(activePopover === "region" ? null : "region")}>
            <span className="cost-explorer-toolbar-trigger__label">Region</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{value.region || "All Regions"}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "region"
            ? renderOptionList("Region", regions, value.region, "All Regions", undefined, (next) => {
                onChange({ ...value, region: next });
                setActivePopover(null);
              })
            : null}
        </div>
        <div className="cost-explorer-toolbar-item" style={{ position: "relative" }}>
          <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "engine" ? " is-active" : ""}`} onClick={() => setActivePopover(activePopover === "engine" ? null : "engine")}>
            <span className="cost-explorer-toolbar-trigger__label">Engine</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{value.engine || "All Engines"}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "engine"
            ? renderOptionList("Engine", engines, value.engine, "All Engines", undefined, (next) => {
                onChange({ ...value, engine: next });
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
