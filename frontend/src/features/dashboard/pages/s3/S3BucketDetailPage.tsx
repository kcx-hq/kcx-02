import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { type S3CostInsightsFiltersQuery } from "../../api/dashboardApi";
import { useS3CostInsightsQuery } from "../../hooks/useDashboardQueries";
import { S3BucketDetailPanel } from "./components/S3BucketDetailPanel";
import { type S3BucketTableRow } from "./components/S3BucketInsightsTable";

const parseListParam = (value: string | null): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export default function S3BucketDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ bucketName: string }>();
  const bucketNameParam = decodeURIComponent(params.bucketName ?? "").trim();

  const queryFilters = useMemo<S3CostInsightsFiltersQuery>(() => {
    const search = new URLSearchParams(location.search);
    const seriesBy = search.get("s3SeriesBy");
    const costBy = search.get("s3CostBy");
    const yAxisMetric = search.get("s3YAxisMetric");
    const seriesValues = parseListParam(search.get("s3SeriesValues"));
    const storageClass = parseListParam(search.get("s3StorageClass"));
    const region = (search.get("s3Region") ?? "").trim();

    return {
      ...(seriesValues.length > 0 ? { seriesValues } : {}),
      ...(storageClass.length > 0 ? { storageClass } : {}),
      ...(region ? { region: [region] } : {}),
      ...(seriesBy ? { seriesBy: seriesBy as NonNullable<S3CostInsightsFiltersQuery["seriesBy"]> } : {}),
      ...(costBy ? { costBy: costBy as NonNullable<S3CostInsightsFiltersQuery["costBy"]> } : {}),
      ...(yAxisMetric ? { yAxisMetric: yAxisMetric as NonNullable<S3CostInsightsFiltersQuery["yAxisMetric"]> } : {}),
    };
  }, [location.search]);

  const query = useS3CostInsightsQuery(queryFilters);
  const rows = useMemo(() => (query.data?.bucketTable ?? []) as S3BucketTableRow[], [query.data?.bucketTable]);
  const selectedBucket = useMemo(() => {
    const normalized = bucketNameParam.toLowerCase();
    return rows.find((row) => String(row.bucketName ?? "").trim().toLowerCase() === normalized) ?? null;
  }, [bucketNameParam, rows]);

  const handleBack = () => {
    navigate({
      pathname: "/dashboard/s3/cost",
      search: location.search,
    });
  };

  return (
    <div className="dashboard-page s3-overview-page">
      <button type="button" className="cost-explorer-state-btn s3-bucket-detail-page__back" onClick={handleBack}>
        Back to Cost Breakdown
      </button>
      {query.isLoading ? <p className="dashboard-note">Loading bucket details...</p> : null}
      {query.isError ? <p className="dashboard-note">Failed to load bucket details: {query.error.message}</p> : null}
      {!query.isLoading && !query.isError && !selectedBucket ? (
        <p className="dashboard-note">No bucket details found for "{bucketNameParam}".</p>
      ) : null}
      {!query.isLoading && !query.isError && selectedBucket ? (
        <S3BucketDetailPanel
          bucket={selectedBucket}
          totalS3Cost={query.data?.kpis.totalS3Cost ?? 0}
          onClose={handleBack}
        />
      ) : null}
    </div>
  );
}
