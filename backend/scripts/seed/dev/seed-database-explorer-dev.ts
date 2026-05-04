import util from "node:util";
import { Op } from "sequelize";

import { CloudConnectionV2, DimRegion, FactDbResourceDaily, sequelize } from "../../../src/models/index.js";

type SeedMode = "upsert" | "cleanup";
type RegionCode = "us-east-1" | "ap-south-1" | "eu-west-1";

type RegionKeys = {
  usEast1: string;
  apSouth1: string;
  euWest1: string;
};

type ResourceTemplate = {
  resourceId: string;
  resourceName: string;
  dbService: "Aurora" | "AmazonRDS" | "DynamoDB" | "ElastiCache" | "Redshift" | "DocumentDB" | "Neptune";
  dbEngine:
    | "Aurora PostgreSQL"
    | "PostgreSQL"
    | "MySQL"
    | "Key-Value"
    | "Redis"
    | "Data Warehouse"
    | "MongoDB-compatible"
    | "Graph";
  regionCode: RegionCode;
  baseDailyCost: number;
  trendPerDay: number;
  spikeDays: ReadonlySet<string>;
  spikeMultiplier: number;
  weekendMultiplier: number;
  loadBase: number;
  loadTrendPerDay: number;
  connectionsBase: number;
  connectionsTrendPerDay: number;
  footprintBaseGb: number;
  footprintTrendPerDay: number;
  readThroughputBaseBytes: number;
  writeThroughputBaseBytes: number;
};

type SeedRowInput = {
  usageDate: string;
  resourceId: string;
  resourceName: string;
  dbService: ResourceTemplate["dbService"];
  dbEngine: ResourceTemplate["dbEngine"];
  regionKey: string;
  dataFootprintGb: string;
  loadAvg: string;
  connectionsAvg: string;
  connectionsMax: string;
  readThroughputBytes: string;
  writeThroughputBytes: string;
  computeCost: string;
  storageCost: string;
  ioCost: string;
  backupCost: string;
  totalBilledCost: string;
};

const CONNECTION_NAME = "janu-674";
const ACTIVE_STATUSES = ["active", "active_with_warnings"] as const;

const CURRENT_PERIOD_START = "2026-04-01";
const CURRENT_PERIOD_END = "2026-04-30";
const PREVIOUS_PERIOD_START = "2026-03-01";
const PREVIOUS_PERIOD_END = "2026-03-31";

const RESOURCE_IDS = {
  auroraPgClusterUsEast1: "kcx-dev-dbexp-aurora-pg-cluster-us-east-1",
  rdsPostgresApSouth1: "kcx-dev-dbexp-rds-postgres-ap-south-1",
  rdsMysqlEuWest1: "kcx-dev-dbexp-rds-mysql-eu-west-1",
  dynamodbOrdersUsEast1: "kcx-dev-dbexp-dynamodb-orders-us-east-1",
  elasticacheRedisApSouth1: "kcx-dev-dbexp-elasticache-redis-ap-south-1",
  redshiftWarehouseEuWest1: "kcx-dev-dbexp-redshift-warehouse-eu-west-1",
  documentdbCustomerUsEast1: "kcx-dev-dbexp-documentdb-customer-us-east-1",
  neptuneGraphEuWest1: "kcx-dev-dbexp-neptune-graph-eu-west-1",
} as const;

const GLOBAL_SPIKE_DAYS = new Set(["2026-03-17", "2026-04-11", "2026-04-24"]);

const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  {
    resourceId: RESOURCE_IDS.auroraPgClusterUsEast1,
    resourceName: "aurora-orders-cluster",
    dbService: "Aurora",
    dbEngine: "Aurora PostgreSQL",
    regionCode: "us-east-1",
    baseDailyCost: 26.4,
    trendPerDay: 0.21,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.28,
    weekendMultiplier: 0.9,
    loadBase: 2.45,
    loadTrendPerDay: 0.016,
    connectionsBase: 142,
    connectionsTrendPerDay: 1.45,
    footprintBaseGb: 530,
    footprintTrendPerDay: 1.95,
    readThroughputBaseBytes: 98000000,
    writeThroughputBaseBytes: 53000000,
  },
  {
    resourceId: RESOURCE_IDS.rdsPostgresApSouth1,
    resourceName: "rds-customer-postgres",
    dbService: "AmazonRDS",
    dbEngine: "PostgreSQL",
    regionCode: "ap-south-1",
    baseDailyCost: 14.7,
    trendPerDay: 0.14,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.24,
    weekendMultiplier: 0.91,
    loadBase: 1.86,
    loadTrendPerDay: 0.013,
    connectionsBase: 96,
    connectionsTrendPerDay: 1.05,
    footprintBaseGb: 265,
    footprintTrendPerDay: 1.15,
    readThroughputBaseBytes: 52000000,
    writeThroughputBaseBytes: 27000000,
  },
  {
    resourceId: RESOURCE_IDS.rdsMysqlEuWest1,
    resourceName: "rds-orders-mysql",
    dbService: "AmazonRDS",
    dbEngine: "MySQL",
    regionCode: "eu-west-1",
    baseDailyCost: 11.9,
    trendPerDay: 0.11,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.2,
    weekendMultiplier: 0.92,
    loadBase: 1.58,
    loadTrendPerDay: 0.012,
    connectionsBase: 84,
    connectionsTrendPerDay: 0.95,
    footprintBaseGb: 224,
    footprintTrendPerDay: 1.05,
    readThroughputBaseBytes: 44000000,
    writeThroughputBaseBytes: 23000000,
  },
  {
    resourceId: RESOURCE_IDS.dynamodbOrdersUsEast1,
    resourceName: "dynamodb-orders-table",
    dbService: "DynamoDB",
    dbEngine: "Key-Value",
    regionCode: "us-east-1",
    baseDailyCost: 9.4,
    trendPerDay: 0.08,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.22,
    weekendMultiplier: 0.93,
    loadBase: 1.22,
    loadTrendPerDay: 0.01,
    connectionsBase: 48,
    connectionsTrendPerDay: 0.6,
    footprintBaseGb: 88,
    footprintTrendPerDay: 0.62,
    readThroughputBaseBytes: 41000000,
    writeThroughputBaseBytes: 19000000,
  },
  {
    resourceId: RESOURCE_IDS.elasticacheRedisApSouth1,
    resourceName: "elasticache-session-redis",
    dbService: "ElastiCache",
    dbEngine: "Redis",
    regionCode: "ap-south-1",
    baseDailyCost: 10.8,
    trendPerDay: 0.09,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.19,
    weekendMultiplier: 0.9,
    loadBase: 1.48,
    loadTrendPerDay: 0.011,
    connectionsBase: 118,
    connectionsTrendPerDay: 1.15,
    footprintBaseGb: 142,
    footprintTrendPerDay: 0.86,
    readThroughputBaseBytes: 62000000,
    writeThroughputBaseBytes: 28000000,
  },
  {
    resourceId: RESOURCE_IDS.redshiftWarehouseEuWest1,
    resourceName: "redshift-analytics-warehouse",
    dbService: "Redshift",
    dbEngine: "Data Warehouse",
    regionCode: "eu-west-1",
    baseDailyCost: 24.1,
    trendPerDay: 0.23,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.27,
    weekendMultiplier: 0.89,
    loadBase: 2.18,
    loadTrendPerDay: 0.015,
    connectionsBase: 68,
    connectionsTrendPerDay: 0.85,
    footprintBaseGb: 612,
    footprintTrendPerDay: 2.05,
    readThroughputBaseBytes: 88000000,
    writeThroughputBaseBytes: 47000000,
  },
  {
    resourceId: RESOURCE_IDS.documentdbCustomerUsEast1,
    resourceName: "documentdb-customer-cluster",
    dbService: "DocumentDB",
    dbEngine: "MongoDB-compatible",
    regionCode: "us-east-1",
    baseDailyCost: 15.3,
    trendPerDay: 0.13,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.22,
    weekendMultiplier: 0.91,
    loadBase: 1.72,
    loadTrendPerDay: 0.012,
    connectionsBase: 74,
    connectionsTrendPerDay: 0.78,
    footprintBaseGb: 284,
    footprintTrendPerDay: 1.22,
    readThroughputBaseBytes: 57000000,
    writeThroughputBaseBytes: 26000000,
  },
  {
    resourceId: RESOURCE_IDS.neptuneGraphEuWest1,
    resourceName: "neptune-recommendation-graph",
    dbService: "Neptune",
    dbEngine: "Graph",
    regionCode: "eu-west-1",
    baseDailyCost: 12.4,
    trendPerDay: 0.1,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.2,
    weekendMultiplier: 0.92,
    loadBase: 1.34,
    loadTrendPerDay: 0.011,
    connectionsBase: 54,
    connectionsTrendPerDay: 0.66,
    footprintBaseGb: 176,
    footprintTrendPerDay: 0.95,
    readThroughputBaseBytes: 46000000,
    writeThroughputBaseBytes: 21000000,
  },
];

const toFixed = (value: number, digits = 6): string => value.toFixed(digits);

const toDateOnlyUtc = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${value.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateOnlyUtc = (dateOnly: string): Date => {
  const [year, month, day] = dateOnly.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day));
};

const buildDateRange = (startDate: string, endDate: string): string[] => {
  const start = parseDateOnlyUtc(startDate);
  const end = parseDateOnlyUtc(endDate);
  const dates: string[] = [];
  for (let cursor = new Date(start.getTime()); cursor.getTime() <= end.getTime(); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(toDateOnlyUtc(cursor));
  }
  return dates;
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
  const euWest1 = byCode.get("eu-west-1");

  if (!apSouth1 || !usEast1 || !euWest1) {
    throw new Error(
      "Could not resolve dim_region keys for ap-south-1, us-east-1, eu-west-1. Ensure dim_region has these region_id values for the provider.",
    );
  }

  return { apSouth1, usEast1, euWest1 };
}

const resolveRegionKey = (regionCode: RegionCode, regionKeys: RegionKeys): string => {
  if (regionCode === "ap-south-1") return regionKeys.apSouth1;
  if (regionCode === "eu-west-1") return regionKeys.euWest1;
  return regionKeys.usEast1;
};

const calcWeekendMultiplier = (dateOnly: string, baseMultiplier: number): number => {
  const date = parseDateOnlyUtc(dateOnly);
  const day = date.getUTCDay();
  return day === 0 || day === 6 ? baseMultiplier : 1;
};

const calcRegionMultiplier = (regionCode: RegionCode): number => {
  if (regionCode === "ap-south-1") return 1.06;
  if (regionCode === "eu-west-1") return 1.11;
  return 1;
};

function buildRows(regionKeys: RegionKeys): SeedRowInput[] {
  const previousDates = buildDateRange(PREVIOUS_PERIOD_START, PREVIOUS_PERIOD_END);
  const currentDates = buildDateRange(CURRENT_PERIOD_START, CURRENT_PERIOD_END);
  const allDates = [...previousDates, ...currentDates];
  const rows: SeedRowInput[] = [];

  for (const template of RESOURCE_TEMPLATES) {
    for (let index = 0; index < allDates.length; index += 1) {
      const usageDate = allDates[index];
      const weekendMultiplier = calcWeekendMultiplier(usageDate, template.weekendMultiplier);
      const regionMultiplier = calcRegionMultiplier(template.regionCode);
      const spikeMultiplier = template.spikeDays.has(usageDate) ? template.spikeMultiplier : 1;

      const dailyCostRaw =
        (template.baseDailyCost + template.trendPerDay * index) *
        weekendMultiplier *
        regionMultiplier *
        spikeMultiplier;

      const computeCost = Number(toFixed(dailyCostRaw * 0.58));
      const storageCost = Number(toFixed(dailyCostRaw * 0.25));
      const ioCost = Number(toFixed(dailyCostRaw * 0.11));
      const backupCost = Number(toFixed(dailyCostRaw * 0.06));
      const totalBilledCost = Number(toFixed(computeCost + storageCost + ioCost + backupCost));

      const usageLoad =
        (template.loadBase + template.loadTrendPerDay * index) *
        (template.spikeDays.has(usageDate) ? 1.14 : 1) *
        (weekendMultiplier < 1 ? 0.95 : 1);
      const connectionsAvg =
        (template.connectionsBase + template.connectionsTrendPerDay * index) *
        (template.spikeDays.has(usageDate) ? 1.12 : 1) *
        (weekendMultiplier < 1 ? 0.94 : 1);

      const connectionsMax = connectionsAvg * 1.33;
      const footprintGb = template.footprintBaseGb + template.footprintTrendPerDay * index;
      const readThroughputBytes =
        (template.readThroughputBaseBytes + index * 280000) *
        (template.spikeDays.has(usageDate) ? 1.18 : 1) *
        (weekendMultiplier < 1 ? 0.93 : 1);
      const writeThroughputBytes =
        (template.writeThroughputBaseBytes + index * 180000) *
        (template.spikeDays.has(usageDate) ? 1.16 : 1) *
        (weekendMultiplier < 1 ? 0.94 : 1);

      rows.push({
        usageDate,
        resourceId: template.resourceId,
        resourceName: template.resourceName,
        dbService: template.dbService,
        dbEngine: template.dbEngine,
        regionKey: resolveRegionKey(template.regionCode, regionKeys),
        dataFootprintGb: toFixed(footprintGb),
        loadAvg: toFixed(usageLoad, 4),
        connectionsAvg: toFixed(connectionsAvg, 4),
        connectionsMax: toFixed(connectionsMax, 4),
        readThroughputBytes: toFixed(readThroughputBytes, 4),
        writeThroughputBytes: toFixed(writeThroughputBytes, 4),
        computeCost: toFixed(computeCost),
        storageCost: toFixed(storageCost),
        ioCost: toFixed(ioCost),
        backupCost: toFixed(backupCost),
        totalBilledCost: toFixed(totalBilledCost),
      });
    }
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
      connectionsMax: row.connectionsMax,
      readThroughputBytes: row.readThroughputBytes,
      writeThroughputBytes: row.writeThroughputBytes,
      computeCost: row.computeCost,
      storageCost: row.storageCost,
      ioCost: row.ioCost,
      backupCost: row.backupCost,
      totalBilledCost: row.totalBilledCost,
      totalEffectiveCost: row.totalBilledCost,
      totalListCost: row.totalBilledCost,
      currencyCode: "USD",
      updatedAt: new Date(),
    } as never);

    insertedOrUpdated += 1;
  }

  console.info("[db-explorer-seed] Upsert complete", {
    insertedOrUpdated,
    resources: RESOURCE_TEMPLATES.length,
    dateCount: buildDateRange(PREVIOUS_PERIOD_START, PREVIOUS_PERIOD_END).length + buildDateRange(CURRENT_PERIOD_START, CURRENT_PERIOD_END).length,
    seededPeriods: {
      previous: { start: PREVIOUS_PERIOD_START, end: PREVIOUS_PERIOD_END },
      current: { start: CURRENT_PERIOD_START, end: CURRENT_PERIOD_END },
    },
  });
}

async function cleanupRows(): Promise<void> {
  const connection = await resolveConnection();
  const tenantId = String(connection.tenantId);
  const cloudConnectionId = String(connection.id);

  const resourceIds = Object.values(RESOURCE_IDS);
  const startDate = PREVIOUS_PERIOD_START;
  const endDate = CURRENT_PERIOD_END;

  const deleted = await FactDbResourceDaily.destroy({
    where: {
      tenantId,
      cloudConnectionId,
      resourceId: resourceIds,
      usageDate: {
        [Op.between]: [startDate, endDate],
      },
    },
  });

  console.info("[db-explorer-seed] Cleanup complete", {
    deleted,
    tenantId,
    cloudConnectionId,
    resourceIds,
    startDate,
    endDate,
  });
}

async function main(): Promise<void> {
  const mode = parseMode();
  console.info("[db-explorer-seed] Starting", { mode, connectionName: CONNECTION_NAME });

  if (mode === "cleanup") {
    await cleanupRows();
    return;
  }

  await cleanupRows();
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
