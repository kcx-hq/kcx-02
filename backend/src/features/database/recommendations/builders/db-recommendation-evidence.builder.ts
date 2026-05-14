import type {
  DbRecommendationConfidence,
  DbRecommendationCostBreakdown,
  DbRecommendationDataQualityWarning,
  DbRecommendationDataQualityWarningSeverity,
  DbRecommendationEvidenceInput,
  DbRecommendationEvidenceLevel,
  DbRecommendationLineage,
  DbRecommendationMetadata,
  DbRecommendationRuleContext,
  DbRecommendationSavingsAssumptions,
  DbRecommendationSignalMissing,
  DbRecommendationSignalUsed,
} from "../types/db-recommendations.types.js";

const DEFAULT_SOURCE_TABLES = [
  "fact_db_resource_daily",
  "db_cost_history_daily",
  "db_resource_inventory_snapshots",
  "db_utilization_daily",
] as const;

const toIso = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const asFiniteNumber = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === "string" && value.trim().length === 0) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const hasSignals = (signals: DbRecommendationSignalUsed[] | undefined): boolean => (signals?.length ?? 0) > 0;

const maxSeverity = (warnings: DbRecommendationDataQualityWarning[]): DbRecommendationDataQualityWarningSeverity | null => {
  if (warnings.some((warning) => warning.severity === "critical")) return "critical";
  if (warnings.some((warning) => warning.severity === "warning")) return "warning";
  if (warnings.some((warning) => warning.severity === "info")) return "info";
  return null;
};

const warningPenalty = (warnings: DbRecommendationDataQualityWarning[]): number => {
  let penalty = 0;
  for (const warning of warnings) {
    if (warning.severity === "critical") penalty += 15;
    else if (warning.severity === "warning") penalty += 10;
    else penalty += 5;
  }
  return penalty;
};

const missingSignalPenalty = (missingSignals: DbRecommendationSignalMissing[]): number => {
  if (missingSignals.length === 0) return 0;
  const withHighImpact = missingSignals.filter((signal) => /(required|critical|mandatory|missing)$/i.test(signal.reason));
  return withHighImpact.length * 15 + (missingSignals.length - withHighImpact.length) * 5;
};

const clampScore = (score: number): number => {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return Math.round(score);
};

export const DB_RECOMMENDATION_WARNING_CODES = {
  MISSING_TELEMETRY: "MISSING_TELEMETRY",
  MISSING_INVENTORY: "MISSING_INVENTORY",
  BILLING_ONLY_EVIDENCE: "BILLING_ONLY_EVIDENCE",
  LOW_LOOKBACK_WINDOW: "LOW_LOOKBACK_WINDOW",
  MISSING_COST_CATEGORY_BREAKDOWN: "MISSING_COST_CATEGORY_BREAKDOWN",
  SPARSE_RESOURCE_METADATA: "SPARSE_RESOURCE_METADATA",
  ESTIMATED_SAVINGS_NOT_AVAILABLE: "ESTIMATED_SAVINGS_NOT_AVAILABLE",
} as const;

export function buildDataQualityWarning(input: {
  code: string;
  message: string;
  severity: DbRecommendationDataQualityWarningSeverity;
}): DbRecommendationDataQualityWarning {
  return {
    code: input.code,
    message: input.message,
    severity: input.severity,
  };
}

export function normalizeCostBreakdown(
  input: Partial<DbRecommendationCostBreakdown> | undefined,
): DbRecommendationCostBreakdown {
  return {
    currency: typeof input?.currency === "string" && input.currency.trim() ? input.currency : "USD",
    lookback_days: asFiniteNumber(input?.lookback_days) ?? 30,
    total_cost: asFiniteNumber(input?.total_cost) ?? 0,
    storage_cost: asFiniteNumber(input?.storage_cost),
    compute_cost: asFiniteNumber(input?.compute_cost),
    backup_cost: asFiniteNumber(input?.backup_cost),
    io_cost: asFiniteNumber(input?.io_cost),
    other_cost: asFiniteNumber(input?.other_cost),
  };
}

export function normalizeSavingsAssumptions(
  input: Partial<DbRecommendationSavingsAssumptions> | undefined,
): DbRecommendationSavingsAssumptions {
  const estimatedMonthlySavings = asFiniteNumber(input?.estimated_monthly_savings);
  const estimatedSavingsPercent = asFiniteNumber(input?.estimated_savings_percent);

  if (estimatedMonthlySavings == null && estimatedSavingsPercent == null) {
    return {
      estimated_monthly_savings: null,
      estimated_savings_percent: null,
      basis: "not_estimated",
      calculation_notes: input?.calculation_notes?.length
        ? input.calculation_notes
        : ["Savings estimation is not available until rule-specific logic is implemented."],
    };
  }

  return {
    estimated_monthly_savings: estimatedMonthlySavings,
    estimated_savings_percent: estimatedSavingsPercent,
    basis: input?.basis?.trim() || "rule_estimate",
    calculation_notes: input?.calculation_notes ?? [],
  };
}

export function determineEvidenceLevel(input: {
  billingSignals: DbRecommendationSignalUsed[];
  inventorySignals: DbRecommendationSignalUsed[];
  telemetrySignals: DbRecommendationSignalUsed[];
}): DbRecommendationEvidenceLevel {
  if (hasSignals(input.telemetrySignals)) return "telemetry_backed";
  if (hasSignals(input.inventorySignals)) return "inventory_backed";
  return "billing_only";
}

export function calculateConfidence(input: {
  evidenceLevel: DbRecommendationEvidenceLevel;
  billingSignals: DbRecommendationSignalUsed[];
  lineage: DbRecommendationLineage;
  telemetrySignals: DbRecommendationSignalUsed[];
  inventorySignals: DbRecommendationSignalUsed[];
  signalsMissing: DbRecommendationSignalMissing[];
  dataQualityWarnings: DbRecommendationDataQualityWarning[];
}): { confidence: DbRecommendationConfidence; confidenceScore: number } {
  let score = 0;

  if (hasSignals(input.billingSignals)) score += 40;

  const hasLineage = Boolean(
    input.lineage.tenant_id &&
      input.lineage.cloud_connection_id &&
      input.lineage.resource_id,
  );
  if (hasLineage) score += 20;

  if (hasSignals(input.inventorySignals)) score += 20;
  if (hasSignals(input.telemetrySignals)) score += 20;

  score -= missingSignalPenalty(input.signalsMissing);
  score -= warningPenalty(input.dataQualityWarnings);

  const severityCap = maxSeverity(input.dataQualityWarnings);
  let confidenceScore = clampScore(score);

  if (severityCap === "critical") {
    confidenceScore = Math.min(confidenceScore, 49);
  } else if (severityCap === "warning" && input.evidenceLevel !== "telemetry_backed") {
    confidenceScore = Math.min(confidenceScore, 79);
  }

  if (confidenceScore <= 49) return { confidence: "low", confidenceScore };
  if (confidenceScore <= 79) return { confidence: "medium", confidenceScore };
  return { confidence: "high", confidenceScore };
}

export function buildLineage(input: DbRecommendationEvidenceInput["lineage"]): DbRecommendationLineage {
  return {
    tenant_id: input.tenant_id,
    cloud_connection_id: input.cloud_connection_id,
    resource_id: input.resource_id,
    provider: "AWS",
    service: "AmazonRDS",
    resource_type: input.resource_type ?? null,
    region: input.region ?? null,
    account_id: input.account_id ?? null,
  };
}

export function buildRuleContext(input: {
  recommendationType: string;
  ruleId: string;
  ruleVersion: string;
  lookbackStart?: Date | string | null;
  lookbackEnd?: Date | string | null;
}): DbRecommendationRuleContext {
  return {
    recommendation_type: input.recommendationType,
    rule_id: input.ruleId,
    rule_version: input.ruleVersion,
    lookback_start: toIso(input.lookbackStart) ?? null,
    lookback_end: toIso(input.lookbackEnd) ?? null,
  };
}

export function buildDbRecommendationMetadata(input: DbRecommendationEvidenceInput): DbRecommendationMetadata {
  const billingSignals = input.billingSignals ?? [];
  const inventorySignals = input.inventorySignals ?? [];
  const telemetrySignals = input.telemetrySignals ?? [];
  const signalsMissing = input.signalsMissing ?? [];
  const dataQualityWarnings = [...(input.dataQualityWarnings ?? [])];

  const evidenceLevel = determineEvidenceLevel({
    billingSignals,
    inventorySignals,
    telemetrySignals,
  });

  if (!hasSignals(telemetrySignals)) {
    dataQualityWarnings.push(
      buildDataQualityWarning({
        code: DB_RECOMMENDATION_WARNING_CODES.MISSING_TELEMETRY,
        message: "Telemetry-backed utilization signals are not available for this recommendation.",
        severity: "info",
      }),
    );
  }

  if (!hasSignals(inventorySignals)) {
    dataQualityWarnings.push(
      buildDataQualityWarning({
        code: DB_RECOMMENDATION_WARNING_CODES.MISSING_INVENTORY,
        message: "Inventory-backed signals are missing or sparse.",
        severity: "warning",
      }),
    );
  }

  if (evidenceLevel === "billing_only") {
    dataQualityWarnings.push(
      buildDataQualityWarning({
        code: DB_RECOMMENDATION_WARNING_CODES.BILLING_ONLY_EVIDENCE,
        message: "Evidence is billing-grounded only; inventory/telemetry corroboration is unavailable.",
        severity: "warning",
      }),
    );
  }

  const costBreakdown = normalizeCostBreakdown(input.costBreakdown);
  const savingsAssumptions = normalizeSavingsAssumptions(input.savingsAssumptions);

  if (
    costBreakdown.storage_cost == null ||
    costBreakdown.compute_cost == null ||
    costBreakdown.backup_cost == null ||
    costBreakdown.io_cost == null
  ) {
    dataQualityWarnings.push(
      buildDataQualityWarning({
        code: DB_RECOMMENDATION_WARNING_CODES.MISSING_COST_CATEGORY_BREAKDOWN,
        message: "One or more cost categories are not available in the current dataset.",
        severity: "info",
      }),
    );
  }

  if (savingsAssumptions.basis === "not_estimated") {
    dataQualityWarnings.push(
      buildDataQualityWarning({
        code: DB_RECOMMENDATION_WARNING_CODES.ESTIMATED_SAVINGS_NOT_AVAILABLE,
        message: "Estimated savings are not available yet.",
        severity: "info",
      }),
    );
  }

  if (costBreakdown.lookback_days < 7) {
    dataQualityWarnings.push(
      buildDataQualityWarning({
        code: DB_RECOMMENDATION_WARNING_CODES.LOW_LOOKBACK_WINDOW,
        message: "Lookback window is below 7 days and may reduce confidence.",
        severity: "warning",
      }),
    );
  }

  const lineage = buildLineage(input.lineage);

  if (!lineage.resource_type || !lineage.region || !lineage.account_id) {
    dataQualityWarnings.push(
      buildDataQualityWarning({
        code: DB_RECOMMENDATION_WARNING_CODES.SPARSE_RESOURCE_METADATA,
        message: "Resource lineage metadata is partially missing.",
        severity: "warning",
      }),
    );
  }

  const dedupedWarnings = Array.from(
    new Map(dataQualityWarnings.map((warning) => [warning.code, warning])).values(),
  );

  const { confidence, confidenceScore } = calculateConfidence({
    evidenceLevel,
    billingSignals,
    lineage,
    telemetrySignals,
    inventorySignals,
    signalsMissing,
    dataQualityWarnings: dedupedWarnings,
  });

  return {
    version: 1,
    generated_by: "db-recommendations-generator",
    generated_at: toIso(input.generatedAt) ?? new Date().toISOString(),
    confidence,
    confidence_score: confidenceScore,
    evidence_level: evidenceLevel,
    signals_used: [...billingSignals, ...inventorySignals, ...telemetrySignals],
    signals_missing: signalsMissing,
    cost_breakdown: costBreakdown,
    savings_assumptions: savingsAssumptions,
    data_quality_warnings: dedupedWarnings,
    source_tables: input.sourceTables?.length ? [...new Set(input.sourceTables)] : [...DEFAULT_SOURCE_TABLES],
    lineage,
    rule_context: buildRuleContext({
      recommendationType: input.recommendationType,
      ruleId: input.ruleId,
      ruleVersion: input.ruleVersion,
      lookbackStart: input.lookbackStart,
      lookbackEnd: input.lookbackEnd,
    }),
  };
}
