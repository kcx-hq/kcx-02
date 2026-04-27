import { useQuery } from "@tanstack/react-query";
import {
  dashboardApi,
  type AnomaliesFiltersQuery,
  type AnomaliesListResponse,
  type CostExplorerFiltersQuery,
  type DashboardResolvedScope,
  type Ec2OptimizationSummaryFiltersQuery,
  type Ec2OptimizationInstancesFiltersQuery,
  type Ec2OptimizationSummaryResponse,
  type Ec2OptimizationInstancesResponse,
  type S3CostInsightsFiltersQuery,
  type S3CostInsightsResponse,
  type OptimizationIdleOverview,
  type OptimizationCommitmentOverview,
  type OptimizationIdleRecommendationDetail,
  type OptimizationCommitmentRecommendationDetail,
  type OptimizationIdleRecommendationsResponse,
  type OptimizationCommitmentRecommendationsResponse,
  type OptimizationRecommendationDetail,
  type OptimizationRecommendationFiltersQuery,
  type OptimizationRecommendationsResponse,
  type OptimizationRightsizingOverview,
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

export function useCostExplorerGroupOptionsQuery(groupBy?: CostExplorerFiltersQuery["groupBy"], tagKey?: string | null) {
  const { scope } = useDashboardScope();
  return useQuery({
    queryKey: ["dashboard", "cost-explorer", "group-options", scope, groupBy ?? null, tagKey ?? null],
    queryFn: () => dashboardApi.getCostExplorerGroupOptions(assertScope(scope), groupBy, tagKey ?? null),
    enabled: Boolean(scope),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
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

export function useOptimizationRightsizingOverviewQuery() {
  const { scope } = useDashboardScope();
  return useQuery<OptimizationRightsizingOverview, Error>({
    queryKey: ["dashboard", "optimization", "rightsizing", "overview", scope],
    queryFn: () => dashboardApi.getOptimizationRightsizingOverview(assertScope(scope)),
    enabled: Boolean(scope),
  });
}

export function useOptimizationRightsizingRecommendationsQuery(
  filters?: OptimizationRecommendationFiltersQuery,
  options?: {
    autoRefetchWhileInProgress?: boolean;
  },
) {
  const { scope } = useDashboardScope();
  return useQuery<OptimizationRecommendationsResponse, Error>({
    queryKey: ["dashboard", "optimization", "rightsizing", "recommendations", scope, filters],
    queryFn: () => dashboardApi.getOptimizationRightsizingRecommendations(assertScope(scope), filters),
    enabled: Boolean(scope),
    refetchInterval: (query) => {
      if (!options?.autoRefetchWhileInProgress) return false;
      const rows = query.state.data?.items ?? [];
      const hasInProgress = rows.some(
        (item) => String(item.status ?? "").trim().toUpperCase() === "IN_PROGRESS",
      );
      return hasInProgress ? 5000 : false;
    },
  });
}

export function useOptimizationRightsizingRecommendationDetailQuery(recommendationId: string | null) {
  const { scope } = useDashboardScope();
  return useQuery<OptimizationRecommendationDetail, Error>({
    queryKey: ["dashboard", "optimization", "rightsizing", "recommendation", recommendationId, scope],
    queryFn: () => dashboardApi.getOptimizationRightsizingRecommendationDetail(assertScope(scope), recommendationId as string),
    enabled: Boolean(scope) && Boolean(recommendationId),
  });
}

export function useOptimizationIdleOverviewQuery() {
  const { scope } = useDashboardScope();
  return useQuery<OptimizationIdleOverview, Error>({
    queryKey: ["dashboard", "optimization", "idle", "overview", scope],
    queryFn: () => dashboardApi.getOptimizationIdleOverview(assertScope(scope)),
    enabled: Boolean(scope),
  });
}

export function useOptimizationIdleRecommendationsQuery(
  filters?: OptimizationRecommendationFiltersQuery,
  options?: {
    autoRefetchWhileInProgress?: boolean;
    autoRefetchWhileLocalPending?: boolean;
  },
) {
  const { scope } = useDashboardScope();
  return useQuery<OptimizationIdleRecommendationsResponse, Error>({
    queryKey: ["dashboard", "optimization", "idle", "recommendations", scope, filters],
    queryFn: () => dashboardApi.getOptimizationIdleRecommendations(assertScope(scope), filters),
    enabled: Boolean(scope),
    refetchInterval: (query) => {
      if (!options?.autoRefetchWhileInProgress && !options?.autoRefetchWhileLocalPending) return false;
      const rows = query.state.data?.items ?? [];
      const hasInProgress = rows.some(
        (item) => String(item.status ?? "").trim().toUpperCase() === "IN_PROGRESS",
      );
      return hasInProgress || options?.autoRefetchWhileLocalPending ? 5000 : false;
    },
  });
}

export function useOptimizationIdleRecommendationDetailQuery(recommendationId: string | null) {
  const { scope } = useDashboardScope();
  return useQuery<OptimizationIdleRecommendationDetail, Error>({
    queryKey: ["dashboard", "optimization", "idle", "recommendation", recommendationId, scope],
    queryFn: () => dashboardApi.getOptimizationIdleRecommendationDetail(assertScope(scope), recommendationId as string),
    enabled: Boolean(scope) && Boolean(recommendationId),
  });
}

export function useOptimizationCommitmentOverviewQuery() {
  const { scope } = useDashboardScope();
  return useQuery<OptimizationCommitmentOverview, Error>({
    queryKey: ["dashboard", "optimization", "commitment", "overview", scope],
    queryFn: () => dashboardApi.getOptimizationCommitmentOverview(assertScope(scope)),
    enabled: Boolean(scope),
  });
}

export function useOptimizationCommitmentRecommendationsQuery(filters?: OptimizationRecommendationFiltersQuery) {
  const { scope } = useDashboardScope();
  return useQuery<OptimizationCommitmentRecommendationsResponse, Error>({
    queryKey: ["dashboard", "optimization", "commitment", "recommendations", scope, filters],
    queryFn: () => dashboardApi.getOptimizationCommitmentRecommendations(assertScope(scope), filters),
    enabled: Boolean(scope),
  });
}

export function useOptimizationCommitmentRecommendationDetailQuery(recommendationId: string | null) {
  const { scope } = useDashboardScope();
  return useQuery<OptimizationCommitmentRecommendationDetail, Error>({
    queryKey: ["dashboard", "optimization", "commitment", "recommendation", recommendationId, scope],
    queryFn: () => dashboardApi.getOptimizationCommitmentRecommendationDetail(assertScope(scope), recommendationId as string),
    enabled: Boolean(scope) && Boolean(recommendationId),
  });
}

export function useAnomaliesQuery(filters?: AnomaliesFiltersQuery) {
  return useQuery<AnomaliesListResponse, Error>({
    queryKey: ["dashboard", "anomalies", filters],
    queryFn: () => dashboardApi.getAnomalies(filters),
  });
}

export function useAnomaliesAlertsQuery(filters?: AnomaliesFiltersQuery) {
  const { scope } = useDashboardScope();
  return useQuery<AnomaliesListResponse, Error>({
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

export function useEc2OptimizationSummaryQuery(filters?: Ec2OptimizationSummaryFiltersQuery) {
  const { scope } = useDashboardScope();
  return useQuery<Ec2OptimizationSummaryResponse, Error>({
    queryKey: ["dashboard", "ec2", "optimization", "summary", scope, filters],
    queryFn: () => dashboardApi.getEc2OptimizationSummary(assertScope(scope), filters),
    enabled: Boolean(scope),
  });
}

export function useEc2OptimizationInstancesQuery(filters?: Ec2OptimizationInstancesFiltersQuery) {
  const { scope } = useDashboardScope();
  return useQuery<Ec2OptimizationInstancesResponse, Error>({
    queryKey: ["dashboard", "ec2", "optimization", "instances", scope, filters],
    queryFn: () => dashboardApi.getEc2OptimizationInstances(assertScope(scope), filters),
    enabled: Boolean(scope),
    placeholderData: (previous) => previous,
  });
}

export function useS3CostInsightsQuery(filters?: S3CostInsightsFiltersQuery) {
  const { scope } = useDashboardScope();
  return useQuery<S3CostInsightsResponse, Error>({
    queryKey: ["dashboard", "s3", "cost-insights", scope, filters],
    queryFn: () => dashboardApi.getS3CostInsights(assertScope(scope), filters),
    enabled: Boolean(scope),
  });
}
