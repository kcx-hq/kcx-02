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

const computeTrend = (current: number | null, previous: number | null): "up" | "down" | "flat" | "unknown" => {
  if (current == null || previous == null) return "unknown";
  if (previous === 0 && current === 0) return "flat";
  if (previous === 0 && current > 0) return "up";
  const deltaPct = ((current - previous) / Math.abs(previous || 1)) * 100;
  if (Math.abs(deltaPct) < 2) return "flat";
  return deltaPct > 0 ? "up" : "down";
};

const normalizeStorageClass = (value: string): string => value.trim().toUpperCase().replace(/[\s-]+/g, "_");
const toLower = (value: string | null | undefined): string => String(value ?? "").trim().toLowerCase();

export class S3BucketDetailService {
  constructor(private readonly repository: S3BucketDetailRepository = new S3BucketDetailRepository()) {}

  async getBucketDetail(scope: DashboardScope, bucketName: string): Promise<S3BucketDetailResponse> {
    const normalizedBucketName = decodeURIComponent(bucketName).trim();
    const [config, latestStorageLens, curRegionFallback, requestSeries, transferSeries, storageSeries, estimatedCurrentVersionBytes, costBreakdown, costTrend, storageClassBreakdown, activityUsageSeries, requestOperationBreakdownRows, transferBreakdownRows] = await Promise.all([
      this.repository.getBucketConfig(scope, normalizedBucketName),
      this.repository.getLatestStorageLens(scope, normalizedBucketName),
      this.repository.getCurRegionFallback(scope, normalizedBucketName),
      this.repository.getRequestSeries(scope, normalizedBucketName),
      this.repository.getTransferSeries(scope, normalizedBucketName),
      this.repository.getStorageSeries(scope, normalizedBucketName),
      this.repository.getEstimatedCurrentVersionBytes(scope, normalizedBucketName),
      this.repository.getCostBreakdown(scope, normalizedBucketName),
      this.repository.getCostTrend(scope, normalizedBucketName),
      this.repository.getStorageClassBreakdown(scope, normalizedBucketName),
      this.repository.getActivityUsageSeries(scope, normalizedBucketName),
      this.repository.getRequestOperationBreakdown(scope, normalizedBucketName),
      this.repository.getTransferBreakdown(scope, normalizedBucketName),
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

    const versioningStatusNormalized: "enabled" | "suspended" | "disabled" | "unknown" = (() => {
      const raw = toLower(config?.versioning_status);
      if (!raw) return "unknown";
      if (raw.includes("enabled")) return "enabled";
      if (raw.includes("suspended")) return "suspended";
      if (raw.includes("disabled") || raw.includes("off")) return "disabled";
      return "unknown";
    })();

    const encryptionStatusNormalized: "enabled" | "disabled" | "unknown" = (() => {
      const raw = toLower(config?.encryption_status);
      if (!raw) return "unknown";
      if (raw.includes("enabled") || raw.includes("on")) return "enabled";
      if (raw.includes("disabled") || raw.includes("off")) return "disabled";
      return "unknown";
    })();
    const encryptionTypeNormalized: "SSE-S3" | "SSE-KMS" | "Unknown" | null = (() => {
      const raw = toLower(config?.encryption_type);
      if (!raw) return encryptionStatusNormalized === "unknown" ? null : "Unknown";
      if (raw.includes("kms")) return "SSE-KMS";
      if (raw.includes("s3") || raw.includes("aes256")) return "SSE-S3";
      return "Unknown";
    })();

    const publicAccessStatusNormalized: "blocked" | "partial" | "public" | "unknown" = (() => {
      const blockFlags = [
        config?.block_public_acls,
        config?.ignore_public_acls,
        config?.block_public_policy,
        config?.restrict_public_buckets,
      ];
      const knownFlags = blockFlags.filter((value): value is boolean => typeof value === "boolean");
      if (knownFlags.length > 0) {
        const enabledCount = knownFlags.filter(Boolean).length;
        if (enabledCount === knownFlags.length) return "blocked";
        if (enabledCount === 0) return "public";
        return "partial";
      }

      const blockStatus = toLower(config?.public_access_block_status);
      if (blockStatus.includes("block")) return "blocked";
      if (blockStatus.includes("partial")) return "partial";
      if (blockStatus.includes("public")) return "public";

      const policyStatus = toLower(config?.policy_public_status);
      if (policyStatus.includes("public")) return "public";
      if (policyStatus.includes("private") || policyStatus.includes("blocked")) return "blocked";
      return "unknown";
    })();

    const window = this.repository.getLast30DaysWindow(scope);
    const storageUsage = window.labels.map((date) => ({ date, value: storageSeries.has(date) ? storageSeries.get(date) ?? null : null }));
    const requestUsage = window.labels.map((date) => ({ date, value: requestSeries.has(date) ? requestSeries.get(date) ?? null : null }));
    const transferUsage = window.labels.map((date) => ({ date, value: transferSeries.has(date) ? transferSeries.get(date) ?? null : null }));

    const totalGetRequests = activityUsageSeries.reduce((sum, row) => sum + row.getRequestsCount, 0);
    const totalPutRequests = activityUsageSeries.reduce((sum, row) => sum + row.putRequestsCount, 0);
    const totalRequestsFromLens = totalGetRequests + totalPutRequests;
    const totalRequests = totalRequestsFromLens > 0 ? totalRequestsFromLens : Number(requestCount ?? 0);
    const latestActivity = activityUsageSeries[activityUsageSeries.length - 1] ?? null;
    const previousActivity = activityUsageSeries.length > 1 ? activityUsageSeries[activityUsageSeries.length - 2] : null;
    const latestRequestCount = latestActivity ? latestActivity.getRequestsCount + latestActivity.putRequestsCount : null;
    const previousRequestCount = previousActivity ? previousActivity.getRequestsCount + previousActivity.putRequestsCount : null;
    const latestStorageBytes = latestActivity?.currentVersionBytes ?? null;
    const previousStorageBytes = previousActivity?.currentVersionBytes ?? null;
    const transferValues = window.labels.map((date) => transferSeries.get(date)).filter((value): value is number => typeof value === "number");
    const latestTransferGb = transferValues.length > 0 ? transferValues[transferValues.length - 1] : null;
    const previousTransferGb = transferValues.length > 1 ? transferValues[transferValues.length - 2] : null;

    const requestBreakdownAvailable = requestOperationBreakdownRows.length > 0;
    const requestBreakdownTotal = requestOperationBreakdownRows.reduce((sum, row) => sum + row.count, 0);
    const requestBreakdown = requestOperationBreakdownRows.map((row) => ({
      operation: row.operation,
      count: row.count,
      percentage: requestBreakdownTotal > 0 ? Number(((row.count / requestBreakdownTotal) * 100).toFixed(2)) : 0,
    }));

    const transferBreakdownAvailable = transferBreakdownRows.length > 0;
    const transferBreakdownTotalBytes = transferBreakdownRows.reduce((sum, row) => sum + row.bytes, 0);
    const transferBreakdown = transferBreakdownRows.map((row) => ({
      type: row.type,
      bytes: row.bytes,
      percentage: transferBreakdownTotalBytes > 0 ? Number(((row.bytes / transferBreakdownTotalBytes) * 100).toFixed(2)) : 0,
    }));
    const hasUsageData = totalRequests > 0 || (latestActivity?.objectCount ?? 0) > 0 || (latestActivity?.currentVersionBytes ?? 0) > 0;
    const insight =
      !hasUsageData
        ? null
        : totalRequestsFromLens > 0 && totalGetRequests >= totalPutRequests * 2
          ? "This bucket is request-heavy with predominantly read operations."
          : (latestActivity?.currentVersionBytes ?? 0) > 0 && totalRequests < 100
            ? "Bucket activity is low and mostly archival."
            : requestBreakdownAvailable
              ? "Transfer activity is minimal compared to request volume."
              : "Request operation breakdown is not available for this bucket.";

    const optimizationOpportunities: S3BucketDetailResponse["optimization"]["opportunities"] = [];

    if (config != null) {
      const lifecycleStatus = String(config.lifecycle_status ?? "").trim().toLowerCase();
      if (!lifecycleStatus || lifecycleStatus === "absent" || lifecycleRulesCount <= 0) {
        optimizationOpportunities.push({
          id: "no-lifecycle-policy",
          title: "No Lifecycle Policy",
          severity: "medium",
          category: "lifecycle",
          description: "Lifecycle configuration is missing or has zero active rules.",
          recommendation: "Review lifecycle transitions for stale or infrequently accessed objects.",
          estimatedSavings: null,
          source: "s3_bucket_config_snapshot",
          evidence: {
            lifecycleStatus: config.lifecycle_status ?? null,
            lifecycleRulesCount,
          },
          action: {
            type: "navigate",
            route: "/dashboard/s3/optimization",
            query: {
              tab: "lifecycle",
            },
            label: "Review lifecycle rules",
          },
        });
      }
    }

    if (storageClassBreakdown.length > 0) {
      const byClass = new Map<string, number>();
      let totalStorageBytes = 0;
      for (const row of storageClassBreakdown) {
        const normalized = normalizeStorageClass(String(row.storageClass ?? ""));
        const bytes = Math.max(0, Number(row.bytes ?? 0));
        if (!normalized || bytes <= 0) continue;
        byClass.set(normalized, (byClass.get(normalized) ?? 0) + bytes);
        totalStorageBytes += bytes;
      }

      if (totalStorageBytes > 0) {
        const standardBytes = byClass.get("STANDARD") ?? 0;
        const archiveIaBytes = (byClass.get("STANDARD_IA") ?? 0)
          + (byClass.get("ONEZONE_IA") ?? 0)
          + (byClass.get("GLACIER") ?? 0)
          + (byClass.get("DEEP_ARCHIVE") ?? 0);
        const standardPct = (standardBytes / totalStorageBytes) * 100;
        const archiveIaPct = (archiveIaBytes / totalStorageBytes) * 100;
        if (standardPct >= 70 && archiveIaPct <= 20) {
          optimizationOpportunities.push({
            id: "large-standard-storage-footprint",
            title: "Large Standard Storage Footprint",
            severity: "medium",
            category: "storage",
            description: "Most storage remains in Standard class with low IA/archive allocation.",
            recommendation: "Evaluate lifecycle transitions to IA/Glacier tiers for colder objects.",
            estimatedSavings: null,
            source: "s3_storage_lens_daily",
            evidence: {
              standardPercentage: Number(standardPct.toFixed(2)),
              archiveIaPercentage: Number(archiveIaPct.toFixed(2)),
              storageClassCount: storageClassBreakdown.length,
            },
          });
        }
      }
    }

    if (activityUsageSeries.length > 0) {
      const totalRequestsForRule = totalRequests;
      const transferGbForRule = transferGb ?? 0;
      if ((storageGb ?? 0) >= 50 && totalRequestsForRule <= 200 && transferGbForRule <= 1) {
        optimizationOpportunities.push({
          id: "low-activity-bucket",
          title: "Low Activity Bucket",
          severity: "low",
          category: "activity",
          description: "Request and transfer usage are low relative to the bucket storage footprint.",
          recommendation: "Validate retention requirements and consider archival or cleanup actions.",
          estimatedSavings: null,
          source: "s3_storage_lens_daily+s3_cost_daily",
          evidence: {
            totalRequests: totalRequestsForRule,
            transferGb: Number(transferGbForRule.toFixed(4)),
            storageGb: Number((storageGb ?? 0).toFixed(4)),
          },
        });
      }
    }

    const ownerRaw = String(config?.owner ?? "").trim();
    const environmentRaw = String(config?.environment ?? "").trim();
    const missingOwner = ownerRaw.length === 0 || ownerRaw.toLowerCase() === "unassigned";
    const missingEnvironment = environmentRaw.length === 0 || environmentRaw.toLowerCase() === "n/a";
    if (config != null && (missingOwner || missingEnvironment)) {
      optimizationOpportunities.push({
        id: "missing-ownership-metadata",
        title: "Missing Ownership Metadata",
        severity: "info",
        category: "governance",
        description: "Bucket ownership/environment metadata is incomplete.",
        recommendation: "Populate owner and environment metadata/tags for accountability and allocation.",
        estimatedSavings: null,
        source: "s3_bucket_config_snapshot",
        evidence: {
          owner: config.owner ?? null,
          environment: config.environment ?? null,
        },
      });
    }

    if (config != null && (versioningStatusNormalized === "disabled" || versioningStatusNormalized === "suspended")) {
      optimizationOpportunities.push({
        id: "versioning-disabled",
        title: "Versioning Disabled",
        severity: "info",
        category: "configuration",
        description: "Object recovery protection is not enabled for this bucket.",
        recommendation: "Enable bucket versioning for recovery and change protection.",
        estimatedSavings: null,
        source: "s3_bucket_config_snapshot",
        evidence: {
          versioningStatus: config.versioning_status ?? null,
          normalizedVersioningStatus: versioningStatusNormalized,
        },
      });
    }

    if (config != null && versioningStatusNormalized === "enabled") {
      optimizationOpportunities.push({
        id: "versioning-enabled",
        title: "Versioning Enabled",
        severity: "info",
        category: "storage",
        description: "Multiple object versions may increase long-term storage usage.",
        recommendation: "Review old object versions periodically to manage storage growth.",
        estimatedSavings: null,
        source: "s3_bucket_config_snapshot",
        evidence: {
          versioningStatus: config.versioning_status ?? null,
          normalizedVersioningStatus: versioningStatusNormalized,
        },
      });
    }

    if (config != null) {
      const replicationStatus = String(config.replication_status ?? "").trim().toLowerCase();
      const replicationEnabled = replicationStatus === "enabled" || replicationStatus === "present" || replicationRulesCount > 0;
      if (replicationEnabled) {
        optimizationOpportunities.push({
          id: "replication-enabled",
          title: "Cross-Region Replication Enabled",
          severity: "info",
          category: "replication",
          description: "Replication may increase storage and transfer costs.",
          recommendation: "Review replication scope and destination usage regularly.",
          estimatedSavings: null,
          source: "s3_bucket_config_snapshot",
          evidence: {
            replicationStatus: config.replication_status ?? null,
            replicationRulesCount,
            destinationBucket,
            destinationRegion,
          },
          action: {
            type: "navigate",
            route: "/dashboard/s3/optimization",
            query: {
              tab: "replication",
            },
            label: "Review replication",
          },
        });
      }
    }

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
        publicAccess: toTitleCase(publicAccessStatusNormalized),
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
      costBreakdown,
      charts: {
        storageUsage,
        requestUsage,
        transferUsage,
        costTrend,
      },
      storageClassBreakdown,
      activityUsage: {
        totalRequests,
        transferBytes: transferGb != null ? Math.max(0, transferGb * 1024 ** 3) : null,
        objectCount: latestActivity?.objectCount ?? objectCount ?? null,
        averageObjectSizeBytes: avgObjectSize,
        requestBreakdown,
        requestBreakdownAvailable,
        transferBreakdown,
        transferBreakdownAvailable,
        trends: {
          requests: computeTrend(latestRequestCount, previousRequestCount),
          transfer: computeTrend(latestTransferGb, previousTransferGb),
          storage: computeTrend(latestStorageBytes, previousStorageBytes),
        },
        insight,
        hasUsageData,
      },
      optimization: {
        opportunities: optimizationOpportunities,
        totalCount: optimizationOpportunities.length,
      },
      configuration: (() => {
        if (!config) {
          return {
            versioning: { status: "unknown" as const },
            encryption: { status: "unknown" as const, type: null },
            lifecycle: { enabled: false, ruleCount: 0 },
            replication: { enabled: false, destinationRegion: null },
            publicAccess: { status: "unknown" as const },
            ownershipMetadata: { ownerAssigned: false, environmentAssigned: false },
            bestPractices: { passed: 0, total: 0 },
            notes: [],
          };
        }
        const lifecycleEnabled = lifecycleRulesCount > 0;
        const replicationEnabled = toLower(config?.replication_status) === "enabled" || toLower(config?.replication_status) === "present" || replicationRulesCount > 0;
        const ownerRaw = String(config?.owner ?? "").trim();
        const environmentRaw = String(config?.environment ?? "").trim();
        const ownerAssigned = ownerRaw.length > 0 && ownerRaw.toLowerCase() !== "unassigned";
        const environmentAssigned = environmentRaw.length > 0 && environmentRaw.toLowerCase() !== "n/a";

        const checks = [
          versioningStatusNormalized === "enabled",
          encryptionStatusNormalized === "enabled",
          publicAccessStatusNormalized === "blocked",
          lifecycleEnabled,
          ownerAssigned,
          environmentAssigned,
        ];
        const passed = checks.filter(Boolean).length;
        const total = checks.length;

        const notes: string[] = [];
        if (!lifecycleEnabled) notes.push("Lifecycle policy is not configured.");
        if (encryptionStatusNormalized === "disabled") notes.push("Bucket encryption is disabled.");
        if (publicAccessStatusNormalized === "public") notes.push("Public access appears to be enabled.");
        if (!ownerAssigned) notes.push("Owner metadata missing.");
        if (!environmentAssigned) notes.push("Environment metadata missing.");
        if (replicationEnabled && !destinationRegion) notes.push("Replication destination not configured.");

        return {
          versioning: { status: versioningStatusNormalized },
          encryption: { status: encryptionStatusNormalized, type: encryptionTypeNormalized },
          lifecycle: { enabled: lifecycleEnabled, ruleCount: lifecycleRulesCount },
          replication: { enabled: replicationEnabled, destinationRegion },
          publicAccess: { status: publicAccessStatusNormalized },
          ownershipMetadata: { ownerAssigned, environmentAssigned },
          bestPractices: { passed, total },
          notes,
        };
      })(),
      filtersApplied: {
        from: window.from,
        to: window.to,
        scopeType: scope.scopeType,
      },
    };
  }
}
