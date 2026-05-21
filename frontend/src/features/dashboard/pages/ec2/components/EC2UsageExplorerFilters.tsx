import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

import type { EC2ExplorerControlsState } from "../ec2ExplorerControls.types";

type UsageYAxisKey = "avg_cpu" | "max_cpu" | "network_in" | "network_out" | "network_total";

type Props = {
  value: EC2ExplorerControlsState;
  usageYAxis: UsageYAxisKey;
  availableValues: string[];
  loading?: boolean;
  onChange: (next: EC2ExplorerControlsState) => void;
  onUsageYAxisChange: (next: UsageYAxisKey) => void;
};

type PopoverKey = "usageBy" | "yAxis" | "xAxis" | "compare";

const USAGE_BY_OPTIONS: Array<{ key: EC2ExplorerControlsState["groupBy"]; label: string }> = [
  { key: "none", label: "None" },
  { key: "account", label: "Account" },
  { key: "region", label: "Region" },
  { key: "instance", label: "Instance" },
  { key: "instance-type", label: "Instance Type" },
  { key: "tag", label: "Tag" },
];

const Y_AXIS_OPTIONS: Array<{ key: UsageYAxisKey; label: string }> = [
  { key: "avg_cpu", label: "Avg CPU (%)" },
  { key: "max_cpu", label: "Max CPU (%)" },
  { key: "network_in", label: "Network In (GB)" },
  { key: "network_out", label: "Network Out (GB)" },
  { key: "network_total", label: "Network Total (GB)" },
];

export function EC2UsageExplorerFilters({
  value,
  usageYAxis,
  availableValues,
  loading = false,
  onChange,
  onUsageYAxisChange,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activePopover, setActivePopover] = useState<PopoverKey | null>(null);
  const [usageBySearch, setUsageBySearch] = useState("");
  const [valueSearch, setValueSearch] = useState("");
  const [yAxisSearch, setYAxisSearch] = useState("");
  const [draftGroupBy, setDraftGroupBy] = useState<EC2ExplorerControlsState["groupBy"]>(value.groupBy);
  const [draftGroupValues, setDraftGroupValues] = useState<string[]>(value.groupByValues);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setActivePopover(null);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePopover(null);
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, []);

  const filteredUsageBy = useMemo(() => {
    const q = usageBySearch.trim().toLowerCase();
    if (!q) return USAGE_BY_OPTIONS;
    return USAGE_BY_OPTIONS.filter((item) => item.label.toLowerCase().includes(q));
  }, [usageBySearch]);

  const filteredValues = useMemo(() => {
    const q = valueSearch.trim().toLowerCase();
    if (!q) return availableValues;
    return availableValues.filter((item) => item.toLowerCase().includes(q));
  }, [availableValues, valueSearch]);

  const filteredYAxis = useMemo(() => {
    const q = yAxisSearch.trim().toLowerCase();
    if (!q) return Y_AXIS_OPTIONS;
    return Y_AXIS_OPTIONS.filter((item) => item.label.toLowerCase().includes(q));
  }, [yAxisSearch]);

  const usageByLabel = USAGE_BY_OPTIONS.find((item) => item.key === value.groupBy)?.label ?? "None";
  const yAxisLabel = Y_AXIS_OPTIONS.find((item) => item.key === usageYAxis)?.label ?? "Avg CPU (%)";
  const compareLabel = value.compare === "previous-period" ? "Previous Period" : "None";

  const chips = [
    { id: "usageBy", label: "Usage By", value: usageByLabel, onRemove: () => onChange({ ...value, groupBy: "none", groupByValues: [] }) },
    { id: "yAxis", label: "Y-Axis", value: yAxisLabel, onRemove: () => onUsageYAxisChange("avg_cpu") },
    { id: "xAxis", label: "X-Axis", value: "date", onRemove: () => undefined },
    { id: "compare", label: "Compare", value: compareLabel, onRemove: () => onChange({ ...value, compare: "none" }) },
  ];
  if (value.groupByValues.length > 0) {
    chips.push({
      id: "values",
      label: "Values",
      value: `${value.groupByValues.length} selected`,
      onRemove: () => onChange({ ...value, groupByValues: [] }),
    });
  }

  return (
    <div className="ec2-explorer-controls-shell" ref={rootRef}>
      <div className="ec2-explorer-metric-segmented-wrap">
        <div className="ec2-explorer-metric-segmented-head">
          <div className="ec2-explorer-metric-segmented-scroll">
            <div className="ec2-explorer-metric-segmented" role="tablist" aria-label="Metric">
              <button type="button" className="ec2-explorer-metric-segmented__item" onClick={() => onChange({ ...value, metric: "cost" })} disabled={loading}>Cost</button>
              <button type="button" className="ec2-explorer-metric-segmented__item is-active" disabled={loading}>Usage</button>
              <button type="button" className="ec2-explorer-metric-segmented__item" onClick={() => onChange({ ...value, metric: "data-transfer" })} disabled={loading}>Data Transfer</button>
            </div>
          </div>
        </div>
      </div>

      <section className="cost-explorer-control-surface ec2-explorer-filter-panel" aria-label="EC2 usage explorer filters">
        <div className="cost-explorer-toolbar-row">
          <div className="cost-explorer-toolbar-item ec2-explorer-filter-panel__item--cost-by">
            <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "usageBy" ? " is-active" : ""}`} onClick={() => {
              setDraftGroupBy(value.groupBy);
              setDraftGroupValues(value.groupByValues);
              setActivePopover(activePopover === "usageBy" ? null : "usageBy");
            }} disabled={loading}>
              <span className="cost-explorer-toolbar-trigger__label">Usage By</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">{usageByLabel}</span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} />
              </span>
            </button>
            {activePopover === "usageBy" ? (
              <div className="ec2-explorer-filter-popover ec2-explorer-filter-popover--split ec2-explorer-filter-popover--group-split ec2-explorer-filter-popover--cost-by" role="dialog" aria-label="Usage by options">
                <div className="ec2-explorer-filter-popover__header">
                  <p>Usage by</p>
                  <p>Values</p>
                </div>
                <div className="ec2-explorer-filter-popover__split">
                  <div className="ec2-explorer-filter-popover__split-pane">
                    <label className="ec2-explorer-filter-popover__search">
                      <Search className="ec2-explorer-filter-popover__search-icon" size={14} />
                      <input className="ec2-explorer-filter-popover__search-input" value={usageBySearch} onChange={(e) => setUsageBySearch(e.target.value)} placeholder="Search dimensions..." />
                    </label>
                    <div className="ec2-explorer-filter-popover__list ec2-explorer-filter-popover__list-group">
                      {filteredUsageBy.map((option) => {
                        const selected = option.key === draftGroupBy;
                        return (
                          <button key={option.key} type="button" className={`ec2-explorer-filter-popover__item${selected ? " ec2-explorer-filter-popover__item--selected" : ""}`} onClick={() => setDraftGroupBy(option.key)}>
                            <span className="ec2-explorer-filter-popover__item-content">
                              <span className="ec2-explorer-filter-popover__item-label">{option.label}</span>
                            </span>
                            {selected ? <Check className="ec2-explorer-filter-popover__item-check" size={15} /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="ec2-explorer-filter-popover__split-pane ec2-explorer-filter-popover__split-pane--right">
                    <label className="ec2-explorer-filter-popover__search">
                      <Search className="ec2-explorer-filter-popover__search-icon" size={14} />
                      <input className="ec2-explorer-filter-popover__search-input" value={valueSearch} onChange={(e) => setValueSearch(e.target.value)} placeholder="Search values..." />
                    </label>
                    <div className="ec2-explorer-filter-popover__list ec2-explorer-filter-popover__values">
                      <button type="button" className={`ec2-explorer-filter-popover__item ec2-explorer-filter-popover__item--value${draftGroupValues.length === 0 ? " ec2-explorer-filter-popover__item--selected" : ""}`} onClick={() => setDraftGroupValues([])}>
                        <span className="ec2-explorer-filter-popover__item-content">
                          <span className="ec2-explorer-filter-popover__item-label">All values</span>
                        </span>
                        {draftGroupValues.length === 0 ? <Check className="ec2-explorer-filter-popover__item-check" size={15} /> : null}
                      </button>
                      {filteredValues.map((option) => {
                        const selected = draftGroupValues.includes(option);
                        return (
                          <button key={option} type="button" className={`ec2-explorer-filter-popover__item ec2-explorer-filter-popover__item--value${selected ? " ec2-explorer-filter-popover__item--selected" : ""}`} onClick={() => setDraftGroupValues((curr) => curr.includes(option) ? curr.filter((item) => item !== option) : [...curr, option])}>
                            <span className="ec2-explorer-filter-popover__item-content">
                              <span className="ec2-explorer-filter-popover__item-label">{option}</span>
                            </span>
                            {selected ? <Check className="ec2-explorer-filter-popover__item-check" size={15} /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="ec2-explorer-filter-popover__footer">
                  <button type="button" className="ec2-explorer-filter-popover__apply" onClick={() => {
                    onChange({ ...value, groupBy: draftGroupBy, groupByValues: draftGroupValues });
                    setActivePopover(null);
                  }}>Apply</button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="cost-explorer-toolbar-item ec2-explorer-filter-panel__item--y-axis">
            <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "yAxis" ? " is-active" : ""}`} onClick={() => setActivePopover(activePopover === "yAxis" ? null : "yAxis")} disabled={loading}>
              <span className="cost-explorer-toolbar-trigger__label">Y-Axis</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">{yAxisLabel}</span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} />
              </span>
            </button>
            {activePopover === "yAxis" ? (
              <div className="ec2-explorer-filter-popover ec2-explorer-filter-popover--right ec2-explorer-filter-popover--y-axis" role="dialog" aria-label="Y-axis options">
                <div className="ec2-explorer-filter-popover__header ec2-explorer-filter-popover__header--single"><p>Y-Axis</p></div>
                <label className="ec2-explorer-filter-popover__search">
                  <Search className="ec2-explorer-filter-popover__search-icon" size={14} />
                  <input className="ec2-explorer-filter-popover__search-input" value={yAxisSearch} onChange={(e) => setYAxisSearch(e.target.value)} placeholder="Search metric..." />
                </label>
                <div className="ec2-explorer-filter-popover__list">
                  {filteredYAxis.map((option) => {
                    const selected = option.key === usageYAxis;
                    return (
                      <button key={option.key} type="button" className={`ec2-explorer-filter-popover__item${selected ? " ec2-explorer-filter-popover__item--selected" : ""}`} onClick={() => {
                        onUsageYAxisChange(option.key);
                        setActivePopover(null);
                      }}>
                        <span className="ec2-explorer-filter-popover__item-content">
                          <span className="ec2-explorer-filter-popover__item-label">{option.label}</span>
                        </span>
                        {selected ? <Check className="ec2-explorer-filter-popover__item-check" size={15} /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="cost-explorer-toolbar-item ec2-explorer-filter-panel__item--x-axis">
            <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "xAxis" ? " is-active" : ""}`} onClick={() => setActivePopover(activePopover === "xAxis" ? null : "xAxis")} disabled={loading}>
              <span className="cost-explorer-toolbar-trigger__label">X-Axis</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">date</span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} />
              </span>
            </button>
            {activePopover === "xAxis" ? (
              <div className="ec2-explorer-filter-popover ec2-explorer-filter-popover--right ec2-explorer-filter-popover--x-axis" role="dialog" aria-label="X-axis options">
                <div className="ec2-explorer-filter-popover__header ec2-explorer-filter-popover__header--single"><p>X-Axis</p></div>
                <div className="ec2-explorer-filter-popover__list">
                  <button type="button" className="ec2-explorer-filter-popover__item ec2-explorer-filter-popover__item--selected">
                    <span className="ec2-explorer-filter-popover__item-content">
                      <span className="ec2-explorer-filter-popover__item-label">date</span>
                    </span>
                    <Check className="ec2-explorer-filter-popover__item-check" size={15} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="cost-explorer-toolbar-item ec2-explorer-filter-panel__item--compare">
            <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "compare" ? " is-active" : ""}`} onClick={() => setActivePopover(activePopover === "compare" ? null : "compare")} disabled={loading}>
              <span className="cost-explorer-toolbar-trigger__label">Compare</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">{compareLabel}</span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} />
              </span>
            </button>
            {activePopover === "compare" ? (
              <div className="ec2-explorer-filter-popover ec2-explorer-filter-popover--right ec2-explorer-filter-popover--compare" role="dialog" aria-label="Comparison options">
                <div className="ec2-explorer-filter-popover__header ec2-explorer-filter-popover__header--single"><p>Compare</p></div>
                <div className="ec2-explorer-filter-popover__list">
                  <button type="button" className={`ec2-explorer-filter-popover__item${value.compare === "none" ? " ec2-explorer-filter-popover__item--selected" : ""}`} onClick={() => { onChange({ ...value, compare: "none" }); setActivePopover(null); }}>
                    <span className="ec2-explorer-filter-popover__item-content">
                      <span className="ec2-explorer-filter-popover__item-label">None</span>
                    </span>
                    {value.compare === "none" ? <Check className="ec2-explorer-filter-popover__item-check" size={15} /> : null}
                  </button>
                  <button type="button" className={`ec2-explorer-filter-popover__item${value.compare === "previous-period" ? " ec2-explorer-filter-popover__item--selected" : ""}`} onClick={() => { onChange({ ...value, compare: "previous-period" }); setActivePopover(null); }}>
                    <span className="ec2-explorer-filter-popover__item-content">
                      <span className="ec2-explorer-filter-popover__item-label">Previous Period</span>
                    </span>
                    {value.compare === "previous-period" ? <Check className="ec2-explorer-filter-popover__item-check" size={15} /> : null}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="cost-explorer-chip-bar" aria-label="Selected filter summary">
          <div className="cost-explorer-chip-row">
            {chips.map((chip) => (
              <span key={chip.id} className="cost-explorer-chip">
                <span className="cost-explorer-chip__edit">{chip.label}: {chip.value}</span>
                <button type="button" className="cost-explorer-chip__remove" onClick={chip.onRemove}><X size={13} /></button>
              </span>
            ))}
            <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={() => {
              onUsageYAxisChange("avg_cpu");
              onChange({ ...value, groupBy: "none", groupByValues: [], compare: "none" });
            }}>Clear all</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export type { UsageYAxisKey };
