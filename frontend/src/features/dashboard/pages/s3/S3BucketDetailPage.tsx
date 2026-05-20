import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useS3BucketDetailQuery } from "../../hooks/useDashboardQueries";
import { S3BucketDetailPanel } from "./components/S3BucketDetailPanel";
import type { S3BucketTableRow } from "./components/S3BucketInsightsTable.types";

export default function S3BucketDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ bucketName: string }>();
  const bucketNameParam = decodeURIComponent(params.bucketName ?? "").trim();

  const query = useS3BucketDetailQuery(bucketNameParam, {
    enabled: bucketNameParam.length > 0,
    staleTime: 180_000,
  });
  const selectedBucket = useMemo<S3BucketTableRow | null>(() => {
    const detail = query.data;
    if (!detail) return null;
    return {
      bucketName: detail.bucketName,
      account: detail.metadata.accountId ?? "Unspecified",
      cost: Number(detail.costBreakdown.totalCost ?? 0),
      storage: Number(detail.costBreakdown.storageCost ?? 0),
      requests: Number(detail.costBreakdown.requestCost ?? 0),
      transfer: Number(detail.costBreakdown.transferCost ?? 0),
      region: detail.metadata.region ?? "Unknown",
      owner: detail.metadata.owner ?? "Unassigned",
      driver: "Storage",
      retrieval: Number(detail.costBreakdown.retrievalCost ?? 0),
      other: Number(detail.costBreakdown.otherCost ?? 0),
      replicationStatus: detail.replicationInsight.status,
      versioningStatus: detail.metadata.versioning,
      encryptionStatus: detail.metadata.encryption,
      publicAccessStatus:
        String(detail.metadata.publicAccess ?? "").toLowerCase() === "public"
          ? "Public"
          : String(detail.metadata.publicAccess ?? "").toLowerCase() === "private"
            ? "Private"
            : "Unknown",
      trendPct: Number(detail.costBreakdown.costTrendPct ?? 0),
      storageLens: {
        usageDate: detail.filtersApplied.to,
        objectCount: detail.objectInsights.objectCount,
        currentVersionBytes: detail.objectInsights.currentVersionBytes,
        avgObjectSizeBytes: detail.objectInsights.avgObjectSize,
        accessCount: detail.usageMetrics.requestCount,
        percentInGlacier: 0,
        storageClassDistribution: [],
      },
    };
  }, [query.data]);

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
          usageMetrics={{
            storageGb: query.data?.usageMetrics.storageGb ?? 0,
            transferGb: query.data?.usageMetrics.transferGb ?? 0,
            requestCount: query.data?.usageMetrics.requestCount ?? 0,
          }}
          storageLens={selectedBucket.storageLens}
          onClose={handleBack}
        />
      ) : null}
    </div>
  );
}
