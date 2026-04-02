import { apiGet } from "@/lib/api";
import type {
  DashboardOverviewResponse,
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

export const dashboardApi = {
  getScope(scopeInput: DashboardScopeInput) {
    return apiGet<DashboardResolvedScope>(withDashboardQuery("/dashboard/scope", scopeInput));
  },

  getOverview(scope: DashboardResolvedScope) {
    return apiGet<DashboardOverviewResponse>(withDashboardQuery("/dashboard/overview", scope));
  },

  getCostExplorer(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/cost-explorer", scope));
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

  getAnomaliesAlerts(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/anomalies-alerts", scope));
  },

  getBudget(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/budget", scope));
  },

  getReport(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/report", scope));
  },
};

export type {
  DashboardOverviewResponse,
  DashboardResolvedScope,
  DashboardScopeInput,
  DashboardSectionData,
} from "./dashboardTypes";
