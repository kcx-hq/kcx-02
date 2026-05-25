type S3BucketKpiSectionProps = {
  mode?: "default" | "usage_type" | "operation" | "storage_class";
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
  topOperation?: {
    operation: string;
    cost: number;
    percentOfTotal: number;
  } | null;
  topStorageClassLabel?: string;
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
  topOperation,
  topStorageClassLabel,
}: S3BucketKpiSectionProps) {
  if ((mode === "usage_type" || mode === "operation") && usageTypeCostKpis) {
    const topDriverText = usageTypeCostKpis.topUsageDriver
      ? `${usageTypeCostKpis.topUsageDriver.category} - ${formatCurrency(usageTypeCostKpis.topUsageDriver.cost)} (${usageTypeCostKpis.topUsageDriver.percentOfTotal.toFixed(1)}%)`
      : "n/a";
    const topOperationText = topOperation
      ? `${topOperation.operation} - ${formatCurrency(topOperation.cost)} (${topOperation.percentOfTotal.toFixed(1)}%)`
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
            <p className="cost-explorer-insight-tile__label">{mode === "operation" ? "Top Operation" : "Top Usage Driver"}</p>
            <p className="cost-explorer-insight-tile__value">{mode === "operation" ? topOperationText : topDriverText}</p>
          </article>
        </div>
      </section>
    );
  }

  if (mode === "storage_class") {
    return (
      <section className="cost-explorer-kpi-surface s3-overview-kpi-surface" aria-label="S3 storage-class cost key metrics">
        <div className="cost-explorer-chart-insights s3-overview-kpi-row">
          <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
            <p className="cost-explorer-insight-tile__label">Gross S3 Cost</p>
            <p className="cost-explorer-insight-tile__value">{formatCurrency(grossBucketCost)}</p>
          </article>
          <article className="cost-explorer-insight-tile is-positive s3-overview-kpi-tile">
            <p className="cost-explorer-insight-tile__label">Credits</p>
            <p className="cost-explorer-insight-tile__value">{formatCurrency(creditAdjustedCost)} Credit Applied</p>
          </article>
          <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
            <p className="cost-explorer-insight-tile__label">Net S3 Cost</p>
            <p className="cost-explorer-insight-tile__value">{formatCurrency(netBucketCost)}</p>
          </article>
          <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
            <p className="cost-explorer-insight-tile__label">Top Storage Class</p>
            <p className="cost-explorer-insight-tile__value">{topStorageClassLabel || "n/a"}</p>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className="cost-explorer-kpi-surface s3-overview-kpi-surface" aria-label="S3 bucket cost key metrics">
      <div className="cost-explorer-chart-insights s3-overview-kpi-row">
        <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
          <p className="cost-explorer-insight-tile__label">Gross S3 Cost</p>
          <p className="cost-explorer-insight-tile__value">{formatCurrency(grossBucketCost)}</p>
        </article>
        <article className="cost-explorer-insight-tile is-positive s3-overview-kpi-tile">
          <p className="cost-explorer-insight-tile__label">Credits</p>
          <p className="cost-explorer-insight-tile__value">{formatCurrency(creditAdjustedCost)} Credit Applied</p>
        </article>
        <article className="cost-explorer-insight-tile s3-overview-kpi-tile">
          <p className="cost-explorer-insight-tile__label">Net S3 Cost</p>
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
