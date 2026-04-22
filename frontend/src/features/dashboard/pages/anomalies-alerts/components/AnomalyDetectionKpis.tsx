import { Info } from "lucide-react";

type KpiCardProps = {
  title: string;
  value: string;
  subtitle?: string;
};

function KpiCard({ title, value, subtitle }: KpiCardProps) {
  return (
    <article className="anomaly-ref-kpi-card">
      <p className="anomaly-ref-kpi-card__title">
        {title} <span>(Last 7 days)</span> <Info size={13} />
      </p>
      <p className="anomaly-ref-kpi-card__value">{value}</p>
      {subtitle ? <p className="anomaly-ref-kpi-card__subtitle">{subtitle}</p> : null}
    </article>
  );
}

type AnomalyDetectionKpisProps = {
  anomalyCount: number;
  totalCostImpact: string;
  totalCost: string;
  impactPercent: string;
};

export function AnomalyDetectionKpis({
  anomalyCount,
  totalCostImpact,
  totalCost,
  impactPercent,
}: AnomalyDetectionKpisProps) {
  return (
    <section className="anomaly-ref-kpis" aria-label="Anomaly summary cards">
      <KpiCard title="Anomalies" value={String(anomalyCount)} />
      <KpiCard title="Total Cost Impact" value={totalCostImpact} />
      <KpiCard title="Total Cost" value={totalCost} subtitle={`Including ${impactPercent} of Cost Impact`} />
    </section>
  );
}
