import type { S3CostInsightsResponse, S3UsageInsightsFiltersQuery } from "../../../../api/dashboardApi";

export type S3UsageFilterValue = {
  seriesBy: "bucket" | "operation_group" | "storage_class";
  seriesValue: string;
  category:
    | ""
    | "storage"
    | "data_transfer"
    | "request"
    | "object_count"
    | "api_operations"
    | "storage_gb_mo"
    | "retrieval_gb";
  compareMode: "none" | "previous_period";
  storageClass: string;
  xAxis: NonNullable<S3UsageInsightsFiltersQuery["xAxis"]>;
  yAxisMetric: "usage_quantity";
  chartType: "bar" | "line";
};

export type S3UsageFilterOptions = S3CostInsightsResponse["filterOptions"] | undefined;
