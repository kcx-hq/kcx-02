import type { AwsDatabaseRegion, AwsDatabaseService } from "../../types/db-aws.types.js";

export type RdsAuroraMetricResourceType = "db_instance" | "db_cluster";

export type RdsAuroraMetricStatSummary = {
  average: number | null;
  maximum: number | null;
  sampleCount: number;
};

export type RdsAuroraMetricsByName = {
  cpuUtilization: RdsAuroraMetricStatSummary;
  databaseConnections: RdsAuroraMetricStatSummary;
  readIops: RdsAuroraMetricStatSummary;
  writeIops: RdsAuroraMetricStatSummary;
  readThroughput: RdsAuroraMetricStatSummary;
  writeThroughput: RdsAuroraMetricStatSummary;
  freeStorageSpace: RdsAuroraMetricStatSummary;
  volumeBytesUsed: RdsAuroraMetricStatSummary;
};

export type RdsAuroraNormalizedMetricsResource = {
  resourceId: string;
  resourceName: string | null;
  resourceType: RdsAuroraMetricResourceType;
  service: AwsDatabaseService;
  engine: string | null;
  region: AwsDatabaseRegion;
  usageDate: string;
  allocatedStorageGb: number | null;
  storageUsedGb: number | null;
  metrics: RdsAuroraMetricsByName;
  sampleCount: number;
  metricSource: "cloudwatch";
};

export type RdsAuroraMetricsFetchWindow = {
  startTime: Date;
  endTime: Date;
  periodSeconds: number;
};

export type FetchRdsAuroraMetricsInput = {
  tenantId: string;
  cloudConnectionId: string;
  roleArn: string;
  externalId?: string | null;
  region?: string | null;
  connectionRegion?: string | null;
  connectionExportRegion?: string | null;
  staticCredentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string | null;
  } | null;
  inventory: {
    instances: Array<{
      dbInstanceIdentifier: string | null;
      dbInstanceArn: string | null;
      engine: string | null;
      service: AwsDatabaseService;
      region: string;
      allocatedStorageGb: number | null;
    }>;
    clusters: Array<{
      dbClusterIdentifier: string | null;
      dbClusterArn: string | null;
      engine: string | null;
      service: AwsDatabaseService;
      region: string;
    }>;
  };
  window?: Partial<RdsAuroraMetricsFetchWindow>;
};

export type FetchRdsAuroraMetricsResult = {
  region: AwsDatabaseRegion;
  usageDate: string;
  window: RdsAuroraMetricsFetchWindow;
  resources: RdsAuroraNormalizedMetricsResource[];
};
