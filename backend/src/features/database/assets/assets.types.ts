export type DatabaseAssetsQueryParams = {
  tenantId: string;
  startDate: string;
  endDate: string;
  cloudConnectionId?: string;
  regionKey?: string;
  dbService?: string;
  dbEngine?: string;
  instanceClass?: string;
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
