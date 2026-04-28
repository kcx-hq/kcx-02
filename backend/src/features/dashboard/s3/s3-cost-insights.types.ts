import type { DashboardScope } from "../dashboard.types.js";

export type S3CostBucketInsight = {
  bucketName: string;
  billedCost: number;
  effectiveCost: number;
};

export type S3CostTrendInsight = {
  usageStartTime: string;
  billedCost: number;
  effectiveCost: number;
};

export type S3CostFeatureTrendInsight = {
  usageStartTime: string;
  storage: number;
  requests: number;
  retrieval: number;
  transfer: number;
  bucket: number;
  bucketStorageClass: number;
  other: number;
  total: number;
};

export type S3CostChartBy = "date" | "bucket" | "region" | "account";
export type S3CostSeriesBy = "cost_category" | "usage_type" | "operation" | "product_family" | "bucket" | "storage_class";
export type S3CostYAxisMetric = "billed_cost" | "effective_cost" | "amortized_cost";
export type S3CostCategory =
  | "Storage"
  | "Request"
  | "Transfer"
  | "Retrieval"
  | "Other";

export type S3CostInsightsFilters = {
  costCategory: S3CostCategory[];
  seriesValues: string[];
  bucket: string | null;
  storageClass: string[];
  region: string[];
  account: string[];
  costBy: S3CostChartBy;
  seriesBy: S3CostSeriesBy;
  yAxisMetric: S3CostYAxisMetric;
};

export type S3CostBreakdownChart = {
  labels: string[];
  series: Array<{
    name: string;
    values: number[];
  }>;
};

export type S3CostBucketTableInsight = {
  bucketName: string;
  account: string;
  cost: number;
  storage: number;
  requests: number;
  transfer: number;
  region: string;
  owner: string;
  driver: string;
  savings: number;
  retrieval: number;
  other: number;
  trendPct: number;
};

export type S3CostCategoryTableInsight = {
  costCategory: S3CostCategory;
  cost: number;
  usageQuantity: number;
  pricingUnit: string;
  percentOfBucketCost: number;
};

export type S3UsageOperationTableInsight = {
  usageType: string;
  operation: string;
  cost: number;
  quantity: number;
  unit: string;
};

export type S3CostInsightsResponse = {
  section: "s3-cost-insights";
  title: "S3 Cost Insights";
  message: string;
  filtersApplied: {
    from: string;
    to: string;
    scopeType: DashboardScope["scopeType"];
    s3Filters: S3CostInsightsFilters;
  };
  columnsUsed: Array<
    | "service_name"
    | "billed_cost"
    | "effective_cost"
    | "usage_start_time"
    | "list_cost"
    | "usage_type"
    | "product_usage_type"
    | "operation"
    | "line_item_description"
    | "product_family"
    | "region_name"
    | "sub_account_name"
    | "tag_value"
  >;
  kpis: {
    totalS3Cost: number;
    monthToDateCost: number;
    effectiveCost: number;
  };
  bucketTable: S3CostBucketTableInsight[];
  costCategoryTable: S3CostCategoryTableInsight[];
  usageOperationTable: S3UsageOperationTableInsight[];
  chart: {
    bucketCosts: S3CostBucketInsight[];
    trend: S3CostTrendInsight[];
    featureTrend: S3CostFeatureTrendInsight[];
    breakdown: S3CostBreakdownChart;
  };
  filterOptions: {
    costCategory: S3CostCategory[];
    usageType: string[];
    operation: string[];
    productFamily: string[];
    bucket: string[];
    storageClass: string[];
    region: string[];
    account: string[];
    costBy: S3CostChartBy[];
    seriesBy: S3CostSeriesBy[];
    yAxisMetric: S3CostYAxisMetric[];
  };
};
