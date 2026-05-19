import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

import type { S3CostInsightsFiltersQuery } from "../../../../api/dashboardApi";
import type { S3UsageFilterOptions, S3UsageFilterValue } from "./s3Usage.types";

type FilterChip = {
  id: string;
  label: string;
  value: string;
  onRemove?: () => void;
};

type S3UsagePopoverKey = "seriesBy" | "xAxis" | "category" | "compareMode";

type Props = {
  value: S3UsageFilterValue;
  filterOptions: S3UsageFilterOptions;
  onChange: (next: S3UsageFilterValue) => void;
  onReset: () => void;
  isLoading?: boolean;
};

const getSeriesLabel = (seriesBy: NonNullable<S3CostInsightsFiltersQuery["seriesBy"]>) => {
  if (seriesBy === "bucket") return "Bucket";
  if (seriesBy === "operation") return "Operation Group";
  if (seriesBy === "storage_class") return "Storage Type";
  return "Usage Type";
};

const getCategoryLabel = (category: S3UsageFilterValue["category"]) => {
  if (category === "storage") return "Storage";
  if (category === "data_transfer") return "Data transfer";
  if (category === "request") return "Request";
  if (category === "object_count") return "Object count";
  return "All";
};

const getCompareLabel = (mode: S3UsageFilterValue["compareMode"]) =>
  mode === "previous_period" ? "Previous period" : "None";

export function S3UsageFilters({ value, filterOptions, onChange, onReset, isLoading = false }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activePopover, setActivePopover] = useState<S3UsagePopoverKey | null>(null);
  const [seriesSearch, setSeriesSearch] = useState("");
  const [seriesValueSearch, setSeriesValueSearch] = useState("");
  const [draftSeriesBy, setDraftSeriesBy] = useState<NonNullable<S3CostInsightsFiltersQuery["seriesBy"]>>(value.seriesBy);
  const [draftSeriesValue, setDraftSeriesValue] = useState(value.seriesValue);

  const seriesByOptions: Array<NonNullable<S3CostInsightsFiltersQuery["seriesBy"]>> = [
    "bucket",
    "usage_type",
    "operation",
    "storage_class",
  ];
  const xAxisOptions: Array<NonNullable<S3CostInsightsFiltersQuery["costBy"]>> = ["date", "bucket", "region", "account"];
  const categoryOptions: Array<Exclude<S3UsageFilterValue["category"], "">> = [
    "storage",
    "request",
    "data_transfer",
    "object_count",
  ];
  const compareOptions: Array<S3UsageFilterValue["compareMode"]> = ["none", "previous_period"];
  const hasFilterOptions = Boolean(filterOptions);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setActivePopover(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePopover(null);
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const togglePopover = (key: S3UsagePopoverKey) => {
    setActivePopover((current) => {
      const next = current === key ? null : key;
      if (next === "seriesBy") {
        setDraftSeriesBy(value.seriesBy);
        setDraftSeriesValue(value.seriesValue);
        setSeriesSearch("");
        setSeriesValueSearch("");
      }
      return next;
    });
  };

  const normalize = (input: string) => input.trim().toLowerCase();
  const filterBySearch = (options: string[], term: string) => {
    const needle = normalize(term);
    if (!needle) return options;
    return options.filter((option) => normalize(option).includes(needle));
  };
  const draftSeriesValueOptions = useMemo(() => {
    if (draftSeriesBy === "bucket") return filterOptions?.bucket ?? [];
    if (draftSeriesBy === "usage_type") return filterOptions?.usageType ?? [];
    if (draftSeriesBy === "operation") return filterOptions?.operation ?? [];
    if (draftSeriesBy === "storage_class") return filterOptions?.storageClass ?? [];
    return [];
  }, [draftSeriesBy, filterOptions?.bucket, filterOptions?.operation, filterOptions?.storageClass, filterOptions?.usageType]);

  const chips = useMemo<FilterChip[]>(() => {
    const items: FilterChip[] = [
      {
        id: "seriesBy",
        label: "Usage By",
        value: getSeriesLabel(value.seriesBy),
        onRemove: () => onChange({ ...value, seriesBy: "bucket", seriesValue: "" }),
      },
      {
        id: "xAxis",
        label: "X-Axis",
        value: value.xAxis,
        onRemove: () => onChange({ ...value, xAxis: "date" }),
      },
    ];

    if (value.seriesValue) {
      items.push({
        id: "seriesValue",
        label: getSeriesLabel(value.seriesBy),
        value: value.seriesValue,
        onRemove: () => onChange({ ...value, seriesValue: "" }),
      });
    }
    if (value.storageClass) {
      items.push({
        id: "storageClass",
        label: "Storage Type",
        value: value.storageClass,
        onRemove: () => onChange({ ...value, storageClass: "" }),
      });
    }
    if (value.chartType !== "bar") {
      items.push({
        id: "chartType",
        label: "Chart",
        value: value.chartType === "line" ? "Line" : "Bar",
        onRemove: () => onChange({ ...value, chartType: "bar" }),
      });
    }

    if (value.category) {
      items.push({
        id: "category",
        label: "Y-Axis",
        value: getCategoryLabel(value.category),
        onRemove: () => onChange({ ...value, category: "" }),
      });
    }
    items.push({
      id: "compareMode",
      label: "Compare",
      value: getCompareLabel(value.compareMode),
      onRemove: () => onChange({ ...value, compareMode: "none" }),
    });
    return items;
  }, [onChange, value]);

  return (
    <section
      className="cost-explorer-control-surface s3-overview-filter-panel s3-usage-filter-panel"
      aria-label="S3 usage filters"
      ref={rootRef}
    >
      <div className="cost-explorer-toolbar-row">
        <div className="cost-explorer-toolbar-item s3-usage-filter-panel__item--cost-by">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "seriesBy" ? " is-active" : ""}`}
            onClick={() => togglePopover("seriesBy")}
            aria-expanded={activePopover === "seriesBy"}
            aria-haspopup="dialog"
            disabled={!hasFilterOptions || isLoading}
          >
            <span className="cost-explorer-toolbar-trigger__label">Usage By</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{getSeriesLabel(value.seriesBy)}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "seriesBy" ? (
            <div
              className="cost-explorer-filter-popover cost-explorer-filter-popover--split cost-explorer-filter-popover--group-split s3-usage-filter-popover--cost-by"
              role="dialog"
              aria-label="Usage by options"
            >
              <div className="cost-explorer-filter-popover__split">
                <div className="cost-explorer-filter-popover__split-pane">
                  <p className="cost-explorer-filter-popover__title">Usage By</p>
                  <label className="cost-explorer-filter-popover__search-wrap">
                    <Search className="cost-explorer-filter-popover__search-icon" size={14} aria-hidden="true" />
                    <input
                      type="search"
                      className="cost-explorer-filter-popover__search-input"
                      value={seriesSearch}
                      onChange={(event) => setSeriesSearch(event.target.value)}
                      placeholder="Search type..."
                    />
                  </label>
                  <div className="cost-explorer-filter-popover__list cost-explorer-filter-popover__list--group-dimensions" role="listbox">
                    {filterBySearch(seriesByOptions.map((option) => getSeriesLabel(option)), seriesSearch).map((optionLabel) => {
                      const option = seriesByOptions.find((item) => getSeriesLabel(item) === optionLabel) ?? "bucket";
                      const selected = option === draftSeriesBy;
                      return (
                        <button
                          key={option}
                          type="button"
                          className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                          onClick={() => {
                            setDraftSeriesBy(option);
                            setDraftSeriesValue("");
                          }}
                        >
                          <span className="cost-explorer-filter-option__content">
                            <span className="cost-explorer-filter-option__label">{optionLabel}</span>
                          </span>
                          {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="cost-explorer-filter-popover__split-pane cost-explorer-filter-popover__split-pane--right">
                  <p className="cost-explorer-filter-popover__title">Values</p>
                  <label className="cost-explorer-filter-popover__search-wrap">
                    <Search className="cost-explorer-filter-popover__search-icon" size={14} aria-hidden="true" />
                    <input
                      type="search"
                      className="cost-explorer-filter-popover__search-input"
                      value={seriesValueSearch}
                      onChange={(event) => setSeriesValueSearch(event.target.value)}
                      placeholder={`Search ${getSeriesLabel(draftSeriesBy).toLowerCase()}...`}
                    />
                  </label>
                  <div className="cost-explorer-filter-popover__list cost-explorer-filter-popover__list--value-boxes" role="listbox">
                    <button
                      type="button"
                      className={`cost-explorer-filter-option cost-explorer-filter-option--tile${!draftSeriesValue ? " is-active" : ""}`}
                      onClick={() => setDraftSeriesValue("")}
                    >
                      <span className="cost-explorer-filter-option__content">
                        <span className="cost-explorer-filter-option__label">All values</span>
                      </span>
                      {!draftSeriesValue ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                    </button>
                    {filterBySearch(draftSeriesValueOptions, seriesValueSearch).map((option) => {
                      const selected = option === draftSeriesValue;
                      return (
                        <button
                          key={option}
                          type="button"
                          className={`cost-explorer-filter-option cost-explorer-filter-option--tile${selected ? " is-active" : ""}`}
                          onClick={() => setDraftSeriesValue(option)}
                        >
                          <span className="cost-explorer-filter-option__content">
                            <span className="cost-explorer-filter-option__label">{option}</span>
                          </span>
                          {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="cost-explorer-filter-popover__actions">
                <button
                  type="button"
                  className="cost-explorer-filter-popover__apply"
                  onClick={() => {
                    onChange({ ...value, seriesBy: draftSeriesBy, seriesValue: draftSeriesValue });
                    setActivePopover(null);
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="cost-explorer-toolbar-item s3-usage-filter-panel__item--x-axis">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "xAxis" ? " is-active" : ""}`}
            onClick={() => togglePopover("xAxis")}
            aria-expanded={activePopover === "xAxis"}
            aria-haspopup="dialog"
            disabled={isLoading}
          >
            <span className="cost-explorer-toolbar-trigger__label">X-Axis</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{value.xAxis}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "xAxis" ? (
            <div className="cost-explorer-filter-popover s3-usage-filter-popover--x-axis" role="dialog" aria-label="X-axis options">
              <p className="cost-explorer-filter-popover__title">X-Axis</p>
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {xAxisOptions.map((option) => {
                  const selected = option === value.xAxis;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        onChange({ ...value, xAxis: option });
                        setActivePopover(null);
                      }}
                    >
                      <span className="cost-explorer-filter-option__content">
                        <span className="cost-explorer-filter-option__label">{option}</span>
                      </span>
                      {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="cost-explorer-toolbar-item s3-usage-filter-panel__item--compare">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "category" ? " is-active" : ""}`}
            onClick={() => togglePopover("category")}
            aria-expanded={activePopover === "category"}
            aria-haspopup="dialog"
            disabled={isLoading}
          >
            <span className="cost-explorer-toolbar-trigger__label">Y-Axis</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{getCategoryLabel(value.category)}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "category" ? (
            <div className="cost-explorer-filter-popover s3-usage-filter-popover--category" role="dialog" aria-label="Y-axis options">
              <p className="cost-explorer-filter-popover__title">Y-Axis</p>
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {categoryOptions.map((option) => {
                  const selected = option === value.category;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        onChange({ ...value, category: option as S3UsageFilterValue["category"] });
                        setActivePopover(null);
                      }}
                    >
                      <span className="cost-explorer-filter-option__content">
                        <span className="cost-explorer-filter-option__label">{getCategoryLabel(option as S3UsageFilterValue["category"])}</span>
                      </span>
                      {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="cost-explorer-toolbar-item s3-usage-filter-panel__item--compare-mode">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "compareMode" ? " is-active" : ""}`}
            onClick={() => togglePopover("compareMode")}
            aria-expanded={activePopover === "compareMode"}
            aria-haspopup="dialog"
            disabled={isLoading}
          >
            <span className="cost-explorer-toolbar-trigger__label">Compare</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{getCompareLabel(value.compareMode)}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "compareMode" ? (
            <div className="cost-explorer-filter-popover s3-usage-filter-popover--compare" role="dialog" aria-label="Compare options">
              <p className="cost-explorer-filter-popover__title">Compare</p>
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {compareOptions.map((option) => {
                  const selected = option === value.compareMode;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        onChange({ ...value, compareMode: option });
                        setActivePopover(null);
                      }}
                    >
                      <span className="cost-explorer-filter-option__content">
                        <span className="cost-explorer-filter-option__label">{getCompareLabel(option)}</span>
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

      <div className="cost-explorer-chip-bar" aria-label="Usage filter summary">
        <div className="cost-explorer-chip-row">
          {chips.map((chip) => (
            <span key={chip.id} className="cost-explorer-chip">
              <span className="cost-explorer-chip__edit">
                {chip.label}: {chip.value}
              </span>
              {chip.onRemove ? (
                <button type="button" className="cost-explorer-chip__remove" onClick={chip.onRemove} aria-label={`Remove ${chip.label}`}>
                  <X size={13} aria-hidden="true" />
                </button>
              ) : null}
            </span>
          ))}
          <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={onReset}>
            Clear all
          </button>
        </div>
      </div>
    </section>
  );
}
