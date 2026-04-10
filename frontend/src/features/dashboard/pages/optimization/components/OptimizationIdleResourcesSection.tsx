import { useMemo, useState } from "react";
import {
  useOptimizationIdleOverviewQuery,
  useOptimizationIdleRecommendationDetailQuery,
  useOptimizationIdleRecommendationsQuery,
} from "../../../hooks/useDashboardQueries";
import { compactCurrencyFormatter } from "../optimization.constants";

const PAGE_SIZE = 10;

const plainNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function toTitleCase(value: string | null): string {
  if (!value) return "N/A";
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatRecommendationType(value: string): string {
  return toTitleCase(value);
}

export function OptimizationIdleResourcesSection() {
  const [status, setStatus] = useState<string>("all");
  const [region, setRegion] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [reason, setReason] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);

  const overviewQuery = useOptimizationIdleOverviewQuery();
  const recommendationsQuery = useOptimizationIdleRecommendationsQuery({
    status: status !== "all" ? [status] : undefined,
    region: region !== "all" ? [region] : undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const detailQuery = useOptimizationIdleRecommendationDetailQuery(selectedRecommendationId);

  const recommendationItems = recommendationsQuery.data?.items ?? [];
  const filteredItems = recommendationItems.filter((item) => {
    const typeMatches = type === "all" || item.recommendationType === type;
    const reasonMatches = reason === "all" || item.idleReason === reason;
    return typeMatches && reasonMatches;
  });
  const pagination = recommendationsQuery.data?.pagination;

  const filterOptions = useMemo(() => {
    const statusSet = new Set<string>();
    const regionSet = new Set<string>();
    const typeSet = new Set<string>();
    const reasonSet = new Set<string>();

    recommendationItems.forEach((item) => {
      if (item.status) statusSet.add(item.status);
      if (item.awsRegionCode) regionSet.add(item.awsRegionCode);
      if (item.recommendationType) typeSet.add(item.recommendationType);
      if (item.idleReason) reasonSet.add(item.idleReason);
    });

    return {
      status: Array.from(statusSet).sort(),
      region: Array.from(regionSet).sort(),
      type: Array.from(typeSet).sort(),
      reason: Array.from(reasonSet).sort(),
    };
  }, [recommendationItems]);

  const hasPrev = Boolean(pagination && pagination.page > 1);
  const hasNext = Boolean(pagination && pagination.page < pagination.totalPages);

  const onFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
    setSelectedRecommendationId(null);
  };

  return (
    <section className="optimization-rightsizing-shell optimization-idle-section">
      {overviewQuery.isLoading ? <p className="dashboard-note">Loading idle overview...</p> : null}
      {overviewQuery.isError ? <p className="dashboard-note">Failed to load idle overview: {overviewQuery.error.message}</p> : null}
      <section className="optimization-rightsizing-panel">
        <section className="optimization-rightsizing-kpis-bar optimization-idle-kpis-inline-row">
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
              {plainNumberFormatter.format(overviewQuery.data?.highImpactCount ?? 0)}
            </p>
          </article>
          <article className="optimization-rightsizing-kpi-inline">
            <p className="optimization-rightsizing-kpi__label">Low Risk</p>
            <p className="optimization-rightsizing-kpi__value">
              {plainNumberFormatter.format(overviewQuery.data?.lowRiskCount ?? 0)}
            </p>
          </article>
        </section>

        <div className="optimization-rightsizing-filters optimization-idle-filters">
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
            <p className="optimization-rightsizing-filter-label">Recommendation Type</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={type}
              onChange={(event) => onFilterChange(setType, event.target.value)}
            >
              <option value="all">All types</option>
              {filterOptions.type.map((option) => (
                <option key={option} value={option}>
                  {formatRecommendationType(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Idle Reason</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={reason}
              onChange={(event) => onFilterChange(setReason, event.target.value)}
            >
              <option value="all">All reasons</option>
              {filterOptions.reason.map((option) => (
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

        {recommendationsQuery.isLoading ? <p className="dashboard-note">Loading idle recommendations...</p> : null}
        {recommendationsQuery.isError ? (
          <p className="dashboard-note">Failed to load idle recommendations: {recommendationsQuery.error.message}</p>
        ) : null}

        <div className="optimization-rightsizing-table-scroll">
          <table className="optimization-rightsizing-table optimization-idle-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Resource</th>
                <th>Idle Reason</th>
                <th>Observation</th>
                <th>Current Cost</th>
                <th>Est. Savings</th>
                <th>Region</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="optimization-rightsizing-empty">
                    <p className="optimization-rightsizing-empty__title">No idle recommendations found</p>
                    <p className="optimization-rightsizing-empty__text">Try changing filters or run idle sync again.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="optimization-idle-tag optimization-idle-tag--type">
                        {formatRecommendationType(item.recommendationType)}
                      </span>
                    </td>
                    <td>
                      <p className="optimization-idle-cell__primary">
                        {item.resourceName && item.resourceName !== item.resourceId
                          ? item.resourceName
                          : item.resourceType ?? "Resource"}
                      </p>
                      <p className="optimization-idle-cell__secondary">id: {item.resourceId}</p>
                    </td>
                    <td>
                      <span className="optimization-idle-tag">{toTitleCase(item.idleReason)}</span>
                    </td>
                    <td className="optimization-idle-cell__observation">{item.idleObservationValue ?? "N/A"}</td>
                    <td className="optimization-rightsizing-cell__mono">{compactCurrencyFormatter.format(item.currentMonthlyCost)}</td>
                    <td className="optimization-rightsizing-cell__mono optimization-rightsizing-cell__saving">
                      {compactCurrencyFormatter.format(item.estimatedMonthlySavings)}
                    </td>
                    <td className="optimization-rightsizing-cell__mono">{item.awsRegionCode}</td>
                    <td>
                      <span className="optimization-idle-tag optimization-idle-tag--status">{toTitleCase(item.status)}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="optimization-rightsizing-view-btn"
                        onClick={() => setSelectedRecommendationId(item.id)}
                      >
                        View
                      </button>
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

        {selectedRecommendationId ? (
          <section className="optimization-rightsizing-detail optimization-idle-detail--inside">
            <div className="optimization-rightsizing-detail__head">
              <p className="optimization-rightsizing-detail__title">Idle Recommendation Detail</p>
              <button
                type="button"
                className="optimization-rightsizing-view-btn"
                onClick={() => setSelectedRecommendationId(null)}
              >
                Close
              </button>
            </div>
            {detailQuery.isLoading ? <p>Loading idle recommendation detail...</p> : null}
            {detailQuery.isError ? <p>Failed to load idle recommendation detail: {detailQuery.error.message}</p> : null}
            {detailQuery.data ? (
              <div className="optimization-rightsizing-detail__grid">
                <p>
                  <strong>Type:</strong> {formatRecommendationType(detailQuery.data.recommendationType)}
                </p>
                <p>
                  <strong>Resource:</strong> {detailQuery.data.resourceId}
                  {detailQuery.data.resourceName ? ` / ${detailQuery.data.resourceName}` : ""}
                </p>
                <p>
                  <strong>Resource Kind:</strong> {detailQuery.data.resourceType ?? "N/A"}
                </p>
                <p>
                  <strong>Idle Reason:</strong> {toTitleCase(detailQuery.data.idleReason)}
                </p>
                <p>
                  <strong>Current Cost:</strong> {compactCurrencyFormatter.format(detailQuery.data.currentMonthlyCost)}
                </p>
                <p>
                  <strong>Est. Savings:</strong> {compactCurrencyFormatter.format(detailQuery.data.estimatedMonthlySavings)}
                </p>
                <p>
                  <strong>Projected Cost:</strong> {compactCurrencyFormatter.format(detailQuery.data.projectedMonthlyCost)}
                </p>
                <p>
                  <strong>Last Observed:</strong>{" "}
                  {detailQuery.data.observationEnd ? new Date(detailQuery.data.observationEnd).toLocaleString() : "N/A"}
                </p>
                <p className="optimization-rightsizing-detail__full">
                  <strong>Observation:</strong>{" "}
                  {detailQuery.data.idleObservationValue ??
                    detailQuery.data.recommendationText ??
                    "No observation text available."}
                </p>
              </div>
            ) : null}
          </section>
        ) : null}
      </section>
    </section>
  );
}
