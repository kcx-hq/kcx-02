import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  AnomaliesFiltersQuery,
  AnomaliesListResponse,
  BudgetDashboardResponse,
  BudgetUpsertPayload,
  BudgetActualForecastPoint,
  CostExplorerFiltersQuery,
  CostExplorerGroupOptionsResponse,
  CostExplorerResponse,
  CostBreakdownItem,
  DashboardOverviewResponse,
  OverviewAnomaliesResponse,
  OverviewFiltersQuery,
  OverviewFiltersResponse,
  OverviewKpis,
  OverviewRecommendationsResponse,
  SavingsInsights,
  DashboardResolvedScope,
  DashboardScopeInput,
  DashboardSectionData,
  Ec2OverviewFiltersQuery,
  Ec2OverviewResponse,
  Ec2InstanceHoursFiltersQuery,
  Ec2InstanceHoursResponse,
  Ec2InstanceUsageFiltersQuery,
  Ec2InstanceUsageResponse,
  S3CostInsightsFiltersQuery,
  S3CostInsightsResponse,
  OptimizationIdleOverview,
  OptimizationCommitmentOverview,
  OptimizationIdleRecommendationsResponse,
  OptimizationCommitmentRecommendationsResponse,
  OptimizationIdleRecommendationDetail,
  OptimizationCommitmentRecommendationDetail,
  OptimizationRightsizingOverview,
  OptimizationRecommendationFiltersQuery,
  OptimizationRecommendationsResponse,
  OptimizationRecommendationDetail,
  IdleActionExecuteResponse,
  IdleActionStatusResponse,
  RecommendationIgnoreResponse,
  RightsizingActionExecuteResponse,
  RightsizingActionStatusResponse,
} from "./dashboardTypes";
import { buildDashboardQueryParams } from "../utils/buildDashboardQueryParams";

function withDashboardQuery(
  path: string,
  scopeOrInput: DashboardScopeInput | DashboardResolvedScope,
): string {
  const query = buildDashboardQueryParams(scopeOrInput);
  return query.length > 0 ? `${path}?${query}` : path;
}

function withOverviewFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: OverviewFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));

  const appendArray = (key: string, values?: (string | number)[]) => {
    if (!Array.isArray(values) || values.length === 0) {
      return;
    }
    params.set(key, values.join(","));
  };

  if (filters?.billingPeriodStart) params.set("billingPeriodStart", filters.billingPeriodStart);
  if (filters?.billingPeriodEnd) params.set("billingPeriodEnd", filters.billingPeriodEnd);
  if (typeof filters?.forecastingEnabled === "boolean") {
    params.set("forecastingEnabled", String(filters.forecastingEnabled));
  }
  if (typeof filters?.page === "number") params.set("page", String(filters.page));
  if (typeof filters?.pageSize === "number") params.set("pageSize", String(filters.pageSize));
  if (filters?.sortBy) params.set("sortBy", filters.sortBy);
  if (filters?.sortOrder) params.set("sortOrder", filters.sortOrder);

  appendArray("accountKeys", filters?.accountKeys);
  appendArray("serviceKeys", filters?.serviceKeys);
  appendArray("regionKeys", filters?.regionKeys);
  appendArray("severity", filters?.severity);
  appendArray("status", filters?.status);

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withCostExplorerFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: CostExplorerFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));

  if (filters?.granularity) params.set("granularity", filters.granularity);
  if (filters?.groupBy) params.set("groupBy", filters.groupBy);
  if (filters?.metric) params.set("metric", filters.metric);
  if (typeof filters?.forecastingEnabled === "boolean") {
    params.set("forecastingEnabled", String(filters.forecastingEnabled));
  }
  if (typeof filters?.tagKey === "string" && filters.tagKey.trim().length > 0) {
    params.set("tagKey", filters.tagKey.trim().toLowerCase());
  }
  if (typeof filters?.tagValue === "string" && filters.tagValue.trim().length > 0) {
    params.set("tagValue", filters.tagValue.trim().toLowerCase());
  }
  if (Array.isArray(filters?.groupValues) && filters.groupValues.length > 0) {
    params.set("groupValues", filters.groupValues.join(","));
  }

  if (filters?.compareKey) {
    params.set("compareKey", filters.compareKey);
  } else if (filters?.compareKey === null) {
    params.delete("compareKey");
  }

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withCostExplorerGroupOptions(
  path: string,
  scope: DashboardResolvedScope,
  groupBy?: CostExplorerFiltersQuery["groupBy"],
  tagKey?: string | null,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  if (groupBy && groupBy.trim().length > 0) {
    params.set("groupBy", groupBy);
  }
  if (tagKey && tagKey.trim().length > 0) {
    params.set("tagKey", tagKey.trim().toLowerCase());
  }
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withOptimizationFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: OptimizationRecommendationFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  // Avoid inheriting unrelated scope filters (like serviceKey from other dashboard pages)
  // that can silently hide optimization recommendations.
  params.delete("providerId");
  params.delete("billingAccountKey");
  params.delete("subAccountKey");
  params.delete("serviceKey");
  params.delete("regionKey");

  const appendArray = (key: string, values?: (string | number)[]) => {
    if (!Array.isArray(values) || values.length === 0) {
      return;
    }
    params.set(key, values.join(","));
  };

  appendArray("status", filters?.status);
  appendArray("effort", filters?.effort);
  appendArray("risk", filters?.risk);
  appendArray("account", filters?.account);
  appendArray("region", filters?.region);
  appendArray("serviceKey", filters?.serviceKey);

  if (typeof filters?.page === "number") params.set("page", String(filters.page));
  if (typeof filters?.pageSize === "number") params.set("pageSize", String(filters.pageSize));

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withAnomaliesFilters(path: string, filters?: AnomaliesFiltersQuery): string {
  const params = new URLSearchParams();

  if (typeof filters?.billing_source_id === "number") params.set("billing_source_id", String(filters.billing_source_id));
  if (filters?.status) params.set("status", filters.status);
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.anomaly_type) params.set("anomaly_type", filters.anomaly_type);
  if (filters?.date_from) params.set("date_from", filters.date_from);
  if (filters?.date_to) params.set("date_to", filters.date_to);
  if (typeof filters?.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters?.offset === "number") params.set("offset", String(filters.offset));

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withAnomaliesAlertsFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: AnomaliesFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));

  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.anomaly_type) params.set("anomaly_type", filters.anomaly_type);
  if (filters?.date_from) params.set("date_from", filters.date_from);
  if (filters?.date_to) params.set("date_to", filters.date_to);
  if (typeof filters?.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters?.offset === "number") params.set("offset", String(filters.offset));

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withEc2InstanceUsageFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: Ec2InstanceUsageFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  if (filters?.cloudConnectionId) params.set("cloud_connection_id", filters.cloudConnectionId);
  if (typeof filters?.subAccountKey === "number") params.set("sub_account_key", String(filters.subAccountKey));
  if (typeof filters?.regionKey === "number") params.set("region_key", String(filters.regionKey));
  if (filters?.category) params.set("category", filters.category);

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withEc2OverviewFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: Ec2OverviewFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  if (filters?.cloudConnectionId) params.set("cloud_connection_id", filters.cloudConnectionId);
  if (typeof filters?.subAccountKey === "number") params.set("sub_account_key", String(filters.subAccountKey));
  if (typeof filters?.regionKey === "number") params.set("region_key", String(filters.regionKey));
  if (filters?.instanceType) params.set("instance_type", filters.instanceType);
  if (filters?.state) params.set("state", filters.state);

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withEc2InstanceHoursFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: Ec2InstanceHoursFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  if (filters?.cloudConnectionId) params.set("cloud_connection_id", filters.cloudConnectionId);
  if (typeof filters?.subAccountKey === "number") params.set("sub_account_key", String(filters.subAccountKey));
  if (typeof filters?.regionKey === "number") params.set("region_key", String(filters.regionKey));

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withS3CostInsightsFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: S3CostInsightsFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  const appendArray = (key: string, values?: string[]) => {
    if (!Array.isArray(values) || values.length === 0) return;
    params.set(key, values.join(","));
  };

  appendArray("costCategory", filters?.costCategory);
  appendArray("seriesValues", filters?.seriesValues);
  appendArray("storageClass", filters?.storageClass);
  appendArray("region", filters?.region);
  appendArray("account", filters?.account);
  if (typeof filters?.bucket === "string" && filters.bucket.trim().length > 0) {
    params.set("bucket", filters.bucket.trim());
  }
  if (filters?.costBy) {
    params.set("costBy", filters.costBy);
  }
  if (filters?.seriesBy) {
    params.set("seriesBy", filters.seriesBy);
  }
  if (filters?.yAxisMetric) {
    params.set("yAxisMetric", filters.yAxisMetric);
  }

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

export const dashboardApi = {
  getScope(scopeInput: DashboardScopeInput) {
    return apiGet<DashboardResolvedScope>(withDashboardQuery("/dashboard/scope", scopeInput));
  },

  getOverview(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<DashboardOverviewResponse>(withOverviewFilters("/dashboard/overview", scope, filters));
  },

  getOverviewKpis(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<OverviewKpis>(withOverviewFilters("/dashboard/overview/kpis", scope, filters));
  },

  getOverviewBudgetVsActualForecast(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<{ items: BudgetActualForecastPoint[] }>(
      withOverviewFilters("/dashboard/overview/budget-vs-actual-forecast", scope, filters),
    );
  },

  getOverviewTopServices(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<{ items: CostBreakdownItem[] }>(withOverviewFilters("/dashboard/overview/top-services", scope, filters));
  },

  getOverviewTopAccounts(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<{ items: CostBreakdownItem[] }>(withOverviewFilters("/dashboard/overview/top-accounts", scope, filters));
  },

  getOverviewTopRegions(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<{ items: CostBreakdownItem[] }>(withOverviewFilters("/dashboard/overview/top-regions", scope, filters));
  },

  getOverviewSavingsInsights(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<SavingsInsights>(withOverviewFilters("/dashboard/overview/savings-insights", scope, filters));
  },

  getOverviewAnomalies(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<OverviewAnomaliesResponse>(withOverviewFilters("/dashboard/overview/anomalies", scope, filters));
  },

  getOverviewRecommendations(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<OverviewRecommendationsResponse>(
      withOverviewFilters("/dashboard/overview/recommendations", scope, filters),
    );
  },

  getDashboardFilters(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<OverviewFiltersResponse>(withOverviewFilters("/dashboard/filters", scope, filters));
  },

  getCostExplorer(scope: DashboardResolvedScope, filters?: CostExplorerFiltersQuery) {
    return apiGet<CostExplorerResponse>(withCostExplorerFilters("/dashboard/cost-explorer", scope, filters));
  },

  getCostExplorerGroupOptions(
    scope: DashboardResolvedScope,
    groupBy?: CostExplorerFiltersQuery["groupBy"],
    tagKey?: string | null,
  ) {
    return apiGet<CostExplorerGroupOptionsResponse>(
      withCostExplorerGroupOptions("/dashboard/cost-explorer/group-options", scope, groupBy, tagKey),
    );
  },

  getResources(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/resources", scope));
  },

  getAllocation(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/allocation", scope));
  },

  getOptimization(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/optimization", scope));
  },

  getOptimizationRightsizingOverview(scope: DashboardResolvedScope) {
    return apiGet<OptimizationRightsizingOverview>(
      withDashboardQuery("/dashboard/optimization/rightsizing/overview", scope),
    );
  },

  getOptimizationRightsizingRecommendations(scope: DashboardResolvedScope, filters?: OptimizationRecommendationFiltersQuery) {
    return apiGet<OptimizationRecommendationsResponse>(
      withOptimizationFilters("/dashboard/optimization/rightsizing/recommendations", scope, filters),
    );
  },

  getOptimizationRightsizingRecommendationDetail(scope: DashboardResolvedScope, recommendationId: string) {
    return apiGet<OptimizationRecommendationDetail>(
      withDashboardQuery(`/dashboard/optimization/rightsizing/recommendations/${recommendationId}`, scope),
    );
  },

  executeOptimizationRightsizingRecommendation(
    scope: DashboardResolvedScope,
    recommendationId: string,
    payload?: { dryRun?: boolean; idempotencyKey?: string },
  ) {
    return apiPost<RightsizingActionExecuteResponse>(
      withDashboardQuery(`/dashboard/optimization/rightsizing/recommendations/${recommendationId}/execute`, scope),
      payload ?? {},
    );
  },

  getOptimizationRightsizingActionStatus(scope: DashboardResolvedScope, actionId: string) {
    return apiGet<RightsizingActionStatusResponse>(
      withDashboardQuery(`/dashboard/optimization/rightsizing/actions/${actionId}`, scope),
    );
  },

  ignoreOptimizationRightsizingRecommendation(scope: DashboardResolvedScope, recommendationId: string) {
    return apiPost<RecommendationIgnoreResponse>(
      withDashboardQuery(`/dashboard/optimization/rightsizing/recommendations/${recommendationId}/ignore`, scope),
      {},
    );
  },

  getOptimizationIdleOverview(scope: DashboardResolvedScope) {
    return apiGet<OptimizationIdleOverview>(
      withDashboardQuery("/dashboard/optimization/idle/overview", scope),
    );
  },

  getOptimizationIdleRecommendations(scope: DashboardResolvedScope, filters?: OptimizationRecommendationFiltersQuery) {
    return apiGet<OptimizationIdleRecommendationsResponse>(
      withOptimizationFilters("/dashboard/optimization/idle/recommendations", scope, filters),
    );
  },

  getOptimizationIdleRecommendationDetail(scope: DashboardResolvedScope, recommendationId: string) {
    return apiGet<OptimizationIdleRecommendationDetail>(
      withDashboardQuery(`/dashboard/optimization/idle/recommendations/${recommendationId}`, scope),
    );
  },

  executeOptimizationIdleRecommendation(
    scope: DashboardResolvedScope,
    recommendationId: string,
    payload?: { dryRun?: boolean; idempotencyKey?: string },
  ) {
    return apiPost<IdleActionExecuteResponse>(
      withDashboardQuery(`/dashboard/optimization/idle/recommendations/${recommendationId}/execute`, scope),
      payload ?? {},
    );
  },

  getOptimizationIdleActionStatus(scope: DashboardResolvedScope, actionId: string) {
    return apiGet<IdleActionStatusResponse>(
      withDashboardQuery(`/dashboard/optimization/idle/actions/${actionId}`, scope),
    );
  },

  ignoreOptimizationIdleRecommendation(scope: DashboardResolvedScope, recommendationId: string) {
    return apiPost<RecommendationIgnoreResponse>(
      withDashboardQuery(`/dashboard/optimization/idle/recommendations/${recommendationId}/ignore`, scope),
      {},
    );
  },

  getOptimizationCommitmentOverview(scope: DashboardResolvedScope) {
    return apiGet<OptimizationCommitmentOverview>(
      withDashboardQuery("/dashboard/optimization/commitment/overview", scope),
    );
  },

  getOptimizationCommitmentRecommendations(
    scope: DashboardResolvedScope,
    filters?: OptimizationRecommendationFiltersQuery,
  ) {
    return apiGet<OptimizationCommitmentRecommendationsResponse>(
      withOptimizationFilters("/dashboard/optimization/commitment/recommendations", scope, filters),
    );
  },

  getOptimizationCommitmentRecommendationDetail(scope: DashboardResolvedScope, recommendationId: string) {
    return apiGet<OptimizationCommitmentRecommendationDetail>(
      withDashboardQuery(`/dashboard/optimization/commitment/recommendations/${recommendationId}`, scope),
    );
  },

  getAnomalies(filters?: AnomaliesFiltersQuery) {
    return apiGet<AnomaliesListResponse>(withAnomaliesFilters("/anomalies", filters));
  },

  getAnomaliesAlerts(scope: DashboardResolvedScope, filters?: AnomaliesFiltersQuery) {
    return apiGet<AnomaliesListResponse>(withAnomaliesAlertsFilters("/dashboard/anomalies-alerts", scope, filters));
  },

  getBudget(scope: DashboardResolvedScope) {
    return apiGet<BudgetDashboardResponse>(withDashboardQuery("/dashboard/budget", scope));
  },

  createBudget(scope: DashboardResolvedScope, payload: BudgetUpsertPayload) {
    return apiPost<BudgetDashboardResponse["items"][number]>(withDashboardQuery("/dashboard/budget", scope), payload);
  },

  updateBudget(scope: DashboardResolvedScope, budgetId: string, payload: BudgetUpsertPayload) {
    return apiPatch<BudgetDashboardResponse["items"][number]>(
      withDashboardQuery(`/dashboard/budget/${budgetId}`, scope),
      payload,
    );
  },

  updateBudgetStatus(scope: DashboardResolvedScope, budgetId: string, status: "active" | "inactive") {
    return apiPatch<BudgetDashboardResponse["items"][number]>(
      withDashboardQuery(`/dashboard/budget/${budgetId}/status`, scope),
      { status },
    );
  },

  getReport(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/report", scope));
  },

  getEc2InstanceUsage(scope: DashboardResolvedScope, filters?: Ec2InstanceUsageFiltersQuery) {
    return apiGet<Ec2InstanceUsageResponse>(withEc2InstanceUsageFilters("/dashboard/ec2/instance-usage", scope, filters));
  },
  getEc2Overview(scope: DashboardResolvedScope, filters?: Ec2OverviewFiltersQuery) {
    return apiGet<Ec2OverviewResponse>(withEc2OverviewFilters("/dashboard/ec2/overview", scope, filters));
  },
  getEc2InstanceHours(scope: DashboardResolvedScope, filters?: Ec2InstanceHoursFiltersQuery) {
    return apiGet<Ec2InstanceHoursResponse>(withEc2InstanceHoursFilters("/dashboard/ec2/instance-hours", scope, filters));
  },
  getS3CostInsights(scope: DashboardResolvedScope, filters?: S3CostInsightsFiltersQuery) {
    return apiGet<S3CostInsightsResponse>(withS3CostInsightsFilters("/dashboard/s3/cost-insights", scope, filters));
  },
};

export type {
  BudgetActualForecastPoint,
  AnomalyRecord,
  AnomaliesFiltersQuery,
  AnomaliesListResponse,
  BudgetDashboardResponse,
  BudgetItem,
  BudgetStatus,
  BudgetUpsertPayload,
  CostExplorerBreakdownRow,
  CostExplorerCompareKey,
  CostExplorerFiltersQuery,
  CostExplorerGranularity,
  CostExplorerGroupBy,
  CostExplorerMetric,
  CostExplorerResponse,
  CostExplorerSeries,
  CostBreakdownItem,
  DashboardOverviewResponse,
  OverviewAnomaliesResponse,
  OverviewAnomaly,
  OverviewFiltersQuery,
  OverviewFiltersResponse,
  OverviewKpis,
  OverviewRecommendation,
  OverviewRecommendationsResponse,
  OverviewSortOrder,
  SavingsInsights,
  DashboardResolvedScope,
  DashboardScopeInput,
  DashboardSectionData,
  Ec2OverviewFiltersQuery,
  Ec2OverviewResponse,
  Ec2InstanceHoursFiltersQuery,
  Ec2InstanceHoursResponse,
  Ec2InstanceUsageFiltersQuery,
  Ec2InstanceUsageResponse,
  S3CostInsightsFiltersQuery,
  S3CostInsightsResponse,
  OptimizationIdleOverview,
  OptimizationCommitmentOverview,
  OptimizationIdleRecommendationsResponse,
  OptimizationCommitmentRecommendationsResponse,
  OptimizationIdleRecommendationDetail,
  OptimizationCommitmentRecommendationDetail,
  OptimizationRightsizingOverview,
  OptimizationRecommendationFiltersQuery,
  OptimizationRecommendationsResponse,
  OptimizationRecommendationDetail,
  IdleActionExecuteResponse,
  IdleActionStatusResponse,
  RecommendationIgnoreResponse,
  RightsizingActionExecuteResponse,
  RightsizingActionStatusResponse,
} from "./dashboardTypes";
