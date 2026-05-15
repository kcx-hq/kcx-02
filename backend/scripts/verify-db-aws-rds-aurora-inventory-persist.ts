import {
  fetchRdsAuroraInventory,
  type AwsRdsAuroraInventoryCluster,
  type AwsRdsAuroraInventoryInstance,
  DbAwsError,
  mapRdsAuroraClusterToSnapshot,
  mapRdsAuroraInstanceToSnapshot,
  syncRdsAuroraInventory,
} from "../src/features/database/aws/index.js";
import { CloudConnectionV2, sequelize } from "../src/models/index.js";

type ScriptArgs = {
  tenantId: string;
  connectionId: string;
  roleSource: "billing" | "action" | "auto";
  region?: string;
  dryRun: boolean;
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
  const dryRun = flags.has("dry-run");

  if (!tenantId || !connectionId) {
    throw new Error(
      "Usage: tsx scripts/verify-db-aws-rds-aurora-inventory-persist.ts --tenant-id <uuid> --connection-id <uuid> [--role-source billing|action|auto] [--region <aws-region>] [--dry-run]",
    );
  }

  const roleSource =
    roleSourceRaw === "billing" || roleSourceRaw === "action" || roleSourceRaw === "auto"
      ? (roleSourceRaw as ScriptArgs["roleSource"])
      : "auto";

  return { tenantId, connectionId, roleSource, region, dryRun };
};

const summarizeResources = (
  instances: AwsRdsAuroraInventoryInstance[],
  clusters: AwsRdsAuroraInventoryCluster[],
): Array<Record<string, unknown>> => {
  const instanceRows = instances.map((item) => ({
    kind: "instance",
    identifier: item.dbInstanceIdentifier,
    service: item.service,
    engine: item.engine,
    status: item.dbInstanceStatus,
    cluster: item.dbClusterIdentifier,
    arn: item.dbInstanceArn,
  }));

  const clusterRows = clusters.map((item) => ({
    kind: "cluster",
    identifier: item.dbClusterIdentifier,
    service: item.service,
    engine: item.engine,
    status: item.status,
    cluster: item.dbClusterIdentifier,
    arn: item.dbClusterArn,
  }));

  return [...instanceRows, ...clusterRows];
};

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.dryRun) {
    const connection = await CloudConnectionV2.findOne({
      where: { id: args.connectionId, tenantId: args.tenantId },
    });

    if (!connection) {
      throw new Error(`Cloud connection not found for tenant=${args.tenantId} connection=${args.connectionId}`);
    }

    const roleArn =
      args.roleSource === "billing"
        ? connection.billingRoleArn
        : args.roleSource === "action"
          ? connection.actionRoleArn
          : connection.billingRoleArn ?? connection.actionRoleArn;

    if (!roleArn) {
      throw new Error("No usable role ARN on connection");
    }

    const inventory = await fetchRdsAuroraInventory({
      tenantId: args.tenantId,
      cloudConnectionId: args.connectionId,
      roleArn,
      externalId: connection.externalId,
      region: args.region ?? null,
      connectionRegion: connection.region,
      connectionExportRegion: connection.exportRegion,
    });

    const mappedInstances = inventory.instances
      .map(mapRdsAuroraInstanceToSnapshot)
      .filter((row): row is NonNullable<ReturnType<typeof mapRdsAuroraInstanceToSnapshot>> => Boolean(row));
    const mappedClusters = inventory.clusters
      .map(mapRdsAuroraClusterToSnapshot)
      .filter((row): row is NonNullable<ReturnType<typeof mapRdsAuroraClusterToSnapshot>> => Boolean(row));

    console.info(
      JSON.stringify(
        {
          mode: "dry-run",
          tenantId: args.tenantId,
          connectionId: args.connectionId,
          regionResolved: inventory.region,
          fetchedInstances: inventory.instances.length,
          fetchedClusters: inventory.clusters.length,
          mappedInstances: mappedInstances.length,
          mappedClusters: mappedClusters.length,
          metadataOnlyFields: [
            "availabilityZone(s)",
            "endpoint(s)",
            "members",
            "serverlessV2ScalingConfiguration",
            "backup/deletion protection",
          ],
          sampleMapped: [...mappedInstances, ...mappedClusters].slice(0, 5),
        },
        null,
        2,
      ),
    );

    console.table(summarizeResources(inventory.instances, inventory.clusters));
    return;
  }

  const result = await syncRdsAuroraInventory({
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
        persisted: result.persisted,
      },
      null,
      2,
    ),
  );
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
