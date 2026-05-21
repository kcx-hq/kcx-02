import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  AnomaliesFiltersQuery,
  AnomaliesListResponse,
  BudgetDashboardResponse,
  BudgetUpsertPayload,
  BudgetActualForecastPoint,
  CostExplorerFiltersQuery,
  CostExplorerGroupOptionsResponse,
  CostExplorerResponse,
  CostHistoryFilterOptionsResponse,
  CostHistoryFiltersQuery,
  CostHistoryResponse,
  CostBreakdownItem,
  DashboardOverviewResponse,
  OverviewAnomaliesResponse,
  OverviewFiltersQuery,
  OverviewFiltersResponse,
  OverviewKpis,
  OverviewRecommendationsResponse,
  SavingsInsights,
  DashboardResolvedScope,
  DashboardScopeInput,
  DashboardSectionData,
  Ec2OptimizationSummaryFiltersQuery,
  Ec2OptimizationInstancesFiltersQuery,
  Ec2OptimizationSummaryResponse,
  Ec2OptimizationInstancesResponse,
  Ec2RecommendationsFiltersQuery,
  Ec2RecommendationsResponse,
  Ec2RecommendationStatus,
  Ec2ExplorerFiltersQuery,
  Ec2ExplorerResponse,
  Ec2CostExplorerV2FiltersQuery,
  Ec2CostExplorerV2Response,
  Ec2UsageExplorerV2FiltersQuery,
  Ec2UsageExplorerV2Response,
  Ec2DataTransferExplorerV2FiltersQuery,
  Ec2DataTransferExplorerV2Response,
  Ec2NetworkBreakdownResponse,
  Ec2DataTransferFiltersQuery,
  Ec2DataTransferResponse,
  Ec2ElasticIpFiltersQuery,
  Ec2ElasticIpResponse,
  LoadBalancerExplorerFiltersQuery,
  LoadBalancerExplorerSummaryResponse,
  LoadBalancerExplorerTrendResponse,
  LoadBalancerExplorerGroupByResponse,
  DatabaseExplorerFilters,
  DatabaseExplorerResponse,
  DatabaseAssetsFilters,
  DatabaseAssetsResponse,
  DatabaseAssetDetail,
  DatabaseRecommendationFilters,
  DatabaseRecommendationListResponse,
  DatabaseRecommendationSummary,
  DatabaseRecommendationDetail,
  GenerateDatabaseRecommendationsResult,

  S3CostInsightsFiltersQuery,
  S3UsageInsightsFiltersQuery,
  S3CostInsightsResponse,
  S3BucketDetailResponse,
  S3BucketLifecycleInsightResponse,
  S3LifecyclePolicyApplyRequest,
  S3LifecyclePolicyApplyResponse,
  S3LifecyclePolicyDeleteRequest,
  S3LifecyclePolicyDeleteResponse,
  S3PolicyActionHistoryResponse,
  S3OptimizationResponse,
  S3ReplicationDestinationBucketsResponse,
  S3ReplicationResponse,
  S3ReplicationRoleAutoCreateRequest,
  S3ReplicationRoleAutoCreateResponse,
  S3ReplicationSetupApplyResponse,
  S3ReplicationSetupPreviewResponse,
  S3ReplicationSetupRequest,
  OptimizationIdleOverview,
  OptimizationCommitmentOverview,
  OptimizationIdleRecommendationsResponse,
  OptimizationCommitmentRecommendationsResponse,
  OptimizationIdleRecommendationDetail,
  OptimizationCommitmentRecommendationDetail,
  OptimizationRightsizingOverview,
  OptimizationRecommendationFiltersQuery,
  OptimizationRecommendationsResponse,
  OptimizationRecommendationDetail,
  IdleActionExecuteResponse,
  IdleActionStatusResponse,
  RecommendationIgnoreResponse,
  RightsizingActionExecuteResponse,
  RightsizingActionStatusResponse,
} from "./dashboardTypes";
import { buildDashboardQueryParams } from "../utils/buildDashboardQueryParams";

function withDashboardQuery(
  path: string,
  scopeOrInput: DashboardScopeInput | DashboardResolvedScope,
): string {
  const query = buildDashboardQueryParams(scopeOrInput);
  return query.length > 0 ? `${path}?${query}` : path;
}

function withOverviewFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: OverviewFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));

  const appendArray = (key: string, values?: (string | number)[]) => {
    if (!Array.isArray(values) || values.length === 0) {
      return;
    }
    params.set(key, values.join(","));
  };

  if (filters?.billingPeriodStart) params.set("billingPeriodStart", filters.billingPeriodStart);
  if (filters?.billingPeriodEnd) params.set("billingPeriodEnd", filters.billingPeriodEnd);
  if (typeof filters?.forecastingEnabled === "boolean") {
    params.set("forecastingEnabled", String(filters.forecastingEnabled));
  }
  if (typeof filters?.page === "number") params.set("page", String(filters.page));
  if (typeof filters?.pageSize === "number") params.set("pageSize", String(filters.pageSize));
  if (filters?.sortBy) params.set("sortBy", filters.sortBy);
  if (filters?.sortOrder) params.set("sortOrder", filters.sortOrder);

  appendArray("accountKeys", filters?.accountKeys);
  appendArray("serviceKeys", filters?.serviceKeys);
  appendArray("regionKeys", filters?.regionKeys);
  appendArray("severity", filters?.severity);
  appendArray("status", filters?.status);

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withCostExplorerFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: CostExplorerFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));

  if (filters?.granularity) params.set("granularity", filters.granularity);
  if (filters?.groupBy) params.set("groupBy", filters.groupBy);
  if (filters?.metric) params.set("metric", filters.metric);
  if (typeof filters?.forecastingEnabled === "boolean") {
    params.set("forecastingEnabled", String(filters.forecastingEnabled));
  }
  if (typeof filters?.tagKey === "string" && filters.tagKey.trim().length > 0) {
    params.set("tagKey", filters.tagKey.trim().toLowerCase());
  }
  if (typeof filters?.tagValue === "string" && filters.tagValue.trim().length > 0) {
    params.set("tagValue", filters.tagValue.trim().toLowerCase());
  }
  if (Array.isArray(filters?.groupValues) && filters.groupValues.length > 0) {
    params.set("groupValues", filters.groupValues.join(","));
  }

  if (filters?.compareKey) {
    params.set("compareKey", filters.compareKey);
  } else if (filters?.compareKey === null) {
    params.delete("compareKey");
  }

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withCostExplorerGroupOptions(
  path: string,
  scope: DashboardResolvedScope,
  groupBy?: CostExplorerFiltersQuery["groupBy"],
  tagKey?: string | null,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  if (groupBy && groupBy.trim().length > 0) {
    params.set("groupBy", groupBy);
  }
  if (tagKey && tagKey.trim().length > 0) {
    params.set("tagKey", tagKey.trim().toLowerCase());
  }
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withCostHistoryFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: CostHistoryFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  // Avoid inheriting sticky drill-down keys from other dashboard pages.
  // Cost History should reflect the selected date/source scope unless
  // explicitly filtered by its own controls.
  params.delete("providerId");
  params.delete("billingAccountKey");
  params.delete("subAccountKey");
  params.delete("serviceKey");
  params.delete("regionKey");

  if (filters?.granularity) params.set("granularity", filters.granularity);
  if (filters?.groupBy) params.set("groupBy", filters.groupBy);
  if (filters?.xAxis) params.set("xAxis", filters.xAxis);
  if (filters?.yAxisMetric) params.set("yAxisMetric", filters.yAxisMetric);
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withDatabaseExplorerFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters: DatabaseExplorerFilters,
): string {
  const params = new URLSearchParams();

  if (scope.from) params.set("start_date", scope.from);
  if (scope.to) params.set("end_date", scope.to);
  if (filters.metric) params.set("metric", filters.metric);
  if (filters.groupBy) params.set("group_by", filters.groupBy);
  if (typeof filters.databaseScope === "string" && filters.databaseScope.trim().length > 0 && filters.databaseScope !== "all") {
    params.set("database_scope", filters.databaseScope.trim());
  }
  if (typeof filters.regionKey !== "undefined" && filters.regionKey !== null && String(filters.regionKey).trim().length > 0) {
    params.set("region_key", String(filters.regionKey).trim());
  }
  if (typeof filters.dbService === "string" && filters.dbService.trim().length > 0) {
    params.set("db_service", filters.dbService.trim());
  }
  if (typeof filters.dbEngine === "string" && filters.dbEngine.trim().length > 0) {
    params.set("db_engine", filters.dbEngine.trim());
  }
  if (typeof filters.cloudConnectionId === "string" && filters.cloudConnectionId.trim().length > 0) {
    params.set("cloud_connection_id", filters.cloudConnectionId.trim());
  }

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withDatabaseAssetsFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: DatabaseAssetsFilters,
): string {
  const params = new URLSearchParams();

  if (scope.from) params.set("start_date", scope.from);
  if (scope.to) params.set("end_date", scope.to);
  if (typeof filters?.cloudConnectionId === "string" && filters.cloudConnectionId.trim().length > 0) {
    params.set("cloud_connection_id", filters.cloudConnectionId.trim());
  }
  if (typeof filters?.regionKey === "string" && filters.regionKey.trim().length > 0) {
    params.set("region_key", filters.regionKey.trim());
  }
  if (typeof filters?.subAccountKey === "string" && filters.subAccountKey.trim().length > 0) {
    params.set("sub_account_key", filters.subAccountKey.trim());
  }
  if (typeof filters?.dbService === "string" && filters.dbService.trim().length > 0) {
    params.set("db_service", filters.dbService.trim());
  }
  if (typeof filters?.dbEngine === "string" && filters.dbEngine.trim().length > 0) {
    params.set("db_engine", filters.dbEngine.trim());
  }
  if (typeof filters?.instanceClass === "string" && filters.instanceClass.trim().length > 0) {
    params.set("instance_class", filters.instanceClass.trim());
  }
  if (typeof filters?.status === "string" && filters.status.trim().length > 0) {
    params.set("status", filters.status.trim());
  }
  if (typeof filters?.search === "string" && filters.search.trim().length > 0) {
    params.set("search", filters.search.trim());
  }
  if (typeof filters?.page === "number") {
    params.set("page", String(filters.page));
  }
  if (typeof filters?.pageSize === "number") {
    params.set("pageSize", String(filters.pageSize));
  }

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withDatabaseAssetDetailQuery(
  path: string,
  scope: DashboardResolvedScope,
  params: { cloudConnectionId: string; startDate?: string; endDate?: string },
): string {
  const query = new URLSearchParams();
  query.set("cloud_connection_id", params.cloudConnectionId);
  query.set("start_date", params.startDate ?? scope.from);
  query.set("end_date", params.endDate ?? scope.to);
  const queryString = query.toString();
  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

function withDatabaseRecommendationsFilters(path: string, filters?: DatabaseRecommendationFilters): string {
  const params = new URLSearchParams();
  if (typeof filters?.status === "string" && filters.status.trim().length > 0) params.set("status", filters.status.trim());
  if (typeof filters?.recommendationType === "string" && filters.recommendationType.trim().length > 0) {
    params.set("recommendation_type", filters.recommendationType.trim());
  }
  if (typeof filters?.confidence === "string" && filters.confidence.trim().length > 0) params.set("confidence", filters.confidence.trim());
  if (typeof filters?.evidenceLevel === "string" && filters.evidenceLevel.trim().length > 0) {
    params.set("evidence_level", filters.evidenceLevel.trim());
  }
  if (typeof filters?.resourceId === "string" && filters.resourceId.trim().length > 0) params.set("resource_id", filters.resourceId.trim());
  if (typeof filters?.cloudConnectionId === "string" && filters.cloudConnectionId.trim().length > 0) {
    params.set("cloud_connection_id", filters.cloudConnectionId.trim());
  }
  if (typeof filters?.region === "string" && filters.region.trim().length > 0) params.set("region", filters.region.trim());
  if (typeof filters?.engine === "string" && filters.engine.trim().length > 0) params.set("engine", filters.engine.trim());
  if (typeof filters?.resourceType === "string" && filters.resourceType.trim().length > 0) {
    params.set("resource_type", filters.resourceType.trim());
  }
  if (typeof filters?.search === "string" && filters.search.trim().length > 0) params.set("search", filters.search.trim());
  if (typeof filters?.page === "number") params.set("page", String(filters.page));
  if (typeof filters?.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters?.sortBy === "string" && filters.sortBy.trim().length > 0) params.set("sort_by", filters.sortBy.trim());
  if (typeof filters?.sortOrder === "string" && filters.sortOrder.trim().length > 0) params.set("sort_order", filters.sortOrder.trim());
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withDatabaseRecommendationSummaryFilters(
  path: string,
  filters?: Pick<DatabaseRecommendationFilters, "cloudConnectionId">,
): string {
  const params = new URLSearchParams();
  if (typeof filters?.cloudConnectionId === "string" && filters.cloudConnectionId.trim().length > 0) {
    params.set("cloud_connection_id", filters.cloudConnectionId.trim());
  }
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withOptimizationFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: OptimizationRecommendationFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  // Avoid inheriting unrelated scope filters (like serviceKey from other dashboard pages)
  // that can silently hide optimization recommendations.
  params.delete("providerId");
  params.delete("billingAccountKey");
  params.delete("subAccountKey");
  params.delete("serviceKey");
  params.delete("regionKey");

  const appendArray = (key: string, values?: (string | number)[]) => {
    if (!Array.isArray(values) || values.length === 0) {
      return;
    }
    params.set(key, values.join(","));
  };

  appendArray("status", filters?.status);
  appendArray("effort", filters?.effort);
  appendArray("risk", filters?.risk);
  appendArray("account", filters?.account);
  appendArray("region", filters?.region);
  appendArray("serviceKey", filters?.serviceKey);

  if (typeof filters?.page === "number") params.set("page", String(filters.page));
  if (typeof filters?.pageSize === "number") params.set("pageSize", String(filters.pageSize));

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withAnomaliesFilters(path: string, filters?: AnomaliesFiltersQuery): string {
  const params = new URLSearchParams();

  if (typeof filters?.billing_source_id === "number") params.set("billing_source_id", String(filters.billing_source_id));
  if (filters?.status) params.set("status", filters.status);
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.anomaly_type) params.set("anomaly_type", filters.anomaly_type);
  if (filters?.date_from) params.set("date_from", filters.date_from);
  if (filters?.date_to) params.set("date_to", filters.date_to);
  if (typeof filters?.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters?.offset === "number") params.set("offset", String(filters.offset));

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withAnomaliesAlertsFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: AnomaliesFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));

  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.anomaly_type) params.set("anomaly_type", filters.anomaly_type);
  if (filters?.date_from) params.set("date_from", filters.date_from);
  if (filters?.date_to) params.set("date_to", filters.date_to);
  if (typeof filters?.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters?.offset === "number") params.set("offset", String(filters.offset));

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withEc2OptimizationFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: Ec2OptimizationSummaryFiltersQuery | Ec2OptimizationInstancesFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));

  if (filters?.cloudConnectionId) params.set("cloud_connection_id", filters.cloudConnectionId);
  if (typeof filters?.billingSourceId === "number") params.set("billing_source_id", String(filters.billingSourceId));
  if (typeof filters?.regionKey === "number") params.set("region_key", String(filters.regionKey));
  if (typeof filters?.subAccountKey === "number") params.set("sub_account_key", String(filters.subAccountKey));
  if (filters?.recommendationType) params.set("recommendation_type", filters.recommendationType);
  if (filters?.region) params.set("region", filters.region);
  if (filters?.riskLevel) params.set("risk_level", filters.riskLevel);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);
  if (typeof filters?.page === "number") {
    params.set("page", String(filters.page));
  }
  if (typeof filters?.pageSize === "number") {
    params.set("page_size", String(filters.pageSize));
  }

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withEc2ExplorerFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters: Ec2ExplorerFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  const appendArray = (key: string, values?: Array<string | number>) => {
    if (!Array.isArray(values) || values.length === 0) return;
    params.set(key, values.join(","));
  };

  params.set("metric", filters.metric);
  params.set("groupBy", filters.groupBy);
  if (filters.granularity) params.set("granularity", filters.granularity);
  if (filters.volumeView) params.set("volumeView", filters.volumeView);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (typeof filters.tagKey === "string" && filters.tagKey.trim().length > 0) {
    params.set("tagKey", filters.tagKey.trim());
  }

  appendArray("regions", filters.regions);
  appendArray("tags", filters.tags);

  if (filters.costBasis) params.set("costBasis", filters.costBasis);
  if (filters.usageMetric) params.set("usageMetric", filters.usageMetric);
  if (filters.usageType) params.set("usageType", filters.usageType);
  if (filters.aggregation) params.set("aggregation", filters.aggregation);
  if (filters.condition) params.set("condition", filters.condition);
  appendArray("groupValues", filters.groupValues);

  if (typeof filters.minCost === "number") params.set("minCost", String(filters.minCost));
  if (typeof filters.maxCost === "number") params.set("maxCost", String(filters.maxCost));
  if (typeof filters.minCpu === "number") params.set("minCpu", String(filters.minCpu));
  if (typeof filters.maxCpu === "number") params.set("maxCpu", String(filters.maxCpu));
  if (typeof filters.minNetwork === "number") params.set("minNetwork", String(filters.minNetwork));
  if (typeof filters.maxNetwork === "number") params.set("maxNetwork", String(filters.maxNetwork));

  appendArray("states", filters.states);
  appendArray("instanceTypes", filters.instanceTypes);
  appendArray("teams", filters.teams);
  appendArray("products", filters.products);
  appendArray("environments", filters.environments);
  appendArray("accounts", filters.accounts);
  appendArray("volumeTypes", filters.volumeTypes);
  appendArray("volumeStatuses", filters.volumeStatuses);
  if (filters.volumeAttachment) params.set("volumeAttachment", filters.volumeAttachment);
  if (typeof filters.debugDataTransfer === "boolean") {
    params.set("debugDataTransfer", String(filters.debugDataTransfer));
  }

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withEc2CostExplorerV2Path(
  path: string,
  scope: DashboardResolvedScope,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withEc2RecommendationsFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: Ec2RecommendationsFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  // Prevent inherited dashboard keys (like subAccountKey/serviceKey) from being
  // interpreted as EC2 recommendation filters and accidentally hiding all rows.
  params.delete("providerId");
  params.delete("billingAccountKey");
  params.delete("subAccountKey");
  params.delete("serviceKey");
  params.delete("regionKey");

  if (filters?.cloudConnectionId) params.set("cloudConnectionId", filters.cloudConnectionId);
  if (typeof filters?.billingSourceId === "number") params.set("billingSourceId", String(filters.billingSourceId));
  if (filters?.category) params.set("category", filters.category);
  if (filters?.type) params.set("type", filters.type);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.account) params.set("account", filters.account);
  if (filters?.region) params.set("region", filters.region);
  if (filters?.team) params.set("team", filters.team);
  if (filters?.product) params.set("product", filters.product);
  if (filters?.environment) params.set("environment", filters.environment);
  if (filters?.service) params.set("service", filters.service);
  if (filters?.resourceType) params.set("resourceType", filters.resourceType);
  if (Array.isArray(filters?.tags) && filters.tags.length > 0) params.set("tags", filters.tags.join(","));
  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withEc2DataTransferFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: Ec2DataTransferFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  if (filters?.accountId) params.set("accountId", filters.accountId);
  if (filters?.region) params.set("region", filters.region);
  if (filters?.team) params.set("team", filters.team);
  if (filters?.product) params.set("product", filters.product);
  if (filters?.environment) params.set("environment", filters.environment);
  if (filters?.tagKey) params.set("tagKey", filters.tagKey);
  if (filters?.tagValue) params.set("tagValue", filters.tagValue);
  if (filters?.transferType) params.set("transferType", filters.transferType);
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withEc2ElasticIpFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: Ec2ElasticIpFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  if (filters?.startDate) params.set("startDate", filters.startDate);
  if (filters?.endDate) params.set("endDate", filters.endDate);
  if (filters?.accountId) params.set("accountId", filters.accountId);
  if (filters?.region) params.set("region", filters.region);
  if (filters?.state) params.set("state", filters.state);
  if (filters?.search) params.set("search", filters.search);
  if (typeof filters?.page === "number") params.set("page", String(filters.page));
  if (typeof filters?.pageSize === "number") params.set("pageSize", String(filters.pageSize));
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withLoadBalancerExplorerFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters: LoadBalancerExplorerFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  const appendArray = (key: string, values?: Array<string | number>) => {
    if (!Array.isArray(values) || values.length === 0) return;
    params.set(key, values.join(","));
  };

  params.set("metric", filters.metric);
  if (filters.usageType) params.set("usageType", filters.usageType);
  params.set("groupBy", filters.groupBy);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.granularity) params.set("granularity", filters.granularity);
  if (filters.tagKey) params.set("tagKey", filters.tagKey);
  if (filters.loadBalancerArn) params.set("loadBalancerArn", filters.loadBalancerArn);
  if (filters.accountId) params.set("accountId", filters.accountId);
  appendArray("regions", filters.regions);
  appendArray("types", filters.types);
  appendArray("schemes", filters.schemes);
  appendArray("states", filters.states);
  appendArray("teams", filters.teams);
  appendArray("products", filters.products);
  appendArray("environments", filters.environments);
  appendArray("tags", filters.tags);
  appendArray("groupValues", filters.groupValues);

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withS3CostInsightsFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: S3CostInsightsFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  const appendArray = (key: string, values?: string[]) => {
    if (!Array.isArray(values) || values.length === 0) return;
    params.set(key, values.join(","));
  };

  appendArray("costCategory", filters?.costCategory);
  appendArray("seriesValues", filters?.seriesValues);
  appendArray("storageClass", filters?.storageClass);
  appendArray("region", filters?.region);
  appendArray("account", filters?.account);
  if (typeof filters?.bucket === "string" && filters.bucket.trim().length > 0) {
    params.set("bucket", filters.bucket.trim());
  }
  if (filters?.costBy) {
    params.set("costBy", filters.costBy);
  }
  if (filters?.seriesBy) {
    params.set("seriesBy", filters.seriesBy);
  }
  if (filters?.usageBy) {
    params.set("usageBy", filters.usageBy);
  }
  if (filters?.yAxisMetric) {
    params.set("yAxisMetric", filters.yAxisMetric);
  }
  if (filters?.usageYAxis) {
    params.set("usageYAxis", filters.usageYAxis);
  }
  if (filters?.responseMode) {
    params.set("responseMode", filters.responseMode);
  }

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withS3UsageInsightsFilters(
  path: string,
  scope: DashboardResolvedScope,
  filters?: S3UsageInsightsFiltersQuery,
): string {
  const params = new URLSearchParams(buildDashboardQueryParams(scope));
  const appendArray = (key: string, values?: string[]) => {
    if (!Array.isArray(values) || values.length === 0) return;
    params.set(key, values.join(","));
  };

  appendArray("region", filters?.region);
  appendArray("account", filters?.account);
  appendArray("seriesValues", filters?.seriesValues);
  if (typeof filters?.bucket === "string" && filters.bucket.trim().length > 0) {
    params.set("bucket", filters.bucket.trim());
  }
  if (filters?.xAxis) params.set("xAxis", filters.xAxis);
  if (filters?.usageBy) params.set("usageBy", filters.usageBy);
  if (filters?.yAxis) params.set("yAxis", filters.yAxis);
  if (filters?.compareBy) params.set("compareBy", filters.compareBy);

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

export const dashboardApi = {
  getScope(scopeInput: DashboardScopeInput) {
    return apiGet<DashboardResolvedScope>(withDashboardQuery("/dashboard/scope", scopeInput));
  },

  getOverview(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<DashboardOverviewResponse>(withOverviewFilters("/dashboard/overview", scope, filters));
  },

  getOverviewKpis(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<OverviewKpis>(withOverviewFilters("/dashboard/overview/kpis", scope, filters));
  },

  getOverviewBudgetVsActualForecast(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<{ items: BudgetActualForecastPoint[] }>(
      withOverviewFilters("/dashboard/overview/budget-vs-actual-forecast", scope, filters),
    );
  },

  getOverviewTopServices(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<{ items: CostBreakdownItem[] }>(withOverviewFilters("/dashboard/overview/top-services", scope, filters));
  },

  getOverviewTopAccounts(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<{ items: CostBreakdownItem[] }>(withOverviewFilters("/dashboard/overview/top-accounts", scope, filters));
  },

  getOverviewTopRegions(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<{ items: CostBreakdownItem[] }>(withOverviewFilters("/dashboard/overview/top-regions", scope, filters));
  },

  getOverviewSavingsInsights(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<SavingsInsights>(withOverviewFilters("/dashboard/overview/savings-insights", scope, filters));
  },

  getOverviewAnomalies(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<OverviewAnomaliesResponse>(withOverviewFilters("/dashboard/overview/anomalies", scope, filters));
  },

  getOverviewRecommendations(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<OverviewRecommendationsResponse>(
      withOverviewFilters("/dashboard/overview/recommendations", scope, filters),
    );
  },

  getDashboardFilters(scope: DashboardResolvedScope, filters?: OverviewFiltersQuery) {
    return apiGet<OverviewFiltersResponse>(withOverviewFilters("/dashboard/filters", scope, filters));
  },

  getCostExplorer(scope: DashboardResolvedScope, filters?: CostExplorerFiltersQuery) {
    return apiGet<CostExplorerResponse>(withCostExplorerFilters("/dashboard/cost-explorer", scope, filters));
  },

  getCostExplorerGroupOptions(
    scope: DashboardResolvedScope,
    groupBy?: CostExplorerFiltersQuery["groupBy"],
    tagKey?: string | null,
  ) {
    return apiGet<CostExplorerGroupOptionsResponse>(
      withCostExplorerGroupOptions("/dashboard/cost-explorer/group-options", scope, groupBy, tagKey),
    );
  },

  getCostHistory(scope: DashboardResolvedScope, filters?: CostHistoryFiltersQuery) {
    return apiGet<CostHistoryResponse>(withCostHistoryFilters("/dashboard/cost-history", scope, filters));
  },

  getCostHistoryFilterOptions(scope: DashboardResolvedScope) {
    return apiGet<CostHistoryFilterOptionsResponse>(withDashboardQuery("/dashboard/cost-history/filters", scope));
  },

  getDatabaseExplorer(scope: DashboardResolvedScope, filters: DatabaseExplorerFilters) {
    return apiGet<DatabaseExplorerResponse>(
      withDatabaseExplorerFilters("/services/database/explorer", scope, filters),
    );
  },
  getDatabaseAssets(scope: DashboardResolvedScope, filters?: DatabaseAssetsFilters) {
    return apiGet<DatabaseAssetsResponse>(withDatabaseAssetsFilters("/services/database/assets", scope, filters));
  },
  getDatabaseAssetDetail(
    scope: DashboardResolvedScope,
    resourceId: string,
    params: { cloudConnectionId: string; startDate?: string; endDate?: string },
  ) {
    return apiGet<DatabaseAssetDetail>(
      withDatabaseAssetDetailQuery(`/services/database/assets/${encodeURIComponent(resourceId)}/details`, scope, params),
    );
  },
  listDatabaseRecommendations(_scope: DashboardResolvedScope, filters?: DatabaseRecommendationFilters) {
    return apiGet<DatabaseRecommendationListResponse>(withDatabaseRecommendationsFilters("/services/database/recommendations", filters));
  },
  getDatabaseRecommendationSummary(
    _scope: DashboardResolvedScope,
    filters?: Pick<DatabaseRecommendationFilters, "cloudConnectionId">,
  ) {
    return apiGet<DatabaseRecommendationSummary>(
      withDatabaseRecommendationSummaryFilters("/services/database/recommendations/summary", filters),
    );
  },
  getDatabaseRecommendationDetail(_scope: DashboardResolvedScope, id: string) {
    return apiGet<DatabaseRecommendationDetail>(`/services/database/recommendations/${encodeURIComponent(id)}`);
  },
  generateDatabaseRecommendations(
    _scope: DashboardResolvedScope,
    payload?: { cloudConnectionId?: string; billingSourceId?: number },
  ) {
    const body: { cloudConnectionId?: string; billingSourceId?: number } = {};
    if (typeof payload?.cloudConnectionId === "string" && payload.cloudConnectionId.trim().length > 0) {
      body.cloudConnectionId = payload.cloudConnectionId.trim();
    }
    if (typeof payload?.billingSourceId === "number") body.billingSourceId = payload.billingSourceId;
    return apiPost<GenerateDatabaseRecommendationsResult>("/services/database/recommendations/generate", body);
  },

  getResources(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/resources", scope));
  },

  getAllocation(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/allocation", scope));
  },

  getOptimization(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/optimization", scope));
  },

  getOptimizationRightsizingOverview(scope: DashboardResolvedScope) {
    return apiGet<OptimizationRightsizingOverview>(
      withDashboardQuery("/dashboard/optimization/rightsizing/overview", scope),
    );
  },

  getOptimizationRightsizingRecommendations(scope: DashboardResolvedScope, filters?: OptimizationRecommendationFiltersQuery) {
    return apiGet<OptimizationRecommendationsResponse>(
      withOptimizationFilters("/dashboard/optimization/rightsizing/recommendations", scope, filters),
    );
  },

  getOptimizationRightsizingRecommendationDetail(scope: DashboardResolvedScope, recommendationId: string) {
    return apiGet<OptimizationRecommendationDetail>(
      withDashboardQuery(`/dashboard/optimization/rightsizing/recommendations/${recommendationId}`, scope),
    );
  },

  executeOptimizationRightsizingRecommendation(
    scope: DashboardResolvedScope,
    recommendationId: string,
    payload?: { dryRun?: boolean; idempotencyKey?: string },
  ) {
    return apiPost<RightsizingActionExecuteResponse>(
      withDashboardQuery(`/dashboard/optimization/rightsizing/recommendations/${recommendationId}/execute`, scope),
      payload ?? {},
    );
  },

  getOptimizationRightsizingActionStatus(scope: DashboardResolvedScope, actionId: string) {
    return apiGet<RightsizingActionStatusResponse>(
      withDashboardQuery(`/dashboard/optimization/rightsizing/actions/${actionId}`, scope),
    );
  },

  ignoreOptimizationRightsizingRecommendation(scope: DashboardResolvedScope, recommendationId: string) {
    return apiPost<RecommendationIgnoreResponse>(
      withDashboardQuery(`/dashboard/optimization/rightsizing/recommendations/${recommendationId}/ignore`, scope),
      {},
    );
  },

  getOptimizationIdleOverview(scope: DashboardResolvedScope) {
    return apiGet<OptimizationIdleOverview>(
      withDashboardQuery("/dashboard/optimization/idle/overview", scope),
    );
  },

  getOptimizationIdleRecommendations(scope: DashboardResolvedScope, filters?: OptimizationRecommendationFiltersQuery) {
    return apiGet<OptimizationIdleRecommendationsResponse>(
      withOptimizationFilters("/dashboard/optimization/idle/recommendations", scope, filters),
    );
  },

  getOptimizationIdleRecommendationDetail(scope: DashboardResolvedScope, recommendationId: string) {
    return apiGet<OptimizationIdleRecommendationDetail>(
      withDashboardQuery(`/dashboard/optimization/idle/recommendations/${recommendationId}`, scope),
    );
  },

  executeOptimizationIdleRecommendation(
    scope: DashboardResolvedScope,
    recommendationId: string,
    payload?: { dryRun?: boolean; idempotencyKey?: string },
  ) {
    return apiPost<IdleActionExecuteResponse>(
      withDashboardQuery(`/dashboard/optimization/idle/recommendations/${recommendationId}/execute`, scope),
      payload ?? {},
    );
  },

  getOptimizationIdleActionStatus(scope: DashboardResolvedScope, actionId: string) {
    return apiGet<IdleActionStatusResponse>(
      withDashboardQuery(`/dashboard/optimization/idle/actions/${actionId}`, scope),
    );
  },

  ignoreOptimizationIdleRecommendation(scope: DashboardResolvedScope, recommendationId: string) {
    return apiPost<RecommendationIgnoreResponse>(
      withDashboardQuery(`/dashboard/optimization/idle/recommendations/${recommendationId}/ignore`, scope),
      {},
    );
  },

  getOptimizationCommitmentOverview(scope: DashboardResolvedScope) {
    return apiGet<OptimizationCommitmentOverview>(
      withDashboardQuery("/dashboard/optimization/commitment/overview", scope),
    );
  },

  getOptimizationCommitmentRecommendations(
    scope: DashboardResolvedScope,
    filters?: OptimizationRecommendationFiltersQuery,
  ) {
    return apiGet<OptimizationCommitmentRecommendationsResponse>(
      withOptimizationFilters("/dashboard/optimization/commitment/recommendations", scope, filters),
    );
  },

  getOptimizationCommitmentRecommendationDetail(scope: DashboardResolvedScope, recommendationId: string) {
    return apiGet<OptimizationCommitmentRecommendationDetail>(
      withDashboardQuery(`/dashboard/optimization/commitment/recommendations/${recommendationId}`, scope),
    );
  },

  getAnomalies(filters?: AnomaliesFiltersQuery) {
    return apiGet<AnomaliesListResponse>(withAnomaliesFilters("/anomalies", filters));
  },

  getAnomaliesAlerts(scope: DashboardResolvedScope, filters?: AnomaliesFiltersQuery) {
    return apiGet<AnomaliesListResponse>(withAnomaliesAlertsFilters("/dashboard/anomalies-alerts", scope, filters));
  },

  getBudget(scope: DashboardResolvedScope) {
    return apiGet<BudgetDashboardResponse>(withDashboardQuery("/dashboard/budget", scope));
  },

  createBudget(scope: DashboardResolvedScope, payload: BudgetUpsertPayload) {
    return apiPost<BudgetDashboardResponse["items"][number]>(withDashboardQuery("/dashboard/budget", scope), payload);
  },

  updateBudget(scope: DashboardResolvedScope, budgetId: string, payload: BudgetUpsertPayload) {
    return apiPatch<BudgetDashboardResponse["items"][number]>(
      withDashboardQuery(`/dashboard/budget/${budgetId}`, scope),
      payload,
    );
  },

  updateBudgetStatus(scope: DashboardResolvedScope, budgetId: string, status: "active" | "inactive") {
    return apiPatch<BudgetDashboardResponse["items"][number]>(
      withDashboardQuery(`/dashboard/budget/${budgetId}/status`, scope),
      { status },
    );
  },

  getReport(scope: DashboardResolvedScope) {
    return apiGet<DashboardSectionData>(withDashboardQuery("/dashboard/report", scope));
  },

  getEc2OptimizationSummary(scope: DashboardResolvedScope, filters?: Ec2OptimizationSummaryFiltersQuery) {
    return apiGet<Ec2OptimizationSummaryResponse>(
      withEc2OptimizationFilters("/dashboard/ec2/optimization/summary", scope, filters),
    );
  },
  getEc2OptimizationInstances(scope: DashboardResolvedScope, filters?: Ec2OptimizationInstancesFiltersQuery) {
    return apiGet<Ec2OptimizationInstancesResponse>(
      withEc2OptimizationFilters("/dashboard/ec2/optimization/instances", scope, filters),
    );
  },
  getEc2Recommendations(scope: DashboardResolvedScope, filters?: Ec2RecommendationsFiltersQuery) {
    return apiGet<Ec2RecommendationsResponse>(
      withEc2RecommendationsFilters("/dashboard/ec2/recommendations", scope, filters),
    );
  },
  refreshEc2Recommendations(scope: DashboardResolvedScope, payload?: Partial<Ec2RecommendationsFiltersQuery>) {
    return apiPost<{ created: number; updated: number; resolved: number }>(
      withDashboardQuery("/dashboard/ec2/recommendations/refresh", scope),
      payload ?? {},
    );
  },
  updateEc2RecommendationStatus(
    scope: DashboardResolvedScope,
    recommendationId: number,
    payload: { status: Ec2RecommendationStatus; reason?: string | null; snoozed_until?: string | null },
  ) {
    return apiPatch<{ id: number; status: Ec2RecommendationStatus; statusReason?: string | null; snoozedUntil?: string | null }>(
      withDashboardQuery(`/dashboard/ec2/recommendations/${recommendationId}/status`, scope),
      payload,
    );
  },
  getEc2Explorer(scope: DashboardResolvedScope, filters: Ec2ExplorerFiltersQuery) {
    return apiGet<Ec2ExplorerResponse>(withEc2ExplorerFilters("/dashboard/ec2/explorer", scope, filters));
  },
  getEc2CostExplorerV2(scope: DashboardResolvedScope, filters: Ec2CostExplorerV2FiltersQuery) {
    return apiPost<Ec2CostExplorerV2Response>(
      withEc2CostExplorerV2Path("/ec2/explorer/cost", scope),
      {
        startDate: filters.startDate,
        endDate: filters.endDate,
        granularity: filters.granularity ?? "daily",
        costBasis: filters.costBasis ?? "gross_cost",
        groupBy: filters.groupBy ?? "none",
        tagKey: filters.tagKey ?? null,
        compare: filters.compare ?? "none",
        accountIds: filters.accountIds ?? [],
        regions: filters.regions ?? [],
        instanceTypes: filters.instanceTypes ?? [],
        reservationTypes: filters.reservationTypes ?? [],
        costTypes: filters.costTypes ?? [],
        tags: filters.tags ?? [],
      },
    );
  },
  getEc2UsageExplorerV2(scope: DashboardResolvedScope, filters: Ec2UsageExplorerV2FiltersQuery) {
    return apiPost<Ec2UsageExplorerV2Response>(
      withEc2CostExplorerV2Path("/ec2/explorer/usage", scope),
      {
        startDate: filters.startDate,
        endDate: filters.endDate,
        granularity: filters.granularity ?? "daily",
        usageMetric: filters.usageMetric ?? "cpu",
        aggregation: filters.aggregation ?? "avg",
        groupBy: filters.groupBy ?? "none",
        tagKey: filters.tagKey ?? null,
        compare: filters.compare ?? "none",
        accountIds: filters.accountIds ?? [],
        regions: filters.regions ?? [],
        instanceTypes: filters.instanceTypes ?? [],
        tags: filters.tags ?? [],
      },
    );
  },
  getEc2DataTransferExplorerV2(scope: DashboardResolvedScope, filters: Ec2DataTransferExplorerV2FiltersQuery) {
    return apiPost<Ec2DataTransferExplorerV2Response>(
      withEc2CostExplorerV2Path("/ec2/explorer/data-transfer", scope),
      {
        startDate: filters.startDate,
        endDate: filters.endDate,
        granularity: filters.granularity ?? "daily",
        yAxis: filters.yAxis ?? "transfer_cost",
        groupBy: filters.groupBy ?? "none",
        tagKey: filters.tagKey ?? null,
        compare: filters.compare ?? "none",
        accountIds: filters.accountIds ?? [],
        regions: filters.regions ?? [],
        instanceTypes: filters.instanceTypes ?? [],
        transferTypes: filters.transferTypes ?? [],
        tags: filters.tags ?? [],
      },
    );
  },
  getEc2ExplorerNetworkBreakdown(scope: DashboardResolvedScope, filters: Ec2ExplorerFiltersQuery) {
    return apiGet<Ec2NetworkBreakdownResponse>(withEc2ExplorerFilters("/dashboard/ec2/explorer/network-breakdown", scope, filters));
  },
  getEc2DataTransfer(scope: DashboardResolvedScope, filters?: Ec2DataTransferFiltersQuery) {
    return apiGet<Ec2DataTransferResponse>(withEc2DataTransferFilters("/dashboard/ec2/data-transfer", scope, filters));
  },
  getEc2ElasticIps(scope: DashboardResolvedScope, filters?: Ec2ElasticIpFiltersQuery) {
    return apiGet<Ec2ElasticIpResponse>(withEc2ElasticIpFilters("/dashboard/ec2/elastic-ips", scope, filters));
  },
  getLoadBalancerExplorerSummary(scope: DashboardResolvedScope, filters: LoadBalancerExplorerFiltersQuery) {
    return apiGet<LoadBalancerExplorerSummaryResponse>(
      withLoadBalancerExplorerFilters("/dashboard/load-balancer/explorer/summary", scope, filters),
    );
  },
  getLoadBalancerExplorerTrend(scope: DashboardResolvedScope, filters: LoadBalancerExplorerFiltersQuery) {
    return apiGet<LoadBalancerExplorerTrendResponse>(
      withLoadBalancerExplorerFilters("/dashboard/load-balancer/explorer/trend", scope, filters),
    );
  },
  getLoadBalancerExplorerGroupBy(scope: DashboardResolvedScope, filters: LoadBalancerExplorerFiltersQuery) {
    return apiGet<LoadBalancerExplorerGroupByResponse>(
      withLoadBalancerExplorerFilters("/dashboard/load-balancer/explorer/group-by", scope, filters),
    );
  },
  getS3CostInsights(scope: DashboardResolvedScope, filters?: S3CostInsightsFiltersQuery, init?: RequestInit) {
    return apiGet<S3CostInsightsResponse>(withS3CostInsightsFilters("/dashboard/s3/cost-insights", scope, filters), init);
  },
  getS3UsageInsights(scope: DashboardResolvedScope, filters?: S3UsageInsightsFiltersQuery, init?: RequestInit) {
    return apiGet<S3CostInsightsResponse>(withS3UsageInsightsFilters("/dashboard/s3/usage-insights", scope, filters), init);
  },
  getS3BucketDetail(scope: DashboardResolvedScope, bucketName: string, init?: RequestInit) {
    return apiGet<S3BucketDetailResponse>(
      withDashboardQuery(`/dashboard/s3/buckets/${encodeURIComponent(bucketName)}/detail`, scope),
      init,
    ).then((response) => {
      console.log("NEW BUCKET DETAIL RESPONSE", response);
      return response;
    });
  },
  getS3Optimization(scope: DashboardResolvedScope) {
    return apiGet<S3OptimizationResponse>(withDashboardQuery("/dashboard/s3/optimization", scope));
  },
  getS3Replication(scope: DashboardResolvedScope) {
    return apiGet<S3ReplicationResponse>(withDashboardQuery("/dashboard/s3/replication", scope));
  },
  getS3ReplicationDestinationBuckets(scope: DashboardResolvedScope, sourceBucketName: string) {
    const params = new URLSearchParams(buildDashboardQueryParams(scope));
    params.set("sourceBucketName", sourceBucketName);
    return apiGet<S3ReplicationDestinationBucketsResponse>(`/dashboard/s3/replication/destination-buckets?${params.toString()}`);
  },
  previewS3ReplicationSetup(scope: DashboardResolvedScope, payload: S3ReplicationSetupRequest) {
    return apiPost<S3ReplicationSetupPreviewResponse>(
      withDashboardQuery("/dashboard/s3/replication/setup/preview", scope),
      payload,
    );
  },
  applyS3ReplicationSetup(scope: DashboardResolvedScope, payload: S3ReplicationSetupRequest) {
    return apiPost<S3ReplicationSetupApplyResponse>(
      withDashboardQuery("/dashboard/s3/replication/setup/apply", scope),
      payload,
    );
  },
  autoCreateS3ReplicationRole(scope: DashboardResolvedScope, payload: S3ReplicationRoleAutoCreateRequest) {
    return apiPost<S3ReplicationRoleAutoCreateResponse>(
      withDashboardQuery("/dashboard/s3/replication/role/auto-create", scope),
      payload,
    );
  },

  getS3BucketLifecycleInsight(scope: DashboardResolvedScope, bucketName: string) {
    const params = new URLSearchParams(buildDashboardQueryParams(scope));
    params.set("bucket", bucketName);
    const query = params.toString();
    return apiGet<S3BucketLifecycleInsightResponse>(`/dashboard/s3/usage/bucket-lifecycle-insight?${query}`);
  },
  applyS3LifecyclePolicy(scope: DashboardResolvedScope, payload: S3LifecyclePolicyApplyRequest) {
    return apiPost<S3LifecyclePolicyApplyResponse>(withDashboardQuery("/dashboard/s3/lifecycle-policy", scope), payload);
  },
  deleteS3LifecyclePolicy(scope: DashboardResolvedScope, payload: S3LifecyclePolicyDeleteRequest) {
    return apiPost<S3LifecyclePolicyDeleteResponse>(withDashboardQuery("/dashboard/s3/lifecycle-policy/delete", scope), payload);
  },
  getPolicyActionHistory(scope: DashboardResolvedScope) {
    return apiGet<S3PolicyActionHistoryResponse>(withDashboardQuery("/dashboard/policy/actions", scope));
  },
};

export type {
  BudgetActualForecastPoint,
  AnomalyRecord,
  AnomaliesFiltersQuery,
  AnomaliesListResponse,
  BudgetDashboardResponse,
  BudgetItem,
  BudgetStatus,
  BudgetUpsertPayload,
  CostExplorerBreakdownRow,
  CostExplorerCompareKey,
  CostExplorerFiltersQuery,
  CostExplorerGranularity,
  CostExplorerGroupBy,
  CostExplorerMetric,
  CostExplorerResponse,
  CostExplorerSeries,
  CostHistoryFilterOptionsResponse,
  CostHistoryFiltersQuery,
  CostHistoryGranularity,
  CostHistoryGroupBy,
  CostHistoryResponse,
  CostHistoryXAxis,
  CostHistoryYAxisMetric,
  CostBreakdownItem,
  DatabaseExplorerAppliedFilters,
  DatabaseExplorerCards,
  DatabaseExplorerCostTrendItem,
  DatabaseExplorerFilters,
  DatabaseExplorerGroupBy,
  DatabaseExplorerMetric,
  DatabaseExplorerResponse,
  DatabaseExplorerTableRow,
  DatabaseExplorerUsageTrendItem,
  DatabaseAssetsFilters,
  DatabaseAssetDetail,
  DatabaseAssetsResponse,
  DatabaseRecommendationFilters,
  DatabaseRecommendationType,
  DatabaseRecommendationConfidence,
  DatabaseRecommendationEvidenceLevel,
  DatabaseRecommendationListItem,
  DatabaseRecommendationListResponse,
  DatabaseRecommendationSummary,
  DatabaseRecommendationDetail,
  GenerateDatabaseRecommendationsResult,
  DashboardOverviewResponse,
  OverviewAnomaliesResponse,
  OverviewAnomaly,
  OverviewFiltersQuery,
  OverviewFiltersResponse,
  OverviewKpis,
  OverviewRecommendation,
  OverviewRecommendationsResponse,
  OverviewSortOrder,
  SavingsInsights,
  DashboardResolvedScope,
  DashboardScopeInput,
  DashboardSectionData,
  Ec2OptimizationSummaryFiltersQuery,
  Ec2OptimizationInstancesFiltersQuery,
  Ec2OptimizationSummaryResponse,
  Ec2OptimizationInstancesResponse,
  Ec2RecommendationsFiltersQuery,
  Ec2RecommendationsResponse,
  Ec2RecommendationStatus,
  Ec2ExplorerMetric,
  Ec2ExplorerGroupBy,
  Ec2ExplorerCostBasis,
  Ec2ExplorerUsageMetric,
  Ec2ExplorerAggregation,
  Ec2ExplorerCondition,
  Ec2ExplorerFiltersQuery,
  Ec2ExplorerResponse,
  Ec2CostExplorerV2Granularity,
  Ec2CostExplorerV2CostBasis,
  Ec2CostExplorerV2GroupBy,
  Ec2CostExplorerV2Compare,
  Ec2CostExplorerV2FiltersQuery,
  Ec2CostExplorerV2Response,
  Ec2UsageExplorerV2Granularity,
  Ec2UsageExplorerV2UsageMetric,
  Ec2UsageExplorerV2Aggregation,
  Ec2UsageExplorerV2GroupBy,
  Ec2UsageExplorerV2Compare,
  Ec2UsageExplorerV2FiltersQuery,
  Ec2UsageExplorerV2Response,
  Ec2DataTransferExplorerV2FiltersQuery,
  Ec2DataTransferExplorerV2Response,
  Ec2NetworkBreakdownResponse,
  Ec2DataTransferFiltersQuery,
  Ec2DataTransferResponse,
  Ec2ElasticIpFiltersQuery,
  Ec2ElasticIpResponse,
  LoadBalancerExplorerMetric,
  LoadBalancerExplorerGroupBy,
  LoadBalancerExplorerGranularity,
  LoadBalancerExplorerFiltersQuery,
  LoadBalancerExplorerSummaryResponse,
  LoadBalancerExplorerTrendResponse,
  LoadBalancerExplorerGroupByResponse,
  S3CostInsightsFiltersQuery,
  S3UsageInsightsFiltersQuery,
  S3CostInsightsResponse,
  S3BucketDetailResponse,
  S3BucketLifecycleInsightResponse,
  S3OptimizationResponse,
  S3ReplicationDestinationBucketsResponse,
  S3ReplicationResponse,
  S3ReplicationRoleAutoCreateRequest,
  S3ReplicationRoleAutoCreateResponse,
  S3ReplicationSetupApplyResponse,
  S3ReplicationSetupPreviewResponse,
  S3ReplicationSetupRequest,
  S3LifecyclePolicyApplyRequest,
  S3LifecyclePolicyApplyResponse,
  S3LifecyclePolicyDeleteRequest,
  S3LifecyclePolicyDeleteResponse,
  S3PolicyActionHistoryResponse,
  OptimizationIdleOverview,
  OptimizationCommitmentOverview,
  OptimizationIdleRecommendationsResponse,
  OptimizationCommitmentRecommendationsResponse,
  OptimizationIdleRecommendationDetail,
  OptimizationCommitmentRecommendationDetail,
  OptimizationRightsizingOverview,
  OptimizationRecommendationFiltersQuery,
  OptimizationRecommendationsResponse,
  OptimizationRecommendationDetail,
  IdleActionExecuteResponse,
  IdleActionStatusResponse,
  RecommendationIgnoreResponse,
  RightsizingActionExecuteResponse,
  RightsizingActionStatusResponse,
} from "./dashboardTypes";
