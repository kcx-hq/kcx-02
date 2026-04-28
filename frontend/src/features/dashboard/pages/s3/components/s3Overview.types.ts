import type { S3CostInsightsFiltersQuery, S3CostInsightsResponse } from "../../../api/dashboardApi";

export type S3OverviewFilterValue = {
  seriesBy: NonNullable<S3CostInsightsFiltersQuery["seriesBy"]>;
  seriesValues: string[];
  storageClass: string[];
  region: string;
  costBy: NonNullable<S3CostInsightsFiltersQuery["costBy"]>;
  yAxisMetric: NonNullable<S3CostInsightsFiltersQuery["yAxisMetric"]>;
  chartType: "bar" | "line";
  compareMode: "none" | "previous_period";
};

export type S3OverviewFilterOptions = S3CostInsightsResponse["filterOptions"] | undefined;

export type S3OverviewSavedPreset = {
  id: string;
  name: string;
  value: S3OverviewFilterValue;
  updatedAt: string;
};
