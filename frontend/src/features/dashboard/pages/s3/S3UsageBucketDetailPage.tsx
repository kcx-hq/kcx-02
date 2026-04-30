import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { type S3CostInsightsFiltersQuery } from "../../api/dashboardApi";
import { useS3BucketLifecycleInsightQuery, useS3CostInsightsQuery } from "../../hooks/useDashboardQueries";
import { S3BucketDetailPanel } from "./components/S3BucketDetailPanel";
import { type S3BucketTableRow } from "./components/S3BucketInsightsTable";
import { S3BucketUsageTrendPanel } from "./components/S3BucketUsageTrendPanel";

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

  const query = useS3CostInsightsQuery(queryFilters);
  const lifecycleInsightQuery = useS3BucketLifecycleInsightQuery(bucketNameParam || null);
  const storageUsageQuery = useS3CostInsightsQuery({
    ...queryFilters,
    bucket: bucketNameParam,
    costCategory: ["Storage"],
    seriesBy: "bucket",
    costBy: "date",
    yAxisMetric: "usage_quantity",
  });
  const transferUsageQuery = useS3CostInsightsQuery({
    ...queryFilters,
    bucket: bucketNameParam,
    costCategory: ["Transfer"],
    seriesBy: "bucket",
    costBy: "date",
    yAxisMetric: "usage_quantity",
  });
  const requestUsageQuery = useS3CostInsightsQuery({
    ...queryFilters,
    bucket: bucketNameParam,
    costCategory: ["Request"],
    seriesBy: "bucket",
    costBy: "date",
    yAxisMetric: "usage_quantity",
  });
  const usageByTypeTrendQuery = useS3CostInsightsQuery({
    ...queryFilters,
    bucket: bucketNameParam,
    costCategory: ["Storage", "Transfer", "Request"],
    seriesBy: "cost_category",
    costBy: "date",
    yAxisMetric: "usage_quantity",
  });
  const storageClassUsageQuery = useS3CostInsightsQuery({
    ...queryFilters,
    bucket: bucketNameParam,
    costCategory: ["Storage"],
    seriesBy: "storage_class",
    costBy: "date",
    yAxisMetric: "usage_quantity",
  });
  const rows = useMemo(() => (query.data?.bucketTable ?? []) as S3BucketTableRow[], [query.data?.bucketTable]);
  const selectedBucket = useMemo(() => {
    const normalized = bucketNameParam.toLowerCase();
    return rows.find((row) => String(row.bucketName ?? "").trim().toLowerCase() === normalized) ?? null;
  }, [bucketNameParam, rows]);

  const usageMetrics = useMemo(() => {
    const sumSeriesValues = (querySeries: { chart?: { breakdown?: { series?: Array<{ name?: string; values: Array<number | null> }> } } } | undefined) =>
      (querySeries?.chart.breakdown.series ?? [])
        .filter((item) => String(item.name ?? "").trim().toLowerCase() === bucketNameParam.toLowerCase())
        .flatMap((item) => item.values)
        .reduce((sum, value) => sum + Number(value ?? 0), 0);

    return {
      storageGb: sumSeriesValues(storageUsageQuery.data),
      transferGb: sumSeriesValues(transferUsageQuery.data),
      requestCount: sumSeriesValues(requestUsageQuery.data),
    };
  }, [bucketNameParam, requestUsageQuery.data, storageUsageQuery.data, transferUsageQuery.data]);

  const storageClassDistribution = useMemo(
    () =>
      (storageClassUsageQuery.data?.chart.breakdown.series ?? [])
        .map((series) => ({
          name: String(series.name ?? "Unknown"),
          usage: series.values.reduce((sum, value) => sum + Number(value ?? 0), 0),
        }))
        .sort((a, b) => b.usage - a.usage),
    [storageClassUsageQuery.data?.chart.breakdown.series],
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

  const handleBack = () => {
    navigate({
      pathname: "/dashboard/s3/usage",
      search: location.search,
    });
  };

  return (
    <div className="dashboard-page s3-overview-page s3-usage-bucket-detail-page">
      {query.isLoading ? <p className="dashboard-note">Loading bucket details...</p> : null}
      {query.isError ? <p className="dashboard-note">Failed to load bucket details: {query.error.message}</p> : null}
      {!query.isLoading && !query.isError && !selectedBucket ? (
        <p className="dashboard-note">No bucket details found for "{bucketNameParam}".</p>
      ) : null}
      {!query.isLoading && !query.isError && selectedBucket ? (
        <>
          <S3BucketDetailPanel
            bucket={selectedBucket}
            usageMetrics={usageMetrics}
            storageClassDistribution={storageClassDistribution}
            storageLens={selectedBucket.storageLens ?? null}
            onClose={handleBack}
          />
          <section className="s3-lifecycle-insight-card" aria-label="Lifecycle policy insight">
            <div className="s3-lifecycle-insight-card__header">
              <h3 className="s3-lifecycle-insight-card__title">Lifecycle Policy Insight</h3>
              <span className={`s3-lifecycle-insight-card__status is-${lifecycleStatusTone}`}>
                {lifecycleStatusLabel}
              </span>
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
            <p className="s3-lifecycle-insight-card__headline">
              {effectiveLifecycleInsight?.headline ?? "Lifecycle policy status is not available yet for this bucket."}
            </p>
            <p className="s3-lifecycle-insight-card__recommendation">
              {effectiveLifecycleInsight?.recommendation ?? "Run S3 bucket config snapshot sync to load lifecycle metadata."}
            </p>
            {Array.isArray(effectiveLifecycleInsight?.topRules) && effectiveLifecycleInsight.topRules.length > 0 ? (
              <div className="s3-lifecycle-insight-card__rules">
                <p className="s3-lifecycle-insight-card__rules-title">Top Lifecycle Rules</p>
                <div className="s3-lifecycle-insight-card__rules-grid">
                  {effectiveLifecycleInsight.topRules.map((rule, idx) => (
                    <article key={`${rule.id ?? "rule"}-${idx}`} className="s3-lifecycle-insight-card__rule">
                      <p className="s3-lifecycle-insight-card__rule-name">{rule.id || `Rule ${idx + 1}`}</p>
                      <p className="s3-lifecycle-insight-card__rule-meta">
                        {rule.status} • Transition: {rule.hasTransition ? "Yes" : "No"} • Expiration: {rule.hasExpiration ? "Yes" : "No"}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            {lifecycleInsightQuery.isError ? (
              <p className="s3-lifecycle-insight-card__error">
                Failed to load lifecycle snapshot: {lifecycleInsightQuery.error.message}
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
