export type InventoryEc2VolumesListQuery = {
  cloudConnectionId: string | null;
  state: string | null;
  volumeType: string | null;
  isAttached: boolean | null;
  region: string | null;
  search: string | null;
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
  regionKey: string | null;
  regionId: string | null;
  regionName: string | null;
  resourceKey: string | null;
  subAccountKey: string | null;
  discoveredAt: string | null;
  tags: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

export type InventoryEc2VolumesListResponse = {
  items: InventoryEc2VolumesListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
