import { memo } from "react";

const KPI_PLACEHOLDERS = new Array(6).fill(null);
const TABLE_ROWS = new Array(7).fill(null);
const CHART_BARS = [58, 72, 64, 78, 68, 74, 62, 76, 66, 73, 69, 77, 63, 71, 67, 75, 65, 79, 61, 70];

export const EC2ExplorerUnifiedSkeleton = memo(function EC2ExplorerUnifiedSkeleton() {
  return (
    <div className="ec2-unified-skeleton" aria-hidden="true">
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
          <span className="ec2-unified-skeleton__chip" />
          <span className="ec2-unified-skeleton__chip" />
          <span className="ec2-unified-skeleton__chip" />
          <span className="ec2-unified-skeleton__clear" />
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
        <div className="ec2-unified-skeleton__chart-title" />
        <div className="ec2-unified-skeleton__legend">
          <span className="ec2-unified-skeleton__legend-pill" />
          <span className="ec2-unified-skeleton__legend-pill" />
          <span className="ec2-unified-skeleton__legend-pill" />
          <span className="ec2-unified-skeleton__legend-pill" />
          <span className="ec2-unified-skeleton__legend-pill" />
        </div>
        <div className="ec2-unified-skeleton__plot">
          {CHART_BARS.map((height, idx) => (
            <span key={idx} className="ec2-unified-skeleton__bar" style={{ height: `${height}%` }} />
          ))}
        </div>
        <div className="ec2-unified-skeleton__axis">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
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

