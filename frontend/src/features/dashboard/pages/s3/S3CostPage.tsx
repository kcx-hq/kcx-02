import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useS3CostInsightsQuery } from "../../hooks/useDashboardQueries";
import { S3BucketInsightsTable, type S3BucketTableRow } from "./components/S3BucketInsightsTable";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

export default function S3CostPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = useS3CostInsightsQuery();
  const totalS3Cost = Number(query.data?.kpis.totalS3Cost ?? 0);
  const monthToDateCost = Number(query.data?.kpis.monthToDateCost ?? 0);
  const effectiveCost = Number(query.data?.kpis.effectiveCost ?? 0);
  const rows = useMemo(() => (query.data?.bucketTable ?? []) as S3BucketTableRow[], [query.data?.bucketTable]);

  return (
    <div className="dashboard-page">
      {query.isLoading ? <p className="dashboard-note">Loading S3 bucket insights...</p> : null}
      {query.isError ? <p className="dashboard-note">Failed to load S3 bucket insights: {query.error.message}</p> : null}

      {!query.isLoading && !query.isError ? (
        <>
          <div className="cost-explorer-chart-insights" aria-label="S3 cost metrics">
            <article className="cost-explorer-insight-tile">
              <p className="cost-explorer-insight-tile__label">Total S3 Cost</p>
              <p className="cost-explorer-insight-tile__value">{currencyFormatter.format(totalS3Cost)}</p>
            </article>
            <article className="cost-explorer-insight-tile">
              <p className="cost-explorer-insight-tile__label">Month to Date Cost</p>
              <p className="cost-explorer-insight-tile__value">{currencyFormatter.format(monthToDateCost)}</p>
            </article>
            <article className="cost-explorer-insight-tile">
              <p className="cost-explorer-insight-tile__label">Effective Cost</p>
              <p className="cost-explorer-insight-tile__value">{currencyFormatter.format(effectiveCost)}</p>
            </article>
          </div>
          <S3BucketInsightsTable
            rows={rows}
            totalS3Cost={totalS3Cost}
            height={520}
            onBucketClick={(bucketName) => {
              navigate({
                pathname: `/dashboard/s3/cost/bucket/${encodeURIComponent(bucketName)}`,
                search: location.search,
              });
            }}
          />
        </>
      ) : null}
    </div>
  );
}
