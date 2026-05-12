import type {
  S3FinopsBucketBase,
  S3LifecycleRecommendationInsight,
  S3RecommendationConfidence,
  S3StorageAnomalyInsight,
} from "./s3-cost-insights.types.js";

const createRecommendationId = (bucketName: string, category: string): string =>
  `${bucketName}:${category}`.toLowerCase().replace(/[^a-z0-9:_-]/g, "-");

const confidenceBySignals = (signalCount: number): S3RecommendationConfidence => {
  if (signalCount >= 3) return "HIGH";
  if (signalCount === 2) return "MEDIUM";
  return "LOW";
};

export class S3LifecycleRecommendationService {
  buildRecommendations(
    buckets: S3FinopsBucketBase[],
    anomalies: S3StorageAnomalyInsight[],
  ): { items: S3LifecycleRecommendationInsight[]; total: number } {
    const anomalyByBucket = new Map(anomalies.map((item) => [item.bucketName, item]));
    const recommendations: S3LifecycleRecommendationInsight[] = [];

    for (const bucket of buckets) {
      const standardPct = bucket.totalStorageGib > 0 ? (bucket.standardGib / bucket.totalStorageGib) * 100 : 0;
      const archivePct = bucket.totalStorageGib > 0
        ? ((bucket.glacierGib + bucket.deepArchiveGib) / bucket.totalStorageGib) * 100
        : 0;

      if (!bucket.hasLifecyclePolicy && bucket.totalStorageGib > 100) {
        const monthly = bucket.totalStorageGib * 0.0035;
        recommendations.push({
          recommendationId: createRecommendationId(bucket.bucketName, "add-lifecycle-policy"),
          bucketName: bucket.bucketName,
          category: "LIFECYCLE",
          recommendation: "Add lifecycle policy",
          reason: "Bucket has significant storage without lifecycle transitions or expiration controls.",
          estimatedMonthlySaving: monthly,
          estimatedAnnualSaving: monthly * 12,
          confidence: confidenceBySignals(3),
          implementationComplexity: "LOW",
          riskLevel: "LOW",
          requiredOwnerAction: "Define age thresholds and apply transition/expiration rules.",
          signalsUsed: ["storage_lens.bytes_*", "config.lifecycle_rules_count", "bucket_storage_size"],
        });
      }

      if (standardPct >= 75 && bucket.standardGib >= 50) {
        const monthly = bucket.standardGib * 0.0105;
        recommendations.push({
          recommendationId: createRecommendationId(bucket.bucketName, "standard-to-ia"),
          bucketName: bucket.bucketName,
          category: "STORAGE_CLASS",
          recommendation: "Transition Standard to Standard-IA",
          reason: `Standard storage concentration is high (${standardPct.toFixed(1)}%).`,
          estimatedMonthlySaving: monthly,
          estimatedAnnualSaving: monthly * 12,
          confidence: confidenceBySignals(bucket.hasLifecyclePolicy ? 2 : 3),
          implementationComplexity: "MEDIUM",
          riskLevel: "MEDIUM",
          requiredOwnerAction: "Validate access pattern by prefix and apply transition after retention window.",
          signalsUsed: ["storage_class_distribution", "request_cost_profile", "lifecycle_policy_state"],
        });
      }

      if (bucket.standardGib >= 100 && bucket.intelligentTieringGib < bucket.standardGib * 0.1) {
        const monthly = bucket.standardGib * 0.004;
        recommendations.push({
          recommendationId: createRecommendationId(bucket.bucketName, "enable-intelligent-tiering"),
          bucketName: bucket.bucketName,
          category: "INTELLIGENT_TIERING",
          recommendation: "Enable Intelligent Tiering",
          reason: "High standard footprint with no intelligent tiering coverage.",
          estimatedMonthlySaving: monthly,
          estimatedAnnualSaving: monthly * 12,
          confidence: confidenceBySignals(2),
          implementationComplexity: "LOW",
          riskLevel: "LOW",
          requiredOwnerAction: "Enable intelligent tiering for dynamic-access prefixes.",
          signalsUsed: ["bytes_standard", "bytes_intelligent_tiering"],
        });
      }

      if (bucket.noncurrentVersionGib > 10) {
        const monthly = bucket.noncurrentVersionGib * 0.023;
        recommendations.push({
          recommendationId: createRecommendationId(bucket.bucketName, "expire-noncurrent-versions"),
          bucketName: bucket.bucketName,
          category: "VERSIONING",
          recommendation: "Expire noncurrent versions",
          reason: "Noncurrent storage footprint indicates version-retention waste opportunity.",
          estimatedMonthlySaving: monthly,
          estimatedAnnualSaving: monthly * 12,
          confidence: confidenceBySignals(2),
          implementationComplexity: "LOW",
          riskLevel: "MEDIUM",
          requiredOwnerAction: "Set noncurrent expiration policy aligned with compliance retention.",
          signalsUsed: ["noncurrent_version_bytes", "versioning_configuration"],
        });
      }

      if (bucket.incompleteMultipartGib > 1) {
        const monthly = bucket.incompleteMultipartGib * 0.023;
        recommendations.push({
          recommendationId: createRecommendationId(bucket.bucketName, "abort-multipart"),
          bucketName: bucket.bucketName,
          category: "HYGIENE",
          recommendation: "Abort incomplete multipart uploads",
          reason: "Incomplete multipart uploads are accumulating billable storage waste.",
          estimatedMonthlySaving: monthly,
          estimatedAnnualSaving: monthly * 12,
          confidence: confidenceBySignals(2),
          implementationComplexity: "LOW",
          riskLevel: "LOW",
          requiredOwnerAction: "Apply abort-incomplete-multipart lifecycle rule (e.g., 7 days).",
          signalsUsed: ["incomplete_multipart_upload_bytes", "lifecycle_policy_state"],
        });
      }

      if (archivePct > 60 && bucket.retrievalCost > bucket.storageCost * 0.2) {
        recommendations.push({
          recommendationId: createRecommendationId(bucket.bucketName, "archive-retrieval-review"),
          bucketName: bucket.bucketName,
          category: "ARCHIVE_RETRIEVAL",
          recommendation: "Review high retrieval from archive classes",
          reason: "Archive-heavy bucket shows elevated retrieval costs that may offset storage savings.",
          estimatedMonthlySaving: Math.max(bucket.retrievalCost * 0.2, 0),
          estimatedAnnualSaving: Math.max(bucket.retrievalCost * 0.2, 0) * 12,
          confidence: confidenceBySignals(3),
          implementationComplexity: "MEDIUM",
          riskLevel: "HIGH",
          requiredOwnerAction: "Adjust lifecycle transitions for frequently accessed archived prefixes.",
          signalsUsed: ["archive_storage_pct", "retrieval_cost", "request_pattern"],
        });
      }

      if (bucket.replicationStatus?.toLowerCase() === "enabled" && bucket.totalStorageGib > 500 && bucket.requestCost < 10) {
        recommendations.push({
          recommendationId: createRecommendationId(bucket.bucketName, "replication-review"),
          bucketName: bucket.bucketName,
          category: "REPLICATION",
          recommendation: "Review excessive replication",
          reason: "Replication enabled on large bucket with low operational activity; potential low-value replication spend.",
          estimatedMonthlySaving: bucket.totalStorageGib * 0.002,
          estimatedAnnualSaving: bucket.totalStorageGib * 0.002 * 12,
          confidence: confidenceBySignals(2),
          implementationComplexity: "HIGH",
          riskLevel: "HIGH",
          requiredOwnerAction: "Validate DR/RPO requirements and narrow replication scope by prefix/tag.",
          signalsUsed: ["replication_status", "bucket_size", "request_activity"],
        });
      }

      const anomaly = anomalyByBucket.get(bucket.bucketName);
      if (anomaly && anomaly.anomalyType === "CLASS_MIX_SHIFT") {
        recommendations.push({
          recommendationId: createRecommendationId(bucket.bucketName, "prefix-lifecycle-split"),
          bucketName: bucket.bucketName,
          category: "PREFIX_STRATEGY",
          recommendation: "Add lifecycle by prefix for mixed access pattern",
          reason: "Storage class mix shifted quickly; likely mixed workload requires differentiated lifecycle rules.",
          estimatedMonthlySaving: Math.max(bucket.storageCost * 0.1, 0),
          estimatedAnnualSaving: Math.max(bucket.storageCost * 0.1, 0) * 12,
          confidence: anomaly.confidence,
          implementationComplexity: "HIGH",
          riskLevel: "MEDIUM",
          requiredOwnerAction: "Segment prefixes by access profile and apply targeted transitions.",
          signalsUsed: ["storage_mix_shift", "7d_growth", "anomaly_signal"],
        });
      }
    }

    recommendations.sort((a, b) => b.estimatedMonthlySaving - a.estimatedMonthlySaving);

    return {
      items: recommendations.slice(0, 500),
      total: recommendations.length,
    };
  }
}
