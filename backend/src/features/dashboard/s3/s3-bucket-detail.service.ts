import type { DashboardScope } from "../dashboard.types.js";
import { S3BucketDetailRepository } from "./s3-bucket-detail.repository.js";
import type { S3BucketDetailResponse } from "./s3-bucket-detail.types.js";

const toTitleCase = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const normalizeRegion = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (normalized.toLowerCase() === "global") return null;
  return normalized;
};

export class S3BucketDetailService {
  constructor(private readonly repository: S3BucketDetailRepository = new S3BucketDetailRepository()) {}

  async getBucketDetail(scope: DashboardScope, bucketName: string): Promise<S3BucketDetailResponse> {
    const normalizedBucketName = decodeURIComponent(bucketName).trim();
    const [config, latestStorageLens, curRegionFallback, requestSeries, transferSeries, storageSeries, estimatedCurrentVersionBytes] = await Promise.all([
      this.repository.getBucketConfig(scope, normalizedBucketName),
      this.repository.getLatestStorageLens(scope, normalizedBucketName),
      this.repository.getCurRegionFallback(scope, normalizedBucketName),
      this.repository.getRequestSeries(scope, normalizedBucketName),
      this.repository.getTransferSeries(scope, normalizedBucketName),
      this.repository.getStorageSeries(scope, normalizedBucketName),
      this.repository.getEstimatedCurrentVersionBytes(scope, normalizedBucketName),
    ]);

    const region =
      normalizeRegion(config?.region) ??
      normalizeRegion(latestStorageLens?.region) ??
      normalizeRegion(curRegionFallback) ??
      "unknown";

    const currentVersionBytesExact = this.repository.parseNumber(latestStorageLens?.current_version_bytes);
    const currentVersionBytesResolved = currentVersionBytesExact ?? estimatedCurrentVersionBytes;
    const currentVersionBytesEstimated = currentVersionBytesExact == null && estimatedCurrentVersionBytes != null;
    const storageGb = currentVersionBytesResolved != null
      ? Number((currentVersionBytesResolved / 1073741824).toFixed(5))
      : null;

    const requestCount = requestSeries.size > 0
      ? Number(Array.from(requestSeries.values()).reduce((sum, value) => sum + value, 0).toFixed(5))
      : null;
    const transferGb = transferSeries.size > 0
      ? Number(Array.from(transferSeries.values()).reduce((sum, value) => sum + value, 0).toFixed(5))
      : null;

    const objectCountRaw = this.repository.parseNumber(latestStorageLens?.object_count);
    const objectCount = objectCountRaw != null ? Number(objectCountRaw) : null;
    const currentVersionBytes = currentVersionBytesResolved != null ? Number(currentVersionBytesResolved) : null;
    const avgObjectSize = latestStorageLens?.avg_object_size_bytes != null
      ? Number(this.repository.parseNumber(latestStorageLens.avg_object_size_bytes) ?? 0)
      : objectCount != null && objectCount > 0 && currentVersionBytesExact != null
        ? Number((currentVersionBytesExact / objectCount).toFixed(2))
        : null;
    const requestsPerObject = requestCount != null && objectCount != null && objectCount > 0
      ? Number((requestCount / objectCount).toFixed(5))
      : null;

    const lifecycleRulesCount = Math.max(0, Number(this.repository.parseNumber(config?.lifecycle_rules_count) ?? 0));
    const enabledRulesCount = Math.max(0, Number(this.repository.parseNumber(config?.enabled_lifecycle_rules_count) ?? 0));
    const transitionRulesCount = Math.max(0, Number(this.repository.parseNumber(config?.transition_rules_count) ?? 0));
    const transitionCoverage = lifecycleRulesCount > 0 ? Number(((transitionRulesCount / lifecycleRulesCount) * 100).toFixed(2)) : 0;

    const replicationRulesCount = Math.max(0, Number(this.repository.parseNumber(config?.replication_rules_count) ?? 0));
    let destinationBucket: string | null = null;
    let destinationRegion: string | null = null;
    const replicationRoot =
      config?.replication_config_json && typeof config.replication_config_json === "object"
        ? (config.replication_config_json as { Rules?: unknown })
        : null;
    const rules = Array.isArray(replicationRoot?.Rules) ? replicationRoot.Rules : [];
    const firstRule = rules.find((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") ?? null;
    const destination =
      firstRule && typeof firstRule.Destination === "object" && firstRule.Destination
        ? (firstRule.Destination as Record<string, unknown>)
        : null;
    const destinationArn = destination && typeof destination.Bucket === "string" ? destination.Bucket : null;
    if (destinationArn && destinationArn.startsWith("arn:aws:s3:::")) {
      destinationBucket = destinationArn.slice("arn:aws:s3:::".length).trim() || null;
    }
    if (!destinationBucket && destination && typeof destination.BucketName === "string") {
      destinationBucket = destination.BucketName.trim() || null;
    }
    if (destination && typeof destination.Region === "string") {
      destinationRegion = destination.Region.trim() || null;
    }

    const window = this.repository.getLast30DaysWindow(scope);
    const storageUsage = window.labels.map((date) => ({ date, value: storageSeries.has(date) ? storageSeries.get(date) ?? null : null }));
    const requestUsage = window.labels.map((date) => ({ date, value: requestSeries.has(date) ? requestSeries.get(date) ?? null : null }));
    const transferUsage = window.labels.map((date) => ({ date, value: transferSeries.has(date) ? transferSeries.get(date) ?? null : null }));

    return {
      section: "s3-bucket-detail",
      title: "S3 Bucket Detail",
      message: "S3 bucket detail loaded",
      bucketName: normalizedBucketName,
      metadata: {
        accountId: config?.account_id ? String(config.account_id) : null,
        region,
        owner: config?.owner ? String(config.owner) : null,
        environment: config?.environment ? String(config.environment) : null,
        encryption: toTitleCase(config?.encryption_status),
        versioning: toTitleCase(config?.versioning_status),
        publicAccess: toTitleCase(config?.public_access_status),
      },
      objectInsights: {
        objectCount,
        avgObjectSize,
        currentVersionBytes,
        currentVersionBytesEstimated,
        requestsPerObject,
      },
      lifecycleInsight: {
        rulesCount: lifecycleRulesCount,
        enabledRules: enabledRulesCount,
        transitionCoverage,
        lastScan: config?.scan_time ? String(config.scan_time) : null,
        status: String(config?.lifecycle_status ?? "unknown"),
      },
      replicationInsight: {
        rulesCount: replicationRulesCount,
        destinationBucket,
        destinationRegion,
        lastChecked: config?.scan_time ? String(config.scan_time) : null,
        status: String(config?.replication_status ?? "unknown"),
      },
      usageMetrics: {
        storageGb,
        requestCount,
        transferGb,
        objectCount,
      },
      charts: {
        storageUsage,
        requestUsage,
        transferUsage,
      },
      filtersApplied: {
        from: window.from,
        to: window.to,
        scopeType: scope.scopeType,
      },
    };
  }
}
