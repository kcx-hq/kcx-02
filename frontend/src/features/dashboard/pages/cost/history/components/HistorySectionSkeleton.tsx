type SkeletonBlockProps = {
  className?: string;
};

function SkeletonBlock({ className = "" }: SkeletonBlockProps) {
  return <span className={`cost-explorer-skeleton__block history-section-skeleton__block ${className}`.trim()} aria-hidden="true" />;
}

export function HistorySectionSkeleton() {
  return (
    <div className="history-section-skeleton" aria-label="Loading cost history section">
      <section className="history-section-skeleton__filter-card">
        <div className="history-section-skeleton__filters-grid">
          {[
            "GRANULARITY",
            "GROUP BY",
            "X-AXIS",
            "Y-AXIS",
          ].map((label) => (
            <div key={label} className="history-section-skeleton__filter-col">
              <SkeletonBlock className="history-section-skeleton__filter-label" />
              <SkeletonBlock className="history-section-skeleton__filter-value" />
              <SkeletonBlock className="history-section-skeleton__filter-divider" />
            </div>
          ))}
        </div>

        <div className="history-section-skeleton__chip-bar">
          <div className="history-section-skeleton__chip-row">
            <SkeletonBlock className="history-section-skeleton__chip history-section-skeleton__chip--lg" />
            <SkeletonBlock className="history-section-skeleton__chip history-section-skeleton__chip--md" />
            <SkeletonBlock className="history-section-skeleton__chip history-section-skeleton__chip--md2" />
            <SkeletonBlock className="history-section-skeleton__chip history-section-skeleton__chip--lg2" />
          </div>
          <SkeletonBlock className="history-section-skeleton__clear-all" />
        </div>
      </section>

      <section className="history-section-skeleton__chart-card">
        <header className="history-section-skeleton__chart-head">
          <SkeletonBlock className="history-section-skeleton__chart-title" />
          <SkeletonBlock className="history-section-skeleton__chart-dropdown" />
        </header>

        <div className="history-section-skeleton__plot-wrap">
          <div className="history-section-skeleton__legend">
            <SkeletonBlock className="history-section-skeleton__legend-pill" />
            <SkeletonBlock className="history-section-skeleton__legend-pill" />
            <SkeletonBlock className="history-section-skeleton__legend-pill" />
            <SkeletonBlock className="history-section-skeleton__legend-pill" />
            <SkeletonBlock className="history-section-skeleton__legend-pill" />
            <SkeletonBlock className="history-section-skeleton__legend-pill" />
          </div>
          <div className="cost-explorer-chart-stack">
            <div className="cost-explorer-chart-canvas cost-explorer-chart-canvas--plain history-section-skeleton__chart-canvas">
              <div className="cost-explorer-chart-skeleton cost-explorer-chart-skeleton--bars" style={{ minHeight: "420px" }} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
