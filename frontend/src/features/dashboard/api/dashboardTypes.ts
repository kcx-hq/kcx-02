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

export type DatabaseExplorerFilterOptions = {
  dbServices: string[];
  dbEngines: string[];
};

export type DatabaseExplorerResponse = {
  filters: DatabaseExplorerAppliedFilters;
  filterOptions: DatabaseExplorerFilterOptions;
  cards: DatabaseExplorerCards;
  trend: Array<DatabaseExplorerCostTrendItem | DatabaseExplorerUsageTrendItem>;
  table: DatabaseExplorerTableRow[];
};

export type DatabaseAssetsSummary = {
  totalAssets: number;
  totalCost: number;
  avgCpu: number | null;
  totalStorageGb: number | null;
  recommendationCount: number;
};

export type DatabaseAssetsFilterOptions = {
  dbServices: string[];
  dbEngines: string[];
  classes: string[];
  statuses: string[];
  regions: string[];
  accounts: string[];
};

export type DatabaseAssetRow = {
  resourceId: string | null;
  resourceArn: string | null;
  resourceName: string | null;
  dbIdentifier: string | null;
  dbService: string | null;
  dbEngine: string | null;
  dbEngineVersion: string | null;
  resourceType: string | null;
  instanceClass: string | null;
  capacityMode: string | null;
  regionKey: string | number | null;
  regionId: string | null;
  regionName: string | null;
  subAccountKey: string | number | null;
  subAccountId: string | null;
  subAccountName: string | null;
  status: string | null;
  clusterId: string | null;
  isClusterResource: boolean | null;
  allocatedStorageGb: number | null;
  storageUsedGb: number | null;
  dataFootprintGb: number | null;
  avgCpu: number | null;
  maxCpu: number | null;
  avgConnections: number | null;
  maxConnections: number | null;
  avgIops: number | null;
  avgThroughputBytes: number | null;
  totalBilledCost: number | null;
  totalEffectiveCost: number | null;
  totalListCost: number | null;
  totalCost: number | null;
  currencyCode: string | null;
  recommendationCount: number | null;
  latestUsageDate: string | null;
  discoveredAt: string | null;
};

export type DatabaseAssetsPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type DatabaseAssetsResponse = {
  summary: DatabaseAssetsSummary;
  filterOptions: DatabaseAssetsFilterOptions;
  assets: DatabaseAssetRow[];
  pagination: DatabaseAssetsPagination;
};

export type DatabaseAssetsFilters = {
  cloudConnectionId?: string;
  regionKey?: string;
  subAccountKey?: string;
  dbService?: string;
  dbEngine?: string;
  instanceClass?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
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

export type Ec2RecommendationCategory = "compute" | "storage" | "pricing" | "network";
export type Ec2RecommendationType =
  | "idle_instance"
  | "underutilized_instance"
  | "overutilized_instance"
  | "unattached_volume"
  | "old_snapshot"
  | "orphaned_snapshot"
  | "uncovered_on_demand"
  | "high_internet_data_transfer"
  | "high_inter_region_data_transfer"
  | "high_inter_az_data_transfer"
  | "low_cpu_high_network"
  | "high_nat_gateway_cost"
  | "unattached_elastic_ip";
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
  resourceType: "instance" | "volume" | "snapshot" | "elastic_ip";
  resourceId: string;
  resourceName: string;
  accountId: string | null;
  region: string | null;
  problem: string;
  evidence: string;
  action: string;
  estimatedMonthlySaving: number;
  risk: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
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
    network: Ec2RecommendationRecord[];
  };
};

export type Ec2ExplorerMetric = "cost" | "usage" | "instances" | "volumes" | "data_transfer";
export type Ec2ExplorerGroupBy =
  | "none"
  | "region"
  | "account"
  | "availability_zone"
  | "instance_type"
  | "reservation_type"
  | "cost_category"
  | "usage_type"
  | "operation"
  | "instance_state"
  | "recommendation"
  | "volume"
  | "volume_type"
  | "attachment_state"
  | "instance"
  | "storage_tier"
  | "iops_tier"
  | "size_bucket"
  | "lifecycle_state"
  | "transfer_type"
  | "source_region"
  | "destination_region"
  | "tag";
export type Ec2ExplorerGranularity = "hourly" | "daily" | "monthly";
export type Ec2ExplorerVolumeView = "storage" | "storage_hours" | "cost" | "count";
export type Ec2ExplorerCostBasis =
  | "billed_cost"
  | "effective_cost"
  | "amortized_cost"
  | "net_amortized_cost"
  | "net_unblended_cost";
export type Ec2ExplorerUsageMetric = "cpu" | "network_in" | "network_out" | "disk_read" | "disk_write";
export type Ec2ExplorerUsageType = "cpu" | "network" | "disk";
export type Ec2ExplorerAggregation = "avg" | "max" | "p95";
export type Ec2ExplorerCondition = "all" | "idle" | "underutilized" | "overutilized" | "uncovered";

export type Ec2ExplorerFiltersQuery = {
  startDate?: string;
  endDate?: string;
  metric: Ec2ExplorerMetric;
  granularity?: Ec2ExplorerGranularity;
  volumeView?: Ec2ExplorerVolumeView;
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
  teams?: string[];
  products?: string[];
  environments?: string[];
  accounts?: string[];
  volumeTypes?: string[];
  volumeAttachment?: "all" | "attached" | "unattached";
  volumeStatuses?: string[];
  debugDataTransfer?: boolean;
};

export type Ec2ExplorerResponse = {
  summary: {
    totalCost: number;
    previousCost: number;
    trendPercent: number;
    instanceCount: number;
    volumeCount: number;
    attachedInstanceCount: number;
    unattachedVolumeCount: number;
    storageGb: number;
    storageGbHours: number;
    avgCpu: number;
    totalNetworkGb: number;
  };
  graph: {
    type: "bar" | "stacked_bar" | "line" | "area" | "stacked_area";
    xKey: "date";
    series: Array<{
      key: string;
      label: string;
      data: Array<{
        date: string;
        value: number;
        cost?: number;
        total_cost?: number;
        data_transfer_cost?: number;
        usage_gb?: number;
        billed_usage_gb?: number;
        total_usage_gb?: number;
        percent_share?: number;
      }>;
    }>;
  };
  table: {
    columns: Array<{ key: string; label: string }>;
    rows: Array<{ id: string; [key: string]: string | number | null }>;
  };
  dataTransferDebug?: {
    totalUnknownCost: number;
    totalUnknownUsageGb: number;
    unknownResourceCount: number;
    unmappedResourceCount: number;
    unmappedResourceCost: number;
    unmappedResourceUsageGb: number;
    unknown_resource_count: number;
    unmapped_resource_cost: number;
    unmapped_resource_usage_gb: number;
    topUnknownContributors: Array<{
      usageType: string;
      operation: string;
      productFamily: string;
      lineItemDescription: string;
      lineItemType: string;
      serviceCode: string;
      productCode: string;
      region: string;
      usageAmount: number;
      usageUnit: string;
      cost: number;
      resourceId: string;
      normalizedResourceId: string;
      dateBucket: string;
      likelyDemoData: boolean;
    }>;
    topUnknownRows: Array<{
      usageType: string;
      operation: string;
      productFamily: string;
      lineItemDescription: string;
      lineItemType: string;
      serviceCode: string;
      productCode: string;
      region: string;
      usageAmount: number;
      usageUnit: string;
      cost: number;
      resourceId: string;
      normalizedResourceId: string;
      dateBucket: string;
      likelyDemoData: boolean;
    }>;
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

export type Ec2DataTransferType = "internet" | "inter_region" | "inter_az" | "regional" | "unknown";
export type Ec2DataTransferSortBy =
  | "cost"
  | "usageGb"
  | "region"
  | "transferType"
  | "estimatedSavings"
  | "lastSeen";

export type Ec2DataTransferFiltersQuery = {
  accountId?: string | null;
  region?: string | null;
  team?: string | null;
  product?: string | null;
  environment?: string | null;
  tagKey?: string | null;
  tagValue?: string | null;
  transferType?: Ec2DataTransferType | null;
};

export type Ec2DataTransferResponse = {
  summary: {
    totalCost: number;
    totalUsageGb: number;
    resourceCount: number;
    internetCost: number;
    interRegionCost: number;
    interAzCost: number;
    regionalCost: number;
    unknownCost: number;
    potentialSavings: number;
  };
  breakdown: Array<{
    transferType: Ec2DataTransferType;
    label: string;
    cost: number;
    usageGb: number;
    percentageOfDataTransferCost: number;
    resourceCount: number;
    recommendationCount: number;
  }>;
  trend: Array<{
    date: string;
    internetCost: number;
    interRegionCost: number;
    interAzCost: number;
    regionalCost: number;
    unknownCost: number;
    totalCost: number;
    usageGb: number;
  }>;
};

export type Ec2ElasticIpState = "all" | "attached" | "unattached" | "unknown";

export type Ec2ElasticIpFiltersQuery = {
  startDate?: string;
  endDate?: string;
  accountId?: string | null;
  region?: string | null;
  state?: Ec2ElasticIpState;
  search?: string | null;
  page?: number;
  pageSize?: number;
};

export type Ec2ElasticIpResponse = {
  summary: {
    totalCost: number;
    totalEips: number;
    unattachedCount: number;
    potentialSavings: number;
  };
  rows: Array<{
    eipId: string;
    publicIp: string;
    accountName: string;
    accountId: string;
    region: string;
    state: "attached" | "unattached" | "unknown";
    associatedResourceId: string | null;
    cost: number;
    lastSeen: string | null;
    recommendation: string | null;
    estimatedSavings: number;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
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

export type S3PolicyAppliedStatus = "APPLIED" | "NOT_APPLIED" | "FAILED" | "EXTERNAL";

export type S3OptimizationBucketRow = {
  bucketName: string;
  accountId: string;
  region: string | null;
  lifecycleStatus: string | null;
  lifecycleRulesCount: number | null;
  hasLifecyclePolicy: boolean;
  scanTime: string;
  policyAppliedStatus: S3PolicyAppliedStatus;
  policyAppliedAt: string | null;
  lifecycleSavings: {
    status: "estimated" | "tracking" | "realized" | "not_available";
    policyAppliedAt: string | null;
    calculationPeriod: string | null;
    beforeCost: number | null;
    afterCost: number | null;
    estimatedMonthlySavingsMin: number | null;
    estimatedMonthlySavingsMax: number | null;
    realizedMonthlySavings: number | null;
    savingsPercent: number | null;
    beforeStorageGb: number | null;
    afterStorageGb: number | null;
    note: string;
  };
};

export type S3OptimizationResponse = {
  section: "s3-optimization";
  title: "S3 Optimization";
  message: string;
  buckets: S3OptimizationBucketRow[];
};

export type S3ReplicationStatus = "present" | "absent" | "unknown";
export type S3ReplicationType = "same_account" | "cross_account" | "unknown";
export type S3ReplicationRuleStatus = "enabled" | "disabled" | "mixed" | "unknown";
export type S3ReplicationActionType = "setup_replication" | "view" | "edit" | "remove" | "fix_permission" | "view_setup_guide";

export type S3ReplicationBucketRow = {
  bucketName: string;
  accountId: string;
  region: string | null;
  replicationStatus: S3ReplicationStatus;
  rulesCount: number;
  destinationBucket: string | null;
  destinationRegion: string | null;
  replicationType: S3ReplicationType;
  status: S3ReplicationRuleStatus;
  lastChecked: string;
  recommendation: string | null;
  actions: S3ReplicationActionType[];
};

export type S3ReplicationResponse = {
  section: "s3-replication";
  title: "S3 Replication";
  message: string;
  buckets: S3ReplicationBucketRow[];
};

export type S3ReplicationDestinationBucketOption = {
  bucketName: string;
  region: string | null;
};

export type S3ReplicationDestinationBucketsResponse = {
  section: "s3-replication-destination-buckets";
  title: "S3 Replication Destination Buckets";
  message: string;
  sourceBucketName: string;
  buckets: S3ReplicationDestinationBucketOption[];
};

export type S3ReplicationSetupRequest = {
  sourceBucketName: string;
  destinationBucketName: string;
  destinationRegion: string;
  replicationType: "same_account" | "cross_account";
  destinationAccountId?: string | null;
  replicationRoleArn: string;
  ruleName: string;
  prefix?: string | null;
  replicateDeleteMarkers?: boolean;
  autoEnableSourceVersioning?: boolean;
  autoEnableDestinationVersioning?: boolean;
};

export type S3ReplicationSetupCheck = {
  key: string;
  title: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export type S3ReplicationSetupPreviewResponse = {
  section: "s3-replication-setup-preview";
  title: "S3 Replication Setup Preview";
  message: string;
  canApply: boolean;
  checks: S3ReplicationSetupCheck[];
};

export type S3ReplicationSetupApplyResponse = {
  section: "s3-replication-setup-apply";
  title: "S3 Replication Setup Apply";
  message: string;
  sourceBucketName: string;
  destinationBucketName: string;
  destinationRegion: string;
  replicationStatus: "configured";
};

export type S3ReplicationRoleAutoCreateRequest = {
  sourceBucketName: string;
  destinationBucketName: string;
  roleName?: string | null;
};

export type S3ReplicationRoleAutoCreateResponse = {
  section: "s3-replication-role-auto-create";
  title: "S3 Replication Role Auto Create";
  message: string;
  roleName: string;
  roleArn: string;
};

export type S3BucketLifecycleRuleSummary = {
  id: string | null;
  status: string;
  hasTransition: boolean;
  hasExpiration: boolean;
};

export type S3LifecycleSuggestedTemplateKey = "safe" | "logs" | "temp" | "version" | "backup";

export type S3LifecycleBucketProfile = {
  bucketPattern: "general" | "logs" | "temp" | "backup" | "versioned";
  hasExplicitPrefixRules: boolean;
  primaryPrefix: string | null;
  noncurrentRuleSignals: boolean;
  transitionRuleCount: number;
  expirationRuleCount: number;
  objectSizeFilteredRuleCount: number;
};

export type S3LifecycleTemplateRecommendation = {
  templateKey: S3LifecycleSuggestedTemplateKey;
  confidence: "low" | "medium" | "high";
  reason: string;
  suggestedPrefix: string | null;
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
  profile: S3LifecycleBucketProfile;
  templateRecommendation: S3LifecycleTemplateRecommendation;
};

export type S3BucketLifecycleInsightResponse = {
  section: "s3-lifecycle-insight";
  title: "S3 Bucket Lifecycle Insight";
  message: string;
  insight: S3BucketLifecycleInsight | null;
};

export type S3LifecycleTransitionStorageClass = "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE" | "INTELLIGENT_TIERING";

export type S3LifecyclePolicyTransitionInput = {
  days: number;
  storageClass: S3LifecycleTransitionStorageClass;
};

export type S3LifecyclePolicyApplyRequest = {
  bucketName: string;
  ruleName: string;
  status: "Enabled" | "Disabled";
  scope: {
    type: "entire_bucket" | "prefix";
    prefix?: string;
    minObjectSizeBytes?: number | null;
    maxObjectSizeBytes?: number | null;
  };
  transitions: S3LifecyclePolicyTransitionInput[];
  expirationDays?: number | null;
  abortIncompleteMultipartUploadDays?: number | null;
  noncurrentVersionTransitions?: S3LifecyclePolicyTransitionInput[];
  noncurrentVersionExpirationDays?: number | null;
  expiredObjectDeleteMarker?: boolean | null;
  deleteWarningAccepted?: boolean | null;
};

export type S3LifecyclePolicyApplyResponse = {
  section: "s3-lifecycle-policy-apply";
  title: "S3 Lifecycle Policy Apply";
  message: string;
  bucketName: string;
  accountId: string;
  region: string;
  ruleName: string;
  appliedPolicy: {
    Rules: Array<Record<string, unknown>>;
  };
};

export type S3LifecyclePolicyDeleteRequest = {
  bucketName: string;
  ruleName: string;
  accountId?: string | null;
  region?: string | null;
};

export type S3LifecyclePolicyDeleteResponse = {
  section: "s3-lifecycle-policy-delete";
  title: "S3 Lifecycle Policy Delete";
  message: string;
  bucketName: string;
  accountId: string;
  region: string;
  ruleName: string;
};

export type S3PolicyActionHistoryItem = {
  id: string;
  serviceName: "S3";
  policyType: "LIFECYCLE";
  bucketName: string;
  accountId: string | null;
  region: string | null;
  ruleName: string | null;
  scopeType: "entire_bucket" | "prefix" | null;
  scopePrefix: string | null;
  status: "SUCCEEDED" | "FAILED";
  errorMessage: string | null;
  requestPayloadJson: Record<string, unknown> | null;
  responsePayloadJson: Record<string, unknown> | null;
  createdAt: string;
  createdByUserId: string | null;
};

export type S3PolicyActionHistoryResponse = {
  section: "policy-actions";
  title: "Policy Actions";
  message: string;
  items: S3PolicyActionHistoryItem[];
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
