import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useS3BucketDetailQuery } from "../../hooks/useDashboardQueries";
import { S3BucketDetailPanel } from "./components/S3BucketDetailPanel";
import type { S3BucketTableRow } from "./components/S3BucketInsightsTable.types";
import { S3BucketUsageTrendPanel } from "./components/S3BucketUsageTrendPanel";

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatBytesCompact = (bytes: number): string => {
  if (bytes >= 1024 ** 4) return `${decimalFormatter.format(bytes / (1024 ** 4))} TiB`;
  if (bytes >= 1024 ** 3) return `${decimalFormatter.format(bytes / (1024 ** 3))} GiB`;
  if (bytes >= 1024 ** 2) return `${decimalFormatter.format(bytes / (1024 ** 2))} MiB`;
  if (bytes >= 1024) return `${decimalFormatter.format(bytes / 1024)} KiB`;
  return `${integerFormatter.format(bytes)} B`;
};

export default function S3UsageBucketDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ bucketName: string }>();
  const bucketNameParam = decodeURIComponent(params.bucketName ?? "").trim();

  const bucketDetailQuery = useS3BucketDetailQuery(bucketNameParam || null, {
    enabled: bucketNameParam.length > 0,
    staleTime: 180_000,
  });

  const detail = bucketDetailQuery.data;

  const selectedBucket = useMemo<S3BucketTableRow | null>(() => {
    if (!detail) return null;
    return {
      bucketName: detail.bucketName,
      account: detail.metadata.accountId ?? "Unspecified",
      cost: 0,
      storage: 0,
      requests: 0,
      transfer: 0,
      region: detail.metadata.region ?? "Unknown",
      owner: detail.metadata.owner ?? "Unassigned",
      driver: "Storage",
      retrieval: 0,
      other: 0,
      replicationStatus: detail.replicationInsight.status,
      versioningStatus: detail.metadata.versioning,
      encryptionStatus: detail.metadata.encryption,
      publicAccessStatus:
        String(detail.metadata.publicAccess ?? "").toLowerCase() === "public"
          ? "Public"
          : String(detail.metadata.publicAccess ?? "").toLowerCase() === "private"
            ? "Private"
            : "Unknown",
      trendPct: 0,
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
  }, [detail]);

  const usageMetrics = useMemo(
    () => ({
      storageGb: Number(detail?.usageMetrics.storageGb ?? 0),
      transferGb: Number(detail?.usageMetrics.transferGb ?? 0),
      requestCount: Number(detail?.usageMetrics.requestCount ?? 0),
    }),
    [detail?.usageMetrics.requestCount, detail?.usageMetrics.storageGb, detail?.usageMetrics.transferGb],
  );

  const lifecycleStatusLabel = useMemo(() => {
    const value = String(detail?.lifecycleInsight.status ?? "").trim();
    if (!value) return "Unknown";
    return value
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }, [detail?.lifecycleInsight.status]);

  const lifecycleStatusTone = useMemo(() => {
    const coverage = Number(detail?.lifecycleInsight.transitionCoverage ?? 0);
    const rules = Number(detail?.lifecycleInsight.rulesCount ?? 0);
    if (rules === 0) return "critical";
    if (coverage <= 0) return "warn";
    return "good";
  }, [detail?.lifecycleInsight.rulesCount, detail?.lifecycleInsight.transitionCoverage]);

  const lifecycleScanLabel = useMemo(() => {
    const value = detail?.lifecycleInsight.lastScan;
    if (!value) return "--";
    const scanDate = new Date(value);
    if (Number.isNaN(scanDate.getTime())) return "--";
    return scanDate.toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit" });
  }, [detail?.lifecycleInsight.lastScan]);

  const shouldShowCreatePolicyButton = useMemo(
    () => Number(detail?.lifecycleInsight.rulesCount ?? 0) === 0,
    [detail?.lifecycleInsight.rulesCount],
  );

  const handleCreatePolicy = () => {
    const searchParams = new URLSearchParams(location.search);
    if (bucketNameParam) {
      searchParams.set("bucketName", bucketNameParam);
    }

    navigate({
      pathname: "/dashboard/policy/s3",
      search: searchParams.toString() ? `?${searchParams.toString()}` : "",
    });
  };

  const handleOpenReplicationOptimization = () => {
    const searchParams = new URLSearchParams(location.search);
    if (bucketNameParam) {
      searchParams.set("bucketName", bucketNameParam);
    }
    searchParams.set("tab", "replication");

    navigate({
      pathname: "/dashboard/s3/optimization",
      search: searchParams.toString() ? `?${searchParams.toString()}` : "",
    });
  };

  const replicationStatusLabel = useMemo(() => {
    const value = String(detail?.replicationInsight.status ?? "").trim().toLowerCase();
    if (value === "present") return "Present";
    if (value === "enabled") return "Present";
    if (value === "absent") return "Missing";
    if (value === "disabled") return "Missing";
    if (value === "unknown") return "Unknown";
    return "Not Available";
  }, [detail?.replicationInsight.status]);

  const replicationStatusTone = useMemo(() => {
    const value = String(detail?.replicationInsight.status ?? "").trim().toLowerCase();
    if (value === "present" || value === "enabled") return "good";
    if (value === "absent" || value === "disabled") return "critical";
    if (value === "unknown") return "warn";
    return "unknown";
  }, [detail?.replicationInsight.status]);

  const objectInsights = useMemo(() => {
    if (!detail) {
      return {
        statusTone: "unknown" as "good" | "warn" | "critical" | "unknown",
        objectCount: null as number | null,
        avgObjectSizeBytes: null as number | null,
        currentVersionBytes: 0,
        requestsPerObject: null as number | null,
      };
    }

    const objectCount = detail.objectInsights.objectCount;
    const avgObjectSizeBytes = detail.objectInsights.avgObjectSize;
    const currentVersionBytes = detail.objectInsights.currentVersionBytes ?? 0;
    const requestsPerObject = detail.objectInsights.requestsPerObject;

    let statusTone: "good" | "warn" | "critical" | "unknown" = "good";
    if (objectCount == null) statusTone = "unknown";
    else if (objectCount > 1_000_000 && avgObjectSizeBytes != null && avgObjectSizeBytes < 128 * 1024) statusTone = "critical";
    else if (currentVersionBytes > 500 * 1024 * 1024 * 1024) statusTone = "warn";

    return {
      statusTone,
      objectCount,
      avgObjectSizeBytes,
      currentVersionBytes,
      requestsPerObject,
    };
  }, [detail]);

  const handleBack = () => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete("s3Section");
    navigate({
      pathname: "/dashboard/s3/bucket",
      search: searchParams.toString(),
    });
  };

  return (
    <div className="dashboard-page s3-overview-page s3-usage-bucket-detail-page">
      {bucketDetailQuery.isLoading ? <p className="dashboard-note">Loading bucket details...</p> : null}
      {bucketDetailQuery.isError ? <p className="dashboard-note">Failed to load bucket details: {bucketDetailQuery.error.message}</p> : null}
      {!bucketDetailQuery.isLoading && !bucketDetailQuery.isError && !selectedBucket ? (
        <p className="dashboard-note">No bucket details found for "{bucketNameParam}".</p>
      ) : null}
      {!bucketDetailQuery.isLoading && !bucketDetailQuery.isError && selectedBucket ? (
        <>
          <S3BucketDetailPanel
            bucket={selectedBucket}
            usageMetrics={usageMetrics}
            storageClassDistribution={[]}
            storageLens={selectedBucket.storageLens ?? null}
            onClose={handleBack}
          />
          <section className="s3-lifecycle-insight-card" aria-label="Object insights">
            <div className="s3-lifecycle-insight-card__header">
              <h3 className="s3-lifecycle-insight-card__title">Object Insights</h3>
              <span className={`s3-lifecycle-insight-card__status is-${objectInsights.statusTone}`}>
                {objectInsights.statusTone === "critical"
                  ? "High Priority"
                  : objectInsights.statusTone === "warn"
                    ? "Review"
                    : objectInsights.statusTone === "good"
                      ? "Healthy"
                      : "Unknown"}
              </span>
            </div>
            <div className="s3-lifecycle-insight-card__meta">
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Object Count</p>
                <p className="s3-lifecycle-insight-card__meta-value">
                  {objectInsights.objectCount == null ? "--" : integerFormatter.format(objectInsights.objectCount)}
                </p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Avg Object Size</p>
                <p className="s3-lifecycle-insight-card__meta-value">
                  {objectInsights.avgObjectSizeBytes == null ? "N/A" : formatBytesCompact(objectInsights.avgObjectSizeBytes)}
                </p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Current Version Data</p>
                <p className="s3-lifecycle-insight-card__meta-value">{formatBytesCompact(objectInsights.currentVersionBytes)}</p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Requests / Object</p>
                <p className="s3-lifecycle-insight-card__meta-value">
                  {objectInsights.requestsPerObject == null ? "--" : decimalFormatter.format(objectInsights.requestsPerObject)}
                </p>
              </article>
            </div>
          </section>
          <section className="s3-lifecycle-insight-card" aria-label="Lifecycle policy insight">
            <div className="s3-lifecycle-insight-card__header">
              <h3 className="s3-lifecycle-insight-card__title">Lifecycle Policy Insight</h3>
              <div className="s3-lifecycle-insight-card__header-actions">
                {shouldShowCreatePolicyButton ? (
                  <button type="button" className="s3-lifecycle-insight-card__create-policy-btn" onClick={handleCreatePolicy}>
                    Set Policy
                  </button>
                ) : null}
                <span className={`s3-lifecycle-insight-card__status is-${lifecycleStatusTone}`}>{lifecycleStatusLabel}</span>
              </div>
            </div>
            <div className="s3-lifecycle-insight-card__meta">
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Rules Count</p>
                <p className="s3-lifecycle-insight-card__meta-value">{detail?.lifecycleInsight.rulesCount ?? "--"}</p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Enabled Rules</p>
                <p className="s3-lifecycle-insight-card__meta-value">{detail?.lifecycleInsight.enabledRules ?? "--"}</p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Transition Coverage</p>
                <p className="s3-lifecycle-insight-card__meta-value">{detail?.lifecycleInsight.transitionCoverage ?? "--"}</p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Last Scan</p>
                <p className="s3-lifecycle-insight-card__meta-value">{lifecycleScanLabel}</p>
              </article>
            </div>
          </section>
          <section className="s3-lifecycle-insight-card" aria-label="Replication insight">
            <div className="s3-lifecycle-insight-card__header">
              <h3 className="s3-lifecycle-insight-card__title">Replication Insight</h3>
              <div className="s3-lifecycle-insight-card__header-actions">
                <button type="button" className="s3-lifecycle-insight-card__create-policy-btn" onClick={handleOpenReplicationOptimization}>
                  {detail?.replicationInsight.status ? "Manage Replication" : "Setup Replication"}
                </button>
                <span className={`s3-lifecycle-insight-card__status is-${replicationStatusTone}`}>{replicationStatusLabel}</span>
              </div>
            </div>
            <div className="s3-lifecycle-insight-card__meta">
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Rules Count</p>
                <p className="s3-lifecycle-insight-card__meta-value">{detail?.replicationInsight.rulesCount ?? "--"}</p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Destination Bucket</p>
                <p className="s3-lifecycle-insight-card__meta-value">{detail?.replicationInsight.destinationBucket ?? "--"}</p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Destination Region</p>
                <p className="s3-lifecycle-insight-card__meta-value">{detail?.replicationInsight.destinationRegion ?? "--"}</p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Last Checked</p>
                <p className="s3-lifecycle-insight-card__meta-value">{detail?.replicationInsight.lastChecked ?? "--"}</p>
              </article>
            </div>
          </section>
          <S3BucketUsageTrendPanel
            charts={detail?.charts}
            isLoading={bucketDetailQuery.isLoading && !bucketDetailQuery.data}
            isError={bucketDetailQuery.isError && !bucketDetailQuery.data}
            errorMessage={bucketDetailQuery.error?.message}
          />
        </>
      ) : null}
    </div>
  );
}
