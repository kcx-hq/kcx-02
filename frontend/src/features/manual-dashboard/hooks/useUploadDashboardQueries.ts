import { useQuery } from "@tanstack/react-query";
import { uploadDashboardApi, type UploadDashboardFiltersQuery } from "../api/uploadDashboardApi";

export function useUploadOverviewQuery(filters?: UploadDashboardFiltersQuery) {
  return useQuery({
    queryKey: ["upload-dashboard", "overview", filters],
    queryFn: () => uploadDashboardApi.getOverview(filters),
  });
}

export function useUploadCostExplorerQuery(filters?: UploadDashboardFiltersQuery) {
  return useQuery({
    queryKey: ["upload-dashboard", "cost-explorer", filters],
    queryFn: () => uploadDashboardApi.getCostExplorer(filters),
  });
}

export function useUploadAnomaliesAlertsQuery(filters?: UploadDashboardFiltersQuery) {
  return useQuery({
    queryKey: ["upload-dashboard", "anomalies-alerts", filters],
    queryFn: () => uploadDashboardApi.getAnomaliesAlerts(filters),
  });
}

export function useUploadDashboardFiltersQuery(filters?: UploadDashboardFiltersQuery) {
  return useQuery({
    queryKey: ["upload-dashboard", "filters", filters],
    queryFn: () => uploadDashboardApi.getFilters(filters),
    staleTime: 60_000,
  });
}
