import { useQuery } from "@tanstack/react-query";
import {
  getAllocation,
  getAnomaliesAlerts,
  getBudget,
  getCostExplorer,
  getOptimization,
  getOverview,
  getReport,
  getResources,
} from "../api/dashboardApi";

export function useOverviewQuery() {
  return useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: getOverview,
  });
}

export function useCostExplorerQuery() {
  return useQuery({
    queryKey: ["dashboard", "cost-explorer"],
    queryFn: getCostExplorer,
  });
}

export function useResourcesQuery() {
  return useQuery({
    queryKey: ["dashboard", "resources"],
    queryFn: getResources,
  });
}

export function useAllocationQuery() {
  return useQuery({
    queryKey: ["dashboard", "allocation"],
    queryFn: getAllocation,
  });
}

export function useOptimizationQuery() {
  return useQuery({
    queryKey: ["dashboard", "optimization"],
    queryFn: getOptimization,
  });
}

export function useAnomaliesAlertsQuery() {
  return useQuery({
    queryKey: ["dashboard", "anomalies-alerts"],
    queryFn: getAnomaliesAlerts,
  });
}

export function useBudgetQuery() {
  return useQuery({
    queryKey: ["dashboard", "budget"],
    queryFn: getBudget,
  });
}

export function useReportQuery() {
  return useQuery({
    queryKey: ["dashboard", "report"],
    queryFn: getReport,
  });
}
