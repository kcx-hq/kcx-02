import { RotateCcw, Settings2, ChevronDown, Check, Filter } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  AGGREGATION_OPTIONS,
  CONDITION_OPTIONS,
  COST_BASIS_OPTIONS,
  GRANULARITY_OPTIONS,
  DEFAULT_EC2_EXPLORER_CONTROLS,
  GROUP_BY_OPTIONS,
  METRIC_OPTIONS,
  STATE_OPTIONS,
  USAGE_TYPE_OPTIONS,
  VOLUME_VIEW_OPTIONS,
  type EC2Aggregation,
  type EC2Condition,
  type EC2CostBasis,
  type EC2ExplorerControlsState,
  type EC2GroupBy,
  type EC2Metric,
  type EC2State,
  type EC2UsageType,
  type EC2VolumeView,
} from "../ec2ExplorerControls.types";
import { EC2ExplorerGroupByPopover } from "./EC2ExplorerGroupByPopover";
import { EC2ExplorerScopeFilters } from "./EC2ExplorerScopeFilters";
import { EC2ExplorerThresholdsPopover } from "./EC2ExplorerThresholdsPopover";

type PopoverKey =
  | "metric"
  | "config"
  | "groupBy"
  | "usageAggregation"
  | "instancesState"
  | "granularity"
  | "thresholds";

type Option<T extends string> = {
  key: T;
  label: string;
};
const DATA_TRANSFER_VIEW_OPTIONS: Array<Option<EC2UsageType>> = [
  { key: "network", label: "Cost" },
  { key: "disk", label: "Usage (GB)" },
  { key: "cpu", label: "Distribution" },
];

const GROUP_BY_BY_METRIC: Record<EC2Metric, EC2GroupBy[]> = {
  cost: ["none", "cost-category", "region", "account", "availability-zone", "instance", "instance-type", "reservation-type", "usage-type", "operation", "tag"],
  usage: ["none", "region", "account", "availability-zone", "instance", "instance-type", "usage-type", "tag"],
  "data-transfer": ["none", "transfer-type", "region", "account", "availability-zone", "instance", "instance-type", "source-region", "destination-region", "tag"],
  instances: ["none", "region", "account", "availability-zone", "instance", "instance-type", "instance-state", "reservation-type", "recommendation", "tag"],
  volumes: ["none", "volume", "volume_type", "attachment_state", "instance", "storage_tier", "iops_tier", "size_bucket", "lifecycle_state", "region", "account", "availability-zone", "tag"],
};
const DEFAULT_GROUP_BY_BY_METRIC: Record<EC2Metric, EC2GroupBy> = {
  cost: "cost-category",
  usage: "instance",
  "data-transfer": "transfer-type",
  instances: "instance",
  volumes: "volume_type",
};

type EC2ExplorerTopControlsProps = {
  value: EC2ExplorerControlsState;
  onChange: (next: EC2ExplorerControlsState) => void;
  onReset: () => void;
  children?: ReactNode;
};

export function EC2ExplorerTopControls({ value, onChange, onReset, children }: EC2ExplorerTopControlsProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activePopover, setActivePopover] = useState<PopoverKey | null>(null);
  const [scopeFiltersOpen, setScopeFiltersOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (activePopover === "groupBy") return;
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setActivePopover(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePopover(null);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activePopover]);

  const update = (patch: Partial<EC2ExplorerControlsState>) => {
    onChange({
      ...value,
      ...patch,
    });
  };

  const metricConfigLabel = useMemo(() => {
    if (value.metric === "cost") {
      return COST_BASIS_OPTIONS.find((item) => item.key === value.costBasis)?.label ?? "Effective Cost";
    }
    if (value.metric === "data-transfer") {
      if (value.usageType === "network") return "Cost";
      if (value.usageType === "disk") return "Usage (GB)";
      return "Distribution";
    }
    if (value.metric === "usage") {
      return USAGE_TYPE_OPTIONS.find((item) => item.key === value.usageType)?.label ?? "CPU";
    }
    if (value.metric === "volumes") {
      return VOLUME_VIEW_OPTIONS.find((item) => item.key === value.volumeView)?.label ?? "Storage";
    }
    return CONDITION_OPTIONS.find((item) => item.key === value.instancesCondition)?.label ?? "All";
  }, [value.costBasis, value.groupBy, value.instancesCondition, value.metric, value.usageType]);

  const configLabel =
    value.metric === "cost"
      ? "Cost Basis"
      : value.metric === "usage"
        ? "Usage Metric"
        : value.metric === "data-transfer"
          ? "View"
          : value.metric === "volumes"
            ? "View"
            : "Condition";
  const groupByLabel = GROUP_BY_OPTIONS.find((item) => item.key === value.groupBy)?.label ?? "None";
  const aggregationLabel = AGGREGATION_OPTIONS.find((item) => item.key === value.usageAggregation)?.label ?? "Avg";
  const stateLabel = STATE_OPTIONS.find((item) => item.key === value.instancesState)?.label ?? "Running";
  const hasActiveThresholds = useMemo(
    () => Object.values(value.thresholds).some((entry) => entry.trim().length > 0),
    [value.thresholds],
  );

  const togglePopover = (key: PopoverKey) => {
    setActivePopover((current) => (current === key ? null : key));
  };

  const visibleGroupByOptions = useMemo(() => {
    const allowed = new Set(GROUP_BY_BY_METRIC[value.metric]);
    return GROUP_BY_OPTIONS.filter((option) => allowed.has(option.key));
  }, [value.metric]);
  const isGroupByVisibleForMetric = (groupBy: EC2GroupBy, metric: EC2Metric): boolean => {
    return GROUP_BY_BY_METRIC[metric].includes(groupBy);
  };

  const renderOptionList = <T extends string>(params: {
    options: Array<Option<T>>;
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

  const metricConfigOptions: Array<Option<EC2CostBasis | EC2UsageType | EC2Condition>> =
    value.metric === "cost"
      ? COST_BASIS_OPTIONS
      : value.metric === "usage" || value.metric === "data-transfer"
        ? value.metric === "data-transfer"
          ? DATA_TRANSFER_VIEW_OPTIONS
          : USAGE_TYPE_OPTIONS
        : value.metric === "volumes"
          ? VOLUME_VIEW_OPTIONS
        : CONDITION_OPTIONS;

  return (
    <section className="cost-explorer-control-surface ec2-explorer-controls" ref={rootRef} aria-label="EC2 Explorer Controls">
      <div className="cost-explorer-toolbar-row ec2-explorer-toolbar-row--primary">
        <div
          className={`ec2-explorer-toolbar-main${value.metric === "instances" ? " ec2-explorer-toolbar-main--instances" : ""}`}
        >
          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className="cost-explorer-toolbar-trigger"
              onClick={() => {
                setActivePopover(null);
                setScopeFiltersOpen(true);
              }}
            >
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">Filters</span>
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
                <span className="cost-explorer-toolbar-trigger__value">
                  {METRIC_OPTIONS.find((item) => item.key === value.metric)?.label ?? "Cost"}
                </span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {activePopover === "metric"
              ? renderOptionList({
                  options: METRIC_OPTIONS,
                  selected: value.metric,
                  onSelect: (nextMetric: EC2Metric) => {
                    const currentGroupByVisible = isGroupByVisibleForMetric(value.groupBy, nextMetric);
                    const fallbackGroupBy: EC2GroupBy = DEFAULT_GROUP_BY_BY_METRIC[nextMetric];

                    update({
                      metric: nextMetric,
                      groupBy: currentGroupByVisible ? value.groupBy : fallbackGroupBy,
                      groupByValues: currentGroupByVisible ? value.groupByValues : [],
                    });
                  },
                })
              : null}
          </div>

          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${activePopover === "config" ? " is-active" : ""}`}
              onClick={() => {
                togglePopover("config");
              }}
              aria-expanded={activePopover === "config"}
              aria-haspopup="dialog"
              disabled={false}
            >
              <span className="cost-explorer-toolbar-trigger__label">{configLabel}</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">{metricConfigLabel}</span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {activePopover === "config"
              ? value.metric === "cost"
                ? renderOptionList({
                    options: metricConfigOptions as Array<Option<EC2CostBasis>>,
                    selected: value.costBasis,
                    onSelect: (nextCostBasis: EC2CostBasis) => {
                      update({ costBasis: nextCostBasis });
                    },
                  })
                : renderOptionList({
                    options: metricConfigOptions,
                    selected:
                      value.metric === "usage"
                        ? value.usageType
                        : value.metric === "data-transfer"
                          ? value.usageType
                          : value.metric === "volumes"
                          ? value.volumeView
                          : value.instancesCondition,
                    onSelect: (next) => {
                      if (value.metric === "usage") {
                        update({ usageType: next as EC2UsageType });
                        return;
                      }
                      if (value.metric === "data-transfer") {
                        update({ usageType: next as EC2UsageType });
                        return;
                      }
                      if (value.metric === "volumes") {
                        update({ volumeView: next as EC2VolumeView });
                        return;
                      }
                      update({ instancesCondition: next as EC2Condition });
                    },
                  })
              : null}
          </div>

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
                <span className="cost-explorer-toolbar-trigger__value">
                  {GRANULARITY_OPTIONS.find((item) => item.key === value.granularity)?.label ?? "Daily"}
                </span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {activePopover === "granularity"
              ? renderOptionList({
                  options: GRANULARITY_OPTIONS,
                  selected: value.granularity,
                  onSelect: (next) => update({ granularity: next }),
                })
              : null}
          </div>

          {value.metric === "usage" ? (
            <div className="cost-explorer-toolbar-item">
              <button
                type="button"
                className={`cost-explorer-toolbar-trigger${activePopover === "usageAggregation" ? " is-active" : ""}`}
                onClick={() => togglePopover("usageAggregation")}
                aria-expanded={activePopover === "usageAggregation"}
                aria-haspopup="dialog"
              >
                <span className="cost-explorer-toolbar-trigger__label">Aggregation</span>
                <span className="cost-explorer-toolbar-trigger__row">
                  <span className="cost-explorer-toolbar-trigger__value">{aggregationLabel}</span>
                  <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
                </span>
              </button>
              {activePopover === "usageAggregation"
                ? renderOptionList({
                    options: AGGREGATION_OPTIONS,
                    selected: value.usageAggregation,
                    onSelect: (nextAggregation: EC2Aggregation) =>
                      update({ usageAggregation: nextAggregation }),
                  })
                : null}
            </div>
          ) : null}

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
          </div>

          {value.metric === "instances" ? (
            <div className="cost-explorer-toolbar-item">
              <button
                type="button"
                className={`cost-explorer-toolbar-trigger${activePopover === "instancesState" ? " is-active" : ""}`}
                onClick={() => togglePopover("instancesState")}
                aria-expanded={activePopover === "instancesState"}
                aria-haspopup="dialog"
              >
                <span className="cost-explorer-toolbar-trigger__label">State</span>
                <span className="cost-explorer-toolbar-trigger__row">
                  <span className="cost-explorer-toolbar-trigger__value">{stateLabel}</span>
                  <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
                </span>
              </button>
              {activePopover === "instancesState"
                ? renderOptionList({
                    options: STATE_OPTIONS,
                    selected: value.instancesState,
                    onSelect: (nextState: EC2State) => update({ instancesState: nextState }),
                  })
                : null}
            </div>
          ) : null}
        </div>

        <div className="ec2-explorer-toolbar-actions">
          {value.metric === "instances" ? (
            <div className="cost-explorer-toolbar-item">
              <button
                type="button"
                className={`ec2-explorer-toolbar-action${activePopover === "thresholds" ? " is-active" : ""}${hasActiveThresholds ? " is-filtered" : ""}`}
                onClick={() => togglePopover("thresholds")}
                aria-label="Thresholds"
                title="Thresholds"
              >
                <Settings2 size={14} aria-hidden="true" />
              </button>
              {activePopover === "thresholds" ? (
                <div className="cost-explorer-filter-popover ec2-explorer-filter-popover ec2-explorer-filter-popover--thresholds">
                  <EC2ExplorerThresholdsPopover
                    value={value.thresholds}
                    onChange={(nextThresholds) => update({ thresholds: nextThresholds })}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            className="ec2-explorer-toolbar-action"
            onClick={onReset}
            aria-label="Reset"
            title="Reset"
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
      {children}

      <Dialog open={scopeFiltersOpen} onOpenChange={setScopeFiltersOpen}>
        <DialogContent className="left-auto right-0 top-0 h-screen max-h-screen w-[min(96vw,44rem)] max-w-none -translate-x-0 -translate-y-0 rounded-none border-l border-[color:var(--border-light)] p-6 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-semibold text-text-primary">Scope Filters</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <EC2ExplorerScopeFilters
              value={value.scopeFilters}
              onChange={(nextScopeFilters) => update({ scopeFilters: nextScopeFilters })}
              onApply={() => setScopeFiltersOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activePopover === "groupBy"} onOpenChange={(open) => setActivePopover(open ? "groupBy" : null)}>
        <DialogContent className="left-auto right-0 top-0 h-screen max-h-screen w-[min(96vw,42rem)] max-w-none -translate-x-0 -translate-y-0 rounded-none border-l border-[color:var(--border-light)] p-6 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-semibold text-text-primary">Group By</DialogTitle>
          </DialogHeader>
          <div className="mt-4 ec2-explorer-groupby-drawer">
            <EC2ExplorerGroupByPopover
              options={visibleGroupByOptions}
              valueGroupBy={value.groupBy}
              valueGroupByValues={value.groupByValues}
              onApply={({ groupBy, groupByValues }) => {
                update({ groupBy, groupByValues });
              }}
              onClose={() => setActivePopover(null)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export const EC2_EXPLORER_DEFAULT_CONTROLS = DEFAULT_EC2_EXPLORER_CONTROLS;
