export type EC2Metric = "cost" | "usage" | "instances";

export type EC2CostBasis = "billed_cost" | "effective_cost" | "amortized_cost";

export type EC2UsageMetric = "cpu" | "network_in" | "network_out" | "disk_read" | "disk_write";
export type EC2Aggregation = "avg" | "max" | "p95";
export type EC2ChartType = "line" | "stacked_bar";
export type EC2Condition = "all" | "idle" | "underutilized" | "overutilized" | "uncovered";
export type EC2State = "running" | "stopped" | "terminated";
export type EC2GroupBy =
  | "none"
  | "region"
  | "instance-type"
  | "reservation-type"
  | "usage-category"
  | "cost-category"
  | "tag";

export type EC2ScopeFilters = {
  region: string[];
  tags: string[];
};

export type EC2Thresholds = {
  cpuMin: string;
  cpuMax: string;
  costMin: string;
  costMax: string;
  networkMin: string;
  networkMax: string;
};

export type EC2ExplorerControlsState = {
  metric: EC2Metric;
  costBasis: EC2CostBasis;
  usageMetric: EC2UsageMetric;
  usageAggregation: EC2Aggregation;
  chartType: EC2ChartType;
  instancesCondition: EC2Condition;
  instancesState: EC2State;
  instanceType: string;
  groupBy: EC2GroupBy;
  groupByValues: string[];
  scopeFilters: EC2ScopeFilters;
  thresholds: EC2Thresholds;
};

export const METRIC_OPTIONS: Array<{ key: EC2Metric; label: string }> = [
  { key: "cost", label: "Cost" },
  { key: "usage", label: "Usage" },
  { key: "instances", label: "Instances" },
];

export const COST_BASIS_OPTIONS: Array<{ key: EC2CostBasis; label: string }> = [
  { key: "billed_cost", label: "Billed Cost" },
  { key: "effective_cost", label: "Effective Cost" },
  { key: "amortized_cost", label: "Amortized Cost" },
];

export const USAGE_METRIC_OPTIONS: Array<{ key: EC2UsageMetric; label: string }> = [
  { key: "cpu", label: "CPU" },
  { key: "network_in", label: "Network In" },
  { key: "network_out", label: "Network Out" },
  { key: "disk_read", label: "Disk Read" },
  { key: "disk_write", label: "Disk Write" },
];

export const AGGREGATION_OPTIONS: Array<{ key: EC2Aggregation; label: string }> = [
  { key: "avg", label: "Avg" },
  { key: "max", label: "Max" },
  { key: "p95", label: "P95" },
];

export const CHART_TYPE_OPTIONS: Array<{ key: EC2ChartType; label: string }> = [
  { key: "line", label: "Line" },
  { key: "stacked_bar", label: "Stacked Bar" },
];

export const CONDITION_OPTIONS: Array<{ key: EC2Condition; label: string }> = [
  { key: "all", label: "All" },
  { key: "idle", label: "Idle" },
  { key: "underutilized", label: "Underutilized" },
  { key: "overutilized", label: "Overutilized" },
  { key: "uncovered", label: "Uncovered" },
];

export const STATE_OPTIONS: Array<{ key: EC2State; label: string }> = [
  { key: "running", label: "Running" },
  { key: "stopped", label: "Stopped" },
  { key: "terminated", label: "Terminated" },
];

export const GROUP_BY_OPTIONS: Array<{ key: EC2GroupBy; label: string }> = [
  { key: "none", label: "None" },
  { key: "region", label: "Region" },
  { key: "instance-type", label: "Instance Type" },
  { key: "reservation-type", label: "Reservation Type" },
  { key: "usage-category", label: "Usage Category" },
  { key: "cost-category", label: "Cost Category" },
  { key: "tag", label: "Tag" },
];

export const INSTANCE_TYPE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All types" },
  { key: "t3.medium", label: "t3.medium" },
  { key: "m5.large", label: "m5.large" },
  { key: "m6i.large", label: "m6i.large" },
  { key: "c6i.xlarge", label: "c6i.xlarge" },
];

export const DEFAULT_SCOPE_FILTERS: EC2ScopeFilters = {
  region: [],
  tags: [],
};

export const DEFAULT_THRESHOLDS: EC2Thresholds = {
  cpuMin: "",
  cpuMax: "",
  costMin: "",
  costMax: "",
  networkMin: "",
  networkMax: "",
};

export const DEFAULT_EC2_EXPLORER_CONTROLS: EC2ExplorerControlsState = {
  metric: "cost",
  costBasis: "effective_cost",
  usageMetric: "cpu",
  usageAggregation: "avg",
  chartType: "line",
  instancesCondition: "all",
  instancesState: "running",
  instanceType: "all",
  groupBy: "reservation-type",
  groupByValues: [],
  scopeFilters: DEFAULT_SCOPE_FILTERS,
  thresholds: DEFAULT_THRESHOLDS,
};
