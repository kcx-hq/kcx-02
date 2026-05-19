import type { S3CostInsightsResponse } from "../../../../api/dashboardApi";

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const formatDataSize = (valueInGb: number): string => {
  const safeGb = Number.isFinite(valueInGb) ? Math.max(0, valueInGb) : 0;
  if (safeGb >= 1024) {
    const tb = safeGb / 1024;
    return `${tb.toFixed(tb >= 100 ? 0 : tb >= 10 ? 1 : 2)} TB`;
  }
  return `${safeGb.toFixed(safeGb >= 100 ? 0 : safeGb >= 10 ? 1 : 2)} GB`;
};

const formatGb = (valueInGb: number): string => {
  const safeGb = Number.isFinite(valueInGb) ? Math.max(0, valueInGb) : 0;
  return `${safeGb.toFixed(safeGb >= 100 ? 0 : safeGb >= 10 ? 1 : 2)} GB`;
};

type Props = {
  kpis: S3CostInsightsResponse["kpis"]["usageSummaryKpis"] | undefined;
  isLoading?: boolean;
};

export function S3UsageKpiSection({ kpis, isLoading = false }: Props) {
  if (isLoading) {
    return (
      <section className="cost-explorer-kpi-surface s3-overview-kpi-surface" aria-label="S3 usage key metrics">
        <div className="cost-explorer-chart-insights s3-overview-kpi-row s3-usage-kpi-row--skeleton" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <article key={`s3-usage-kpi-skeleton-${index}`} className="cost-explorer-insight-tile s3-overview-kpi-tile s3-usage-kpi-row__item">
              <div className="s3-usage-kpi-row__skeleton-label" />
              <div className="s3-usage-kpi-row__skeleton-value" />
            </article>
          ))}
        </div>
      </section>
    );
  }

  const values = {
    totalStorageGb: Number(kpis?.totalStorageGb ?? 0),
    totalRequests: Number(kpis?.totalRequests ?? 0),
    totalTransferGb: Number(kpis?.totalTransferGb ?? 0),
    totalObjectCount: Number(kpis?.totalObjectCount ?? 0),
  };

  return (
    <section className="cost-explorer-kpi-surface s3-overview-kpi-surface" aria-label="S3 usage key metrics">
      <div className="cost-explorer-chart-insights s3-overview-kpi-row">
        <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
          <p className="cost-explorer-insight-tile__label">Total Storage</p>
          <p className="cost-explorer-insight-tile__value">{formatGb(values.totalStorageGb)}</p>
        </article>
        <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
          <p className="cost-explorer-insight-tile__label">Total Requests</p>
          <p className="cost-explorer-insight-tile__value">{compactNumberFormatter.format(Math.max(0, values.totalRequests))}</p>
        </article>
        <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
          <p className="cost-explorer-insight-tile__label">Total Transfer</p>
          <p className="cost-explorer-insight-tile__value">{formatDataSize(values.totalTransferGb)}</p>
        </article>
        <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
          <p className="cost-explorer-insight-tile__label">Total Object Count</p>
          <p className="cost-explorer-insight-tile__value">{compactNumberFormatter.format(Math.max(0, values.totalObjectCount))}</p>
        </article>
      </div>
    </section>
  );
}
