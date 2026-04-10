import { MetricBadge } from "./MetricBadge";

type KpiCardTone = "positive" | "negative" | "neutral" | "accent";

type KpiCardProps = {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: KpiCardTone;
  meta?: string;
};

export function KpiCard({ label, value, delta, deltaTone = "neutral", meta }: KpiCardProps) {
  return (
    <article className="dashboard-kpi-card">
      <p className="dashboard-kpi-card__label">{label}</p>
      <p className="dashboard-kpi-card__value">{value}</p>
      <div className="dashboard-kpi-card__footer">
        {delta ? <MetricBadge tone={deltaTone}>{delta}</MetricBadge> : null}
        {meta ? <span className="dashboard-kpi-card__meta">{meta}</span> : null}
      </div>
    </article>
  );
}
