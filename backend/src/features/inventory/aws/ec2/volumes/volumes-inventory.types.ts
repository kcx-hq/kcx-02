export type InventoryEc2VolumesListQuery = {
  cloudConnectionId: string | null;
  subAccountKey: string | null;
  attachedInstanceId: string | null;
  state: string | null;
  volumeType: string | null;
  isAttached: boolean | null;
  attachmentState: "attached" | "unattached" | "attached_stopped" | null;
  optimizationStatus: "idle" | "underutilized" | "optimal" | "warning" | null;
  signal: "unattached" | "attached_stopped" | "idle" | "underutilized" | null;
  region: string | null;
  search: string | null;
  startDate: string | null;
  endDate: string | null;
  sortBy:
    | "signal"
    | "volumeId"
    | "sizeGb"
    | "dailyCost"
    | "mtdCost"
    | "volumeType"
    | "availabilityZone"
    | "attachedInstanceState";
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
};

export type InventoryEc2VolumesListItem = {
  volumeId: string;
  volumeName: string;
  volumeType: string | null;
  sizeGb: number | null;
  iops: number | null;
  throughput: number | null;
  state: string | null;
  availabilityZone: string | null;
  isAttached: boolean | null;
  attachedInstanceId: string | null;
  attachedInstanceName: string | null;
  attachedInstanceState: string | null;
  attachedInstanceType: string | null;
  cloudConnectionId: string | null;
  subAccountKey: string | null;
  subAccountName: string | null;
  regionKey: string | null;
  regionId: string | null;
  regionName: string | null;
  resourceKey: string | null;
  discoveredAt: string | null;
  usageDate: string | null;
  currencyCode: string | null;
  dailyCost: number;
  mtdCost: number;
  isUnattached: boolean | null;
  isAttachedToStoppedInstance: boolean | null;
  isIdleCandidate: boolean | null;
  isUnderutilizedCandidate: boolean | null;
  optimizationStatus: "idle" | "underutilized" | "optimal" | "warning" | null;
  tags: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

export type InventoryEc2VolumesListResponse = {
  items: InventoryEc2VolumesListItem[];
  summary: {
    totalVolumes: number;
    totalStorageGb: number;
    totalCost: number;
    unattachedVolumes: number;
    attachedToStoppedInstance: number;
    idleVolumes: number;
    underutilizedVolumes: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type InventoryEc2VolumePerformanceInterval = "daily" | "hourly";

export type InventoryEc2VolumePerformanceTopic = "ebs";

export type InventoryEc2VolumePerformanceMetric =
  | "volume_read_bytes"
  | "volume_write_bytes"
  | "volume_read_ops"
  | "volume_write_ops"
  | "queue_length"
  | "burst_balance"
  | "volume_idle_time";

export type InventoryEc2VolumePerformanceQuery = {
  volumeId: string;
  cloudConnectionId: string | null;
  interval: InventoryEc2VolumePerformanceInterval;
  topic: InventoryEc2VolumePerformanceTopic;
  metrics: InventoryEc2VolumePerformanceMetric[];
  startDate: string | null;
  endDate: string | null;
};

export type InventoryEc2VolumePerformancePoint = {
  timestamp: string;
  value: number;
};

export type InventoryEc2VolumePerformanceSeries = {
  metric: InventoryEc2VolumePerformanceMetric;
  label: string;
  unit: "percent" | "bytes" | "count";
  points: InventoryEc2VolumePerformancePoint[];
};

export type InventoryEc2VolumePerformanceResponse = {
  volumeId: string;
  cloudConnectionId: string | null;
  interval: InventoryEc2VolumePerformanceInterval;
  topic: InventoryEc2VolumePerformanceTopic;
  metrics: InventoryEc2VolumePerformanceMetric[];
  startDate: string;
  endDate: string;
  series: InventoryEc2VolumePerformanceSeries[];
};

export type InventoryEc2VolumeDetailQuery = {
  volumeId: string;
  cloudConnectionId: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type InventoryEc2VolumeDetailResponse = {
  identity: {
    volumeId: string;
    name: string;
    state: string | null;
    volumeType: string | null;
    sizeGb: number | null;
    iops: number | null;
    throughput: number | null;
    availabilityZone: string | null;
    region: string | null;
    subAccount: string | null;
    cloudConnectionId: string | null;
    discoveredAt: string | null;
  };
  attachment: {
    instanceId: string | null;
    instanceName: string | null;
    instanceState: string | null;
  };
  metadata: {
    tags: Record<string, unknown>;
    metadata: Record<string, unknown>;
  };
  costBreakdown: {
    totalVolumeCost: number;
    storageCost: number;
    iopsCost: number;
    throughputCost: number;
    snapshotCost: number;
  };
  trends: {
    costTrend: Array<{ date: string; totalCost: number }>;
    sizeTrend: Array<{ date: string; sizeGb: number }>;
  };
};
