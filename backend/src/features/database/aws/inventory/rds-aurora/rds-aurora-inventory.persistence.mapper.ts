import type {
  AwsRdsAuroraInventoryCluster,
  AwsRdsAuroraInventoryInstance,
} from "./rds-aurora-inventory.types.js";

type PersistableSnapshotRow = {
  resourceId: string;
  resourceArn: string | null;
  resourceName: string | null;
  dbService: string;
  dbEngine: string | null;
  dbEngineVersion: string | null;
  resourceType: string;
  status: string | null;
  allocatedStorageGb: number | null;
  dataFootprintGb: number | null;
  instanceClass: string | null;
  capacityMode: string | null;
  clusterId: string | null;
  isClusterResource: boolean;
  tagsJson: Record<string, string>;
  metadataJson: Record<string, unknown>;
};

const toTagRecord = (tags: Array<{ key: string; value: string }>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const tag of tags) {
    const key = String(tag.key ?? "").trim();
    if (!key) continue;
    out[key] = String(tag.value ?? "");
  }
  return out;
};

const normalizeResourceId = (value: string | null): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

export const mapRdsAuroraInstanceToSnapshot = (
  item: AwsRdsAuroraInventoryInstance,
): PersistableSnapshotRow | null => {
  const resourceId = normalizeResourceId(item.dbInstanceArn ?? item.dbInstanceIdentifier);
  if (!resourceId) return null;

  return {
    resourceId,
    resourceArn: item.dbInstanceArn,
    resourceName: item.dbInstanceIdentifier,
    dbService: item.service,
    dbEngine: item.engine,
    dbEngineVersion: item.engineVersion,
    resourceType: item.resourceType,
    status: item.dbInstanceStatus,
    allocatedStorageGb: item.allocatedStorageGb,
    dataFootprintGb: null,
    instanceClass: item.dbInstanceClass,
    capacityMode: null,
    clusterId: item.dbClusterIdentifier,
    isClusterResource: Boolean(item.dbClusterIdentifier),
    tagsJson: toTagRecord(item.tags),
    metadataJson: {
      provider: item.provider,
      family: item.family,
      region: item.region,
      availabilityZone: item.availabilityZone,
      multiAz: item.multiAz,
      publiclyAccessible: item.publiclyAccessible,
      storageType: item.storageType,
      storageEncrypted: item.storageEncrypted,
      deletionProtection: item.deletionProtection,
      backupRetentionPeriod: item.backupRetentionPeriod,
      preferredBackupWindow: item.preferredBackupWindow,
      preferredMaintenanceWindow: item.preferredMaintenanceWindow,
      endpointAddress: item.endpointAddress,
      endpointPort: item.endpointPort,
      createdAt: item.createdAt,
      dbClusterArn: item.dbClusterArn,
      sourceResourceType: "db_instance",
    },
  };
};

export const mapRdsAuroraClusterToSnapshot = (
  item: AwsRdsAuroraInventoryCluster,
): PersistableSnapshotRow | null => {
  const resourceId = normalizeResourceId(item.dbClusterArn ?? item.dbClusterIdentifier);
  if (!resourceId) return null;

  return {
    resourceId,
    resourceArn: item.dbClusterArn,
    resourceName: item.dbClusterIdentifier,
    dbService: item.service,
    dbEngine: item.engine,
    dbEngineVersion: item.engineVersion,
    resourceType: item.resourceType,
    status: item.status,
    allocatedStorageGb: null,
    dataFootprintGb: null,
    instanceClass: null,
    capacityMode: item.serverlessV2ScalingConfiguration ? "serverless_v2" : null,
    clusterId: item.dbClusterIdentifier,
    isClusterResource: true,
    tagsJson: toTagRecord(item.tags),
    metadataJson: {
      provider: item.provider,
      family: item.family,
      region: item.region,
      availabilityZones: item.availabilityZones,
      multiAz: item.multiAz,
      members: item.members,
      endpoint: item.endpoint,
      readerEndpoint: item.readerEndpoint,
      port: item.port,
      storageEncrypted: item.storageEncrypted,
      deletionProtection: item.deletionProtection,
      backupRetentionPeriod: item.backupRetentionPeriod,
      preferredBackupWindow: item.preferredBackupWindow,
      preferredMaintenanceWindow: item.preferredMaintenanceWindow,
      serverlessV2ScalingConfiguration: item.serverlessV2ScalingConfiguration,
      createdAt: item.createdAt,
      sourceResourceType: "db_cluster",
    },
  };
};

export type { PersistableSnapshotRow };
