export const ANOMALY_TYPES = [
  "cost_spike",
  "cost_drop",
  "service_cost_anomaly",
  "region_cost_anomaly",
  "sub_account_cost_anomaly",
  "tag_cost_anomaly",
  "usage_spike",
  "usage_drop",
  "usage_mismatch",
  "idle_cost",
  "data_transfer_spike",
  "storage_growth",
  "pricing_rate_change",
  "commitment_coverage_drop",
  "recurring_pattern_break",
  "change_event_correlated",
  "forecast_deviation",
  "resource_cost_anomaly",
] as const;

export type AnomalyType = (typeof ANOMALY_TYPES)[number];

export type DimensionType =
  | "global"
  | "service"
  | "region"
  | "sub_account"
  | "resource"
  | "tag";

export type MeasureType =
  | "effective_cost"
  | "billed_cost"
  | "usage_quantity"
  | "cpu_avg"
  | "memory_avg"
  | "coverage_percent"
  | "cost_per_unit";

export type Granularity = "daily" | "hourly";
export type BaselineType = "rolling_7d" | "same_weekday_4w" | "same_hour_7d" | "rolling_median";
export type RuleType = "spike" | "drop" | "mismatch" | "idle" | "trend_break" | "forecast";
export type Severity = "low" | "medium" | "high";

export type DetectorConfig = {
  key: string;
  anomalyType: AnomalyType;
  dimensionType: DimensionType;
  measureType: MeasureType;
  granularity: Granularity;
  baselineType: BaselineType;
  ruleType: RuleType;
  thresholdMultiplier: number;
  minAbsoluteDelta: number;
  minExpectedValue: number;
  enabled: boolean;
  implemented: boolean;
  tagKey?: string;
  metadata?: Record<string, unknown>;
};

export type DetectorRunInput = {
  usageDate: string;
  tenantId?: string;
  fallbackCloudConnectionId?: string;
};

export type DetectionCandidate = {
  tenantId: string;
  cloudConnectionId: string | null;
  billingSourceId: string | null;
  providerId: string | null;
  usageDate: string;
  currencyCode: string | null;
  serviceKey: string | null;
  regionKey: string | null;
  subAccountKey: string | null;
  resourceKey: string | null;
  anomalyScope: string;
  expectedValue: number;
  actualValue: number;
  deltaValue: number;
  deltaPercent: number;
  dimensionValue: string | null;
  metadata: Record<string, unknown>;
};

export type DetectorRunStats = {
  detectorKey: string;
  anomalyType: AnomalyType;
  enabled: boolean;
  implemented: boolean;
  examined: number;
  inserted: number;
  duplicatesSkipped: number;
  failed: number;
  skippedReason?: string;
};

export type AnomalyRunnerSummary = {
  usageDate: string;
  detectorsRun: number;
  examined: number;
  anomaliesInserted: number;
  duplicatesSkipped: number;
  failures: number;
  detectorStats: DetectorRunStats[];
};
