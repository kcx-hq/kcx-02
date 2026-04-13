import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { dashboardApi } from "../api/dashboardApi";
import type { DashboardResolvedScope, DashboardScopeInput } from "../api/dashboardTypes";
import { parseDashboardScopeInputFromSearch } from "../utils/buildDashboardQueryParams";
import { createContext, useContext } from "react";

type DashboardScopeContextValue = {
  scopeInput: DashboardScopeInput;
  scope: DashboardResolvedScope | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

const DashboardScopeContext = createContext<DashboardScopeContextValue | undefined>(undefined);

export function DashboardScopeProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const scopeInput = useMemo(
    () => parseDashboardScopeInputFromSearch(location.search),
    [location.search],
  );

  const scopeQuery = useQuery({
    queryKey: ["dashboard", "scope", scopeInput],
    queryFn: () => dashboardApi.getScope(scopeInput),
  });

  const value = useMemo<DashboardScopeContextValue>(
    () => ({
      scopeInput,
      scope: scopeQuery.data ?? null,
      isLoading: scopeQuery.isLoading,
      isError: scopeQuery.isError,
      error: scopeQuery.error ?? null,
    }),
    [scopeInput, scopeQuery.data, scopeQuery.error, scopeQuery.isError, scopeQuery.isLoading],
  );

  return <DashboardScopeContext.Provider value={value}>{children}</DashboardScopeContext.Provider>;
}

export function useDashboardScopeContext() {
  const context = useContext(DashboardScopeContext);
  if (!context) {
    throw new Error("useDashboardScopeContext must be used within DashboardScopeProvider");
  }
  return context;
}
