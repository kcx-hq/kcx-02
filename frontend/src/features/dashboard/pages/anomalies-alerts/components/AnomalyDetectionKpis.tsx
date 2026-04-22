import { Info } from "lucide-react";

type KpiCardProps = {
  title: string;
  subtitle?: string;
};

function KpiCard({ title, subtitle }: KpiCardProps) {
  return (
    <article className="anomaly-ref-kpi-card">
      <p className="anomaly-ref-kpi-card__title">
        {title} <span>(Last 7 days)</span> <Info size={13} />
      </p>
      <p className="anomaly-ref-kpi-card__value">--</p>
      {subtitle ? <p className="anomaly-ref-kpi-card__subtitle">{subtitle}</p> : null}
    </article>
  );
}

export function AnomalyDetectionKpis() {
  return (
    <section className="anomaly-ref-kpis" aria-label="Anomaly summary cards">
      <KpiCard title="Anomalies" />
      <KpiCard title="Total Cost Impact" />
      <KpiCard title="Total Cost" subtitle="Including --.--% of Cost Impact" />
    </section>
  );
}
