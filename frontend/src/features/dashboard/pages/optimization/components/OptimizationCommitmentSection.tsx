import { useEffect, useMemo, useRef, useState } from "react";
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
  const [openFilter, setOpenFilter] = useState<"status" | "term" | "payment" | "planType" | "region" | null>(null);
  const filtersRef = useRef<HTMLDivElement | null>(null);

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
    setOpenFilter(null);
  };

  useEffect(() => {
    const onDocumentPointerDown = (event: MouseEvent) => {
      if (!filtersRef.current) return;
      if (filtersRef.current.contains(event.target as Node)) return;
      setOpenFilter(null);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenFilter(null);
    };

    document.addEventListener("mousedown", onDocumentPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onDocumentPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const statusLabel = status === "all" ? "All status" : toTitleCase(status);
  const termLabel = term === "all" ? "All terms" : toTitleCase(term);
  const paymentLabel = payment === "all" ? "All payment options" : toTitleCase(payment);
  const planTypeLabel = planType === "all" ? "All plan types" : toTitleCase(planType);
  const regionLabel = region === "all" ? "All regions" : region;

  useEffect(() => {
    if (!selectedRecommendationId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedRecommendationId(null);
    };

    document.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onEscape);
    };
  }, [selectedRecommendationId]);

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
              1Y: {plainNumberFormatter.format(overviewQuery.data?.oneYearCount ?? 0)} / 3Y:{" "}
              {plainNumberFormatter.format(overviewQuery.data?.threeYearCount ?? 0)}
            </p>
          </article>
        </section>

        <div className="optimization-rightsizing-filters optimization-commitment-filters" ref={filtersRef}>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Status</p>
            <button
              type="button"
              className={`optimization-rightsizing-filter-control optimization-rightsizing-filter-trigger${openFilter === "status" ? " is-open" : ""}`}
              onClick={() => setOpenFilter((current) => (current === "status" ? null : "status"))}
              aria-haspopup="listbox"
              aria-expanded={openFilter === "status"}
            >
              <span>{statusLabel}</span>
            </button>
            {openFilter === "status" ? (
              <div className="optimization-rightsizing-filter-menu" role="listbox" aria-label="Status">
                <button
                  type="button"
                  className={`optimization-rightsizing-filter-option${status === "all" ? " is-active" : ""}`}
                  onClick={() => onFilterChange(setStatus, "all")}
                >
                  All status
                </button>
                {filterOptions.status.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={`optimization-rightsizing-filter-option${status === option ? " is-active" : ""}`}
                    onClick={() => onFilterChange(setStatus, option)}
                  >
                    {toTitleCase(option)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Term</p>
            <button
              type="button"
              className={`optimization-rightsizing-filter-control optimization-rightsizing-filter-trigger${openFilter === "term" ? " is-open" : ""}`}
              onClick={() => setOpenFilter((current) => (current === "term" ? null : "term"))}
              aria-haspopup="listbox"
              aria-expanded={openFilter === "term"}
            >
              <span>{termLabel}</span>
            </button>
            {openFilter === "term" ? (
              <div className="optimization-rightsizing-filter-menu" role="listbox" aria-label="Term">
                <button
                  type="button"
                  className={`optimization-rightsizing-filter-option${term === "all" ? " is-active" : ""}`}
                  onClick={() => onFilterChange(setTerm, "all")}
                >
                  All terms
                </button>
                {filterOptions.term.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={`optimization-rightsizing-filter-option${term === option ? " is-active" : ""}`}
                    onClick={() => onFilterChange(setTerm, option)}
                  >
                    {toTitleCase(option)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Payment</p>
            <button
              type="button"
              className={`optimization-rightsizing-filter-control optimization-rightsizing-filter-trigger${openFilter === "payment" ? " is-open" : ""}`}
              onClick={() => setOpenFilter((current) => (current === "payment" ? null : "payment"))}
              aria-haspopup="listbox"
              aria-expanded={openFilter === "payment"}
            >
              <span>{paymentLabel}</span>
            </button>
            {openFilter === "payment" ? (
              <div className="optimization-rightsizing-filter-menu" role="listbox" aria-label="Payment">
                <button
                  type="button"
                  className={`optimization-rightsizing-filter-option${payment === "all" ? " is-active" : ""}`}
                  onClick={() => onFilterChange(setPayment, "all")}
                >
                  All payment options
                </button>
                {filterOptions.payment.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={`optimization-rightsizing-filter-option${payment === option ? " is-active" : ""}`}
                    onClick={() => onFilterChange(setPayment, option)}
                  >
                    {toTitleCase(option)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Plan Type</p>
            <button
              type="button"
              className={`optimization-rightsizing-filter-control optimization-rightsizing-filter-trigger${openFilter === "planType" ? " is-open" : ""}`}
              onClick={() => setOpenFilter((current) => (current === "planType" ? null : "planType"))}
              aria-haspopup="listbox"
              aria-expanded={openFilter === "planType"}
            >
              <span>{planTypeLabel}</span>
            </button>
            {openFilter === "planType" ? (
              <div className="optimization-rightsizing-filter-menu" role="listbox" aria-label="Plan Type">
                <button
                  type="button"
                  className={`optimization-rightsizing-filter-option${planType === "all" ? " is-active" : ""}`}
                  onClick={() => onFilterChange(setPlanType, "all")}
                >
                  All plan types
                </button>
                {filterOptions.planType.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={`optimization-rightsizing-filter-option${planType === option ? " is-active" : ""}`}
                    onClick={() => onFilterChange(setPlanType, option)}
                  >
                    {toTitleCase(option)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Region</p>
            <button
              type="button"
              className={`optimization-rightsizing-filter-control optimization-rightsizing-filter-trigger${openFilter === "region" ? " is-open" : ""}`}
              onClick={() => setOpenFilter((current) => (current === "region" ? null : "region"))}
              aria-haspopup="listbox"
              aria-expanded={openFilter === "region"}
            >
              <span>{regionLabel}</span>
            </button>
            {openFilter === "region" ? (
              <div className="optimization-rightsizing-filter-menu" role="listbox" aria-label="Region">
                <button
                  type="button"
                  className={`optimization-rightsizing-filter-option${region === "all" ? " is-active" : ""}`}
                  onClick={() => onFilterChange(setRegion, "all")}
                >
                  All regions
                </button>
                {filterOptions.region.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={`optimization-rightsizing-filter-option${region === option ? " is-active" : ""}`}
                    onClick={() => onFilterChange(setRegion, option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
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

      </section>

      {selectedRecommendationId ? (
        <>
          <button
            type="button"
            aria-label="Close commitment detail panel"
            className="optimization-commitment-detail-overlay"
            onClick={() => setSelectedRecommendationId(null)}
          />
          <aside className="optimization-commitment-detail-drawer" role="dialog" aria-modal="true" aria-label="Commitment recommendation detail">
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
          </aside>
        </>
      ) : null}
    </section>
  );
}
