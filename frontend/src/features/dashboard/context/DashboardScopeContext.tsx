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

const formatAsQueryDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const resolveScopeInputWithDefaults = (search: string): DashboardScopeInput => {
  const parsed = parseDashboardScopeInputFromSearch(search);
  const hasDateRange = Boolean(parsed.from && parsed.to);

  if (hasDateRange) {
    return parsed;
  }

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 29);

  return {
    ...parsed,
    from: formatAsQueryDate(start),
    to: formatAsQueryDate(today),
  };
};

export function DashboardScopeProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const scopeInput = useMemo(
    () => resolveScopeInputWithDefaults(location.search),
    [location.search],
  );

  const scopeQuery = useQuery({
    queryKey: ["dashboard", "scope", scopeInput],
    queryFn: () => dashboardApi.getScope(scopeInput),
    placeholderData: (previousData) => previousData,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
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
