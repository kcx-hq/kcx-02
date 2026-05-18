type S3BucketKpiSectionProps = {
  mode?: "default" | "usage_type";
  grossBucketCost: number;
  creditAdjustedCost: number;
  netBucketCost: number;
  totalBuckets: number;
  usageTypeCostKpis?: {
    grossS3Cost: number;
    credits: number;
    netS3Cost: number;
    topUsageDriver: {
      category: "Request" | "Storage" | "Transfer" | "Retrieval" | "Replication" | "Lifecycle" | "Other";
      cost: number;
      percentOfTotal: number;
    } | null;
  };
};

const currencyFormatterStandard = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormatterPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number): string => {
  const safeValue = Number.isFinite(value) ? value : 0;
  if (Math.abs(safeValue) < 0.1 && safeValue !== 0) {
    return currencyFormatterPrecise.format(safeValue);
  }
  return currencyFormatterStandard.format(safeValue);
};

export function S3BucketKpiSection({
  mode = "default",
  grossBucketCost,
  creditAdjustedCost,
  netBucketCost,
  totalBuckets,
  usageTypeCostKpis,
}: S3BucketKpiSectionProps) {
  if (mode === "usage_type" && usageTypeCostKpis) {
    const topDriverText = usageTypeCostKpis.topUsageDriver
      ? `${usageTypeCostKpis.topUsageDriver.category} • ${formatCurrency(usageTypeCostKpis.topUsageDriver.cost)} (${usageTypeCostKpis.topUsageDriver.percentOfTotal.toFixed(1)}%)`
      : "n/a";

    return (
      <section className="cost-explorer-kpi-surface s3-overview-kpi-surface" aria-label="S3 usage-type cost key metrics">
        <div className="cost-explorer-chart-insights s3-overview-kpi-row">
          <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
            <p className="cost-explorer-insight-tile__label">Gross S3 Cost</p>
            <p className="cost-explorer-insight-tile__value">{formatCurrency(usageTypeCostKpis.grossS3Cost)}</p>
          </article>
          <article className="cost-explorer-insight-tile is-positive s3-overview-kpi-tile">
            <p className="cost-explorer-insight-tile__label">Credits</p>
            <p className="cost-explorer-insight-tile__value">{formatCurrency(usageTypeCostKpis.credits)} Applied</p>
          </article>
          <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
            <p className="cost-explorer-insight-tile__label">Net S3 Cost</p>
            <p className="cost-explorer-insight-tile__value">{formatCurrency(usageTypeCostKpis.netS3Cost)}</p>
          </article>
          <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
            <p className="cost-explorer-insight-tile__label">Top Usage Driver</p>
            <p className="cost-explorer-insight-tile__value">{topDriverText}</p>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className="cost-explorer-kpi-surface s3-overview-kpi-surface" aria-label="S3 bucket cost key metrics">
      <div className="cost-explorer-chart-insights s3-overview-kpi-row">
        <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
          <p className="cost-explorer-insight-tile__label">Gross Bucket Cost</p>
          <p className="cost-explorer-insight-tile__value">{formatCurrency(grossBucketCost)}</p>
        </article>
        <article className="cost-explorer-insight-tile is-positive s3-overview-kpi-tile">
          <p className="cost-explorer-insight-tile__label">Credit Adjusted Cost</p>
          <p className="cost-explorer-insight-tile__value">{formatCurrency(creditAdjustedCost)} Credit Applied</p>
        </article>
        <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
          <p className="cost-explorer-insight-tile__label">Net Bucket Cost</p>
          <p className="cost-explorer-insight-tile__value">{formatCurrency(netBucketCost)}</p>
        </article>
        <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
          <p className="cost-explorer-insight-tile__label">Total Buckets</p>
          <p className="cost-explorer-insight-tile__value">{integerFormatter.format(Math.max(0, totalBuckets))}</p>
        </article>
      </div>
    </section>
  );
}
