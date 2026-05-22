import type { DashboardScope } from "../../dashboard/dashboard.types.js";

export const EC2_USAGE_EXPLORER_GRANULARITIES = ["daily", "weekly", "monthly"] as const;
export type Ec2UsageExplorerGranularity = (typeof EC2_USAGE_EXPLORER_GRANULARITIES)[number];

export const EC2_USAGE_EXPLORER_METRICS = ["cpu", "network_in", "network_out", "network_total"] as const;
export type Ec2UsageExplorerMetric = (typeof EC2_USAGE_EXPLORER_METRICS)[number];

export const EC2_USAGE_EXPLORER_AGGREGATIONS = ["avg", "max", "sum"] as const;
export type Ec2UsageExplorerAggregation = (typeof EC2_USAGE_EXPLORER_AGGREGATIONS)[number];

export const EC2_USAGE_EXPLORER_GROUP_BY = ["none", "account", "region", "instance", "instance_type", "tag"] as const;
export type Ec2UsageExplorerGroupBy = (typeof EC2_USAGE_EXPLORER_GROUP_BY)[number];

export const EC2_USAGE_EXPLORER_COMPARE = ["none", "previous_period"] as const;
export type Ec2UsageExplorerCompare = (typeof EC2_USAGE_EXPLORER_COMPARE)[number];

export type Ec2UsageExplorerTagFilter = {
  key: string;
  value: string;
};

export type Ec2UsageExplorerFilters = {
  accountIds: string[];
  regions: string[];
  instanceTypes: string[];
  tags: Ec2UsageExplorerTagFilter[];
};

export type Ec2UsageExplorerInput = {
  scope: DashboardScope;
  startDate: string;
  endDate: string;
  granularity: Ec2UsageExplorerGranularity;
  usageMetric: Ec2UsageExplorerMetric;
  aggregation: Ec2UsageExplorerAggregation;
  groupBy: Ec2UsageExplorerGroupBy;
  tagKey: string | null;
  compare: Ec2UsageExplorerCompare;
  filters: Ec2UsageExplorerFilters;
};

export type Ec2UsageExplorerRawRow = {
  date: string;
  account: string;
  region: string;
  instanceType: string;
  instanceId: string;
  instanceName: string;
  tagsJson: Record<string, unknown> | null;
  avgCpu: number;
  maxCpu: number;
  networkInGb: number;
  networkOutGb: number;
};

export type Ec2UsageExplorerChartSeries = {
  groupKey: string;
  groupLabel: string;
  points: Array<{ date: string; value: number }>;
};

export type Ec2UsageExplorerTableRow = {
  groupKey: string;
  groupLabel: string;
  avgCpu: number;
  maxCpu: number;
  networkInGb: number;
  networkOutGb: number;
  networkTotalGb: number;
  instanceCount: number;
};

export type Ec2UsageExplorerResponse = {
  kpis: {
    avgCpu: number;
    maxCpu: number;
    totalNetworkInGb: number;
    totalNetworkOutGb: number;
    instanceCount: number;
  };
  chart: {
    granularity: Ec2UsageExplorerGranularity;
    xAxis: "date";
    yAxis: string;
    series: Ec2UsageExplorerChartSeries[];
  };
  table: {
    rows: Ec2UsageExplorerTableRow[];
  };
  meta: {
    usageMetric: Ec2UsageExplorerMetric;
    aggregation: Ec2UsageExplorerAggregation;
    groupBy: Ec2UsageExplorerGroupBy;
    granularity: Ec2UsageExplorerGranularity;
    normalized: true;
  };
};

