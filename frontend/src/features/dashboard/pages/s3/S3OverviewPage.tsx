import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { BaseEChart } from "../../common/charts/BaseEChart";
import { useS3CostInsightsQuery } from "../../hooks/useDashboardQueries";
import type { S3CostInsightsFiltersQuery } from "../../api/dashboardApi";

const graphCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const xAxisFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});

const CHART_COLORS = [
  "#1f77b4",
  "#2ca02c",
  "#ff7f0e",
  "#d62728",
  "#9467bd",
  "#17becf",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
];

type FilterChip = {
  key: keyof Required<S3CostInsightsFiltersQuery> | "bucket";
  label: string;
  value: string;
};

type S3FilterPopoverKey = "costCategory" | "region" | "seriesBy" | "costBy";

export default function S3OverviewPage() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activePopover, setActivePopover] = useState<S3FilterPopoverKey | null>(null);
  const [searchByPopover, setSearchByPopover] = useState<Record<S3FilterPopoverKey, string>>({
    costCategory: "",
    region: "",
    seriesBy: "",
    costBy: "",
  });
  const [selectedCostCategory, setSelectedCostCategory] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [costBy, setCostBy] = useState<NonNullable<S3CostInsightsFiltersQuery["costBy"]>>("date");
  const [seriesBy, setSeriesBy] = useState<NonNullable<S3CostInsightsFiltersQuery["seriesBy"]>>("usage_type");

  const queryFilters = useMemo<S3CostInsightsFiltersQuery>(
    () => ({
      ...(selectedCostCategory ? { costCategory: [selectedCostCategory] } : {}),
      ...(selectedRegion ? { region: [selectedRegion] } : {}),
      costBy,
      seriesBy,
    }),
    [costBy, selectedCostCategory, selectedRegion, seriesBy],
  );

  const query = useS3CostInsightsQuery(queryFilters);

  const breakdown = query.data?.chart.breakdown;
  const chartReady = Boolean(breakdown && breakdown.labels.length > 0 && breakdown.series.length > 0);
  const filterOptions = query.data?.filterOptions;

  const labels = useMemo(
    () =>
      (breakdown?.labels ?? []).map((label) => {
        if (costBy !== "date") return label;
        const parsed = new Date(`${label}T00:00:00.000Z`);
        return Number.isNaN(parsed.getTime()) ? label : xAxisFormatter.format(parsed);
      }),
    [breakdown?.labels, costBy],
  );

  const chartOption = useMemo<EChartsOption>(() => {
    const series = breakdown?.series ?? [];
    return {
      color: series.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (value: unknown) => graphCurrencyFormatter.format(Number(value ?? 0)),
      },
      legend: {
        top: 0,
        icon: "roundRect",
        itemHeight: 6,
        itemWidth: 18,
        textStyle: { color: "#58706d", fontSize: 11 },
      },
      grid: { left: 10, right: 10, top: 36, bottom: 14, containLabel: true },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: "#d7e4df" } },
        axisLabel: { color: "#5c7370", fontSize: 11, hideOverlap: true, rotate: labels.length > 24 ? 28 : 0 },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#e1eae7", type: "dashed" } },
        axisLabel: {
          color: "#6d837e",
          fontSize: 11,
          formatter: (value: number) => graphCurrencyFormatter.format(value),
        },
      },
      dataZoom: labels.length > 45 ? [{ type: "inside", start: 0, end: 100 }] : undefined,
      series: series.map((item) => ({
        name: item.name,
        type: "bar",
        stack: "s3-overview",
        barWidth: 44,
        barMaxWidth: 52,
        barCategoryGap: "34%",
        barGap: "10%",
        itemStyle: { borderRadius: 0 },
        data: item.values.map((value) => Number(value ?? 0)),
      })),
    };
  }, [breakdown?.series, labels]);

  const chips = useMemo<FilterChip[]>(() => {
    const items: FilterChip[] = [];
    items.push({ key: "seriesBy", label: "Cost By", value: seriesBy });
    if (selectedCostCategory) items.push({ key: "costCategory", label: "Cost Category", value: selectedCostCategory });
    if (selectedRegion) items.push({ key: "region", label: "Region", value: selectedRegion });
    items.push({ key: "costBy", label: "Cost By (X-Axis)", value: costBy });
    return items;
  }, [costBy, selectedCostCategory, selectedRegion, seriesBy]);

  const clearOne = (key: FilterChip["key"]) => {
    if (key === "costCategory") setSelectedCostCategory("");
    if (key === "region") setSelectedRegion("");
    if (key === "costBy") setCostBy("date");
    if (key === "seriesBy") setSeriesBy("usage_type");
  };

  const clearAll = () => {
    setSelectedCostCategory("");
    setSelectedRegion("");
    setCostBy("date");
    setSeriesBy("usage_type");
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setActivePopover(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePopover(null);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const normalize = (value: string) => value.trim().toLowerCase();
  const filterOptionsBySearch = (options: string[], key: S3FilterPopoverKey): string[] => {
    const needle = normalize(searchByPopover[key]);
    if (!needle) return options;
    return options.filter((option) => normalize(option).includes(needle));
  };
  const setSearch = (key: S3FilterPopoverKey, value: string) => {
    setSearchByPopover((current) => ({ ...current, [key]: value }));
  };
  const togglePopover = (key: S3FilterPopoverKey) => {
    setActivePopover((current) => (current === key ? null : key));
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
    <div className="dashboard-page s3-overview-page" ref={rootRef}>
      {query.isLoading ? <p className="dashboard-note">Loading S3 overview...</p> : null}
      {query.isError ? <p className="dashboard-note">Failed to load S3 overview: {query.error.message}</p> : null}

      {!query.isLoading && !query.isError ? (
        <>
          <section className="cost-explorer-control-surface s3-overview-filter-panel" aria-label="S3 overview filters">
            <div className="cost-explorer-toolbar-row">
              <div className="cost-explorer-toolbar-item" style={{ order: 2 }}>
                <button
                  type="button"
                  className={`cost-explorer-toolbar-trigger${activePopover === "costCategory" ? " is-active" : ""}`}
                  onClick={() => togglePopover("costCategory")}
                  aria-expanded={activePopover === "costCategory"}
                  aria-haspopup="dialog"
                >
                  <span className="cost-explorer-toolbar-trigger__label">Cost Category</span>
                  <span className="cost-explorer-toolbar-trigger__row">
                    <span className="cost-explorer-toolbar-trigger__value">{selectedCostCategory || "All"}</span>
                    <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
                  </span>
                </button>
                {activePopover === "costCategory" ? (
                  <div className="cost-explorer-filter-popover" role="dialog" aria-label="Cost Category options">
                    <p className="cost-explorer-filter-popover__title">Cost Category</p>
                    {renderPopoverSearch("costCategory", "Search cost category...")}
                    <div className="cost-explorer-filter-popover__list" role="listbox">
                      {["All", ...filterOptionsBySearch(filterOptions?.costCategory ?? [], "costCategory")].map((option) => {
                        const selected = (option === "All" && !selectedCostCategory) || option === selectedCostCategory;
                        return (
                          <button
                            key={option}
                            type="button"
                            className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                            onClick={() => {
                              setSelectedCostCategory(option === "All" ? "" : option);
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

              <div className="cost-explorer-toolbar-item" style={{ order: 3 }}>
                <button
                  type="button"
                  className={`cost-explorer-toolbar-trigger${activePopover === "region" ? " is-active" : ""}`}
                  onClick={() => togglePopover("region")}
                  aria-expanded={activePopover === "region"}
                  aria-haspopup="dialog"
                >
                  <span className="cost-explorer-toolbar-trigger__label">Region</span>
                  <span className="cost-explorer-toolbar-trigger__row">
                    <span className="cost-explorer-toolbar-trigger__value">{selectedRegion || "All"}</span>
                    <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
                  </span>
                </button>
                {activePopover === "region" ? (
                  <div className="cost-explorer-filter-popover" role="dialog" aria-label="Region options">
                    <p className="cost-explorer-filter-popover__title">Region</p>
                    {renderPopoverSearch("region", "Search region...")}
                    <div className="cost-explorer-filter-popover__list" role="listbox">
                      {["All", ...filterOptionsBySearch(filterOptions?.region ?? [], "region")].map((option) => {
                        const selected = (option === "All" && !selectedRegion) || option === selectedRegion;
                        return (
                          <button
                            key={option}
                            type="button"
                            className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                            onClick={() => {
                              setSelectedRegion(option === "All" ? "" : option);
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

              <div className="cost-explorer-toolbar-item" style={{ order: 1 }}>
                <button
                  type="button"
                  className={`cost-explorer-toolbar-trigger${activePopover === "seriesBy" ? " is-active" : ""}`}
                  onClick={() => togglePopover("seriesBy")}
                  aria-expanded={activePopover === "seriesBy"}
                  aria-haspopup="dialog"
                >
                  <span className="cost-explorer-toolbar-trigger__label">Cost by</span>
                  <span className="cost-explorer-toolbar-trigger__row">
                    <span className="cost-explorer-toolbar-trigger__value">{seriesBy}</span>
                    <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
                  </span>
                </button>
                {activePopover === "seriesBy" ? (
                  <div className="cost-explorer-filter-popover" role="dialog" aria-label="Cost by options">
                    <p className="cost-explorer-filter-popover__title">Cost by</p>
                    {renderPopoverSearch("seriesBy", "Search type...")}
                    <div className="cost-explorer-filter-popover__list" role="listbox">
                      {filterOptionsBySearch(
                        ["usage_type", "cost_category", "operation", "product_family"],
                        "seriesBy",
                      ).map((option) => {
                        const selected = option === seriesBy;
                        return (
                          <button
                            key={option}
                            type="button"
                            className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                            onClick={() => {
                              setSeriesBy(option as NonNullable<S3CostInsightsFiltersQuery["seriesBy"]>);
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

              <div className="cost-explorer-toolbar-item" style={{ order: 4 }}>
                <button
                  type="button"
                  className={`cost-explorer-toolbar-trigger${activePopover === "costBy" ? " is-active" : ""}`}
                  onClick={() => togglePopover("costBy")}
                  aria-expanded={activePopover === "costBy"}
                  aria-haspopup="dialog"
                >
                  <span className="cost-explorer-toolbar-trigger__label">Cost by (X-Axis)</span>
                  <span className="cost-explorer-toolbar-trigger__row">
                    <span className="cost-explorer-toolbar-trigger__value">{costBy}</span>
                    <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
                  </span>
                </button>
                {activePopover === "costBy" ? (
                  <div className="cost-explorer-filter-popover cost-explorer-filter-popover--right" role="dialog" aria-label="Cost by X-axis options">
                    <p className="cost-explorer-filter-popover__title">Cost by (X-Axis)</p>
                    {renderPopoverSearch("costBy", "Search axis...")}
                    <div className="cost-explorer-filter-popover__list" role="listbox">
                      {filterOptionsBySearch(["date", "bucket", "region", "account"], "costBy").map((option) => {
                        const selected = option === costBy;
                        return (
                          <button
                            key={option}
                            type="button"
                            className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                            onClick={() => {
                              setCostBy(option as NonNullable<S3CostInsightsFiltersQuery["costBy"]>);
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
            </div>

            <div className="cost-explorer-chip-bar" aria-label="Selected filter summary">
              <div className="cost-explorer-chip-row">
                {chips.map((chip) => (
                  <span key={`${chip.key}-${chip.value}`} className="cost-explorer-chip">
                    <span className="cost-explorer-chip__edit">{chip.label}: {chip.value}</span>
                    <button
                      type="button"
                      className="cost-explorer-chip__remove"
                      onClick={() => clearOne(chip.key)}
                      aria-label={`Remove ${chip.label}`}
                    >
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

          <section className="cost-explorer-chart-panel s3-overview-chart-panel" aria-label="S3 date vs cost chart">
            <div className="cost-explorer-chart-panel__header">
              <h2 className="cost-explorer-chart-panel__title">S3 Cost Breakdown</h2>
            </div>
            <div className="cost-explorer-chart-panel__body">
              {chartReady ? (
                <BaseEChart option={chartOption} height={420} />
              ) : (
                <p className="dashboard-note">No S3 data available for the selected filters.</p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
