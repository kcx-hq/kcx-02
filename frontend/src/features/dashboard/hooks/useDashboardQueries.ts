import { useQuery } from "@tanstack/react-query";
import {
  dashboardApi,
  type AnomalyAlertRecord,
  type AnomalyAlertsFiltersQuery,
  type CostExplorerFiltersQuery,
  type DashboardResolvedScope,
  type OverviewAnomaliesResponse,
  type OverviewFiltersQuery,
  type OverviewRecommendationsResponse,
} from "../api/dashboardApi";
import { useDashboardScope } from "./useDashboardScope";

function assertScope(scope: DashboardResolvedScope | null): DashboardResolvedScope {
  if (!scope) {
    throw new Error("Dashboard scope is not resolved yet");
  }
  return scope;
}

export function useOverviewQuery(filters?: OverviewFiltersQuery) {
  const { scope } = useDashboardScope();
  return useQuery({
    queryKey: ["dashboard", "overview", scope, filters],
    queryFn: () => dashboardApi.getOverview(assertScope(scope), filters),
    enabled: Boolean(scope),
  });
}

export function useDashboardFiltersQuery(filters?: OverviewFiltersQuery) {
  const { scope } = useDashboardScope();
  return useQuery({
    queryKey: ["dashboard", "filters", scope, filters],
    queryFn: () => dashboardApi.getDashboardFilters(assertScope(scope), filters),
    enabled: Boolean(scope),
    staleTime: 60_000,
  });
}

export function useOverviewAnomaliesQuery(filters?: OverviewFiltersQuery) {
  const { scope } = useDashboardScope();
  return useQuery<OverviewAnomaliesResponse, Error>({
    queryKey: ["dashboard", "overview", "anomalies", scope, filters],
    queryFn: () => dashboardApi.getOverviewAnomalies(assertScope(scope), filters),
    enabled: Boolean(scope),
  });
}

export function useOverviewRecommendationsQuery(filters?: OverviewFiltersQuery) {
  const { scope } = useDashboardScope();
  return useQuery<OverviewRecommendationsResponse, Error>({
    queryKey: ["dashboard", "overview", "recommendations", scope, filters],
    queryFn: () => dashboardApi.getOverviewRecommendations(assertScope(scope), filters),
    enabled: Boolean(scope),
  });
}

export function useCostExplorerQuery(filters?: CostExplorerFiltersQuery, enabledOverride: boolean = true) {
  const { scope } = useDashboardScope();
  return useQuery({
    queryKey: ["dashboard", "cost-explorer", scope, filters],
    queryFn: () => dashboardApi.getCostExplorer(assertScope(scope), filters),
    enabled: Boolean(scope) && enabledOverride,
  });
}

export function useResourcesQuery() {
  const { scope } = useDashboardScope();
  return useQuery({
    queryKey: ["dashboard", "resources", scope],
    queryFn: () => dashboardApi.getResources(assertScope(scope)),
    enabled: Boolean(scope),
  });
}

export function useAllocationQuery() {
  const { scope } = useDashboardScope();
  return useQuery({
    queryKey: ["dashboard", "allocation", scope],
    queryFn: () => dashboardApi.getAllocation(assertScope(scope)),
    enabled: Boolean(scope),
  });
}

export function useOptimizationQuery() {
  const { scope } = useDashboardScope();
  return useQuery({
    queryKey: ["dashboard", "optimization", scope],
    queryFn: () => dashboardApi.getOptimization(assertScope(scope)),
    enabled: Boolean(scope),
  });
}

export function useAnomaliesAlertsQuery(filters?: AnomalyAlertsFiltersQuery) {
  const { scope } = useDashboardScope();
  return useQuery<AnomalyAlertRecord[], Error>({
    queryKey: ["dashboard", "anomalies-alerts", scope, filters],
    queryFn: () => dashboardApi.getAnomaliesAlerts(assertScope(scope), filters),
    enabled: Boolean(scope),
  });
}

export function useBudgetQuery() {
  const { scope } = useDashboardScope();
  return useQuery({
    queryKey: ["dashboard", "budget", scope],
    queryFn: () => dashboardApi.getBudget(assertScope(scope)),
    enabled: Boolean(scope),
  });
}

export function useReportQuery() {
  const { scope } = useDashboardScope();
  return useQuery({
    queryKey: ["dashboard", "report", scope],
    queryFn: () => dashboardApi.getReport(assertScope(scope)),
    enabled: Boolean(scope),
  });
}
