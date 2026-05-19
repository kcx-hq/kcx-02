import type { DashboardScope } from "../dashboard.types.js";

export type S3CostBucketInsight = {
  bucketName: string;
  billedCost: number;
  effectiveCost: number;
};

export type S3CostTrendInsight = {
  usageStartTime: string;
  billedCost: number;
  effectiveCost: number;
};

export type S3CostFeatureTrendInsight = {
  usageStartTime: string;
  storage: number;
  requests: number;
  retrieval: number;
  transfer: number;
  bucket: number;
  bucketStorageClass: number;
  other: number;
  total: number;
};

export type S3CostChartBy = "date" | "bucket" | "region" | "account";
export type S3CostSeriesBy = "none" | "cost_category" | "usage_type" | "operation" | "bucket" | "storage_class";
export type S3CostYAxisMetric =
  | "gross_cost"
  | "billed_cost"
  | "effective_cost"
  | "amortized_cost"
  | "usage_quantity";
export type S3CostCategory =
  | "Storage"
  | "Request"
  | "Transfer"
  | "Retrieval"
  | "Other";

export type S3CostInsightsFilters = {
  costCategory: S3CostCategory[];
  seriesValues: string[];
  bucket: string | null;
  storageClass: string[];
  region: string[];
  account: string[];
  costBy: S3CostChartBy;
  seriesBy: S3CostSeriesBy;
  yAxisMetric: S3CostYAxisMetric;
  usageYAxis?: "storage_gb" | "request_count" | "transfer_gb" | "object_count" | null;
};

export type S3CostBreakdownChart = {
  labels: string[];
  series: Array<{
    name: string;
    values: number[];
  }>;
  operationGroupTooltip?: Array<{
    usageDate: string;
    operationGroup: "Read" | "Write" | "List & Metadata" | "Other";
    operation: string;
    cost: number;
  }>;
};

export type S3CostBucketTableInsight = {
  bucketName: string;
  account: string;
  cost: number;
  storage: number;
  requests: number;
  transfer: number;
  region: string;
  owner: string;
  driver: string;
  savings: number;
  retrieval: number;
  other: number;
  replicationStatus: string | null;
  versioningStatus: string | null;
  encryptionStatus: string | null;
  publicAccessStatus: "Public" | "Private" | "Unknown";
  primaryUsagePattern?: string;
  optimizationSignal?: string;
  trendPct: number;
  storageLens?: {
    usageDate: string;
    objectCount: number | null;
    currentVersionBytes: number | null;
    avgObjectSizeBytes: number | null;
    accessCount: number | null;
    percentInGlacier: number;
    storageClassDistribution: Array<{
      name: string;
      bytes: number;
      percent: number;
    }>;
  } | null;
};

export type S3CostCategoryTableInsight = {
  costCategory: S3CostCategory;
  cost: number;
  usageQuantity: number;
  pricingUnit: string;
  percentOfBucketCost: number;
};

export type S3UsageOperationTableInsight = {
  usageType: string;
  operation: string;
  cost: number;
  quantity: number;
  unit: string;
};

export type S3UsageTypeCostTableInsight = {
  usageType: string;
  grossCost: number;
  trendPct: number;
  topBucketName: string;
};

export type S3StorageTypeCostTableInsight = {
  storageType: string;
  grossCost: number;
  percentOfStorageCost: number;
  trendPct: number;
  topBucketName: string;
  optimizationSignal: "Storage Heavy" | "Request Heavy" | "Transfer Heavy" | "Retrieval Heavy" | "Other Heavy" | "Balanced";
};

export type S3FinopsBucketBase = {
  bucketName: string;
  accountId: string;
  region: string | null;
  owner: string;
  applicationName: string;
  businessUnit: string;
  cost: number;
  storageCost: number;
  requestCost: number;
  transferCost: number;
  retrievalCost: number;
  totalStorageGib: number;
  standardGib: number;
  standardIaGib: number;
  glacierGib: number;
  deepArchiveGib: number;
  intelligentTieringGib: number;
  objectCount: number | null;
  noncurrentVersionGib: number;
  incompleteMultipartGib: number;
  getRequestsCount: number | null;
  putRequestsCount: number | null;
  hasLifecyclePolicy: boolean;
  lifecycleRulesCount: number;
  versioningStatus: string | null;
  encryptionStatus: string | null;
  publicAccessStatus: "Public" | "Private" | "Unknown";
  replicationStatus: string | null;
};

export type S3AnomalySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type S3RecommendationConfidence = "HIGH" | "MEDIUM" | "LOW";
export type S3OptimizationPriority = "P0" | "P1" | "P2" | "P3" | "P4";
export type S3ActionStatus =
  | "NEW"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "IMPLEMENTED"
  | "DISMISSED"
  | "FALSE_POSITIVE";

export type S3StorageAnomalyInsight = {
  bucketName: string;
  accountId: string;
  region: string | null;
  reportDate: string;
  storageGibCurrent: number;
  storageGib7dAgo: number | null;
  growthGib: number;
  growthPercentage: number | null;
  estimatedMonthlyCostImpact: number;
  anomalyType: string;
  severity: S3AnomalySeverity;
  confidence: S3RecommendationConfidence;
  reason: string;
  recommendedAction: string;
};

export type S3BucketOptimizationScoreInsight = {
  bucketName: string;
  accountId: string;
  region: string | null;
  score: number;
  priorityLevel: S3OptimizationPriority;
  primaryReason: string;
  top3Issues: string[];
  recommendedNextAction: string;
  estimatedMonthlySaving: number;
  estimatedAnnualSaving: number;
};

export type S3BucketHealthScoreInsight = {
  bucketName: string;
  accountId: string;
  region: string | null;
  score: number;
  healthLabel: "Optimized" | "Healthy" | "Needs Review" | "Risky" | "High Waste / High Risk";
  dimensions: Record<string, number>;
};

export type S3LifecycleRecommendationInsight = {
  recommendationId: string;
  bucketName: string;
  category: string;
  recommendation: string;
  reason: string;
  estimatedMonthlySaving: number;
  estimatedAnnualSaving: number;
  confidence: S3RecommendationConfidence;
  implementationComplexity: "LOW" | "MEDIUM" | "HIGH";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  requiredOwnerAction: string;
  signalsUsed: string[];
};

export type S3SavingsEstimateInsight = {
  bucketName: string;
  savingsType: string;
  estimatedMonthlySaving: number;
  estimatedAnnualSaving: number;
  confidence: S3RecommendationConfidence;
  assumptions: string[];
  limitations: string[];
  currency: "USD";
};

export type S3FinopsActionItemInsight = {
  actionId: string;
  bucketName: string;
  accountId: string;
  region: string | null;
  ownerTeam: string;
  applicationName: string;
  businessUnit: string;
  category: string;
  severity: S3AnomalySeverity;
  priority: S3OptimizationPriority;
  recommendation: string;
  estimatedMonthlySaving: number;
  estimatedAnnualSaving: number;
  confidence: S3RecommendationConfidence;
  status: S3ActionStatus;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  dismissedReason: string | null;
  sourceSignal: string;
};

export type S3OwnerInsight = {
  ownerTeam: string;
  applicationName: string;
  businessUnit: string;
  environment: string;
  costCenter: string;
  technicalOwner: string | null;
  financeOwner: string | null;
  criticality: string;
  supportChannel: string | null;
  totalMonthlyCost: number;
  totalMonthlySavingsOpportunity: number;
  openActionItems: number;
  slaBreaches: number;
};

export type S3RequestCostIntelligenceInsight = {
  bucketName: string;
  operation: string;
  requestCount: number;
  requestCost: number;
  requestCostPercentage: number;
  costPer1kRequests: number;
  costPerGb: number | null;
  anomalyFlag: boolean;
  recommendation: string;
};

export type S3StorageClassEfficiencyInsight = {
  bucketName: string;
  standardGib: number;
  standardPct: number;
  standardIaGib: number;
  standardIaPct: number;
  glacierGib: number;
  glacierPct: number;
  deepArchiveGib: number;
  deepArchivePct: number;
  intelligentTieringGib: number;
  intelligentTieringPct: number;
  archiveRetrievalRisk: "LOW" | "MEDIUM" | "HIGH";
  optimizationPotential: "LOW" | "MEDIUM" | "HIGH";
  storageClassImbalanceScore: number;
  insight: string;
};

export type S3ExecutiveSummaryCard = {
  key:
    | "totalS3Cost"
    | "estimatedMonthlyStorageCost"
    | "mtdCost"
    | "forecastedMonthEndCost"
    | "sevenDayStorageGrowthGib"
    | "highRiskBuckets"
    | "optimizationOpportunityMonthly"
    | "annualizedSavingsPotential"
    | "bucketsWithoutLifecycle"
    | "unownedExpensiveBuckets"
    | "topBusinessUnitByCost"
    | "topBucketByGrowth"
    | "costAnomalies"
    | "savingsImplementedMonthly";
  label: string;
  value: string | number;
  trend: {
    direction: "up" | "down" | "flat";
    valuePct: number | null;
  };
  confidence: S3RecommendationConfidence;
  formula: string;
  dataSource: string[];
  drilldownTarget: string;
};

export type S3CostInsightsResponse = {
  section: "s3-cost-insights";
  title: "S3 Cost Insights";
  message: string;
  filtersApplied: {
    from: string;
    to: string;
    scopeType: DashboardScope["scopeType"];
    s3Filters: S3CostInsightsFilters;
  };
  columnsUsed: Array<
    | "service_name"
    | "billed_cost"
    | "effective_cost"
    | "usage_start_time"
    | "list_cost"
    | "usage_type"
    | "product_usage_type"
    | "operation"
    | "line_item_description"
    | "region_name"
    | "sub_account_name"
    | "tag_value"
  >;
  kpis: {
    totalS3Cost: number;
    monthToDateCost: number;
    effectiveCost: number;
    bucketCostKpis: {
      grossBucketCost: number;
      creditAdjustedCost: number;
      netBucketCost: number;
      totalBuckets: number;
    };
    usageTypeCostKpis: {
      grossS3Cost: number;
      credits: number;
      netS3Cost: number;
      topUsageDriver: {
        category: "Request" | "Storage" | "Transfer" | "Retrieval" | "Replication" | "Lifecycle" | "Other";
        cost: number;
        percentOfTotal: number;
      } | null;
    };
    usageSummaryKpis: {
      totalStorageGb: number;
      totalRequests: number;
      totalTransferGb: number;
      totalObjectCount: number;
    };
  };
  storageCostDashboard: {
    currency: "USD";
    latestUsageDate: string | null;
    totalStorageByClass: Array<{
      storageClass: "STANDARD" | "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE";
      bytes: number;
      gib: number;
      estimatedMonthlyCost: number;
    }>;
    dailyStorageGrowth: {
      fromDate: string | null;
      toDate: string | null;
      bytesGrowth: number;
      gibGrowth: number;
      growthPct: number | null;
    };
    estimatedMonthlyCost: {
      total: number;
      byClass: Record<"STANDARD" | "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE", number>;
    };
    costTrend: Array<{
      usageDate: string;
      estimatedMonthlyCost: number;
      totalBytes: number;
    }>;
    expensiveBuckets: Array<{
      bucketName: string;
      estimatedMonthlyCost: number;
      totalBytes: number;
      usageDate: string;
    }>;
  };
  bucketTable: S3CostBucketTableInsight[];
  costCategoryTable: S3CostCategoryTableInsight[];
  usageOperationTable: S3UsageOperationTableInsight[];
  usageTypeCostTable: S3UsageTypeCostTableInsight[];
  storageTypeCostTable: S3StorageTypeCostTableInsight[];
  chart: {
    bucketCosts: S3CostBucketInsight[];
    trend: S3CostTrendInsight[];
    featureTrend: S3CostFeatureTrendInsight[];
    breakdown: S3CostBreakdownChart;
  };
  filterOptions: {
    costCategory: S3CostCategory[];
    usageType: string[];
    operation: string[];
    bucket: string[];
    storageClass: string[];
    region: string[];
    account: string[];
    costBy: S3CostChartBy[];
    seriesBy: S3CostSeriesBy[];
    yAxisMetric: S3CostYAxisMetric[];
  };
  storageAnomalies: {
    items: S3StorageAnomalyInsight[];
    total: number;
  };
  bucketOptimizationScores: {
    items: S3BucketOptimizationScoreInsight[];
    total: number;
  };
  bucketHealthScores: {
    items: S3BucketHealthScoreInsight[];
    total: number;
  };
  lifecycleRecommendations: {
    items: S3LifecycleRecommendationInsight[];
    total: number;
  };
  estimatedSavings: {
    items: S3SavingsEstimateInsight[];
    totalMonthlySaving: number;
    totalAnnualSaving: number;
  };
  finopsActionBacklog: {
    items: S3FinopsActionItemInsight[];
    summary: {
      open: number;
      inProgress: number;
      implemented: number;
      slaBreached: number;
    };
  };
  ownerInsights: {
    items: S3OwnerInsight[];
    unownedExpensiveBuckets: number;
  };
  requestCostIntelligence: {
    items: S3RequestCostIntelligenceInsight[];
    totalRequestCost: number;
  };
  storageClassEfficiency: {
    items: S3StorageClassEfficiencyInsight[];
  };
  executiveSummary: {
    cards: S3ExecutiveSummaryCard[];
  };
};
