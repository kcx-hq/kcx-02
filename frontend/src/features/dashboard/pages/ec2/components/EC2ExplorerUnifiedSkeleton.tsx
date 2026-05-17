import { memo } from "react";

const KPI_PLACEHOLDERS = new Array(6).fill(null);
const TABLE_ROWS = new Array(8).fill(null);

export const EC2ExplorerUnifiedSkeleton = memo(function EC2ExplorerUnifiedSkeleton() {
  return (
    <div className="ec2-unified-skeleton" aria-hidden="true">
      <section className="ec2-unified-skeleton__panel ec2-unified-skeleton__tabs">
        <div className="ec2-unified-skeleton__tab-row">
          <span className="ec2-unified-skeleton__chip ec2-unified-skeleton__chip--tab" />
          <span className="ec2-unified-skeleton__chip ec2-unified-skeleton__chip--tab" />
          <span className="ec2-unified-skeleton__chip ec2-unified-skeleton__chip--tab" />
          <span className="ec2-unified-skeleton__chip ec2-unified-skeleton__chip--tab" />
          <span className="ec2-unified-skeleton__chip ec2-unified-skeleton__chip--tab" />
        </div>
      </section>

      <section className="ec2-unified-skeleton__panel ec2-unified-skeleton__filters">
        <div className="ec2-unified-skeleton__filter-grid">
          <div className="ec2-unified-skeleton__field">
            <span className="ec2-unified-skeleton__line ec2-unified-skeleton__line--label" />
            <span className="ec2-unified-skeleton__line ec2-unified-skeleton__line--value" />
          </div>
          <div className="ec2-unified-skeleton__field">
            <span className="ec2-unified-skeleton__line ec2-unified-skeleton__line--label" />
            <span className="ec2-unified-skeleton__line ec2-unified-skeleton__line--value" />
          </div>
          <div className="ec2-unified-skeleton__field">
            <span className="ec2-unified-skeleton__line ec2-unified-skeleton__line--label" />
            <span className="ec2-unified-skeleton__line ec2-unified-skeleton__line--value" />
          </div>
          <div className="ec2-unified-skeleton__field">
            <span className="ec2-unified-skeleton__line ec2-unified-skeleton__line--label" />
            <span className="ec2-unified-skeleton__line ec2-unified-skeleton__line--value" />
          </div>
        </div>
        <div className="ec2-unified-skeleton__chips">
          <span className="ec2-unified-skeleton__chip ec2-unified-skeleton__chip--filter" />
          <span className="ec2-unified-skeleton__chip ec2-unified-skeleton__chip--filter" />
          <span className="ec2-unified-skeleton__chip ec2-unified-skeleton__chip--filter" />
          <span className="ec2-unified-skeleton__chip ec2-unified-skeleton__chip--filter" />
          <span className="ec2-unified-skeleton__clear ec2-unified-skeleton__chip--filter" />
        </div>
      </section>

      <section className="ec2-unified-skeleton__panel ec2-unified-skeleton__kpis">
        {KPI_PLACEHOLDERS.map((_, idx) => (
          <div key={idx} className="ec2-unified-skeleton__kpi">
            <span className="ec2-unified-skeleton__line ec2-unified-skeleton__line--kpi-label" />
            <span className="ec2-unified-skeleton__line ec2-unified-skeleton__line--kpi-value" />
          </div>
        ))}
      </section>

      <section className="ec2-unified-skeleton__panel ec2-unified-skeleton__chart">
        <div className="ec2-unified-skeleton__chart-head">
          <div className="ec2-unified-skeleton__chart-title" />
          <div className="ec2-unified-skeleton__chart-dropdown" />
        </div>
        <div className="ec2-unified-skeleton__plot-wrap">
          <div className="ec2-unified-skeleton__legend">
            <span className="ec2-unified-skeleton__legend-pill" />
            <span className="ec2-unified-skeleton__legend-pill" />
            <span className="ec2-unified-skeleton__legend-pill" />
            <span className="ec2-unified-skeleton__legend-pill" />
            <span className="ec2-unified-skeleton__legend-pill" />
          </div>
          <div className="cost-explorer-chart-stack">
            <div className="cost-explorer-chart-canvas cost-explorer-chart-canvas--plain ec2-unified-skeleton__chart-canvas">
              <div className="cost-explorer-chart-skeleton cost-explorer-chart-skeleton--bars ec2-unified-skeleton__history-graph" />
            </div>
          </div>
        </div>
      </section>

      <section className="ec2-unified-skeleton__panel ec2-unified-skeleton__table">
        <div className="ec2-unified-skeleton__table-head">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="ec2-unified-skeleton__table-body">
          {TABLE_ROWS.map((_, idx) => (
            <div key={idx} className="ec2-unified-skeleton__table-row">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
        <div className="ec2-unified-skeleton__pagination">
          <span />
          <span />
          <span />
        </div>
      </section>
    </div>
  );
});
