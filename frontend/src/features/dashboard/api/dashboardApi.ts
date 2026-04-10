import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  AnomaliesFiltersQuery,
  AnomaliesListResponse,
  BudgetDashboardResponse,
  BudgetUpsertPayload,
  BudgetActualForecastPoint,
  CostExplorerFiltersQuery,
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

  if (filters?.compareKey) {
    params.set("compareKey", filters.compareKey);
  } else if (filters?.compareKey === null) {
    params.delete("compareKey");
  }

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

  getResources(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/resources", scope));
  },

  getAllocation(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/allocation", scope));
  },

  getOptimization(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/optimization", scope));
  },

  getAnomalies(filters?: AnomaliesFiltersQuery) {
    return apiGet<AnomaliesListResponse>(withAnomaliesFilters("/anomalies", filters));
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
} from "./dashboardTypes";
