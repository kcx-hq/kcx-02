import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useS3CostInsightsQuery, useS3OptimizationQuery } from "../../hooks/useDashboardQueries";
import { S3BucketCombinedTable, type S3BucketCombinedRow } from "./components/S3BucketCombinedTable";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const toBucketKey = (value: string | null | undefined): string => String(value ?? "").trim().toLowerCase();

const toNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toTitleCaseLabel = (value: string | null | undefined): string => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "Unknown";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const parseDateEpoch = (value: string | null | undefined): number | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const epoch = Date.parse(raw);
  return Number.isFinite(epoch) ? epoch : null;
};

const formatDateShort = (value: string | null | undefined): string => {
  const epoch = parseDateEpoch(value);
  if (epoch == null) return "--";
  return new Date(epoch).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatBytesToReadable = (value: number | null): string => {
  if (value == null || Number.isNaN(value) || value <= 0) return "--";
  const tebibytes = value / 1024 ** 4;
  if (tebibytes >= 1) return `${decimalFormatter.format(tebibytes)} TB`;
  const gibibytes = value / 1024 ** 3;
  return `${decimalFormatter.format(gibibytes)} GB`;
};

const formatStorageClassMix = (
  distribution: Array<{ name: string; percent: number }> | null | undefined,
  fallback:
    | {
        standardPct: number;
        standardIaPct: number;
        glacierPct: number;
        deepArchivePct: number;
        intelligentTieringPct: number;
      }
    | undefined,
): string => {
  const dist = (distribution ?? [])
    .map((item) => ({
      name: String(item.name ?? "").trim(),
      percent: Number(item.percent ?? 0),
    }))
    .filter((item) => item.name.length > 0 && item.percent > 0)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3)
    .map((item) => `${item.name}: ${decimalFormatter.format(item.percent)}%`);

  if (dist.length > 0) return dist.join(" | ");

  if (fallback) {
    const fromEfficiency = [
      { name: "Standard", percent: Number(fallback.standardPct ?? 0) },
      { name: "Standard IA", percent: Number(fallback.standardIaPct ?? 0) },
      { name: "Glacier", percent: Number(fallback.glacierPct ?? 0) },
      { name: "Deep Archive", percent: Number(fallback.deepArchivePct ?? 0) },
      { name: "Intelligent Tiering", percent: Number(fallback.intelligentTieringPct ?? 0) },
    ]
      .filter((item) => item.percent > 0)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 3)
      .map((item) => `${item.name}: ${decimalFormatter.format(item.percent)}%`);
    if (fromEfficiency.length > 0) return fromEfficiency.join(" | ");
  }

  return "Unknown";
};

const computeLastAccess = (
  accessCount: number | null,
  usageDate: string | null | undefined,
): { label: string; order: number; epoch: number | null } => {
  const epoch = parseDateEpoch(usageDate);
  const formattedDate = formatDateShort(usageDate);

  if (accessCount == null) {
    return {
      label: "Unknown",
      order: 2,
      epoch,
    };
  }

  if (accessCount <= 0) {
    return {
      label: epoch == null ? "No access in current window" : `No access in current window (as of ${formattedDate})`,
      order: 0,
      epoch,
    };
  }

  return {
    label:
      epoch == null
        ? `${integerFormatter.format(accessCount)} accesses in current window`
        : `${integerFormatter.format(accessCount)} accesses (as of ${formattedDate})`,
    order: 1,
    epoch,
  };
};

const deriveGovernanceStatus = (
  publicAccess: string,
  versioning: string,
  encryption: string,
  lifecycleStatus: string,
): string => {
  const publicNormalized = toBucketKey(publicAccess);
  const versioningNormalized = toBucketKey(versioning);
  const encryptionNormalized = toBucketKey(encryption);
  const lifecycleNormalized = toBucketKey(lifecycleStatus);

  if (publicNormalized === "public") return "At Risk";

  const lifecycleMissing = lifecycleNormalized === "missing" || lifecycleNormalized === "not applied";
  const versioningEnabled = versioningNormalized.includes("enabled");
  const encryptionEnabled = encryptionNormalized.includes("enabled");
  const hasUnknown =
    publicNormalized === "unknown" ||
    versioningNormalized === "unknown" ||
    encryptionNormalized === "unknown" ||
    lifecycleNormalized === "unknown";

  if (!hasUnknown && publicNormalized === "private" && versioningEnabled && encryptionEnabled && !lifecycleMissing) {
    return "Healthy";
  }

  return "Needs Review";
};

const derivePrimaryUsagePattern = (input: {
  storageCost: number;
  requestCost: number;
  transferCost: number;
  retrievalCost: number;
  otherCost: number;
}): string => {
  const entries = [
    { label: "Storage heavy", value: input.storageCost },
    { label: "Request heavy", value: input.requestCost },
    { label: "Transfer heavy", value: input.transferCost },
    { label: "Retrieval heavy", value: input.retrievalCost },
    { label: "Other heavy", value: input.otherCost },
  ].sort((a, b) => b.value - a.value);
  return entries[0]?.label ?? "Balanced";
};

const deriveOptimizationSignal = (input: {
  governanceStatus: string;
  lifecycleStatus: string;
  publicAccess: string;
  accessCount: number | null;
  monthlyGrowthPct: number | null;
  optimizationScore: number | null;
}): string => {
  if (String(input.publicAccess).toLowerCase() === "public") return "At Risk";
  if (String(input.governanceStatus).toLowerCase() === "at risk") return "At Risk";
  if (String(input.lifecycleStatus).toLowerCase() === "missing") return "Needs Review";
  if ((input.monthlyGrowthPct ?? 0) >= 20) return "Growth Watch";
  if (input.accessCount != null && input.accessCount <= 0) return "Idle Candidate";
  if (input.optimizationScore != null && input.optimizationScore >= 75) return "Optimized";
  return "Needs Review";
};

function S3BucketInfoSkeleton() {
  return (
    <div className="s3-bucket-section s3-bucket-section--skeleton" aria-label="Loading S3 bucket insights">
      <section className="cost-explorer-widget-shell s3-bucket-kpi-shell">
        <div className="s3-bucket-kpi-row" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <article key={`s3-bucket-kpi-skeleton-${index}`} className="s3-bucket-kpi-tile s3-bucket-kpi-tile--skeleton">
              <div className="s3-bucket-skeleton-line s3-bucket-skeleton-line--label" />
              <div className="s3-bucket-skeleton-line s3-bucket-skeleton-line--value" />
            </article>
          ))}
        </div>
      </section>

      <section className="cost-explorer-widget-shell s3-bucket-table-shell">
        <div className="s3-bucket-table-skeleton" aria-hidden="true">
          <div className="s3-bucket-table-skeleton__header">
            {Array.from({ length: 8 }).map((_, index) => (
              <span key={`s3-bucket-head-${index}`} className="s3-bucket-skeleton-line s3-bucket-skeleton-line--cell" />
            ))}
          </div>
          <div className="s3-bucket-table-skeleton__body">
            {Array.from({ length: 11 }).map((_, rowIndex) => (
              <div key={`s3-bucket-row-${rowIndex}`} className="s3-bucket-table-skeleton__row">
                {Array.from({ length: 8 }).map((_, colIndex) => (
                  <span
                    key={`s3-bucket-cell-${rowIndex}-${colIndex}`}
                    className="s3-bucket-skeleton-line s3-bucket-skeleton-line--cell"
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="s3-bucket-table-skeleton__footer">
            <span className="s3-bucket-skeleton-line s3-bucket-skeleton-line--pagination-left" />
            <span className="s3-bucket-skeleton-line s3-bucket-skeleton-line--pagination-right" />
          </div>
        </div>
      </section>
    </div>
  );
}

export default function S3BucketInfoPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const overviewQuery = useS3CostInsightsQuery({ responseMode: "overview" }, { staleTime: 120_000 });
  const deepInsightsQuery = useS3CostInsightsQuery(undefined, {
    enabled: Boolean(overviewQuery.data) && !overviewQuery.isError,
    staleTime: 180_000,
  });
  const optimizationQuery = useS3OptimizationQuery();

  const [showSlowLoadingHint, setShowSlowLoadingHint] = useState(false);
  useEffect(() => {
    if (!overviewQuery.isLoading || overviewQuery.data || overviewQuery.isError) {
      setShowSlowLoadingHint(false);
      return;
    }
    const timeout = window.setTimeout(() => setShowSlowLoadingHint(true), 12_000);
    return () => window.clearTimeout(timeout);
  }, [overviewQuery.data, overviewQuery.isError, overviewQuery.isLoading]);

  const baseData = overviewQuery.data;
  const deepData = deepInsightsQuery.data;
  const insightsData = deepData ?? baseData;

  const rows = useMemo(() => insightsData?.bucketTable ?? [], [insightsData?.bucketTable]);
  const scopedRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          String(row.bucketName ?? "").trim().length > 0 &&
          String(row.bucketName ?? "").trim().toLowerCase() !== "unattributed",
      ),
    [rows],
  );

  const lifecycleByBucket = useMemo(() => {
    const map = new Map<string, { lifecycleStatus: string | null; hasLifecyclePolicy: boolean }>();
    for (const row of optimizationQuery.data?.buckets ?? []) {
      const bucketKey = toBucketKey(row.bucketName);
      if (!bucketKey) continue;
      map.set(bucketKey, {
        lifecycleStatus: row.lifecycleStatus,
        hasLifecyclePolicy: Boolean(row.hasLifecyclePolicy),
      });
    }
    return map;
  }, [optimizationQuery.data?.buckets]);

  const savingsByBucket = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of deepData?.estimatedSavings.items ?? []) {
      const bucketKey = toBucketKey(item.bucketName);
      if (!bucketKey) continue;
      map.set(bucketKey, (map.get(bucketKey) ?? 0) + Number(item.estimatedMonthlySaving ?? 0));
    }
    return map;
  }, [deepData?.estimatedSavings.items]);

  const optimizationScoreByBucket = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of deepData?.bucketOptimizationScores.items ?? []) {
      const bucketKey = toBucketKey(item.bucketName);
      if (!bucketKey) continue;
      map.set(bucketKey, Number(item.score ?? 0));
    }
    return map;
  }, [deepData?.bucketOptimizationScores.items]);

  const optimizationSavingsByBucket = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of deepData?.bucketOptimizationScores.items ?? []) {
      const bucketKey = toBucketKey(item.bucketName);
      if (!bucketKey) continue;
      map.set(bucketKey, Math.max(map.get(bucketKey) ?? 0, Number(item.estimatedMonthlySaving ?? 0)));
    }
    return map;
  }, [deepData?.bucketOptimizationScores.items]);

  const healthScoreByBucket = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of deepData?.bucketHealthScores.items ?? []) {
      const bucketKey = toBucketKey(item.bucketName);
      if (!bucketKey) continue;
      map.set(bucketKey, Number(item.score ?? 0));
    }
    return map;
  }, [deepData?.bucketHealthScores.items]);

  const storageClassEfficiencyByBucket = useMemo(() => {
    const map = new Map<
      string,
      {
        standardPct: number;
        standardIaPct: number;
        glacierPct: number;
        deepArchivePct: number;
        intelligentTieringPct: number;
        totalGib: number;
      }
    >();

    for (const item of deepData?.storageClassEfficiency.items ?? []) {
      const bucketKey = toBucketKey(item.bucketName);
      if (!bucketKey) continue;
      const totalGib =
        Number(item.standardGib ?? 0) +
        Number(item.standardIaGib ?? 0) +
        Number(item.glacierGib ?? 0) +
        Number(item.deepArchiveGib ?? 0) +
        Number(item.intelligentTieringGib ?? 0);
      map.set(bucketKey, {
        standardPct: Number(item.standardPct ?? 0),
        standardIaPct: Number(item.standardIaPct ?? 0),
        glacierPct: Number(item.glacierPct ?? 0),
        deepArchivePct: Number(item.deepArchivePct ?? 0),
        intelligentTieringPct: Number(item.intelligentTieringPct ?? 0),
        totalGib,
      });
    }

    return map;
  }, [deepData?.storageClassEfficiency.items]);

  const combinedRows = useMemo<S3BucketCombinedRow[]>(() => {
    return scopedRows.map((row) => {
      const bucketName = String(row.bucketName ?? "").trim();
      const bucketKey = toBucketKey(bucketName);
      const storageLens = row.storageLens;
      const efficiency = storageClassEfficiencyByBucket.get(bucketKey);

      const storageSizeBytesFromLens = toNumber(storageLens?.currentVersionBytes);
      const storageSizeBytesFromEfficiency =
        efficiency && Number.isFinite(efficiency.totalGib)
          ? efficiency.totalGib * 1024 ** 3
          : null;
      const storageSizeBytes =
        storageSizeBytesFromLens != null && storageSizeBytesFromLens > 0
          ? storageSizeBytesFromLens
          : storageSizeBytesFromEfficiency;

      const objectCount = toNumber(storageLens?.objectCount);
      const monthlyGrowthPct = toNumber(row.trendPct);
      const requestCost = Number(row.requests ?? 0);
      const transferCost = Number(row.transfer ?? 0);
      const storageCost = Number(row.storage ?? 0);
      const retrievalCost = Number(row.retrieval ?? 0);
      const otherCost = Number(row.other ?? 0);
      const grossCost = Number(row.cost ?? 0);

      const accessCount = toNumber(storageLens?.accessCount);
      const lastAccess = computeLastAccess(accessCount, storageLens?.usageDate ?? null);

      const lifecycleMeta = lifecycleByBucket.get(bucketKey);
      const lifecycleStatus = lifecycleMeta?.lifecycleStatus
        ? toTitleCaseLabel(lifecycleMeta.lifecycleStatus)
        : lifecycleMeta
          ? lifecycleMeta.hasLifecyclePolicy
            ? "Configured"
            : "Missing"
          : "Unknown";

      const publicAccessRaw = String(row.publicAccessStatus ?? "").trim();
      const publicAccess =
        publicAccessRaw.toLowerCase() === "public"
          ? "Public"
          : publicAccessRaw.toLowerCase() === "private"
            ? "Private"
            : "Unknown";
      const versioning = toTitleCaseLabel(row.versioningStatus);
      const encryption = toTitleCaseLabel(row.encryptionStatus);
      const governanceStatus = deriveGovernanceStatus(publicAccess, versioning, encryption, lifecycleStatus);

      const basePotentialSaving = Number(row.savings ?? 0);
      const estimatedPotentialSaving = savingsByBucket.get(bucketKey) ?? 0;
      const scorePotentialSaving = optimizationSavingsByBucket.get(bucketKey) ?? 0;
      const potentialSavings = Math.max(basePotentialSaving, estimatedPotentialSaving, scorePotentialSaving, 0);

      const optimizationScore =
        optimizationScoreByBucket.get(bucketKey) ??
        healthScoreByBucket.get(bucketKey) ??
        null;

      const lifecycleMissing = lifecycleStatus.toLowerCase() === "missing" || lifecycleStatus.toLowerCase() === "not applied";
      const idleRisk = accessCount != null && accessCount <= 0 && grossCost > 0 ? 1 : 0;
      const publicRiskBase = publicAccess.toLowerCase() === "public" ? 3 : publicAccess.toLowerCase() === "private" ? 0 : 1;
      const publicRiskScore = publicRiskBase + (lifecycleMissing ? 1 : 0) + idleRisk;

      return {
        bucketName,
        account: String(row.account ?? "--"),
        region: String(row.region ?? "--"),
        grossCost,
        storageSizeBytes,
        objectCount,
        storageClassMix: formatStorageClassMix(storageLens?.storageClassDistribution, efficiency),
        requestCost,
        transferCost,
        primaryUsagePattern:
          String(row.primaryUsagePattern ?? "").trim() ||
          derivePrimaryUsagePattern({
            storageCost,
            requestCost,
            transferCost,
            retrievalCost,
            otherCost,
          }),
        monthlyGrowthPct,
        lastAccessLabel: lastAccess.label,
        lifecycleStatus,
        governanceStatus,
        publicAccess,
        versioning,
        encryption,
        optimizationSignal:
          String(row.optimizationSignal ?? "").trim() ||
          deriveOptimizationSignal({
            governanceStatus,
            lifecycleStatus,
            publicAccess,
            accessCount,
            monthlyGrowthPct,
            optimizationScore,
          }),
        potentialSavings,
        publicRiskScore,
        lastAccessOrder: lastAccess.order,
        lastAccessEpoch: lastAccess.epoch,
      };
    });
  }, [
    healthScoreByBucket,
    lifecycleByBucket,
    optimizationSavingsByBucket,
    optimizationScoreByBucket,
    savingsByBucket,
    scopedRows,
    storageClassEfficiencyByBucket,
  ]);

  const sortedRows = useMemo(() => {
    const next = [...combinedRows];
    next.sort((a, b) => b.grossCost - a.grossCost);

    return next;
  }, [combinedRows]);

  const kpis = useMemo(() => {
    const buckets = combinedRows.length;
    const grossBucketCost = combinedRows.reduce((sum, row) => sum + row.grossCost, 0);
    const totalStorageBytes = combinedRows.reduce((sum, row) => sum + Number(row.storageSizeBytes ?? 0), 0);
    const totalPotentialSavings = combinedRows.reduce((sum, row) => sum + Number(row.potentialSavings ?? 0), 0);
    return {
      buckets,
      grossBucketCost,
      totalStorageBytes,
      totalPotentialSavings,
    };
  }, [combinedRows]);

  return (
    <div className="dashboard-page">
      {overviewQuery.isLoading && !baseData ? <S3BucketInfoSkeleton /> : null}
      {showSlowLoadingHint && !baseData ? (
        <p className="dashboard-note">Still loading bucket insights. This is taking longer than expected.</p>
      ) : null}
      {overviewQuery.isError ? <p className="dashboard-note">Failed to load S3 bucket insights: {overviewQuery.error.message}</p> : null}

      {!overviewQuery.isLoading && !overviewQuery.isError ? (
        <div className="s3-bucket-section">
          <section className="cost-explorer-widget-shell s3-bucket-kpi-shell">
            <div className="s3-bucket-kpi-row" aria-label="S3 bucket KPI summary">
              <article className="s3-bucket-kpi-tile s3-bucket-kpi-tile--bucket">
                <p className="cost-explorer-insight-tile__label">Total Buckets</p>
                <p className="s3-bucket-kpi-tile__count">{integerFormatter.format(kpis.buckets)}</p>
              </article>
              <article className="s3-bucket-kpi-tile">
                <p className="cost-explorer-insight-tile__label">Gross Bucket Cost</p>
                <p className="s3-bucket-kpi-tile__meta">{currencyFormatter.format(kpis.grossBucketCost)}</p>
              </article>
              <article className="s3-bucket-kpi-tile">
                <p className="cost-explorer-insight-tile__label">Storage Size</p>
                <p className="s3-bucket-kpi-tile__meta">{formatBytesToReadable(kpis.totalStorageBytes)}</p>
              </article>
              <article className="s3-bucket-kpi-tile">
                <p className="cost-explorer-insight-tile__label">Potential Savings</p>
                <p className="s3-bucket-kpi-tile__meta">{currencyFormatter.format(kpis.totalPotentialSavings)}</p>
              </article>
            </div>
            {optimizationQuery.isError ? (
              <p className="dashboard-note" style={{ marginTop: 10 }}>
                Lifecycle status is partially unavailable: {optimizationQuery.error.message}
              </p>
            ) : null}
            {deepInsightsQuery.isError ? (
              <p className="dashboard-note" style={{ marginTop: 10 }}>
                Detailed optimization insights are temporarily unavailable: {deepInsightsQuery.error.message}
              </p>
            ) : null}
          </section>

          <section className="cost-explorer-widget-shell s3-bucket-table-shell">
            <S3BucketCombinedTable
              rows={sortedRows}
              onBucketClick={(bucketName) => {
                const searchParams = new URLSearchParams(location.search);
                searchParams.set("s3Section", "cost");
                navigate({
                  pathname: `/dashboard/s3/bucket/${encodeURIComponent(bucketName)}`,
                  search: searchParams.toString(),
                });
              }}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}
