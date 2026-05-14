export const DB_RECOMMENDATION_TYPES = [
  "DB_STORAGE_OPTIMIZATION",
  "DB_IDLE_CANDIDATE",
  "DB_HA_COST_OPTIMIZATION",
  "DB_ENGINE_DEPLOYMENT_OPTIMIZATION",
  "DB_RIGHTSIZING_CANDIDATE",
] as const;

export type DbRecommendationType = (typeof DB_RECOMMENDATION_TYPES)[number];

export type DbRecommendationStatus = "OPEN" | "IN_PROGRESS" | "SNOOZED" | "DISMISSED" | "COMPLETED";

export type DbRecommendationConfidence = "low" | "medium" | "high";
export type DbRecommendationEvidenceLevel = "billing_only" | "inventory_backed" | "telemetry_backed";

export type DbRecommendationSignalUsed = {
  key: string;
  label: string;
  value: unknown;
  source: string;
};

export type DbRecommendationSignalMissing = {
  key: string;
  label: string;
  reason: string;
};

export type DbRecommendationCostBreakdown = {
  currency: string;
  lookback_days: number;
  total_cost: number;
  storage_cost: number | null;
  compute_cost: number | null;
  backup_cost: number | null;
  io_cost: number | null;
  other_cost: number | null;
};

export type DbRecommendationSavingsAssumptions = {
  estimated_monthly_savings: number | null;
  estimated_savings_percent: number | null;
  basis: string;
  calculation_notes: string[];
};

export type DbRecommendationDataQualityWarningSeverity = "info" | "warning" | "critical";

export type DbRecommendationDataQualityWarning = {
  code: string;
  message: string;
  severity: DbRecommendationDataQualityWarningSeverity;
};

export type DbRecommendationLineage = {
  tenant_id: string;
  cloud_connection_id: string;
  resource_id: string;
  provider: "AWS";
  service: "AmazonRDS";
  resource_type: string | null;
  region: string | null;
  account_id: string | null;
};

export type DbRecommendationRuleContext = {
  recommendation_type: string;
  rule_id: string;
  rule_version: string;
  lookback_start: string | null;
  lookback_end: string | null;
};

export type DbRecommendationMetadata = {
  version: 1;
  generated_by: "db-recommendations-generator";
  generated_at: string;
  confidence: DbRecommendationConfidence;
  confidence_score: number;
  evidence_level: DbRecommendationEvidenceLevel;
  signals_used: DbRecommendationSignalUsed[];
  signals_missing: DbRecommendationSignalMissing[];
  cost_breakdown: DbRecommendationCostBreakdown;
  savings_assumptions: DbRecommendationSavingsAssumptions;
  data_quality_warnings: DbRecommendationDataQualityWarning[];
  source_tables: string[];
  lineage: DbRecommendationLineage;
  rule_context: DbRecommendationRuleContext;
  [key: string]: unknown;
};

export type DbRecommendationEvidenceInput = {
  generatedAt?: Date | string;
  recommendationType: DbRecommendationType | string;
  ruleId: string;
  ruleVersion: string;
  lookbackStart?: Date | string | null;
  lookbackEnd?: Date | string | null;
  lineage: DbRecommendationLineage;
  billingSignals?: DbRecommendationSignalUsed[];
  inventorySignals?: DbRecommendationSignalUsed[];
  telemetrySignals?: DbRecommendationSignalUsed[];
  signalsMissing?: DbRecommendationSignalMissing[];
  costBreakdown?: Partial<DbRecommendationCostBreakdown>;
  savingsAssumptions?: Partial<DbRecommendationSavingsAssumptions>;
  dataQualityWarnings?: DbRecommendationDataQualityWarning[];
  sourceTables?: string[];
};

export type DbRecommendationsListQuery = {
  tenantId: string;
  cloudConnectionId?: string;
  page: number;
  limit: number;
  status?: string;
  recommendationType?: DbRecommendationType;
  confidence?: DbRecommendationConfidence;
  evidenceLevel?: DbRecommendationEvidenceLevel;
  resourceId?: string;
  region?: string;
  engine?: string;
  resourceType?: string;
  search?: string;
  sortBy?: "updated_at" | "created_at" | "estimated_savings";
  sortOrder?: "asc" | "desc";
};

export type DbRecommendationsGenerateInput = {
  tenantId: string;
  cloudConnectionId?: string;
  billingSourceId?: number;
};

export type DbRecommendationListItem = {
  id: string;
  category: string;
  recommendation_type: string;
  title: string | null;
  description: string | null;
  status: string;
  severity: string | null;
  priority: string | null;
  estimated_savings: number;
  estimated_monthly_savings: number | null;
  resource_id: string | null;
  cloud_connection_id: string | null;
  confidence: DbRecommendationConfidence | null;
  confidence_score: number | null;
  evidence_level: DbRecommendationEvidenceLevel | null;
  savings_basis: string | null;
  warnings_count: number;
  source_tables: string[];
  updated_at: string | null;
  created_at: string | null;
};

export type DbRecommendationDetail = DbRecommendationListItem & {
  metadata_json: Record<string, unknown> | null;
  evidence: {
    signals_used: DbRecommendationSignalUsed[];
    signals_missing: DbRecommendationSignalMissing[];
    cost_breakdown: DbRecommendationCostBreakdown | Record<string, unknown>;
    savings_assumptions: DbRecommendationSavingsAssumptions | Record<string, unknown>;
    data_quality_warnings: DbRecommendationDataQualityWarning[];
    source_tables: string[];
  };
  lifecycle: {
    status_reason: string | null;
    snoozed_until: string | null;
    status_updated_at: string | null;
    status_updated_by: string | null;
    detected_at: string | null;
    last_seen_at: string | null;
  };
};

export type DbRecommendationSummary = {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byConfidence: Record<string, number>;
  byEvidenceLevel: Record<string, number>;
  warningsCount: number;
  estimatedSavingsTotal: number;
  lastGeneratedAt: string | null;
  activeCount: number;
  resolvedCount: number;
};

export type DbRecommendationsGenerateResult = {
  generatedAt: string;
  category: "DB";
  tenantsProcessed: number;
  connectionsProcessed: number;
  resourcesEvaluated: number;
  candidatesEvaluated: number;
  created: number;
  updated: number;
  resolved: number;
  skipped: number;
  failed: number;
  activeRules: string[];
  ruleResults: Array<{
    rule: string;
    evaluated: number;
    candidates: number;
    created: number;
    updated: number;
    resolved: number;
    skipped: number;
    failed: number;
    durationMs: number;
  }>;
  warnings: string[];
};

export type DbRecommendationCandidate = {
  tenantId: string;
  cloudConnectionId: string;
  billingSourceId: number | null;
  awsAccountId: string;
  awsRegionCode: string | null;
  resourceId: string;
  resourceArn: string | null;
  resourceName: string | null;
  resourceType: string | null;
  recommendationType: DbRecommendationType;
  recommendationTitle: string;
  recommendationText: string;
  estimatedMonthlySavings: number;
  currentMonthlyCost: number;
  projectedMonthlyCost: number;
  metadataJson: Record<string, unknown> | null;
};

export type EligibleDbResource = {
  tenantId: string;
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
  resourceId: string;
  resourceArn: string | null;
  resourceName: string | null;
  dbService: string | null;
  dbEngine: string | null;
  resourceType: string | null;
  totalEffectiveCost: number;
  lookbackStart: string | null;
  lookbackEnd: string | null;
  latestUsageDate: string | null;
  currencyCode: string | null;
  computeCost: number | null;
  storageCost: number | null;
  backupCost: number | null;
  ioCost: number | null;
  otherCost: number | null;
  hasCostCategoryBreakdown: boolean;
  allocatedStorageGb: number | null;
  storageUsedGb: number | null;
  hasInventory: boolean;
  hasTelemetry: boolean;
  usageDays: number;
  telemetryDays: number;
  cpuAvg: number | null;
  cpuMax: number | null;
  connectionsAvg: number | null;
  connectionsMax: number | null;
  readIopsAvg: number | null;
  writeIopsAvg: number | null;
  clusterId: string | null;
  isClusterResource: boolean;
  status: string | null;
  instanceClass: string | null;
  capacityMode: string | null;
  inventoryClusterId: string | null;
  inventoryIsClusterResource: boolean;
  inventoryStatus: string | null;
};
