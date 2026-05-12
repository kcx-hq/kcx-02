import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

import {
  COMPARE_OPTIONS,
  GROUP_BY_OPTIONS,
  METRIC_OPTIONS,
  type CompareKey,
  type CostExplorerChip,
  type Granularity,
  type GroupBy,
  type Metric,
} from "../costExplorer.types";

type CostExplorerFiltersPanelProps = {
  effectiveGranularity: Granularity;
  days: number;
  groupBy: GroupBy;
  selectedMetrics: Metric[];
  compare: CompareKey[];
  chips: CostExplorerChip[];
  onSetGranularity: (granularity: Granularity) => void;
  onSetGroupBy: (groupBy: GroupBy) => void;
  onToggleMetric: (metric: Metric) => void;
  onToggleCompare: (key: CompareKey) => void;
  onEditChip: (key: CostExplorerChip["key"]) => void;
  onRemoveChip: (key: CostExplorerChip["key"]) => void;
  onClearAll: () => void;
  granularityRef: RefObject<HTMLButtonElement | null>;
  groupRef: RefObject<HTMLButtonElement | null>;
  compareRef: RefObject<HTMLButtonElement | null>;
  metricRef: RefObject<HTMLButtonElement | null>;
  groupOptions?: Array<{ key: GroupBy; label: string }>;
  groupValueOptions?: Array<{ key: string; label: string; count: number }>;
  selectedGroupValues?: string[];
  onToggleGroupValue?: (value: string) => void;
  onClearGroupValues?: () => void;
  onApplyGroupFilters?: () => void;
  hasPendingGroupChanges?: boolean;
  groupValuesLoading?: boolean;
};

type FilterPopoverKey = CostExplorerChip["key"];
type FilterOption<T extends string> = {
  key: T;
  label: string;
  disabled?: boolean;
};

export function CostExplorerFiltersPanel({
  effectiveGranularity,
  days,
  groupBy,
  selectedMetrics,
  compare,
  chips,
  onSetGranularity,
  onSetGroupBy,
  onToggleMetric,
  onToggleCompare,
  onEditChip,
  onRemoveChip,
  onClearAll,
  granularityRef,
  groupRef,
  compareRef,
  metricRef,
  groupOptions,
  groupValueOptions,
  selectedGroupValues,
  onToggleGroupValue,
  onClearGroupValues,
  onApplyGroupFilters,
  hasPendingGroupChanges = false,
  groupValuesLoading = false,
}: CostExplorerFiltersPanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activePopover, setActivePopover] = useState<FilterPopoverKey | null>(null);
  const [searchByPopover, setSearchByPopover] = useState<Record<FilterPopoverKey, string>>({
    granularity: "",
    group: "",
    compare: "",
    metric: "",
  });

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setActivePopover(null);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePopover(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const granularityLabel = `${effectiveGranularity[0].toUpperCase()}${effectiveGranularity.slice(1)}`;
  const resolvedGroupOptions = useMemo<Array<FilterOption<GroupBy>>>(
    () =>
      (groupOptions?.length
        ? groupOptions
        : GROUP_BY_OPTIONS.map((item) => ({ key: item.key, label: item.label }))
      ).map((item) => ({
        key: item.key,
        label: item.label,
      })),
    [groupOptions],
  );

  const groupLabel = resolvedGroupOptions.find((item) => item.key === groupBy)?.label ?? "None";
  const metricLabel = selectedMetrics.length
    ? selectedMetrics
        .map((key) => METRIC_OPTIONS.find((item) => item.key === key)?.label ?? key)
        .join(" VS ")
    : "Billed Cost";
  const compareLabel = compare.length
    ? compare.map((key) => COMPARE_OPTIONS.find((item) => item.key === key)?.label ?? key).join(" + ")
    : "None";

  const togglePopover = (key: FilterPopoverKey) => {
    setActivePopover((current) => (current === key ? null : key));
  };

  const handleChipEdit = (key: CostExplorerChip["key"]) => {
    setActivePopover(key);
    onEditChip(key);
  };

  const onSelectGranularity = (value: Granularity) => {
    onSetGranularity(value);
    setActivePopover(null);
  };

  const onSelectGroupBy = (value: GroupBy) => {
    onSetGroupBy(value);
  };

  const onSelectMetric = (value: Metric) => {
    onToggleMetric(value);
  };

  const onSelectCompare = (key: CompareKey) => {
    onToggleCompare(key);
    setActivePopover(null);
  };

  const updateSearch = (key: FilterPopoverKey, value: string) => {
    setSearchByPopover((current) => ({ ...current, [key]: value }));
  };

  const normalize = (value: string) => value.trim().toLowerCase();

  const filterOptions = <T extends string>(options: Array<FilterOption<T>>, query: string) => {
    const needle = normalize(query);
    if (!needle) return options;
    return options.filter((option) => normalize(option.label).includes(needle));
  };

  const granularityOptions = useMemo<Array<FilterOption<Granularity>>>(
    () => [
      {
        key: "hourly",
        label: days > 14 ? "Hourly (up to 14d)" : "Hourly",
        disabled: days > 14,
      },
      { key: "daily", label: "Daily" },
      { key: "monthly", label: "Monthly" },
    ],
    [days],
  );

  const metricOptions = useMemo<Array<FilterOption<Metric>>>(
    () =>
      METRIC_OPTIONS.map((item) => ({
        key: item.key,
        label: item.label,
      })),
    [],
  );

  const compareOptions = useMemo<Array<FilterOption<CompareKey>>>(
    () =>
      COMPARE_OPTIONS.map((item) => ({
        key: item.key,
        label: item.label,
      })),
    [],
  );

  const filteredGranularityOptions = filterOptions(granularityOptions, searchByPopover.granularity);
  const filteredGroupOptions = filterOptions(resolvedGroupOptions, searchByPopover.group);
  const filteredMetricOptions = filterOptions(metricOptions, searchByPopover.metric);
  const filteredCompareOptions = filterOptions(compareOptions, searchByPopover.compare);
  const showGroupValuesPane = groupBy !== "none";
  const groupPopoverClassName = showGroupValuesPane
    ? "cost-explorer-filter-popover cost-explorer-filter-popover--split cost-explorer-filter-popover--group-split"
    : "cost-explorer-filter-popover cost-explorer-filter-popover--group-single";

  const renderPopoverSearch = (key: FilterPopoverKey, placeholder: string) => (
    <label className="cost-explorer-filter-popover__search-wrap">
      <Search className="cost-explorer-filter-popover__search-icon" size={14} aria-hidden="true" />
      <input
        type="search"
        className="cost-explorer-filter-popover__search-input"
        value={searchByPopover[key]}
        onChange={(event) => updateSearch(key, event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );

  const renderFilterList = <T extends string>(params: {
    options: Array<FilterOption<T>>;
    selected: T | null;
    onSelect: (value: T) => void;
    emptyLabel: string;
    listClassName?: string;
  }) => {
    if (!params.options.length) {
      return <p className="cost-explorer-filter-popover__empty">{params.emptyLabel}</p>;
    }

    return (
      <div className={`cost-explorer-filter-popover__list${params.listClassName ? ` ${params.listClassName}` : ""}`} role="listbox">
        {params.options.map((option) => {
          const selected = params.selected === option.key;
          return (
            <button
              key={option.key}
              type="button"
              className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
              onClick={() => params.onSelect(option.key)}
              disabled={option.disabled}
              role="option"
              aria-selected={selected}
            >
              <span className="cost-explorer-filter-option__content">
                <span className="cost-explorer-filter-option__label">{option.label}</span>
              </span>
              {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    );
  };

  const renderMultiFilterList = <T extends string>(params: {
    options: Array<FilterOption<T>>;
    selected: T[];
    onToggle: (value: T) => void;
    emptyLabel: string;
  }) => {
    if (!params.options.length) {
      return <p className="cost-explorer-filter-popover__empty">{params.emptyLabel}</p>;
    }

    return (
      <div className="cost-explorer-filter-popover__list" role="listbox">
        {params.options.map((option) => {
          const selected = params.selected.includes(option.key);
          return (
            <button
              key={option.key}
              type="button"
              className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
              onClick={() => params.onToggle(option.key)}
              role="option"
              aria-selected={selected}
            >
              <span className="cost-explorer-filter-option__content">
                <span className="cost-explorer-filter-option__label">{option.label}</span>
              </span>
              {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <section className="cost-explorer-control-surface" aria-label="Cost explorer filters" ref={rootRef}>
      <div className="cost-explorer-toolbar-row">
        <div className="cost-explorer-toolbar-item">
          <button
            type="button"
            ref={granularityRef}
            className={`cost-explorer-toolbar-trigger${activePopover === "granularity" ? " is-active" : ""}`}
            onClick={() => togglePopover("granularity")}
            aria-expanded={activePopover === "granularity"}
            aria-haspopup="dialog"
          >
            <span className="cost-explorer-toolbar-trigger__label">Granularity</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{granularityLabel}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "granularity" ? (
            <div className="cost-explorer-filter-popover" role="dialog" aria-label="Granularity options">
              <p className="cost-explorer-filter-popover__title">Granularity</p>
              {renderPopoverSearch("granularity", "Search granularity...")}
              {renderFilterList({
                options: filteredGranularityOptions,
                selected: effectiveGranularity,
                onSelect: onSelectGranularity,
                emptyLabel: "No granularity options found.",
              })}
            </div>
          ) : null}
        </div>

        <div className="cost-explorer-toolbar-item">
          <button
            type="button"
            ref={groupRef}
            className={`cost-explorer-toolbar-trigger${activePopover === "group" ? " is-active" : ""}`}
            onClick={() => togglePopover("group")}
            aria-expanded={activePopover === "group"}
            aria-haspopup="dialog"
          >
            <span className="cost-explorer-toolbar-trigger__label">Group</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{groupLabel}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "group" ? (
            <div className={groupPopoverClassName} role="dialog" aria-label="Group options">
              <div className="cost-explorer-filter-popover__split">
                <div className="cost-explorer-filter-popover__split-pane">
                  <p className="cost-explorer-filter-popover__title">Group By</p>
                  {renderPopoverSearch("group", "Search dimensions...")}
                  {renderFilterList({
                    options: filteredGroupOptions,
                    selected: groupBy,
                    onSelect: onSelectGroupBy,
                    emptyLabel: "No group dimensions found.",
                    listClassName: "cost-explorer-filter-popover__list--group-dimensions",
                  })}
                </div>
                {showGroupValuesPane ? (
                  <div className="cost-explorer-filter-popover__split-pane cost-explorer-filter-popover__split-pane--right">
                    <p className="cost-explorer-filter-popover__title">Values</p>
                    {groupValuesLoading && (groupValueOptions?.length ?? 0) === 0 ? (
                      <p className="cost-explorer-filter-popover__empty">Loading values...</p>
                    ) : (groupValueOptions?.length ?? 0) > 0 ? (
                      <div
                        className="cost-explorer-filter-popover__list cost-explorer-filter-popover__list--value-boxes"
                        role="listbox"
                        aria-label="Group values"
                      >
                        <button
                          type="button"
                          className={`cost-explorer-filter-option cost-explorer-filter-option--tile${(selectedGroupValues?.length ?? 0) === 0 ? " is-active" : ""}`}
                          onClick={onClearGroupValues}
                          role="option"
                          aria-selected={(selectedGroupValues?.length ?? 0) === 0}
                        >
                          <span className="cost-explorer-filter-option__content">
                            <span className="cost-explorer-filter-option__label">All values</span>
                          </span>
                          {(selectedGroupValues?.length ?? 0) === 0 ? (
                            <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" />
                          ) : null}
                        </button>
                        {groupValueOptions?.map((value) => {
                          const selected = (selectedGroupValues ?? []).includes(value.key);
                          return (
                            <button
                              key={value.key}
                              type="button"
                              className={`cost-explorer-filter-option cost-explorer-filter-option--tile${selected ? " is-active" : ""}`}
                              onClick={() => onToggleGroupValue?.(value.key)}
                              role="option"
                              aria-selected={selected}
                            >
                              <span className="cost-explorer-filter-option__content">
                                <span className="cost-explorer-filter-option__label">{value.label}</span>
                              </span>
                              <span className="cost-explorer-filter-option__label">{value.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="cost-explorer-filter-popover__empty">No values available for this group.</p>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="cost-explorer-filter-popover__actions">
                <button
                  type="button"
                  className="cost-explorer-filter-popover__apply"
                  onClick={() => {
                    onApplyGroupFilters?.();
                    setActivePopover(null);
                  }}
                  disabled={!hasPendingGroupChanges}
                >
                  Apply
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="cost-explorer-toolbar-item">
          <button
            type="button"
            ref={metricRef}
            className={`cost-explorer-toolbar-trigger${activePopover === "metric" ? " is-active" : ""}`}
            onClick={() => togglePopover("metric")}
            aria-expanded={activePopover === "metric"}
            aria-haspopup="dialog"
          >
            <span className="cost-explorer-toolbar-trigger__label">Metric</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{metricLabel}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "metric" ? (
            <div className="cost-explorer-filter-popover" role="dialog" aria-label="Metric options">
              <p className="cost-explorer-filter-popover__title">Metric</p>
              {renderPopoverSearch("metric", "Search metrics...")}
              {renderMultiFilterList({
                options: filteredMetricOptions,
                selected: selectedMetrics,
                onToggle: onSelectMetric,
                emptyLabel: "No metrics found.",
              })}
            </div>
          ) : null}
        </div>

        <div className="cost-explorer-toolbar-item">
          <button
            type="button"
            ref={compareRef}
            className={`cost-explorer-toolbar-trigger${activePopover === "compare" ? " is-active" : ""}`}
            onClick={() => togglePopover("compare")}
            aria-expanded={activePopover === "compare"}
            aria-haspopup="dialog"
          >
            <span className="cost-explorer-toolbar-trigger__label">Compare</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{compareLabel}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "compare" ? (
            <div className="cost-explorer-filter-popover cost-explorer-filter-popover--right" role="dialog" aria-label="Compare options">
              <p className="cost-explorer-filter-popover__title">Compare</p>
              {renderPopoverSearch("compare", "Search comparisons...")}
              {renderFilterList({
                options: filteredCompareOptions,
                selected: compare[0] ?? null,
                onSelect: onSelectCompare,
                emptyLabel: "No compare options found.",
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="cost-explorer-chip-bar" aria-label="Selected filter summary">
        <div className="cost-explorer-chip-row">
          {chips.map((chip) => (
            <span key={chip.key} className="cost-explorer-chip">
              <button type="button" className="cost-explorer-chip__edit" onClick={() => handleChipEdit(chip.key)}>
                {chip.label}: {chip.value}
              </button>
              <button type="button" className="cost-explorer-chip__remove" onClick={() => onRemoveChip(chip.key)} aria-label={`Remove ${chip.label}`}>
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
          <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={onClearAll}>
            Clear all
          </button>
        </div>
      </div>
    </section>
  );
}
