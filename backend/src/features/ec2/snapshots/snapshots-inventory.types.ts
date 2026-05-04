export type InventoryEc2SnapshotsListQuery = {
  cloudConnectionId: string | null;
  regionKey: string | null;
  volumeId: string | null;
  state: string | null;
  status: "old" | "orphaned" | "normal" | null;
  storageTier: string | null;
  encrypted: boolean | null;
  search: string | null;
  page: number;
  pageSize: number;
};

export type InventoryEc2SnapshotsSignal = "old" | "orphaned" | "normal" | null;
export type InventoryEc2SnapshotsVolumeStatus =
  | "missing"
  | "deleted"
  | "unavailable"
  | "available"
  | null;

export type InventoryEc2SnapshotsListItem = {
  snapshotId: string;
  sourceVolumeId: string | null;
  sourceInstanceId: string | null;
  accountId: string;
  accountName: string | null;
  region: string;
  state: string;
  storageTier: string;
  ageDays: number | null;
  status: InventoryEc2SnapshotsSignal;
  statusLabel: string;
  signals: Exclude<InventoryEc2SnapshotsSignal, null | "normal">[];
  volumeStatus: InventoryEc2SnapshotsVolumeStatus;
  signal: InventoryEc2SnapshotsSignal;
  cost: number;
  recommendation: string | null;
  estimatedSavings: number;
};

export type InventoryEc2SnapshotsSummary = {
  totalSnapshotCost: number;
  totalSnapshots: number;
  oldSnapshots: number;
  potentialSavings: number;
};

export type InventoryEc2SnapshotsListResponse = {
  rows: InventoryEc2SnapshotsListItem[];
  summary: InventoryEc2SnapshotsSummary;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
