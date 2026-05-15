import {
  DescribeDBClustersCommand,
  DescribeDBInstancesCommand,
  type DBCluster,
  type DBClusterMember,
  type DBInstance,
  type RDSClient,
  type Tag,
} from "@aws-sdk/client-rds";

import { createAwsDatabaseClient } from "../../clients/db-aws-client.factory.js";
import { normalizeDbAwsError } from "../../errors/db-aws-error-normalizer.js";
import { DbAwsValidationError } from "../../errors/db-aws.errors.js";
import type { AwsDatabaseClientContext, AwsDatabaseFamily, AwsDatabaseService } from "../../types/db-aws.types.js";
import { collectAwsPages } from "../../utils/db-aws-pagination.utils.js";
import { parseAwsArn } from "../../utils/db-aws-arn.utils.js";
import type {
  AwsDatabaseResourceTag,
  AwsRdsAuroraClusterMember,
  AwsRdsAuroraInventoryCluster,
  AwsRdsAuroraInventoryInstance,
  AwsRdsAuroraInventoryResult,
  AwsRdsAuroraServerlessV2ScalingConfiguration,
} from "./rds-aurora-inventory.types.js";

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value !== "number") return null;
  return Number.isFinite(value) ? value : null;
};

const toBooleanOrNull = (value: unknown): boolean | null => {
  if (typeof value !== "boolean") return null;
  return value;
};

const toIsoOrNull = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const toTags = (tags: readonly Tag[] | undefined): AwsDatabaseResourceTag[] => {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => ({
      key: toStringOrNull(tag.Key),
      value: toStringOrNull(tag.Value),
    }))
    .filter((tag): tag is AwsDatabaseResourceTag => Boolean(tag.key));
};

const classifyService = (engine: string | null): AwsDatabaseService => {
  const normalized = String(engine ?? "").trim().toLowerCase();
  return normalized.startsWith("aurora") ? "aurora" : "rds";
};

const familyForService = (_service: AwsDatabaseService): AwsDatabaseFamily => "relational";

const mapClusterMember = (member: DBClusterMember): AwsRdsAuroraClusterMember => ({
  dbInstanceIdentifier: toStringOrNull(member.DBInstanceIdentifier),
  isWriter: toBooleanOrNull(member.IsClusterWriter),
  promotionTier: toNumberOrNull(member.PromotionTier),
});

const mapServerlessV2Scaling = (
  value: DBCluster["ServerlessV2ScalingConfiguration"],
): AwsRdsAuroraServerlessV2ScalingConfiguration | null => {
  if (!value) return null;
  return {
    minCapacity: toNumberOrNull(value.MinCapacity),
    maxCapacity: toNumberOrNull(value.MaxCapacity),
    secondsUntilAutoPause: toNumberOrNull(value.SecondsUntilAutoPause),
  };
};

const resolveRegionFromArn = (arn: string | null): string | null => {
  if (!arn) return null;
  const parsed = parseAwsArn(arn);
  return parsed?.region ? parsed.region : null;
};

const mapCluster = (cluster: DBCluster, defaultRegion: string): AwsRdsAuroraInventoryCluster => {
  const engine = toStringOrNull(cluster.Engine);
  const service = classifyService(engine);
  const clusterArn = toStringOrNull(cluster.DBClusterArn);
  return {
    provider: "aws",
    family: familyForService(service),
    service,
    resourceType: "db_cluster",
    dbClusterIdentifier: toStringOrNull(cluster.DBClusterIdentifier),
    dbClusterArn: clusterArn,
    engine,
    engineVersion: toStringOrNull(cluster.EngineVersion),
    status: toStringOrNull(cluster.Status),
    region: resolveRegionFromArn(clusterArn) ?? defaultRegion,
    availabilityZones: Array.isArray(cluster.AvailabilityZones)
      ? cluster.AvailabilityZones.map((value) => toStringOrNull(value)).filter((value): value is string => Boolean(value))
      : [],
    multiAz: toBooleanOrNull(cluster.MultiAZ),
    members: Array.isArray(cluster.DBClusterMembers) ? cluster.DBClusterMembers.map(mapClusterMember) : [],
    endpoint: toStringOrNull(cluster.Endpoint),
    readerEndpoint: toStringOrNull(cluster.ReaderEndpoint),
    port: toNumberOrNull(cluster.Port),
    storageEncrypted: toBooleanOrNull(cluster.StorageEncrypted),
    deletionProtection: toBooleanOrNull(cluster.DeletionProtection),
    backupRetentionPeriod: toNumberOrNull(cluster.BackupRetentionPeriod),
    preferredBackupWindow: toStringOrNull(cluster.PreferredBackupWindow),
    preferredMaintenanceWindow: toStringOrNull(cluster.PreferredMaintenanceWindow),
    serverlessV2ScalingConfiguration: mapServerlessV2Scaling(cluster.ServerlessV2ScalingConfiguration),
    createdAt: toIsoOrNull(cluster.ClusterCreateTime),
    tags: toTags(cluster.TagList),
  };
};

const mapInstance = (
  instance: DBInstance,
  defaultRegion: string,
  clusterArnByIdentifier: ReadonlyMap<string, string | null>,
): AwsRdsAuroraInventoryInstance => {
  const engine = toStringOrNull(instance.Engine);
  const service = classifyService(engine);
  const clusterIdentifier = toStringOrNull(instance.DBClusterIdentifier);
  const instanceArn = toStringOrNull(instance.DBInstanceArn);
  return {
    provider: "aws",
    family: familyForService(service),
    service,
    resourceType: "db_instance",
    dbInstanceIdentifier: toStringOrNull(instance.DBInstanceIdentifier),
    dbInstanceArn: instanceArn,
    dbClusterIdentifier: clusterIdentifier,
    dbClusterArn: clusterIdentifier ? clusterArnByIdentifier.get(clusterIdentifier) ?? null : null,
    engine,
    engineVersion: toStringOrNull(instance.EngineVersion),
    dbInstanceClass: toStringOrNull(instance.DBInstanceClass),
    dbInstanceStatus: toStringOrNull(instance.DBInstanceStatus),
    region: resolveRegionFromArn(instanceArn) ?? defaultRegion,
    availabilityZone: toStringOrNull(instance.AvailabilityZone),
    multiAz: toBooleanOrNull(instance.MultiAZ),
    publiclyAccessible: toBooleanOrNull(instance.PubliclyAccessible),
    storageType: toStringOrNull(instance.StorageType),
    allocatedStorageGb: toNumberOrNull(instance.AllocatedStorage),
    storageEncrypted: toBooleanOrNull(instance.StorageEncrypted),
    deletionProtection: toBooleanOrNull(instance.DeletionProtection),
    backupRetentionPeriod: toNumberOrNull(instance.BackupRetentionPeriod),
    preferredBackupWindow: toStringOrNull(instance.PreferredBackupWindow),
    preferredMaintenanceWindow: toStringOrNull(instance.PreferredMaintenanceWindow),
    endpointAddress: toStringOrNull(instance.Endpoint?.Address),
    endpointPort: toNumberOrNull(instance.Endpoint?.Port),
    createdAt: toIsoOrNull(instance.InstanceCreateTime),
    tags: toTags(instance.TagList),
  };
};

const listAllDbInstances = async (client: RDSClient): Promise<DBInstance[]> => {
  const pages = await collectAwsPages(async (nextToken?: string) => {
    const response = await client.send(
      new DescribeDBInstancesCommand({
        MaxRecords: 100,
        ...(nextToken ? { Marker: nextToken } : {}),
      }),
    );

    return {
      page: response,
      nextToken: response.Marker,
    };
  });

  return pages.flatMap((page) => (Array.isArray(page.DBInstances) ? page.DBInstances : []));
};

const listAllDbClusters = async (client: RDSClient): Promise<DBCluster[]> => {
  const pages = await collectAwsPages(async (nextToken?: string) => {
    const response = await client.send(
      new DescribeDBClustersCommand({
        MaxRecords: 100,
        ...(nextToken ? { Marker: nextToken } : {}),
      }),
    );

    return {
      page: response,
      nextToken: response.Marker,
    };
  });

  return pages.flatMap((page) => (Array.isArray(page.DBClusters) ? page.DBClusters : []));
};

export const fetchRdsAuroraInventory = async (
  context: AwsDatabaseClientContext,
): Promise<AwsRdsAuroraInventoryResult> => {
  const tenantId = toStringOrNull(context.tenantId);
  const cloudConnectionId = toStringOrNull(context.cloudConnectionId);

  if (!tenantId || !cloudConnectionId) {
    throw new DbAwsValidationError("tenantId and cloudConnectionId are required", {
      tenantId: context.tenantId,
      cloudConnectionId: context.cloudConnectionId,
    });
  }

  let client: RDSClient;
  try {
    client = await createAwsDatabaseClient<RDSClient>({
      kind: "rds",
      context,
    });
  } catch (error) {
    throw normalizeDbAwsError(error, {
      tenantId,
      cloudConnectionId,
      stage: "create_rds_client",
    });
  }

  try {
    const [rawInstances, rawClusters] = await Promise.all([
      listAllDbInstances(client),
      listAllDbClusters(client),
    ]);

    const clusterArnByIdentifier = new Map<string, string | null>();
    for (const cluster of rawClusters) {
      const identifier = toStringOrNull(cluster.DBClusterIdentifier);
      if (!identifier) continue;
      clusterArnByIdentifier.set(identifier, toStringOrNull(cluster.DBClusterArn));
    }

    const defaultRegion = toStringOrNull(context.region)
      ?? toStringOrNull(context.connectionRegion)
      ?? toStringOrNull(context.connectionExportRegion)
      ?? "us-east-1";

    const clusters = rawClusters.map((cluster) => mapCluster(cluster, defaultRegion));
    const instances = rawInstances.map((instance) => mapInstance(instance, defaultRegion, clusterArnByIdentifier));

    return {
      region: defaultRegion,
      instances,
      clusters,
    };
  } catch (error) {
    throw normalizeDbAwsError(error, {
      tenantId,
      cloudConnectionId,
      stage: "fetch_rds_aurora_inventory",
    });
  }
};
