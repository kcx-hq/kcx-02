export type EbsVolumeRegionInventory = {
  region: string;
  volumeIds: string[];
};

export type HourlyMetricAggregation = "sum" | "max" | "avg";

export type EbsVolumeUtilizationHourlyRow = {
  tenantId: string | null;
  cloudConnectionId: string;
  providerId: string | null;
  volumeId: string;
  hourStart: Date;
  usageDate: string;
  resourceKey: string | null;
  regionKey: string | null;
  subAccountKey: string | null;
  readBytes: string | null;
  writeBytes: string | null;
  readOps: string | null;
  writeOps: string | null;
  queueLengthMax: string | null;
  burstBalanceAvg: string | null;
  idleTimeAvg: string | null;
  sampleCount: number;
  metricSource: "cloudwatch";
  createdAt: Date;
  updatedAt: Date;
};
