import type { DashboardOverviewResponse } from "../../../api/dashboardApi";
import { MetricBadge } from "../../../common/components";
import { getStatusTone, percentFormatter, toSeverityTone } from "../utils/overviewFormatters";

type OverviewInsightStripProps = {
  data: DashboardOverviewResponse;
};

export function OverviewInsightStrip({ data }: OverviewInsightStripProps) {
  return (
    <section className="overview-insight-strip">
      <MetricBadge tone={toSeverityTone(data.kpis.highSeverityAnomalyCount > 0 ? "high" : "low")}>
        High severity anomalies: {data.kpis.highSeverityAnomalyCount}
      </MetricBadge>
      <MetricBadge tone={getStatusTone(data.kpis.activeAlerts > 0 ? "open" : "resolved")}>
        Active alerts: {data.kpis.activeAlerts}
      </MetricBadge>
      <MetricBadge tone="accent">Savings posture: {percentFormatter.format(data.savingsInsights.savingsPct)}%</MetricBadge>
    </section>
  );
}
