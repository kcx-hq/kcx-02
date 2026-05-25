export type DatabaseAssetsQueryParams = {
  tenantId: string;
  startDate: string;
  endDate: string;
  cloudConnectionId?: string;
  regionKey?: string;
  dbService?: string;
  dbEngine?: string;
  resourceType?: string;
  instanceClass?: string;
  cluster?: string;
  status?: string;
  subAccountKey?: string;
  search?: string;
  page: number;
  pageSize: number;
};

export type DatabaseAssetsFilterValueOption = {
  value: string;
  label: string;
  count: number;
};

export type DatabaseAssetsRegionOption = {
  regionKey: string;
  regionId: string | null;
  regionName: string | null;
  count: number;
};

export type DatabaseAssetsAccountOption = {
  subAccountKey: string;
  subAccountId: string | null;
  subAccountName: string | null;
  count: number;
};

export type DatabaseAssetsFilterOptions = {
  dbServices: DatabaseAssetsFilterValueOption[];
  dbEngines: DatabaseAssetsFilterValueOption[];
  classes: DatabaseAssetsFilterValueOption[];
  statuses: DatabaseAssetsFilterValueOption[];
  regions: DatabaseAssetsRegionOption[];
  accounts: DatabaseAssetsAccountOption[];
};

export type DatabaseAssetRow = {
  cloudConnectionId: string | null;
  resourceId: string;
  resourceArn: string | null;
  resourceName: string | null;
  dbIdentifier: string;
  dbService: string;
  dbEngine: string | null;
  dbEngineVersion: string | null;
  resourceType: string | null;
  instanceClass: string | null;
  capacityMode: string | null;
  regionKey: string | null;
  regionId: string | null;
  regionName: string | null;
  subAccountKey: string | null;
  subAccountId: string | null;
  subAccountName: string | null;
  status: string | null;
  clusterId: string | null;
  isClusterResource: boolean;
  allocatedStorageGb: number | null;
  storageUsedGb: number | null;
  dataFootprintGb: number | null;
  avgCpu: number | null;
  maxCpu: number | null;
  avgConnections: number | null;
  maxConnections: number | null;
  avgIops: number | null;
  avgThroughputBytes: number | null;
  totalBilledCost: number;
  totalEffectiveCost: number;
  totalListCost: number;
  totalCost: number;
  currencyCode: string | null;
  recommendationCount: number;
  latestUsageDate: string;
  discoveredAt: string | null;
  hasLiveInventory: boolean;
  inventorySource: "aws_sdk" | "billing_only" | "mixed";
  inventoryObservedAt: string | null;
  inventoryFreshnessMinutes: number | null;
  endpoint: string | null;
  endpointPort: number | null;
  multiAz: boolean | null;
  storageEncrypted: boolean | null;
  deletionProtection: boolean | null;
  backupRetentionPeriod: number | null;
  metadata: Record<string, unknown> | null;
};

export type DatabaseAssetsSummary = {
  totalAssets: number;
  totalCost: number;
  avgCpu: number | null;
  totalStorageGb: number | null;
  recommendationCount: number;
};

export type DatabaseAssetsResponse = {
  summary: DatabaseAssetsSummary;
  filterOptions: DatabaseAssetsFilterOptions;
  assets: DatabaseAssetRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type DatabaseAssetDetailQueryParams = {
  tenantId: string;
  resourceId: string;
  cloudConnectionId: string;
  startDate: string;
  endDate: string;
};

export type DatabaseAssetDetailIdentity = {
  resourceId: string;
  resourceArn: string | null;
  resourceName: string | null;
  dbIdentifier: string;
  dbService: string | null;
  dbEngine: string | null;
  dbEngineVersion: string | null;
  resourceType: string | null;
  instanceClass: string | null;
  capacityMode: string | null;
  status: string | null;
  clusterId: string | null;
  isClusterResource: boolean;
  regionKey: string | null;
  regionName: string | null;
  subAccountKey: string | null;
  subAccountName: string | null;
  cloudConnectionId: string;
  latestUsageDate: string | null;
  discoveredAt: string | null;
  hasLiveInventory: boolean;
  inventorySource: "aws_sdk" | "billing_only" | "mixed";
  inventoryObservedAt: string | null;
  inventoryFreshnessMinutes: number | null;
  endpoint: string | null;
  endpointPort: number | null;
  multiAz: boolean | null;
  storageEncrypted: boolean | null;
  deletionProtection: boolean | null;
  backupRetentionPeriod: number | null;
};

export type DatabaseAssetDetailCostSummary = {
  totalCost: number;
  totalBilledCost: number;
  totalEffectiveCost: number;
  totalListCost: number;
  currencyCode: string | null;
  dailyAverageCost: number | null;
  primaryCostDriver: string | null;
};

export type DatabaseAssetDetailCostBreakdown = {
  compute: number;
  storage: number;
  io: number;
  backup: number;
  dataTransfer: number;
  tax: number;
  credit: number;
  refund: number;
  other: number;
};

export type DatabaseAssetDetailUsageSummary = {
  avgCpu: number | null;
  maxCpu: number | null;
  avgLoad: number | null;
  maxLoad: number | null;
  avgConnections: number | null;
  maxConnections: number | null;
  requestCount: number | null;
};

export type DatabaseAssetDetailStorageSummary = {
  allocatedStorageGb: number | null;
  storageUsedGb: number | null;
  dataFootprintGb: number | null;
  storageUtilizationPct: number | null;
};

export type DatabaseAssetDetailPerformanceSummary = {
  avgIops: number | null;
  maxIops: number | null;
  avgThroughputBytes: number | null;
  maxThroughputBytes: number | null;
  readIops: number | null;
  writeIops: number | null;
  readThroughputBytes: number | null;
  writeThroughputBytes: number | null;
};

export type DatabaseAssetDetailTopology = {
  clusterId: string | null;
  isClusterResource: boolean;
  resourceType: string | null;
  relatedResourceCount: number | null;
};

export type DatabaseAssetDetailOptimizationReadiness = {
  recommendationCount: number;
  signalCompleteness: number;
  confidenceLabel: "low" | "medium" | "high";
  notes: string[];
};

export type DatabaseAssetDetailCostTrendPoint = {
  date: string;
  totalCost: number;
  compute: number;
  storage: number;
  io: number;
  backup: number;
  dataTransfer: number;
  tax: number;
  credit: number;
  refund: number;
  other: number;
};

export type DatabaseAssetDetailUsageTrendPoint = {
  date: string;
  avgCpu: number | null;
  maxCpu: number | null;
  avgLoad: number | null;
  maxLoad: number | null;
  avgConnections: number | null;
  maxConnections: number | null;
  requestCount: number | null;
};

export type DatabaseAssetDetailStorageTrendPoint = {
  date: string;
  allocatedStorageGb: number | null;
  storageUsedGb: number | null;
  dataFootprintGb: number | null;
  storageUtilizationPct: number | null;
};

export type DatabaseAssetDetailPerformanceTrendPoint = {
  date: string;
  readIops: number | null;
  writeIops: number | null;
  totalIops: number | null;
  readThroughputBytes: number | null;
  writeThroughputBytes: number | null;
  totalThroughputBytes: number | null;
  avgLoad: number | null;
  avgConnections: number | null;
};

export type DatabaseAssetDetailResponse = {
  identity: DatabaseAssetDetailIdentity;
  costSummary: DatabaseAssetDetailCostSummary;
  costBreakdown: DatabaseAssetDetailCostBreakdown;
  usageSummary: DatabaseAssetDetailUsageSummary;
  storageSummary: DatabaseAssetDetailStorageSummary;
  performanceSummary: DatabaseAssetDetailPerformanceSummary;
  topology: DatabaseAssetDetailTopology;
  optimizationReadiness: DatabaseAssetDetailOptimizationReadiness;
  trends: {
    cost: DatabaseAssetDetailCostTrendPoint[];
    usage: DatabaseAssetDetailUsageTrendPoint[];
    storage: DatabaseAssetDetailStorageTrendPoint[];
    performance: DatabaseAssetDetailPerformanceTrendPoint[];
  };
  metadata: {
    tags: Record<string, unknown> | null;
    rawMetadata: Record<string, unknown> | null;
  };
};
