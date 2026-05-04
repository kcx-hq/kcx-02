export type EC2Metric = "cost" | "usage" | "instances" | "volumes" | "data-transfer";
export type EC2Granularity = "hourly" | "daily" | "monthly";
export type EC2VolumeView = "storage" | "storage_hours" | "cost" | "count";

export type EC2CostBasis =
  | "billed_cost"
  | "effective_cost"
  | "amortized_cost"
  | "net_amortized_cost"
  | "net_unblended_cost";

export type EC2UsageType = "cpu" | "network" | "disk";
export type EC2Aggregation = "avg" | "max" | "p95";
export type EC2ChartType = "line" | "stacked_bar";
export type EC2Condition = "all" | "idle" | "underutilized" | "overutilized" | "uncovered";
export type EC2State = "running" | "stopped" | "terminated";
export type EC2GroupBy =
  | "none"
  | "region"
  | "account"
  | "availability-zone"
  | "instance-type"
  | "reservation-type"
  | "cost-category"
  | "usage-type"
  | "operation"
  | "instance-state"
  | "recommendation"
  | "volume"
  | "volume_type"
  | "attachment_state"
  | "instance"
  | "storage_tier"
  | "iops_tier"
  | "size_bucket"
  | "lifecycle_state"
  | "transfer-type"
  | "source-region"
  | "destination-region"
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
  usageType: EC2UsageType;
  usageAggregation: EC2Aggregation;
  chartType: EC2ChartType;
  instancesCondition: EC2Condition;
  instancesState: EC2State;
  instanceType: string;
  groupBy: EC2GroupBy;
  granularity: EC2Granularity;
  volumeView: EC2VolumeView;
  groupByValues: string[];
  scopeFilters: EC2ScopeFilters;
  thresholds: EC2Thresholds;
};

export const METRIC_OPTIONS: Array<{ key: EC2Metric; label: string }> = [
  { key: "cost", label: "Cost" },
  { key: "usage", label: "Usage" },
  { key: "data-transfer", label: "Data Transfer" },
  { key: "instances", label: "Instances" },
  { key: "volumes", label: "Volumes" },
];

export const GRANULARITY_OPTIONS: Array<{ key: EC2Granularity; label: string }> = [
  { key: "hourly", label: "Hourly" },
  { key: "daily", label: "Daily" },
  { key: "monthly", label: "Monthly" },
];

export const VOLUME_VIEW_OPTIONS: Array<{ key: EC2VolumeView; label: string }> = [
  { key: "storage", label: "Storage" },
  { key: "storage_hours", label: "Storage Hours" },
  { key: "cost", label: "Cost" },
  { key: "count", label: "Count" },
];

export const COST_BASIS_OPTIONS: Array<{ key: EC2CostBasis; label: string }> = [
  { key: "billed_cost", label: "Billed Cost" },
  { key: "effective_cost", label: "Effective Cost" },
  { key: "amortized_cost", label: "Amortized Cost" },
  { key: "net_amortized_cost", label: "Net Amortized Cost" },
  { key: "net_unblended_cost", label: "Net Unblended Cost" },
];

export const USAGE_TYPE_OPTIONS: Array<{ key: EC2UsageType; label: string }> = [
  { key: "cpu", label: "CPU" },
  { key: "network", label: "Network" },
  { key: "disk", label: "Disk" },
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
  { key: "cost-category", label: "Cost Category" },
  { key: "region", label: "Region" },
  { key: "account", label: "Account" },
  { key: "availability-zone", label: "Availability Zone" },
  { key: "instance", label: "Instance" },
  { key: "instance-type", label: "Instance Type" },
  { key: "instance-state", label: "Instance State" },
  { key: "reservation-type", label: "Reservation Type" },
  { key: "usage-type", label: "Usage Type" },
  { key: "operation", label: "Operation" },
  { key: "recommendation", label: "Recommendation / Insight" },
  { key: "volume", label: "Volume" },
  { key: "volume_type", label: "Volume Type" },
  { key: "attachment_state", label: "Attachment State" },
  { key: "storage_tier", label: "Storage Tier" },
  { key: "iops_tier", label: "IOPS Tier" },
  { key: "size_bucket", label: "Size Bucket" },
  { key: "lifecycle_state", label: "Lifecycle State" },
  { key: "transfer-type", label: "Transfer Type" },
  { key: "source-region", label: "Source Region" },
  { key: "destination-region", label: "Destination Region" },
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
  usageType: "cpu",
  usageAggregation: "avg",
  chartType: "stacked_bar",
  instancesCondition: "all",
  instancesState: "running",
  instanceType: "all",
  groupBy: "cost-category",
  granularity: "daily",
  volumeView: "storage",
  groupByValues: [],
  scopeFilters: DEFAULT_SCOPE_FILTERS,
  thresholds: DEFAULT_THRESHOLDS,
};
