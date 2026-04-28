import { Check, ChevronDown, Filter, RotateCcw, Search, Settings2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { EC2ExplorerScopeFilters } from "./EC2ExplorerScopeFilters";
import { EC2VolumesThresholdsPopover } from "./EC2VolumesThresholdsPopover";
import {
  EC2_VOLUMES_ATTACHMENT_OPTIONS,
  EC2_VOLUMES_STATE_OPTIONS,
  EC2_VOLUMES_TYPE_OPTIONS,
  type EC2VolumesAttachmentFilter,
  type EC2VolumesControlsState,
  type EC2VolumesStateFilter,
  type EC2VolumesTypeFilter,
} from "./ec2Volumes.types";

type PopoverKey = "state" | "volumeType" | "attachment" | "thresholds";

type Option<T extends string> = {
  key: T;
  label: string;
};

type EC2VolumesTopBarProps = {
  value: EC2VolumesControlsState;
  onChange: (next: EC2VolumesControlsState) => void;
  onReset: () => void;
  children?: ReactNode;
};

export function EC2VolumesTopBar({ value, onChange, onReset, children }: EC2VolumesTopBarProps) {
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

  const update = (patch: Partial<EC2VolumesControlsState>) => {
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
    <section className="cost-explorer-control-surface ec2-explorer-controls" ref={rootRef} aria-label="EC2 volumes controls">
      <div className="cost-explorer-toolbar-row ec2-explorer-toolbar-row--primary">
        <div className="ec2-instances-toolbar-main">
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
              className={`cost-explorer-toolbar-trigger${activePopover === "state" ? " is-active" : ""}`}
              onClick={() => togglePopover("state")}
              aria-expanded={activePopover === "state"}
              aria-haspopup="dialog"
            >
              <span className="cost-explorer-toolbar-trigger__label">State</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">
                  {EC2_VOLUMES_STATE_OPTIONS.find((item) => item.key === value.state)?.label ?? "All"}
                </span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {activePopover === "state"
              ? renderOptionList({
                  options: EC2_VOLUMES_STATE_OPTIONS,
                  selected: value.state,
                  onSelect: (nextState: EC2VolumesStateFilter) => update({ state: nextState }),
                })
              : null}
          </div>

          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${activePopover === "volumeType" ? " is-active" : ""}`}
              onClick={() => togglePopover("volumeType")}
              aria-expanded={activePopover === "volumeType"}
              aria-haspopup="dialog"
            >
              <span className="cost-explorer-toolbar-trigger__label">Type</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">
                  {EC2_VOLUMES_TYPE_OPTIONS.find((item) => item.key === value.volumeType)?.label ?? "All"}
                </span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {activePopover === "volumeType"
              ? renderOptionList({
                  options: EC2_VOLUMES_TYPE_OPTIONS,
                  selected: value.volumeType,
                  onSelect: (nextType: EC2VolumesTypeFilter) => update({ volumeType: nextType }),
                })
              : null}
          </div>

          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${activePopover === "attachment" ? " is-active" : ""}`}
              onClick={() => togglePopover("attachment")}
              aria-expanded={activePopover === "attachment"}
              aria-haspopup="dialog"
            >
              <span className="cost-explorer-toolbar-trigger__label">Attachment</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">
                  {EC2_VOLUMES_ATTACHMENT_OPTIONS.find((item) => item.key === value.attachment)?.label ?? "All"}
                </span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {activePopover === "attachment"
              ? renderOptionList({
                  options: EC2_VOLUMES_ATTACHMENT_OPTIONS,
                  selected: value.attachment,
                  onSelect: (nextAttachment: EC2VolumesAttachmentFilter) => update({ attachment: nextAttachment }),
                })
              : null}
          </div>

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
                <EC2VolumesThresholdsPopover
                  value={value.thresholds}
                  onChange={(nextThresholds) => update({ thresholds: nextThresholds })}
                />
              </div>
            ) : null}
          </div>

          <div className="cost-explorer-toolbar-item">
            <label className="cost-explorer-toolbar-trigger ec2-instances-search-trigger">
              <span className="ec2-instances-search-trigger__icon-wrap" aria-hidden="true">
                <Search size={14} />
              </span>
              <input
                type="search"
                value={value.search}
                onChange={(event) => update({ search: event.target.value })}
                placeholder="Search volume or instance"
                aria-label="Search volumes"
                className="ec2-instances-search-trigger__input"
              />
            </label>
          </div>

          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className="cost-explorer-toolbar-trigger"
              onClick={onReset}
              aria-label="Reset filters"
              title="Reset filters"
            >
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">Reset</span>
                <RotateCcw className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
          </div>
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
