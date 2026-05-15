import type { AwsDatabaseFamily, AwsDatabaseRegion, AwsDatabaseService } from "../../types/db-aws.types.js";

export type AwsDatabaseResourceTag = {
  key: string;
  value: string;
};

export type AwsRdsAuroraInventoryInstance = {
  provider: "aws";
  family: AwsDatabaseFamily;
  service: AwsDatabaseService;
  resourceType: "db_instance";
  dbInstanceIdentifier: string | null;
  dbInstanceArn: string | null;
  dbClusterIdentifier: string | null;
  dbClusterArn: string | null;
  engine: string | null;
  engineVersion: string | null;
  dbInstanceClass: string | null;
  dbInstanceStatus: string | null;
  region: AwsDatabaseRegion;
  availabilityZone: string | null;
  multiAz: boolean | null;
  publiclyAccessible: boolean | null;
  storageType: string | null;
  allocatedStorageGb: number | null;
  storageEncrypted: boolean | null;
  deletionProtection: boolean | null;
  backupRetentionPeriod: number | null;
  preferredBackupWindow: string | null;
  preferredMaintenanceWindow: string | null;
  endpointAddress: string | null;
  endpointPort: number | null;
  createdAt: string | null;
  tags: AwsDatabaseResourceTag[];
};

export type AwsRdsAuroraClusterMember = {
  dbInstanceIdentifier: string | null;
  isWriter: boolean | null;
  promotionTier: number | null;
};

export type AwsRdsAuroraServerlessV2ScalingConfiguration = {
  minCapacity: number | null;
  maxCapacity: number | null;
  secondsUntilAutoPause: number | null;
};

export type AwsRdsAuroraInventoryCluster = {
  provider: "aws";
  family: AwsDatabaseFamily;
  service: AwsDatabaseService;
  resourceType: "db_cluster";
  dbClusterIdentifier: string | null;
  dbClusterArn: string | null;
  engine: string | null;
  engineVersion: string | null;
  status: string | null;
  region: AwsDatabaseRegion;
  availabilityZones: string[];
  multiAz: boolean | null;
  members: AwsRdsAuroraClusterMember[];
  endpoint: string | null;
  readerEndpoint: string | null;
  port: number | null;
  storageEncrypted: boolean | null;
  deletionProtection: boolean | null;
  backupRetentionPeriod: number | null;
  preferredBackupWindow: string | null;
  preferredMaintenanceWindow: string | null;
  serverlessV2ScalingConfiguration: AwsRdsAuroraServerlessV2ScalingConfiguration | null;
  createdAt: string | null;
  tags: AwsDatabaseResourceTag[];
};

export type AwsRdsAuroraInventoryResult = {
  region: AwsDatabaseRegion;
  instances: AwsRdsAuroraInventoryInstance[];
  clusters: AwsRdsAuroraInventoryCluster[];
};
