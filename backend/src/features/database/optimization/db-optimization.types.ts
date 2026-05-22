export type DbOptimizationActionsQuery = {
  tenantId: string;
  startDate: string;
  endDate: string;
  search?: string;
  regionKey?: string;
  dbService?: string;
  dbEngine?: string;
  resourceType?: string;
  status?: string;
  hasActions?: boolean;
  recommendationType?: string;
  page: number;
  pageSize: number;
};

export type DbOptimizationTopAction = {
  id: string;
  title: string;
  recommendationType: string;
  status: string;
  estimatedMonthlySavings: number;
  evidenceLevel: string | null;
  confidence: string | null;
};

export type DbOptimizationActionSummary = {
  activeCount: number;
  openCount: number;
  warningCount: number;
  types: string[];
  evidenceLevels: string[];
  maxConfidence: "high" | "medium" | "low" | null;
  estimatedMonthlySavingsTotal: number;
  topActions: DbOptimizationTopAction[];
};

export type DbOptimizationActionRow = {
  resourceId: string;
  cloudConnectionId: string | null;
  dbIdentifier: string;
  resourceName: string | null;
  resourceArn: string | null;
  dbService: string;
  dbEngine: string | null;
  dbEngineVersion: string | null;
  resourceType: string | null;
  instanceClass: string | null;
  regionId: string | null;
  regionName: string | null;
  subAccountId: string | null;
  subAccountName: string | null;
  clusterId: string | null;
  status: string | null;
  totalCost: number;
  currencyCode: string | null;
  avgCpu: number | null;
  maxCpu: number | null;
  avgConnections: number | null;
  maxConnections: number | null;
  avgIops: number | null;
  avgThroughputBytes: number | null;
  allocatedStorageGb: number | null;
  storageUsedGb: number | null;
  hasLiveInventory: boolean;
  inventorySource: "aws_sdk" | "billing_only" | "mixed";
  inventoryObservedAt: string | null;
  actionSummary: DbOptimizationActionSummary;
};

export type DbOptimizationActionsResponse = {
  items: DbOptimizationActionRow[];
  total: number;
  page: number;
  pageSize: number;
};

