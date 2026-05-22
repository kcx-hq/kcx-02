import type { DatabaseRecommendationType } from "../../../api/dashboardTypes";

export type DatabaseRecommendationsTabKey =
  | "overview"
  | "actions";

export type DatabaseRecommendationFamilyTab = {
  key: "storage-optimization" | "idle-candidates" | "ha-cost-review" | "engine-deployment-review";
  label: string;
  recommendationType: DatabaseRecommendationType;
  actionLabel: "View details" | "Review evidence" | "View";
  tablePreset: DatabaseRecommendationType;
  emptyStateMessage: string;
};

export const DATABASE_RECOMMENDATION_FAMILY_TABS: DatabaseRecommendationFamilyTab[] = [
  {
    key: "storage-optimization",
    label: "Storage Optimization",
    recommendationType: "DB_STORAGE_OPTIMIZATION",
    actionLabel: "View details",
    tablePreset: "DB_STORAGE_OPTIMIZATION",
    emptyStateMessage:
      "No storage optimization recommendations match current filters. Review evidence scope or check again after new billing and inventory signals are ingested.",
  },
  {
    key: "idle-candidates",
    label: "Idle Candidates",
    recommendationType: "DB_IDLE_CANDIDATE",
    actionLabel: "Review evidence",
    tablePreset: "DB_IDLE_CANDIDATE",
    emptyStateMessage:
      "No idle-candidate recommendations match current filters. This view only shows informational low-activity signals with available evidence.",
  },
  {
    key: "ha-cost-review",
    label: "HA Cost Review",
    recommendationType: "DB_HA_COST_OPTIMIZATION",
    actionLabel: "View",
    tablePreset: "DB_HA_COST_OPTIMIZATION",
    emptyStateMessage:
      "No HA cost review recommendations match current filters. This tab highlights informational resilience-cost posture signals when available.",
  },
  {
    key: "engine-deployment-review",
    label: "Engine / Deployment Review",
    recommendationType: "DB_ENGINE_DEPLOYMENT_OPTIMIZATION",
    actionLabel: "Review evidence",
    tablePreset: "DB_ENGINE_DEPLOYMENT_OPTIMIZATION",
    emptyStateMessage:
      "No engine/deployment review recommendations match current filters. This view surfaces informational fit signals from available metadata and telemetry context.",
  },
];

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
