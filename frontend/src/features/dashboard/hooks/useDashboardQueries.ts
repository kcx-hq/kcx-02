import { useQuery } from "@tanstack/react-query";
import { dashboardApi, type DashboardResolvedScope } from "../api/dashboardApi";
import { useDashboardScope } from "./useDashboardScope";

function assertScope(scope: DashboardResolvedScope | null): DashboardResolvedScope {
  if (!scope) {
    throw new Error("Dashboard scope is not resolved yet");
  }
  return scope;
}

export function useOverviewQuery() {
  const { scope } = useDashboardScope();
  return useQuery({
    queryKey: ["dashboard", "overview", scope],
    queryFn: () => dashboardApi.getOverview(assertScope(scope)),
    enabled: Boolean(scope),
  });
}

export function useCostExplorerQuery() {
  const { scope } = useDashboardScope();
  return useQuery({
    queryKey: ["dashboard", "cost-explorer", scope],
    queryFn: () => dashboardApi.getCostExplorer(assertScope(scope)),
    enabled: Boolean(scope),
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

export function useAnomaliesAlertsQuery() {
  const { scope } = useDashboardScope();
  return useQuery({
    queryKey: ["dashboard", "anomalies-alerts", scope],
    queryFn: () => dashboardApi.getAnomaliesAlerts(assertScope(scope)),
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
