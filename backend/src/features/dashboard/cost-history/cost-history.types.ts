import type { DashboardScope } from "../dashboard.types.js";
import type {
  CostExplorerCompareKey,
  CostExplorerGranularity,
  CostExplorerGroupBy,
  CostExplorerGroupOptionsResponse,
  CostExplorerMetric,
  CostExplorerResponse,
} from "../cost-explorer/cost-explorer.types.js";

export type CostHistoryGranularity = "day" | "month";
export type CostHistoryXAxis = "date" | "account" | "region";
export type CostHistoryYAxisMetric = "billed_cost" | "effective_cost" | "amortized_cost";

export type CostHistoryGroupBy =
  | "service"
  | "region"
  | "team"
  | "app"
  | "account"
  | "resource"
  | "service-category";

export type CostHistoryFilters = {
  granularity: CostHistoryGranularity;
  groupBy: CostHistoryGroupBy;
  xAxis: CostHistoryXAxis;
  yAxisMetric: CostHistoryYAxisMetric;
};

export type CostHistoryChartLabel = {
  bucketStart: string;
  short: string;
  long: string;
};

export type CostHistorySeries = {
  name: string;
  kind: "primary" | "group" | "comparison";
  compareKey?: CostExplorerCompareKey;
  values: number[];
};

export type CostHistoryResponse = {
  section: "cost-history";
  title: "Cost History";
  message: string;
  filtersApplied: {
    scopeType: DashboardScope["scopeType"];
    from: string;
    to: string;
    granularity: CostHistoryGranularity;
    xAxis: CostHistoryXAxis;
    yAxisMetric: CostHistoryYAxisMetric;
    groupBy: CostHistoryGroupBy;
  };
  chart: {
    labels: CostHistoryChartLabel[];
    series: CostHistorySeries[];
  };
  source: {
    costExplorerGroupBy: CostExplorerGroupBy;
    costExplorerMetric: CostExplorerMetric;
    costExplorerGranularity: CostExplorerGranularity;
  };
};

export type CostHistoryFilterOptionsResponse = {
  granularity: Array<{ key: CostHistoryGranularity; label: string }>;
  xAxis: Array<{ key: CostHistoryXAxis; label: string }>;
  yAxis: Array<{ key: CostHistoryYAxisMetric; label: string }>;
  groupBy: Array<{ key: CostHistoryGroupBy; label: string }>;
  availableTagGroupBy: CostExplorerGroupOptionsResponse["tagKeyOptions"];
};

export type CostHistoryCeFilters = {
  granularity: CostExplorerGranularity;
  groupBy: CostExplorerGroupBy;
  metric: CostExplorerMetric;
  compareKey: CostExplorerCompareKey | null;
  tagKey: string | null;
  tagValue: string | null;
  groupValues: string[];
};

export type CostHistoryRepositoryPayload = {
  chartSource: CostExplorerResponse;
};
