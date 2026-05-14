import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { type S3CostInsightsFiltersQuery } from "../../api/dashboardApi";
import { useS3BucketLifecycleInsightQuery, useS3CostInsightsQuery } from "../../hooks/useDashboardQueries";
import { S3BucketDetailPanel } from "./components/S3BucketDetailPanel";
import { type S3BucketTableRow } from "./components/S3BucketInsightsTable";
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

const parseListParam = (value: string | null): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export default function S3UsageBucketDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ bucketName: string }>();
  const bucketNameParam = decodeURIComponent(params.bucketName ?? "").trim();

  const queryFilters = useMemo<S3CostInsightsFiltersQuery>(() => {
    const search = new URLSearchParams(location.search);
    const costBy = search.get("s3CostBy");
    const yAxisMetric = search.get("s3YAxisMetric");
    const seriesValues = parseListParam(search.get("s3SeriesValues"));
    const storageClass = parseListParam(search.get("s3StorageClass"));
    const region = (search.get("s3Region") ?? "").trim();
    const category = (search.get("s3Category") ?? "").trim();

    const costCategory =
      category === "storage" ? ["Storage"] : category === "data_transfer" ? ["Transfer"] : category === "request" ? ["Request"] : [];

    return {
      ...(seriesValues.length > 0 ? { seriesValues } : {}),
      ...(storageClass.length > 0 ? { storageClass } : {}),
      ...(region ? { region: [region] } : {}),
      ...(costCategory.length > 0 ? { costCategory: costCategory as S3CostInsightsFiltersQuery["costCategory"] } : {}),
      seriesBy: "bucket",
      ...(costBy ? { costBy: costBy as NonNullable<S3CostInsightsFiltersQuery["costBy"]> } : {}),
      ...(yAxisMetric ? { yAxisMetric: yAxisMetric as NonNullable<S3CostInsightsFiltersQuery["yAxisMetric"]> } : {}),
    };
  }, [location.search]);

  const lifecycleInsightQuery = useS3BucketLifecycleInsightQuery(bucketNameParam || null);
  const bucketDetailQuery = useS3CostInsightsQuery(
    {
      ...queryFilters,
      bucket: bucketNameParam,
      responseMode: "overview",
    },
    { enabled: bucketNameParam.length > 0, staleTime: 180_000 },
  );
  const usageByTypeTrendQuery = useS3CostInsightsQuery({
    ...queryFilters,
    bucket: bucketNameParam,
    costCategory: ["Storage", "Transfer", "Request"],
    seriesBy: "cost_category",
    costBy: "date",
    yAxisMetric: "usage_quantity",
    responseMode: "quick",
  }, { enabled: bucketNameParam.length > 0, staleTime: 180_000 });
  const rows = useMemo(() => (bucketDetailQuery.data?.bucketTable ?? []) as S3BucketTableRow[], [bucketDetailQuery.data?.bucketTable]);
  const selectedBucket = useMemo(() => {
    const normalized = bucketNameParam.toLowerCase();
    return rows.find((row) => String(row.bucketName ?? "").trim().toLowerCase() === normalized) ?? null;
  }, [bucketNameParam, rows]);

  const usageMetrics = useMemo(() => {
    const sumByCategory = (
      categoryName: "storage" | "transfer" | "request",
    ): number =>
      (usageByTypeTrendQuery.data?.chart.breakdown.series ?? [])
        .filter((item) => String(item.name ?? "").trim().toLowerCase().includes(categoryName))
        .flatMap((item) => item.values)
        .reduce<number>((sum, value) => sum + Number(value ?? 0), 0);

    return {
      storageGb: sumByCategory("storage"),
      transferGb: sumByCategory("transfer"),
      requestCount: sumByCategory("request"),
    };
  }, [usageByTypeTrendQuery.data?.chart.breakdown.series]);

  const storageClassDistribution = useMemo(
    () =>
      (selectedBucket?.storageLens?.storageClassDistribution ?? [])
        .map((item) => ({
          name: String(item.name ?? "Unknown"),
          usage: Number(item.bytes ?? 0) / 1024 ** 3,
        }))
        .sort((a, b) => b.usage - a.usage),
    [selectedBucket?.storageLens?.storageClassDistribution],
  );

  const lifecycleInsight = lifecycleInsightQuery.data?.insight ?? null;
  const effectiveLifecycleInsight = lifecycleInsight;
  const lifecycleStatusLabel = useMemo(() => {
    if (!effectiveLifecycleInsight?.lifecycleStatus) return effectiveLifecycleInsight?.hasLifecyclePolicy ? "Present" : "Unknown";
    return String(effectiveLifecycleInsight.lifecycleStatus)
      .trim()
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }, [effectiveLifecycleInsight?.hasLifecyclePolicy, effectiveLifecycleInsight?.lifecycleStatus]);

  const lifecycleStatusTone = useMemo(() => {
    const risk = effectiveLifecycleInsight?.riskLevel ?? "";
    if (risk === "low") return "good";
    if (risk === "medium") return "warn";
    if (risk === "high") return "critical";
    return "unknown";
  }, [effectiveLifecycleInsight?.riskLevel]);

  const lifecycleScanLabel = useMemo(() => {
    const value = effectiveLifecycleInsight?.scanTime;
    if (!value) return "--";
    const scanDate = new Date(value);
    if (Number.isNaN(scanDate.getTime())) return "--";
    return scanDate.toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit" });
  }, [effectiveLifecycleInsight?.scanTime]);

  const shouldShowCreatePolicyButton = useMemo(() => {
    if (!effectiveLifecycleInsight) return false;
    if (effectiveLifecycleInsight.hasLifecyclePolicy === false) return true;
    return Number(effectiveLifecycleInsight.lifecycleRulesCount ?? 0) === 0;
  }, [effectiveLifecycleInsight]);

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
    const value = String(selectedBucket?.replicationStatus ?? "").trim().toLowerCase();
    if (value === "present") return "Present";
    if (value === "enabled") return "Present";
    if (value === "absent") return "Missing";
    if (value === "disabled") return "Missing";
    if (value === "unknown") return "Unknown";
    return "Not Available";
  }, [selectedBucket?.replicationStatus]);

  const replicationStatusTone = useMemo(() => {
    const value = String(selectedBucket?.replicationStatus ?? "").trim().toLowerCase();
    if (value === "present") return "good";
    if (value === "enabled") return "good";
    if (value === "absent") return "critical";
    if (value === "disabled") return "critical";
    if (value === "unknown") return "warn";
    return "unknown";
  }, [selectedBucket?.replicationStatus]);

  const objectInsights = useMemo(() => {
    if (!selectedBucket) {
      return {
        statusTone: "unknown" as "good" | "warn" | "critical" | "unknown",
        headline: "Object metrics are unavailable for this bucket.",
        recommendation: "Open another bucket or expand date range to load Storage Lens object-level metrics.",
        objectCount: null as number | null,
        avgObjectSizeBytes: null as number | null,
        currentVersionBytes: 0,
        requestsPerObject: null as number | null,
        findings: [] as string[],
      };
    }

    const objectCount = selectedBucket.storageLens?.objectCount ?? null;
    const avgObjectSizeBytes = selectedBucket.storageLens?.avgObjectSizeBytes ?? null;
    const currentVersionBytes =
      selectedBucket.storageLens?.currentVersionBytes ??
      Math.max(Number(usageMetrics.storageGb ?? 0), 0) * 1024 * 1024 * 1024;
    const requestCount = Math.max(Number(usageMetrics.requestCount ?? 0), 0);
    const requestsPerObject = objectCount != null && objectCount > 0 ? requestCount / objectCount : null;

    const smallObjectPressure =
      objectCount != null &&
      objectCount > 1_000_000 &&
      avgObjectSizeBytes != null &&
      avgObjectSizeBytes < 128 * 1024;
    const coldLargeObjectPattern =
      avgObjectSizeBytes != null &&
      avgObjectSizeBytes > 64 * 1024 * 1024 &&
      requestCount < 5_000;
    const highCurrentVersionFootprint = currentVersionBytes > 500 * 1024 * 1024 * 1024;

    let statusTone: "good" | "warn" | "critical" | "unknown" = "good";
    if (smallObjectPressure) statusTone = "critical";
    else if (coldLargeObjectPattern || highCurrentVersionFootprint) statusTone = "warn";

    const findings: string[] = [];
    if (smallObjectPressure) {
      findings.push("Very high object count with small average object size can inflate request overhead and index pressure.");
    }
    if (coldLargeObjectPattern) {
      findings.push("Large-object, low-access pattern suggests lifecycle transition or archival optimization potential.");
    }
    if (highCurrentVersionFootprint) {
      findings.push("Current-version storage footprint is high; validate retention windows and duplicate object patterns.");
    }
    if (requestsPerObject != null && requestsPerObject > 10) {
      findings.push("High requests per object indicates request-heavy access behavior; cache/read pattern tuning may reduce cost.");
    }
    if (findings.length === 0) {
      findings.push("Object profile looks stable for current range with no strong risk signal.");
    }

    const headline =
      statusTone === "critical"
        ? "Object profile needs immediate review."
        : statusTone === "warn"
          ? "Object profile has optimization opportunities."
          : "Object profile is currently healthy.";

    const recommendation =
      statusTone === "critical"
        ? "Prioritize object compaction/aggregation and review producer behavior for small-object explosion."
        : statusTone === "warn"
          ? "Review lifecycle transitions and access pattern alignment for object-size and request profile."
          : "Continue monitoring object growth, size mix, and request intensity weekly.";

    return {
      statusTone,
      headline,
      recommendation,
      objectCount,
      avgObjectSizeBytes,
      currentVersionBytes,
      requestsPerObject,
      findings,
    };
  }, [selectedBucket, usageMetrics.requestCount, usageMetrics.storageGb]);

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
            storageClassDistribution={storageClassDistribution}
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
                  {objectInsights.avgObjectSizeBytes == null ? "--" : formatBytesCompact(objectInsights.avgObjectSizeBytes)}
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
            {!selectedBucket.storageLens ? (
              <p className="s3-lifecycle-insight-card__error">
                Storage Lens object metrics are not available for this bucket in current scope.
              </p>
            ) : null}
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
                <span className={`s3-lifecycle-insight-card__status is-${lifecycleStatusTone}`}>
                  {lifecycleStatusLabel}
                </span>
              </div>
            </div>
            <div className="s3-lifecycle-insight-card__meta">
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Rules Count</p>
                <p className="s3-lifecycle-insight-card__meta-value">{effectiveLifecycleInsight?.lifecycleRulesCount ?? "--"}</p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Enabled Rules</p>
                <p className="s3-lifecycle-insight-card__meta-value">{effectiveLifecycleInsight?.enabledRulesCount ?? "--"}</p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Transition Coverage</p>
                <p className="s3-lifecycle-insight-card__meta-value">{effectiveLifecycleInsight?.transitionRulesCount ?? "--"}</p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Last Scan</p>
                <p className="s3-lifecycle-insight-card__meta-value">{lifecycleScanLabel}</p>
              </article>
            </div>
            {lifecycleInsightQuery.isError ? (
              <p className="s3-lifecycle-insight-card__error">
                Failed to load lifecycle snapshot: {lifecycleInsightQuery.error.message}
              </p>
            ) : null}
          </section>
          <section className="s3-lifecycle-insight-card" aria-label="Replication insight">
            <div className="s3-lifecycle-insight-card__header">
              <h3 className="s3-lifecycle-insight-card__title">Replication Insight</h3>
              <div className="s3-lifecycle-insight-card__header-actions">
                <button type="button" className="s3-lifecycle-insight-card__create-policy-btn" onClick={handleOpenReplicationOptimization}>
                  {selectedBucket?.replicationStatus ? "Manage Replication" : "Setup Replication"}
                </button>
                <span className={`s3-lifecycle-insight-card__status is-${replicationStatusTone}`}>
                  {replicationStatusLabel}
                </span>
              </div>
            </div>
            <div className="s3-lifecycle-insight-card__meta">
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Rules Count</p>
                <p className="s3-lifecycle-insight-card__meta-value">--</p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Destination Bucket</p>
                <p className="s3-lifecycle-insight-card__meta-value">--</p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Destination Region</p>
                <p className="s3-lifecycle-insight-card__meta-value">--</p>
              </article>
              <article className="s3-lifecycle-insight-card__meta-item">
                <p className="s3-lifecycle-insight-card__meta-label">Last Checked</p>
                <p className="s3-lifecycle-insight-card__meta-value">--</p>
              </article>
            </div>
            {!selectedBucket?.replicationStatus ? (
              <p className="s3-lifecycle-insight-card__headline">
                Replication status is not available for this bucket.
              </p>
            ) : null}
            {!selectedBucket?.replicationStatus ? (
              <p className="s3-lifecycle-insight-card__recommendation">
                No replication status found for this bucket. Use Setup Replication to open S3 Optimization directly on the replication tab.
              </p>
            ) : null}
          </section>
          <S3BucketUsageTrendPanel
            breakdown={usageByTypeTrendQuery.data?.chart.breakdown}
            isLoading={usageByTypeTrendQuery.isLoading && !usageByTypeTrendQuery.data}
            isError={usageByTypeTrendQuery.isError && !usageByTypeTrendQuery.data}
            errorMessage={usageByTypeTrendQuery.error?.message}
          />
        </>
      ) : null}
    </div>
  );
}
