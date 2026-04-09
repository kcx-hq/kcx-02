import { optimizationInsights, type OptimizationInsightKey } from "../optimization.constants";

type OptimizationTopTab = "overview" | OptimizationInsightKey;

type OptimizationHeaderTabsProps = {
  activeTopTab: OptimizationTopTab;
  onChange: (tab: OptimizationTopTab) => void;
};

export function OptimizationHeaderTabs({ activeTopTab, onChange }: OptimizationHeaderTabsProps) {
  return (
    <div className="optimization-header-tabs" role="tablist" aria-label="Optimization sections">
      <button
        type="button"
        className={`optimization-header-tab ${activeTopTab === "overview" ? "is-active" : ""}`}
        onClick={() => onChange("overview")}
        role="tab"
        aria-selected={activeTopTab === "overview"}
      >
        Overview
      </button>
      {optimizationInsights.map((item) => (
        <button
          type="button"
          key={item.key}
          className={`optimization-header-tab ${activeTopTab === item.key ? "is-active" : ""}`}
          onClick={() => onChange(item.key)}
          role="tab"
          aria-selected={activeTopTab === item.key}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export type { OptimizationTopTab };
