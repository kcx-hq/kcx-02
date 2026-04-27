import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

import type { S3CostInsightsFiltersQuery } from "../../../api/dashboardApi";
import type { S3OverviewFilterOptions, S3OverviewFilterValue } from "./s3Overview.types";

type FilterChip = {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
};

type S3FilterPopoverKey = "region" | "seriesBy" | "costBy" | "yAxisMetric" | "compareMode";

type Props = {
  value: S3OverviewFilterValue;
  filterOptions: S3OverviewFilterOptions;
  onChange: (next: S3OverviewFilterValue) => void;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
};

export function S3OverviewFilters({
  value,
  filterOptions,
  onChange,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
}: Props) {
  const seriesByOptions: NonNullable<S3CostInsightsFiltersQuery["seriesBy"]>[] = [
    "bucket",
    "cost_category",
    "operation",
    "product_family",
    "storage_class",
  ];

  const getSeriesByLabel = (seriesBy: NonNullable<S3CostInsightsFiltersQuery["seriesBy"]>) => {
    if (seriesBy === "storage_class") return "Storage Type";
    if (seriesBy === "operation") return "Operation";
    if (seriesBy === "product_family") return "Product Family";
    if (seriesBy === "bucket") return "Bucket";
    return "Cost Category";
  };

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activePopover, setActivePopover] = useState<S3FilterPopoverKey | null>(null);
  const [searchByPopover, setSearchByPopover] = useState<Record<S3FilterPopoverKey, string>>({
    region: "",
    seriesBy: "",
    costBy: "",
    yAxisMetric: "",
    compareMode: "",
  });
  const [seriesValuesSearch, setSeriesValuesSearch] = useState<string>("");
  const [draftSeriesBy, setDraftSeriesBy] = useState<NonNullable<S3CostInsightsFiltersQuery["seriesBy"]>>(value.seriesBy);
  const [draftSeriesValues, setDraftSeriesValues] = useState<string[]>(value.seriesValues);

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

  const seriesByLabel = getSeriesByLabel(value.seriesBy);
  const draftSeriesByLabel = getSeriesByLabel(draftSeriesBy);

  const draftSeriesValueOptions = useMemo(() => {
    if (draftSeriesBy === "storage_class") return filterOptions?.storageClass ?? [];
    if (draftSeriesBy === "operation") return filterOptions?.operation ?? [];
    if (draftSeriesBy === "product_family") return filterOptions?.productFamily ?? [];
    if (draftSeriesBy === "bucket") return filterOptions?.bucket ?? [];
    return filterOptions?.costCategory ?? [];
  }, [draftSeriesBy, filterOptions?.bucket, filterOptions?.costCategory, filterOptions?.operation, filterOptions?.productFamily, filterOptions?.storageClass]);
  const hasFilterOptions = Boolean(filterOptions);

  const chips = useMemo<FilterChip[]>(() => {
    const items: FilterChip[] = [];
    items.push({
      id: "seriesBy",
      label: "Cost By",
      value: seriesByLabel,
      onRemove: () => onChange({ ...value, seriesBy: "bucket", seriesValues: [] }),
    });
    if (value.seriesValues.length > 0) {
      items.push({
        id: "seriesValues",
        label: seriesByLabel,
        value: `${value.seriesValues.length} selected`,
        onRemove: () => onChange({ ...value, seriesValues: [] }),
      });
    }
    if (value.region) {
      items.push({
        id: "region",
        label: "Region",
        value: value.region,
        onRemove: () => onChange({ ...value, region: "" }),
      });
    }
    items.push({
      id: "costBy",
      label: "X-Axis",
      value: value.costBy,
      onRemove: () => onChange({ ...value, costBy: "date" }),
    });
    items.push({
      id: "yAxisMetric",
      label: "Y-Axis",
      value:
        value.yAxisMetric === "effective_cost"
          ? "Effective Cost ($)"
          : value.yAxisMetric === "amortized_cost"
            ? "Amortized Cost ($)"
            : "Billed Cost ($)",
      onRemove: () => onChange({ ...value, yAxisMetric: "billed_cost" }),
    });
    items.push({
      id: "compareMode",
      label: "Compare",
      value: value.compareMode === "previous_period" ? "Previous period" : "None",
      onRemove: () => onChange({ ...value, compareMode: "none" }),
    });
    return items;
  }, [onChange, seriesByLabel, value]);

  const normalize = (input: string) => input.trim().toLowerCase();
  const filterOptionsBySearch = (options: string[], needle: string): string[] => {
    const search = normalize(needle);
    if (!search) return options;
    return options.filter((option) => normalize(option).includes(search));
  };

  const setSearch = (key: S3FilterPopoverKey, next: string) => {
    setSearchByPopover((current) => ({ ...current, [key]: next }));
  };

  const togglePopover = (key: S3FilterPopoverKey) => {
    setActivePopover((current) => {
      const next = current === key ? null : key;
      if (next === "seriesBy") {
        setDraftSeriesBy(value.seriesBy);
        setDraftSeriesValues(value.seriesValues);
        setSeriesValuesSearch("");
      }
      return next;
    });
  };

  const clearAll = () => {
    onChange({
      seriesBy: "bucket",
      seriesValues: [],
      storageClass: [],
      region: "",
      costBy: "date",
      yAxisMetric: "billed_cost",
      chartType: "bar",
      compareMode: "none",
    });
  };

  const renderPopoverSearch = (key: S3FilterPopoverKey, placeholder: string) => (
    <label className="cost-explorer-filter-popover__search-wrap">
      <Search className="cost-explorer-filter-popover__search-icon" size={14} aria-hidden="true" />
      <input
        type="search"
        className="cost-explorer-filter-popover__search-input"
        value={searchByPopover[key]}
        onChange={(event) => setSearch(key, event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );

  return (
    <section className="cost-explorer-control-surface s3-overview-filter-panel" aria-label="S3 overview filters" ref={rootRef}>
      {isLoading ? <span className="cost-explorer-chart-panel__status">Loading S3 filters...</span> : null}
      {isError ? (
        <div className="s3-overview-filter-panel__notice s3-overview-filter-panel__notice--error" role="status">
          <span>Failed to load S3 filter options{errorMessage ? `: ${errorMessage}` : ""}</span>
          {onRetry ? (
            <button type="button" className="cost-explorer-state-btn" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="cost-explorer-toolbar-row">
        <div className="cost-explorer-toolbar-item s3-overview-filter-panel__item--cost-by">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "seriesBy" ? " is-active" : ""}`}
            onClick={() => togglePopover("seriesBy")}
            aria-expanded={activePopover === "seriesBy"}
            aria-haspopup="dialog"
            disabled={!hasFilterOptions}
          >
            <span className="cost-explorer-toolbar-trigger__label">Cost by</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{seriesByLabel}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "seriesBy" ? (
            <div className="cost-explorer-filter-popover cost-explorer-filter-popover--split cost-explorer-filter-popover--group-split s3-overview-filter-popover--cost-by" role="dialog" aria-label="Cost by options">
              <div className="cost-explorer-filter-popover__split">
                <div className="cost-explorer-filter-popover__split-pane">
                  <p className="cost-explorer-filter-popover__title">Cost by</p>
                  {renderPopoverSearch("seriesBy", "Search type...")}
                  <div className="cost-explorer-filter-popover__list cost-explorer-filter-popover__list--group-dimensions" role="listbox">
                    {filterOptionsBySearch(
                      seriesByOptions.map((option) => getSeriesByLabel(option)),
                      searchByPopover.seriesBy,
                    ).map((optionLabel) => {
                      const option = seriesByOptions.find((item) => getSeriesByLabel(item) === optionLabel) ?? "bucket";
                      const selected = option === draftSeriesBy;
                      return (
                        <button
                          key={optionLabel}
                          type="button"
                          className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                          onClick={() => {
                            setDraftSeriesBy(option as NonNullable<S3CostInsightsFiltersQuery["seriesBy"]>);
                            setDraftSeriesValues([]);
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
                      value={seriesValuesSearch}
                      onChange={(event) => setSeriesValuesSearch(event.target.value)}
                      placeholder={`Search ${draftSeriesByLabel.toLowerCase()}...`}
                    />
                  </label>
                  <div className="cost-explorer-filter-popover__list cost-explorer-filter-popover__list--value-boxes" role="listbox">
                    <button
                      type="button"
                      className={`cost-explorer-filter-option cost-explorer-filter-option--tile${draftSeriesValues.length === 0 ? " is-active" : ""}`}
                      onClick={() => setDraftSeriesValues([])}
                    >
                      <span className="cost-explorer-filter-option__content">
                        <span className="cost-explorer-filter-option__label">All values</span>
                      </span>
                      {draftSeriesValues.length === 0 ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                    </button>
                    {filterOptionsBySearch(draftSeriesValueOptions, seriesValuesSearch).map((option) => {
                      const selected = draftSeriesValues.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          className={`cost-explorer-filter-option cost-explorer-filter-option--tile${selected ? " is-active" : ""}`}
                          onClick={() =>
                            setDraftSeriesValues((current) =>
                              current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
                            )
                          }
                        >
                          <span className="cost-explorer-filter-option__content">
                            <span className="cost-explorer-filter-option__label">{option}</span>
                          </span>
                          {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                    {draftSeriesValueOptions.length === 0 ? (
                      <p className="cost-explorer-filter-popover__empty">No values available.</p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="cost-explorer-filter-popover__actions">
                <button
                  type="button"
                  className="cost-explorer-filter-popover__apply"
                  onClick={() => {
                    onChange({ ...value, seriesBy: draftSeriesBy, seriesValues: draftSeriesValues });
                    setActivePopover(null);
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="cost-explorer-toolbar-item s3-overview-filter-panel__item--region">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "region" ? " is-active" : ""}`}
            onClick={() => togglePopover("region")}
            aria-expanded={activePopover === "region"}
            aria-haspopup="dialog"
            disabled={!hasFilterOptions}
          >
            <span className="cost-explorer-toolbar-trigger__label">Region</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{value.region || "All"}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "region" ? (
            <div className="cost-explorer-filter-popover s3-overview-filter-popover--region" role="dialog" aria-label="Region options">
              <p className="cost-explorer-filter-popover__title">Region</p>
              {renderPopoverSearch("region", "Search region...")}
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {["All", ...filterOptionsBySearch(filterOptions?.region ?? [], searchByPopover.region)].map((option) => {
                  const selected = (option === "All" && !value.region) || option === value.region;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        onChange({ ...value, region: option === "All" ? "" : option });
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
                {(filterOptions?.region ?? []).length === 0 ? (
                  <p className="cost-explorer-filter-popover__empty">No regions available.</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="cost-explorer-toolbar-item s3-overview-filter-panel__item--x-axis">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "costBy" ? " is-active" : ""}`}
            onClick={() => togglePopover("costBy")}
            aria-expanded={activePopover === "costBy"}
            aria-haspopup="dialog"
          >
            <span className="cost-explorer-toolbar-trigger__label">X-Axis</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{value.costBy}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "costBy" ? (
            <div className="cost-explorer-filter-popover cost-explorer-filter-popover--right s3-overview-filter-popover--x-axis" role="dialog" aria-label="Cost by X-axis options">
              <p className="cost-explorer-filter-popover__title">Cost by (X-Axis)</p>
              {renderPopoverSearch("costBy", "Search axis...")}
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {filterOptionsBySearch(["date", "bucket", "region", "account"], searchByPopover.costBy).map((option) => {
                  const selected = option === value.costBy;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        onChange({ ...value, costBy: option as NonNullable<S3CostInsightsFiltersQuery["costBy"]> });
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

        <div className="cost-explorer-toolbar-item s3-overview-filter-panel__item--y-axis">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "yAxisMetric" ? " is-active" : ""}`}
            onClick={() => togglePopover("yAxisMetric")}
            aria-expanded={activePopover === "yAxisMetric"}
            aria-haspopup="dialog"
          >
            <span className="cost-explorer-toolbar-trigger__label">Y-Axis</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">
                {value.yAxisMetric === "effective_cost"
                  ? "Effective Cost ($)"
                  : value.yAxisMetric === "amortized_cost"
                    ? "Amortized Cost ($)"
                    : "Billed Cost ($)"}
              </span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "yAxisMetric" ? (
            <div className="cost-explorer-filter-popover cost-explorer-filter-popover--right s3-overview-filter-popover--y-axis" role="dialog" aria-label="Y-axis options">
              <p className="cost-explorer-filter-popover__title">Y-Axis</p>
              {renderPopoverSearch("yAxisMetric", "Search metric...")}
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {filterOptionsBySearch(
                  ["billed_cost", "effective_cost", "amortized_cost"],
                  searchByPopover.yAxisMetric,
                ).map((option) => {
                  const selected = option === value.yAxisMetric;
                  const label =
                    option === "effective_cost"
                      ? "Effective Cost ($)"
                      : option === "amortized_cost"
                        ? "Amortized Cost ($)"
                        : "Billed Cost ($)";
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        onChange({
                          ...value,
                          yAxisMetric: option as NonNullable<S3CostInsightsFiltersQuery["yAxisMetric"]>,
                        });
                        setActivePopover(null);
                      }}
                    >
                      <span className="cost-explorer-filter-option__content">
                        <span className="cost-explorer-filter-option__label">{label}</span>
                      </span>
                      {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="cost-explorer-toolbar-item s3-overview-filter-panel__item--compare">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "compareMode" ? " is-active" : ""}`}
            onClick={() => togglePopover("compareMode")}
            aria-expanded={activePopover === "compareMode"}
            aria-haspopup="dialog"
          >
            <span className="cost-explorer-toolbar-trigger__label">Compare</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{value.compareMode === "previous_period" ? "Previous period" : "None"}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "compareMode" ? (
            <div className="cost-explorer-filter-popover cost-explorer-filter-popover--right s3-overview-filter-popover--compare" role="dialog" aria-label="Comparison options">
              <p className="cost-explorer-filter-popover__title">Compare</p>
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {[
                  { key: "none", label: "None" },
                  { key: "previous_period", label: "Previous period" },
                ].map((option) => {
                  const selected = option.key === value.compareMode;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        onChange({ ...value, compareMode: option.key as S3OverviewFilterValue["compareMode"] });
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
          {chips.map((chip) => (
            <span key={chip.id} className="cost-explorer-chip">
              <span className="cost-explorer-chip__edit">
                {chip.label}: {chip.value}
              </span>
              <button type="button" className="cost-explorer-chip__remove" onClick={chip.onRemove} aria-label={`Remove ${chip.label}`}>
                <X size={13} aria-hidden="true" />
              </button>
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
