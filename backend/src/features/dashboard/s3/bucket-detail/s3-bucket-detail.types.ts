import type { DashboardScope } from "../../dashboard.types.js";

export type S3BucketDetailChartPoint = {
  date: string;
  value: number | null;
};
export type S3BucketCostTrendPoint = {
  date: string;
  storageCost: number;
  requestCost: number;
  transferCost: number;
  otherCost: number;
};
export type S3BucketStorageClassPoint = {
  storageClass: string;
  bytes: number;
  objectCount: number | null;
};
export type S3BucketActivityOperation = "GET" | "PUT" | "LIST" | "DELETE" | "HEAD" | "COPY" | "Other";
export type S3BucketTransferType = "Upload" | "Download" | "Internal" | "Other";
export type S3BucketOptimizationOpportunity = {
  id: string;
  title: string;
  severity: "high" | "medium" | "low" | "info";
  category: "lifecycle" | "storage" | "activity" | "governance" | "replication" | "configuration";
  description: string;
  recommendation: string;
  estimatedSavings: number | null;
  source: string;
  evidence: Record<string, unknown>;
  action?: {
    type: "navigate";
    route: string;
    query: Record<string, string>;
    label: string;
  };
};

export type S3BucketDetailResponse = {
  section: "s3-bucket-detail";
  title: "S3 Bucket Detail";
  message: string;
  bucketName: string;
  metadata: {
    accountId: string | null;
    region: string | null;
    owner: string | null;
    environment: string | null;
    encryption: string | null;
    versioning: string | null;
    publicAccess: string | null;
  };
  objectInsights: {
    objectCount: number | null;
    avgObjectSize: number | null;
    currentVersionBytes: number | null;
    currentVersionBytesEstimated: boolean;
    requestsPerObject: number | null;
  };
  lifecycleInsight: {
    rulesCount: number;
    enabledRules: number;
    transitionCoverage: number;
    lastScan: string | null;
    status: string;
  };
  replicationInsight: {
    rulesCount: number;
    destinationBucket: string | null;
    destinationRegion: string | null;
    lastChecked: string | null;
    status: string;
  };
  usageMetrics: {
    storageGb: number | null;
    requestCount: number | null;
    transferGb: number | null;
    objectCount: number | null;
  };
  costBreakdown: {
    totalCost: number;
    storageCost: number;
    requestCost: number;
    transferCost: number;
    retrievalCost: number;
    otherCost: number;
    costTrendPct: number;
  };
  charts: {
    storageUsage: S3BucketDetailChartPoint[];
    requestUsage: S3BucketDetailChartPoint[];
    transferUsage: S3BucketDetailChartPoint[];
    costTrend: S3BucketCostTrendPoint[];
  };
  storageClassBreakdown: S3BucketStorageClassPoint[];
  activityUsage: {
    totalRequests: number;
    transferBytes: number | null;
    objectCount: number | null;
    averageObjectSizeBytes: number | null;
    requestBreakdown: Array<{
      operation: S3BucketActivityOperation;
      count: number;
      percentage: number;
    }>;
    requestBreakdownAvailable: boolean;
    transferBreakdown: Array<{
      type: S3BucketTransferType;
      bytes: number;
      percentage: number;
    }>;
    transferBreakdownAvailable: boolean;
    trends: {
      requests: "up" | "down" | "flat" | "unknown";
      transfer: "up" | "down" | "flat" | "unknown";
      storage: "up" | "down" | "flat" | "unknown";
    };
    insight: string | null;
    hasUsageData: boolean;
  };
  optimization: {
    opportunities: S3BucketOptimizationOpportunity[];
    totalCount: number;
  };
  configuration: {
    versioning: {
      status: "enabled" | "suspended" | "disabled" | "unknown";
    };
    encryption: {
      status: "enabled" | "disabled" | "unknown";
      type: "SSE-S3" | "SSE-KMS" | "Unknown" | null;
    };
    lifecycle: {
      enabled: boolean;
      ruleCount: number;
    };
    replication: {
      enabled: boolean;
      destinationRegion: string | null;
    };
    publicAccess: {
      status: "blocked" | "partial" | "public" | "unknown";
    };
    ownershipMetadata: {
      ownerAssigned: boolean;
      environmentAssigned: boolean;
    };
    bestPractices: {
      passed: number;
      total: number;
    };
    notes: string[];
  };
  filtersApplied: {
    from: string;
    to: string;
    scopeType: DashboardScope["scopeType"];
  };
};

