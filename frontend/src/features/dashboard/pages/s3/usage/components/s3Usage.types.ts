import type { S3CostInsightsFiltersQuery, S3CostInsightsResponse } from "../../../../api/dashboardApi";

export type S3UsageFilterValue = {
  seriesBy: NonNullable<S3CostInsightsFiltersQuery["seriesBy"]>;
  seriesValue: string;
  category: "" | "storage" | "data_transfer" | "request" | "object_count";
  compareMode: "none" | "previous_period";
  storageClass: string;
  xAxis: NonNullable<S3CostInsightsFiltersQuery["costBy"]>;
  yAxisMetric: NonNullable<S3CostInsightsFiltersQuery["yAxisMetric"]>;
  chartType: "bar" | "line";
};

export type S3UsageFilterOptions = S3CostInsightsResponse["filterOptions"] | undefined;
