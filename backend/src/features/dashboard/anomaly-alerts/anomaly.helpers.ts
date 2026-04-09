import crypto from "node:crypto";

import type { DetectionCandidate, DetectorConfig, Severity } from "./anomaly.types.js";

export const toFiniteNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const computeDeltaPercent = (actual: number, expected: number): number => {
  if (expected === 0) return 0;
  return ((actual - expected) / Math.abs(expected)) * 100;
};

export const resolveSeverity = (deltaPercentAbs: number): Severity => {
  if (deltaPercentAbs >= 150) return "high";
  if (deltaPercentAbs >= 60) return "medium";
  return "low";
};

export const buildAnomalyFingerprint = ({
  config,
  candidate,
}: {
  config: DetectorConfig;
  candidate: DetectionCandidate;
}): string => {
  const seed = [
    candidate.tenantId,
    candidate.cloudConnectionId ?? "none",
    candidate.usageDate,
    config.anomalyType,
    config.dimensionType,
    candidate.serviceKey ?? "none",
    candidate.regionKey ?? "none",
    candidate.subAccountKey ?? "none",
    candidate.resourceKey ?? "none",
    candidate.anomalyScope,
    candidate.dimensionValue ?? "none",
  ].join("|");
  return crypto.createHash("sha256").update(seed).digest("hex");
};

export const defaultExplanation = (config: DetectorConfig, candidate: DetectionCandidate): Record<string, unknown> => ({
  detector_key: config.key,
  anomaly_type: config.anomalyType,
  dimension_type: config.dimensionType,
  measure_type: config.measureType,
  expected_value: candidate.expectedValue,
  actual_value: candidate.actualValue,
  delta_value: candidate.deltaValue,
  delta_percent: candidate.deltaPercent,
});
