import type {
  CostHistoryFiltersQuery,
  CostHistoryGroupBy,
  CostHistoryXAxis,
  CostHistoryYAxisMetric,
} from "../../../api/dashboardTypes";

export const DEFAULT_COST_HISTORY_FILTERS: Required<CostHistoryFiltersQuery> = {
  granularity: "month",
  groupBy: "service",
  xAxis: "date",
  yAxisMetric: "billed_cost",
};

export const GROUP_LABELS: Record<CostHistoryGroupBy, string> = {
  service: "Service",
  region: "Region",
  team: "Team",
  app: "App",
  account: "Account",
  resource: "Resource",
  "service-category": "Service Category",
};

export const X_AXIS_LABELS: Record<CostHistoryXAxis, string> = {
  date: "Date",
  account: "Account",
  region: "Region",
};

export const Y_AXIS_LABELS: Record<CostHistoryYAxisMetric, string> = {
  billed_cost: "Billed Cost",
  effective_cost: "Effective Cost",
  amortized_cost: "Amortized Cost",
};
