import type { DatabaseAssetDetail } from "../../../api/dashboardTypes";
import { KpiCard, WidgetShell } from "../../../common/components";
import {
  DETAIL_EMPTY_NOTE,
  formatCurrency,
  getResourceFootprint,
} from "./database-asset-detail.formatters";

type DatabaseAssetDetailSummaryProps = {
  detail: DatabaseAssetDetail;
};

export function DatabaseAssetDetailSummary({ detail }: DatabaseAssetDetailSummaryProps) {
  const readiness = detail.optimizationReadiness;
  const hasPrimaryCostDriver = Boolean(detail.costSummary.primaryCostDriver && detail.costSummary.primaryCostDriver.trim().length > 0);

  return (
    <div className="database-asset-detail__stack">
      <section className="database-asset-detail__summary-grid">
        <KpiCard label="Total Cost" value={formatCurrency(detail.costSummary.totalCost)} />
        <KpiCard label="Daily Avg Cost" value={formatCurrency(detail.costSummary.dailyAverageCost)} />
        {hasPrimaryCostDriver ? <KpiCard label="Primary Cost Driver" value={detail.costSummary.primaryCostDriver ?? DETAIL_EMPTY_NOTE} /> : null}
        <KpiCard
          label="Resource Footprint"
          value={getResourceFootprint({
            allocatedStorageGb: detail.storageSummary.allocatedStorageGb,
            dataFootprintGb: detail.storageSummary.dataFootprintGb,
            instanceClass: detail.identity.instanceClass,
            resourceType: detail.identity.resourceType,
          })}
        />
      </section>

      <WidgetShell title="Recommendations" subtitle="Current recommendation posture for this resource">
        <p className="dashboard-note">
          {readiness.recommendationCount > 0
            ? `${readiness.recommendationCount} open recommendation(s) available for this resource.`
            : "No open recommendations for this resource in the selected range."}
        </p>
      </WidgetShell>
    </div>
  );
}
