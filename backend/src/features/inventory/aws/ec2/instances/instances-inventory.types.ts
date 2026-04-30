export type InventoryEc2InstancesListQuery = {
  cloudConnectionId: string | null;
  subAccountKey: string | null;
  state: string | null;
  region: string | null;
  instanceType: string | null;
  pricingType: "on_demand" | "reserved" | "savings_plan" | "spot" | null;
  networkType:
    | "Internet Data Transfer"
    | "Inter-Region Data Transfer"
    | "Inter-AZ Data Transfer"
    | "NAT Gateway"
    | "Elastic IP"
    | "Load Balancer"
    | "Other Network"
    | null;
  search: string | null;
  startDate: string | null;
  endDate: string | null;
  page: number;
  pageSize: number;
};

export type InventoryEc2InstancesListItem = {
  instanceId: string;
  instanceName: string;
  state: string | null;
  instanceType: string | null;
  subAccountKey: string | null;
  subAccountName: string | null;
  regionKey: string | null;
  regionId: string | null;
  regionName: string | null;
  availabilityZone: string | null;
  platform: string | null;
  launchTime: string | null;
  privateIpAddress: string | null;
  publicIpAddress: string | null;
  cpuAvg: number | null;
  cpuMax: number | null;
  isIdleCandidate: boolean | null;
  isUnderutilizedCandidate: boolean | null;
  isOverutilizedCandidate: boolean | null;
  pricingType: "on_demand" | "reserved" | "savings_plan" | "spot" | "other" | null;
  totalHours: number;
  computeCost: number;
  coveredHours: number;
  uncoveredHours: number;
  monthToDateCost: number;
  dataTransferCost: number;
  networkUsageBytes: number;
  otherUnallocatedCost: number;
  latestDailyCost: number;
  imageId: string | null;
  tenancy: string | null;
  architecture: string | null;
  instanceLifecycle: string | null;
  resourceKey: string | null;
  cloudConnectionId: string | null;
  attachedVolumeCount: number;
  attachedVolumeTotalSizeGb: number | null;
  attachedVolumeIds: string[];
  tags: Record<string, unknown> | null;
};

export type InventoryEc2InstancesListResponse = {
  items: InventoryEc2InstancesListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type InventoryEc2PerformanceInterval = "daily" | "hourly";

export type InventoryEc2PerformanceTopic =
  | "cpu"
  | "network"
  | "disk_throughput"
  | "disk_operations"
  | "ebs"
  | "health";

export type InventoryEc2PerformanceMetric =
  | "cpu_avg"
  | "cpu_max"
  | "cpu_min"
  | "network_in_bytes"
  | "network_out_bytes"
  | "disk_read_bytes"
  | "disk_write_bytes"
  | "disk_read_ops"
  | "disk_write_ops"
  | "ebs_read_bytes"
  | "ebs_write_bytes"
  | "ebs_queue_length_max"
  | "ebs_burst_balance_avg"
  | "ebs_idle_time_avg"
  | "status_check_failed_max"
  | "status_check_failed_instance_max"
  | "status_check_failed_system_max";

export type InventoryEc2InstancePerformanceQuery = {
  instanceId: string;
  cloudConnectionId: string | null;
  interval: InventoryEc2PerformanceInterval;
  topic: InventoryEc2PerformanceTopic;
  metrics: InventoryEc2PerformanceMetric[];
  startDate: string | null;
  endDate: string | null;
};

export type InventoryEc2InstancePerformancePoint = {
  timestamp: string;
  value: number;
};

export type InventoryEc2InstancePerformanceSeries = {
  metric: InventoryEc2PerformanceMetric;
  label: string;
  unit: "percent" | "bytes" | "count";
  points: InventoryEc2InstancePerformancePoint[];
};

export type InventoryEc2InstancePerformanceResponse = {
  instanceId: string;
  cloudConnectionId: string | null;
  interval: InventoryEc2PerformanceInterval;
  topic: InventoryEc2PerformanceTopic;
  metrics: InventoryEc2PerformanceMetric[];
  startDate: string;
  endDate: string;
  series: InventoryEc2InstancePerformanceSeries[];
};

export type InventoryEc2InstanceDetailQuery = {
  instanceId: string;
  cloudConnectionId: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type InventoryEc2InstanceDetailResponse = {
  identity: {
    instanceId: string;
    name: string;
    state: string | null;
    type: string | null;
    region: string | null;
    account: string | null;
    launchTime: string | null;
    availabilityZone: string | null;
    cloudConnectionId: string | null;
  };
  tags: Record<string, unknown>;
  costSummary: {
    totalCost: number;
    computeCost: number;
    ebsCost: number;
    networkCost: number;
    otherCost: number;
  };
  usageSummary: {
    avgCpu: number | null;
    maxCpu: number | null;
    networkInBytes: number;
    networkOutBytes: number;
    networkUsageBytes: number;
    networkCost: number;
  };
  pricingSummary: {
    pricingType: "on_demand" | "reserved" | "savings_plan" | "spot" | "other" | null;
    coveredHours: number;
    uncoveredHours: number;
    coveragePercent: number;
    computeCost: number;
    potentialSavings: number | null;
  };
  attachedVolumes: Array<{
    volumeId: string;
    sizeGb: number | null;
    volumeType: string | null;
    cost: number;
    state: string | null;
    iops: number | null;
    throughput: number | null;
    attachedSince: string | null;
    deleteOnTermination: boolean | null;
  }>;
  recommendations: Array<{
    id: number;
    type: string;
    problem: string;
    evidence: string;
    action: string;
    saving: number;
    risk: string;
    status: string;
  }>;
  trends: {
    costTrend: Array<{
      date: string;
      totalCost: number;
      computeCost: number;
      ebsCost: number;
      networkCost: number;
      otherCost: number;
    }>;
    cpuTrend: Array<{ date: string; avgCpu: number; maxCpu: number | null }>;
    networkTrend: Array<{ date: string; totalGb: number; inGb: number; outGb: number }>;
  };
  networkInsight: {
    totalNetworkCost: number;
    totalNetworkUsageGb: number;
    breakdown: Array<{
      type: string;
      cost: number;
      usageGb: number;
      percentage: number;
    }>;
  };
};

