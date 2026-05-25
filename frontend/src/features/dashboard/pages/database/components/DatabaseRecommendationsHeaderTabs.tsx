export type DatabaseRecommendationsTabKey =
  | "overview"
  | "actions";

type DatabaseRecommendationsHeaderTabsProps = {
  activeTab: DatabaseRecommendationsTabKey;
  onChange: (tab: DatabaseRecommendationsTabKey) => void;
};

export function DatabaseRecommendationsHeaderTabs({ activeTab, onChange }: DatabaseRecommendationsHeaderTabsProps) {
  return (
    <div className="optimization-header-tabs" role="tablist" aria-label="Database optimization sections">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "overview"}
        className={`optimization-header-tab ${activeTab === "overview" ? "is-active" : ""}`}
        onClick={() => onChange("overview")}
      >
        Overview
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "actions"}
        className={`optimization-header-tab ${activeTab === "actions" ? "is-active" : ""}`}
        onClick={() => onChange("actions")}
      >
        Actions
      </button>
    </div>
  );
}
