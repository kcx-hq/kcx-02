import { useMemo } from "react";

import { useS3CostInsightsQuery } from "../../hooks/useDashboardQueries";

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const INTEGER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const DECIMAL = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function S3ExplorerPage() {
  const query = useS3CostInsightsQuery({
    costBy: "bucket",
    seriesBy: "cost_category",
    yAxisMetric: "billed_cost",
  });

  const metrics = useMemo(() => {
    const bucketRows = query.data?.bucketTable ?? [];
    const storageByClass = query.data?.storageCostDashboard.totalStorageByClass ?? [];
    const totalStorageBytes = storageByClass.reduce((sum, row) => sum + Number(row.bytes ?? 0), 0);
    const totalStorageTb = totalStorageBytes / (1024 ** 4);
    const objectCount = bucketRows.reduce((sum, row) => sum + Number(row.storageLens?.objectCount ?? 0), 0);
    const growthPct = Number(query.data?.storageCostDashboard.dailyStorageGrowth.growthPct ?? 0);
    const potentialSavings = Number(query.data?.estimatedSavings.totalMonthlySaving ?? 0);

    const highTransferBuckets = bucketRows
      .slice()
      .sort((a, b) => Number(b.transfer ?? 0) - Number(a.transfer ?? 0))
      .slice(0, 5);
    const highTransferCount = highTransferBuckets.filter((item) => Number(item.transfer ?? 0) > 0).length;

    const requestCostByBucket = new Map<string, number>();
    for (const item of query.data?.requestCostIntelligence.items ?? []) {
      const key = String(item.bucketName ?? "unattributed");
      requestCostByBucket.set(key, (requestCostByBucket.get(key) ?? 0) + Number(item.requestCost ?? 0));
    }
    const highRequestCostBuckets = [...requestCostByBucket.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5);

    const glacierCandidateBuckets = new Set(
      (query.data?.estimatedSavings.items ?? [])
        .filter((item) =>
          ["STANDARD_TO_GLACIER", "STANDARD_TO_DEEP_ARCHIVE"].includes(
            String(item.savingsType ?? "").trim().toUpperCase(),
          ),
        )
        .map((item) => String(item.bucketName ?? "").trim())
        .filter((value) => value.length > 0),
    );

    const idleCandidates = bucketRows.filter((row) => {
      const accessCount = Number(row.storageLens?.accessCount ?? 0);
      const monthlyCost = Number(row.cost ?? 0);
      return monthlyCost > 0 && accessCount <= 0;
    });

    return {
      totalS3Cost: Number(query.data?.kpis.totalS3Cost ?? 0),
      totalStorageTb,
      objectCount,
      growthPct,
      potentialSavings,
      glacierCandidateBuckets: glacierCandidateBuckets.size,
      idleBuckets: idleCandidates.length,
      highRequestCostBuckets: highRequestCostBuckets.length,
      highRequestCostTopCost: highRequestCostBuckets[0]?.[1] ?? 0,
      highTransferBuckets: highTransferCount,
      highTransferTopCost: Number(highTransferBuckets[0]?.transfer ?? 0),
    };
  }, [query.data]);

  return (
    <div className="dashboard-page s3-explorer-page">
      {query.isLoading ? <p className="dashboard-note">Loading S3 explorer insights...</p> : null}
      {query.isError ? <p className="dashboard-note">Failed to load S3 explorer insights: {query.error.message}</p> : null}

      {!query.isLoading && !query.isError ? (
        <section className="s3-command-center" aria-label="S3 explorer KPI widgets">
          <header className="s3-command-center__header">
            <h3>Overview Insights</h3>
            <p>Core S3 cost, usage, and opportunity indicators for selected scope.</p>
          </header>
          <div className="s3-command-center__cards">
            <article className="s3-command-center__card">
              <p className="s3-command-center__card-label">Total S3 Cost</p>
              <p className="s3-command-center__card-value">{CURRENCY.format(metrics.totalS3Cost)}</p>
              <p className="s3-command-center__card-meta">Storage + request + transfer + retrieval + other</p>
            </article>
            <article className="s3-command-center__card">
              <p className="s3-command-center__card-label">Total Storage</p>
              <p className="s3-command-center__card-value">{DECIMAL.format(metrics.totalStorageTb)} TB</p>
              <p className="s3-command-center__card-meta">Across selected buckets/accounts/regions</p>
            </article>
            <article className="s3-command-center__card">
              <p className="s3-command-center__card-label">Object Count</p>
              <p className="s3-command-center__card-value">{INTEGER.format(metrics.objectCount)}</p>
              <p className="s3-command-center__card-meta">Storage growth: {DECIMAL.format(metrics.growthPct)}%</p>
            </article>
            <article className="s3-command-center__card">
              <p className="s3-command-center__card-label">Potential Savings</p>
              <p className="s3-command-center__card-value">{CURRENCY.format(metrics.potentialSavings)}</p>
              <p className="s3-command-center__card-meta">Estimated monthly optimization opportunity</p>
            </article>
            <article className="s3-command-center__card">
              <p className="s3-command-center__card-label">Unaccessed Data</p>
              <p className="s3-command-center__card-value">N/A</p>
              <p className="s3-command-center__card-meta">Need last-access age data in DB</p>
            </article>
            <article className="s3-command-center__card">
              <p className="s3-command-center__card-label">Glacier Candidates</p>
              <p className="s3-command-center__card-value">{INTEGER.format(metrics.glacierCandidateBuckets)}</p>
              <p className="s3-command-center__card-meta">Buckets inferred from archive savings recommendations</p>
            </article>
            <article className="s3-command-center__card">
              <p className="s3-command-center__card-label">Idle Buckets</p>
              <p className="s3-command-center__card-value">{INTEGER.format(metrics.idleBuckets)}</p>
              <p className="s3-command-center__card-meta">Low activity and non-zero cost (heuristic)</p>
            </article>
            <article className="s3-command-center__card">
              <p className="s3-command-center__card-label">Public Buckets</p>
              <p className="s3-command-center__card-value">N/A</p>
              <p className="s3-command-center__card-meta">Need bucket public-access telemetry in API</p>
            </article>
            <article className="s3-command-center__card">
              <p className="s3-command-center__card-label">High Request Cost Buckets</p>
              <p className="s3-command-center__card-value">{INTEGER.format(metrics.highRequestCostBuckets)}</p>
              <p className="s3-command-center__card-meta">
                Top bucket request cost: {CURRENCY.format(metrics.highRequestCostTopCost)}
              </p>
            </article>
            <article className="s3-command-center__card">
              <p className="s3-command-center__card-label">High Transfer Buckets</p>
              <p className="s3-command-center__card-value">{INTEGER.format(metrics.highTransferBuckets)}</p>
              <p className="s3-command-center__card-meta">
                Top transfer bucket cost: {CURRENCY.format(metrics.highTransferTopCost)}
              </p>
            </article>
          </div>
        </section>
      ) : null}
    </div>
  );
}
