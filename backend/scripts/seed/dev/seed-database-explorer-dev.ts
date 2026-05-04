import util from "node:util";

import { CloudConnectionV2, DimRegion, FactDbResourceDaily, sequelize } from "../../../src/models/index.js";

type SeedMode = "upsert" | "cleanup";

type RegionKeys = {
  apSouth1: string;
  usEast1: string;
};

type ResourceTemplate = {
  resourceId: string;
  resourceName: string;
  dbService: string;
  dbEngine: string;
  regionCode: "ap-south-1" | "us-east-1";
  olderTotal: string;
  newerTotal: string;
  dataFootprintGbOlder: string;
  dataFootprintGbNewer: string;
  loadAvgOlder: string;
  loadAvgNewer: string;
  connectionsAvgOlder: string;
  connectionsAvgNewer: string;
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

const CONNECTION_NAME = "janu-674";
const ACTIVE_STATUSES = ["active", "active_with_warnings"] as const;

const RESOURCE_IDS = {
  auroraPgClusterApSouth1: "kcx-dev-dbexp-aurora-pg-cluster-ap-south-1",
  auroraPgInstanceApSouth1: "kcx-dev-dbexp-aurora-pg-instance-ap-south-1",
  rdsPostgresApSouth1: "kcx-dev-dbexp-rds-postgres-ap-south-1",
  rdsMysqlUsEast1: "kcx-dev-dbexp-rds-mysql-us-east-1",
  dynamodbOrdersUsEast1: "kcx-dev-dbexp-dynamodb-orders-us-east-1",
  elasticacheRedisApSouth1: "kcx-dev-dbexp-elasticache-redis-ap-south-1",
  memorydbRedisUsEast1: "kcx-dev-dbexp-memorydb-redis-us-east-1",
  documentdbMongoUsEast1: "kcx-dev-dbexp-documentdb-mongo-us-east-1",
  neptuneGraphUsEast1: "kcx-dev-dbexp-neptune-graph-us-east-1",
  timestreamMetricsUsEast1: "kcx-dev-dbexp-timestream-metrics-us-east-1",
  keyspacesCassandraUsEast1: "kcx-dev-dbexp-keyspaces-cassandra-us-east-1",
  redshiftWarehouseUsEast1: "kcx-dev-dbexp-redshift-warehouse-us-east-1",
} as const;

const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  {
    resourceId: RESOURCE_IDS.auroraPgClusterApSouth1,
    resourceName: "production-aurora-pg-cluster",
    dbService: "Aurora",
    dbEngine: "Aurora PostgreSQL",
    regionCode: "ap-south-1",
    olderTotal: "18.50",
    newerTotal: "22.40",
    dataFootprintGbOlder: "460.00",
    dataFootprintGbNewer: "492.00",
    loadAvgOlder: "2.70",
    loadAvgNewer: "3.10",
    connectionsAvgOlder: "140",
    connectionsAvgNewer: "168",
  },
  {
    resourceId: RESOURCE_IDS.auroraPgInstanceApSouth1,
    resourceName: "production-aurora-pg-instance-1",
    dbService: "Aurora",
    dbEngine: "Aurora PostgreSQL",
    regionCode: "ap-south-1",
    olderTotal: "8.20",
    newerTotal: "10.10",
    dataFootprintGbOlder: "220.00",
    dataFootprintGbNewer: "236.00",
    loadAvgOlder: "2.20",
    loadAvgNewer: "2.60",
    connectionsAvgOlder: "110",
    connectionsAvgNewer: "132",
  },
  {
    resourceId: RESOURCE_IDS.rdsPostgresApSouth1,
    resourceName: "customer-postgres-db",
    dbService: "AmazonRDS",
    dbEngine: "PostgreSQL",
    regionCode: "ap-south-1",
    olderTotal: "7.60",
    newerTotal: "9.30",
    dataFootprintGbOlder: "190.00",
    dataFootprintGbNewer: "208.00",
    loadAvgOlder: "1.90",
    loadAvgNewer: "2.30",
    connectionsAvgOlder: "92",
    connectionsAvgNewer: "108",
  },
  {
    resourceId: RESOURCE_IDS.rdsMysqlUsEast1,
    resourceName: "orders-mysql-db",
    dbService: "AmazonRDS",
    dbEngine: "MySQL",
    regionCode: "us-east-1",
    olderTotal: "5.40",
    newerTotal: "6.80",
    dataFootprintGbOlder: "160.00",
    dataFootprintGbNewer: "176.00",
    loadAvgOlder: "1.60",
    loadAvgNewer: "1.90",
    connectionsAvgOlder: "78",
    connectionsAvgNewer: "94",
  },
  {
    resourceId: RESOURCE_IDS.dynamodbOrdersUsEast1,
    resourceName: "orders-table",
    dbService: "DynamoDB",
    dbEngine: "Key-Value",
    regionCode: "us-east-1",
    olderTotal: "3.10",
    newerTotal: "4.20",
    dataFootprintGbOlder: "68.00",
    dataFootprintGbNewer: "79.00",
    loadAvgOlder: "0.90",
    loadAvgNewer: "1.10",
    connectionsAvgOlder: "22",
    connectionsAvgNewer: "30",
  },
  {
    resourceId: RESOURCE_IDS.elasticacheRedisApSouth1,
    resourceName: "session-cache-redis",
    dbService: "ElastiCache",
    dbEngine: "Redis",
    regionCode: "ap-south-1",
    olderTotal: "4.50",
    newerTotal: "5.70",
    dataFootprintGbOlder: "72.00",
    dataFootprintGbNewer: "88.00",
    loadAvgOlder: "1.40",
    loadAvgNewer: "1.70",
    connectionsAvgOlder: "124",
    connectionsAvgNewer: "146",
  },
  {
    resourceId: RESOURCE_IDS.memorydbRedisUsEast1,
    resourceName: "durable-redis-cluster",
    dbService: "MemoryDB",
    dbEngine: "Redis",
    regionCode: "us-east-1",
    olderTotal: "6.40",
    newerTotal: "8.10",
    dataFootprintGbOlder: "104.00",
    dataFootprintGbNewer: "121.00",
    loadAvgOlder: "1.70",
    loadAvgNewer: "2.00",
    connectionsAvgOlder: "116",
    connectionsAvgNewer: "138",
  },
  {
    resourceId: RESOURCE_IDS.documentdbMongoUsEast1,
    resourceName: "documentdb-customer-cluster",
    dbService: "DocumentDB",
    dbEngine: "MongoDB-compatible",
    regionCode: "us-east-1",
    olderTotal: "7.80",
    newerTotal: "9.60",
    dataFootprintGbOlder: "210.00",
    dataFootprintGbNewer: "228.00",
    loadAvgOlder: "1.50",
    loadAvgNewer: "1.80",
    connectionsAvgOlder: "72",
    connectionsAvgNewer: "86",
  },
  {
    resourceId: RESOURCE_IDS.neptuneGraphUsEast1,
    resourceName: "recommendation-graph-db",
    dbService: "Neptune",
    dbEngine: "Graph",
    regionCode: "us-east-1",
    olderTotal: "8.90",
    newerTotal: "11.20",
    dataFootprintGbOlder: "132.00",
    dataFootprintGbNewer: "148.00",
    loadAvgOlder: "1.60",
    loadAvgNewer: "1.95",
    connectionsAvgOlder: "44",
    connectionsAvgNewer: "56",
  },
  {
    resourceId: RESOURCE_IDS.timestreamMetricsUsEast1,
    resourceName: "metrics-timeseries-db",
    dbService: "Timestream",
    dbEngine: "Time Series",
    regionCode: "us-east-1",
    olderTotal: "2.20",
    newerTotal: "3.40",
    dataFootprintGbOlder: "48.00",
    dataFootprintGbNewer: "61.00",
    loadAvgOlder: "0.70",
    loadAvgNewer: "0.95",
    connectionsAvgOlder: "18",
    connectionsAvgNewer: "26",
  },
  {
    resourceId: RESOURCE_IDS.keyspacesCassandraUsEast1,
    resourceName: "event-keyspace-table",
    dbService: "Keyspaces",
    dbEngine: "Cassandra-compatible",
    regionCode: "us-east-1",
    olderTotal: "2.70",
    newerTotal: "3.80",
    dataFootprintGbOlder: "55.00",
    dataFootprintGbNewer: "67.00",
    loadAvgOlder: "0.80",
    loadAvgNewer: "1.00",
    connectionsAvgOlder: "20",
    connectionsAvgNewer: "28",
  },
  {
    resourceId: RESOURCE_IDS.redshiftWarehouseUsEast1,
    resourceName: "analytics-warehouse-cluster",
    dbService: "Redshift",
    dbEngine: "Data Warehouse",
    regionCode: "us-east-1",
    olderTotal: "16.50",
    newerTotal: "23.00",
    dataFootprintGbOlder: "520.00",
    dataFootprintGbNewer: "610.00",
    loadAvgOlder: "2.40",
    loadAvgNewer: "3.00",
    connectionsAvgOlder: "74",
    connectionsAvgNewer: "92",
  },
];

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
  const regionByCode = {
    "ap-south-1": regionKeys.apSouth1,
    "us-east-1": regionKeys.usEast1,
  } as const;

  const rows: SeedRowInput[] = [];
  for (const template of RESOURCE_TEMPLATES) {
    rows.push({
      usageDate: olderDate,
      resourceId: template.resourceId,
      resourceName: template.resourceName,
      dbService: template.dbService,
      dbEngine: template.dbEngine,
      regionKey: regionByCode[template.regionCode],
      dataFootprintGb: template.dataFootprintGbOlder,
      loadAvg: template.loadAvgOlder,
      connectionsAvg: template.connectionsAvgOlder,
      computeCost: (Number(template.olderTotal) * 0.6).toFixed(2),
      storageCost: (Number(template.olderTotal) * 0.25).toFixed(2),
      ioCost: (Number(template.olderTotal) * 0.1).toFixed(2),
      backupCost: (Number(template.olderTotal) * 0.05).toFixed(2),
    });

    rows.push({
      usageDate: newerDate,
      resourceId: template.resourceId,
      resourceName: template.resourceName,
      dbService: template.dbService,
      dbEngine: template.dbEngine,
      regionKey: regionByCode[template.regionCode],
      dataFootprintGb: template.dataFootprintGbNewer,
      loadAvg: template.loadAvgNewer,
      connectionsAvg: template.connectionsAvgNewer,
      computeCost: (Number(template.newerTotal) * 0.6).toFixed(2),
      storageCost: (Number(template.newerTotal) * 0.25).toFixed(2),
      ioCost: (Number(template.newerTotal) * 0.1).toFixed(2),
      backupCost: (Number(template.newerTotal) * 0.05).toFixed(2),
    });
  }

  return rows;
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
