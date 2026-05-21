import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dashboardApi,
  type AnomaliesFiltersQuery,
  type AnomaliesListResponse,
  type CostExplorerFiltersQuery,
  type CostHistoryFilterOptionsResponse,
  type CostHistoryFiltersQuery,
  type CostHistoryResponse,
  type DashboardResolvedScope,
  type Ec2OptimizationSummaryFiltersQuery,
  type Ec2OptimizationInstancesFiltersQuery,
  type Ec2OptimizationSummaryResponse,
  type Ec2OptimizationInstancesResponse,
  type Ec2RecommendationsFiltersQuery,
  type Ec2RecommendationsResponse,
  type Ec2ExplorerFiltersQuery,
  type Ec2ExplorerResponse,
  type Ec2CostExplorerV2FiltersQuery,
  type Ec2CostExplorerV2Response,
  type Ec2NetworkBreakdownResponse,
  type Ec2DataTransferFiltersQuery,
  type Ec2DataTransferResponse,
  type Ec2ElasticIpFiltersQuery,
  type Ec2ElasticIpResponse,
  type LoadBalancerExplorerFiltersQuery,
  type LoadBalancerExplorerSummaryResponse,
  type LoadBalancerExplorerTrendResponse,
  type LoadBalancerExplorerGroupByResponse,
  type DatabaseExplorerFilters,
  type DatabaseExplorerResponse,
  type DatabaseAssetsFilters,
  type DatabaseAssetsResponse,
  type DatabaseAssetDetail,
  type DatabaseRecommendationFilters,
  type DatabaseRecommendationListResponse,
  type DatabaseRecommendationSummary,
  type DatabaseRecommendationDetail,
  type GenerateDatabaseRecommendationsResult,

  type S3CostInsightsFiltersQuery,
  type S3UsageInsightsFiltersQuery,
  type S3CostInsightsResponse,
  type S3BucketDetailResponse,
  type S3BucketLifecycleInsightResponse,
  type S3LifecyclePolicyApplyRequest,
  type S3LifecyclePolicyApplyResponse,
  type S3LifecyclePolicyDeleteRequest,
  type S3LifecyclePolicyDeleteResponse,
  type S3PolicyActionHistoryResponse,
  type S3OptimizationResponse,
  type S3ReplicationDestinationBucketsResponse,
  type S3ReplicationResponse,
  type S3ReplicationRoleAutoCreateRequest,
  type S3ReplicationRoleAutoCreateResponse,
  type S3ReplicationSetupApplyResponse,
  type S3ReplicationSetupPreviewResponse,
  type S3ReplicationSetupRequest,
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

export function useCostHistoryQuery(filters?: CostHistoryFiltersQuery, enabledOverride: boolean = true) {
  const { scope } = useDashboardScope();
  return useQuery<CostHistoryResponse, Error>({
    queryKey: ["dashboard", "cost-history", scope, filters],
    queryFn: () => dashboardApi.getCostHistory(assertScope(scope), filters),
    enabled: Boolean(scope) && enabledOverride,
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
}

export function useCostHistoryFilterOptionsQuery(enabledOverride: boolean = true) {
  const { scope } = useDashboardScope();
  return useQuery<CostHistoryFilterOptionsResponse, Error>({
    queryKey: ["dashboard", "cost-history", "filters", scope],
    queryFn: () => dashboardApi.getCostHistoryFilterOptions(assertScope(scope)),
    enabled: Boolean(scope) && enabledOverride,
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });
}

export function useDatabaseExplorerQuery(filters: DatabaseExplorerFilters) {
  const { scope } = useDashboardScope();
  return useQuery<DatabaseExplorerResponse, Error>({
    queryKey: ["dashboard", "services", "database", "explorer", scope, filters],
    queryFn: () => dashboardApi.getDatabaseExplorer(assertScope(scope), filters),
    enabled: Boolean(scope?.from && scope?.to),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });
}

export function useDatabaseAssetsQuery(filters: DatabaseAssetsFilters) {
  const { scope } = useDashboardScope();
  return useQuery<DatabaseAssetsResponse, Error>({
    queryKey: ["dashboard", "services", "database", "assets", scope, filters],
    queryFn: () => dashboardApi.getDatabaseAssets(assertScope(scope), filters),
    enabled: Boolean(scope?.from && scope?.to),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });
}

export function useDatabaseAssetDetailQuery(
  resourceId: string | null,
  params: { cloudConnectionId: string | null; startDate?: string | null; endDate?: string | null },
) {
  const { scope } = useDashboardScope();
  return useQuery<DatabaseAssetDetail, Error>({
    queryKey: ["dashboard", "services", "database", "asset-detail", scope, resourceId, params],
    queryFn: () => dashboardApi.getDatabaseAssetDetail(assertScope(scope), resourceId as string, {
      cloudConnectionId: params.cloudConnectionId as string,
      startDate: params.startDate ?? undefined,
      endDate: params.endDate ?? undefined,
    }),
    enabled: Boolean(scope?.from && scope?.to && resourceId && params.cloudConnectionId),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });
}

export function useDatabaseRecommendations(filters?: DatabaseRecommendationFilters) {
  const { scope } = useDashboardScope();
  return useQuery<DatabaseRecommendationListResponse, Error>({
    queryKey: ["dashboard", "services", "database", "recommendations", scope, filters],
    queryFn: () => dashboardApi.listDatabaseRecommendations(assertScope(scope), filters),
    enabled: Boolean(scope?.from && scope?.to),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });
}

export function useDatabaseRecommendationsSummary(filters?: Pick<DatabaseRecommendationFilters, "cloudConnectionId">) {
  const { scope } = useDashboardScope();
  return useQuery<DatabaseRecommendationSummary, Error>({
    queryKey: ["dashboard", "services", "database", "recommendations-summary", scope, filters],
    queryFn: () => dashboardApi.getDatabaseRecommendationSummary(assertScope(scope), filters),
    enabled: Boolean(scope?.from && scope?.to),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });
}

export function useDatabaseRecommendationDetail(id: string | null) {
  const { scope } = useDashboardScope();
  return useQuery<DatabaseRecommendationDetail, Error>({
    queryKey: ["dashboard", "services", "database", "recommendation-detail", scope, id],
    queryFn: () => dashboardApi.getDatabaseRecommendationDetail(assertScope(scope), id as string),
    enabled: Boolean(scope?.from && scope?.to && id),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });
}

export function useGenerateDatabaseRecommendations() {
  const { scope } = useDashboardScope();
  const queryClient = useQueryClient();
  return useMutation<
    GenerateDatabaseRecommendationsResult,
    Error,
    { cloudConnectionId?: string; billingSourceId?: number } | undefined
  >({
    mutationFn: (payload) => {
      if (!scope) throw new Error("Dashboard scope is not resolved yet");
      return dashboardApi.generateDatabaseRecommendations(scope, payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["dashboard", "services", "database", "recommendations"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dashboard", "services", "database", "recommendations-summary"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dashboard", "services", "database", "recommendation-detail"],
        }),
      ]);
    },
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
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });
}

export function useEc2OptimizationInstancesQuery(filters?: Ec2OptimizationInstancesFiltersQuery) {
  const { scope } = useDashboardScope();
  return useQuery<Ec2OptimizationInstancesResponse, Error>({
    queryKey: ["dashboard", "ec2", "optimization", "instances", scope, filters],
    queryFn: () => dashboardApi.getEc2OptimizationInstances(assertScope(scope), filters),
    enabled: Boolean(scope),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useEc2RecommendationsQuery(filters?: Ec2RecommendationsFiltersQuery) {
  const { scope } = useDashboardScope();
  return useQuery<Ec2RecommendationsResponse, Error>({
    queryKey: ["dashboard", "ec2", "recommendations", scope, filters],
    queryFn: () => dashboardApi.getEc2Recommendations(assertScope(scope), filters),
    enabled: Boolean(scope),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useEc2ExplorerQuery(filters: Ec2ExplorerFiltersQuery, enabledOverride: boolean = true) {
  const { scope } = useDashboardScope();
  return useQuery<Ec2ExplorerResponse, Error>({
    queryKey: ["dashboard", "ec2", "explorer", scope, filters],
    queryFn: () => dashboardApi.getEc2Explorer(assertScope(scope), filters),
    enabled: Boolean(scope) && enabledOverride,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useEc2ExplorerNetworkBreakdownQuery(
  filters: Ec2ExplorerFiltersQuery,
  enabledOverride: boolean = true,
) {
  const { scope } = useDashboardScope();
  return useQuery<Ec2NetworkBreakdownResponse, Error>({
    queryKey: ["dashboard", "ec2", "explorer", "network-breakdown", scope, filters],
    queryFn: () => dashboardApi.getEc2ExplorerNetworkBreakdown(assertScope(scope), filters),
    enabled: Boolean(scope) && enabledOverride,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });
}

export function useEc2DataTransferQuery(filters?: Ec2DataTransferFiltersQuery, enabledOverride: boolean = true) {
  const { scope } = useDashboardScope();
  return useQuery<Ec2DataTransferResponse, Error>({
    queryKey: ["dashboard", "ec2", "data-transfer", scope, filters],
    queryFn: () => dashboardApi.getEc2DataTransfer(assertScope(scope), filters),
    enabled: Boolean(scope) && enabledOverride,
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useEc2ElasticIpsQuery(filters?: Ec2ElasticIpFiltersQuery, enabledOverride: boolean = true) {
  const { scope } = useDashboardScope();
  return useQuery<Ec2ElasticIpResponse, Error>({
    queryKey: ["dashboard", "ec2", "elastic-ips", scope, filters],
    queryFn: () => dashboardApi.getEc2ElasticIps(assertScope(scope), filters),
    enabled: Boolean(scope) && enabledOverride,
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useLoadBalancerExplorerSummaryQuery(filters: LoadBalancerExplorerFiltersQuery, enabledOverride: boolean = true) {
  const { scope } = useDashboardScope();
  return useQuery<LoadBalancerExplorerSummaryResponse, Error>({
    queryKey: ["dashboard", "load-balancer", "explorer", "summary", scope, filters],
    queryFn: () => dashboardApi.getLoadBalancerExplorerSummary(assertScope(scope), filters),
    enabled: Boolean(scope) && enabledOverride,
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useLoadBalancerExplorerTrendQuery(filters: LoadBalancerExplorerFiltersQuery, enabledOverride: boolean = true) {
  const { scope } = useDashboardScope();
  return useQuery<LoadBalancerExplorerTrendResponse, Error>({
    queryKey: ["dashboard", "load-balancer", "explorer", "trend", scope, filters],
    queryFn: () => dashboardApi.getLoadBalancerExplorerTrend(assertScope(scope), filters),
    enabled: Boolean(scope) && enabledOverride,
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useLoadBalancerExplorerGroupByQuery(filters: LoadBalancerExplorerFiltersQuery, enabledOverride: boolean = true) {
  const { scope } = useDashboardScope();
  return useQuery<LoadBalancerExplorerGroupByResponse, Error>({
    queryKey: ["dashboard", "load-balancer", "explorer", "group-by", scope, filters],
    queryFn: () => dashboardApi.getLoadBalancerExplorerGroupBy(assertScope(scope), filters),
    enabled: Boolean(scope) && enabledOverride,
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useS3CostInsightsQuery(
  filters?: S3CostInsightsFiltersQuery,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number | false;
  },
) {
  const { scope } = useDashboardScope();
  return useQuery<S3CostInsightsResponse, Error>({
    queryKey: ["dashboard", "s3", "cost-insights", scope, filters],
    queryFn: ({ signal }) => dashboardApi.getS3CostInsights(assertScope(scope), filters, { signal }),
    enabled: Boolean(scope) && (options?.enabled ?? true),
    placeholderData: (previous) => previous,
    staleTime: options?.staleTime ?? 90_000,
    refetchOnWindowFocus: false,
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export function useEc2CostExplorerV2Query(filters: Ec2CostExplorerV2FiltersQuery, enabledOverride: boolean = true) {
  const { scope } = useDashboardScope();
  return useQuery<Ec2CostExplorerV2Response, Error>({
    queryKey: ["dashboard", "ec2", "explorer", "cost-v2", scope, filters],
    queryFn: () => dashboardApi.getEc2CostExplorerV2(assertScope(scope), filters),
    enabled: Boolean(scope) && enabledOverride,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useS3UsageInsightsQuery(
  filters?: S3UsageInsightsFiltersQuery,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number | false;
  },
) {
  const { scope } = useDashboardScope();
  return useQuery<S3CostInsightsResponse, Error>({
    queryKey: ["dashboard", "s3", "usage-insights", scope, filters],
    queryFn: ({ signal }) => dashboardApi.getS3UsageInsights(assertScope(scope), filters, { signal }),
    enabled: Boolean(scope) && (options?.enabled ?? true),
    placeholderData: (previous) => previous,
    staleTime: options?.staleTime ?? 90_000,
    refetchOnWindowFocus: false,
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export function useS3BucketDetailQuery(
  bucketName: string | null,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  },
) {
  const { scope } = useDashboardScope();
  const normalizedBucketName = String(bucketName ?? "").trim();
  return useQuery<S3BucketDetailResponse, Error>({
    queryKey: ["dashboard", "s3", "bucket-detail", scope, normalizedBucketName],
    queryFn: ({ signal }) => dashboardApi.getS3BucketDetail(assertScope(scope), normalizedBucketName, { signal }),
    enabled: Boolean(scope) && Boolean(normalizedBucketName) && (options?.enabled ?? true),
    placeholderData: (previous) => previous,
    staleTime: options?.staleTime ?? 90_000,
    refetchOnWindowFocus: false,
  });
}

export function useS3OptimizationQuery(enabledOverride: boolean = true) {
  const { scope } = useDashboardScope();
  return useQuery<S3OptimizationResponse, Error>({
    queryKey: ["dashboard", "s3", "optimization", scope],
    queryFn: () => dashboardApi.getS3Optimization(assertScope(scope)),
    enabled: Boolean(scope) && enabledOverride,
    placeholderData: (previous) => previous,
    staleTime: 90_000,
    refetchOnWindowFocus: false,
  });
}

export function useS3BucketLifecycleInsightQuery(bucketName: string | null) {
  const { scope } = useDashboardScope();
  return useQuery<S3BucketLifecycleInsightResponse, Error>({
    queryKey: ["dashboard", "s3", "lifecycle-insight", scope, bucketName],
    queryFn: () => dashboardApi.getS3BucketLifecycleInsight(assertScope(scope), bucketName as string),
    enabled: Boolean(scope) && Boolean(bucketName && bucketName.trim().length > 0),
    placeholderData: (previous) => previous,
    staleTime: 90_000,
    refetchOnWindowFocus: false,
  });
}

export function useApplyS3LifecyclePolicyMutation() {
  const { scope } = useDashboardScope();
  const queryClient = useQueryClient();
  return useMutation<S3LifecyclePolicyApplyResponse, Error, S3LifecyclePolicyApplyRequest>({
    mutationFn: (payload) => {
      if (!scope) {
        throw new Error("Dashboard scope is not resolved yet");
      }
      return dashboardApi.applyS3LifecyclePolicy(scope, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["dashboard", "policy", "actions"],
      });
    },
  });
}

export function useS3ReplicationQuery(
  enabledOverride: boolean = true,
  options?: {
    staleTime?: number;
    retry?: number | boolean;
  },
) {
  const { scope } = useDashboardScope();
  return useQuery<S3ReplicationResponse, Error>({
    queryKey: ["dashboard", "s3", "replication", scope],
    queryFn: () => dashboardApi.getS3Replication(assertScope(scope)),
    enabled: Boolean(scope) && enabledOverride,
    placeholderData: (previous) => previous,
    staleTime: options?.staleTime ?? 90_000,
    retry: options?.retry ?? 1,
    refetchOnWindowFocus: false,
  });
}

export function useS3ReplicationDestinationBucketsQuery(sourceBucketName: string | null, enabledOverride: boolean = true) {
  const { scope } = useDashboardScope();
  const normalizedSourceBucketName = String(sourceBucketName ?? "").trim();
  return useQuery<S3ReplicationDestinationBucketsResponse, Error>({
    queryKey: ["dashboard", "s3", "replication", "destination-buckets", scope, normalizedSourceBucketName],
    queryFn: () => dashboardApi.getS3ReplicationDestinationBuckets(assertScope(scope), normalizedSourceBucketName),
    enabled: Boolean(scope) && Boolean(normalizedSourceBucketName) && enabledOverride,
    placeholderData: (previous) => previous,
    staleTime: 90_000,
    refetchOnWindowFocus: false,
  });
}

export function usePreviewS3ReplicationSetupMutation() {
  const { scope } = useDashboardScope();
  return useMutation<S3ReplicationSetupPreviewResponse, Error, S3ReplicationSetupRequest>({
    mutationFn: (payload) => {
      if (!scope) throw new Error("Dashboard scope is not resolved yet");
      return dashboardApi.previewS3ReplicationSetup(scope, payload);
    },
  });
}

export function useApplyS3ReplicationSetupMutation() {
  const { scope } = useDashboardScope();
  const queryClient = useQueryClient();
  return useMutation<S3ReplicationSetupApplyResponse, Error, S3ReplicationSetupRequest>({
    mutationFn: (payload) => {
      if (!scope) throw new Error("Dashboard scope is not resolved yet");
      return dashboardApi.applyS3ReplicationSetup(scope, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "s3", "replication"] });
    },
  });
}

export function useAutoCreateS3ReplicationRoleMutation() {
  const { scope } = useDashboardScope();
  return useMutation<S3ReplicationRoleAutoCreateResponse, Error, S3ReplicationRoleAutoCreateRequest>({
    mutationFn: (payload) => {
      if (!scope) throw new Error("Dashboard scope is not resolved yet");
      return dashboardApi.autoCreateS3ReplicationRole(scope, payload);
    },
  });
}

export function usePolicyActionHistoryQuery() {
  const { scope } = useDashboardScope();
  return useQuery<S3PolicyActionHistoryResponse, Error>({
    queryKey: ["dashboard", "policy", "actions", scope],
    queryFn: () => dashboardApi.getPolicyActionHistory(assertScope(scope)),
    enabled: Boolean(scope),
  });
}

export function useDeleteS3LifecyclePolicyMutation() {
  const { scope } = useDashboardScope();
  const queryClient = useQueryClient();
  return useMutation<S3LifecyclePolicyDeleteResponse, Error, S3LifecyclePolicyDeleteRequest>({
    mutationFn: (payload) => {
      if (!scope) {
        throw new Error("Dashboard scope is not resolved yet");
      }
      return dashboardApi.deleteS3LifecyclePolicy(scope, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["dashboard", "policy", "actions"],
      });
    },
  });
}
