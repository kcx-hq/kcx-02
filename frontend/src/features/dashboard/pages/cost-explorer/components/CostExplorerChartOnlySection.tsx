import { useEffect, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import { Check, ChevronDown } from "lucide-react";

import { BaseEChart } from "../../../common/charts/BaseEChart";
import { EmptyStateBlock } from "../../../common/components/EmptyStateBlock";

type CostExplorerChartOnlySectionProps = {
  option: EChartsOption;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  isFetching: boolean;
  chartReady: boolean;
  onPointClick?: (params: unknown) => void;
  chartMode: "line" | "bar";
  onChartModeChange: (mode: "line" | "bar") => void;
  onRetry: () => void;
  onReset: () => void;
  showApplySkeleton?: boolean;
  title?: string;
  showFetchStatusLabel?: boolean;
};

export function CostExplorerChartOnlySection({
  option,
  isLoading,
  isError,
  errorMessage,
  isFetching,
  chartReady,
  onPointClick,
  chartMode,
  onChartModeChange,
  onRetry,
  onReset,
  showApplySkeleton = false,
  title = "Cost Explorer Trend",
  showFetchStatusLabel = true,
}: CostExplorerChartOnlySectionProps) {
  const modeMenuRef = useRef<HTMLDivElement | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const showFetchStatus = showFetchStatusLabel && isFetching && !isLoading && chartReady;
  const showRefreshSkeleton = showFetchStatus && showApplySkeleton && !isError;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (modeMenuRef.current?.contains(target)) return;
      setModeMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModeMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const modeOptions: Array<{ key: "line" | "bar"; label: string }> = [
    { key: "line", label: "Line Chart" },
    { key: "bar", label: "Bar Chart" },
  ];
  const activeModeLabel = modeOptions.find((item) => item.key === chartMode)?.label ?? "Line Chart";

  return (
    <section className="cost-explorer-chart-panel cost-explorer-chart-panel--compact" aria-label="Cost vs time chart">
      <div className="cost-explorer-chart-panel__header cost-explorer-chart-panel__header--compact">
        <h3 className="cost-explorer-chart-panel__title">{title}</h3>
        <div className="cost-explorer-chart-panel__header-actions">
          <div className="cost-explorer-chart-mode" ref={modeMenuRef}>
            <button
              type="button"
              className={`cost-explorer-chart-mode__trigger${modeMenuOpen ? " is-open" : ""}`}
              onClick={() => setModeMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={modeMenuOpen}
            >
              <span className="cost-explorer-chart-mode__trigger-label">{activeModeLabel}</span>
              <ChevronDown className="cost-explorer-chart-mode__caret" size={14} aria-hidden="true" />
            </button>
            {modeMenuOpen ? (
              <div className="cost-explorer-chart-mode__menu" role="menu" aria-label="Chart type">
                {modeOptions.map((item) => {
                  const isActive = item.key === chartMode;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      className={`cost-explorer-chart-mode__item${isActive ? " is-active" : ""}`}
                      onClick={() => {
                        onChartModeChange(item.key);
                        setModeMenuOpen(false);
                      }}
                    >
                      <span>{item.label}</span>
                      {isActive ? <Check size={14} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          {showFetchStatus ? (
            <span className="cost-explorer-chart-panel__status">
              {showApplySkeleton ? "Applying filters..." : "Refreshing data..."}
            </span>
          ) : null}
        </div>
      </div>

      <div className="cost-explorer-chart-panel__body cost-explorer-chart-panel__body--compact">
        {isLoading ? <div className="cost-explorer-chart-skeleton" aria-hidden="true" /> : null}
        {isError ? (
          <EmptyStateBlock
            title="Unable to load Cost Explorer"
            message={errorMessage || "An unexpected error occurred."}
            actions={
              <button type="button" className="cost-explorer-state-btn" onClick={onRetry}>
                Retry
              </button>
            }
          />
        ) : null}
        {!isLoading && !isError && !chartReady ? (
          <EmptyStateBlock
            title="No cost data for this filter context"
            message="Try expanding the date range or reducing comparison layers."
            actions={
              <button type="button" className="cost-explorer-state-btn" onClick={onReset}>
                Reset filters
              </button>
            }
          />
        ) : null}
        {!isLoading && !isError && chartReady ? (
          <div className={`cost-explorer-chart-stack${showRefreshSkeleton ? " is-fetching" : ""}`}>
            <div key={chartMode} className="cost-explorer-chart-canvas cost-explorer-chart-canvas--plain">
              <BaseEChart option={option} height={420} onPointClick={onPointClick} />
            </div>
            {showRefreshSkeleton ? (
              <div className="cost-explorer-refresh-skeleton" aria-hidden="true">
                <div className="cost-explorer-refresh-skeleton__chips">
                  <span className="cost-explorer-refresh-skeleton__chip" />
                  <span className="cost-explorer-refresh-skeleton__chip" />
                  <span className="cost-explorer-refresh-skeleton__chip" />
                </div>
                <div className="cost-explorer-refresh-skeleton__chart" />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
