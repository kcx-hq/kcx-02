import { useMemo, useState } from "react";
import {
  useOptimizationCommitmentOverviewQuery,
  useOptimizationCommitmentRecommendationDetailQuery,
  useOptimizationCommitmentRecommendationsQuery,
} from "../../../hooks/useDashboardQueries";
import { compactCurrencyFormatter } from "../optimization.constants";

const PAGE_SIZE = 10;

const plainNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
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

export function OptimizationCommitmentSection() {
  const [status, setStatus] = useState<string>("all");
  const [term, setTerm] = useState<string>("all");
  const [payment, setPayment] = useState<string>("all");
  const [planType, setPlanType] = useState<string>("all");
  const [region, setRegion] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);

  const overviewQuery = useOptimizationCommitmentOverviewQuery();
  const recommendationsQuery = useOptimizationCommitmentRecommendationsQuery({
    status: status !== "all" ? [status] : undefined,
    region: region !== "all" ? [region] : undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const detailQuery = useOptimizationCommitmentRecommendationDetailQuery(selectedRecommendationId);

  const recommendationItems = recommendationsQuery.data?.items ?? [];
  const filteredItems = recommendationItems.filter((item) => {
    const termMatches = term === "all" || item.recommendedTerm === term;
    const paymentMatches = payment === "all" || item.recommendedPaymentOption === payment;
    const planMatches = planType === "all" || item.commitmentPlanType === planType;
    return termMatches && paymentMatches && planMatches;
  });

  const pagination = recommendationsQuery.data?.pagination;

  const filterOptions = useMemo(() => {
    const statusSet = new Set<string>();
    const termSet = new Set<string>();
    const paymentSet = new Set<string>();
    const planSet = new Set<string>();
    const regionSet = new Set<string>();

    recommendationItems.forEach((item) => {
      if (item.status) statusSet.add(item.status);
      if (item.recommendedTerm) termSet.add(item.recommendedTerm);
      if (item.recommendedPaymentOption) paymentSet.add(item.recommendedPaymentOption);
      if (item.commitmentPlanType) planSet.add(item.commitmentPlanType);
      if (item.awsRegionCode) regionSet.add(item.awsRegionCode);
    });

    return {
      status: Array.from(statusSet).sort(),
      term: Array.from(termSet).sort(),
      payment: Array.from(paymentSet).sort(),
      planType: Array.from(planSet).sort(),
      region: Array.from(regionSet).sort(),
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
    <section className="optimization-rightsizing-shell optimization-commitment-section">
      {overviewQuery.isLoading ? <p className="dashboard-note">Loading commitment overview...</p> : null}
      {overviewQuery.isError ? (
        <p className="dashboard-note">Failed to load commitment overview: {overviewQuery.error.message}</p>
      ) : null}

      <section className="optimization-rightsizing-panel">
        <section className="optimization-rightsizing-kpis-bar optimization-commitment-kpis-inline-row">
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
            <p className="optimization-rightsizing-kpi__label">Hourly Commitment</p>
            <p className="optimization-rightsizing-kpi__value">
              {decimalFormatter.format(overviewQuery.data?.recommendedHourlyCommitmentTotal ?? 0)}
            </p>
          </article>
          <article className="optimization-rightsizing-kpi-inline">
            <p className="optimization-rightsizing-kpi__label">Term Mix</p>
            <p className="optimization-rightsizing-kpi__value optimization-rightsizing-kpi__value--sm">
              {plainNumberFormatter.format(overviewQuery.data?.oneYearCount ?? 0)} 1Y / {" "}
              {plainNumberFormatter.format(overviewQuery.data?.threeYearCount ?? 0)} 3Y
            </p>
          </article>
        </section>

        <div className="optimization-rightsizing-filters optimization-commitment-filters">
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
            <p className="optimization-rightsizing-filter-label">Term</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={term}
              onChange={(event) => onFilterChange(setTerm, event.target.value)}
            >
              <option value="all">All terms</option>
              {filterOptions.term.map((option) => (
                <option key={option} value={option}>
                  {toTitleCase(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Payment</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={payment}
              onChange={(event) => onFilterChange(setPayment, event.target.value)}
            >
              <option value="all">All payment options</option>
              {filterOptions.payment.map((option) => (
                <option key={option} value={option}>
                  {toTitleCase(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Plan Type</p>
            <select
              className="optimization-rightsizing-filter-control"
              value={planType}
              onChange={(event) => onFilterChange(setPlanType, event.target.value)}
            >
              <option value="all">All plan types</option>
              {filterOptions.planType.map((option) => (
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

        {recommendationsQuery.isLoading ? <p className="dashboard-note">Loading commitment recommendations...</p> : null}
        {recommendationsQuery.isError ? (
          <p className="dashboard-note">Failed to load commitment recommendations: {recommendationsQuery.error.message}</p>
        ) : null}

        <div className="optimization-rightsizing-table-scroll">
          <table className="optimization-rightsizing-table optimization-commitment-table">
            <thead>
              <tr>
                <th>Recommendation</th>
                <th>Plan</th>
                <th>Term</th>
                <th>Payment</th>
                <th>Hr Commitment</th>
                <th>Current Cost</th>
                <th>Projected Cost</th>
                <th>Est. Savings</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="optimization-rightsizing-empty">
                    <p className="optimization-rightsizing-empty__title">No commitment recommendations found</p>
                    <p className="optimization-rightsizing-empty__text">Run commitment sync and try changing filters.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <p className="optimization-rightsizing-cell__primary">{item.recommendation}</p>
                    </td>
                    <td>{toTitleCase(item.commitmentPlanType)}</td>
                    <td>{toTitleCase(item.recommendedTerm)}</td>
                    <td>{toTitleCase(item.recommendedPaymentOption)}</td>
                    <td className="optimization-rightsizing-cell__mono">{decimalFormatter.format(item.recommendedHourlyCommitment)}</td>
                    <td className="optimization-rightsizing-cell__mono">{compactCurrencyFormatter.format(item.currentMonthlyCost)}</td>
                    <td className="optimization-rightsizing-cell__mono">{compactCurrencyFormatter.format(item.projectedMonthlyCost)}</td>
                    <td className="optimization-rightsizing-cell__mono optimization-rightsizing-cell__saving">
                      {compactCurrencyFormatter.format(item.estimatedMonthlySavings)}
                    </td>
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
              <p className="optimization-rightsizing-detail__title">Commitment Recommendation Detail</p>
              <button
                type="button"
                className="optimization-rightsizing-view-btn"
                onClick={() => setSelectedRecommendationId(null)}
              >
                Close
              </button>
            </div>
            {detailQuery.isLoading ? <p>Loading commitment recommendation detail...</p> : null}
            {detailQuery.isError ? <p>Failed to load commitment recommendation detail: {detailQuery.error.message}</p> : null}
            {detailQuery.data ? (
              <div className="optimization-rightsizing-detail__grid">
                <p>
                  <strong>Title:</strong> {detailQuery.data.recommendationTitle ?? detailQuery.data.recommendationType}
                </p>
                <p>
                  <strong>Type:</strong> {toTitleCase(detailQuery.data.commitmentPlanType)}
                </p>
                <p>
                  <strong>Term:</strong> {toTitleCase(detailQuery.data.recommendedTerm)}
                </p>
                <p>
                  <strong>Payment:</strong> {toTitleCase(detailQuery.data.recommendedPaymentOption)}
                </p>
                <p>
                  <strong>Hourly Commitment:</strong> {decimalFormatter.format(detailQuery.data.recommendedHourlyCommitment)}
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
      </section>
    </section>
  );
}
