import type { UsageCapabilityFamily, UsageMetric } from "./usage-capabilities.js";
export const EXPLORER_METRICS = ["cost", "usage"] as const;

/** Canonical scope slugs accepted on `database_scope` query param. */
export const EXPLORER_DATABASE_SCOPES = [
  "all",
  "relational",
  "relational_rds",
  "relational_aurora",
  "key_value",
  "key_value_dynamodb",
  "in_memory",
  "in_memory_elasticache",
  "in_memory_memorydb",
  "document",
  "graph",
  "wide_column",
  "time_series",
] as const;

export type ExplorerDatabaseScope = (typeof EXPLORER_DATABASE_SCOPES)[number];

export const EXPLORER_GROUP_BY = [
  "db_service",
  "db_engine",
  "region",
  "resource_type",
  "instance_class",
  "cluster",
  "cost_category",
] as const;

export type ExplorerMetric = (typeof EXPLORER_METRICS)[number];
export type ExplorerGroupBy = (typeof EXPLORER_GROUP_BY)[number];
export type ExplorerAllowedGroupByByMetric = Record<ExplorerMetric, ExplorerGroupBy[]>;
export const EXPLORER_COST_BASIS = [
  "billed_cost",
  "effective_cost",
  "amortized_cost",
  "net_amortized_cost",
] as const;
export type ExplorerCostBasis = (typeof EXPLORER_COST_BASIS)[number];

export const EXPLORER_ALLOWED_GROUP_BY_BY_METRIC: ExplorerAllowedGroupByByMetric = {
  cost: ["db_service", "db_engine", "region", "cost_category", "resource_type"],
  usage: ["db_service", "db_engine", "region", "instance_class", "cluster"],
};

export type ExplorerQueryParams = {
  tenantId: string;
  startDate: string;
  endDate: string;
  cloudConnectionId?: string;
  regionKey?: string;
  /** Filters fact rows to a database taxonomy bucket (independent from `groupBy`). */
  databaseScope?: ExplorerDatabaseScope;
  dbService?: string;
  dbEngine?: string;
  costBasis: ExplorerCostBasis;
  metric: ExplorerMetric;
  capabilityFamily?: UsageCapabilityFamily;
  usageMetric?: UsageMetric;
  groupBy: ExplorerGroupBy;
  groupValues?: string[];
  resourceTypeValues?: string[];
  costCategoryValues?: string[];
};

export type ExplorerKpiState = "normal" | "empty" | "partial" | "unavailable" | "warning";

export type ExplorerKpiTrend = {
  value: number | null;
  direction: "up" | "down" | "flat" | "unknown";
};

export type ExplorerKpiCard = {
  id: string;
  title: string;
  value: string;
  subValue: string | null;
  trend?: ExplorerKpiTrend | null;
  state: ExplorerKpiState;
  note?: string | null;
};

export type ExplorerCostTrendItem = {
  date: string;
  compute: number;
  storage: number;
  io: number;
  backup: number;
  total: number;
};

export type ExplorerUsageTrendItem = {
  date: string;
  capabilityFamily?: UsageCapabilityFamily;
  usageMetric?: UsageMetric;
  unit?: string | null;
  value?: number | null;
  coverageRate?: number | null;
  confidence?: ExplorerCoverageConfidence;
  deprecatedLoadAlias?: boolean;
  load: number | null;
  connections: number | null;
};

export type ExplorerTrendItem = ExplorerCostTrendItem | ExplorerUsageTrendItem;

export type ExplorerTrendGroupedPoint = {
  date: string;
  value: number | null;
};

export type ExplorerTrendGroupedSeries = {
  key: string;
  label: string;
  data: ExplorerTrendGroupedPoint[];
  total?: number;
};

export type ExplorerTrendGrouped = {
  metric: ExplorerMetric;
  groupBy: ExplorerGroupBy;
  chartType: "stacked_bar" | "line";
  xKey: "date";
  capabilityFamily?: UsageCapabilityFamily;
  usageMetric?: UsageMetric;
  unit?: string | null;
  coverageSummary?: ExplorerCoverageSummary;
  warnings?: string[];
  series: ExplorerTrendGroupedSeries[];
};

export type ExplorerTableRow = {
  group: string;
  groupKey?: string;
  groupLabel?: string;
  totalCost: number;
  costSharePct?: number | null;
  topService?: string | null;
  topEngine?: string | null;
  computeCost: number;
  storageCost: number;
  ioCost: number;
  backupCost: number;
  resourceCount: number;
  inScopeResources?: number;
  telemetryCoveredResources?: number;
  coverageRate?: number | null;
  confidence?: ExplorerCoverageConfidence;
  state?: ExplorerUsageState;
  reasons?: string[];
  warnings?: string[];
  primaryMetricValue?: number | null;
  primaryMetricUnit?: string | null;
  rankingValue?: number | null;
  rank?: number | null;
  avgCpu?: number | null;
  peakCpu?: number | null;
  avgConnections?: number | null;
  peakConnections?: number | null;
  readIops?: number | null;
  writeIops?: number | null;
  totalIops?: number | null;
  readThroughputBytes?: number | null;
  writeThroughputBytes?: number | null;
  totalThroughputBytes?: number | null;
  storageUsedGb?: number | null;
  allocatedStorageGb?: number | null;
  avgLoad: number | null;
  connections: number | null;
};

export type ExplorerFilterOptions = {
  dbServices: string[];
  dbEngines: string[];
  groupedValuePreview: Partial<Record<ExplorerGroupBy, string[]>>;
  /** Scopes that have ≥1 fact row in the requested window (plus always `all`). */
  availableDatabaseScopes: ExplorerDatabaseScope[];
};

export type ExplorerResponse = {
  filters: ExplorerQueryParams;
  allowedGroupBy: ExplorerGroupBy[];
  allowedGroupByByMetric: ExplorerAllowedGroupByByMetric;
  filterOptions: ExplorerFilterOptions;
  cards: ExplorerKpiCard[];
  capabilityAvailability?: ExplorerCapabilityAvailability[];
  trend: ExplorerTrendItem[];
  trendGrouped?: ExplorerTrendGrouped;
  table: ExplorerTableRow[];
};

export type ExplorerWarning = {
  code: string;
  message: string;
  state: "informational" | "degraded" | "unsupported" | "unavailable";
};

export type ExplorerCoverageConfidence = "high" | "medium" | "low" | "degraded" | "unsupported" | "unavailable";
export type ExplorerUsageState = "normal" | "degraded" | "informational" | "unavailable" | "unsupported";

export type ExplorerCoverageSummary = {
  eligibleResources: number;
  coveredResources: number;
  coverageRate: number | null;
  confidence: ExplorerCoverageConfidence;
  degraded: boolean;
  unavailable: boolean;
  unsupported: boolean;
};

export type ExplorerCapabilityAvailability = {
  capabilityFamily: UsageCapabilityFamily;
  label: string;
  maturity: "high" | "medium" | "low";
  supportedServices: string[];
  supportedMetrics: UsageMetric[];
  selectable: boolean;
  disabled: boolean;
  warnings: string[];
  coverageSummary: ExplorerCoverageSummary;
};

export type ExplorerUsageKpi = {
  id: string;
  title: string;
  capabilityFamily: UsageCapabilityFamily;
  metricId: UsageMetric;
  value: number | null;
  unit: string | null;
  coverage: ExplorerCoverageSummary;
  confidence: ExplorerCoverageConfidence;
  maturity: "high" | "medium" | "low";
  state: ExplorerUsageState;
  reasons: string[];
  warnings: string[];
  sourceFields: string[];
};


