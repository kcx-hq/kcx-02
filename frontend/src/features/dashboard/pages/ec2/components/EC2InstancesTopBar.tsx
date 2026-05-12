import { Check, ChevronDown, Filter, RotateCcw, Search, Settings2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { EC2ExplorerScopeFilters } from "./EC2ExplorerScopeFilters";
import { EC2ExplorerThresholdsPopover } from "./EC2ExplorerThresholdsPopover";
import {
  EC2_INSTANCES_STATUS_OPTIONS,
  EC2_INSTANCES_RESERVATION_OPTIONS,
  EC2_INSTANCES_STATE_OPTIONS,
  type EC2InstancesStatus,
  type EC2InstancesControlsState,
  type EC2InstancesNetworkType,
  type EC2InstancesReservationType,
  type EC2InstancesStateFilter,
} from "./ec2Instances.types";

type PopoverKey = "status" | "state" | "instanceType" | "reservationType" | "networkType" | "thresholds";
const NETWORK_TYPE_OPTIONS: Array<{ key: EC2InstancesNetworkType; label: string }> = [
  { key: "all", label: "All" },
  { key: "Internet Data Transfer", label: "Internet Data Transfer" },
  { key: "Inter-Region Data Transfer", label: "Inter-Region Data Transfer" },
  { key: "Inter-AZ Data Transfer", label: "Inter-AZ Data Transfer" },
  { key: "NAT Gateway", label: "NAT Gateway" },
  { key: "Elastic IP", label: "Elastic IP" },
  { key: "Other Network", label: "Other Network" },
];

type Option<T extends string> = {
  key: T;
  label: string;
};

type EC2InstancesTopBarProps = {
  value: EC2InstancesControlsState;
  instanceTypeOptions: Array<{ key: string; label: string }>;
  onChange: (next: EC2InstancesControlsState) => void;
  onReset: () => void;
  visibleControls?: Array<
    "filters" | "status" | "state" | "instanceType" | "reservationType" | "networkType" | "search" | "thresholds" | "reset"
  >;
  children?: ReactNode;
};

export function EC2InstancesTopBar({
  value,
  instanceTypeOptions,
  onChange,
  onReset,
  visibleControls,
  children,
}: EC2InstancesTopBarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activePopover, setActivePopover] = useState<PopoverKey | null>(null);
  const [scopeFiltersOpen, setScopeFiltersOpen] = useState(false);

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
  }, []);

  const update = (patch: Partial<EC2InstancesControlsState>) => {
    onChange({
      ...value,
      ...patch,
    });
  };

  const togglePopover = (key: PopoverKey) => {
    setActivePopover((current) => (current === key ? null : key));
  };

  const hasActiveThresholds = useMemo(
    () => Object.values(value.thresholds).some((entry) => entry.trim().length > 0),
    [value.thresholds],
  );
  const controlSet = useMemo(
    () =>
      new Set(
        visibleControls ?? [
          "filters",
          "status",
          "state",
          "instanceType",
          "reservationType",
          "networkType",
          "search",
          "thresholds",
          "reset",
        ],
      ),
    [visibleControls],
  );

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

  return (
    <section className="cost-explorer-control-surface ec2-explorer-controls" ref={rootRef} aria-label="EC2 instances controls">
      <div className="cost-explorer-toolbar-row ec2-explorer-toolbar-row--primary">
        <div className="ec2-instances-toolbar-main">
          {controlSet.has("filters") ? (
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
          ) : null}

          {controlSet.has("status") ? (
            <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${activePopover === "status" ? " is-active" : ""}`}
              onClick={() => togglePopover("status")}
              aria-expanded={activePopover === "status"}
              aria-haspopup="dialog"
            >
              <span className="cost-explorer-toolbar-trigger__label">Status</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">
                  {EC2_INSTANCES_STATUS_OPTIONS.find((item) => item.key === value.status)?.label ?? "All"}
                </span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {activePopover === "status"
              ? renderOptionList({
                  options: EC2_INSTANCES_STATUS_OPTIONS,
                  selected: value.status,
                  onSelect: (nextStatus: EC2InstancesStatus) => update({ status: nextStatus }),
                })
              : null}
            </div>
          ) : null}

          {controlSet.has("state") ? (
            <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${activePopover === "state" ? " is-active" : ""}`}
              onClick={() => togglePopover("state")}
              aria-expanded={activePopover === "state"}
              aria-haspopup="dialog"
            >
              <span className="cost-explorer-toolbar-trigger__label">State</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">
                  {EC2_INSTANCES_STATE_OPTIONS.find((item) => item.key === value.state)?.label ?? "All"}
                </span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {activePopover === "state"
              ? renderOptionList({
                  options: EC2_INSTANCES_STATE_OPTIONS,
                  selected: value.state,
                  onSelect: (nextState: EC2InstancesStateFilter) => update({ state: nextState }),
                })
              : null}
            </div>
          ) : null}

          {controlSet.has("instanceType") ? (
            <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${activePopover === "instanceType" ? " is-active" : ""}`}
              onClick={() => togglePopover("instanceType")}
              aria-expanded={activePopover === "instanceType"}
              aria-haspopup="dialog"
            >
              <span className="cost-explorer-toolbar-trigger__label">Instance Type</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">
                  {instanceTypeOptions.find((item) => item.key === value.instanceType)?.label ?? "All"}
                </span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {activePopover === "instanceType"
              ? renderOptionList({
                  options: instanceTypeOptions,
                  selected: value.instanceType,
                  onSelect: (nextInstanceType: string) => update({ instanceType: nextInstanceType }),
                })
              : null}
            </div>
          ) : null}

          {controlSet.has("reservationType") ? (
            <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${activePopover === "reservationType" ? " is-active" : ""}`}
              onClick={() => togglePopover("reservationType")}
              aria-expanded={activePopover === "reservationType"}
              aria-haspopup="dialog"
            >
              <span className="cost-explorer-toolbar-trigger__label">Reservation Type</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">
                  {EC2_INSTANCES_RESERVATION_OPTIONS.find((item) => item.key === value.reservationType)?.label ?? "All"}
                </span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {activePopover === "reservationType"
              ? renderOptionList({
                  options: EC2_INSTANCES_RESERVATION_OPTIONS,
                  selected: value.reservationType,
                  onSelect: (nextReservationType: EC2InstancesReservationType) =>
                    update({ reservationType: nextReservationType }),
                })
              : null}
            </div>
          ) : null}

          {controlSet.has("networkType") ? (
            <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${activePopover === "networkType" ? " is-active" : ""}`}
              onClick={() => togglePopover("networkType")}
              aria-expanded={activePopover === "networkType"}
              aria-haspopup="dialog"
            >
              <span className="cost-explorer-toolbar-trigger__label">Network Type</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">
                  {NETWORK_TYPE_OPTIONS.find((item) => item.key === value.networkType)?.label ?? "All"}
                </span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {activePopover === "networkType"
              ? renderOptionList({
                  options: NETWORK_TYPE_OPTIONS,
                  selected: value.networkType,
                  onSelect: (nextNetworkType: EC2InstancesNetworkType) => update({ networkType: nextNetworkType }),
                })
              : null}
            </div>
          ) : null}

          {controlSet.has("search") ? (
            <div className="cost-explorer-toolbar-item">
            <label className="cost-explorer-toolbar-trigger ec2-instances-search-trigger">
              <span className="ec2-instances-search-trigger__icon-wrap" aria-hidden="true">
                <Search size={14} />
              </span>
              <input
                type="search"
                value={value.search}
                onChange={(event) => update({ search: event.target.value })}
                placeholder="Search"
                aria-label="Search instances"
                className="ec2-instances-search-trigger__input"
              />
            </label>
            </div>
          ) : null}

          {controlSet.has("thresholds") ? (
            <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger ec2-instances-toolbar-icon-trigger${activePopover === "thresholds" ? " is-active" : ""}${hasActiveThresholds ? " is-active" : ""}`}
              onClick={() => togglePopover("thresholds")}
              aria-expanded={activePopover === "thresholds"}
              aria-haspopup="dialog"
              aria-label="Thresholds"
              title="Thresholds"
            >
              <span className="cost-explorer-toolbar-trigger__row ec2-instances-toolbar-icon-trigger__row">
                <Settings2 className="ec2-instances-toolbar-icon-trigger__icon" size={16} aria-hidden="true" />
              </span>
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

          {controlSet.has("reset") ? (
            <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className="cost-explorer-toolbar-trigger ec2-instances-toolbar-icon-trigger"
              onClick={onReset}
              aria-label="Reset filters"
              title="Reset filters"
            >
              <span className="cost-explorer-toolbar-trigger__row ec2-instances-toolbar-icon-trigger__row">
                <RotateCcw className="ec2-instances-toolbar-icon-trigger__icon" size={16} aria-hidden="true" />
              </span>
            </button>
            </div>
          ) : null}
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
    </section>
  );
}
