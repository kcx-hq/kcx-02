import type {
  DbRecommendationDataQualityWarning,
  DbRecommendationEvidenceLevel,
  DbRecommendationMetadata,
  DbRecommendationSignalMissing,
  DbRecommendationSignalUsed,
} from "../types/db-recommendations.types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function parseRecommendationMetadata(value: unknown): Partial<DbRecommendationMetadata> | null {
  return isRecord(value) ? (value as Partial<DbRecommendationMetadata>) : null;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function parseMetadataWarnings(value: unknown): DbRecommendationDataQualityWarning[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const code = typeof item.code === "string" ? item.code : null;
      const message = typeof item.message === "string" ? item.message : null;
      const severity = item.severity;
      if (!code || !message) return null;
      if (severity !== "info" && severity !== "warning" && severity !== "critical") return null;
      return { code, message, severity };
    })
    .filter((item): item is DbRecommendationDataQualityWarning => item !== null);
}

export function parseSignalsUsed(value: unknown): DbRecommendationSignalUsed[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const key = typeof item.key === "string" ? item.key : null;
      const label = typeof item.label === "string" ? item.label : null;
      const source = typeof item.source === "string" ? item.source : null;
      if (!key || !label || !source) return null;
      return { key, label, source, value: item.value };
    })
    .filter((item): item is DbRecommendationSignalUsed => item !== null);
}

export function parseSignalsMissing(value: unknown): DbRecommendationSignalMissing[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const key = typeof item.key === "string" ? item.key : null;
      const label = typeof item.label === "string" ? item.label : null;
      const reason = typeof item.reason === "string" ? item.reason : null;
      if (!key || !label || !reason) return null;
      return { key, label, reason };
    })
    .filter((item): item is DbRecommendationSignalMissing => item !== null);
}

export function getMetadataEvidenceLevel(metadata: Partial<DbRecommendationMetadata> | null): DbRecommendationEvidenceLevel | null {
  const level = metadata?.evidence_level;
  if (level === "billing_only" || level === "inventory_backed" || level === "telemetry_backed") return level;
  return null;
}

export function getMetadataConfidence(metadata: Partial<DbRecommendationMetadata> | null): "low" | "medium" | "high" | null {
  const confidence = metadata?.confidence;
  if (confidence === "low" || confidence === "medium" || confidence === "high") return confidence;
  return null;
}

export function getMetadataSavingsBasis(metadata: Partial<DbRecommendationMetadata> | null): string | null {
  const savings = metadata?.savings_assumptions;
  if (!isRecord(savings)) return null;
  return typeof savings.basis === "string" ? savings.basis : null;
}

export function getMetadataEstimatedMonthlySavings(metadata: Partial<DbRecommendationMetadata> | null): number | null {
  const savings = metadata?.savings_assumptions;
  if (!isRecord(savings)) return null;
  return typeof savings.estimated_monthly_savings === "number" ? savings.estimated_monthly_savings : null;
}

export function getMetadataRegion(metadata: Partial<DbRecommendationMetadata> | null): string | null {
  const lineage = metadata?.lineage;
  if (!isRecord(lineage)) return null;
  return typeof lineage.region === "string" ? lineage.region : null;
}

export function getMetadataResourceType(metadata: Partial<DbRecommendationMetadata> | null): string | null {
  const lineage = metadata?.lineage;
  if (!isRecord(lineage)) return null;
  return typeof lineage.resource_type === "string" ? lineage.resource_type : null;
}

export function getMetadataEngine(metadata: Partial<DbRecommendationMetadata> | null): string | null {
  const signals = parseSignalsUsed(metadata?.signals_used);
  const engineSignal = signals.find((signal) => signal.key === "db_engine");
  if (!engineSignal) return null;
  return typeof engineSignal.value === "string" ? engineSignal.value : null;
}
