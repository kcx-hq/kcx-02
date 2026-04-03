import { KpiCard } from "../../../common/components";
import type { DashboardOverviewResponse } from "../../../api/dashboardApi";
import { currencyFormatterCompact, currencyFormatterPrecise, percentFormatter } from "../utils/overviewFormatters";

type OverviewKpiSectionProps = {
  data: DashboardOverviewResponse;
};

export function OverviewKpiSection({ data }: OverviewKpiSectionProps) {
  return (
    <section className="overview-kpi-strip overview-kpi-board">
      <div className="overview-kpi-row overview-kpi-row--report">
        <KpiCard
          label="Total Spend"
          value={currencyFormatterPrecise.format(data.kpis.totalSpend)}
          delta={`${percentFormatter.format(
            data.kpis.previousPeriodSpend > 0
              ? ((data.kpis.totalSpend - data.kpis.previousPeriodSpend) / data.kpis.previousPeriodSpend) * 100
              : 0,
          )}% vs previous`}
          deltaTone={data.kpis.totalSpend > data.kpis.previousPeriodSpend ? "negative" : "positive"}
          meta="Current billing period"
        />
        <KpiCard
          label="Previous Period Spend"
          value={currencyFormatterPrecise.format(data.kpis.previousPeriodSpend)}
          delta="Baseline window"
          deltaTone="neutral"
          meta="Equivalent prior range"
        />
        <KpiCard
          label="Savings Achieved"
          value={currencyFormatterPrecise.format(data.kpis.savingsAchieved)}
          delta={`${percentFormatter.format(data.savingsInsights.savingsPct)}% savings`}
          deltaTone="positive"
          meta="List cost vs effective cost"
        />
        <KpiCard
          label="Top Region"
          value={data.kpis.topRegion?.name ?? "N/A"}
          delta={data.kpis.topRegion ? `${percentFormatter.format(data.kpis.topRegion.contributionPct)}% share` : "No data"}
          deltaTone="accent"
          meta={data.kpis.topRegion ? currencyFormatterCompact.format(data.kpis.topRegion.billedCost) : "No spend"}
        />
        <KpiCard
          label="Top Account"
          value={data.kpis.topAccount?.name ?? "N/A"}
          delta={data.kpis.topAccount ? `${percentFormatter.format(data.kpis.topAccount.contributionPct)}% share` : "No data"}
          deltaTone="accent"
          meta={data.kpis.topAccount ? currencyFormatterCompact.format(data.kpis.topAccount.billedCost) : "No spend"}
        />
        <KpiCard
          label="Active Alerts"
          value={String(data.kpis.activeAlerts)}
          delta={`${data.kpis.highSeverityAnomalyCount} high severity`}
          deltaTone={data.kpis.highSeverityAnomalyCount > 0 ? "negative" : "positive"}
          meta="Open anomalies + recommendations"
        />
      </div>
    </section>
  );
}
