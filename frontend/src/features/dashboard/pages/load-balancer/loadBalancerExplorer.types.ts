export type LoadBalancerMetric = "cost" | "load_balancers";
export type LoadBalancerGranularity = "hourly" | "daily" | "monthly";
export type LoadBalancerChartType = "line" | "stacked_bar";
export type LoadBalancerGroupBy =
  | "cost_type"
  | "none"
  | "account"
  | "region"
  | "type"
  | "scheme"
  | "state"
  | "team"
  | "product"
  | "environment"
  | "tag"
  | "load_balancer";

export type LoadBalancerScopeFilters = {
  account: string[];
  region: string[];
  type: string[];
  scheme: string[];
  state: string[];
  team: string[];
  product: string[];
  environment: string[];
  tags: string[];
};

export type LoadBalancerExplorerControlsState = {
  metric: LoadBalancerMetric;
  granularity: LoadBalancerGranularity;
  groupBy: LoadBalancerGroupBy;
  groupByValues: string[];
  chartType: LoadBalancerChartType;
  tagKey: string;
  scopeFilters: LoadBalancerScopeFilters;
};

export const LOAD_BALANCER_METRIC_OPTIONS: Array<{ key: LoadBalancerMetric; label: string }> = [
  { key: "cost", label: "Cost" },
  { key: "load_balancers", label: "Load Balancers" },
];

export const LOAD_BALANCER_GRANULARITY_OPTIONS: Array<{ key: LoadBalancerGranularity; label: string }> = [
  { key: "hourly", label: "Hourly" },
  { key: "daily", label: "Daily" },
  { key: "monthly", label: "Monthly" },
];

export const LOAD_BALANCER_GROUP_BY_OPTIONS: Array<{ key: LoadBalancerGroupBy; label: string }> = [
  { key: "cost_type", label: "Cost Type" },
  { key: "none", label: "Daily Trend" },
  { key: "account", label: "Account" },
  { key: "region", label: "Region" },
  { key: "type", label: "Type" },
  { key: "scheme", label: "Scheme" },
  { key: "state", label: "State" },
  { key: "team", label: "Team" },
  { key: "product", label: "Product" },
  { key: "environment", label: "Environment" },
  { key: "tag", label: "Tag" },
  { key: "load_balancer", label: "Load Balancer" },
];

export const LOAD_BALANCER_DEFAULT_CONTROLS: LoadBalancerExplorerControlsState = {
  metric: "cost",
  granularity: "daily",
  groupBy: "cost_type",
  groupByValues: [],
  chartType: "stacked_bar",
  tagKey: "owner",
  scopeFilters: {
    account: [],
    region: [],
    type: [],
    scheme: [],
    state: [],
    team: [],
    product: [],
    environment: [],
    tags: [],
  },
};
