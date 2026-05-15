import {
  DbAwsError,
  fetchRdsAuroraCloudWatchMetrics,
  fetchRdsAuroraInventory,
  syncRdsAuroraMetrics,
} from "../src/features/database/aws/index.js";
import { CloudConnectionV2, sequelize } from "../src/models/index.js";

type ScriptArgs = {
  tenantId: string;
  connectionId: string;
  roleSource: "billing" | "action" | "auto";
  region?: string;
  persist: boolean;
};

const parseArgs = (): ScriptArgs => {
  const args = process.argv.slice(2);
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "";
    if (value) values.set(key, value);
    else flags.add(key);
  }

  const tenantId = String(values.get("tenant-id") ?? "").trim();
  const connectionId = String(values.get("connection-id") ?? "").trim();
  const roleSourceRaw = String(values.get("role-source") ?? "auto").trim().toLowerCase();
  const region = String(values.get("region") ?? "").trim() || undefined;
  const persist = flags.has("persist");

  if (!tenantId || !connectionId) {
    throw new Error(
      "Usage: tsx scripts/verify-db-aws-rds-aurora-metrics.ts --tenant-id <uuid> --connection-id <uuid> [--role-source billing|action|auto] [--region <aws-region>] [--persist]",
    );
  }

  const roleSource =
    roleSourceRaw === "billing" || roleSourceRaw === "action" || roleSourceRaw === "auto"
      ? (roleSourceRaw as ScriptArgs["roleSource"])
      : "auto";

  return { tenantId, connectionId, roleSource, region, persist };
};

const pickRoleArn = (input: {
  roleSource: "billing" | "action" | "auto";
  billingRoleArn: string | null;
  actionRoleArn: string | null;
}): string => {
  if (input.roleSource === "billing") {
    if (!input.billingRoleArn) throw new Error("billingRoleArn is not configured");
    return input.billingRoleArn;
  }

  if (input.roleSource === "action") {
    if (!input.actionRoleArn) throw new Error("actionRoleArn is not configured");
    return input.actionRoleArn;
  }

  if (input.billingRoleArn) return input.billingRoleArn;
  if (input.actionRoleArn) return input.actionRoleArn;
  throw new Error("No usable role ARN on cloud connection");
};

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.persist) {
    const result = await syncRdsAuroraMetrics({
      tenantId: args.tenantId,
      cloudConnectionId: args.connectionId,
      roleSource: args.roleSource,
      region: args.region ?? null,
      dryRun: false,
    });

    console.info(
      JSON.stringify(
        {
          mode: "persist",
          tenantId: result.tenantId,
          connectionId: result.cloudConnectionId,
          roleSourceUsed: result.roleSourceUsed,
          regionResolved: result.regionResolved,
          fetchedInstances: result.fetchedInstances,
          fetchedClusters: result.fetchedClusters,
          metricsResources: result.metricsResources,
          usageDate: result.usageDate,
          persisted: result.persisted,
        },
        null,
        2,
      ),
    );
    return;
  }

  const connection = await CloudConnectionV2.findOne({
    where: { id: args.connectionId, tenantId: args.tenantId },
  });

  if (!connection) {
    throw new Error(`Cloud connection not found for tenant=${args.tenantId} connection=${args.connectionId}`);
  }

  const roleArn = pickRoleArn({
    roleSource: args.roleSource,
    billingRoleArn: connection.billingRoleArn,
    actionRoleArn: connection.actionRoleArn,
  });

  const inventory = await fetchRdsAuroraInventory({
    tenantId: args.tenantId,
    cloudConnectionId: args.connectionId,
    roleArn,
    externalId: connection.externalId,
    region: args.region ?? null,
    connectionRegion: connection.region,
    connectionExportRegion: connection.exportRegion,
  });

  const metrics = await fetchRdsAuroraCloudWatchMetrics({
    tenantId: args.tenantId,
    cloudConnectionId: args.connectionId,
    roleArn,
    externalId: connection.externalId,
    region: inventory.region,
    connectionRegion: connection.region,
    connectionExportRegion: connection.exportRegion,
    inventory: {
      instances: inventory.instances,
      clusters: inventory.clusters,
    },
  });

  console.info(
    JSON.stringify(
      {
        mode: "preview",
        tenantId: args.tenantId,
        connectionId: args.connectionId,
        regionResolved: metrics.region,
        fetchedInstances: inventory.instances.length,
        fetchedClusters: inventory.clusters.length,
        metricsResources: metrics.resources.length,
        usageDate: metrics.usageDate,
      },
      null,
      2,
    ),
  );

  const previewRows = metrics.resources.slice(0, 20).map((resource) => ({
    resourceId: resource.resourceId,
    resourceType: resource.resourceType,
    service: resource.service,
    cpuAvg: resource.metrics.cpuUtilization.average,
    cpuMax: resource.metrics.cpuUtilization.maximum,
    connectionsAvg: resource.metrics.databaseConnections.average,
    readIops: resource.metrics.readIops.average,
    writeIops: resource.metrics.writeIops.average,
    readThroughputBytes: resource.metrics.readThroughput.average,
    writeThroughputBytes: resource.metrics.writeThroughput.average,
    freeStorageSpaceBytes: resource.metrics.freeStorageSpace.average,
    volumeBytesUsed: resource.metrics.volumeBytesUsed.average,
    storageUsedGb: resource.storageUsedGb,
    sampleCount: resource.sampleCount,
  }));

  console.table(previewRows);

}

main()
  .catch((error: unknown) => {
    if (error instanceof DbAwsError) {
      console.error(
        JSON.stringify(
          {
            name: error.name,
            code: error.code,
            message: error.message,
            details: error.details ?? null,
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
      return;
    }

    console.error("Verification failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
