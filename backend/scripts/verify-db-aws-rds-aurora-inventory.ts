import { fetchRdsAuroraInventory, DbAwsError } from "../src/features/database/aws/index.js";
import { CloudConnectionV2, sequelize } from "../src/models/index.js";

type ScriptArgs = {
  tenantId: string;
  connectionId: string;
  region?: string;
  roleSource: "billing" | "action" | "auto";
};

const parseArgs = (): ScriptArgs => {
  const argv = process.argv.slice(2);
  const map = new Map<string, string>();

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "";
    map.set(key, value);
  }

  const tenantId = String(map.get("tenant-id") ?? "").trim();
  const connectionId = String(map.get("connection-id") ?? "").trim();
  const region = String(map.get("region") ?? "").trim() || undefined;
  const roleSourceRaw = String(map.get("role-source") ?? "auto").trim().toLowerCase();

  if (!tenantId || !connectionId) {
    throw new Error(
      "Missing required args. Usage: tsx scripts/verify-db-aws-rds-aurora-inventory.ts --tenant-id <uuid> --connection-id <uuid> [--region <aws-region>] [--role-source billing|action|auto]",
    );
  }

  const roleSource =
    roleSourceRaw === "billing" || roleSourceRaw === "action" || roleSourceRaw === "auto"
      ? (roleSourceRaw as ScriptArgs["roleSource"])
      : "auto";

  return { tenantId, connectionId, region, roleSource };
};

const pickRoleArn = (input: {
  billingRoleArn: string | null;
  actionRoleArn: string | null;
  roleSource: ScriptArgs["roleSource"];
}): { roleArn: string; roleSourceUsed: "billing" | "action" } => {
  const billingRoleArn = String(input.billingRoleArn ?? "").trim() || null;
  const actionRoleArn = String(input.actionRoleArn ?? "").trim() || null;

  if (input.roleSource === "billing") {
    if (!billingRoleArn) throw new Error("billingRoleArn is not configured on this connection");
    return { roleArn: billingRoleArn, roleSourceUsed: "billing" };
  }

  if (input.roleSource === "action") {
    if (!actionRoleArn) throw new Error("actionRoleArn is not configured on this connection");
    return { roleArn: actionRoleArn, roleSourceUsed: "action" };
  }

  if (billingRoleArn) return { roleArn: billingRoleArn, roleSourceUsed: "billing" };
  if (actionRoleArn) return { roleArn: actionRoleArn, roleSourceUsed: "action" };

  throw new Error("No usable role ARN found on this connection (billingRoleArn/actionRoleArn missing)");
};

const shortResourceRows = (
  instances: Awaited<ReturnType<typeof fetchRdsAuroraInventory>>["instances"],
  clusters: Awaited<ReturnType<typeof fetchRdsAuroraInventory>>["clusters"],
): Array<Record<string, unknown>> => {
  const instanceRows = instances.map((item) => ({
    kind: "instance",
    service: item.service,
    identifier: item.dbInstanceIdentifier,
    cluster: item.dbClusterIdentifier,
    engine: item.engine,
    status: item.dbInstanceStatus,
    class: item.dbInstanceClass,
    region: item.region,
    az: item.availabilityZone,
    endpoint: item.endpointAddress,
    port: item.endpointPort,
  }));

  const clusterRows = clusters.map((item) => ({
    kind: "cluster",
    service: item.service,
    identifier: item.dbClusterIdentifier,
    cluster: item.dbClusterIdentifier,
    engine: item.engine,
    status: item.status,
    class: null,
    region: item.region,
    az: item.availabilityZones.join(","),
    endpoint: item.endpoint,
    port: item.port,
  }));

  return [...instanceRows, ...clusterRows];
};

async function main(): Promise<void> {
  const args = parseArgs();

  const connection = await CloudConnectionV2.findOne({
    where: {
      id: args.connectionId,
      tenantId: args.tenantId,
    },
  });

  if (!connection) {
    throw new Error(`Cloud connection not found for tenantId=${args.tenantId}, connectionId=${args.connectionId}`);
  }

  const { roleArn, roleSourceUsed } = pickRoleArn({
    billingRoleArn: connection.billingRoleArn,
    actionRoleArn: connection.actionRoleArn,
    roleSource: args.roleSource,
  });

  const externalId = String(connection.externalId ?? "").trim() || null;

  const inventory = await fetchRdsAuroraInventory({
    tenantId: args.tenantId,
    cloudConnectionId: args.connectionId,
    roleArn,
    externalId,
    region: args.region ?? null,
    connectionRegion: connection.region,
    connectionExportRegion: connection.exportRegion,
  });

  console.info("RDS/Aurora inventory verification summary");
  console.info(
    JSON.stringify(
      {
        tenantId: args.tenantId,
        connectionId: args.connectionId,
        connectionName: connection.connectionName,
        roleSourceUsed,
        regionResolved: inventory.region,
        dbInstances: inventory.instances.length,
        dbClusters: inventory.clusters.length,
      },
      null,
      2,
    ),
  );

  const rows = shortResourceRows(inventory.instances, inventory.clusters);
  if (rows.length === 0) {
    console.info("No RDS/Aurora resources found.");
  } else {
    console.table(rows);
  }
}

main()
  .catch((error: unknown) => {
    if (error instanceof DbAwsError) {
      console.error("DB AWS error:");
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
