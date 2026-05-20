import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";
import type { DashboardScope } from "../../dashboard.types.js";
import type {
  S3BucketHealthScoreInsight,
  S3BucketOptimizationScoreInsight,
  S3CostBucketTableInsight,
  S3FinopsBucketBase,
  S3StorageAnomalyInsight,
  S3StorageClassEfficiencyInsight,
} from "../cost-insights/s3-cost-insights.types.js";

type BucketConfigRow = {
  bucket_name: string | null;
  account_id: string | null;
  region: string | null;
  lifecycle_rules_count: number | null;
  versioning_status: string | null;
  encryption_status: string | null;
  public_access_block_status: string | null;
  block_public_acls: boolean | null;
  ignore_public_acls: boolean | null;
  block_public_policy: boolean | null;
  restrict_public_buckets: boolean | null;
  policy_public_status: string | null;
  replication_status: string | null;
};

type StorageLensSnapshot = {
  usageDate: string;
  objectCount: number | null;
  currentVersionBytes: number | null;
  avgObjectSizeBytes: number | null;
  accessCount: number | null;
  percentInGlacier: number;
  storageClassDistribution: Array<{ name: string; bytes: number; percent: number }>;
};

const bytesToGib = (bytes: number): number => bytes / (1024 ** 3);

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const average = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const toPriority = (score: number): S3BucketOptimizationScoreInsight["priorityLevel"] => {
  if (score < 20) return "P0";
  if (score < 40) return "P1";
  if (score < 60) return "P2";
  if (score < 80) return "P3";
  return "P4";
};

const toHealthLabel = (score: number): S3BucketHealthScoreInsight["healthLabel"] => {
  if (score >= 90) return "Optimized";
  if (score >= 75) return "Healthy";
  if (score >= 60) return "Needs Review";
  if (score >= 40) return "Risky";
  return "High Waste / High Risk";
};

const toNormalized = (value: string | null | undefined): string =>
  String(value ?? "").trim().toLowerCase();

const derivePublicAccessStatus = (config: BucketConfigRow | undefined): "Public" | "Private" | "Unknown" => {
  if (!config) return "Unknown";

  const policyStatus = toNormalized(config.policy_public_status);
  const blockStatus = toNormalized(config.public_access_block_status);
  const blockFlags = [
    config.block_public_acls,
    config.ignore_public_acls,
    config.block_public_policy,
    config.restrict_public_buckets,
  ];

  const allBlocksEnabled = blockFlags.every((value) => value === true);
  const anyBlockDisabled = blockFlags.some((value) => value === false);
  const policySaysPublic =
    policyStatus.includes("public") &&
    !policyStatus.includes("not_public") &&
    !policyStatus.includes("not public") &&
    !policyStatus.includes("private");
  const policySaysPrivate =
    policyStatus.includes("not_public") ||
    policyStatus.includes("not public") ||
    policyStatus.includes("private");
  const blockSaysPublic = blockStatus.includes("disabled") || blockStatus.includes("off");
  const blockSaysPrivate = blockStatus.includes("enabled") || blockStatus.includes("on");

  if (policySaysPublic || blockSaysPublic || anyBlockDisabled) return "Public";
  if (allBlocksEnabled || (policySaysPrivate && blockSaysPrivate)) return "Private";
  return "Unknown";
};

export class S3BucketScoreService {
  private async getLatestConfigByBucket(
    scope: DashboardScope,
    bucketNames: string[],
  ): Promise<Map<string, BucketConfigRow>> {
    if (scope.scopeType !== "global" || bucketNames.length === 0) {
      return new Map();
    }

    const binds: unknown[] = [scope.tenantId, bucketNames];
    const where: string[] = ["bcs.tenant_id = $1::uuid", "bcs.bucket_name = ANY($2::text[])"];

    if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
      binds.push(scope.billingSourceIds);
      where.push(`bcs.billing_source_id = ANY($${binds.length}::bigint[])`);
    }
    if (typeof scope.providerId === "number") {
      binds.push(scope.providerId);
      where.push(`bcs.provider_id = $${binds.length}`);
    }

    const rows = await sequelize.query<BucketConfigRow>(
      `
      SELECT DISTINCT ON (bcs.bucket_name)
        bcs.bucket_name,
        bcs.account_id,
        bcs.region,
        bcs.lifecycle_rules_count,
        bcs.versioning_status,
        bcs.encryption_status,
        bcs.public_access_block_status,
        bcs.block_public_acls,
        bcs.ignore_public_acls,
        bcs.block_public_policy,
        bcs.restrict_public_buckets,
        bcs.policy_public_status,
        bcs.replication_status
      FROM s3_bucket_config_snapshot bcs
      WHERE ${where.join("\n        AND ")}
      ORDER BY bcs.bucket_name ASC, bcs.scan_time DESC
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );

    const map = new Map<string, BucketConfigRow>();
    for (const row of rows) {
      const bucketName = String(row.bucket_name ?? "").trim();
      if (!bucketName) continue;
      map.set(bucketName, row);
    }

    return map;
  }

  async buildBucketBase(
    scope: DashboardScope,
    bucketTable: S3CostBucketTableInsight[],
    storageLensByBucket: Map<string, StorageLensSnapshot>,
  ): Promise<S3FinopsBucketBase[]> {
    if (scope.scopeType !== "global") return [];

    const configMap = await this.getLatestConfigByBucket(
      scope,
      bucketTable.map((row) => row.bucketName),
    );

    return bucketTable.map((row) => {
      const config = configMap.get(row.bucketName);
      const storageLens = storageLensByBucket.get(row.bucketName) ?? null;
      const distribution = storageLens?.storageClassDistribution ?? [];

      const classBytes = {
        standard: distribution.find((item) => item.name === "S3 Standard")?.bytes ?? 0,
        standardIa: distribution.find((item) => item.name === "Standard-IA")?.bytes ?? 0,
        glacier: distribution.find((item) => item.name === "Glacier")?.bytes ?? 0,
        deepArchive: distribution.find((item) => item.name === "Deep Archive")?.bytes ?? 0,
        intelligentTiering: distribution.find((item) => item.name === "Intelligent-Tiering")?.bytes ?? 0,
      };

      const totalStorageBytes = Object.values(classBytes).reduce((sum, value) => sum + value, 0);

      return {
        bucketName: row.bucketName,
        accountId: String(config?.account_id ?? row.account ?? "unknown"),
        region: config?.region ?? row.region,
        owner: row.owner,
        applicationName: row.driver,
        businessUnit: row.owner === "Unassigned" ? "UNMAPPED" : row.owner,
        cost: row.cost,
        storageCost: row.storage,
        requestCost: row.requests,
        transferCost: row.transfer,
        retrievalCost: row.retrieval,
        totalStorageGib: bytesToGib(totalStorageBytes),
        standardGib: bytesToGib(classBytes.standard),
        standardIaGib: bytesToGib(classBytes.standardIa),
        glacierGib: bytesToGib(classBytes.glacier),
        deepArchiveGib: bytesToGib(classBytes.deepArchive),
        intelligentTieringGib: bytesToGib(classBytes.intelligentTiering),
        objectCount: storageLens?.objectCount ?? null,
        noncurrentVersionGib: bytesToGib(Math.max(storageLens?.currentVersionBytes ?? 0, 0) * 0.08),
        incompleteMultipartGib: bytesToGib(Math.max(storageLens?.currentVersionBytes ?? 0, 0) * 0.01),
        getRequestsCount: storageLens?.accessCount ?? null,
        putRequestsCount: null,
        hasLifecyclePolicy: (config?.lifecycle_rules_count ?? 0) > 0,
        lifecycleRulesCount: Number(config?.lifecycle_rules_count ?? 0),
        versioningStatus: config?.versioning_status ?? null,
        encryptionStatus: config?.encryption_status ?? null,
        publicAccessStatus: derivePublicAccessStatus(config),
        replicationStatus: config?.replication_status ?? null,
      };
    });
  }

  buildOptimizationScores(
    buckets: S3FinopsBucketBase[],
    anomalies: S3StorageAnomalyInsight[],
  ): { items: S3BucketOptimizationScoreInsight[]; total: number } {
    if (buckets.length === 0) return { items: [], total: 0 };

    const maxCost = Math.max(...buckets.map((bucket) => bucket.storageCost), 1);
    const anomalyByBucket = new Map(anomalies.map((item) => [item.bucketName, item]));

    const scores = buckets.map<S3BucketOptimizationScoreInsight>((bucket) => {
      const standardPct = bucket.totalStorageGib > 0 ? (bucket.standardGib / bucket.totalStorageGib) * 100 : 0;
      const costScore = clamp(100 - (bucket.storageCost / maxCost) * 100, 0, 100);
      const growthSignal = anomalyByBucket.get(bucket.bucketName)?.growthPercentage ?? 0;
      const growthScore = clamp(100 - Math.max(growthSignal, 0) * 1.5, 0, 100);
      const lifecycleGapScore = bucket.hasLifecyclePolicy ? 95 : 20;
      const standardStorageScore = clamp(100 - standardPct, 0, 100);
      const anomalyScore = anomalyByBucket.has(bucket.bucketName) ? 20 : 95;
      const ownershipGapScore = bucket.owner !== "Unassigned" ? 95 : 30;
      const requestCostPerGb = bucket.totalStorageGib > 0 ? bucket.requestCost / bucket.totalStorageGib : bucket.requestCost;
      const requestInefficiencyScore = clamp(100 - requestCostPerGb * 6, 0, 100);

      const score =
        costScore * 0.25 +
        growthScore * 0.2 +
        lifecycleGapScore * 0.15 +
        standardStorageScore * 0.15 +
        anomalyScore * 0.1 +
        ownershipGapScore * 0.1 +
        requestInefficiencyScore * 0.05;

      const issuePairs: Array<{ key: string; value: number }> = [
        { key: "High storage cost", value: 100 - costScore },
        { key: "Fast growth", value: 100 - growthScore },
        { key: "Lifecycle gap", value: 100 - lifecycleGapScore },
        { key: "Standard heavy mix", value: 100 - standardStorageScore },
        { key: "Owner mapping gap", value: 100 - ownershipGapScore },
        { key: "Request inefficiency", value: 100 - requestInefficiencyScore },
      ];

      issuePairs.sort((a, b) => b.value - a.value);

      const estimatedMonthlySaving =
        Math.max(bucket.standardGib * 0.006, 0) +
        (!bucket.hasLifecyclePolicy ? Math.max(bucket.totalStorageGib * 0.003, 0) : 0) +
        Math.max(bucket.noncurrentVersionGib * 0.004, 0);

      return {
        bucketName: bucket.bucketName,
        accountId: bucket.accountId,
        region: bucket.region,
        score,
        priorityLevel: toPriority(score),
        primaryReason: issuePairs[0]?.key ?? "Monitor bucket",
        top3Issues: issuePairs.slice(0, 3).map((item) => item.key),
        recommendedNextAction: bucket.hasLifecyclePolicy
          ? "Tune lifecycle transitions and request behavior for the top offending prefix set."
          : "Add lifecycle policy and transition cold standard objects to lower-cost class.",
        estimatedMonthlySaving,
        estimatedAnnualSaving: estimatedMonthlySaving * 12,
      };
    });

    scores.sort((a, b) => a.score - b.score);
    return { items: scores.slice(0, 500), total: scores.length };
  }

  buildHealthScores(
    buckets: S3FinopsBucketBase[],
    optimizationScores: S3BucketOptimizationScoreInsight[],
    anomalies: S3StorageAnomalyInsight[],
  ): { items: S3BucketHealthScoreInsight[]; total: number } {
    if (buckets.length === 0) return { items: [], total: 0 };

    const optimizationByBucket = new Map(optimizationScores.map((item) => [item.bucketName, item]));
    const anomalyByBucket = new Map(anomalies.map((item) => [item.bucketName, item]));

    const items = buckets.map<S3BucketHealthScoreInsight>((bucket) => {
      const optimizationScore = optimizationByBucket.get(bucket.bucketName)?.score ?? 80;
      const costEfficiency = optimizationScore;
      const lifecycleCoverage = bucket.hasLifecyclePolicy ? 95 : 35;
      const encryption = bucket.encryptionStatus?.toLowerCase().includes("enabled") ? 95 : 60;
      const tagging = bucket.owner !== "Unassigned" ? 95 : 25;
      const replicationFit = bucket.replicationStatus === "ENABLED" || bucket.replicationStatus === "present" ? 80 : 90;
      const anomalyStability = anomalyByBucket.has(bucket.bucketName) ? 30 : 90;
      const objectBehavior = bucket.objectCount != null && bucket.objectCount > 0 ? 85 : 65;
      const growthStability = clamp(100 - Math.max(anomalyByBucket.get(bucket.bucketName)?.growthPercentage ?? 0, 0), 20, 95);
      const standardPct = bucket.totalStorageGib > 0 ? (bucket.standardGib / bucket.totalStorageGib) * 100 : 0;
      const storageClassEfficiency = clamp(100 - standardPct * 0.8, 20, 95);
      const ownership = bucket.owner !== "Unassigned" ? 95 : 30;
      const governance = average([encryption, tagging, ownership, lifecycleCoverage]);

      const score =
        costEfficiency * 0.18 +
        lifecycleCoverage * 0.15 +
        encryption * 0.1 +
        tagging * 0.1 +
        replicationFit * 0.08 +
        anomalyStability * 0.12 +
        objectBehavior * 0.07 +
        growthStability * 0.07 +
        storageClassEfficiency * 0.08 +
        ownership * 0.05 +
        governance * 0.1;

      return {
        bucketName: bucket.bucketName,
        accountId: bucket.accountId,
        region: bucket.region,
        score,
        healthLabel: toHealthLabel(score),
        dimensions: {
          costEfficiency,
          lifecycleCoverage,
          encryption,
          tagging,
          replicationFit,
          anomalyStability,
          objectBehavior,
          growthStability,
          storageClassEfficiency,
          ownership,
          governance,
        },
      };
    });

    items.sort((a, b) => a.score - b.score);
    return { items: items.slice(0, 500), total: items.length };
  }

  buildStorageClassEfficiency(buckets: S3FinopsBucketBase[]): S3StorageClassEfficiencyInsight[] {
    const items = buckets.map<S3StorageClassEfficiencyInsight>((bucket) => {
      const total = Math.max(bucket.totalStorageGib, 0.0001);
      const standardPct = (bucket.standardGib / total) * 100;
      const standardIaPct = (bucket.standardIaGib / total) * 100;
      const glacierPct = (bucket.glacierGib / total) * 100;
      const deepArchivePct = (bucket.deepArchiveGib / total) * 100;
      const itPct = (bucket.intelligentTieringGib / total) * 100;

      const archivePct = glacierPct + deepArchivePct;
      const retrievalPerGb = total > 0 ? bucket.retrievalCost / total : bucket.retrievalCost;
      const archiveRetrievalRisk: "LOW" | "MEDIUM" | "HIGH" =
        archivePct > 50 && retrievalPerGb > 0.5 ? "HIGH" : archivePct > 25 && retrievalPerGb > 0.2 ? "MEDIUM" : "LOW";

      const optimizationPotential: "LOW" | "MEDIUM" | "HIGH" =
        standardPct > 85 && !bucket.hasLifecyclePolicy ? "HIGH" : standardPct > 65 ? "MEDIUM" : "LOW";

      const imbalance = clamp(Math.abs(standardPct - 40) + Math.abs(archivePct - 30), 0, 100);
      const insight =
        standardPct > 90 && !bucket.hasLifecyclePolicy
          ? "Bucket has >90% in Standard and no lifecycle policy."
          : archivePct > 50 && bucket.retrievalCost > 0
            ? "Bucket has high archive share with retrieval activity risk."
            : standardPct > 70 && bucket.intelligentTieringGib === 0
              ? "Bucket is a strong Intelligent-Tiering candidate."
              : "Storage class mix is within expected range.";

      return {
        bucketName: bucket.bucketName,
        standardGib: bucket.standardGib,
        standardPct,
        standardIaGib: bucket.standardIaGib,
        standardIaPct,
        glacierGib: bucket.glacierGib,
        glacierPct,
        deepArchiveGib: bucket.deepArchiveGib,
        deepArchivePct,
        intelligentTieringGib: bucket.intelligentTieringGib,
        intelligentTieringPct: itPct,
        archiveRetrievalRisk,
        optimizationPotential,
        storageClassImbalanceScore: imbalance,
        insight,
      };
    });

    items.sort((a, b) => b.storageClassImbalanceScore - a.storageClassImbalanceScore);
    return items.slice(0, 500);
  }
}

