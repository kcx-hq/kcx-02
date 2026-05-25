import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Database,
  ExternalLink,
  Files,
  GitBranch,
  Lock,
  MoreVertical,
  Shield,
  Tags,
  UserRound,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useS3BucketDetailQuery } from "../../hooks/useDashboardQueries";
import type { S3BucketTableRow } from "./components/S3BucketInsightsTable.types";
import { S3BucketUsageTrendPanel } from "./components/S3BucketUsageTrendPanel";

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tinyCurrencyFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 7 });
const SUMMARY_SEPARATOR = " \u00B7 ";

type CostDriverRow = {
  key: "storage" | "request" | "transfer" | "other";
  label: string;
  value: number;
  pct: number;
  color: string;
};

const formatBytesCompact = (bytes: number): string => {
  if (bytes >= 1024 ** 4) return `${decimalFormatter.format(bytes / (1024 ** 4))} TiB`;
  if (bytes >= 1024 ** 3) return `${decimalFormatter.format(bytes / (1024 ** 3))} GiB`;
  if (bytes >= 1024 ** 2) return `${decimalFormatter.format(bytes / (1024 ** 2))} MiB`;
  if (bytes >= 1024) return `${decimalFormatter.format(bytes / 1024)} KiB`;
  return `${integerFormatter.format(bytes)} B`;
};

const formatCurrencySmart = (value: number): string => {
  if (value === 0) return "$0.00";
  if (Math.abs(value) < 0.01) return `$${tinyCurrencyFormatter.format(value)}`;
  return `$${decimalFormatter.format(value)}`;
};

const toSeverityLabel = (severity: "high" | "medium" | "low" | "info"): string => {
  if (severity === "high") return "High";
  if (severity === "medium") return "Medium";
  if (severity === "low") return "Low";
  return "Info";
};

const toInsightAvailabilityLabel = (insight: {
  title?: string | null;
  description?: string | null;
  recommendation?: string | null;
}): "Missing" | "Available" => {
  const content = `${insight.title ?? ""} ${insight.description ?? ""} ${insight.recommendation ?? ""}`.toLowerCase();
  const missingSignals = [
    "not configured",
    "no ",
    "missing",
    "disabled",
    "not active",
    "unavailable",
    "not enabled",
    "without ",
  ];
  return missingSignals.some((signal) => content.includes(signal)) ? "Missing" : "Available";
};

const toConfigTone = (value: string): "positive" | "warning" | "neutral" => {
  const normalized = value.toLowerCase();
  if (normalized.includes("enabled") || normalized.includes("blocked") || normalized.includes("assigned") || normalized.includes("configured")) return "positive";
  if (normalized.includes("missing") || normalized.includes("disabled") || normalized.includes("public") || normalized.includes("partial")) return "warning";
  return "neutral";
};

const getOptimizationIconMeta = (category: string): {
  icon: typeof Clock3;
  tone: "lifecycle" | "storage" | "governance" | "versioning" | "replication";
} => {
  if (category === "lifecycle") return { icon: Clock3, tone: "lifecycle" };
  if (category === "storage") return { icon: Database, tone: "storage" };
  if (category === "governance") return { icon: UserRound, tone: "governance" };
  if (category === "configuration") return { icon: Files, tone: "versioning" };
  if (category === "replication") return { icon: GitBranch, tone: "replication" };
  return { icon: Database, tone: "storage" };
};

const getConfigurationIconMeta = (label: string): {
  icon: typeof Files;
  tone: "versioning" | "encryption" | "lifecycle" | "replication" | "access" | "ownership";
} => {
  if (label === "Versioning") return { icon: Files, tone: "versioning" };
  if (label === "Encryption") return { icon: Shield, tone: "encryption" };
  if (label === "Lifecycle") return { icon: Clock3, tone: "lifecycle" };
  if (label === "Replication") return { icon: GitBranch, tone: "replication" };
  if (label === "Public Access") return { icon: Lock, tone: "access" };
  if (label === "Ownership Tags") return { icon: Tags, tone: "ownership" };
  return { icon: Files, tone: "versioning" };
};

export default function S3UsageBucketDetailPage() {
  const [isCostDriversOpen, setIsCostDriversOpen] = useState(false);
  const [isStorageDistributionOpen, setIsStorageDistributionOpen] = useState(false);
  const [isActivityUsageOpen, setIsActivityUsageOpen] = useState(false);
  const [isOptimizationOpen, setIsOptimizationOpen] = useState(false);
  const [isConfigurationOpen, setIsConfigurationOpen] = useState(false);
  const [isBucketNameCopied, setIsBucketNameCopied] = useState(false);
  const optimizationSectionRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ bucketName: string }>();
  const bucketNameParam = decodeURIComponent(params.bucketName ?? "").trim();

  const bucketDetailQuery = useS3BucketDetailQuery(bucketNameParam || null, {
    enabled: bucketNameParam.length > 0,
    staleTime: 180_000,
  });

  const detail = bucketDetailQuery.data;
  const bucketDetailErrorMessage = bucketDetailQuery.isError
    ? (bucketDetailQuery.error instanceof Error ? bucketDetailQuery.error.message : "Failed to load bucket details.")
    : null;

  const selectedBucket = useMemo<S3BucketTableRow | null>(() => {
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
    };
  }, [detail]);

  const usageMetrics = useMemo(
    () => ({
      storageGb: Number(detail?.usageMetrics.storageGb ?? 0),
      transferGb: Number(detail?.usageMetrics.transferGb ?? 0),
      requestCount: Number(detail?.usageMetrics.requestCount ?? 0),
      objectCount: Number(detail?.usageMetrics.objectCount ?? 0),
    }),
    [detail?.usageMetrics],
  );

  const costDrivers = useMemo(() => {
    const storage = Number(selectedBucket?.storage ?? 0);
    const request = Number(selectedBucket?.requests ?? 0);
    const transfer = Number(selectedBucket?.transfer ?? 0);
    const other = Number(selectedBucket?.other ?? 0);
    const total = storage + request + transfer + other;
    const pct = (value: number) => (total > 0 ? (value / total) * 100 : 0);
    const rows: CostDriverRow[] = [
      { key: "storage", label: "Storage Cost", value: storage, pct: pct(storage), color: "#2f8f78" },
      { key: "request", label: "Request Cost", value: request, pct: pct(request), color: "#5f8fdc" },
      { key: "transfer", label: "Data Transfer Cost", value: transfer, pct: pct(transfer), color: "#8a6fd0" },
      { key: "other", label: "Other Cost", value: other, pct: pct(other), color: "#d6a546" },
    ];
    return { total, rows };
  }, [selectedBucket?.other, selectedBucket?.requests, selectedBucket?.storage, selectedBucket?.transfer]);

  const costDriversSummary = useMemo(() => {
    if (costDrivers.total <= 0) return "No cost data";
    const storagePct = costDrivers.rows[0]?.pct.toFixed(1) ?? "0.0";
    const requestPct = costDrivers.rows[1]?.pct.toFixed(1) ?? "0.0";
    const transferPct = costDrivers.rows[2]?.pct.toFixed(1) ?? "0.0";
    return `Storage ${storagePct}%${SUMMARY_SEPARATOR}Requests ${requestPct}%${SUMMARY_SEPARATOR}Transfer ${transferPct}%`;
  }, [costDrivers]);

  const orderedCostDriverRows = useMemo(() => {
    const byKey = new Map(costDrivers.rows.map((row) => [row.key, row]));
    const order: CostDriverRow["key"][] = ["request", "storage", "transfer", "other"];
    return order.map((key) => byKey.get(key)).filter((row): row is CostDriverRow => Boolean(row));
  }, [costDrivers.rows]);
  const storageSummaryBytes = useMemo(() => {
    const currentVersionBytes = Number(detail?.objectInsights?.currentVersionBytes ?? 0);
    if (currentVersionBytes > 0) return currentVersionBytes;
    const usageStorageGb = Number(detail?.usageMetrics?.storageGb ?? 0);
    return usageStorageGb > 0 ? usageStorageGb * 1024 ** 3 : 0;
  }, [detail?.objectInsights?.currentVersionBytes, detail?.usageMetrics?.storageGb]);

  const storageSummaryObjectCount = useMemo(() => {
    const lensCount = Number(detail?.objectInsights?.objectCount ?? 0);
    if (lensCount > 0) return lensCount;
    return Number(detail?.usageMetrics?.objectCount ?? 0);
  }, [detail?.objectInsights?.objectCount, detail?.usageMetrics?.objectCount]);

  const storageDistributionRows = useMemo(() => {
    const rawBreakdown = detail?.storageClassBreakdown;
    if (!Array.isArray(rawBreakdown) || rawBreakdown.length === 0) return [] as Array<{ key: string; label: string; bytes: number; objects: number | null; pct: number; color: string }>;

    const classLabelMap: Record<string, string> = {
      STANDARD: "Standard",
      STANDARD_IA: "Standard-IA",
      ONEZONE_IA: "One Zone-IA",
      GLACIER: "Glacier",
      DEEP_ARCHIVE: "Deep Archive",
    };
    const classColorMap: Record<string, string> = {
      Standard: "#2f8f78",
      "Standard-IA": "#5f8fdc",
      "One Zone-IA": "#8a6fd0",
      Glacier: "#5f6ecf",
      "Deep Archive": "#4b56a5",
      Other: "#d6a546",
    };

    const aggregated = new Map<string, { bytes: number; objects: number | null }>();
    for (const item of rawBreakdown) {
      const rawKey = String(item.storageClass ?? "").trim();
      const normalizedKey = rawKey.toUpperCase().replace(/-/g, "_").replace(/\s+/g, "_");
      const mapped = classLabelMap[normalizedKey] ?? (rawKey ? rawKey : "Other");
      const current = aggregated.get(mapped) ?? { bytes: 0, objects: null };
      current.bytes += Number(item.bytes ?? 0);
      const nextObjects = item.objectCount == null ? null : Number(item.objectCount);
      if (nextObjects != null) {
        current.objects = (current.objects ?? 0) + nextObjects;
      }
      aggregated.set(mapped, current);
    }

    const totalBytes = [...aggregated.values()].reduce((sum, row) => sum + row.bytes, 0);
    if (totalBytes <= 0) return [];

    const shouldNormalizeToSummary =
      storageSummaryBytes > 0 &&
      (totalBytes > storageSummaryBytes * 4 || totalBytes < storageSummaryBytes * 0.25);
    const normalizeFactor = shouldNormalizeToSummary ? (storageSummaryBytes / totalBytes) : 1;

    const rows = [...aggregated.entries()]
      .map(([label, value]) => ({
        key: label.toLowerCase().replace(/\s+/g, "-"),
        label,
        bytes: value.bytes * normalizeFactor,
        objects: value.objects,
        pct: totalBytes > 0 ? (value.bytes / totalBytes) * 100 : 0,
        color: classColorMap[label] ?? classColorMap.Other,
      }))
      .filter((row) => row.bytes > 0)
      .sort((a, b) => b.bytes - a.bytes);

    const hasAnyObjects = rows.some((row) => row.objects != null && row.objects > 0);
    if (!hasAnyObjects && rows.length === 1 && storageSummaryObjectCount > 0) {
      rows[0] = {
        ...rows[0],
        objects: storageSummaryObjectCount,
      };
    }

    return rows;
  }, [detail, storageSummaryBytes, storageSummaryObjectCount]);

  const getStorageClassRowInsight = (label: string, options: { isOnlyStandard: boolean; isMixed: boolean }): string => {
    const normalized = label.toLowerCase();
    if (options.isOnlyStandard && normalized === "standard") return "All storage remains in Standard tier.";
    if (normalized === "standard") return options.isMixed ? "Primary active storage tier." : "All storage remains in Standard tier.";
    if (normalized.includes("standard-ia") || normalized.includes("one zone-ia") || normalized.includes("onezone-ia")) {
      return "Lower access storage tier.";
    }
    if (normalized.includes("deep archive")) return "Long-term retention.";
    if (normalized.includes("glacier")) return "Archive storage tier.";
    return options.isMixed ? "Distributed across multiple storage tiers." : "Active storage tier.";
  };

  const activityUsage = detail?.activityUsage;
  const activitySummary = useMemo(() => {
    if (!activityUsage?.hasUsageData) return "No activity data";
    const transferGb = activityUsage.transferBytes != null ? activityUsage.transferBytes / 1024 ** 3 : null;
    return `${integerFormatter.format(activityUsage.totalRequests)} requests${SUMMARY_SEPARATOR}${transferGb != null ? `${transferGb.toFixed(2)} GB` : "N/A"} transfer`;
  }, [activityUsage]);

  const activityInsight = useMemo(() => {
    if (!activityUsage?.hasUsageData) return null;
    if (activityUsage.insight) return activityUsage.insight;
    const topOp = [...(activityUsage.requestBreakdown ?? [])].sort((a, b) => b.count - a.count)[0];
    if (topOp && topOp.operation === "GET" && topOp.percentage >= 70) {
      return "This bucket is request-heavy with predominantly read operations.";
    }
    return "Bucket activity is present with mixed request patterns.";
  }, [activityUsage]);
  const hasRequestBreakdown = Boolean(activityUsage?.requestBreakdownAvailable && activityUsage.requestBreakdown.length > 0);
  const hasTransferBreakdown = Boolean(activityUsage?.transferBreakdownAvailable && activityUsage.transferBreakdown.length > 0);

  const activityTrendLabel = (value: "up" | "down" | "flat" | "unknown"): string => {
    if (value === "up") return "Up";
    if (value === "down") return "Down";
    if (value === "flat") return "Flat";
    return "Unknown";
  };

  const optimization = detail?.optimization;
  const configuration = detail?.configuration;
  const hasReplicationConfigured = Boolean(configuration?.replication.enabled);
  const optimizationOpportunities = optimization?.opportunities ?? [];
  type OptimizationOpportunity = NonNullable<typeof optimizationOpportunities>[number];
  const topInsights = useMemo(() => {
    const severityRank: Record<string, number> = { high: 0, medium: 1, low: 2, info: 3 };
    const baseInsights = optimizationOpportunities
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const aRank = severityRank[String(a.item.severity ?? "").toLowerCase()] ?? 99;
        const bRank = severityRank[String(b.item.severity ?? "").toLowerCase()] ?? 99;
        if (aRank !== bRank) return aRank - bRank;
        return a.index - b.index;
      })
      .map(({ item }) => item);

    const alreadyHasReplicationSetupInsight = baseInsights.some((item) => {
      const category = String(item.category ?? "").toLowerCase();
      const title = String(item.title ?? "").toLowerCase();
      return category === "replication" || title.includes("replication");
    });

    const shouldInjectReplicationInsight =
      bucketNameParam.length > 0 && !hasReplicationConfigured && !alreadyHasReplicationSetupInsight;

    const replicationInsight: OptimizationOpportunity[] = shouldInjectReplicationInsight
      ? [{
          id: `replication-setup-${bucketNameParam}`,
          category: "replication" as const,
          title: "Replication not configured",
          severity: "medium" as const,
          description: "Cross-region replication is not configured for this bucket.",
          recommendation: "Configure replication for resilience and recovery.",
          estimatedSavings: null,
          source: "system",
          evidence: {},
          action: {
            type: "navigate" as const,
            label: "Set replication",
            route: "/dashboard/s3/optimization",
            query: {
              tab: "replication",
              bucketName: bucketNameParam,
            },
          },
        }]
      : [];

    return [...replicationInsight, ...baseInsights].slice(0, 3);
  }, [bucketNameParam, hasReplicationConfigured, optimizationOpportunities]);
  const optimizationSummary = (optimization?.totalCount ?? 0) > 0
    ? `${optimization?.totalCount ?? 0} opportunities`
    : "No optimization opportunities";
  const hasConfigurationData = Boolean(configuration && configuration.bestPractices.total > 0);
  const configurationSummary = hasConfigurationData && configuration
    ? `${configuration.bestPractices.passed} of ${configuration.bestPractices.total} best practices met`
    : "Configuration unavailable";
  const configurationRows = hasConfigurationData && configuration
    ? [
        {
          label: "Versioning",
          value: configuration.versioning.status === "enabled" ? "Enabled" : configuration.versioning.status === "suspended" ? "Suspended" : configuration.versioning.status === "disabled" ? "Disabled" : "Unknown",
          helper: configuration.versioning.status === "enabled" ? "Object recovery protection active" : "Object recovery protection not active",
        },
        {
          label: "Encryption",
          value: configuration.encryption.status === "enabled" ? (configuration.encryption.type ?? "Enabled") : configuration.encryption.status === "disabled" ? "Disabled" : "Unknown",
          helper: configuration.encryption.status === "enabled" ? "Bucket-level encryption configured" : "Encryption posture unavailable or disabled",
        },
        {
          label: "Lifecycle",
          value: configuration.lifecycle.enabled ? `Configured (${configuration.lifecycle.ruleCount} rules)` : "Missing",
          helper: configuration.lifecycle.enabled ? "Active lifecycle transitions available" : "No active lifecycle rules",
        },
        {
          label: "Replication",
          value: configuration.replication.enabled ? (configuration.replication.destinationRegion ? `Enabled (${configuration.replication.destinationRegion})` : "Enabled") : "Disabled",
          helper: configuration.replication.enabled ? "Cross-region replication configured" : "Cross-region replication disabled",
        },
        {
          label: "Public Access",
          value: configuration.publicAccess.status === "blocked" ? "Blocked" : configuration.publicAccess.status === "partial" ? "Partial" : configuration.publicAccess.status === "public" ? "Public" : "Unknown",
          helper: configuration.publicAccess.status === "blocked" ? "Public access protections active" : "Public access protections are not fully active",
        },
        {
          label: "Ownership Tags",
          value: configuration.ownershipMetadata.ownerAssigned && configuration.ownershipMetadata.environmentAssigned ? "Assigned" : "Missing",
          helper: configuration.ownershipMetadata.ownerAssigned && configuration.ownershipMetadata.environmentAssigned
            ? "Owner and environment metadata assigned"
            : "Missing owner/environment metadata",
        },
      ]
    : [];

  
  const handleCopyBucketName = async () => {
    if (!selectedBucket?.bucketName) return;
    try {
      await navigator.clipboard.writeText(selectedBucket.bucketName);
      setIsBucketNameCopied(true);
    } catch {
      setIsBucketNameCopied(false);
    }
  };

  useEffect(() => {
    if (!isBucketNameCopied) return;
    const timer = window.setTimeout(() => setIsBucketNameCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [isBucketNameCopied]);

  const handleBack = () => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete("s3Section");
    navigate({ pathname: "/dashboard/s3/bucket", search: searchParams.toString() });
  };

  const handleOpportunityAction = (opportunity: NonNullable<typeof optimizationOpportunities>[number]) => {
    const action = opportunity.action;
    if (!action || action.type !== "navigate") return;
    const isLifecycleCategory = String(opportunity.category ?? "").toLowerCase() === "lifecycle";
    const isLifecycleMissingInsight = isLifecycleCategory && /no\s+lifecycle\s+policy/i.test(String(opportunity.title ?? ""));
    const shouldRedirectToPolicySetup = isLifecycleMissingInsight && !configuration?.lifecycle.enabled;
    const searchParams = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(action.query ?? {})) {
      if (value != null && String(value).trim().length > 0) {
        searchParams.set(key, String(value));
      }
    }
    if (bucketNameParam) {
      searchParams.set("bucket", bucketNameParam);
    }
    if (shouldRedirectToPolicySetup && bucketNameParam) {
      searchParams.set("bucketName", bucketNameParam);
    }
    navigate({
      pathname: shouldRedirectToPolicySetup ? "/dashboard/policy/lifecycle" : action.route,
      search: searchParams.toString(),
    });
  };

  const getOpportunityActionLabel = (opportunity: NonNullable<typeof optimizationOpportunities>[number]): string => {
    const fallbackLabel = opportunity.action?.label ?? "View details";
    const isLifecycleCategory = String(opportunity.category ?? "").toLowerCase() === "lifecycle";
    const isLifecycleMissingInsight = isLifecycleCategory && /no\s+lifecycle\s+policy/i.test(String(opportunity.title ?? ""));
    const isReplicationCategory = String(opportunity.category ?? "").toLowerCase() === "replication";
    const isReplicationMissingInsight =
      isReplicationCategory && /replication\s+(not\s+configured|missing|not\s+set)/i.test(String(opportunity.title ?? ""));
    if (!isLifecycleMissingInsight && !isReplicationMissingInsight) return fallbackLabel;
    if (isReplicationMissingInsight) return hasReplicationConfigured ? "View replication" : "Set replication";
    return configuration?.lifecycle.enabled ? "View lifecycle policy" : "Set lifecycle policy";
  };

  const handleOpportunityRowClick = (opportunity: NonNullable<typeof optimizationOpportunities>[number]) => {
    if (opportunity.action?.type === "navigate") {
      handleOpportunityAction(opportunity);
    }
  };

  const handleViewAllInsights = () => {
    setIsOptimizationOpen(true);
    window.requestAnimationFrame(() => {
      optimizationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="dashboard-page s3-overview-page s3-usage-bucket-detail-page s3-bucket-reference">
      {bucketDetailQuery.isLoading ? <p className="dashboard-note">Loading bucket details...</p> : null}
      {bucketDetailQuery.isError ? <p className="dashboard-note">Failed to load bucket details: {bucketDetailErrorMessage}</p> : null}
      {!bucketDetailQuery.isLoading && !bucketDetailQuery.isError && !selectedBucket ? <p className="dashboard-note">No bucket details found for "{bucketNameParam}".</p> : null}
      {!bucketDetailQuery.isLoading && !bucketDetailQuery.isError && selectedBucket ? (
        <div className="s3-bucket-reference__shell">
          <header className="s3-bucket-reference__header">
            <div className="s3-bucket-reference__title-wrap">
              <div className="s3-bucket-reference__title-row">
                <h1 className="s3-bucket-reference__title">{selectedBucket.bucketName}</h1>
                <button
                  type="button"
                  className={`s3-bucket-reference__icon-btn s3-bucket-reference__copy-btn${isBucketNameCopied ? " is-copied" : ""}`}
                  aria-label={isBucketNameCopied ? "Bucket name copied" : "Copy bucket name"}
                  onClick={handleCopyBucketName}
                >
                  {isBucketNameCopied ? <Check /> : <Copy />}
                </button>
              </div>
              <div className="s3-bucket-reference__meta-line">
                <span><strong>Account</strong> {selectedBucket.account}</span>
                <span><strong>Region</strong> {selectedBucket.region}</span>
                <span><strong>Owner</strong> {selectedBucket.owner}</span>
                <span><strong>Environment</strong> {detail?.metadata.environment ?? "N/A"}</span>
                <span><strong>Public/Private</strong> {detail?.metadata.publicAccess ?? "Unknown"}</span>
                <span><strong>Encryption</strong> {detail?.metadata.encryption ?? "Unknown"}</span>
              </div>
            </div>
            <div className="s3-bucket-reference__header-actions">
              <button type="button" className="s3-bucket-reference__ghost-btn s3-bucket-reference__view-aws-btn">
                View in AWS
                <ExternalLink />
              </button>
              <button type="button" className="s3-bucket-reference__icon-btn" aria-label="More actions">
                <MoreVertical />
              </button>
            </div>
          </header>

          <section className="s3-bucket-reference__kpi-row" aria-label="Bucket KPI summary">
            <article className="s3-bucket-reference__kpi-item">
              <p>Storage Cost</p>
              <h3>{formatCurrencySmart(selectedBucket.storage)}</h3>
            </article>
            <article className="s3-bucket-reference__kpi-item">
              <p>Transfer Cost</p>
              <h3>{formatCurrencySmart(selectedBucket.transfer)}</h3>
            </article>
            <article className="s3-bucket-reference__kpi-item">
              <p>Request Cost</p>
              <h3>{formatCurrencySmart(selectedBucket.requests)}</h3>
            </article>
            <article className="s3-bucket-reference__kpi-item">
              <p>Storage Size</p>
              <h3>{storageSummaryBytes > 0 ? formatBytesCompact(storageSummaryBytes) : `${usageMetrics.storageGb.toFixed(2)} GB`}</h3>
            </article>
            <article className="s3-bucket-reference__kpi-item">
              <p>No. of Objects</p>
              <h3>{integerFormatter.format(storageSummaryObjectCount > 0 ? storageSummaryObjectCount : usageMetrics.objectCount)}</h3>
            </article>
          </section>

          <section className="s3-bucket-reference__main-row" aria-label="Main analysis">
            <div className="s3-bucket-reference__trend-card">
              <div className="s3-bucket-reference__card-head">
                <div>
                  <h3>Cost Trend</h3>
                  <p>Daily cost ($) by cost type</p>
                </div>
              </div>
              <S3BucketUsageTrendPanel
                charts={detail?.charts}
                filtersApplied={detail?.filtersApplied}
                isLoading={bucketDetailQuery.isLoading}
                isError={bucketDetailQuery.isError}
                errorMessage={bucketDetailErrorMessage ?? undefined}
              />
            </div>

            <aside className="s3-bucket-reference__insights">
              <div className="s3-bucket-reference__card-head">
                <h3>Top Insights</h3>
                <button type="button" className="s3-bucket-reference__text-btn" onClick={handleViewAllInsights}>View all insights</button>
              </div>
              {topInsights.length > 0 ? (
                topInsights.map((insight) => (
                  <article
                    key={insight.id}
                    className={`s3-bucket-reference__insight-item${insight.action ? " is-clickable" : ""}`}
                    onClick={() => handleOpportunityRowClick(insight)}
                    role={insight.action ? "button" : undefined}
                    tabIndex={insight.action ? 0 : -1}
                    onKeyDown={(event) => {
                      if (!insight.action) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleOpportunityRowClick(insight);
                      }
                    }}
                  >
                    <div className={`s3-bucket-reference__optimization-icon is-${getOptimizationIconMeta(insight.category).tone}`}>
                      {(() => {
                        const Icon = getOptimizationIconMeta(insight.category).icon;
                        return <Icon size={16} />;
                      })()}
                    </div>
                    <div className="s3-bucket-reference__insight-main">
                      <div className="s3-bucket-reference__insight-title-row">
                        <h4>{insight.title}</h4>
                        <span className={`s3-bucket-reference__optimization-severity is-${insight.severity}`}>
                          {toInsightAvailabilityLabel(insight)}
                        </span>
                      </div>
                      {insight.action ? (
                        <button
                          type="button"
                          className="s3-bucket-reference__optimization-action s3-bucket-reference__insight-action"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpportunityAction(insight);
                          }}
                        >
                          {getOpportunityActionLabel(insight)} <ChevronRight size={14} />
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <p className="s3-bucket-reference__insight-empty">No optimization insights available.</p>
              )}
            </aside>
          </section>

          <section className="s3-bucket-reference__accordions" aria-label="Detail sections">
            <div className={`s3-bucket-reference__cost-drivers ${isCostDriversOpen ? "is-open" : ""}`}>
              <button
                type="button"
                className="s3-bucket-reference__cost-drivers-summary"
                onClick={() => setIsCostDriversOpen((prev) => !prev)}
                aria-expanded={isCostDriversOpen}
              >
                <span>Cost Drivers</span>
                <small>{costDriversSummary}</small>
                <ChevronDown className="s3-bucket-reference__cost-drivers-chevron" />
              </button>
              <div className="s3-bucket-reference__cost-drivers-panel-wrap">
                {isCostDriversOpen ? (
                  <div className="s3-bucket-reference__cost-drivers-panel">
                      {costDrivers.total > 0 ? (
                        <>
                          <div className="s3-bucket-reference__cost-drivers-list" aria-label="Cost drivers list">
                            {orderedCostDriverRows.map((row) => (
                              <div key={row.key} className="s3-bucket-reference__cost-drivers-item">
                                <div className="s3-bucket-reference__cost-drivers-item-type">
                                    <i style={{ background: row.color }} />
                                    {row.label}
                                </div>
                                <div className="s3-bucket-reference__cost-drivers-item-meta">
                                  {formatCurrencySmart(row.value)}{SUMMARY_SEPARATOR}{row.pct.toFixed(1)}%
                                </div>
                                <div
                                  className="s3-bucket-reference__cost-drivers-item-progress"
                                  role="progressbar"
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-valuenow={Math.round(row.pct)}
                                >
                                  <span style={{ width: `${Math.max(0, Math.min(100, row.pct))}%`, background: row.color }} />
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="s3-bucket-reference__cost-drivers-insight">
                            Request operations are the primary cost driver for this bucket.
                          </p>
                        </>
                      ) : (
                      <p className="s3-bucket-reference__cost-drivers-empty">
                        No cost driver data available for this bucket in the selected date range.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div className={`s3-bucket-reference__storage-distribution ${isStorageDistributionOpen ? "is-open" : ""}`}>
              <button
                type="button"
                className="s3-bucket-reference__storage-distribution-summary"
                onClick={() => setIsStorageDistributionOpen((prev) => !prev)}
                aria-expanded={isStorageDistributionOpen}
              >
                <span>Storage Distribution</span>
                <small>{storageSummaryBytes > 0 ? `${formatBytesCompact(storageSummaryBytes)}${SUMMARY_SEPARATOR}${integerFormatter.format(storageSummaryObjectCount)} objects` : "No storage data"}</small>
                <ChevronDown className="s3-bucket-reference__storage-distribution-chevron" />
              </button>
              <div className="s3-bucket-reference__storage-distribution-panel-wrap">
                {isStorageDistributionOpen ? (
                  <div className="s3-bucket-reference__storage-distribution-panel">
                    {storageSummaryBytes > 0 ? (
                      <>
                          {storageDistributionRows.length > 0 ? (
                            <div className="s3-bucket-reference__storage-distribution-list" aria-label="Storage class distribution">
                              {storageDistributionRows.map((row) => {
                                const isOnlyStandard =
                                  storageDistributionRows.length === 1 && String(row.label).toLowerCase() === "standard" && row.pct >= 99.9;
                                const isMixed = storageDistributionRows.length > 1;
                                return (
                                <div key={row.key} className="s3-bucket-reference__storage-distribution-item">
                                  <strong className="s3-bucket-reference__storage-distribution-item-title">{row.label}</strong>
                                  <span className="s3-bucket-reference__storage-distribution-item-meta">
                                    {formatBytesCompact(row.bytes)}{SUMMARY_SEPARATOR}{row.objects == null ? "N/A objects" : `${integerFormatter.format(row.objects)} objects`}{SUMMARY_SEPARATOR}{row.pct.toFixed(1)}%
                                  </span>
                                  <div
                                    className="s3-bucket-reference__storage-distribution-item-progress"
                                  role="progressbar"
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-valuenow={Math.round(row.pct)}
                                  >
                                    <span style={{ width: `${Math.max(0, Math.min(100, row.pct))}%`, background: row.color }} />
                                  </div>
                                  <span className="s3-bucket-reference__storage-distribution-item-insight">
                                    {getStorageClassRowInsight(row.label, { isOnlyStandard, isMixed })}
                                  </span>
                                </div>
                                );
                              })}
                            </div>
                          ) : null}
                          {storageDistributionRows.length === 0 ? (
                            <p className="s3-bucket-reference__storage-distribution-empty">
                              No storage distribution data available for this bucket.
                            </p>
                          ) : null}
                        </>
                      ) : (
                      <p className="s3-bucket-reference__storage-distribution-empty">
                        No storage distribution data available for this bucket.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div className={`s3-bucket-reference__activity-usage ${isActivityUsageOpen ? "is-open" : ""}`}>
              <button
                type="button"
                className="s3-bucket-reference__activity-usage-summary"
                onClick={() => setIsActivityUsageOpen((prev) => !prev)}
                aria-expanded={isActivityUsageOpen}
              >
                <span>Activity & Usage</span>
                <small>{activitySummary}</small>
                <ChevronDown className="s3-bucket-reference__activity-usage-chevron" />
              </button>
              <div className="s3-bucket-reference__activity-usage-panel-wrap">
                {isActivityUsageOpen ? (
                  <div className="s3-bucket-reference__activity-usage-panel">
                    {activityUsage?.hasUsageData ? (
                      <>
                        <div className="s3-bucket-reference__activity-trends">
                          <span>Requests trend: <strong>{activityTrendLabel(activityUsage.trends.requests)}</strong></span>
                          <span>Transfer trend: <strong>{activityTrendLabel(activityUsage.trends.transfer)}</strong></span>
                          <span>Storage trend: <strong>{activityTrendLabel(activityUsage.trends.storage)}</strong></span>
                        </div>
                        <div className="s3-bucket-reference__activity-metrics">
                          <div><label>Total Requests</label><strong>{integerFormatter.format(activityUsage.totalRequests)}</strong></div>
                          <div><label>Data Transfer</label><strong>{activityUsage.transferBytes == null ? "N/A" : formatBytesCompact(activityUsage.transferBytes)}</strong></div>
                          <div><label>Object Count</label><strong>{activityUsage.objectCount == null ? "N/A" : integerFormatter.format(activityUsage.objectCount)}</strong></div>
                          <div><label>Avg Object Size</label><strong>{activityUsage.averageObjectSizeBytes == null ? "N/A" : formatBytesCompact(activityUsage.averageObjectSizeBytes)}</strong></div>
                        </div>
                        <div className="s3-bucket-reference__activity-breakdowns-grid">
                          <div className="s3-bucket-reference__activity-breakdown-block">
                            <p className="s3-bucket-reference__activity-breakdown-title">Request Breakdown</p>
                            <div className="s3-bucket-reference__activity-table-wrap">
                              {hasRequestBreakdown ? (
                                <table className="s3-bucket-reference__activity-table" aria-label="Request breakdown">
                                  <thead>
                                    <tr>
                                      <th>Request Type</th>
                                      <th>Count</th>
                                      <th>Percentage</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {activityUsage.requestBreakdown.map((row) => (
                                      <tr key={row.operation}>
                                        <td>{row.operation}</td>
                                        <td>{integerFormatter.format(row.count)}</td>
                                        <td>{row.percentage.toFixed(1)}%</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="s3-bucket-reference__activity-empty">Detailed request operation breakdown is not available for this bucket.</p>
                              )}
                            </div>
                          </div>
                          <div className="s3-bucket-reference__activity-breakdown-block">
                            <p className="s3-bucket-reference__activity-breakdown-title">Network / Transfer Breakdown</p>
                            <div className="s3-bucket-reference__activity-table-wrap">
                              {hasTransferBreakdown ? (
                                <table className="s3-bucket-reference__activity-table" aria-label="Transfer breakdown">
                                  <thead>
                                    <tr>
                                      <th>Transfer Type</th>
                                      <th>Data Volume</th>
                                      <th>Percentage</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {activityUsage.transferBreakdown.map((row) => (
                                      <tr key={row.type}>
                                        <td>{row.type}</td>
                                        <td>{formatBytesCompact(row.bytes)}</td>
                                        <td>{row.percentage.toFixed(1)}%</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="s3-bucket-reference__activity-empty">Detailed transfer breakdown is not available for this bucket.</p>
                              )}
                            </div>
                          </div>
                        </div>
                        {activityInsight ? <p className="s3-bucket-reference__activity-insight">{activityInsight}</p> : null}
                      </>
                    ) : (
                      <p className="s3-bucket-reference__activity-empty">
                        No activity and usage data available for this bucket.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div ref={optimizationSectionRef} className={`s3-bucket-reference__optimization ${isOptimizationOpen ? "is-open" : ""}`}>
              <button
                type="button"
                className="s3-bucket-reference__optimization-summary"
                onClick={() => setIsOptimizationOpen((prev) => !prev)}
                aria-expanded={isOptimizationOpen}
              >
                <span>Optimization Opportunities</span>
                <small>{optimizationSummary}</small>
                <ChevronDown className="s3-bucket-reference__optimization-chevron" />
              </button>
              <div className="s3-bucket-reference__optimization-panel-wrap">
                {isOptimizationOpen ? (
                  <div className="s3-bucket-reference__optimization-panel">
                    {(optimization?.totalCount ?? 0) > 0 ? (
                      <div className="s3-bucket-reference__optimization-list">
                        {optimizationOpportunities.map((item) => (
                          <article
                            key={item.id}
                            className={`s3-bucket-reference__optimization-item${item.action ? " is-clickable" : ""}`}
                            onClick={() => handleOpportunityRowClick(item)}
                            role={item.action ? "button" : undefined}
                            tabIndex={item.action ? 0 : -1}
                            onKeyDown={(event) => {
                              if (!item.action) return;
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleOpportunityRowClick(item);
                              }
                            }}
                          >
                            <div className={`s3-bucket-reference__optimization-icon is-${getOptimizationIconMeta(item.category).tone}`}>
                              {(() => {
                                const Icon = getOptimizationIconMeta(item.category).icon;
                                return <Icon size={18} />;
                              })()}
                            </div>
                            <div className="s3-bucket-reference__optimization-main">
                              <h4>{item.title}</h4>
                              <p>{item.description}</p>
                              {item.action ? (
                                <button
                                  type="button"
                                  className="s3-bucket-reference__optimization-action"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpportunityAction(item);
                                  }}
                                >
                                  {item.action.label} <ChevronRight size={14} />
                                </button>
                              ) : (
                                <small className="s3-bucket-reference__optimization-recommendation">{item.recommendation}</small>
                              )}
                            </div>
                            <div className="s3-bucket-reference__optimization-right">
                              <span className={`s3-bucket-reference__severity-badge is-${item.severity}`}>{toSeverityLabel(item.severity)}</span>
                              <ChevronRight className="s3-bucket-reference__optimization-row-chevron" size={18} />
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="s3-bucket-reference__optimization-empty">This bucket appears to be reasonably optimized.</p>
                    )}
                    
                  </div>
                ) : null}
              </div>
            </div>
            <div className={`s3-bucket-reference__configuration ${isConfigurationOpen ? "is-open" : ""}`}>
              <button
                type="button"
                className="s3-bucket-reference__configuration-summary"
                onClick={() => setIsConfigurationOpen((prev) => !prev)}
                aria-expanded={isConfigurationOpen}
              >
                <span>Configuration</span>
                <small>{configurationSummary}</small>
                <ChevronDown className="s3-bucket-reference__configuration-chevron" />
              </button>
              <div className="s3-bucket-reference__configuration-panel-wrap">
                {isConfigurationOpen ? (
                  <div className="s3-bucket-reference__configuration-panel">
                    {hasConfigurationData && configuration ? (
                      <>
                        <dl className="s3-bucket-reference__configuration-grid">
                          {configurationRows.map((row) => (
                            <div key={row.label} className="s3-bucket-reference__configuration-row">
                              <dt>
                                <span className={`s3-bucket-reference__configuration-icon is-${getConfigurationIconMeta(row.label).tone}`}>
                                  {(() => {
                                    const Icon = getConfigurationIconMeta(row.label).icon;
                                    return <Icon size={15} />;
                                  })()}
                                </span>
                                <span className="s3-bucket-reference__configuration-label-wrap">
                                  <strong>{row.label}</strong>
                                  {row.helper ? <small>{row.helper}</small> : null}
                                </span>
                              </dt>
                              <dd>
                                <strong className={`s3-bucket-reference__configuration-badge is-${toConfigTone(row.value)}`}>{row.value}</strong>
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <div className="s3-bucket-reference__configuration-practices">
                          <div className="s3-bucket-reference__configuration-practices-head">
                            <span>Best Practices</span>
                            <strong>{configuration.bestPractices.passed} / {configuration.bestPractices.total} passed</strong>
                          </div>
                          <div className="s3-bucket-reference__configuration-practices-track">
                            <span
                              className="s3-bucket-reference__configuration-practices-fill"
                              style={{ width: `${configuration.bestPractices.total > 0 ? (configuration.bestPractices.passed / configuration.bestPractices.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        {configuration.notes.length > 0 ? (
                          <div className="s3-bucket-reference__configuration-issues">
                            <p>Issues</p>
                            <ul className="s3-bucket-reference__configuration-notes">
                              {configuration.notes.map((note) => <li key={note}>{note}</li>)}
                            </ul>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="s3-bucket-reference__optimization-empty">Configuration unavailable.</p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="s3-bucket-reference__footer-actions">
            <button type="button" className="s3-bucket-reference__ghost-btn" onClick={handleBack}>Back</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}


