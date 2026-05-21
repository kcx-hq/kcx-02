import type { DashboardScope } from "../../dashboard/dashboard.types.js";
import type { Ec2TransferType } from "../classification/types.js";

export const EC2_DATA_TRANSFER_EXPLORER_GRANULARITIES = ["daily", "weekly", "monthly"] as const;
export type Ec2DataTransferExplorerGranularity = (typeof EC2_DATA_TRANSFER_EXPLORER_GRANULARITIES)[number];

export const EC2_DATA_TRANSFER_EXPLORER_Y_AXIS = ["transfer_cost", "usage_gb"] as const;
export type Ec2DataTransferExplorerYAxis = (typeof EC2_DATA_TRANSFER_EXPLORER_Y_AXIS)[number];

export const EC2_DATA_TRANSFER_EXPLORER_GROUP_BY = ["none", "account", "region", "instance", "transfer_type", "tag"] as const;
export type Ec2DataTransferExplorerGroupBy = (typeof EC2_DATA_TRANSFER_EXPLORER_GROUP_BY)[number];

export const EC2_DATA_TRANSFER_EXPLORER_COMPARE = ["none", "previous_period"] as const;
export type Ec2DataTransferExplorerCompare = (typeof EC2_DATA_TRANSFER_EXPLORER_COMPARE)[number];

export type Ec2DataTransferExplorerTagFilter = {
  key: string;
  value: string;
};

export type Ec2DataTransferExplorerFilters = {
  accountIds: string[];
  regions: string[];
  instanceTypes: string[];
  transferTypes: Ec2TransferType[];
  tags: Ec2DataTransferExplorerTagFilter[];
};

export type Ec2DataTransferExplorerInput = {
  scope: DashboardScope;
  startDate: string;
  endDate: string;
  granularity: Ec2DataTransferExplorerGranularity;
  yAxis: Ec2DataTransferExplorerYAxis;
  groupBy: Ec2DataTransferExplorerGroupBy;
  tagKey: string | null;
  compare: Ec2DataTransferExplorerCompare;
  filters: Ec2DataTransferExplorerFilters;
};

export type Ec2DataTransferExplorerRawRow = {
  date: string;
  account: string;
  region: string;
  instanceType: string;
  instanceId: string;
  instanceName: string;
  tagsJson: Record<string, unknown> | null;
  transferType: Ec2TransferType;
  cost: number;
  usageGb: number;
  internetCost: number;
  interRegionCost: number;
  interAzCost: number;
  regionalCost: number;
  unknownCost: number;
};

export type Ec2DataTransferExplorerChartSeries = {
  groupKey: string;
  groupLabel: string;
  points: Array<{ date: string; value: number }>;
};

export type Ec2DataTransferExplorerTableRow = {
  groupKey: string;
  groupLabel: string;
  transferCost: number;
  usageGb: number;
  internetCost: number;
  interRegionCost: number;
  interAzCost: number;
  regionalCost: number;
  unknownCost: number;
  percentOfTransferCost: number;
  mainDriver: "Internet" | "Inter-Region" | "Inter-AZ" | "Regional" | "Unknown";
};

export type Ec2DataTransferExplorerResponse = {
  kpis: {
    transferCost: number;
    usageGb: number;
    internetTransferCost: number;
    interRegionInterAzTransferCost: number;
  };
  chart: {
    granularity: Ec2DataTransferExplorerGranularity;
    xAxis: "date";
    yAxis: Ec2DataTransferExplorerYAxis;
    series: Ec2DataTransferExplorerChartSeries[];
  };
  table: {
    rows: Ec2DataTransferExplorerTableRow[];
  };
  meta: {
    yAxis: Ec2DataTransferExplorerYAxis;
    groupBy: Ec2DataTransferExplorerGroupBy;
    granularity: Ec2DataTransferExplorerGranularity;
    compare: Ec2DataTransferExplorerCompare;
    currency: "USD";
    normalized: true;
  };
};

