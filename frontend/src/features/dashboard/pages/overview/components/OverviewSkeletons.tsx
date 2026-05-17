function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`overview-skeleton__block ${className}`.trim()} aria-hidden="true" />;
}

export function OverviewDashboardSkeleton() {
  return (
    <div className="overview-skeleton" aria-label="Loading overview dashboard">
      <section className="overview-kpi-strip overview-kpi-board">
        <div className="overview-kpi-row overview-kpi-row--report">
          {Array.from({ length: 6 }).map((_, idx) => (
            <article key={`kpi-skeleton-${idx}`} className="dashboard-kpi-card">
              <SkeletonBlock className="h-3 w-24 mb-3" />
              <SkeletonBlock className="h-8 w-36 mb-3" />
              <SkeletonBlock className="h-3 w-28" />
            </article>
          ))}
        </div>
      </section>

      <section className="overview-plain-section">
        <div className="overview-trend-unified">
          <div className="overview-trend-unified__header">
            <SkeletonBlock className="h-6 w-64" />
            <SkeletonBlock className="h-5 w-40" />
          </div>
          <div className="overview-trend-unified__body">
            <div className="overview-trend-pane overview-trend-pane--chart">
              <div className="overview-skeleton__chart">
                <SkeletonBlock className="h-full w-full" />
              </div>
            </div>
            <div className="overview-trend-pane overview-trend-pane--threat">
              <div className="overview-skeleton__threat-list">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`threat-skeleton-${idx}`} className="overview-skeleton__threat-row">
                    <SkeletonBlock className="h-4 w-24" />
                    <SkeletonBlock className="h-8 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overview-breakdown-modern">
        {Array.from({ length: 3 }).map((_, idx) => (
          <article key={`breakdown-skeleton-${idx}`} className="overview-breakdown-panel">
            <SkeletonBlock className="h-6 w-40 mb-3" />
            <div className="overview-breakdown-donut">
              <SkeletonBlock className="h-[260px] w-full" />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export function OverviewErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="overview-state-card" role="alert">
      <h2 className="overview-state-card__title">Unable to load overview dashboard</h2>
      <p className="overview-state-card__message">{message}</p>
      <button type="button" className="overview-state-card__action" onClick={onRetry}>
        Retry
      </button>
    </section>
  );
}

export function OverviewEmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="overview-state-card">
      <div className="overview-empty-illustration" aria-hidden="true" />
      <h2 className="overview-state-card__title">No dashboard data available for selected filters</h2>
      <p className="overview-state-card__message">Try adjusting date range or scope filters, then refresh the dashboard.</p>
      <button type="button" className="overview-state-card__action" onClick={onRetry}>
        Retry
      </button>
    </section>
  );
}
