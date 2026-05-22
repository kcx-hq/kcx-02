import type { ReactNode } from "react";

type KpiCardProps = {
  title: ReactNode;
  value: ReactNode;
  subtitle?: string;
};

function KpiCard({ title, value, subtitle }: KpiCardProps) {
  return (
    <article className="anomaly-ref-kpi-card">
      <p className="anomaly-ref-kpi-card__title">{title}</p>
      <p className="anomaly-ref-kpi-card__value">{value}</p>
      {subtitle ? <p className="anomaly-ref-kpi-card__subtitle">{subtitle}</p> : null}
    </article>
  );
}

type AnomalyDetectionKpisProps = {
  totalAnomalies: number;
  criticalAnomalies: number;
  totalCostImpact: string;
  potentialSavings: string;
  isLoading?: boolean;
};

export function AnomalyDetectionKpis({
  totalAnomalies,
  criticalAnomalies,
  totalCostImpact,
  potentialSavings,
  isLoading = false,
}: AnomalyDetectionKpisProps) {
  const renderValue = (value: string, className: string) =>
    isLoading ? <span className={`anomaly-ref-kpi-skeleton ${className}`} aria-hidden="true" /> : value;
  const renderTitle = (value: string, className: string) =>
    isLoading ? <span className={`anomaly-ref-kpi-title-skeleton ${className}`} aria-hidden="true" /> : value;

  return (
    <section className="anomaly-ref-kpis" aria-label="Anomaly summary cards">
      <KpiCard title={renderTitle("Total Anomalies", "anomaly-ref-kpi-title-skeleton--md")} value={renderValue(String(totalAnomalies), "anomaly-ref-kpi-skeleton--sm")} />
      <KpiCard title={renderTitle("Critical Anomalies", "anomaly-ref-kpi-title-skeleton--md")} value={renderValue(String(criticalAnomalies), "anomaly-ref-kpi-skeleton--sm")} />
      <KpiCard title={renderTitle("Total Cost Impact", "anomaly-ref-kpi-title-skeleton--md")} value={renderValue(totalCostImpact, "anomaly-ref-kpi-skeleton--lg")} />
      <KpiCard
        title={renderTitle("Potential Savings", "anomaly-ref-kpi-title-skeleton--md")}
        value={renderValue(potentialSavings, "anomaly-ref-kpi-skeleton--lg")}
        subtitle={isLoading ? undefined : "If open anomalies are remediated"}
      />
    </section>
  );
}
