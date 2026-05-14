import { EmptyStateBlock, KpiCard, KpiGrid } from "../../../common/components";
import type { DatabaseRecommendationSummary } from "../../../api/dashboardTypes";
import { formatInteger, recommendationTypeLabel } from "./db-recommendations.formatters";
import {
  DATABASE_RECOMMENDATION_FAMILY_TABS,
  type DatabaseRecommendationsTabKey,
} from "./DatabaseRecommendationsHeaderTabs";

type DatabaseRecommendationsOverviewTabProps = {
  summary: DatabaseRecommendationSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  onOpenSection: (tab: Exclude<DatabaseRecommendationsTabKey, "overview">) => void;
};

const ACTIVE_STATUSES = ["OPEN", "IN_PROGRESS", "SNOOZED"] as const;

const FAMILY_DESCRIPTIONS: Record<string, string> = {
  DB_STORAGE_OPTIMIZATION: "Review storage, backup, and I/O cost composition.",
  DB_IDLE_CANDIDATE: "Review low-activity database resources with available evidence.",
  DB_HA_COST_OPTIMIZATION: "Review resilience-cost posture and topology-related signals.",
  DB_ENGINE_DEPLOYMENT_OPTIMIZATION: "Review engine, deployment, and metadata-fit signals.",
};

export function DatabaseRecommendationsOverviewTab({
  summary,
  isLoading,
  isError,
  onOpenSection,
}: DatabaseRecommendationsOverviewTabProps) {
  if (isLoading && !summary) {
    return <p className="dashboard-note">Loading recommendation overview...</p>;
  }

  if (isError && !summary) {
    return <p className="dashboard-note">Unable to load recommendation overview.</p>;
  }

  const totalRecommendations = summary?.total ?? 0;
  const openReviews = ACTIVE_STATUSES.reduce(
    (sum, status) => sum + (summary?.byStatus?.[status] ?? 0),
    0,
  );
  const evidenceBackedReviews = (summary?.byEvidenceLevel?.inventory_backed ?? 0) + (summary?.byEvidenceLevel?.telemetry_backed ?? 0);
  const dataWarnings = summary?.warningsCount ?? 0;

  if (totalRecommendations === 0) {
    return (
      <EmptyStateBlock
        title="No database recommendations are available yet"
        message="Recommendations will appear after database billing, inventory, and optional telemetry signals are processed."
      />
    );
  }

  return (
    <div className="optimization-layout">
      <KpiGrid>
        <KpiCard label="Total DB recommendations" value={formatInteger(totalRecommendations)} />
        <KpiCard label="Open reviews" value={formatInteger(openReviews)} />
        <KpiCard
          label="Evidence-backed reviews"
          value={formatInteger(evidenceBackedReviews)}
          meta={`Inventory-backed: ${formatInteger(summary?.byEvidenceLevel?.inventory_backed ?? 0)} | Telemetry-backed: ${formatInteger(summary?.byEvidenceLevel?.telemetry_backed ?? 0)}`}
        />
        <KpiCard
          label="Data warnings"
          value={formatInteger(dataWarnings)}
        />
      </KpiGrid>

      <section className="dashboard-table-shell">
        <header className="dashboard-table-shell__header">
          <h3 className="dashboard-table-shell__title">Recommendation Families</h3>
        </header>
        <div className="dashboard-table-shell__body">
          <KpiGrid className="db-assets-summary-grid">
            {DATABASE_RECOMMENDATION_FAMILY_TABS.map((tab) => (
              <article key={tab.key} className="dashboard-kpi-card">
                <p className="dashboard-kpi-card__label">{recommendationTypeLabel(tab.recommendationType)}</p>
                <p className="dashboard-kpi-card__value">{formatInteger(summary?.byType?.[tab.recommendationType] ?? 0)}</p>
                <div className="dashboard-kpi-card__footer">
                  <span className="dashboard-kpi-card__meta">
                    {FAMILY_DESCRIPTIONS[tab.recommendationType] ?? "Review evidence signals and context."}
                  </span>
                </div>
                <div className="dashboard-kpi-card__footer">
                  <button
                    type="button"
                    className="cost-explorer-state-btn"
                    onClick={() => onOpenSection(tab.key)}
                  >
                    {tab.recommendationType === "DB_STORAGE_OPTIMIZATION" || tab.recommendationType === "DB_HA_COST_OPTIMIZATION"
                      ? "View section"
                      : "Review section"}
                  </button>
                </div>
              </article>
            ))}
          </KpiGrid>
        </div>
      </section>
    </div>
  );
}
