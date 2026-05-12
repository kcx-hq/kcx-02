import type {
  S3LifecycleRecommendationInsight,
  S3RecommendationConfidence,
  S3SavingsEstimateInsight,
} from "./s3-cost-insights.types.js";

const categoryToSavingsType: Record<string, string> = {
  LIFECYCLE: "STANDARD_TO_IA",
  STORAGE_CLASS: "STANDARD_TO_GLACIER",
  INTELLIGENT_TIERING: "INTELLIGENT_TIERING",
  VERSIONING: "NONCURRENT_VERSION_CLEANUP",
  HYGIENE: "MULTIPART_UPLOAD_CLEANUP",
  REPLICATION: "REPLICATION_OPTIMIZATION",
  ARCHIVE_RETRIEVAL: "REQUEST_OPTIMIZATION",
  PREFIX_STRATEGY: "LIFECYCLE_PREFIX_OPTIMIZATION",
};

const assumptionsByType: Record<string, string[]> = {
  STANDARD_TO_IA: ["Eligible objects have low access frequency.", "Regional S3 price deltas use default USD rates."],
  STANDARD_TO_GLACIER: ["Cold data retrieval rate remains low.", "Transition charges are not netted out in estimate."],
  INTELLIGENT_TIERING: ["Access pattern is mixed/uncertain.", "Monitoring charge already accounted at coarse estimate."],
  NONCURRENT_VERSION_CLEANUP: ["Retention policy allows noncurrent expiration.", "Versioned delete markers are not compliance-locked."],
  MULTIPART_UPLOAD_CLEANUP: ["Incomplete uploads are stale and safe to abort.", "Abort rules do not affect valid resumable clients."],
  REPLICATION_OPTIMIZATION: ["Replication scope can be narrowed without violating DR policy.", "Cross-region transfer and duplicate storage are partially avoidable."],
  REQUEST_OPTIMIZATION: ["Application behavior can reduce expensive request/retrieval patterns.", "No major business behavior change required."],
  LIFECYCLE_PREFIX_OPTIMIZATION: ["Prefix-level access segmentation is feasible.", "Lifecycle can be applied without migration outage."],
};

const limitations = [
  "Estimates use generalized S3 pricing and do not include every request/transition micro-charge.",
  "Actual savings depend on implementation timing and application behavior changes.",
];

export class S3SavingsEstimationService {
  buildSavingsEstimates(
    recommendations: S3LifecycleRecommendationInsight[],
  ): { items: S3SavingsEstimateInsight[]; totalMonthlySaving: number; totalAnnualSaving: number } {
    const bucketed = new Map<string, S3SavingsEstimateInsight>();

    for (const recommendation of recommendations) {
      const savingsType = categoryToSavingsType[recommendation.category] ?? "GENERAL_OPTIMIZATION";
      const key = `${recommendation.bucketName}:${savingsType}`;
      const existing = bucketed.get(key);

      if (!existing) {
        bucketed.set(key, {
          bucketName: recommendation.bucketName,
          savingsType,
          estimatedMonthlySaving: recommendation.estimatedMonthlySaving,
          estimatedAnnualSaving: recommendation.estimatedAnnualSaving,
          confidence: recommendation.confidence,
          assumptions: assumptionsByType[savingsType] ?? ["Derived from lifecycle recommendation signals."],
          limitations,
          currency: "USD",
        });
        continue;
      }

      existing.estimatedMonthlySaving += recommendation.estimatedMonthlySaving;
      existing.estimatedAnnualSaving += recommendation.estimatedAnnualSaving;
      existing.confidence = this.mergeConfidence(existing.confidence, recommendation.confidence);
    }

    const items = Array.from(bucketed.values()).sort((a, b) => b.estimatedMonthlySaving - a.estimatedMonthlySaving);
    const totalMonthlySaving = items.reduce((sum, item) => sum + item.estimatedMonthlySaving, 0);
    const totalAnnualSaving = items.reduce((sum, item) => sum + item.estimatedAnnualSaving, 0);

    return {
      items: items.slice(0, 1000),
      totalMonthlySaving,
      totalAnnualSaving,
    };
  }

  private mergeConfidence(
    existing: S3RecommendationConfidence,
    incoming: S3RecommendationConfidence,
  ): S3RecommendationConfidence {
    const rank: Record<S3RecommendationConfidence, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
    return rank[incoming] > rank[existing] ? incoming : existing;
  }
}
