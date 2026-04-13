import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useOptimizationRightsizingOverviewQuery,
  useOptimizationRightsizingRecommendationDetailQuery,
  useOptimizationRightsizingRecommendationsQuery,
} from "../../../hooks/useDashboardQueries";
import { dashboardApi } from "../../../api/dashboardApi";
import { useDashboardScope } from "../../../hooks/useDashboardScope";
import { compactCurrencyFormatter } from "../optimization.constants";

const PAGE_SIZE = 10;

const plainNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function toUpper(value: string | null): string {
  return value ? value.toUpperCase() : "";
}

function toTitleCase(value: string | null): string {
  if (!value) return "N/A";
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function buildRecommendationLabel(recommendation: string, currentType: string | null, recommendedType: string | null): string {
  if (currentType && recommendedType) {
    return `Resize ${currentType} → ${recommendedType}`;
  }
  return recommendation;
}

export function OptimizationRightsizingSection() {
  const queryClient = useQueryClient();
  const { scope } = useDashboardScope();
  const [status, setStatus] = useState<string>("all");
  const [effort, setEffort] = useState<string>("all");
  const [risk, setRisk] = useState<string>("all");
  const [region, setRegion] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);
  const [applyingRecommendationId, setApplyingRecommendationId] = useState<string | null>(null);
  const [ignoringRecommendationId, setIgnoringRecommendationId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const overviewQuery = useOptimizationRightsizingOverviewQuery();
  const recommendationsQuery = useOptimizationRightsizingRecommendationsQuery({
    status: status !== "all" ? [status] : undefined,
    effort: effort !== "all" ? [effort] : undefined,
    risk: risk !== "all" ? [risk] : undefined,
    region: region !== "all" ? [region] : undefined,
    page,
    pageSize: PAGE_SIZE,
  }, {
    autoRefetchWhileInProgress: true,
  });

  const detailQuery = useOptimizationRightsizingRecommendationDetailQuery(selectedRecommendationId);
  const recommendationItems = recommendationsQuery.data?.items ?? [];
  const pagination = recommendationsQuery.data?.pagination;

  const filterOptions = useMemo(() => {
    const statusSet = new Set<string>();
    const effortSet = new Set<string>();
    const riskSet = new Set<string>();
    const regionSet = new Set<string>();
    recommendationItems.forEach((item) => {
      if (item.status) statusSet.add(item.status);
      if (item.effort) effortSet.add(item.effort);
      if (item.risk) riskSet.add(item.risk);
      if (item.awsRegionCode) regionSet.add(item.awsRegionCode);
    });

    return {
      status: Array.from(statusSet).sort(),
      effort: Array.from(effortSet).sort(),
      risk: Array.from(riskSet).sort(),
      region: Array.from(regionSet).sort(),
    };
  }, [recommendationItems]);

  const totalRiskMixCount = overviewQuery.data
    ? overviewQuery.data.riskMix.low + overviewQuery.data.riskMix.medium + overviewQuery.data.riskMix.high
    : 0;

  const onFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
    setSelectedRecommendationId(null);
  };

  const hasPrev = Boolean(pagination && pagination.page > 1);
  const hasNext = Boolean(pagination && pagination.page < pagination.totalPages);

  const executeMutation = useMutation({
    mutationFn: async (recommendationId: string) => {
      if (!scope) throw new Error("Dashboard scope is not resolved yet");
      return dashboardApi.executeOptimizationRightsizingRecommendation(scope, recommendationId);
    },
    onMutate: (recommendationId) => {
      setApplyingRecommendationId(recommendationId);
      setActionError(null);
      setActionMessage(null);
    },
    onSuccess: () => {
      setActionMessage("Rightsizing action queued. Applying in background...");
      void queryClient.invalidateQueries({
        queryKey: ["dashboard", "optimization", "rightsizing"],
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to queue rightsizing action";
      setActionError(message);
    },
    onSettled: () => {
      setApplyingRecommendationId(null);
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: async (recommendationId: string) => {
      if (!scope) throw new Error("Dashboard scope is not resolved yet");
      return dashboardApi.ignoreOptimizationRightsizingRecommendation(scope, recommendationId);
    },
    onMutate: (recommendationId) => {
      setIgnoringRecommendationId(recommendationId);
      setActionError(null);
      setActionMessage(null);
    },
    onSuccess: (_data, recommendationId) => {
      setActionMessage("Recommendation ignored successfully.");
      queryClient.setQueryData(
        ["dashboard", "optimization", "rightsizing", "recommendations", scope, {
          status: status !== "all" ? [status] : undefined,
          effort: effort !== "all" ? [effort] : undefined,
          risk: risk !== "all" ? [risk] : undefined,
          region: region !== "all" ? [region] : undefined,
          page,
          pageSize: PAGE_SIZE,
        }],
        (existing: { items?: Array<{ id: string; status: string }> } | undefined) => {
          if (!existing?.items) return existing;
          return {
            ...existing,
            items: existing.items.map((item) =>
              item.id === recommendationId ? { ...item, status: "IGNORED" } : item,
            ),
          };
        },
      );
      void queryClient.invalidateQueries({
        queryKey: ["dashboard", "optimization", "rightsizing"],
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to ignore recommendation";
      setActionError(message);
    },
    onSettled: () => {
      setIgnoringRecommendationId(null);
    },
  });

  const isApplyDisabled = (item: (typeof recommendationItems)[number]): boolean => {
    const statusText = toUpper(item.status);
    if (
      statusText === "NO_ACTION_NEEDED" ||
      statusText === "IN_PROGRESS" ||
      statusText === "APPLIED" ||
      statusText === "IGNORED"
    ) {
      return true;
    }
    if (!item.recommendedType || (item.currentType && item.currentType === item.recommendedType)) {
      return true;
    }
    return executeMutation.isPending || ignoreMutation.isPending;
  };

  const isIgnoreDisabled = (item: (typeof recommendationItems)[number]): boolean => {
    const statusText = toUpper(item.status);
    if (
      statusText === "NO_ACTION_NEEDED" ||
      statusText === "IN_PROGRESS" ||
      statusText === "APPLIED" ||
      statusText === "IGNORED"
    ) {
      return true;
    }
    return executeMutation.isPending || ignoreMutation.isPending;
  };

  return (
    <div className="optimization-rightsizing-shell">
      {overviewQuery.isLoading ? <p className="dashboard-note">Loading rightsizing overview...</p> : null}
      {overviewQuery.isError ? <p className="dashboard-note">Failed to load rightsizing overview: {overviewQuery.error.message}</p> : null}

      <section className="optimization-rightsizing-kpis-bar">
        <article className="optimization-rightsizing-kpi-inline">
          <p className="optimization-rightsizing-kpi__label">Potential Savings / Month</p>
          <p className="optimization-rightsizing-kpi__value">
            {compactCurrencyFormatter.format(overviewQuery.data?.totalPotentialSavings ?? 0)}
          </p>
        </article>
        <article className="optimization-rightsizing-kpi-inline">
          <p className="optimization-rightsizing-kpi__label">Open Recommendations</p>
          <p className="optimization-rightsizing-kpi__value">
            {plainNumberFormatter.format(overviewQuery.data?.openRecommendationCount ?? 0)}
          </p>
        </article>
        <article className="optimization-rightsizing-kpi-inline">
          <p className="optimization-rightsizing-kpi__label">High Impact</p>
          <p className="optimization-rightsizing-kpi__value">
            {plainNumberFormatter.format(overviewQuery.data?.quickWinsCount ?? 0)}
          </p>
        </article>
        <article className="optimization-rightsizing-kpi-inline">
          <p className="optimization-rightsizing-kpi__label">Risk Mix</p>
          <p className="optimization-rightsizing-kpi__value">{plainNumberFormatter.format(totalRiskMixCount)}</p>
        </article>
      </section>

      <section className="optimization-rightsizing-panel">
        {actionMessage ? <p className="dashboard-note">{actionMessage}</p> : null}
        {actionError ? <p className="dashboard-note">Action failed: {actionError}</p> : null}
        <div className="optimization-rightsizing-filters">
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Status</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={status}
              onChange={(event) => onFilterChange(setStatus, event.target.value)}
            >
              <option value="all">All status</option>
              {filterOptions.status.map((option) => (
                <option key={option} value={option}>
                  {toTitleCase(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Effort</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={effort}
              onChange={(event) => onFilterChange(setEffort, event.target.value)}
            >
              <option value="all">All effort</option>
              {filterOptions.effort.map((option) => (
                <option key={option} value={option}>
                  {toTitleCase(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Risk</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={risk}
              onChange={(event) => onFilterChange(setRisk, event.target.value)}
            >
              <option value="all">All risk</option>
              {filterOptions.risk.map((option) => (
                <option key={option} value={option}>
                  {toTitleCase(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Region</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={region}
              onChange={(event) => onFilterChange(setRegion, event.target.value)}
            >
              <option value="all">All regions</option>
              {filterOptions.region.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {recommendationsQuery.isLoading ? <p className="dashboard-note">Loading rightsizing recommendations...</p> : null}
        {recommendationsQuery.isError ? (
          <p className="dashboard-note">Failed to load rightsizing recommendations: {recommendationsQuery.error.message}</p>
        ) : null}

        <div className="optimization-rightsizing-table-scroll">
          <table className="optimization-rightsizing-table">
            <thead>
              <tr>
                <th>Recommendation</th>
                <th>Resource</th>
                <th>Current Cost</th>
                <th>Est. Savings</th>
                <th>Service</th>
                <th>Region</th>
                <th>Risk</th>
                <th>Effort</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recommendationItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="optimization-rightsizing-empty">
                    <p className="optimization-rightsizing-empty__title">No recommendations found</p>
                    <p className="optimization-rightsizing-empty__text">Try changing filters or broadening the selected scope.</p>
                  </td>
                </tr>
              ) : (
                recommendationItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <p className="optimization-rightsizing-cell__primary">
                        {buildRecommendationLabel(item.recommendation, item.currentType, item.recommendedType)}
                      </p>
                    </td>
                    <td className="optimization-rightsizing-cell__mono">{item.resource}</td>
                    <td className="optimization-rightsizing-cell__mono">{compactCurrencyFormatter.format(item.currentCost)}</td>
                    <td className="optimization-rightsizing-cell__mono optimization-rightsizing-cell__saving">
                      {compactCurrencyFormatter.format(item.estimatedSavings)}
                    </td>
                    <td>{item.serviceName ?? "N/A"}</td>
                    <td className="optimization-rightsizing-cell__mono">{item.awsRegionCode}</td>
                    <td>
                      <span className={`optimization-rightsizing-pill is-risk-${toUpper(item.risk)}`}>{toTitleCase(item.risk)}</span>
                    </td>
                    <td>
                      <span className={`optimization-rightsizing-pill is-effort-${toUpper(item.effort)}`}>{toTitleCase(item.effort)}</span>
                    </td>
                    <td>
                      <span className={`optimization-rightsizing-pill is-status-${toUpper(item.status)}`}>{toTitleCase(item.status)}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="optimization-rightsizing-view-btn"
                          disabled={isApplyDisabled(item)}
                          onClick={() => executeMutation.mutate(item.id)}
                        >
                          {toUpper(item.status) === "IN_PROGRESS" || applyingRecommendationId === item.id
                            ? "Applying..."
                            : "Apply"}
                        </button>
                        <button
                          type="button"
                          className="optimization-rightsizing-view-btn"
                          disabled={isIgnoreDisabled(item)}
                          onClick={() => ignoreMutation.mutate(item.id)}
                        >
                          {ignoringRecommendationId === item.id ? "Ignoring..." : "Ignore"}
                        </button>
                        <button
                          type="button"
                          className="optimization-rightsizing-view-btn"
                          onClick={() => setSelectedRecommendationId(item.id)}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="optimization-rightsizing-pagination">
          <p className="optimization-rightsizing-pagination__info">
            Page {pagination?.page ?? 1} of {Math.max(1, pagination?.totalPages ?? 1)}
          </p>
          <div className="optimization-rightsizing-pagination__actions">
            <button
              type="button"
              className="optimization-rightsizing-view-btn"
              disabled={!hasPrev}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="optimization-rightsizing-view-btn"
              disabled={!hasNext}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedRecommendationId ? (
        <section className="optimization-rightsizing-detail">
          <div className="optimization-rightsizing-detail__head">
            <p className="optimization-rightsizing-detail__title">Recommendation Detail</p>
            <button
              type="button"
              className="optimization-rightsizing-view-btn"
              onClick={() => setSelectedRecommendationId(null)}
            >
              Close
            </button>
          </div>
          {detailQuery.isLoading ? <p>Loading recommendation detail...</p> : null}
          {detailQuery.isError ? <p>Failed to load recommendation detail: {detailQuery.error.message}</p> : null}
          {detailQuery.data ? (
            <div className="optimization-rightsizing-detail__grid">
              <p>
                <strong>Title:</strong> {detailQuery.data.recommendationTitle ?? detailQuery.data.recommendationType}
              </p>
              <p>
                <strong>Category:</strong> {toTitleCase(detailQuery.data.category)}
              </p>
              <p>
                <strong>Resource:</strong> {detailQuery.data.resourceId}
                {detailQuery.data.resourceName ? ` / ${detailQuery.data.resourceName}` : ""}
              </p>
              <p>
                <strong>Region:</strong> {detailQuery.data.awsRegionCode}
              </p>
              <p>
                <strong>Current Cost:</strong> {compactCurrencyFormatter.format(detailQuery.data.currentMonthlyCost)}
              </p>
              <p>
                <strong>Projected Cost:</strong> {compactCurrencyFormatter.format(detailQuery.data.projectedMonthlyCost)}
              </p>
              <p>
                <strong>Estimated Savings:</strong> {compactCurrencyFormatter.format(detailQuery.data.estimatedMonthlySavings)}
              </p>
              <p>
                <strong>Performance Risk:</strong> {toTitleCase(detailQuery.data.performanceRiskLevel)}
              </p>
              <p className="optimization-rightsizing-detail__full">
                <strong>Description:</strong> {detailQuery.data.recommendationText ?? "No recommendation text available."}
              </p>
              <p>
                <strong>Last Updated:</strong> {new Date(detailQuery.data.updatedAt).toLocaleString()}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
