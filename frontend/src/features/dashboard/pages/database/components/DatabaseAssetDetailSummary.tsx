import type { DatabaseAssetDetail } from "../../../api/dashboardTypes";
import { KpiCard, WidgetShell } from "../../../common/components";
import {
  DETAIL_EMPTY_NOTE,
  formatCurrency,
  formatNumber,
  formatPercent,
  getActivitySignal,
  getResourceFootprint,
  toTitleCase,
} from "./database-asset-detail.formatters";

type DatabaseAssetDetailSummaryProps = {
  detail: DatabaseAssetDetail;
};

export function DatabaseAssetDetailSummary({ detail }: DatabaseAssetDetailSummaryProps) {
  const readiness = detail.optimizationReadiness;

  return (
    <div className="database-asset-detail__stack">
      <section className="database-asset-detail__summary-grid">
        <KpiCard label="Total Cost" value={formatCurrency(detail.costSummary.totalCost)} />
        <KpiCard label="Daily Avg Cost" value={formatCurrency(detail.costSummary.dailyAverageCost)} />
        <KpiCard label="Primary Cost Driver" value={detail.costSummary.primaryCostDriver ?? DETAIL_EMPTY_NOTE} />
        <KpiCard
          label="Activity Signal"
          value={getActivitySignal({
            avgLoad: detail.usageSummary.avgLoad,
            avgCpu: detail.usageSummary.avgCpu,
            avgConnections: detail.usageSummary.avgConnections,
            requestCount: detail.usageSummary.requestCount,
          })}
        />
        <KpiCard
          label="Resource Footprint"
          value={getResourceFootprint({
            allocatedStorageGb: detail.storageSummary.allocatedStorageGb,
            dataFootprintGb: detail.storageSummary.dataFootprintGb,
            instanceClass: detail.identity.instanceClass,
            resourceType: detail.identity.resourceType,
          })}
        />
        <KpiCard
          label="Signal Completeness"
          value={formatPercent(readiness.signalCompleteness)}
          meta={`Confidence ${toTitleCase(readiness.confidenceLabel)}`}
        />
      </section>

      <WidgetShell title="Optimization Readiness" subtitle="Readiness for future recommendation workflows">
        <div className="database-asset-detail__mini-kpis">
          <div className="database-asset-detail__mini-kpi">
            <span>Open Recommendations</span>
            <strong>{formatNumber(readiness.recommendationCount)}</strong>
          </div>
          <div className="database-asset-detail__mini-kpi">
            <span>Signal Completeness</span>
            <strong>{formatPercent(readiness.signalCompleteness)}</strong>
          </div>
          <div className="database-asset-detail__mini-kpi">
            <span>Confidence</span>
            <strong>{toTitleCase(readiness.confidenceLabel)}</strong>
          </div>
        </div>
        {readiness.notes.length > 0 ? (
          <div className="database-asset-detail__notes">
            {readiness.notes.map((note) => (
              <p key={note} className="dashboard-note">
                {note}
              </p>
            ))}
          </div>
        ) : (
          <p className="dashboard-note">Signals are present for core cost, usage, storage, and performance views.</p>
        )}
      </WidgetShell>
    </div>
  );
}
