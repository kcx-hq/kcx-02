import type { DashboardScope } from "../dashboard.types.js";

export type S3BucketDetailChartPoint = {
  date: string;
  value: number | null;
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
  charts: {
    storageUsage: S3BucketDetailChartPoint[];
    requestUsage: S3BucketDetailChartPoint[];
    transferUsage: S3BucketDetailChartPoint[];
  };
  filtersApplied: {
    from: string;
    to: string;
    scopeType: DashboardScope["scopeType"];
  };
};
