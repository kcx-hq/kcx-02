import { useMemo } from "react";
import { WidgetShell } from "../../../common/components";
import {
  useOptimizationCommitmentRecommendationsQuery,
  useOptimizationCommitmentOverviewQuery,
  useOptimizationIdleOverviewQuery,
  useOptimizationIdleRecommendationsQuery,
  useOptimizationRightsizingRecommendationsQuery,
  useOptimizationRightsizingOverviewQuery,
} from "../../../hooks/useDashboardQueries";
import {
  buildDonutGradient,
  compactCurrencyFormatter,
} from "../optimization.constants";

type OverviewInsight = {
  key: "rightsizing" | "idle-resources" | "commitments";
  label: string;
  color: string;
  potential: number;
  recommendations: number;
};

function OptimizationOverviewWidget() {
  const rightsizingOverviewQuery = useOptimizationRightsizingOverviewQuery();
  const idleOverviewQuery = useOptimizationIdleOverviewQuery();
  const commitmentOverviewQuery = useOptimizationCommitmentOverviewQuery();

  const insights = useMemo<OverviewInsight[]>(
    () => [
      {
        key: "rightsizing",
        label: "Rightsizing",
        color: "#23a282",
        potential: rightsizingOverviewQuery.data?.totalPotentialSavings ?? 0,
        recommendations: rightsizingOverviewQuery.data?.openRecommendationCount ?? 0,
      },
      {
        key: "idle-resources",
        label: "Idle Resources",
        color: "#b99abf",
        potential: idleOverviewQuery.data?.totalPotentialSavings ?? 0,
        recommendations: idleOverviewQuery.data?.openRecommendationCount ?? 0,
      },
      {
        key: "commitments",
        label: "Commitments",
        color: "#89b5cf",
        potential: commitmentOverviewQuery.data?.totalPotentialSavings ?? 0,
        recommendations: commitmentOverviewQuery.data?.openRecommendationCount ?? 0,
      },
    ],
    [
      commitmentOverviewQuery.data?.openRecommendationCount,
      commitmentOverviewQuery.data?.totalPotentialSavings,
      idleOverviewQuery.data?.openRecommendationCount,
      idleOverviewQuery.data?.totalPotentialSavings,
      rightsizingOverviewQuery.data?.openRecommendationCount,
      rightsizingOverviewQuery.data?.totalPotentialSavings,
    ],
  );

  const isLoading =
    rightsizingOverviewQuery.isLoading || idleOverviewQuery.isLoading || commitmentOverviewQuery.isLoading;
  const isError = rightsizingOverviewQuery.isError || idleOverviewQuery.isError || commitmentOverviewQuery.isError;
  const errorMessage =
    rightsizingOverviewQuery.error?.message ||
    idleOverviewQuery.error?.message ||
    commitmentOverviewQuery.error?.message ||
    "Failed to load optimization overview.";

  const totalPotential = useMemo(() => insights.reduce((sum, item) => sum + item.potential, 0), [insights]);
  const donutGradient = useMemo(() => buildDonutGradient(insights), [insights]);

  return (
    <WidgetShell title="Potential Saving" subtitle="Potential saving insights overview">
      {isLoading ? <p className="dashboard-note">Loading optimization overview insights...</p> : null}
      {isError ? <p className="dashboard-note">{errorMessage}</p> : null}
      <div className="optimization-overview-surface">
        <div className="optimization-overview-donut-panel">
          <div className="optimization-overview-donut" style={{ backgroundImage: donutGradient }}>
            <div className="optimization-overview-donut__center">
              <p className="optimization-overview-donut__value">{compactCurrencyFormatter.format(totalPotential)}</p>
              <p className="optimization-overview-donut__label">Potential / month</p>
            </div>
          </div>
        </div>

        <div className="optimization-overview-insight-list">
          {insights.map((item) => {
            const shareOfTotal = totalPotential > 0 ? Math.round((item.potential / totalPotential) * 100) : 0;
            return (
              <article key={item.key} className="optimization-overview-insight-item">
                <div className="optimization-overview-insight-item__head">
                  <span className="optimization-overview-insight-item__dot" style={{ backgroundColor: item.color }} />
                  <p className="optimization-overview-insight-item__title">{item.label}</p>
                </div>
                <p className="optimization-overview-insight-item__value">{compactCurrencyFormatter.format(item.potential)}</p>
                <p className="optimization-overview-insight-item__meta">
                  {item.recommendations} recommendations - {shareOfTotal}% of total potential
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </WidgetShell>
  );
}

function VerifiedSavingWidget() {
  const rightsizingAppliedQuery = useOptimizationRightsizingRecommendationsQuery({
    status: ["APPLIED"],
    page: 1,
    pageSize: 500,
  });
  const idleAppliedQuery = useOptimizationIdleRecommendationsQuery({
    status: ["APPLIED"],
    page: 1,
    pageSize: 500,
  });
  const commitmentAppliedQuery = useOptimizationCommitmentRecommendationsQuery({
    status: ["APPLIED"],
    page: 1,
    pageSize: 500,
  });

  const verifiedInsights = useMemo(
    () => [
      {
        key: "rightsizing",
        label: "Rightsizing",
        color: "#23a282",
        saving: (rightsizingAppliedQuery.data?.items ?? []).reduce((sum, item) => sum + (item.estimatedSavings ?? 0), 0),
        count: rightsizingAppliedQuery.data?.pagination.total ?? 0,
      },
      {
        key: "idle-resources",
        label: "Idle Resources",
        color: "#b99abf",
        saving: (idleAppliedQuery.data?.items ?? []).reduce((sum, item) => sum + (item.estimatedMonthlySavings ?? 0), 0),
        count: idleAppliedQuery.data?.pagination.total ?? 0,
      },
      {
        key: "commitments",
        label: "Commitments",
        color: "#89b5cf",
        saving: (commitmentAppliedQuery.data?.items ?? []).reduce((sum, item) => sum + (item.estimatedMonthlySavings ?? 0), 0),
        count: commitmentAppliedQuery.data?.pagination.total ?? 0,
      },
    ],
    [
      commitmentAppliedQuery.data?.items,
      commitmentAppliedQuery.data?.pagination.total,
      idleAppliedQuery.data?.items,
      idleAppliedQuery.data?.pagination.total,
      rightsizingAppliedQuery.data?.items,
      rightsizingAppliedQuery.data?.pagination.total,
    ],
  );

  const totalVerified = useMemo(
    () => verifiedInsights.reduce((sum, item) => sum + item.saving, 0),
    [verifiedInsights],
  );
  const isLoading =
    rightsizingAppliedQuery.isLoading || idleAppliedQuery.isLoading || commitmentAppliedQuery.isLoading;
  const isError = rightsizingAppliedQuery.isError || idleAppliedQuery.isError || commitmentAppliedQuery.isError;
  const errorMessage =
    rightsizingAppliedQuery.error?.message ||
    idleAppliedQuery.error?.message ||
    commitmentAppliedQuery.error?.message ||
    "Failed to load verified savings.";

  return (
    <WidgetShell title="Verified Saving" subtitle="Applied recommendations verified across all optimization sections">
      {isLoading ? <p className="dashboard-note">Loading verified savings...</p> : null}
      {isError ? <p className="dashboard-note">{errorMessage}</p> : null}
      <div className="optimization-verified-surface">
        <article className="optimization-verified-total">
          <p className="optimization-verified-total__label">Total Verified Saving / month</p>
          <p className="optimization-verified-total__value">{compactCurrencyFormatter.format(totalVerified)}</p>
        </article>

        <div className="optimization-verified-grid">
          {verifiedInsights.map((item) => (
            <article key={item.key} className="optimization-verified-item">
              <div className="optimization-verified-item__head">
                <span className="optimization-overview-insight-item__dot" style={{ backgroundColor: item.color }} />
                <p className="optimization-overview-insight-item__title">{item.label}</p>
              </div>
              <p className="optimization-overview-insight-item__value">{compactCurrencyFormatter.format(item.saving)}</p>
              <p className="optimization-overview-insight-item__meta">
                {item.count} applied recommendations
              </p>
            </article>
          ))}
        </div>
      </div>
    </WidgetShell>
  );
}

export function OptimizationOverviewSection() {
  return (
    <div className="optimization-layout">
      <section>
        <OptimizationOverviewWidget />
      </section>
      <section>
        <VerifiedSavingWidget />
      </section>
    </div>
  );
}
