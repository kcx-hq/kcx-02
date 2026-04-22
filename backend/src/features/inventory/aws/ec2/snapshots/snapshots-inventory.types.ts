export type InventoryEc2SnapshotsListQuery = {
  cloudConnectionId: string | null;
  regionKey: string | null;
  state: string | null;
  storageTier: string | null;
  encrypted: boolean | null;
  search: string | null;
  page: number;
  pageSize: number;
};

export type InventoryEc2SnapshotsSignal = "Orphaned" | "Old" | "Normal";

export type InventoryEc2SnapshotsListItem = {
  snapshotId: string;
  sourceVolumeId: string | null;
  sourceVolumeName: string | null;
  sourceInstanceId: string | null;
  sourceInstanceName: string | null;
  state: string | null;
  storageTier: string | null;
  encrypted: boolean | null;
  kmsKeyId: string | null;
  progress: string | null;
  startTime: string | null;
  ageDays: number | null;
  likelyOrphaned: boolean;
  signal: InventoryEc2SnapshotsSignal;
  cost: number | null;
  currencyCode: string | null;
  regionKey: string | null;
  subAccountKey: string | null;
  tags: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

export type InventoryEc2SnapshotsSummary = {
  snapshotsInView: number;
  likelyOrphanedCount: number;
  oldSnapshotsCount: number;
  totalSnapshotCost: number | null;
};

export type InventoryEc2SnapshotsListResponse = {
  items: InventoryEc2SnapshotsListItem[];
  summary: InventoryEc2SnapshotsSummary;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
