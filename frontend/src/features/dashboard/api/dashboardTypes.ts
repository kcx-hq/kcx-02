export type DashboardScopeInput = {
  tenantId?: string;
  rawBillingFileId?: number;
  rawBillingFileIds?: number[];
  billingSourceId?: number;
  billingSourceIds?: number[];
  from?: string;
  to?: string;
  providerId?: number;
  billingAccountKey?: number;
  subAccountKey?: number;
  serviceKey?: number;
  regionKey?: number;
};

export type DashboardResolvedScope =
  | {
      scopeType: "upload";
      tenantId: string;
      rawBillingFileIds: number[];
      ingestionRunIds: number[];
      from: string;
      to: string;
      title: string;
    }
  | {
      scopeType: "global";
      tenantId: string;
      from: string;
      to: string;
      providerId: number | null;
      billingSourceIds: number[] | null;
      billingAccountKey: number | null;
      subAccountKey: number | null;
      serviceKey: number | null;
      regionKey: number | null;
      title: string;
    };

export type DashboardSummaryItem = {
  label: string;
  value: string;
};

export type DashboardSectionData = {
  section: string;
  title: string;
  message: string;
  summary: DashboardSummaryItem[];
};

export type Ec2OptimizationSummaryFiltersQuery = {
  cloudConnectionId?: string;
  billingSourceId?: number;
  regionKey?: number;
  subAccountKey?: number;
  recommendationType?:
    | "overview"
    | "rightsizing"
    | "idle_waste"
    | "coverage"
    | "performance_risk"
    | "all"
    | "idle_instance"
    | "underutilized_instance"
    | "overutilized_instance"
    | "uncovered_on_demand"
    | "ebs_waste";
  region?: string;
  riskLevel?: "low" | "medium" | "high";
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type DatabaseExplorerMetric = "cost" | "usage";
export type DatabaseExplorerGroupBy = "db_service" | "db_engine" | "region";

export type DatabaseExplorerFilters = {
  metric: DatabaseExplorerMetric;
  groupBy: DatabaseExplorerGroupBy;
  regionKey?: number | string;
  dbService?: string;
  dbEngine?: string;
  cloudConnectionId?: string;
};

export type DatabaseExplorerAppliedFilters = {
  tenantId: string;
  startDate: string;
  endDate: string;
  cloudConnectionId?: string;
  regionKey?: string;
  dbService?: string;
  dbEngine?: string;
  metric: DatabaseExplorerMetric;
  groupBy: DatabaseExplorerGroupBy;
};

export type DatabaseExplorerCards = {
  totalCost: number;
  costTrendPct: number | null;
  activeResources: number;
  dataFootprintGb: number;
  avgLoad: number | null;
  connections: number | null;
};

export type DatabaseExplorerCostTrendItem = {
  date: string;
  compute: number;
  storage: number;
  io: number;
  backup: number;
  total: number;
};

export type DatabaseExplorerUsageTrendItem = {
  date: string;
  load: number | null;
  connections: number | null;
};

export type DatabaseExplorerTableRow = {
  group: string;
  totalCost: number;
  computeCost: number;
  storageCost: number;
  ioCost: number;
  backupCost: number;
  resourceCount: number;
  avgLoad: number | null;
  connections: number | null;
};

export type DatabaseExplorerResponse = {
  filters: DatabaseExplorerAppliedFilters;
  cards: DatabaseExplorerCards;
  trend: Array<DatabaseExplorerCostTrendItem | DatabaseExplorerUsageTrendItem>;
  table: DatabaseExplorerTableRow[];
};

export type Ec2OverviewResponse = {
  section: "ec2-overview";
  title: "EC2 Overview";
  message: string;
  filtersApplied: {
    tenantId: string;
    startDate: string;
    endDate: string;
    cloudConnectionId: string | null;
    subAccountKey: number | null;
    regionKey: number | null;
    instanceType: string | null;
    state: string | null;
  };
  kpis: {
    totalInstances: number;
    runningInstances: number;
    stoppedInstances: number;
    idleInstances: number;
    underutilizedInstances: number;
    overutilizedInstances: number;
    totalComputeCost: number;
    totalInstanceHours: number;
  };
  trends: Array<{
    date: string;
    runningInstanceCount: number;
    computeCost: number;
  }>;
  topCostlyInstances: Array<{
    instanceId: string;
    instanceName: string;
    instanceType: string | null;
    totalHours: number;
    computeCost: number;
    state: string | null;
  }>;
  filterOptions: {
    instanceTypes: string[];
    states: string[];
  };
};
export type Ec2OptimizationInstancesFiltersQuery = Ec2OptimizationSummaryFiltersQuery;

export type Ec2RecommendationCategory = "compute" | "storage" | "pricing";
export type Ec2RecommendationType =
  | "idle_instance"
  | "underutilized_instance"
  | "overutilized_instance"
  | "unattached_volume"
  | "old_snapshot"
  | "uncovered_on_demand";
export type Ec2RecommendationStatus = "open" | "accepted" | "ignored" | "snoozed" | "completed";

export type Ec2RecommendationsFiltersQuery = {
  cloudConnectionId?: string;
  billingSourceId?: number;
  category?: Ec2RecommendationCategory;
  type?: Ec2RecommendationType;
  status?: Ec2RecommendationStatus;
  account?: string;
  region?: string;
  team?: string;
  product?: string;
  environment?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
};

export type Ec2RecommendationRecord = {
  id: number;
  category: Ec2RecommendationCategory;
  type: Ec2RecommendationType;
  resourceType: "instance" | "volume" | "snapshot";
  resourceId: string;
  resourceName: string;
  accountId: string | null;
  region: string | null;
  problem: string;
  evidence: string;
  action: string;
  estimatedMonthlySaving: number;
  risk: "low" | "medium" | "high";
  status: Ec2RecommendationStatus;
  detectedAt: string | null;
  lastSeenAt: string | null;
  metadata: Record<string, unknown> | null;
};

export type Ec2RecommendationsResponse = {
  overview: {
    totalPotentialMonthlySaving: number;
    countByCategory: Record<Ec2RecommendationCategory, number>;
    savingByCategory: Record<Ec2RecommendationCategory, number>;
    countByType: Record<Ec2RecommendationType, number>;
  };
  recommendations: {
    compute: Ec2RecommendationRecord[];
    storage: Ec2RecommendationRecord[];
    pricing: Ec2RecommendationRecord[];
  };
};

export type Ec2ExplorerMetric = "cost" | "usage" | "instances";
export type Ec2ExplorerGroupBy =
  | "none"
  | "region"
  | "account"
  | "instance_type"
  | "team"
  | "product"
  | "environment"
  | "reservation_type"
  | "cost_category"
  | "network_cost"
  | "network_type"
  | "tag";
export type Ec2ExplorerCostBasis = "billed_cost" | "effective_cost" | "amortized_cost";
export type Ec2ExplorerUsageMetric = "cpu" | "network_in" | "network_out" | "disk_read" | "disk_write";
export type Ec2ExplorerUsageType = "cpu" | "network" | "disk";
export type Ec2ExplorerAggregation = "avg" | "max" | "p95";
export type Ec2ExplorerCondition = "all" | "idle" | "underutilized" | "overutilized" | "uncovered";

export type Ec2ExplorerFiltersQuery = {
  startDate?: string;
  endDate?: string;
  metric: Ec2ExplorerMetric;
  groupBy: Ec2ExplorerGroupBy;
  tagKey?: string | null;
  regions?: string[];
  tags?: string[];
  costBasis?: Ec2ExplorerCostBasis;
  usageMetric?: Ec2ExplorerUsageMetric;
  usageType?: Ec2ExplorerUsageType;
  aggregation?: Ec2ExplorerAggregation;
  condition?: Ec2ExplorerCondition;
  groupValues?: string[];
  minCost?: number | null;
  maxCost?: number | null;
  minCpu?: number | null;
  maxCpu?: number | null;
  minNetwork?: number | null;
  maxNetwork?: number | null;
  states?: string[];
  instanceTypes?: string[];
};

export type Ec2ExplorerResponse = {
  summary: {
    totalCost: number;
    previousCost: number;
    trendPercent: number;
    instanceCount: number;
    avgCpu: number;
    totalNetworkGb: number;
  };
  graph: {
    type: "bar" | "stacked_bar" | "line" | "area" | "stacked_area";
    xKey: "date";
    series: Array<{
      key: string;
      label: string;
      data: Array<{ date: string; value: number }>;
    }>;
  };
  table: {
    columns: Array<{ key: string; label: string }>;
    rows: Array<{ id: string; [key: string]: string | number | null }>;
  };
};

export type Ec2NetworkBreakdownType =
  | "Internet Data Transfer"
  | "Inter-Region Data Transfer"
  | "Inter-AZ Data Transfer"
  | "NAT Gateway"
  | "Elastic IP"
  | "Load Balancer"
  | "Other Network";

export type Ec2NetworkBreakdownResponse = {
  totalNetworkCost: number;
  totalNetworkUsageGb: number | null;
  categories: Array<{
    type: Ec2NetworkBreakdownType;
    cost: number;
    percent: number;
    usageQuantity: number;
    resourceCount: number;
  }>;
  note: string | null;
};

export type Ec2OptimizationSummaryResponse = {
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
    rightsizing: Ec2OptimizationRecommendationItem[];
    idle_waste: Ec2OptimizationRecommendationItem[];
    coverage: Ec2OptimizationRecommendationItem[];
    performance_risk: Ec2OptimizationRecommendationItem[];
  };
};

export type Ec2OptimizationInstancesResponse = Ec2OptimizationSummaryResponse;

export type Ec2OptimizationRecommendationItem = {
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
  riskLevel: "low" | "medium" | "high";
  effortLevel: "low" | "medium" | "high";
  status: string;
  reason: string;
  evidence: Array<{
    label: string;
    value: string;
  }>;
  recommendedAction: string;
  actionLabel: string;
  drilldownUrl: string;
};

export type OptimizationRightsizingOverview = {
  category: "RIGHTSIZING";
  totalPotentialSavings: number;
  openRecommendationCount: number;
  quickWinsCount: number;
  highPriorityCount: number;
  riskMix: {
    low: number;
    medium: number;
    high: number;
  };
};

export type OptimizationIdleOverview = {
  category: "IDLE";
  totalPotentialSavings: number;
  openRecommendationCount: number;
  highImpactCount: number;
  lowRiskCount: number;
};

export type OptimizationCommitmentOverview = {
  category: "COMMITMENT";
  totalPotentialSavings: number;
  openRecommendationCount: number;
  recommendedHourlyCommitmentTotal: number;
  oneYearCount: number;
  threeYearCount: number;
};

export type OptimizationRecommendationItem = {
  id: string;
  recommendation: string;
  resource: string;
  currentType: string | null;
  recommendedType: string | null;
  currentCost: number;
  estimatedSavings: number;
  risk: string | null;
  effort: string | null;
  status: string;
  awsAccountId: string;
  awsRegionCode: string;
  serviceName: string | null;
};

export type RightsizingActionExecuteResponse = {
  actionId: string;
  recommendationId: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
};

export type RightsizingActionStatusResponse = {
  actionId: string;
  recommendationId: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  requestedByUserId: string | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  instanceId: string | null;
  fromInstanceType: string | null;
  toInstanceType: string | null;
  cloudConnectionId: string | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
  dryRun: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  details: unknown;
  awsRequestIds: unknown;
};

export type IdleActionExecuteResponse = {
  actionId: string;
  recommendationId: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
};

export type IdleActionStatusResponse = {
  actionId: string;
  recommendationId: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  requestedByUserId: string | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  dryRun: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  details: unknown;
  awsRequestIds: unknown;
  resourceId: string | null;
  resourceType: string | null;
  recommendationType: string | null;
  cloudConnectionId: string | null;
  awsAccountId: string | null;
  awsRegionCode: string | null;
};

export type RecommendationIgnoreResponse = {
  recommendationId: string;
  status: "IGNORED";
};

export type OptimizationIdleRecommendationItem = {
  id: string;
  recommendationType: string;
  recommendation: string;
  resourceId: string;
  resourceName: string | null;
  resourceType: string | null;
  idleReason: string | null;
  idleObservationValue: string | null;
  currentMonthlyCost: number;
  estimatedMonthlySavings: number;
  status: string;
  awsAccountId: string;
  awsRegionCode: string;
  serviceName: string | null;
  lastObservedAt: string | null;
};

export type OptimizationRecommendationsResponse = {
  items: OptimizationRecommendationItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type OptimizationIdleRecommendationsResponse = {
  items: OptimizationIdleRecommendationItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type OptimizationRecommendationDetail = {
  id: string;
  recommendationType: string;
  category: string;
  resourceId: string;
  resourceName: string | null;
  resourceArn: string | null;
  awsAccountId: string;
  awsRegionCode: string;
  serviceName: string | null;
  currentResourceType: string | null;
  recommendedResourceType: string | null;
  currentMonthlyCost: number;
  estimatedMonthlySavings: number;
  projectedMonthlyCost: number;
  performanceRiskLevel: string | null;
  performanceRiskScore: number | null;
  effortLevel: string | null;
  riskLevel: string | null;
  status: string;
  recommendationTitle: string | null;
  recommendationText: string | null;
  sourceSystem: string;
  observationStart: string | null;
  observationEnd: string | null;
  rawPayloadJson: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OptimizationIdleRecommendationDetail = {
  id: string;
  recommendationType: string;
  category: string;
  resourceId: string;
  resourceName: string | null;
  resourceArn: string | null;
  resourceType: string | null;
  idleReason: string | null;
  idleObservationValue: string | null;
  awsAccountId: string;
  awsRegionCode: string;
  serviceName: string | null;
  currentResourceType: string | null;
  currentMonthlyCost: number;
  estimatedMonthlySavings: number;
  projectedMonthlyCost: number;
  effortLevel: string | null;
  riskLevel: string | null;
  status: string;
  recommendationTitle: string | null;
  recommendationText: string | null;
  sourceSystem: string;
  observationStart: string | null;
  observationEnd: string | null;
  rawPayloadJson: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OptimizationCommitmentRecommendationItem = {
  id: string;
  recommendationType: string;
  recommendation: string;
  resourceName: string | null;
  currentMonthlyCost: number;
  estimatedMonthlySavings: number;
  projectedMonthlyCost: number;
  recommendedHourlyCommitment: number;
  recommendedPaymentOption: string | null;
  recommendedTerm: string | null;
  commitmentPlanType: string | null;
  status: string;
  awsAccountId: string;
  awsRegionCode: string | null;
};

export type OptimizationCommitmentRecommendationsResponse = {
  items: OptimizationCommitmentRecommendationItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type OptimizationCommitmentRecommendationDetail = {
  id: string;
  recommendationType: string;
  category: string;
  resourceId: string | null;
  resourceName: string | null;
  awsAccountId: string;
  awsRegionCode: string | null;
  currentMonthlyCost: number;
  estimatedMonthlySavings: number;
  projectedMonthlyCost: number;
  recommendedHourlyCommitment: number;
  recommendedPaymentOption: string | null;
  recommendedTerm: string | null;
  commitmentPlanType: string | null;
  status: string;
  recommendationTitle: string | null;
  recommendationText: string | null;
  sourceSystem: string;
  observationStart: string | null;
  observationEnd: string | null;
  rawPayloadJson: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OptimizationRecommendationFiltersQuery = {
  status?: string[];
  effort?: string[];
  risk?: string[];
  account?: string[];
  region?: string[];
  serviceKey?: number[];
  page?: number;
  pageSize?: number;
};

export type BudgetScopeType = "overall" | "service" | "region" | "account";
export type BudgetStatus = "active" | "inactive";
export type BudgetCompareMetric = "billed-cost" | "effective-cost" | "list-cost";

export type BudgetItem = {
  id: string;
  budgetName: string;
  budgetAmount: number;
  periodType: "monthly";
  startMonth: string;
  endMonth: string;
  ongoing: boolean;
  scopeType: BudgetScopeType;
  scopeValue: string;
  compareMetric: BudgetCompareMetric;
  threshold: number;
  currentSpend: number;
  status: BudgetStatus;
};

export type BudgetDashboardResponse = {
  section: "budget";
  title: "Budget";
  message: string;
  items: BudgetItem[];
};

export type BudgetUpsertPayload = {
  budgetName: string;
  budgetAmount: number;
  periodType: "monthly";
  startMonth: string;
  endMonth: string;
  ongoing: boolean;
  scopeType: BudgetScopeType;
  scopeValue: string;
  status: BudgetStatus;
};

export type OverviewSortOrder = "asc" | "desc";

export type OverviewFiltersQuery = {
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  forecastingEnabled?: boolean;
  accountKeys?: number[];
  serviceKeys?: number[];
  regionKeys?: number[];
  severity?: ("low" | "medium" | "high")[];
  status?: string[];
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: OverviewSortOrder;
};

export type TopSpendEntity = {
  key: number | null;
  name: string;
  billedCost: number;
  contributionPct: number;
};

export type OverviewKpis = {
  totalSpend: number;
  previousPeriodSpend: number;
  savingsAchieved: number;
  topRegion: TopSpendEntity | null;
  topAccount: TopSpendEntity | null;
  activeAlerts: number;
  highSeverityAnomalyCount: number;
};

export type BudgetActualForecastPoint = {
  month: string;
  budget: number;
  actual: number;
  forecast: number;
};

export type CostBreakdownItem = {
  key: number | null;
  name: string;
  billedCost: number;
  contributionPct: number;
  latitude?: number | null;
  longitude?: number | null;
};

export type SavingsInsights = {
  listCost: number;
  effectiveCost: number;
  absoluteSavings: number;
  savingsPct: number;
  insightText: string;
};

export type OverviewAnomaly = {
  anomalyId: string;
  anomalyDate: string;
  serviceKey: number | null;
  serviceName: string | null;
  regionKey: number | null;
  regionName: string | null;
  costImpact: number;
  severity: string;
  status: string;
  isActive: boolean;
  isHighSeverity: boolean;
  rootCauseHint: string | null;
};

export type OverviewRecommendation = {
  recommendationId: string;
  recommendationType: string | null;
  serviceName: string | null;
  estimatedSavings: number;
  effortLevel: string | null;
  riskLevel: string | null;
  status: string;
  isActive: boolean;
  actions: {
    viewEnabled: boolean;
    applyEnabled: boolean;
  };
  reason: string | null;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type OverviewAnomaliesResponse = {
  items: OverviewAnomaly[];
  summary: {
    activeCount: number;
    highSeverityCount: number;
  };
  pagination: PaginationMeta;
};

export type OverviewRecommendationsResponse = {
  items: OverviewRecommendation[];
  summary: {
    activeCount: number;
    estimatedSavingsTotal: number;
  };
  pagination: PaginationMeta;
};

export type AnomaliesFiltersQuery = {
  billing_source_id?: number;
  status?: "open" | "resolved" | "ignored";
  severity?: "low" | "medium" | "high";
  anomaly_type?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
};

export type AnomalyRecord = {
  id: string;
  tenant_id: string | null;
  billing_source_id: number | null;
  billing_source_name: string | null;
  cloud_connection_id: string | null;
  cloud_connection_name?: string | null;
  usage_date: string;
  account_name?: string | null;
  service?: string | null;
  region?: string | null;
  detected_at: string;
  anomaly_type: string | null;
  anomaly_scope: string | null;
  baseline_type: string | null;
  source_granularity: string | null;
  source_table: string | null;
  expected_cost: number | string | null;
  actual_cost: number | string | null;
  delta_cost: number | string | null;
  delta_percent: number | string | null;
  confidence_score?: number | string | null;
  severity: "low" | "medium" | "high";
  status: "open" | "resolved" | "ignored";
  root_cause_hint: string | null;
  explanation_json: Record<string, unknown> | null;
  metadata_json: Record<string, unknown> | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  resolved_at: string | null;
  ignored_reason: string | null;
  created_at: string;
  service_name?: string | null;
  region_name?: string | null;
  resource_id?: string | null;
  resource_name?: string | null;
  sub_account_id?: string | null;
  sub_account_name?: string | null;
  contributors?: Array<{
    id: string;
    dimension_type: string;
    dimension_key: string | null;
    dimension_value: string | null;
    contribution_cost: number | string | null;
    contribution_percent: number | string | null;
    rank: number | null;
    created_at: string;
  }>;
};

export type S3CostInsightsResponse = {
  section: "s3-cost-insights";
  title: "S3 Cost Insights";
  message: string;
  filtersApplied: {
    from: string;
    to: string;
    scopeType: DashboardResolvedScope["scopeType"];
    s3Filters: {
      costCategory: string[];
      seriesValues: string[];
      bucket: string | null;
      storageClass: string[];
      region: string[];
        account: string[];
        costBy: "date" | "bucket" | "region" | "account";
        seriesBy: "cost_category" | "usage_type" | "operation" | "product_family" | "bucket" | "storage_class";
        yAxisMetric: "billed_cost" | "effective_cost" | "amortized_cost" | "usage_quantity";
      };
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
    | "product_family"
    | "region_name"
    | "sub_account_name"
    | "tag_value"
  >;
  kpis: {
    totalS3Cost: number;
    monthToDateCost: number;
    effectiveCost: number;
  };
  bucketTable: Array<{
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
  }>;
  costCategoryTable: Array<{
    costCategory: "Storage" | "Request" | "Transfer" | "Retrieval" | "Other";
    cost: number;
    usageQuantity: number;
    pricingUnit: string;
    percentOfBucketCost: number;
  }>;
  usageOperationTable: Array<{
    usageType: string;
    operation: string;
    cost: number;
    quantity: number;
    unit: string;
  }>;
  chart: {
    bucketCosts: Array<{
      bucketName: string;
      billedCost: number;
      effectiveCost: number;
    }>;
    trend: Array<{
      usageStartTime: string;
      billedCost: number;
      effectiveCost: number;
    }>;
    featureTrend: Array<{
      usageStartTime: string;
      storage: number;
      requests: number;
      retrieval: number;
      transfer: number;
      bucket: number;
      bucketStorageClass: number;
      other: number;
      total: number;
    }>;
    breakdown: {
      labels: string[];
      series: Array<{
        name: string;
        values: number[];
      }>;
    };
  };
  filterOptions: {
    costCategory: string[];
    usageType: string[];
    operation: string[];
    productFamily: string[];
    bucket: string[];
    storageClass: string[];
    region: string[];
      account: string[];
      costBy: Array<"date" | "bucket" | "region" | "account">;
      seriesBy: Array<"cost_category" | "usage_type" | "operation" | "product_family" | "bucket" | "storage_class">;
      yAxisMetric: Array<"billed_cost" | "effective_cost" | "amortized_cost" | "usage_quantity">;
    };
  };

export type S3CostInsightsFiltersQuery = {
  costCategory?: string[];
  seriesValues?: string[];
  bucket?: string | null;
  storageClass?: string[];
  region?: string[];
  account?: string[];
  costBy?: "date" | "bucket" | "region" | "account";
  seriesBy?: "cost_category" | "usage_type" | "operation" | "product_family" | "bucket" | "storage_class";
  yAxisMetric?: "billed_cost" | "effective_cost" | "amortized_cost" | "usage_quantity";
};

export type S3OptimizationBucketRow = {
  bucketName: string;
  accountId: string;
  region: string | null;
  lifecycleStatus: string | null;
  lifecycleRulesCount: number | null;
  hasLifecyclePolicy: boolean;
  scanTime: string;
};

export type S3OptimizationResponse = {
  section: "s3-optimization";
  title: "S3 Optimization";
  message: string;
  buckets: S3OptimizationBucketRow[];
};

export type S3BucketLifecycleRuleSummary = {
  id: string | null;
  status: string;
  hasTransition: boolean;
  hasExpiration: boolean;
};

export type S3BucketLifecycleInsight = {
  bucketName: string;
  accountId: string;
  region: string | null;
  lifecycleStatus: string | null;
  lifecycleRulesCount: number;
  enabledRulesCount: number;
  transitionRulesCount: number;
  expirationRulesCount: number;
  hasLifecyclePolicy: boolean;
  scanTime: string;
  riskLevel: "low" | "medium" | "high";
  headline: string;
  recommendation: string;
  topRules: S3BucketLifecycleRuleSummary[];
};

export type S3BucketLifecycleInsightResponse = {
  section: "s3-lifecycle-insight";
  title: "S3 Bucket Lifecycle Insight";
  message: string;
  insight: S3BucketLifecycleInsight | null;
};

export type AnomaliesListResponse = {
  items: AnomalyRecord[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

export type OverviewFiltersResponse = {
  billingPeriod: {
    min: string | null;
    max: string | null;
    defaultStart: string | null;
    defaultEnd: string | null;
  };
  accounts: Array<{ key: number; name: string }>;
  services: Array<{ key: number; name: string }>;
  regions: Array<{ key: number; name: string }>;
};

export type DashboardOverviewResponse = {
  filtersApplied: {
    billingPeriodStart: string;
    billingPeriodEnd: string;
    forecastingEnabled?: boolean;
    accountKeys?: number[];
    serviceKeys?: number[];
    regionKeys?: number[];
    severity?: ("low" | "medium" | "high")[];
    status?: string[];
    page: number;
    pageSize: number;
    sortBy?: string;
    sortOrder: OverviewSortOrder;
  };
  kpis: OverviewKpis;
  budgetVsActualForecast: BudgetActualForecastPoint[];
  topServices: CostBreakdownItem[];
  topAccounts: CostBreakdownItem[];
  topRegions: CostBreakdownItem[];
  savingsInsights: SavingsInsights;
  anomaliesPreview: {
    items: OverviewAnomaly[];
    total: number;
  };
  recommendationsPreview: {
    items: OverviewRecommendation[];
    total: number;
  };
};

export type CostExplorerGranularity = "hourly" | "daily" | "monthly";
export type CostExplorerGroupBy = "none" | "service" | "service-category" | "resource" | "region" | "account" | `tag:${string}`;
export type CostExplorerMetric = "billed" | "effective" | "list";
export type CostExplorerCompareKey = "previous-month" | "budget" | "forecast";

export type CostExplorerFiltersQuery = {
  granularity?: CostExplorerGranularity;
  groupBy?: CostExplorerGroupBy;
  metric?: CostExplorerMetric;
  compareKey?: CostExplorerCompareKey | null;
  forecastingEnabled?: boolean;
  tagKey?: string | null;
  tagValue?: string | null;
  groupValues?: string[];
};

export type CostExplorerGroupOptionsResponse = {
  baseOptions: Array<{ key: "none" | "service" | "service-category" | "resource" | "region" | "account"; label: string }>;
  tagKeyOptions: Array<{ key: `tag:${string}`; normalizedKey: string; count: number }>;
  tagValueOptions: Array<{ key: string; normalizedValue: string; count: number }>;
  groupValueOptions: Array<{ key: string; label: string; count: number }>;
};

export type CostExplorerChartLabel = {
  bucketStart: string;
  short: string;
  long: string;
};

export type CostExplorerSeries = {
  name: string;
  kind: "primary" | "group" | "comparison";
  compareKey?: CostExplorerCompareKey;
  values: number[];
};

export type CostExplorerBreakdownRow = {
  key: number | string | null;
  name: string;
  cost: number;
  changePct: number;
  relatedServices?: string[];
  relatedResourceTypes?: string[];
};

export type CostExplorerResponse = {
  section: "cost-explorer";
  title: "Cost Explorer";
  message: string;
  filtersApplied: {
    from: string;
    to: string;
    granularity: CostExplorerGranularity;
    effectiveGranularity: CostExplorerGranularity;
    groupBy: CostExplorerGroupBy;
    metric: CostExplorerMetric;
    compareKey: CostExplorerCompareKey | null;
    tagKey?: string | null;
    tagValue?: string | null;
    groupValues?: string[];
    scopeType: DashboardResolvedScope["scopeType"];
  };
  kpis: {
    periodSpend: number;
    previousPeriodSpend: number;
    trendPct: number;
    topService: string;
  };
  chart: {
    labels: CostExplorerChartLabel[];
    series: CostExplorerSeries[];
  };
  breakdowns: {
    service: CostExplorerBreakdownRow[];
    serviceCategory: CostExplorerBreakdownRow[];
    resource: CostExplorerBreakdownRow[];
    account: CostExplorerBreakdownRow[];
    region: CostExplorerBreakdownRow[];
  };
};
