import { memo } from "react";

export const CostFilterSkeleton = memo(function CostFilterSkeleton() {
  return (
    <section className="cost-explorer-control-surface s3-overview-filter-panel s3-overview-filter-panel--loading" aria-hidden="true">
      <div className="s3-overview-filter-skeleton__row">
        {Array.from({ length: 4 }).map((_, index) => (
          <span key={`cost-filter-control-${index}`} className="s3-overview-filter-skeleton__control" />
        ))}
      </div>
      <div className="s3-overview-filter-skeleton__chips">
        {Array.from({ length: 4 }).map((_, index) => (
          <span key={`cost-filter-chip-${index}`} className="s3-overview-filter-skeleton__chip" />
        ))}
        <span className="s3-overview-filter-skeleton__chip s3-overview-filter-skeleton__chip--clear" />
      </div>
    </section>
  );
});

export const CostKpiSkeleton = memo(function CostKpiSkeleton() {
  return (
    <section className="cost-explorer-kpi-surface s3-overview-kpi-surface" aria-hidden="true">
      <div className="cost-explorer-chart-insights s3-overview-kpi-row s3-cost-explorer-skeleton__kpi-row">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={`cost-kpi-skeleton-${index}`} className="cost-explorer-insight-tile s3-overview-kpi-tile s3-cost-explorer-skeleton__kpi-tile">
            <span className="s3-cost-explorer-skeleton__line s3-cost-explorer-skeleton__line--label" />
            <span className="s3-cost-explorer-skeleton__line s3-cost-explorer-skeleton__line--value" />
          </article>
        ))}
      </div>
    </section>
  );
});

export const CostChartSkeleton = memo(function CostChartSkeleton() {
  return (
    <section className="cost-explorer-chart-panel s3-overview-chart-panel" aria-hidden="true">
      <div className="cost-explorer-chart-panel__header s3-cost-explorer-skeleton__chart-header">
        <span className="s3-cost-explorer-skeleton__line s3-cost-explorer-skeleton__line--title" />
        <span className="s3-cost-explorer-skeleton__line s3-cost-explorer-skeleton__line--chip" />
      </div>
      <div className="cost-explorer-chart-panel__body s3-cost-explorer-skeleton__chart-body">
        <div className="s3-cost-explorer-skeleton__legend">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={`cost-chart-legend-${index}`} className="s3-cost-explorer-skeleton__line s3-cost-explorer-skeleton__line--legend" />
          ))}
        </div>
        <div className="cost-explorer-chart-skeleton cost-explorer-chart-skeleton--bars s3-cost-explorer-skeleton__chart-canvas" />
      </div>
    </section>
  );
});

export const CostTableSkeleton = memo(function CostTableSkeleton() {
  return (
    <section className="s3-overview-table-panel s3-overview-table-panel--cost" aria-hidden="true">
      <div className="s3-cost-explorer-skeleton__table-wrap">
        <div className="s3-cost-explorer-skeleton__table-top">
          <span className="s3-cost-explorer-skeleton__line s3-cost-explorer-skeleton__line--top" />
        </div>
        <div className="s3-cost-explorer-skeleton__table-header">
          {Array.from({ length: 8 }).map((_, index) => (
            <span key={`cost-table-head-${index}`} className="s3-cost-explorer-skeleton__line s3-cost-explorer-skeleton__line--th" />
          ))}
        </div>
        <div className="s3-cost-explorer-skeleton__table-body">
          {Array.from({ length: 9 }).map((_, rowIndex) => (
            <div key={`cost-table-row-${rowIndex}`} className="s3-cost-explorer-skeleton__table-row">
              {Array.from({ length: 8 }).map((_, cellIndex) => (
                <span key={`cost-table-row-${rowIndex}-cell-${cellIndex}`} className="s3-cost-explorer-skeleton__line s3-cost-explorer-skeleton__line--td" />
              ))}
            </div>
          ))}
        </div>
        <div className="s3-cost-explorer-skeleton__table-scroll" />
        <div className="s3-cost-explorer-skeleton__pagination">
          <span className="s3-cost-explorer-skeleton__line s3-cost-explorer-skeleton__line--pagination-sm" />
          <span className="s3-cost-explorer-skeleton__line s3-cost-explorer-skeleton__line--pagination-md" />
          <span className="s3-cost-explorer-skeleton__line s3-cost-explorer-skeleton__line--pagination-sm" />
        </div>
      </div>
    </section>
  );
});

type CostExplorerSkeletonProps = {
  showFilter?: boolean;
};

export const CostExplorerSkeleton = memo(function CostExplorerSkeleton({ showFilter = false }: CostExplorerSkeletonProps) {
  return (
    <div className="s3-cost-explorer-skeleton" aria-label="Loading S3 cost explorer data">
      {showFilter ? <CostFilterSkeleton /> : null}
      <CostKpiSkeleton />
      <CostChartSkeleton />
      <CostTableSkeleton />
    </div>
  );
});
