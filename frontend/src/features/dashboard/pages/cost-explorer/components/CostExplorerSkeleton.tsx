import type { ReactNode } from "react";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`cost-explorer-skeleton__block ${className}`.trim()} aria-hidden="true" />;
}

function SkeletonCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`cost-explorer-skeleton__card ${className}`.trim()}>{children}</section>;
}

export function CostExplorerSkeleton() {
  return (
    <div className="cost-explorer-skeleton" aria-label="Loading cost explorer">
      <section className="cost-explorer-skeleton__header-strip" aria-hidden="true">
        <SkeletonBlock className="h-5 w-56" />
        <SkeletonBlock className="h-8 w-56" />
      </section>

      <SkeletonCard className="cost-explorer-filter-card">
        <section className="cost-explorer-control-surface">
          <div className="cost-explorer-toolbar-row">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`ce-filter-${index}`} className="cost-explorer-toolbar-item">
                <SkeletonBlock className="h-3 w-16 mb-2" />
                <SkeletonBlock className="h-[30px] w-full" />
              </div>
            ))}
          </div>
          <div className="cost-explorer-skeleton__chip-row">
            <SkeletonBlock className="h-7 w-40 rounded-full" />
            <SkeletonBlock className="h-7 w-36 rounded-full" />
            <SkeletonBlock className="h-7 w-44 rounded-full" />
            <SkeletonBlock className="h-7 w-32 rounded-full" />
            <SkeletonBlock className="h-7 w-24 rounded-full cost-explorer-skeleton__chip-clear" />
          </div>
        </section>
      </SkeletonCard>

      <section className="cost-explorer-kpi-surface cost-explorer-skeleton__kpis">
        <div className="cost-explorer-chart-insights">
          {Array.from({ length: 3 }).map((_, index) => (
            <article key={`ce-kpi-${index}`} className="cost-explorer-insight-tile">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-5 w-24 mt-2" />
            </article>
          ))}
        </div>
      </section>

      <section className="cost-explorer-chart-panel">
        <div className="cost-explorer-chart-panel__header cost-explorer-skeleton__chart-header">
          <SkeletonBlock className="h-5 w-44" />
          <SkeletonBlock className="h-8 w-28 rounded-full" />
        </div>
        <div className="cost-explorer-chart-panel__body cost-explorer-skeleton__chart-body">
          <div className="cost-explorer-skeleton__legend-row">
            <SkeletonBlock className="h-4 w-24 rounded-full" />
            <SkeletonBlock className="h-4 w-28 rounded-full" />
            <SkeletonBlock className="h-4 w-20 rounded-full" />
          </div>
          <div className="cost-explorer-chart-stack">
            <div className="cost-explorer-chart-canvas cost-explorer-skeleton__chart-canvas">
              <SkeletonBlock className="h-[360px] w-full" />
            </div>
          </div>
        </div>
      </section>

      <section className="cost-explorer-table-panel">
        <div className="cost-explorer-breakdown-grid is-single">
          <div className="cost-explorer-breakdown-block">
            <div className="cost-explorer-breakdown-block__head cost-explorer-skeleton__table-head">
              <SkeletonBlock className="h-4 w-44" />
            </div>
            <div className="cost-explorer-breakdown-table-wrap cost-explorer-skeleton__table-wrap">
              <div className="cost-explorer-skeleton__table-header-row">
                {Array.from({ length: 8 }).map((_, index) => (
                  <SkeletonBlock key={`ce-th-${index}`} className="h-4 w-full" />
                ))}
              </div>
              <div className="cost-explorer-skeleton__table-body">
                {Array.from({ length: 9 }).map((_, rowIndex) => (
                  <div key={`ce-row-${rowIndex}`} className="cost-explorer-skeleton__table-row">
                    {Array.from({ length: 8 }).map((_, cellIndex) => (
                      <SkeletonBlock key={`ce-cell-${rowIndex}-${cellIndex}`} className="h-4 w-full" />
                    ))}
                  </div>
                ))}
              </div>
              <div className="cost-explorer-skeleton__table-pagination">
                <SkeletonBlock className="h-5 w-36" />
                <div className="cost-explorer-skeleton__table-pagination-right">
                  <SkeletonBlock className="h-7 w-24 rounded-full" />
                  <SkeletonBlock className="h-5 w-32" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
