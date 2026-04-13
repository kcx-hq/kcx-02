import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { uploadDashboardApi } from "../api/uploadDashboardApi";
import type {
  AnomaliesFiltersQuery,
  AnomaliesListResponse,
  CostExplorerFiltersQuery,
  CostExplorerResponse,
} from "../api/dashboardTypes";
import { parseUploadDashboardFiltersFromSearch } from "../utils/buildManualDashboardQueryParams";

export function useCostExplorerQuery(filters?: CostExplorerFiltersQuery, enabledOverride: boolean = true) {
  const location = useLocation();
  const baseFilters = useMemo(() => parseUploadDashboardFiltersFromSearch(location.search), [location.search]);

  return useQuery<CostExplorerResponse, Error>({
    queryKey: ["upload-dashboard", "cost-explorer", baseFilters, filters],
    queryFn: () => uploadDashboardApi.getCostExplorer({ ...baseFilters, ...(filters ?? {}) }),
    enabled: enabledOverride,
  });
}

export function useAnomaliesQuery(filters?: AnomaliesFiltersQuery) {
  const location = useLocation();
  const baseFilters = useMemo(() => parseUploadDashboardFiltersFromSearch(location.search), [location.search]);

  return useQuery<AnomaliesListResponse, Error>({
    queryKey: ["upload-dashboard", "anomalies-alerts", baseFilters, filters],
    queryFn: () => uploadDashboardApi.getAnomaliesAlerts({ ...baseFilters, ...(filters ?? {}) }),
  });
}
