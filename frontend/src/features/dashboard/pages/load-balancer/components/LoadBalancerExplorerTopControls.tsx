import { Check, ChevronDown, Filter, RotateCcw } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LOAD_BALANCER_DEFAULT_CONTROLS,
  LOAD_BALANCER_GRANULARITY_OPTIONS,
  LOAD_BALANCER_GROUP_BY_OPTIONS,
  LOAD_BALANCER_METRIC_OPTIONS,
  LOAD_BALANCER_USAGE_TYPE_OPTIONS,
  getLoadBalancerGroupByOptionsForMetric,
  getValidLoadBalancerGroupByForMetric,
  type LoadBalancerExplorerControlsState,
  type LoadBalancerGranularity,
  type LoadBalancerGroupBy,
  type LoadBalancerMetric,
  type LoadBalancerScopeFilters,
  type LoadBalancerUsageType,
} from "../loadBalancerExplorer.types";

type PopoverKey = "metric" | "usageType" | "granularity" | "groupBy";

type Props = {
  value: LoadBalancerExplorerControlsState;
  onChange: (next: LoadBalancerExplorerControlsState) => void;
  onReset: () => void;
  children?: ReactNode;
};

type ScopeFilterKey = keyof LoadBalancerScopeFilters;

const SCOPE_FIELDS: Array<{ key: ScopeFilterKey; label: string; placeholder: string }> = [
  { key: "account", label: "Account", placeholder: "e.g. 123456789012, prod-account" },
  { key: "region", label: "Region", placeholder: "e.g. us-east-1, ap-south-1" },
  { key: "type", label: "Type", placeholder: "e.g. application, network" },
  { key: "scheme", label: "Scheme", placeholder: "e.g. internet-facing, internal" },
  { key: "state", label: "State", placeholder: "e.g. active, provisioning" },
  { key: "team", label: "Team", placeholder: "e.g. platform, payments" },
  { key: "product", label: "Product", placeholder: "e.g. checkout, api-gateway" },
  { key: "environment", label: "Environment", placeholder: "e.g. prod, stage" },
  { key: "tags", label: "Tags", placeholder: "e.g. owner:team-a, app:web" },
];

const parseCsv = (value: string): string[] =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const toCsv = (value: string[]): string => value.join(", ");

export function LoadBalancerExplorerTopControls({ value, onChange, onReset, children }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activePopover, setActivePopover] = useState<PopoverKey | null>(null);
  const [scopeFiltersOpen, setScopeFiltersOpen] = useState(false);
  const [scopeDraft, setScopeDraft] = useState<Record<ScopeFilterKey, string>>({
    account: "",
    region: "",
    type: "",
    scheme: "",
    state: "",
    team: "",
    product: "",
    environment: "",
    tags: "",
  });

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setActivePopover(null);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePopover(null);
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    setScopeDraft({
      account: toCsv(value.scopeFilters.account),
      region: toCsv(value.scopeFilters.region),
      type: toCsv(value.scopeFilters.type),
      scheme: toCsv(value.scopeFilters.scheme),
      state: toCsv(value.scopeFilters.state),
      team: toCsv(value.scopeFilters.team),
      product: toCsv(value.scopeFilters.product),
      environment: toCsv(value.scopeFilters.environment),
      tags: toCsv(value.scopeFilters.tags),
    });
  }, [value.scopeFilters]);

  const update = (patch: Partial<LoadBalancerExplorerControlsState>) => onChange({ ...value, ...patch });

  const togglePopover = (key: PopoverKey) => setActivePopover((current) => (current === key ? null : key));

  const renderOptionList = <T extends string>(params: {
    options: Array<{ key: T; label: string }>;
    selected: T;
    onSelect: (key: T) => void;
  }) => (
    <div className="cost-explorer-filter-popover ec2-explorer-filter-popover" role="dialog">
      <div className="cost-explorer-filter-popover__list" role="listbox">
        {params.options.map((option) => {
          const selected = option.key === params.selected;
          return (
            <button
              key={option.key}
              type="button"
              className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
              onClick={() => {
                params.onSelect(option.key);
                setActivePopover(null);
              }}
              role="option"
              aria-selected={selected}
            >
              <span>{option.label}</span>
              {selected ? <Check size={14} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  const metricLabel = LOAD_BALANCER_METRIC_OPTIONS.find((item) => item.key === value.metric)?.label ?? "Cost";
  const granularityLabel =
    LOAD_BALANCER_GRANULARITY_OPTIONS.find((item) => item.key === value.granularity)?.label ?? "Daily";
  const usageTypeLabel =
    LOAD_BALANCER_USAGE_TYPE_OPTIONS.find((item) => item.key === value.usageType)?.label ?? "Requests";
  const groupByLabel = LOAD_BALANCER_GROUP_BY_OPTIONS.find((item) => item.key === value.groupBy)?.label ?? "Account";
  const visibleGroupByOptions = useMemo(() => getLoadBalancerGroupByOptionsForMetric(value.metric), [value.metric]);
  const activeScopeCount = useMemo(
    () =>
      Object.values(value.scopeFilters).reduce((sum, entry) => sum + (Array.isArray(entry) ? entry.length : 0), 0),
    [value.scopeFilters],
  );

  return (
    <section className="cost-explorer-control-surface ec2-explorer-controls" ref={rootRef} aria-label="Load balancer explorer controls">
      <div className="cost-explorer-toolbar-row ec2-explorer-toolbar-row--primary">
        <div className="ec2-explorer-toolbar-main">
          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${activeScopeCount > 0 ? " is-active" : ""}`}
              onClick={() => {
                setActivePopover(null);
                setScopeFiltersOpen(true);
              }}
            >
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">
                  Filters{activeScopeCount > 0 ? ` (${activeScopeCount})` : ""}
                </span>
                <Filter className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
          </div>

          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
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
            {activePopover === "metric"
              ? renderOptionList({
                  options: LOAD_BALANCER_METRIC_OPTIONS,
                  selected: value.metric,
                  onSelect: (nextMetric: LoadBalancerMetric) =>
                    update({
                      metric: nextMetric,
                      groupBy: getValidLoadBalancerGroupByForMetric(nextMetric, value.groupBy),
                      groupByValues: [],
                    }),
                })
              : null}
          </div>

          {value.metric === "usage" ? (
            <div className="cost-explorer-toolbar-item">
              <button
                type="button"
                className={`cost-explorer-toolbar-trigger${activePopover === "usageType" ? " is-active" : ""}`}
                onClick={() => togglePopover("usageType")}
                aria-expanded={activePopover === "usageType"}
                aria-haspopup="dialog"
              >
                <span className="cost-explorer-toolbar-trigger__label">Usage Type</span>
                <span className="cost-explorer-toolbar-trigger__row">
                  <span className="cost-explorer-toolbar-trigger__value">{usageTypeLabel}</span>
                  <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
                </span>
              </button>
              {activePopover === "usageType"
                ? renderOptionList({
                    options: LOAD_BALANCER_USAGE_TYPE_OPTIONS,
                    selected: value.usageType,
                    onSelect: (nextUsageType: LoadBalancerUsageType) => update({ usageType: nextUsageType }),
                  })
                : null}
            </div>
          ) : null}

          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
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
            {activePopover === "granularity"
              ? renderOptionList({
                  options: LOAD_BALANCER_GRANULARITY_OPTIONS,
                  selected: value.granularity,
                  onSelect: (nextGranularity: LoadBalancerGranularity) => update({ granularity: nextGranularity }),
                })
              : null}
          </div>

          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${activePopover === "groupBy" ? " is-active" : ""}`}
              onClick={() => togglePopover("groupBy")}
              aria-expanded={activePopover === "groupBy"}
              aria-haspopup="dialog"
            >
              <span className="cost-explorer-toolbar-trigger__label">Group By</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">{groupByLabel}</span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {activePopover === "groupBy"
              ? renderOptionList({
                  options: visibleGroupByOptions,
                  selected: value.groupBy,
                  onSelect: (nextGroupBy: LoadBalancerGroupBy) =>
                    update({
                      groupBy: nextGroupBy,
                      groupByValues: [],
                    }),
                })
              : null}
          </div>
        </div>

        <div className="ec2-explorer-toolbar-actions">
          <button type="button" className="ec2-explorer-toolbar-action" onClick={onReset} aria-label="Reset" title="Reset">
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
      {children}

      <Dialog open={scopeFiltersOpen} onOpenChange={setScopeFiltersOpen}>
        <DialogContent className="left-auto right-0 top-0 h-screen max-h-screen w-[min(96vw,44rem)] max-w-none -translate-x-0 -translate-y-0 rounded-none border-l border-[color:var(--border-light)] p-6 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-semibold text-text-primary">Load Balancer Filters</DialogTitle>
          </DialogHeader>
          <div className="mt-4 ec2-explorer-thresholds">
            <div className="ec2-explorer-thresholds__grid">
              {SCOPE_FIELDS.map((field) => (
                <label key={field.key} className="ec2-explorer-thresholds__field">
                  <span>{field.label}</span>
                  <input
                    value={scopeDraft[field.key]}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setScopeDraft((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
              <label className="ec2-explorer-thresholds__field">
                <span>Tag Key (for Group By tag)</span>
                <input
                  value={value.tagKey}
                  placeholder="e.g. owner"
                  onChange={(event) => update({ tagKey: event.target.value })}
                />
              </label>
            </div>
            <div className="cost-explorer-filter-popover__actions">
              <button
                type="button"
                className="cost-explorer-filter-popover__apply"
                onClick={() => {
                  update({
                    scopeFilters: {
                      account: parseCsv(scopeDraft.account),
                      region: parseCsv(scopeDraft.region),
                      type: parseCsv(scopeDraft.type),
                      scheme: parseCsv(scopeDraft.scheme),
                      state: parseCsv(scopeDraft.state),
                      team: parseCsv(scopeDraft.team),
                      product: parseCsv(scopeDraft.product),
                      environment: parseCsv(scopeDraft.environment),
                      tags: parseCsv(scopeDraft.tags),
                    },
                  });
                  setScopeFiltersOpen(false);
                }}
              >
                Apply
              </button>
              <button
                type="button"
                className="cost-explorer-state-btn"
                onClick={() => {
                  update({
                    ...LOAD_BALANCER_DEFAULT_CONTROLS,
                    metric: value.metric,
                    granularity: value.granularity,
                    groupBy: getValidLoadBalancerGroupByForMetric(value.metric, value.groupBy),
                    chartType: value.chartType,
                  });
                  setScopeFiltersOpen(false);
                }}
              >
                Clear filters
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
