import { Check, ChevronDown, X } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
  CostHistoryFilterOptionsResponse,
  CostHistoryFiltersQuery,
  CostHistoryGranularity,
  CostHistoryGroupBy,
  CostHistoryXAxis,
  CostHistoryYAxisMetric,
} from "../../../api/dashboardTypes";
import {
  DEFAULT_COST_HISTORY_FILTERS,
  GROUP_LABELS,
  X_AXIS_LABELS,
  Y_AXIS_LABELS,
} from "../config/costHistory.constants";

type PopoverKey = "granularity" | "groupBy" | "xAxis" | "yAxisMetric";

type CostHistoryFiltersPanelProps = {
  rootRef: RefObject<HTMLDivElement | null>;
  filters: Required<CostHistoryFiltersQuery>;
  setFilters: Dispatch<SetStateAction<Required<CostHistoryFiltersQuery>>>;
  activePopover: PopoverKey | null;
  setActivePopover: Dispatch<SetStateAction<PopoverKey | null>>;
  options?: CostHistoryFilterOptionsResponse;
};

export function CostHistoryFiltersPanel({
  rootRef,
  filters,
  setFilters,
  activePopover,
  setActivePopover,
  options,
}: CostHistoryFiltersPanelProps) {
  return (
    <section className="cost-explorer-control-surface" aria-label="Cost history filters" ref={rootRef}>
      <div className="cost-explorer-toolbar-row">
        <div className="cost-explorer-toolbar-item">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "granularity" ? " is-active" : ""}`}
            onClick={() => setActivePopover((current) => (current === "granularity" ? null : "granularity"))}
            aria-haspopup="listbox"
            aria-expanded={activePopover === "granularity"}
          >
            <span className="cost-explorer-toolbar-trigger__label">Granularity</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{filters.granularity === "day" ? "Day" : "Month"}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "granularity" ? (
            <div className="cost-explorer-filter-popover" role="dialog" aria-label="Granularity options">
              <p className="cost-explorer-filter-popover__title">Granularity</p>
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {(options?.granularity ?? []).map((option) => {
                  const selected = filters.granularity === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, granularity: option.key as CostHistoryGranularity }));
                        setActivePopover(null);
                      }}
                    >
                      <span className="cost-explorer-filter-option__content">
                        <span className="cost-explorer-filter-option__label">{option.label}</span>
                      </span>
                      {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="cost-explorer-toolbar-item">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "groupBy" ? " is-active" : ""}`}
            onClick={() => setActivePopover((current) => (current === "groupBy" ? null : "groupBy"))}
            aria-haspopup="listbox"
            aria-expanded={activePopover === "groupBy"}
          >
            <span className="cost-explorer-toolbar-trigger__label">Group By</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{GROUP_LABELS[filters.groupBy]}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "groupBy" ? (
            <div className="cost-explorer-filter-popover" role="dialog" aria-label="Group by options">
              <p className="cost-explorer-filter-popover__title">Group By</p>
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {(options?.groupBy ?? []).map((option) => {
                  const selected = filters.groupBy === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, groupBy: option.key as CostHistoryGroupBy }));
                        setActivePopover(null);
                      }}
                    >
                      <span className="cost-explorer-filter-option__content">
                        <span className="cost-explorer-filter-option__label">{option.label}</span>
                      </span>
                      {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="cost-explorer-toolbar-item">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "xAxis" ? " is-active" : ""}`}
            onClick={() => setActivePopover((current) => (current === "xAxis" ? null : "xAxis"))}
            aria-haspopup="listbox"
            aria-expanded={activePopover === "xAxis"}
          >
            <span className="cost-explorer-toolbar-trigger__label">X-Axis</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{X_AXIS_LABELS[filters.xAxis]}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "xAxis" ? (
            <div className="cost-explorer-filter-popover" role="dialog" aria-label="X-axis options">
              <p className="cost-explorer-filter-popover__title">X-Axis</p>
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {(options?.xAxis ?? []).map((option) => {
                  const selected = filters.xAxis === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, xAxis: option.key as CostHistoryXAxis }));
                        setActivePopover(null);
                      }}
                    >
                      <span className="cost-explorer-filter-option__content">
                        <span className="cost-explorer-filter-option__label">{option.label}</span>
                      </span>
                      {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="cost-explorer-toolbar-item">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "yAxisMetric" ? " is-active" : ""}`}
            onClick={() => setActivePopover((current) => (current === "yAxisMetric" ? null : "yAxisMetric"))}
            aria-haspopup="listbox"
            aria-expanded={activePopover === "yAxisMetric"}
          >
            <span className="cost-explorer-toolbar-trigger__label">Y-Axis</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{Y_AXIS_LABELS[filters.yAxisMetric]}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "yAxisMetric" ? (
            <div className="cost-explorer-filter-popover" role="dialog" aria-label="Y-axis options">
              <p className="cost-explorer-filter-popover__title">Y-Axis</p>
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {(options?.yAxis ?? []).map((option) => {
                  const selected = filters.yAxisMetric === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, yAxisMetric: option.key as CostHistoryYAxisMetric }));
                        setActivePopover(null);
                      }}
                    >
                      <span className="cost-explorer-filter-option__content">
                        <span className="cost-explorer-filter-option__label">{option.label}</span>
                      </span>
                      {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="cost-explorer-chip-bar" aria-label="Selected filter summary">
        <div className="cost-explorer-chip-row">
          <span className="cost-explorer-chip">
            <span className="cost-explorer-chip__edit">Granularity: {filters.granularity === "day" ? "Day" : "Month"}</span>
            <button
              type="button"
              className="cost-explorer-chip__remove"
              onClick={() => setFilters((prev) => ({ ...prev, granularity: DEFAULT_COST_HISTORY_FILTERS.granularity }))}
              aria-label="Remove granularity filter"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
          <span className="cost-explorer-chip">
            <span className="cost-explorer-chip__edit">Group: {GROUP_LABELS[filters.groupBy]}</span>
            <button
              type="button"
              className="cost-explorer-chip__remove"
              onClick={() => setFilters((prev) => ({ ...prev, groupBy: DEFAULT_COST_HISTORY_FILTERS.groupBy }))}
              aria-label="Remove group filter"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
          <span className="cost-explorer-chip">
            <span className="cost-explorer-chip__edit">X-Axis: {X_AXIS_LABELS[filters.xAxis]}</span>
            <button
              type="button"
              className="cost-explorer-chip__remove"
              onClick={() => setFilters((prev) => ({ ...prev, xAxis: DEFAULT_COST_HISTORY_FILTERS.xAxis }))}
              aria-label="Remove x-axis filter"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
          <span className="cost-explorer-chip">
            <span className="cost-explorer-chip__edit">Y-Axis: {Y_AXIS_LABELS[filters.yAxisMetric]}</span>
            <button
              type="button"
              className="cost-explorer-chip__remove"
              onClick={() => setFilters((prev) => ({ ...prev, yAxisMetric: DEFAULT_COST_HISTORY_FILTERS.yAxisMetric }))}
              aria-label="Remove y-axis filter"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        </div>
        <button
          type="button"
          className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline"
          onClick={() => setFilters(DEFAULT_COST_HISTORY_FILTERS)}
        >
          Clear all
        </button>
      </div>
    </section>
  );
}
