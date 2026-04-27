import { Ec2OptimizationRepository } from "./ec2-optimization.repository.js";
import type {
  Ec2OptimizationActionEvidenceItem,
  Ec2OptimizationActionRecommendation,
  Ec2OptimizationEffortLevel,
  Ec2OptimizationRecommendationsQuery,
  Ec2OptimizationRecommendationsResponse,
  Ec2OptimizationRiskLevel,
} from "./ec2-optimization.types.js";

type PersistedRecommendationRow = Awaited<
  ReturnType<Ec2OptimizationRepository["getPersistedRecommendations"]>
>[number];

type RecommendationCategory = "rightsizing" | "idle_waste" | "coverage" | "performance_risk";

const RISK_ORDER: Record<Ec2OptimizationRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const TYPE_META = {
  idle_instance: {
    actionLabel: "Review idle resource",
    recommendedAction: "Stop or terminate after owner validation",
    riskDefault: "low" as Ec2OptimizationRiskLevel,
    effortDefault: "low" as Ec2OptimizationEffortLevel,
  },
  underutilized_instance: {
    actionLabel: "Review rightsizing",
    recommendedAction: "Downsize to recommended instance type if available",
    riskDefault: "medium" as Ec2OptimizationRiskLevel,
    effortDefault: "medium" as Ec2OptimizationEffortLevel,
  },
  overutilized_instance: {
    actionLabel: "Review performance risk",
    recommendedAction: "Scale up, scale out, or review workload capacity",
    riskDefault: "high" as Ec2OptimizationRiskLevel,
    effortDefault: "medium" as Ec2OptimizationEffortLevel,
  },
  uncovered_on_demand: {
    actionLabel: "Review coverage",
    recommendedAction: "Consider Reserved Instance or Savings Plan coverage",
    riskDefault: "low" as Ec2OptimizationRiskLevel,
    effortDefault: "low" as Ec2OptimizationEffortLevel,
  },
  unattached_ebs_volume: {
    actionLabel: "Review volume",
    recommendedAction: "Delete unattached volume after snapshot/owner validation",
    riskDefault: "medium" as Ec2OptimizationRiskLevel,
    effortDefault: "low" as Ec2OptimizationEffortLevel,
  },
  ebs_attached_to_stopped_instance: {
    actionLabel: "Review volume",
    recommendedAction: "Review stopped instance and attached volume usage",
    riskDefault: "medium" as Ec2OptimizationRiskLevel,
    effortDefault: "low" as Ec2OptimizationEffortLevel,
  },
} as const;

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeRisk = (
  riskLevelRaw: string | null,
  recommendationType: string,
): Ec2OptimizationRiskLevel => {
  const normalized = (riskLevelRaw ?? "").trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") return normalized;
  return TYPE_META[recommendationType as keyof typeof TYPE_META]?.riskDefault ?? "medium";
};

const normalizeEffort = (
  effortLevelRaw: string | null,
  recommendationType: string,
): Ec2OptimizationEffortLevel => {
  const normalized = (effortLevelRaw ?? "").trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") return normalized;
  return TYPE_META[recommendationType as keyof typeof TYPE_META]?.effortDefault ?? "low";
};

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 100 ? 0 : size >= 10 ? 1 : 2)} ${units[index]}`;
};

const buildEvidence = (
  rawPayloadJson: string | null,
  row: PersistedRecommendationRow,
): Ec2OptimizationActionEvidenceItem[] => {
  if (!rawPayloadJson) return [];
  try {
    const payload = JSON.parse(rawPayloadJson) as Record<string, unknown>;
    const evidence: Ec2OptimizationActionEvidenceItem[] = [];
    const avgCpu = Number(payload.avgCpu ?? payload.avg_cpu ?? payload.cpuAvg ?? payload.cpu_avg);
    const peakCpu = Number(payload.peakCpu ?? payload.peak_cpu ?? payload.cpuMax ?? payload.cpu_max);
    const avgDailyNetworkBytes = Number(
      payload.avgDailyNetworkBytes ??
      payload.avg_daily_network_bytes ??
      payload.networkBytesDailyAvg ??
      payload.network_bytes_daily_avg,
    );
    const pricing = String(
      payload.reservationType ?? payload.reservation_type ?? payload.pricingModel ?? payload.pricing_model ?? "",
    ).trim();

    if (Number.isFinite(avgCpu)) evidence.push({ label: "Avg CPU", value: `${avgCpu.toFixed(1)}%` });
    if (Number.isFinite(peakCpu)) evidence.push({ label: "Peak CPU", value: `${peakCpu.toFixed(1)}%` });
    if (Number.isFinite(avgDailyNetworkBytes)) {
      evidence.push({ label: "Avg daily network", value: formatBytes(avgDailyNetworkBytes) });
    }
    if (pricing.length > 0) {
      const normalized = pricing.replaceAll("_", "-");
      evidence.push({
        label: "Pricing",
        value: normalized.toLowerCase() === "on-demand" ? "On-Demand" : normalized,
      });
    }
    if (row.currentResourceType) evidence.push({ label: "Current type", value: row.currentResourceType });
    if (row.recommendedResourceType) evidence.push({ label: "Recommended type", value: row.recommendedResourceType });
    return evidence.slice(0, 6);
  } catch {
    return [];
  }
};

const looksLikeRightsizingOverutilized = (row: PersistedRecommendationRow): boolean => {
  if ((row.recommendedResourceType ?? "").trim().length > 0) return true;
  const content = `${row.recommendationTitle ?? ""} ${row.recommendationText ?? ""}`.toLowerCase();
  return content.includes("scale") || content.includes("rightsize") || content.includes("rightsizing");
};

const categoryForRecommendation = (row: PersistedRecommendationRow): RecommendationCategory | null => {
  const type = (row.recommendationType ?? "").trim();
  if (type === "underutilized_instance") return "rightsizing";
  if (type === "idle_instance" || type === "unattached_ebs_volume" || type === "ebs_attached_to_stopped_instance") {
    return "idle_waste";
  }
  if (type === "uncovered_on_demand") return "coverage";
  if (type === "overutilized_instance") return "performance_risk";
  return null;
};

const categoryForTypeOnly = (recommendationType: string): RecommendationCategory | null => {
  if (recommendationType === "underutilized_instance") return "rightsizing";
  if (
    recommendationType === "idle_instance" ||
    recommendationType === "unattached_ebs_volume" ||
    recommendationType === "ebs_attached_to_stopped_instance"
  ) return "idle_waste";
  if (recommendationType === "uncovered_on_demand") return "coverage";
  if (recommendationType === "overutilized_instance") return "performance_risk";
  return null;
};

const toRecommendation = (
  row: PersistedRecommendationRow,
  input: Ec2OptimizationRecommendationsQuery,
): Ec2OptimizationActionRecommendation | null => {
  const recommendationType = (row.recommendationType ?? "").trim();
  if (!recommendationType) return null;
  if (!TYPE_META[recommendationType as keyof typeof TYPE_META]) return null;

  const resourceId = row.resourceId?.trim() ?? "";
  if (!resourceId) return null;

  const recommendationId = Math.trunc(toNumber(row.recommendationId));
  const riskLevel = normalizeRisk(row.riskLevel, recommendationType);
  const effortLevel = normalizeEffort(row.effortLevel, recommendationType);
  const drilldownParams = new URLSearchParams();
  drilldownParams.set("resourceId", resourceId);
  drilldownParams.set("recommendationId", String(recommendationId));
  drilldownParams.set("resourceType", row.resourceType === "ebs_volume" ? "volume" : "instance");
  drilldownParams.set("from", input.dateFrom);
  drilldownParams.set("to", input.dateTo);

  return {
    recommendationId,
    recommendationType,
    resourceType: row.resourceType?.trim() || "ec2_instance",
    resourceId,
    resourceName: row.resourceName?.trim() || resourceId,
    accountName: row.accountName?.trim() || row.awsAccountId?.trim() || null,
    region: row.region?.trim() || null,
    availabilityZone: row.availabilityZone?.trim() || null,
    currentResourceType: row.currentResourceType?.trim() || null,
    recommendedResourceType: row.recommendedResourceType?.trim() || null,
    monthlyCost: toNumber(row.monthlyCost),
    estimatedSavings: toNumber(row.estimatedSavings),
    projectedMonthlyCost: toNumber(row.projectedMonthlyCost),
    riskLevel,
    effortLevel,
    status: (row.status ?? "OPEN").trim().toUpperCase(),
    reason: row.recommendationText?.trim() || "",
    evidence: buildEvidence(row.rawPayloadJson, row),
    recommendedAction: TYPE_META[recommendationType as keyof typeof TYPE_META].recommendedAction,
    actionLabel: TYPE_META[recommendationType as keyof typeof TYPE_META].actionLabel,
    drilldownUrl: `/dashboard/ec2/performance?${drilldownParams.toString()}`,
  };
};

const sortBySavingsRisk = (
  left: Ec2OptimizationActionRecommendation,
  right: Ec2OptimizationActionRecommendation,
): number => {
  if (left.estimatedSavings !== right.estimatedSavings) {
    return right.estimatedSavings - left.estimatedSavings;
  }
  if (left.riskLevel !== right.riskLevel) {
    return RISK_ORDER[left.riskLevel] - RISK_ORDER[right.riskLevel];
  }
  return right.recommendationId - left.recommendationId;
};

export class Ec2OptimizationService {
  private readonly repository: Ec2OptimizationRepository;

  constructor(repository: Ec2OptimizationRepository = new Ec2OptimizationRepository()) {
    this.repository = repository;
  }

  async getRecommendations(
    input: Ec2OptimizationRecommendationsQuery,
  ): Promise<Ec2OptimizationRecommendationsResponse> {
    const scopedOpenRows = await this.repository.getPersistedRecommendations({
      ...input,
      status: input.status ?? "OPEN",
    });
    const scopedAllStatusRows = await this.repository.getPersistedRecommendations({
      ...input,
      status: null,
    });

    const scopedOpenRecommendations = scopedOpenRows
      .map((row) => toRecommendation(row, input))
      .filter((row): row is Ec2OptimizationActionRecommendation => Boolean(row));
    const openRowById = new Map<number, PersistedRecommendationRow>();
    for (const row of scopedOpenRows) {
      openRowById.set(Math.trunc(toNumber(row.recommendationId)), row);
    }

    const byCategory: Ec2OptimizationRecommendationsResponse["recommendations"] = {
      rightsizing: [],
      idle_waste: [],
      coverage: [],
      performance_risk: [],
    };

    for (const recommendation of scopedOpenRecommendations) {
      const sourceRow = openRowById.get(recommendation.recommendationId);
      if (!sourceRow) continue;
      if (
        recommendation.recommendationType === "overutilized_instance" &&
        looksLikeRightsizingOverutilized(sourceRow)
      ) {
        byCategory.rightsizing.push(recommendation);
      }
      const category = categoryForRecommendation(sourceRow);
      if (!category) continue;
      byCategory[category].push(recommendation);
    }

    Object.keys(byCategory).forEach((key) => {
      const typedKey = key as keyof typeof byCategory;
      byCategory[typedKey] = [...byCategory[typedKey]].sort(sortBySavingsRisk);
    });

    const categories = [
      { key: "rightsizing", label: "Rightsizing", items: byCategory.rightsizing },
      { key: "idle_waste", label: "Idle & Waste", items: byCategory.idle_waste },
      { key: "coverage", label: "Coverage", items: byCategory.coverage },
      { key: "performance_risk", label: "Performance Risk", items: byCategory.performance_risk },
    ] as const;

    const totalPotentialSavings = Number(
      categories.reduce((sum, category) => sum + category.items.reduce((rowSum, item) => rowSum + Math.max(0, item.estimatedSavings), 0), 0).toFixed(4),
    );

    const allScopedStatusRecommendations = scopedAllStatusRows
      .map((row) => toRecommendation(row, input))
      .filter((row): row is Ec2OptimizationActionRecommendation => Boolean(row));

    const verifiedSavings = Number(
      allScopedStatusRecommendations
        .filter((row) => row.status === "RESOLVED" || row.status === "APPLIED" || row.status === "COMPLETED")
        .reduce((sum, row) => sum + Math.max(0, row.estimatedSavings), 0)
        .toFixed(4),
    );

    const appliedActions = allScopedStatusRecommendations.filter(
      (row) => row.status === "APPLIED" || row.status === "COMPLETED",
    ).length;

    const pendingActions = allScopedStatusRecommendations.filter((row) => row.status === "OPEN").length;
    const ignoredRecommendations = allScopedStatusRecommendations.filter((row) => row.status === "IGNORED").length;

    const dedupeTopAction = new Set<string>();
    const topActions = [...scopedOpenRecommendations]
      .sort(sortBySavingsRisk)
      .filter((row) => {
        const key = `${row.recommendationType}::${row.resourceId}`;
        if (dedupeTopAction.has(key)) return false;
        dedupeTopAction.add(key);
        return true;
      })
      .slice(0, 5)
      .map((row) => {
        const baseCategory = categoryForTypeOnly(row.recommendationType) ?? "idle_waste";

        return {
          recommendationId: row.recommendationId,
          category: baseCategory as RecommendationCategory,
          recommendationType: row.recommendationType,
          title: row.reason.length > 0 ? row.reason : row.recommendedAction,
          resourceId: row.resourceId,
          resourceName: row.resourceName,
          estimatedSavings: row.estimatedSavings,
          riskLevel: row.riskLevel,
          actionLabel: row.actionLabel,
          drilldownUrl: row.drilldownUrl,
        };
      });

    return {
      overview: {
        totalPotentialSavings,
        currencyCode: "USD",
        categories: categories.map((category) => {
          const savings = Number(
            category.items.reduce((sum, item) => sum + Math.max(0, item.estimatedSavings), 0).toFixed(4),
          );
          const percent = totalPotentialSavings > 0
            ? Number(((savings / totalPotentialSavings) * 100).toFixed(2))
            : 0;
          return {
            key: category.key,
            label: category.label,
            savings,
            count: category.items.length,
            percent,
          };
        }),
        lifecycle: {
          verifiedSavings,
          appliedActions,
          pendingActions,
          ignoredRecommendations,
        },
        topActions,
      },
      recommendations: byCategory,
    };
  }
}
