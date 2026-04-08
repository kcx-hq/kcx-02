import { useMemo, useState } from "react";
import { WidgetShell } from "../../common/components";
import { useOptimizationQuery } from "../../hooks/useDashboardQueries";

type OptimizationInsightKey = "rightsizing" | "idle-resources" | "commitments" | "storage";

type SavingInsight = {
  key: OptimizationInsightKey;
  label: string;
  shortLabel: string;
  potential: number;
  realized: number;
  recommendations: number;
  color: string;
};

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const optimizationInsights: SavingInsight[] = [
  {
    key: "rightsizing",
    label: "Rightsizing",
    shortLabel: "Right sizing",
    potential: 11900,
    realized: 4300,
    recommendations: 16,
    color: "#8fca66",
  },
  {
    key: "idle-resources",
    label: "Idle Resources",
    shortLabel: "Idle resources",
    potential: 7800,
    realized: 2100,
    recommendations: 12,
    color: "#b99abf",
  },
  {
    key: "commitments",
    label: "Commitments",
    shortLabel: "Commitments",
    potential: 5400,
    realized: 1900,
    recommendations: 8,
    color: "#89b5cf",
  },
  {
    key: "storage",
    label: "Storage",
    shortLabel: "Storage",
    potential: 2900,
    realized: 1150,
    recommendations: 5,
    color: "#6c91d8",
  },
];

function buildDonutGradient(items: SavingInsight[]): string {
  const total = items.reduce((sum, item) => sum + item.potential, 0);
  if (!total) {
    return "conic-gradient(#d8e7e5 0deg, #d8e7e5 360deg)";
  }

  let cursor = 0;
  const slices = items.map((item) => {
    const angle = (item.potential / total) * 360;
    const start = cursor;
    cursor += angle;
    return `${item.color} ${start}deg ${cursor}deg`;
  });
  return `conic-gradient(${slices.join(", ")})`;
}

export default function OptimizationPage() {
  const query = useOptimizationQuery();
  const [activeTopTab, setActiveTopTab] = useState<"overview" | "recommendations">("overview");
  const [activeRecommendationTab, setActiveRecommendationTab] = useState<OptimizationInsightKey>("rightsizing");

  const totalPotential = useMemo(
    () => optimizationInsights.reduce((sum, item) => sum + item.potential, 0),
    [],
  );

  const donutGradient = useMemo(() => buildDonutGradient(optimizationInsights), []);

  return (
    <div className="dashboard-page optimization-page">
      <div className="optimization-header-tabs" role="tablist" aria-label="Optimization sections">
        <button
          type="button"
          className={`optimization-header-tab ${activeTopTab === "overview" ? "is-active" : ""}`}
          onClick={() => setActiveTopTab("overview")}
          role="tab"
          aria-selected={activeTopTab === "overview"}
        >
          Overview
        </button>
        <button
          type="button"
          className={`optimization-header-tab ${activeTopTab === "recommendations" ? "is-active" : ""}`}
          onClick={() => setActiveTopTab("recommendations")}
          role="tab"
          aria-selected={activeTopTab === "recommendations"}
        >
          Recommendations
        </button>
      </div>

      {query.isLoading ? <p className="dashboard-note">Loading optimization data...</p> : null}
      {query.isError ? <p className="dashboard-note">Failed to load optimization: {query.error.message}</p> : null}

      {activeTopTab === "overview" ? (
        <div className="optimization-layout">
          <section>
            <WidgetShell title="Savings Potential" subtitle="Potential savings split by optimization insight">
              <div className="optimization-potential-content">
                <div className="optimization-donut-card">
                  <div className="optimization-donut" style={{ backgroundImage: donutGradient }}>
                    <div className="optimization-donut__center">
                      <p className="optimization-donut__value">{compactCurrencyFormatter.format(totalPotential)}</p>
                      <p className="optimization-donut__label">Potential / month</p>
                    </div>
                  </div>

                  <div className="optimization-donut-legend">
                    {optimizationInsights.map((item) => (
                      <div key={item.key} className="optimization-donut-legend__item">
                        <span className="optimization-donut-legend__dot" style={{ backgroundColor: item.color }} />
                        <span className="optimization-donut-legend__name">{item.shortLabel}</span>
                        <span className="optimization-donut-legend__value">{compactCurrencyFormatter.format(item.potential)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </WidgetShell>
          </section>

          <WidgetShell title="Realized Saving" subtitle="Savings captured through completed optimization actions">
            <section className="optimization-realized-grid">
              {optimizationInsights.map((item) => {
                const completionRatio = item.potential > 0 ? (item.realized / item.potential) * 100 : 0;
                return (
                  <article key={item.key} className="optimization-realized-item">
                    <div className="optimization-realized-item__head">
                      <p className="optimization-realized-item__title">{item.label}</p>
                      <p className="optimization-realized-item__value">{compactCurrencyFormatter.format(item.realized)}</p>
                    </div>
                    <div className="optimization-realized-progress">
                      <span
                        className="optimization-realized-progress__fill"
                        style={{ width: `${Math.min(100, completionRatio)}%`, backgroundColor: item.color }}
                      />
                    </div>
                    <p className="optimization-realized-item__meta">{Math.round(completionRatio)}% of potential captured</p>
                  </article>
                );
              })}
            </section>
          </WidgetShell>
        </div>
      ) : (
        <div className="optimization-layout">
          <div className="optimization-recommendation-tabs" role="tablist" aria-label="Recommendation categories">
            {optimizationInsights.map((item) => (
              <button
                type="button"
                key={item.key}
                className={`optimization-recommendation-tab ${activeRecommendationTab === item.key ? "is-active" : ""}`}
                onClick={() => setActiveRecommendationTab(item.key)}
                role="tab"
                aria-selected={activeRecommendationTab === item.key}
              >
                <span className="optimization-recommendation-tab__name">{item.label}</span>
                <span className="optimization-recommendation-tab__count">{item.recommendations}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
