import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useS3CostInsightsQuery } from "../../hooks/useDashboardQueries";
import type { S3BucketTableRow } from "./components/S3BucketInsightsTable";
import { S3BucketCombinedTable, type S3BucketCombinedRow } from "./components/S3BucketCombinedTable";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 5,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 5,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export default function S3BucketInfoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [usageMetricsEnabled, setUsageMetricsEnabled] = useState(false);
  const query = useS3CostInsightsQuery();
  const storageBreakdownQuery = useS3CostInsightsQuery({
    costCategory: ["Storage"],
    seriesBy: "bucket",
    costBy: "date",
    yAxisMetric: "usage_quantity",
  }, { enabled: usageMetricsEnabled });
  const transferBreakdownQuery = useS3CostInsightsQuery({
    costCategory: ["Transfer"],
    seriesBy: "bucket",
    costBy: "date",
    yAxisMetric: "usage_quantity",
  }, { enabled: usageMetricsEnabled });
  const requestBreakdownQuery = useS3CostInsightsQuery({
    costCategory: ["Request"],
    seriesBy: "bucket",
    costBy: "date",
    yAxisMetric: "usage_quantity",
  }, { enabled: usageMetricsEnabled });

  const rows = useMemo(() => (query.data?.bucketTable ?? []) as S3BucketTableRow[], [query.data?.bucketTable]);
  const scopedRows = useMemo(
    () => rows.filter((row) => String(row.bucketName ?? "").trim().length > 0 && String(row.bucketName ?? "").trim().toLowerCase() !== "unattributed"),
    [rows],
  );

  const combinedRows = useMemo<S3BucketCombinedRow[]>(() => {
    const bucketRows = scopedRows;
    const storageSeries = storageBreakdownQuery.data?.chart.breakdown.series ?? [];
    const transferSeries = transferBreakdownQuery.data?.chart.breakdown.series ?? [];
    const requestSeries = requestBreakdownQuery.data?.chart.breakdown.series ?? [];

    const sumSeries = (series: typeof storageSeries, transform?: (value: number) => number) =>
      new Map(
        series.map((item) => [
          String(item.name ?? "").trim(),
          item.values.reduce((sum, value) => sum + (transform ? transform(Number(value ?? 0)) : Number(value ?? 0)), 0),
        ]),
      );

    const storageByBucket = sumSeries(storageSeries, (value) => value / 24);
    const transferByBucket = sumSeries(transferSeries);
    const requestByBucket = sumSeries(requestSeries);

    return bucketRows
      .map((row) => {
        const bucketName = String(row.bucketName ?? "").trim();
        const storageGb = Number(storageByBucket.get(bucketName) ?? 0);
        const transferGb = Number(transferByBucket.get(bucketName) ?? 0);
        const requestCount = Number(requestByBucket.get(bucketName) ?? 0);
        const primaryUsage =
          [
            { key: "Storage", value: storageGb },
            { key: "Transfer", value: transferGb },
            { key: "Request", value: requestCount },
          ].sort((a, b) => b.value - a.value)[0]?.key ?? "Storage";

        return {
          bucketName,
          account: String(row.account ?? "--"),
          region: String(row.region ?? "--"),
          totalCost: Number(row.cost ?? 0),
          storageCost: Number(row.storage ?? 0),
          requestCost: Number(row.requests ?? 0),
          transferCost: Number(row.transfer ?? 0),
          storageGb,
          requestCount,
          transferGb,
          usageInfo: `Primary usage: ${primaryUsage}`,
        };
      })
      .sort((a, b) => b.storageGb + b.requestCount + b.transferGb - (a.storageGb + a.requestCount + a.transferGb));
  }, [
    requestBreakdownQuery.data?.chart.breakdown.series,
    scopedRows,
    storageBreakdownQuery.data?.chart.breakdown.series,
    transferBreakdownQuery.data?.chart.breakdown.series,
  ]);

  const costKpis = useMemo(() => {
    const totalStorageCost = scopedRows.reduce((sum, row) => sum + Number(row.storage ?? 0), 0);
    const totalRequestCost = scopedRows.reduce((sum, row) => sum + Number(row.requests ?? 0), 0);
    const totalTransferCost = scopedRows.reduce((sum, row) => sum + Number(row.transfer ?? 0), 0);
    return {
      buckets: scopedRows.length,
      totalStorageCost,
      totalRequestCost,
      totalTransferCost,
    };
  }, [scopedRows]);

  const usageKpis = useMemo(() => {
    const totalStorageGb = combinedRows.reduce((sum, row) => sum + Number(row.storageGb ?? 0), 0);
    const totalRequestCount = combinedRows.reduce((sum, row) => sum + Number(row.requestCount ?? 0), 0);
    const totalTransferGb = combinedRows.reduce((sum, row) => sum + Number(row.transferGb ?? 0), 0);
    return {
      buckets: combinedRows.length,
      totalStorageGb,
      totalRequestCount,
      totalTransferGb,
    };
  }, [combinedRows]);

  const isUsageLoading =
    usageMetricsEnabled && (
    storageBreakdownQuery.isLoading ||
    transferBreakdownQuery.isLoading ||
    requestBreakdownQuery.isLoading
    );

  return (
    <div className="dashboard-page">
      {query.isLoading ? <p className="dashboard-note">Loading S3 bucket info...</p> : null}
      {query.isError ? <p className="dashboard-note">Failed to load S3 bucket info: {query.error.message}</p> : null}

      {!query.isLoading && !query.isError ? (
        <div className="s3-bucket-section">
          <section className="cost-explorer-widget-shell s3-bucket-kpi-shell">
            <div className="s3-bucket-kpi-row" aria-label="S3 bucket combined KPIs">
              <article className="s3-bucket-kpi-tile s3-bucket-kpi-tile--bucket">
                <p className="cost-explorer-insight-tile__label">Total Bucket</p>
                <p className="s3-bucket-kpi-tile__count">{integerFormatter.format(costKpis.buckets)}</p>
              </article>
              <article className="s3-bucket-kpi-tile">
                <p className="cost-explorer-insight-tile__label">Total Storage</p>
                <p className="s3-bucket-kpi-tile__meta">Cost: {currencyFormatter.format(costKpis.totalStorageCost)}</p>
                <p className="s3-bucket-kpi-tile__meta">Usage: {usageMetricsEnabled ? `${decimalFormatter.format(usageKpis.totalStorageGb)} GB avg/day` : "Load usage metrics"}</p>
              </article>
              <article className="s3-bucket-kpi-tile">
                <p className="cost-explorer-insight-tile__label">Total Request</p>
                <p className="s3-bucket-kpi-tile__meta">Cost: {currencyFormatter.format(costKpis.totalRequestCost)}</p>
                <p className="s3-bucket-kpi-tile__meta">Usage: {usageMetricsEnabled ? integerFormatter.format(usageKpis.totalRequestCount) : "Load usage metrics"}</p>
              </article>
              <article className="s3-bucket-kpi-tile">
                <p className="cost-explorer-insight-tile__label">Total Transfer</p>
                <p className="s3-bucket-kpi-tile__meta">Cost: {currencyFormatter.format(costKpis.totalTransferCost)}</p>
                <p className="s3-bucket-kpi-tile__meta">Usage: {usageMetricsEnabled ? `${decimalFormatter.format(usageKpis.totalTransferGb)} GB` : "Load usage metrics"}</p>
              </article>
            </div>
            {!usageMetricsEnabled ? (
              <div style={{ marginTop: 10 }}>
                <button type="button" className="optimization-rightsizing-pagination__btn" onClick={() => setUsageMetricsEnabled(true)}>
                  Load Usage Metrics
                </button>
              </div>
            ) : null}
          </section>

          <section className="cost-explorer-widget-shell s3-bucket-table-shell">
            {isUsageLoading ? (
              <div className="s3-usage-table-skeleton" aria-hidden="true">
                <div className="s3-usage-table-skeleton__toolbar" />
                <div className="s3-usage-table-skeleton__row" />
                <div className="s3-usage-table-skeleton__row" />
                <div className="s3-usage-table-skeleton__row" />
                <div className="s3-usage-table-skeleton__row" />
                <div className="s3-usage-table-skeleton__row" />
              </div>
            ) : (
              <S3BucketCombinedTable
                rows={combinedRows}
                onBucketClick={(bucketName) => {
                  navigate({
                    pathname: `/dashboard/s3/cost/bucket/${encodeURIComponent(bucketName)}`,
                    search: location.search,
                  });
                }}
              />
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
