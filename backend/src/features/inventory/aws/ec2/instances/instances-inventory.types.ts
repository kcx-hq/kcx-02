export type InventoryEc2InstancesListQuery = {
  cloudConnectionId: string | null;
  state: string | null;
  region: string | null;
  instanceType: string | null;
  search: string | null;
  page: number;
  pageSize: number;
};

export type InventoryEc2InstancesListItem = {
  instanceId: string;
  instanceName: string;
  state: string | null;
  instanceType: string | null;
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
  monthToDateCost: number;
  latestDailyCost: number;
  imageId: string | null;
  tenancy: string | null;
  architecture: string | null;
  instanceLifecycle: string | null;
  resourceKey: string | null;
  cloudConnectionId: string | null;
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

