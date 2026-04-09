export type DashboardScopeInput = {
  tenantId?: string;
  rawBillingFileId?: number;
  rawBillingFileIds?: number[];
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

export type OptimizationRecommendationsResponse = {
  items: OptimizationRecommendationItem[];
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
export type CostExplorerGroupBy = "none" | "service" | "service-category" | "resource" | "region" | "account";
export type CostExplorerMetric = "billed" | "effective" | "list";
export type CostExplorerCompareKey = "previous-month" | "budget" | "forecast";

export type CostExplorerFiltersQuery = {
  granularity?: CostExplorerGranularity;
  groupBy?: CostExplorerGroupBy;
  metric?: CostExplorerMetric;
  compareKey?: CostExplorerCompareKey | null;
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
