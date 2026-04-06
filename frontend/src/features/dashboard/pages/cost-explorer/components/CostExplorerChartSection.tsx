import { useEffect, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import { Check, ChevronDown } from "lucide-react";

import { BaseEChart } from "../../../common/charts/BaseEChart";
import { EmptyStateBlock } from "../../../common/components/EmptyStateBlock";

type CostExplorerChartSectionProps = {
  option: EChartsOption;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  isFetching: boolean;
  chartReady: boolean;
  chartMode: "line" | "bar";
  onChartModeChange: (mode: "line" | "bar") => void;
  kpis: Array<{
    label: string;
    value: string;
    tone?: "default" | "positive" | "negative";
  }>;
  topBreakdowns: Array<{
    key: "service" | "account" | "region";
    label: string;
    rows: Array<{
      rank: number;
      name: string;
      costLabel: string;
      changeLabel: string;
      changeTone: "positive" | "negative" | "neutral";
    }>;
  }>;
  onRetry: () => void;
  onReset: () => void;
};

export function CostExplorerChartSection({
  option,
  isLoading,
  isError,
  errorMessage,
  isFetching,
  chartReady,
  chartMode,
  onChartModeChange,
  kpis,
  topBreakdowns,
  onRetry,
  onReset,
}: CostExplorerChartSectionProps) {
  const modeMenuRef = useRef<HTMLDivElement | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!modeMenuRef.current) return;
      if (modeMenuRef.current.contains(event.target as Node)) return;
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
    <section className="cost-explorer-chart-panel" aria-label="Cost vs time chart">
      <div className="cost-explorer-chart-panel__header">
        <div>
          <div className="cost-explorer-chart-panel__kpis" aria-label="Chart key metrics">
            {kpis.map((kpi) => (
              <span key={kpi.label} className={`cost-explorer-chart-kpi${kpi.tone ? ` is-${kpi.tone}` : ""}`}>
                <span className="cost-explorer-chart-kpi__label">{kpi.label}</span>
                <span className="cost-explorer-chart-kpi__value">{kpi.value}</span>
              </span>
            ))}
          </div>
        </div>
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
          {isFetching && !isLoading ? <span className="cost-explorer-chart-panel__status">Refreshing data...</span> : null}
        </div>
      </div>

      <div className="cost-explorer-chart-panel__body">
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
          <div className="cost-explorer-chart-stack">
            <div key={chartMode} className="cost-explorer-chart-canvas">
              <BaseEChart option={option} height={420} />
            </div>
            {topBreakdowns.length ? (
              <div className={`cost-explorer-breakdown-grid${topBreakdowns.length === 1 ? " is-single" : ""}`} aria-label="Top 5 breakdowns">
                {topBreakdowns.map((group) => (
                  <div key={group.key} className="cost-explorer-breakdown-block">
                    <p className="cost-explorer-breakdown-block__title">{group.label}</p>
                    <div className="cost-explorer-breakdown-table-wrap">
                      <table className="cost-explorer-breakdown-table">
                        <thead>
                          <tr>
                            <th scope="col">Name</th>
                            <th scope="col">Cost</th>
                            <th scope="col">Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => (
                            <tr key={`${group.key}-${row.name}`}>
                              <td>{row.name}</td>
                              <td>{row.costLabel}</td>
                              <td className={`cost-explorer-breakdown-table__change is-${row.changeTone}`}>{row.changeLabel}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
