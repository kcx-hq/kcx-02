import type { DashboardScope } from "../dashboard.types.js";

export type S3UsageInsightsFilters = {
  xAxis?: "date" | "bucket" | "region" | "account";
  usageBy?: "bucket" | "operation_group" | "storage_class" | "operation";
  seriesBy?: string;
  compareBy?: "none" | "previous_period";
  yAxis?:
    | "storage_gb"
    | "request_count"
    | "transfer_gb"
    | "object_count"
    | "api_operations"
    | "storage_gb_month"
    | "retrieval_gb";
  usageYAxis?:
    | "storage_gb"
    | "request_count"
    | "transfer_gb"
    | "object_count"
    | "api_operations"
    | "storage_gb_mo"
    | "retrieval_gb";
  bucket?: string | null;
  region?: string[];
  account?: string[];
  storageClass?: string[];
};

export type S3UsageInsightsResponse = {
  section: "s3-usage-insights";
  kpis: {
    usageSummaryKpis: {
      totalStorageGb: number;
      totalRequests: number;
      totalTransferGb: number;
      totalObjectCount: number;
    };
  };
  bucketTable: Array<{
    bucketName: string;
    storageGb: number;
    transferGb: number;
    requestCount: number;
    objectCount: number;
    region: string;
    dominantUsageType: "Request Heavy" | "Storage Heavy" | "Transfer Heavy" | "Mixed Heavy";
  }>;
  chart: {
    breakdown: {
      labels: string[];
      series: Array<{
        name: string;
        values: number[];
      }>;
    };
  };
};

export type S3UsageInsightsRepositoryInput = {
  scope: DashboardScope;
  filters: S3UsageInsightsFilters;
};
