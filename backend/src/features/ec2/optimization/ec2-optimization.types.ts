export const EC2_OPTIMIZATION_PRIMARY_TYPES = [
  "idle",
  "underutilized",
  "overutilized",
  "uncovered_on_demand",
] as const;

export type Ec2OptimizationPrimaryType = (typeof EC2_OPTIMIZATION_PRIMARY_TYPES)[number];

export const EC2_OPTIMIZATION_FILTER_TYPES = [
  ...EC2_OPTIMIZATION_PRIMARY_TYPES,
  "high_cost",
] as const;

export type Ec2OptimizationFilterType = (typeof EC2_OPTIMIZATION_FILTER_TYPES)[number];

export type Ec2OptimizationSortBy =
  | "total_effective_cost"
  | "compute_cost"
  | "estimated_savings"
  | "avg_cpu"
  | "peak_cpu"
  | "avg_daily_network_bytes"
  | "running_hours"
  | "instance_id"
  | "instance_name"
  | "priority_rank";

export type Ec2OptimizationListQuery = {
  tenantId: string;
  dateFrom: string;
  dateTo: string;
  optimizationType: Ec2OptimizationFilterType | null;
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  regionKey: number | null;
  subAccountKey: number | null;
  instanceType: string | null;
  reservationType: "on_demand" | "reserved" | "savings_plan" | "spot" | null;
  search: string | null;
  page: number;
  pageSize: number;
  sortBy: Ec2OptimizationSortBy;
  sortOrder: "asc" | "desc";
};

export type Ec2OptimizationSummaryQuery = Omit<
  Ec2OptimizationListQuery,
  "optimizationType" | "page" | "pageSize" | "sortBy" | "sortOrder"
>;

export type Ec2OptimizationAggregatedInstance = {
  instanceId: string;
  instanceName: string;
  instanceType: string | null;
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
  regionKey: number | null;
  subAccountKey: number | null;
  availabilityZone: string | null;
  state: string | null;
  isRunning: boolean;
  reservationType: "on_demand" | "reserved" | "savings_plan" | "spot";
  avgCpu: number | null;
  peakCpu: number | null;
  avgDailyNetworkBytes: number;
  runningHours: number;
  runningDayCount: number;
  computeCost: number;
  totalEffectiveCost: number;
  totalBilledCost: number;
  hasReservedOrSavingsPlanCoverage: boolean;
};

export type Ec2OptimizationPersistedRecommendationType =
  | "idle_instance"
  | "underutilized_instance"
  | "overutilized_instance"
  | "uncovered_on_demand"
  | "unattached_ebs_volume"
  | "ebs_attached_to_stopped_instance";

export type Ec2OptimizationPersistableRecommendation = {
  tenantId: string;
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  awsAccountId: string;
  awsRegionCode: string | null;
  recommendationType: Ec2OptimizationPersistedRecommendationType;
  resourceType: "ec2_instance" | "ebs_volume";
  resourceId: string;
  resourceName: string | null;
  subAccountKey: number | null;
  regionKey: number | null;
  currentResourceType: string | null;
  recommendedResourceType: string | null;
  currentMonthlyCost: number;
  estimatedMonthlySavings: number;
  projectedMonthlyCost: number;
  performanceRiskScore: number | null;
  performanceRiskLevel: string | null;
  effortLevel: "low" | "medium" | "high";
  riskLevel: "low" | "medium" | "high";
  recommendationTitle: string;
  recommendationText: string;
  rawPayloadJson: string;
  observationStart: Date;
  observationEnd: Date;
};

export type Ec2OptimizationEbsWasteCandidate = {
  volumeId: string;
  volumeType: string | null;
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
  regionKey: number | null;
  subAccountKey: number | null;
  totalCost: number;
  isUnattached: boolean;
  isAttachedToStoppedInstance: boolean;
};

export type PersistEc2RecommendationsInput = {
  tenantId: string;
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  observationStart: Date;
  observationEnd: Date;
  recommendations: Ec2OptimizationPersistableRecommendation[];
  resolveStaleOpen: boolean;
};

export type PersistEc2RecommendationsResult = {
  created: number;
  updated: number;
  resolved: number;
};

export type PersistedEc2InstanceRecommendation = {
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  resourceId: string;
  recommendationType: Ec2OptimizationPersistedRecommendationType;
  estimatedMonthlySavings: number;
  recommendationText: string | null;
  updatedAt: Date | null;
};

export type Ec2OptimizationInstanceItem = {
  instanceId: string;
  instanceName: string;
  instanceType: string | null;
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  regionKey: number | null;
  subAccountKey: number | null;
  availabilityZone: string | null;
  state: string | null;
  isRunning: boolean;
  reservationType: "on_demand" | "reserved" | "savings_plan" | "spot";
  avgCpu: number | null;
  peakCpu: number | null;
  avgDailyNetworkBytes: number;
  runningHours: number;
  computeCost: number;
  totalEffectiveCost: number;
  totalBilledCost: number;
  optimizationType: Ec2OptimizationPrimaryType | "high_cost" | null;
  isHighCost: boolean;
  estimatedSavings: number;
  reason: string | null;
  optimizationScore: number | null;
  priorityRank: number | null;
};

export type Ec2OptimizationSummary = {
  idleInstances: number;
  underutilizedInstances: number;
  overutilizedInstances: number;
  uncoveredOnDemandInstances: number;
  highCostInstances: number;
  totalEstimatedSavingsOpportunity: number;
};

export type Ec2OptimizationSummaryResponse = {
  section: "ec2-optimization-summary";
  title: "EC2 Optimization Summary";
  message: string;
  filtersApplied: {
    tenantId: string;
    dateFrom: string;
    dateTo: string;
    cloudConnectionId: string | null;
    billingSourceId: number | null;
    regionKey: number | null;
    subAccountKey: number | null;
    instanceType: string | null;
    reservationType: "on_demand" | "reserved" | "savings_plan" | "spot" | null;
    search: string | null;
  };
  summary: Ec2OptimizationSummary;
};

export type Ec2OptimizationInstancesResponse = {
  section: "ec2-optimization-instances";
  title: "EC2 Optimization Instances";
  message: string;
  filtersApplied: {
    tenantId: string;
    dateFrom: string;
    dateTo: string;
    optimizationType: Ec2OptimizationFilterType | null;
    cloudConnectionId: string | null;
    billingSourceId: number | null;
    regionKey: number | null;
    subAccountKey: number | null;
    instanceType: string | null;
    reservationType: "on_demand" | "reserved" | "savings_plan" | "spot" | null;
    search: string | null;
    sortBy: Ec2OptimizationSortBy;
    sortOrder: "asc" | "desc";
  };
  summary: Ec2OptimizationSummary;
  items: Ec2OptimizationInstanceItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export const EC2_OPTIMIZATION_RECOMMENDATION_FILTER_TYPES = [
  "overview",
  "rightsizing",
  "idle_waste",
  "coverage",
  "performance_risk",
  "all",
  "idle_instance",
  "underutilized_instance",
  "overutilized_instance",
  "uncovered_on_demand",
  "ebs_waste",
] as const;

export type Ec2OptimizationRecommendationFilterType =
  (typeof EC2_OPTIMIZATION_RECOMMENDATION_FILTER_TYPES)[number];

export type Ec2OptimizationRiskLevel = "low" | "medium" | "high";
export type Ec2OptimizationEffortLevel = "low" | "medium" | "high";

export type Ec2OptimizationRecommendationsQuery = {
  tenantId: string;
  dateFrom: string;
  dateTo: string;
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  regionKey: number | null;
  subAccountKey: number | null;
  recommendationType: Ec2OptimizationRecommendationFilterType | null;
  region: string | null;
  riskLevel: Ec2OptimizationRiskLevel | null;
  status: string | null;
  page: number;
  pageSize: number;
};

export type Ec2OptimizationActionEvidenceItem = {
  label: string;
  value: string;
};

export type Ec2OptimizationActionRecommendation = {
  recommendationId: number;
  recommendationType: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  accountName: string | null;
  region: string | null;
  availabilityZone: string | null;
  currentResourceType: string | null;
  recommendedResourceType: string | null;
  monthlyCost: number;
  estimatedSavings: number;
  projectedMonthlyCost: number;
  riskLevel: Ec2OptimizationRiskLevel;
  effortLevel: Ec2OptimizationEffortLevel;
  status: string;
  reason: string;
  evidence: Ec2OptimizationActionEvidenceItem[];
  recommendedAction: string;
  actionLabel: string;
  drilldownUrl: string;
};

export type Ec2OptimizationTopAction = {
  recommendationId: number;
  priority: number;
  recommendationType: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  title: string;
  description: string;
  monthlyCost: number;
  estimatedSavings: number;
  riskLevel: Ec2OptimizationRiskLevel;
  effortLevel: Ec2OptimizationEffortLevel;
  actionLabel: string;
  drilldownUrl: string;
};

export type Ec2OptimizationTabItem = {
  key: "all" | "idle_instance" | "underutilized_instance" | "overutilized_instance" | "uncovered_on_demand" | "ebs_waste";
  label: string;
  count: number;
};

export type Ec2OptimizationRecommendationsResponse = {
  overview: {
    totalPotentialSavings: number;
    currencyCode: "USD";
    categories: Array<{
      key: "rightsizing" | "idle_waste" | "coverage" | "performance_risk";
      label: "Rightsizing" | "Idle & Waste" | "Coverage" | "Performance Risk";
      savings: number;
      count: number;
      percent: number;
    }>;
    lifecycle: {
      verifiedSavings: number;
      appliedActions: number;
      pendingActions: number;
      ignoredRecommendations: number;
    };
    topActions: Array<{
      recommendationId: number;
      category: "rightsizing" | "idle_waste" | "coverage" | "performance_risk";
      recommendationType: string;
      title: string;
      resourceId: string;
      resourceName: string;
      estimatedSavings: number;
      riskLevel: "low" | "medium" | "high";
      actionLabel: string;
      drilldownUrl: string;
    }>;
  };
  recommendations: {
    rightsizing: Ec2OptimizationActionRecommendation[];
    idle_waste: Ec2OptimizationActionRecommendation[];
    coverage: Ec2OptimizationActionRecommendation[];
    performance_risk: Ec2OptimizationActionRecommendation[];
  };
};
