import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

import type { S3CostInsightsFiltersQuery } from "../../../../api/dashboardApi";
import type { S3UsageFilterOptions, S3UsageFilterValue } from "./s3Usage.types";

type FilterChip = {
  id: string;
  label: string;
  value: string;
  onRemove?: () => void;
};

type S3UsagePopoverKey = "seriesBy" | "xAxis" | "yAxisMetric" | "region" | "category";

type Props = {
  value: S3UsageFilterValue;
  filterOptions: S3UsageFilterOptions;
  onChange: (next: S3UsageFilterValue) => void;
  onReset: () => void;
  isLoading?: boolean;
};

const getSeriesLabel = (seriesBy: NonNullable<S3CostInsightsFiltersQuery["seriesBy"]>) => {
  if (seriesBy === "bucket") return "Bucket";
  if (seriesBy === "operation") return "Operation";
  if (seriesBy === "product_family") return "Product Family";
  if (seriesBy === "storage_class") return "Storage Type";
  return "Usage Type";
};

const getYAxisLabel = (metric: NonNullable<S3CostInsightsFiltersQuery["yAxisMetric"]>) => {
  if (metric === "usage_quantity") return "Usage Quantity";
  return "Usage Quantity";
};

const getCategoryLabel = (category: S3UsageFilterValue["category"]) => {
  if (category === "storage") return "Storage";
  if (category === "data_transfer") return "Data transfer";
  if (category === "request") return "Request";
  return "All";
};

export function S3UsageFilters({ value, filterOptions, onChange, onReset, isLoading = false }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activePopover, setActivePopover] = useState<S3UsagePopoverKey | null>(null);

  const seriesByOptions: Array<NonNullable<S3CostInsightsFiltersQuery["seriesBy"]>> = ["bucket"];
  const xAxisOptions: Array<NonNullable<S3CostInsightsFiltersQuery["costBy"]>> = ["date", "bucket", "region", "account"];
  const yAxisMetricOptions: Array<NonNullable<S3CostInsightsFiltersQuery["yAxisMetric"]>> = ["usage_quantity"];
  const categoryOptions: Array<Exclude<S3UsageFilterValue["category"], "">> = ["storage", "data_transfer", "request"];
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
    setActivePopover((current) => (current === key ? null : key));
  };

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
      {
        id: "yAxisMetric",
        label: "Y-Axis",
        value: getYAxisLabel(value.yAxisMetric),
        onRemove: () => onChange({ ...value, yAxisMetric: "usage_quantity" }),
      },
    ];

    if (value.region) {
      items.push({
        id: "region",
        label: "Region",
        value: value.region,
        onRemove: () => onChange({ ...value, region: "" }),
      });
    }
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
        label: "Category",
        value: getCategoryLabel(value.category),
        onRemove: () => onChange({ ...value, category: "" }),
      });
    }
    return items;
  }, [onChange, value]);

  return (
    <section
      className="cost-explorer-control-surface s3-overview-filter-panel s3-usage-filter-panel"
      aria-label="S3 usage filters"
      ref={rootRef}
    >
      {isLoading ? <span className="cost-explorer-chart-panel__status">Loading S3 usage filters...</span> : null}

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
            <div className="cost-explorer-filter-popover s3-usage-filter-popover--cost-by" role="dialog" aria-label="Cost by options">
              <p className="cost-explorer-filter-popover__title">Usage By</p>
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {seriesByOptions.map((option) => {
                  const selected = option === value.seriesBy;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        onChange({ ...value, seriesBy: option, seriesValue: "" });
                        setActivePopover(null);
                      }}
                    >
                      <span className="cost-explorer-filter-option__content">
                        <span className="cost-explorer-filter-option__label">{getSeriesLabel(option)}</span>
                      </span>
                      {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="cost-explorer-toolbar-item s3-usage-filter-panel__item--y-axis">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "yAxisMetric" ? " is-active" : ""}`}
            onClick={() => togglePopover("yAxisMetric")}
            aria-expanded={activePopover === "yAxisMetric"}
            aria-haspopup="dialog"
            disabled={isLoading}
          >
            <span className="cost-explorer-toolbar-trigger__label">Y-Axis</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{getYAxisLabel(value.yAxisMetric)}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "yAxisMetric" ? (
            <div className="cost-explorer-filter-popover s3-usage-filter-popover--y-axis" role="dialog" aria-label="Y-axis options">
              <p className="cost-explorer-filter-popover__title">Y-Axis</p>
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {yAxisMetricOptions.map((option) => {
                  const selected = option === value.yAxisMetric;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        onChange({ ...value, yAxisMetric: option });
                        setActivePopover(null);
                      }}
                    >
                      <span className="cost-explorer-filter-option__content">
                        <span className="cost-explorer-filter-option__label">{getYAxisLabel(option)}</span>
                      </span>
                      {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
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

        <div className="cost-explorer-toolbar-item s3-usage-filter-panel__item--region">
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${activePopover === "region" ? " is-active" : ""}`}
            onClick={() => togglePopover("region")}
            aria-expanded={activePopover === "region"}
            aria-haspopup="dialog"
            disabled={!hasFilterOptions || isLoading}
          >
            <span className="cost-explorer-toolbar-trigger__label">Region</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{value.region || "All"}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "region" ? (
            <div className="cost-explorer-filter-popover s3-usage-filter-popover--region" role="dialog" aria-label="Region options">
              <p className="cost-explorer-filter-popover__title">Region</p>
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {["All", ...(filterOptions?.region ?? [])].map((option) => {
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
            <span className="cost-explorer-toolbar-trigger__label">Category</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{getCategoryLabel(value.category)}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {activePopover === "category" ? (
            <div className="cost-explorer-filter-popover s3-usage-filter-popover--category" role="dialog" aria-label="Category options">
              <p className="cost-explorer-filter-popover__title">Category</p>
              <div className="cost-explorer-filter-popover__list" role="listbox">
                {["All", ...categoryOptions].map((option) => {
                  const optionValue = option === "All" ? "" : option;
                  const selected = optionValue === value.category;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        onChange({ ...value, category: optionValue as S3UsageFilterValue["category"] });
                        setActivePopover(null);
                      }}
                    >
                      <span className="cost-explorer-filter-option__content">
                        <span className="cost-explorer-filter-option__label">
                          {option === "All" ? "All" : getCategoryLabel(option as S3UsageFilterValue["category"])}
                        </span>
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
