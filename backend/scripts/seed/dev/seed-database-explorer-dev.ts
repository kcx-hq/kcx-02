import util from "node:util";

import { CloudConnectionV2, DimRegion, FactDbResourceDaily, sequelize } from "../../../src/models/index.js";

type SeedMode = "upsert" | "cleanup";

type RegionKeys = {
  apSouth1: string;
  usEast1: string;
};

type SeedRowInput = {
  usageDate: string;
  resourceId: string;
  resourceName: string;
  dbService: string;
  dbEngine: string;
  regionKey: string;
  dataFootprintGb: string;
  loadAvg: string;
  connectionsAvg: string;
  computeCost: string;
  storageCost: string;
  ioCost: string;
  backupCost: string;
};

const CONNECTION_NAME = "kcx-123";
const ACTIVE_STATUSES = ["active", "active_with_warnings"] as const;

const RESOURCE_IDS = {
  rdsOlder: "kcx-dev-dbexp-rds-aurora-ap-south-1-older",
  rdsNewer: "kcx-dev-dbexp-rds-aurora-ap-south-1-newer",
  dynamoNewer: "kcx-dev-dbexp-dynamodb-us-east-1-newer",
} as const;

const toDateOnlyUtc = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${value.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const shiftUtcDays = (base: Date, days: number): Date => {
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const parseMode = (): SeedMode => {
  const flags = new Set(process.argv.slice(2).map((value) => value.trim().toLowerCase()));
  if (flags.has("--cleanup")) return "cleanup";
  return "upsert";
};

async function resolveConnection() {
  const connection = await CloudConnectionV2.findOne({
    where: {
      connectionName: CONNECTION_NAME,
      status: ACTIVE_STATUSES as unknown as string[],
    },
    order: [["updatedAt", "DESC"]],
  });

  if (!connection) {
    throw new Error(
      `Active cloud connection '${CONNECTION_NAME}' was not found. Expected status in: ${ACTIVE_STATUSES.join(", ")}`,
    );
  }

  return connection;
}

async function resolveRegionKeys(providerId: string): Promise<RegionKeys> {
  const regionRows = await DimRegion.findAll({
    attributes: ["id", "regionId", "regionName"],
    where: {
      providerId,
    },
  });

  const byCode = new Map<string, string>();
  for (const row of regionRows) {
    const id = String(row.id);
    const regionId = String(row.regionId ?? "").trim().toLowerCase();
    const regionName = String(row.regionName ?? "").trim().toLowerCase();
    if (regionId) byCode.set(regionId, id);
    if (regionName) byCode.set(regionName, id);
  }

  const apSouth1 = byCode.get("ap-south-1");
  const usEast1 = byCode.get("us-east-1");

  if (!apSouth1 || !usEast1) {
    throw new Error(
      "Could not resolve dim_region keys for ap-south-1 and us-east-1. Ensure dim_region has these region_id values for the provider.",
    );
  }

  return { apSouth1, usEast1 };
}

function buildRows(regionKeys: RegionKeys): SeedRowInput[] {
  const today = new Date();
  const newerDate = toDateOnlyUtc(shiftUtcDays(today, -2));
  const olderDate = toDateOnlyUtc(shiftUtcDays(today, -7));

  return [
    {
      usageDate: olderDate,
      resourceId: RESOURCE_IDS.rdsOlder,
      resourceName: "KCX Dev RDS Aurora Older",
      dbService: "RDS",
      dbEngine: "aurora-postgresql",
      regionKey: regionKeys.apSouth1,
      dataFootprintGb: "120.50",
      loadAvg: "1.25",
      connectionsAvg: "42",
      computeCost: "18.50",
      storageCost: "3.20",
      ioCost: "1.10",
      backupCost: "0.80",
    },
    {
      usageDate: newerDate,
      resourceId: RESOURCE_IDS.rdsNewer,
      resourceName: "KCX Dev RDS Aurora Newer",
      dbService: "RDS",
      dbEngine: "aurora-postgresql",
      regionKey: regionKeys.apSouth1,
      dataFootprintGb: "140.25",
      loadAvg: "2.10",
      connectionsAvg: "68",
      computeCost: "42.00",
      storageCost: "6.50",
      ioCost: "2.80",
      backupCost: "1.70",
    },
    {
      usageDate: newerDate,
      resourceId: RESOURCE_IDS.dynamoNewer,
      resourceName: "KCX Dev DynamoDB Newer",
      dbService: "DynamoDB",
      dbEngine: "dynamodb",
      regionKey: regionKeys.usEast1,
      dataFootprintGb: "75.00",
      loadAvg: "1.60",
      connectionsAvg: "54",
      computeCost: "24.00",
      storageCost: "4.60",
      ioCost: "3.10",
      backupCost: "1.20",
    },
  ];
}

async function upsertRows(): Promise<void> {
  const connection = await resolveConnection();
  const tenantId = String(connection.tenantId);
  const cloudConnectionId = String(connection.id);
  const providerId = String(connection.providerId);
  const regionKeys = await resolveRegionKeys(providerId);
  const rows = buildRows(regionKeys);

  console.info("[db-explorer-seed] Resolved connection", {
    connectionName: CONNECTION_NAME,
    cloudConnectionId,
    tenantId,
    providerId,
    regionKeys,
  });

  let insertedOrUpdated = 0;
  for (const row of rows) {
    const total = (
      Number(row.computeCost) +
      Number(row.storageCost) +
      Number(row.ioCost) +
      Number(row.backupCost)
    ).toFixed(6);

    await FactDbResourceDaily.upsert({
      tenantId,
      cloudConnectionId,
      providerId,
      usageDate: row.usageDate,
      resourceId: row.resourceId,
      resourceName: row.resourceName,
      dbService: row.dbService,
      dbEngine: row.dbEngine,
      regionKey: row.regionKey,
      dataFootprintGb: row.dataFootprintGb,
      loadAvg: row.loadAvg,
      connectionsAvg: row.connectionsAvg,
      computeCost: row.computeCost,
      storageCost: row.storageCost,
      ioCost: row.ioCost,
      backupCost: row.backupCost,
      totalBilledCost: total,
      totalEffectiveCost: total,
      totalListCost: total,
      currencyCode: "USD",
      updatedAt: new Date(),
    } as never);

    insertedOrUpdated += 1;
  }

  console.info("[db-explorer-seed] Upsert complete", {
    insertedOrUpdated,
    rows: rows.map((row) => ({
      usageDate: row.usageDate,
      resourceId: row.resourceId,
      dbService: row.dbService,
      dbEngine: row.dbEngine,
      regionKey: row.regionKey,
    })),
  });

  console.info("[db-explorer-seed] Explorer test range", {
    start_date: rows[0]?.usageDate,
    end_date: rows[1]?.usageDate,
    cloud_connection_id: cloudConnectionId,
  });
}

async function cleanupRows(): Promise<void> {
  const connection = await resolveConnection();
  const tenantId = String(connection.tenantId);
  const cloudConnectionId = String(connection.id);

  const resourceIds = Object.values(RESOURCE_IDS);
  const deleted = await FactDbResourceDaily.destroy({
    where: {
      tenantId,
      cloudConnectionId,
      resourceId: resourceIds,
    },
  });

  console.info("[db-explorer-seed] Cleanup complete", {
    deleted,
    tenantId,
    cloudConnectionId,
    resourceIds,
  });
}

async function main(): Promise<void> {
  const mode = parseMode();
  console.info("[db-explorer-seed] Starting", { mode, connectionName: CONNECTION_NAME });

  if (mode === "cleanup") {
    await cleanupRows();
    return;
  }

  await upsertRows();
}

main()
  .catch((error: unknown) => {
    console.error("[db-explorer-seed] Failed", util.inspect(error, { depth: 10, colors: false }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
