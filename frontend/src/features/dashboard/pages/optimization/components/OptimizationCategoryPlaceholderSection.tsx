import { compactCurrencyFormatter } from "../optimization.constants";

type OptimizationCategoryPlaceholderSectionProps = {
  categoryLabel: string;
};

export function OptimizationCategoryPlaceholderSection({ categoryLabel }: OptimizationCategoryPlaceholderSectionProps) {
  return (
    <div className="optimization-rightsizing-shell">
      <section className="optimization-rightsizing-kpis-bar">
        <article className="optimization-rightsizing-kpi-inline">
          <p className="optimization-rightsizing-kpi__label">Potential Savings / Month</p>
          <p className="optimization-rightsizing-kpi__value">{compactCurrencyFormatter.format(0)}</p>
        </article>
        <article className="optimization-rightsizing-kpi-inline">
          <p className="optimization-rightsizing-kpi__label">Open Recommendations</p>
          <p className="optimization-rightsizing-kpi__value">0</p>
        </article>
        <article className="optimization-rightsizing-kpi-inline">
          <p className="optimization-rightsizing-kpi__label">High Impact</p>
          <p className="optimization-rightsizing-kpi__value">0</p>
        </article>
        <article className="optimization-rightsizing-kpi-inline">
          <p className="optimization-rightsizing-kpi__label">Risk Mix</p>
          <p className="optimization-rightsizing-kpi__value">0</p>
        </article>
      </section>

      <section className="optimization-rightsizing-panel">
        <div className="optimization-rightsizing-filters">
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Status</p>
            <select className="optimization-rightsizing-filter-control" defaultValue="all" disabled>
              <option value="all">All status</option>
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Effort</p>
            <select className="optimization-rightsizing-filter-control" defaultValue="all" disabled>
              <option value="all">All effort</option>
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Risk</p>
            <select className="optimization-rightsizing-filter-control" defaultValue="all" disabled>
              <option value="all">All risk</option>
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Account</p>
            <select className="optimization-rightsizing-filter-control" defaultValue="all" disabled>
              <option value="all">All accounts</option>
            </select>
          </div>
          <div className="optimization-rightsizing-filter-field">
            <p className="optimization-rightsizing-filter-label">Region</p>
            <select className="optimization-rightsizing-filter-control" defaultValue="all" disabled>
              <option value="all">All regions</option>
            </select>
          </div>
        </div>

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
              <tr>
                <td colSpan={10} className="optimization-rightsizing-empty">
                  <p className="optimization-rightsizing-empty__title">No recommendations found</p>
                  <p className="optimization-rightsizing-empty__text">No {categoryLabel.toLowerCase()} recommendations available yet.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="optimization-rightsizing-pagination">
          <p className="optimization-rightsizing-pagination__info">Page 1 of 1</p>
          <div className="optimization-rightsizing-pagination__actions">
            <button type="button" className="optimization-rightsizing-view-btn" disabled>
              Previous
            </button>
            <button type="button" className="optimization-rightsizing-view-btn" disabled>
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
