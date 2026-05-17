import { Check, ChevronDown, Filter, RotateCcw } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COMPARE_OPTIONS } from "../ec2ExplorerControls.types";

import { EC2ExplorerScopeFilters } from "./EC2ExplorerScopeFilters";
import {
  EC2_DATA_TRANSFER_TYPE_OPTIONS,
  type EC2DataTransferControlsState,
  type EC2DataTransferTypeFilter,
} from "./ec2DataTransfer.types";

type EC2DataTransferTopBarProps = {
  value: EC2DataTransferControlsState;
  onChange: (next: EC2DataTransferControlsState) => void;
  onReset: () => void;
  children?: ReactNode;
};

export function EC2DataTransferTopBar({ value, onChange, onReset, children }: EC2DataTransferTopBarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [transferTypeOpen, setTransferTypeOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [scopeFiltersOpen, setScopeFiltersOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setTransferTypeOpen(false);
      setCompareOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTransferTypeOpen(false);
        setCompareOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const update = (patch: Partial<EC2DataTransferControlsState>) => {
    onChange({
      ...value,
      ...patch,
    });
  };

  return (
    <section className="cost-explorer-control-surface ec2-explorer-controls" ref={rootRef} aria-label="EC2 data transfer controls">
      <div className="cost-explorer-toolbar-row ec2-explorer-toolbar-row--primary">
        <div className="ec2-instances-toolbar-main">
          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className="cost-explorer-toolbar-trigger"
              onClick={() => {
                setTransferTypeOpen(false);
                setCompareOpen(false);
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
              className={`cost-explorer-toolbar-trigger${compareOpen ? " is-active" : ""}`}
              onClick={() => setCompareOpen((current) => !current)}
              aria-expanded={compareOpen}
              aria-haspopup="dialog"
            >
              <span className="cost-explorer-toolbar-trigger__label">Compare</span>
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">
                  {COMPARE_OPTIONS.find((item) => item.key === value.compare)?.label ?? "None"}
                </span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {compareOpen ? (
              <div className="cost-explorer-filter-popover ec2-explorer-filter-popover" role="dialog">
                <div className="cost-explorer-filter-popover__list" role="listbox">
                  {COMPARE_OPTIONS.map((option) => {
                    const selected = option.key === value.compare;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                        onClick={() => {
                          update({ compare: option.key });
                          setCompareOpen(false);
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
            ) : null}
          </div>

          <div className="cost-explorer-toolbar-item">
            <button
              type="button"
              className={`cost-explorer-toolbar-trigger${transferTypeOpen ? " is-active" : ""}`}
              onClick={() => setTransferTypeOpen((current) => !current)}
              aria-expanded={transferTypeOpen}
              aria-haspopup="dialog"
            >
              <span className="cost-explorer-toolbar-trigger__row">
                <span className="cost-explorer-toolbar-trigger__value">
                  {EC2_DATA_TRANSFER_TYPE_OPTIONS.find((item) => item.key === value.transferType)?.label ?? "All"}
                </span>
                <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
              </span>
            </button>
            {transferTypeOpen ? (
              <div className="cost-explorer-filter-popover ec2-explorer-filter-popover" role="dialog">
                <div className="cost-explorer-filter-popover__list" role="listbox">
                  {EC2_DATA_TRANSFER_TYPE_OPTIONS.map((option) => {
                    const selected = option.key === value.transferType;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                        onClick={() => {
                          update({ transferType: option.key as EC2DataTransferTypeFilter });
                          setTransferTypeOpen(false);
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
            ) : null}
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
              onChange={(nextScopeFilters) =>
                update({
                  scopeFilters: {
                    ...nextScopeFilters,
                    tags: [],
                  },
                })
              }
              onApply={() => setScopeFiltersOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
