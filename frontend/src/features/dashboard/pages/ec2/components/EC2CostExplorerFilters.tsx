import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

import {
  EC2_COST_TYPE_LABELS,
  EC2_COST_TYPE_ORDER,
  normalizeEc2CostTypeKey,
  type EC2ExplorerControlsState,
} from "../ec2ExplorerControls.types";

type Props = {
  value: EC2ExplorerControlsState;
  availableValues: string[];
  loading?: boolean;
  onChange: (next: EC2ExplorerControlsState) => void;
};

type PopoverKey = "costBy" | "yAxis" | "xAxis" | "compare";

const COST_BY_OPTIONS: Array<{ key: EC2ExplorerControlsState["groupBy"]; label: string }> = [
  { key: "account", label: "Account" },
  { key: "region", label: "Region" },
  { key: "instance", label: "Instance" },
  { key: "instance-type", label: "Instance Type" },
  { key: "cost-category", label: "Cost Type" },
  { key: "reservation-type", label: "Reservation Type" },
  { key: "tag", label: "Tag" },
];

const Y_AXIS_OPTIONS: Array<{ key: EC2ExplorerControlsState["costBasis"]; label: string }> = [
  { key: "billed_cost", label: "Gross Cost ($)" },
  { key: "net_unblended_cost", label: "Net Cost ($)" },
  { key: "effective_cost", label: "Effective Cost ($)" },
  { key: "amortized_cost", label: "Amortized Cost ($)" },
];

export function EC2CostExplorerFilters({ value, availableValues, loading = false, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activePopover, setActivePopover] = useState<PopoverKey | null>(null);
  const [costBySearch, setCostBySearch] = useState("");
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

  const filteredCostBy = useMemo(() => {
    const q = costBySearch.trim().toLowerCase();
    if (!q) return COST_BY_OPTIONS;
    return COST_BY_OPTIONS.filter((item) => item.label.toLowerCase().includes(q));
  }, [costBySearch]);

  const filteredValues = useMemo(() => {
    const q = valueSearch.trim().toLowerCase();
    const cleaned = availableValues.filter((item) => {
      const normalized = item.trim().toLowerCase();
      return normalized.length > 0 && normalized !== "unknown" && normalized !== "null" && normalized !== "undefined";
    });
    const values = draftGroupBy === "cost-category"
      ? (() => {
          const canonical = EC2_COST_TYPE_ORDER.map((key) => EC2_COST_TYPE_LABELS[key]);
          const extras = cleaned
            .filter((item) => normalizeEc2CostTypeKey(item) === null)
            .sort((a, b) => a.localeCompare(b));
          return [...canonical, ...extras];
        })()
      : cleaned;
    if (!q) return values;
    return values.filter((item) => item.toLowerCase().includes(q));
  }, [availableValues, draftGroupBy, valueSearch]);

  const filteredYAxis = useMemo(() => {
    const q = yAxisSearch.trim().toLowerCase();
    if (!q) return Y_AXIS_OPTIONS;
    return Y_AXIS_OPTIONS.filter((item) => item.label.toLowerCase().includes(q));
  }, [yAxisSearch]);

  const costByLabel = COST_BY_OPTIONS.find((item) => item.key === value.groupBy)?.label ?? "Cost Type";
  const yAxisLabel = Y_AXIS_OPTIONS.find((item) => item.key === value.costBasis)?.label ?? "Gross Cost ($)";
  const compareLabel = value.compare === "previous-period" ? "Previous Period" : "None";

  const chips = [
    { id: "costBy", label: "Cost By", value: costByLabel, onRemove: () => onChange({ ...value, groupBy: "cost-category", groupByValues: [] }) },
    { id: "yAxis", label: "Y-Axis", value: yAxisLabel, onRemove: () => onChange({ ...value, costBasis: "billed_cost" }) },
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
              <button type="button" className="ec2-explorer-metric-segmented__item is-active" disabled={loading}>Cost</button>
              <button type="button" className="ec2-explorer-metric-segmented__item" onClick={() => onChange({ ...value, metric: "usage" })} disabled={loading}>Usage</button>
              <button type="button" className="ec2-explorer-metric-segmented__item" onClick={() => onChange({ ...value, metric: "data-transfer" })} disabled={loading}>Data Transfer</button>
            </div>
          </div>
        </div>
      </div>

      <section className="cost-explorer-control-surface ec2-explorer-filter-panel" aria-label="EC2 cost explorer filters">
        <div className="cost-explorer-toolbar-row">
          <div className="cost-explorer-toolbar-item ec2-explorer-filter-panel__item--cost-by">
            <button type="button" className={`cost-explorer-toolbar-trigger${activePopover === "costBy" ? " is-active" : ""}`} onClick={() => {
              setDraftGroupBy(COST_BY_OPTIONS.some((option) => option.key === value.groupBy) ? value.groupBy : "cost-category");
              setDraftGroupValues(value.groupByValues);
              setActivePopover(activePopover === "costBy" ? null : "costBy");
            }} disabled={loading}>
              <span className="cost-explorer-toolbar-trigger__label">Cost By</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">{costByLabel}</span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} />
              </span>
            </button>
            {activePopover === "costBy" ? (
              <div className="ec2-explorer-filter-popover ec2-explorer-filter-popover--split ec2-explorer-filter-popover--group-split ec2-explorer-filter-popover--cost-by" role="dialog" aria-label="Cost by options">
                <div className="ec2-explorer-filter-popover__header">
                  <p>Cost by</p>
                  <p>Values</p>
                </div>
                <div className="ec2-explorer-filter-popover__split">
                  <div className="ec2-explorer-filter-popover__split-pane">
                    <label className="ec2-explorer-filter-popover__search">
                      <Search className="ec2-explorer-filter-popover__search-icon" size={14} />
                      <input className="ec2-explorer-filter-popover__search-input" value={costBySearch} onChange={(e) => setCostBySearch(e.target.value)} placeholder="Search dimensions..." />
                    </label>
                    <div className="ec2-explorer-filter-popover__list ec2-explorer-filter-popover__list-group">
                      {filteredCostBy.map((option) => {
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
                    const selected = option.key === value.costBasis;
                    return (
                      <button key={option.key} type="button" className={`ec2-explorer-filter-popover__item${selected ? " ec2-explorer-filter-popover__item--selected" : ""}`} onClick={() => {
                        onChange({ ...value, costBasis: option.key });
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
                <div className="ec2-explorer-filter-popover__header ec2-explorer-filter-popover__header--single"><p>Cost by (X-Axis)</p></div>
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
            <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={() => onChange({ ...value, groupBy: "cost-category", groupByValues: [], costBasis: "billed_cost", compare: "none" })}>Clear all</button>
          </div>
        </div>
      </section>
    </div>
  );
}
