import { Settings2, ChevronDown, Check } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  CONDITION_OPTIONS,
  COMPARE_OPTIONS,
  COST_BASIS_OPTIONS,
  GRANULARITY_OPTIONS,
  DEFAULT_EC2_EXPLORER_CONTROLS,
  getGroupByOptionsForMetric,
  getValidGroupByForMetric,
  isGroupByAllowedForMetric,
  GROUP_BY_OPTIONS,
  METRIC_OPTIONS,
  STATE_OPTIONS,
  USAGE_TYPE_OPTIONS,
  VOLUME_VIEW_OPTIONS,
  type EC2CostBasis,
  type EC2ExplorerControlsState,
  type EC2Metric,
  type EC2State,
  type EC2UsageType,
} from "../ec2ExplorerControls.types";
import { EC2ExplorerGroupByPopover } from "./EC2ExplorerGroupByPopover";
import { EC2ExplorerThresholdsPopover } from "./EC2ExplorerThresholdsPopover";

type PopoverKey =
  | "config"
  | "groupBy"
  | "instancesState"
  | "granularity"
  | "compare"
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
const EC2_EXPLORER_METRIC_OPTIONS = METRIC_OPTIONS.filter((option) => option.key !== "volumes");

type EC2ExplorerTopControlsProps = {
  value: EC2ExplorerControlsState;
  onChange: (next: EC2ExplorerControlsState) => void;
  loading?: boolean;
  children?: ReactNode;
  showMetricTabs?: boolean;
  showThresholdButton?: boolean;
};

export function EC2ExplorerTopControls({
  value,
  onChange,
  loading = false,
  children,
  showMetricTabs = true,
  showThresholdButton = true,
}: EC2ExplorerTopControlsProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activePopover, setActivePopover] = useState<PopoverKey | null>(null);
  const [thresholdsOpen, setThresholdsOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
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
  const compareLabel = COMPARE_OPTIONS.find((item) => item.key === value.compare)?.label ?? "None";
  const stateLabel = STATE_OPTIONS.find((item) => item.key === value.instancesState)?.label ?? "Running";
  const hasActiveThresholds = useMemo(
    () => Object.values(value.thresholds).some((entry) => entry.trim().length > 0),
    [value.thresholds],
  );

  const togglePopover = (key: PopoverKey) => {
    setActivePopover((current) => (current === key ? null : key));
  };

  const visibleGroupByOptions = useMemo(() => getGroupByOptionsForMetric(value.metric), [value.metric]);
  const metricSegmentId = "ec2-metric-segmented-control";

  const applyMetricChange = (nextMetric: EC2Metric) => {
    const nextGroupBy = getValidGroupByForMetric(nextMetric, value.groupBy);
    const shouldResetGroupValues = !isGroupByAllowedForMetric(value.groupBy, nextMetric) || nextGroupBy !== value.groupBy;

    update({
      metric: nextMetric,
      groupBy: nextGroupBy,
      groupByValues: shouldResetGroupValues ? [] : value.groupByValues,
      costBasis: nextMetric === "cost" || nextMetric === "data-transfer" ? value.costBasis : DEFAULT_EC2_EXPLORER_CONTROLS.costBasis,
      usageType: nextMetric === "usage" || nextMetric === "data-transfer" ? value.usageType : DEFAULT_EC2_EXPLORER_CONTROLS.usageType,
      usageAggregation: nextMetric === "usage" ? value.usageAggregation : DEFAULT_EC2_EXPLORER_CONTROLS.usageAggregation,
      volumeView: nextMetric === "volumes" ? value.volumeView : DEFAULT_EC2_EXPLORER_CONTROLS.volumeView,
      instancesCondition: nextMetric === "instances" ? value.instancesCondition : DEFAULT_EC2_EXPLORER_CONTROLS.instancesCondition,
      instancesState: nextMetric === "instances" ? value.instancesState : DEFAULT_EC2_EXPLORER_CONTROLS.instancesState,
    });
    setActivePopover(null);
  };

  const renderOptionList = <T extends string>(params: {
    title: string;
    options: Array<Option<T>>;
    selected: T;
    onSelect: (key: T) => void;
  }) => (
    <div className="cost-explorer-filter-popover ec2-explorer-filter-popover ec2-explorer-filter-popover--groupby-single" role="dialog">
      <p className="cost-explorer-filter-popover__title">{params.title}</p>
      <div className="cost-explorer-filter-popover__list cost-explorer-filter-popover__list--group-dimensions" role="listbox">
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

  return (
    <>
    <div className="ec2-explorer-controls-shell" ref={rootRef}>
      <div className="ec2-explorer-metric-segmented-wrap">
        <div className="ec2-explorer-metric-segmented-head">
          {showMetricTabs ? (
            <div className="ec2-explorer-metric-segmented-scroll">
              <div className="ec2-explorer-metric-segmented" role="tablist" aria-label="Metric" id={metricSegmentId}>
                {EC2_EXPLORER_METRIC_OPTIONS.map((option) => {
                  const selected = value.metric === option.key;
                  return (
                    <button
                      key={option.key}
                      id={`${metricSegmentId}-${option.key}`}
                      role="tab"
                      type="button"
                      className={`ec2-explorer-metric-segmented__item${selected ? " is-active" : ""}`}
                      aria-selected={selected}
                      aria-controls="ec2-explorer-filters-grid"
                      tabIndex={selected ? 0 : -1}
                      disabled={loading}
                      onClick={() => applyMetricChange(option.key)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {value.metric === "instances" && showThresholdButton ? (
            <div className="ec2-explorer-metric-segmented-actions">
              <button
                type="button"
                className={`ec2-explorer-toolbar-action${thresholdsOpen ? " is-active" : ""}${hasActiveThresholds ? " is-filtered" : ""}`}
                onClick={() => setThresholdsOpen(true)}
                aria-label="Thresholds"
                title="Thresholds"
                disabled={loading}
              >
                <Settings2 size={14} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <section className={`cost-explorer-control-surface ec2-explorer-controls${loading ? " ec2-explorer-controls--loading" : ""}`} aria-label="EC2 Explorer Controls">
      <div className="cost-explorer-toolbar-row ec2-explorer-toolbar-row--primary">
        <div
          id="ec2-explorer-filters-grid"
          className={`ec2-explorer-toolbar-main${value.metric === "instances" ? " ec2-explorer-toolbar-main--instances" : ""}`}
        >
          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${activePopover === "groupBy" ? " is-active" : ""}`}
              onClick={() => !loading && togglePopover("groupBy")}
              aria-expanded={activePopover === "groupBy"}
              aria-haspopup="dialog"
              disabled={loading}
            >
              <span className="cost-explorer-toolbar-trigger__label">Group By</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">{groupByLabel}</span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
          </div>

          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${activePopover === "config" ? " is-active" : ""}`}
              onClick={() => {
                if (!loading) togglePopover("config");
              }}
              aria-expanded={activePopover === "config"}
              aria-haspopup="dialog"
              disabled={loading}
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
                    title: "Cost Basis",
                    options: COST_BASIS_OPTIONS,
                    selected: value.costBasis,
                    onSelect: (nextCostBasis: EC2CostBasis) => {
                      update({ costBasis: nextCostBasis });
                    },
                  })
                : value.metric === "usage"
                  ? renderOptionList({
                      title: "Usage Metric",
                      options: USAGE_TYPE_OPTIONS,
                      selected: value.usageType,
                      onSelect: (next) => {
                        update({ usageType: next });
                      },
                    })
                    : value.metric === "data-transfer"
                    ? renderOptionList({
                        title: "View",
                        options: DATA_TRANSFER_VIEW_OPTIONS,
                        selected: value.usageType,
                        onSelect: (next) => {
                          update({ usageType: next });
                        },
                      })
                    : value.metric === "volumes"
                      ? renderOptionList({
                          title: "View",
                          options: VOLUME_VIEW_OPTIONS,
                          selected: value.volumeView,
                          onSelect: (next) => {
                            update({ volumeView: next });
                          },
                        })
                : renderOptionList({
                    title: "Condition",
                    options: CONDITION_OPTIONS,
                    selected: value.instancesCondition,
                    onSelect: (next) => {
                      update({ instancesCondition: next });
                    },
                  })
              : null}
          </div>

          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${activePopover === "granularity" ? " is-active" : ""}`}
              onClick={() => !loading && togglePopover("granularity")}
              aria-expanded={activePopover === "granularity"}
              aria-haspopup="dialog"
              disabled={loading}
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
                  title: "Granularity",
                  options: GRANULARITY_OPTIONS,
                  selected: value.granularity,
                  onSelect: (next) => update({ granularity: next }),
                })
              : null}
          </div>

          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${activePopover === "compare" ? " is-active" : ""}`}
              onClick={() => !loading && togglePopover("compare")}
              aria-expanded={activePopover === "compare"}
              aria-haspopup="dialog"
              disabled={loading}
            >
              <span className="cost-explorer-toolbar-trigger__label">Compare</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">{compareLabel}</span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {activePopover === "compare"
              ? renderOptionList({
                  title: "Compare",
                  options: COMPARE_OPTIONS,
                  selected: value.compare,
                  onSelect: (next) => update({ compare: next }),
                })
              : null}
          </div>

          {value.metric === "instances" ? (
            <div className="cost-explorer-toolbar-item">
              <button
                type="button"
                className={`cost-explorer-toolbar-trigger${activePopover === "instancesState" ? " is-active" : ""}`}
                onClick={() => !loading && togglePopover("instancesState")}
                aria-expanded={activePopover === "instancesState"}
                aria-haspopup="dialog"
                disabled={loading}
              >
                <span className="cost-explorer-toolbar-trigger__label">State</span>
                <span className="cost-explorer-toolbar-trigger__row">
                  <span className="cost-explorer-toolbar-trigger__value">{stateLabel}</span>
                  <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
                </span>
              </button>
              {activePopover === "instancesState"
                ? renderOptionList({
                    title: "State",
                    options: STATE_OPTIONS,
                    selected: value.instancesState,
                    onSelect: (nextState: EC2State) => update({ instancesState: nextState }),
                  })
                : null}
            </div>
          ) : null}
        </div>

        {activePopover === "groupBy" ? (
          <div className="ec2-explorer-groupby-toggle-panel">
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
        ) : null}
      </div>
        {children}
      </section>
    </div>
      <Dialog open={thresholdsOpen} onOpenChange={setThresholdsOpen}>
        <DialogContent className="w-[min(92vw,46rem)] max-w-none border border-[color:var(--border-light)] rounded-none p-4">
          <DialogHeader className="space-y-1 border-b border-[color:var(--border-light)] pb-4">
            <DialogTitle className="text-2xl font-semibold text-text-primary">Thresholds</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <EC2ExplorerThresholdsPopover
              value={value.thresholds}
              onChange={(nextThresholds) => update({ thresholds: nextThresholds })}
              onReset={() => update({ thresholds: DEFAULT_EC2_EXPLORER_CONTROLS.thresholds })}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const EC2_EXPLORER_DEFAULT_CONTROLS = DEFAULT_EC2_EXPLORER_CONTROLS;
