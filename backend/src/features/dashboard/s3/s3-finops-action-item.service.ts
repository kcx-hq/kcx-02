import type {
  S3FinopsActionItemInsight,
  S3LifecycleRecommendationInsight,
  S3OptimizationPriority,
  S3OwnerInsight,
} from "./s3-cost-insights.types.js";

type OwnerLookup = {
  ownerTeam: string;
  applicationName: string;
  businessUnit: string;
};

export class S3FinopsActionItemService {
  buildBacklog(
    recommendations: S3LifecycleRecommendationInsight[],
    ownersByBucket: ReadonlyMap<string, OwnerLookup>,
    priorityByBucket: Map<string, S3OptimizationPriority>,
  ): {
    items: S3FinopsActionItemInsight[];
    summary: { open: number; inProgress: number; implemented: number; slaBreached: number };
  } {
    const nowIso = new Date().toISOString();

    const items = recommendations.map<S3FinopsActionItemInsight>((recommendation) => {
      const owner = ownersByBucket.get(recommendation.bucketName);
      const priority = priorityByBucket.get(recommendation.bucketName) ?? "P2";

      return {
        actionId: this.createActionId(recommendation.bucketName, recommendation.category),
        bucketName: recommendation.bucketName,
        accountId: "unknown",
        region: null,
        ownerTeam: owner?.ownerTeam ?? "UNMAPPED",
        applicationName: owner?.applicationName ?? "UNMAPPED",
        businessUnit: owner?.businessUnit ?? "UNMAPPED",
        category: recommendation.category,
        severity: this.priorityToSeverity(priority),
        priority,
        recommendation: recommendation.recommendation,
        estimatedMonthlySaving: recommendation.estimatedMonthlySaving,
        estimatedAnnualSaving: recommendation.estimatedAnnualSaving,
        confidence: recommendation.confidence,
        status: "NEW",
        assignedTo: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        resolvedAt: null,
        dismissedReason: null,
        sourceSignal: recommendation.signalsUsed.join(","),
      };
    });

    items.sort((a, b) => {
      const rank: Record<S3OptimizationPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
      const rankDiff = rank[a.priority] - rank[b.priority];
      if (rankDiff !== 0) return rankDiff;
      return b.estimatedMonthlySaving - a.estimatedMonthlySaving;
    });

    return {
      items: items.slice(0, 500),
      summary: {
        open: items.length,
        inProgress: 0,
        implemented: 0,
        slaBreached: items.filter((item) => item.priority === "P0" || item.priority === "P1").length,
      },
    };
  }

  buildOwnerInsights(actionItems: S3FinopsActionItemInsight[]): { items: S3OwnerInsight[]; unownedExpensiveBuckets: number } {
    const byOwner = new Map<string, S3OwnerInsight>();

    for (const item of actionItems) {
      const key = `${item.ownerTeam}|${item.applicationName}|${item.businessUnit}`;
      const existing = byOwner.get(key);
      if (!existing) {
        byOwner.set(key, {
          ownerTeam: item.ownerTeam,
          applicationName: item.applicationName,
          businessUnit: item.businessUnit,
          environment: "unknown",
          costCenter: "unknown",
          technicalOwner: null,
          financeOwner: null,
          criticality: "medium",
          supportChannel: null,
          totalMonthlyCost: 0,
          totalMonthlySavingsOpportunity: item.estimatedMonthlySaving,
          openActionItems: 1,
          slaBreaches: item.priority === "P0" || item.priority === "P1" ? 1 : 0,
        });
        continue;
      }

      existing.totalMonthlySavingsOpportunity += item.estimatedMonthlySaving;
      existing.openActionItems += 1;
      if (item.priority === "P0" || item.priority === "P1") {
        existing.slaBreaches += 1;
      }
    }

    const items = Array.from(byOwner.values()).sort(
      (a, b) => b.totalMonthlySavingsOpportunity - a.totalMonthlySavingsOpportunity,
    );

    const unownedExpensiveBuckets = actionItems.filter(
      (item) => item.ownerTeam === "UNMAPPED" && item.estimatedMonthlySaving >= 50,
    ).length;

    return {
      items: items.slice(0, 200),
      unownedExpensiveBuckets,
    };
  }

  private createActionId(bucketName: string, category: string): string {
    return `${bucketName}:${category}`.toLowerCase().replace(/[^a-z0-9:_-]/g, "-");
  }

  private priorityToSeverity(priority: S3OptimizationPriority): S3FinopsActionItemInsight["severity"] {
    if (priority === "P0") return "CRITICAL";
    if (priority === "P1") return "HIGH";
    if (priority === "P2") return "MEDIUM";
    return "LOW";
  }
}
