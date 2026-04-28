import type { DashboardScope } from "../../dashboard/dashboard.types.js";

export const EC2_EXPLORER_METRICS = ["cost", "usage", "instances"] as const;
export type Ec2ExplorerMetric = (typeof EC2_EXPLORER_METRICS)[number];

export const EC2_EXPLORER_GROUP_BY = [
  "none",
  "region",
  "instance_type",
  "reservation_type",
  "cost_category",
  "tag",
] as const;
export type Ec2ExplorerGroupBy = (typeof EC2_EXPLORER_GROUP_BY)[number];

export const EC2_COST_BASIS = [
  "billed_cost",
  "effective_cost",
  "amortized_cost",
] as const;
export type Ec2CostBasis = (typeof EC2_COST_BASIS)[number];

export const EC2_USAGE_TYPES = ["cpu", "network", "disk"] as const;
export type Ec2UsageType = (typeof EC2_USAGE_TYPES)[number];

export const EC2_USAGE_AGGREGATIONS = ["avg", "max", "p95"] as const;
export type Ec2UsageAggregation = (typeof EC2_USAGE_AGGREGATIONS)[number];

export const EC2_INSTANCE_CONDITIONS = [
  "all",
  "idle",
  "underutilized",
  "overutilized",
  "uncovered",
] as const;
export type Ec2InstanceCondition = (typeof EC2_INSTANCE_CONDITIONS)[number];

export type Ec2ExplorerTagFilter = {
  key: string;
  value: string;
};

export type Ec2ExplorerFilters = {
  regions: string[];
  tags: Ec2ExplorerTagFilter[];
};

export type Ec2ExplorerInput = {
  scope: DashboardScope;
  startDate: string;
  endDate: string;
  metric: Ec2ExplorerMetric;
  groupBy: Ec2ExplorerGroupBy;
  tagKey: string | null;
  filters: Ec2ExplorerFilters;
  costBasis: Ec2CostBasis;
  usageType: Ec2UsageType;
  aggregation: Ec2UsageAggregation;
  condition: Ec2InstanceCondition;
  groupValues: string[];
  minCost: number | null;
  maxCost: number | null;
  minCpu: number | null;
  maxCpu: number | null;
  minNetwork: number | null;
  maxNetwork: number | null;
  states: string[];
  instanceTypes: string[];
};

export type Ec2ExplorerSummary = {
  totalCost: number;
  previousCost: number;
  trendPercent: number;
  instanceCount: number;
  avgCpu: number;
  totalNetworkGb: number;
};

export type Ec2ExplorerGraphPoint = {
  date: string;
  value: number;
};

export type Ec2ExplorerGraphSeries = {
  key: string;
  label: string;
  data: Ec2ExplorerGraphPoint[];
};

export type Ec2ExplorerGraph = {
  type: "bar" | "stacked_bar" | "line" | "area" | "stacked_area";
  xKey: "date";
  series: Ec2ExplorerGraphSeries[];
};

export type Ec2ExplorerTableColumn = {
  key: string;
  label: string;
};

export type Ec2ExplorerTableRow = {
  id: string;
  [key: string]: string | number | null;
};

export type Ec2ExplorerTable = {
  columns: Ec2ExplorerTableColumn[];
  rows: Ec2ExplorerTableRow[];
};

export type Ec2ExplorerResponse = {
  summary: Ec2ExplorerSummary;
  graph: Ec2ExplorerGraph;
  table: Ec2ExplorerTable;
};

export type Ec2ExplorerFactRow = {
  date: string;
  instanceId: string;
  instanceName: string;
  instanceType: string;
  region: string;
  account: string;
  state: string;
  computeCost: number;
  ebsCost: number;
  dataTransferCost: number;
  totalEffectiveCost: number;
  totalBilledCost: number;
  totalAmortizedCost: number | null;
  cpuAvg: number;
  cpuMax: number;
  diskUsedPercentAvg: number;
  diskUsedPercentMax: number;
  networkInBytes: number;
  networkOutBytes: number;
  isIdleCandidate: boolean;
  isUnderutilizedCandidate: boolean;
  isOverutilizedCandidate: boolean;
  reservationType: string;
  team: string;
  product: string;
  environment: string;
  tagsJson: Record<string, unknown> | null;
};

export type Ec2ExplorerAdditionalDailyCosts = {
  date: string;
  snapshotCost: number;
  eipCost: number;
};
