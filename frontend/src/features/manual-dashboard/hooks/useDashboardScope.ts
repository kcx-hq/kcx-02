import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { parseUploadDashboardFiltersFromSearch } from "../utils/buildManualDashboardQueryParams";

export function useDashboardScope() {
  const location = useLocation();
  const filters = useMemo(() => parseUploadDashboardFiltersFromSearch(location.search), [location.search]);

  return {
    scope: {
      from: filters.billingPeriodStart,
      to: filters.billingPeriodEnd,
    },
    isLoading: false,
    isError: false,
    error: null,
  };
}
