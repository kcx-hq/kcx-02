import { useMemo } from "react";
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

export default function S3BucketInfoPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const query = useS3CostInsightsQuery();
  const optimizationQuery = useS3OptimizationQuery();

  const rows = useMemo(() => query.data?.bucketTable ?? [], [query.data?.bucketTable]);
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
    for (const item of query.data?.estimatedSavings.items ?? []) {
      const bucketKey = toBucketKey(item.bucketName);
      if (!bucketKey) continue;
      map.set(bucketKey, (map.get(bucketKey) ?? 0) + Number(item.estimatedMonthlySaving ?? 0));
    }
    return map;
  }, [query.data?.estimatedSavings.items]);

  const optimizationScoreByBucket = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of query.data?.bucketOptimizationScores.items ?? []) {
      const bucketKey = toBucketKey(item.bucketName);
      if (!bucketKey) continue;
      map.set(bucketKey, Number(item.score ?? 0));
    }
    return map;
  }, [query.data?.bucketOptimizationScores.items]);

  const optimizationSavingsByBucket = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of query.data?.bucketOptimizationScores.items ?? []) {
      const bucketKey = toBucketKey(item.bucketName);
      if (!bucketKey) continue;
      map.set(bucketKey, Math.max(map.get(bucketKey) ?? 0, Number(item.estimatedMonthlySaving ?? 0)));
    }
    return map;
  }, [query.data?.bucketOptimizationScores.items]);

  const healthScoreByBucket = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of query.data?.bucketHealthScores.items ?? []) {
      const bucketKey = toBucketKey(item.bucketName);
      if (!bucketKey) continue;
      map.set(bucketKey, Number(item.score ?? 0));
    }
    return map;
  }, [query.data?.bucketHealthScores.items]);

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

    for (const item of query.data?.storageClassEfficiency.items ?? []) {
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
  }, [query.data?.storageClassEfficiency.items]);

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
      const totalMonthlyCost = Number(row.cost ?? 0);

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
      const idleRisk = accessCount != null && accessCount <= 0 && totalMonthlyCost > 0 ? 1 : 0;
      const publicRiskBase = publicAccess.toLowerCase() === "public" ? 3 : publicAccess.toLowerCase() === "private" ? 0 : 1;
      const publicRiskScore = publicRiskBase + (lifecycleMissing ? 1 : 0) + idleRisk;

      return {
        bucketName,
        account: String(row.account ?? "--"),
        region: String(row.region ?? "--"),
        totalMonthlyCost,
        storageSizeBytes,
        objectCount,
        storageClassMix: formatStorageClassMix(storageLens?.storageClassDistribution, efficiency),
        requestCost,
        transferCost,
        monthlyGrowthPct,
        lastAccessLabel: lastAccess.label,
        lifecycleStatus,
        governanceStatus,
        publicAccess,
        versioning,
        encryption,
        optimizationScore,
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
    next.sort((a, b) => b.totalMonthlyCost - a.totalMonthlyCost);

    return next;
  }, [combinedRows]);

  const kpis = useMemo(() => {
    const buckets = combinedRows.length;
    const totalMonthlyCost = combinedRows.reduce((sum, row) => sum + row.totalMonthlyCost, 0);
    const totalStorageBytes = combinedRows.reduce((sum, row) => sum + Number(row.storageSizeBytes ?? 0), 0);
    const totalPotentialSavings = combinedRows.reduce((sum, row) => sum + Number(row.potentialSavings ?? 0), 0);
    return {
      buckets,
      totalMonthlyCost,
      totalStorageBytes,
      totalPotentialSavings,
    };
  }, [combinedRows]);

  return (
    <div className="dashboard-page">
      {query.isLoading ? <p className="dashboard-note">Loading S3 bucket insights...</p> : null}
      {query.isError ? <p className="dashboard-note">Failed to load S3 bucket insights: {query.error.message}</p> : null}

      {!query.isLoading && !query.isError ? (
        <div className="s3-bucket-section">
          <section className="cost-explorer-widget-shell s3-bucket-kpi-shell">
            <div className="s3-bucket-kpi-row" aria-label="S3 bucket KPI summary">
              <article className="s3-bucket-kpi-tile s3-bucket-kpi-tile--bucket">
                <p className="cost-explorer-insight-tile__label">Total Buckets</p>
                <p className="s3-bucket-kpi-tile__count">{integerFormatter.format(kpis.buckets)}</p>
              </article>
              <article className="s3-bucket-kpi-tile">
                <p className="cost-explorer-insight-tile__label">Total Monthly Cost</p>
                <p className="s3-bucket-kpi-tile__meta">{currencyFormatter.format(kpis.totalMonthlyCost)}</p>
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
