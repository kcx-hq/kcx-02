export type LoadBalancerMetric = "cost" | "load_balancers" | "usage";
export type LoadBalancerGranularity = "hourly" | "daily" | "monthly";
export type LoadBalancerChartType = "line" | "stacked_bar";
export type LoadBalancerUsageType =
  | "requests"
  | "processed_gb"
  | "active_connections"
  | "new_connections"
  | "healthy_hosts"
  | "unhealthy_hosts"
  | "errors";
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
  usageType: LoadBalancerUsageType;
  granularity: LoadBalancerGranularity;
  groupBy: LoadBalancerGroupBy;
  groupByValues: string[];
  chartType: LoadBalancerChartType;
  tagKey: string;
  scopeFilters: LoadBalancerScopeFilters;
};

export const LOAD_BALANCER_USAGE_TYPE_OPTIONS: Array<{ key: LoadBalancerUsageType; label: string }> = [
  { key: "requests", label: "Requests" },
  { key: "processed_gb", label: "Processed GB" },
  { key: "active_connections", label: "Active Connections" },
  { key: "new_connections", label: "New Connections" },
  { key: "healthy_hosts", label: "Healthy Hosts" },
  { key: "unhealthy_hosts", label: "Unhealthy Hosts" },
  { key: "errors", label: "Errors" },
];

export const LOAD_BALANCER_METRIC_OPTIONS: Array<{ key: LoadBalancerMetric; label: string }> = [
  { key: "cost", label: "Cost" },
  { key: "load_balancers", label: "Load Balancers" },
  { key: "usage", label: "Usage" },
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

export const LOAD_BALANCER_COST_GROUP_BY_OPTIONS = LOAD_BALANCER_GROUP_BY_OPTIONS.filter((option) =>
  option.key === "cost_type" ||
  option.key === "account" ||
  option.key === "region" ||
  option.key === "type" ||
  option.key === "scheme" ||
  option.key === "tag" ||
  option.key === "load_balancer",
);

export const LOAD_BALANCER_COUNT_GROUP_BY_OPTIONS = LOAD_BALANCER_GROUP_BY_OPTIONS.filter((option) =>
  option.key === "account" ||
  option.key === "region" ||
  option.key === "type" ||
  option.key === "scheme" ||
  option.key === "state" ||
  option.key === "tag" ||
  option.key === "load_balancer",
);

export const LOAD_BALANCER_USAGE_GROUP_BY_OPTIONS = LOAD_BALANCER_GROUP_BY_OPTIONS.filter((option) =>
  option.key === "account" ||
  option.key === "region" ||
  option.key === "type" ||
  option.key === "scheme" ||
  option.key === "state" ||
  option.key === "tag" ||
  option.key === "load_balancer",
);

export const getDefaultLoadBalancerGroupByForMetric = (metric: LoadBalancerMetric): LoadBalancerGroupBy =>
  metric === "cost" ? "cost_type" : "type";

export const getLoadBalancerGroupByOptionsForMetric = (
  metric: LoadBalancerMetric,
): Array<{ key: LoadBalancerGroupBy; label: string }> =>
  metric === "cost"
    ? LOAD_BALANCER_COST_GROUP_BY_OPTIONS
    : metric === "usage"
      ? LOAD_BALANCER_USAGE_GROUP_BY_OPTIONS
      : LOAD_BALANCER_COUNT_GROUP_BY_OPTIONS;

export const isLoadBalancerGroupByAllowedForMetric = (
  groupBy: LoadBalancerGroupBy,
  metric: LoadBalancerMetric,
): boolean => getLoadBalancerGroupByOptionsForMetric(metric).some((option) => option.key === groupBy);

export const getValidLoadBalancerGroupByForMetric = (
  metric: LoadBalancerMetric,
  groupBy: LoadBalancerGroupBy,
): LoadBalancerGroupBy =>
  isLoadBalancerGroupByAllowedForMetric(groupBy, metric)
    ? groupBy
    : getDefaultLoadBalancerGroupByForMetric(metric);

export const LOAD_BALANCER_DEFAULT_CONTROLS: LoadBalancerExplorerControlsState = {
  metric: "cost",
  usageType: "requests",
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
