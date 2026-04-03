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
