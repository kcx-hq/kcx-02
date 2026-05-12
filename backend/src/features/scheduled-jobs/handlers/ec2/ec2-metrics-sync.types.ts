export type InstanceRegionInventory = {
  region: string;
  instanceIds: string[];
};

export type HourlyMetricAggregation = "sum" | "max" | "min" | "avg";

export type MetricPoint = {
  timestamp: Date;
  value: number;
};

export type InstanceHourKey = `${string}|${string}`; // `${instanceId}|${hourStartIso}`

export type UtilizationHourlyRow = {
  tenantId: string | null;
  cloudConnectionId: string | null;
  providerId: string | null;
  instanceId: string;
  hourStart: Date;
  usageDate: string;
  resourceKey: string | null;
  regionKey: string | null;
  subAccountKey: string | null;
  metricSource: "cloudwatch";
  sampleCount: number;
  cpuAvg: string | null;
  cpuMax: string | null;
  cpuMin: string | null;
  networkInBytes: string | null;
  networkOutBytes: string | null;
  networkPacketsIn: string | null;
  networkPacketsOut: string | null;
  diskReadBytes: string | null;
  diskWriteBytes: string | null;
  diskReadOps: string | null;
  diskWriteOps: string | null;
  statusCheckFailedMax: string | null;
  statusCheckFailedInstanceMax: string | null;
  statusCheckFailedSystemMax: string | null;
  ebsReadBytes: string | null;
  ebsWriteBytes: string | null;
  ebsReadOps: string | null;
  ebsWriteOps: string | null;
  ebsQueueLengthMax: string | null;
  ebsIdleTimeAvg: string | null;
  ebsBurstBalanceAvg: string | null;
  createdAt: Date;
  updatedAt: Date;
};

