import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { uploadDashboardApi } from "../api/uploadDashboardApi";
import type {
  AnomaliesFiltersQuery,
  AnomaliesListResponse,
  CostExplorerFiltersQuery,
  CostExplorerGroupOptionsResponse,
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

export function useCostExplorerGroupOptionsQuery(tagKey?: string | null) {
  const location = useLocation();
  const baseFilters = useMemo(() => parseUploadDashboardFiltersFromSearch(location.search), [location.search]);

  return useQuery<CostExplorerGroupOptionsResponse, Error>({
    queryKey: ["upload-dashboard", "cost-explorer", "group-options", baseFilters, tagKey ?? null],
    queryFn: () => uploadDashboardApi.getCostExplorerGroupOptions({ ...baseFilters, tagKey: tagKey ?? null }),
    staleTime: 30_000,
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
