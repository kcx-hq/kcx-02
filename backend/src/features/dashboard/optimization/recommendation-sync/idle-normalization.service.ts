import type {
  AwsIdleResourceRecommendationInput,
  IdleResourceType,
  NormalizedIdleRecommendation,
} from "./types.js";

const toNonEmpty = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const toRiskBand = (value: unknown): "LOW" | "MEDIUM" | "HIGH" | null => {
  const normalized = toNonEmpty(value)?.toUpperCase();
  if (!normalized) return null;
  if (normalized === "LOW" || normalized === "MEDIUM" || normalized === "HIGH") {
    return normalized;
  }
  return null;
};

const toDateOrNull = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const toIdleResourceType = (value: unknown): IdleResourceType | null => {
  const normalized = toNonEmpty(value)?.toUpperCase();
  if (!normalized) return null;
  if (normalized === "EBS" || normalized === "EIP" || normalized === "SNAPSHOT" || normalized === "ALB" || normalized === "NLB") {
    return normalized;
  }
  return null;
};

const safeJson = (value: unknown): string | null => {
  if (typeof value === "undefined") return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

export function normalizeAwsIdleRecommendations({
  tenantId,
  recommendations,
}: {
  tenantId: string;
  recommendations: AwsIdleResourceRecommendationInput[];
}): NormalizedIdleRecommendation[] {
  const normalizedRecords: NormalizedIdleRecommendation[] = [];

  for (const item of recommendations) {
    const accountId = toNonEmpty(item.accountId);
    const region = toNonEmpty(item.region);
    const resourceId = toNonEmpty(item.resourceId);

    if (!accountId || !region || !resourceId) {
      continue;
    }

    const estimatedSavings = Math.max(0, toNumber(item.estimatedMonthlySavings) ?? 0);

    normalizedRecords.push({
      tenantId,
      awsAccountId: accountId,
      awsRegionCode: region,
      category: "IDLE",
      recommendationType: item.recommendationType,
      resourceId,
      resourceArn: toNonEmpty(item.resourceArn),
      resourceName: toNonEmpty(item.resourceName),
      resourceType: toIdleResourceType(item.resourceType),
      currentResourceType: toNonEmpty(item.currentResourceType),
      recommendedResourceType: null,
      estimatedMonthlySavings: estimatedSavings,
      performanceRiskScore: null,
      performanceRiskLevel: null,
      effortLevel: toRiskBand(item.effortLevel),
      riskLevel: toRiskBand(item.riskLevel),
      recommendationTitle: toNonEmpty(item.recommendationTitle),
      recommendationText: toNonEmpty(item.recommendationText),
      idleReason: toNonEmpty(item.idleReason),
      idleObservationValue: toNonEmpty(item.idleObservationValue),
      observationStart: toDateOrNull(item.observationStart),
      observationEnd: toDateOrNull(item.observationEnd),
      rawPayloadJson: safeJson(item.rawPayload ?? item),
      sourceSystem: "AWS_IDLE_DETECTION",
      status: "OPEN",
    });
  }

  return normalizedRecords;
}
