import { Op, QueryTypes } from "sequelize";

import { DbRecommendationsService } from "../src/features/database/recommendations/db-recommendations.service.js";
import {
  BillingSource,
  CloudConnectionV2,
  CloudProvider,
  DbCostHistoryDaily,
  DbResourceInventorySnapshot,
  DbUtilizationDaily,
  DimRegion,
  DimSubAccount,
  FactDbResourceDaily,
  sequelize,
  Tenant,
} from "../src/models/index.js";

const SEED_TAG = "kcx-db-rec-dev-seed-v1";
const TENANT_SLUG = "kcx-db-rec-dev-seed";
const TENANT_NAME = "KCX DB Recommendations Dev Seed";
const CONNECTION_NAME = "kcx-db-rec-dev-seed-conn";
const ACCOUNT_ID = "123456789012";
const REGION_ID = "us-east-1";
const REGION_NAME = "US East (N. Virginia)";
const DAYS = 7;
const SOURCE_SYSTEM = "KCX_DB_RECOMMENDATIONS_V1";

const RESOURCE_IDS = {
  storage: "seed-db-storage-aurora-001",
  idle: "seed-db-idle-rds-001",
  ha: "seed-db-ha-aurora-001",
  engine: "seed-db-engine-aurora-001",
} as const;

type CliArgs = {
  generate: boolean;
  tenantId?: string;
  cloudConnectionId?: string;
  billingSourceId?: string;
};

type ResourceKey = keyof typeof RESOURCE_IDS;

type Scenario = {
  key: ResourceKey;
  resourceName: string;
  dbService: string;
  dbEngine: string;
  resourceType: string;
  capacityMode: string;
  instanceClass: string;
  clusterId: string | null;
  isClusterResource: boolean;
  factDailyTotal: number;
  factDailyBreakdown: {
    compute: number;
    storage: number;
    io: number;
    backup: number;
    dataTransfer: number;
    tax: number;
    credit: number;
    refund: number;
  };
  withUtilization: boolean;
  utilization: {
    cpuAvg: number;
    cpuMax: number;
    connectionsAvg: number;
    connectionsMax: number;
    readIops: number;
    writeIops: number;
    storageUsedGb: number;
  } | null;
  withCostHistory: boolean;
  dailyCostHistory: Array<{ category: "compute" | "storage" | "io" | "backup" | "other"; effective: number }>;
};

const scenarios: Scenario[] = [
  {
    key: "storage",
    resourceName: "seed-db-storage-aurora-001",
    dbService: "AmazonRDS",
    dbEngine: "postgresql",
    resourceType: "db.instance",
    capacityMode: "serverless",
    instanceClass: "db.t3.medium",
    clusterId: null,
    isClusterResource: false,
    factDailyTotal: 3.0,
    factDailyBreakdown: {
      compute: 0.9,
      storage: 1.2,
      io: 0.3,
      backup: 0.4,
      dataTransfer: 0.2,
      tax: 0,
      credit: 0,
      refund: 0,
    },
    withUtilization: true,
    utilization: {
      cpuAvg: 28,
      cpuMax: 42,
      connectionsAvg: 12,
      connectionsMax: 20,
      readIops: 24,
      writeIops: 18,
      storageUsedGb: 220,
    },
    withCostHistory: true,
    dailyCostHistory: [
      { category: "compute", effective: 0.9 },
      { category: "storage", effective: 1.2 },
      { category: "backup", effective: 0.4 },
      { category: "io", effective: 0.3 },
      { category: "other", effective: 0.2 },
    ],
  },
  {
    key: "idle",
    resourceName: "seed-db-idle-rds-001",
    dbService: "AmazonRDS",
    dbEngine: "mysql",
    resourceType: "db.instance",
    capacityMode: "serverless",
    instanceClass: "db.t3.medium",
    clusterId: null,
    isClusterResource: false,
    factDailyTotal: 2.0,
    factDailyBreakdown: {
      compute: 1.2,
      storage: 0.5,
      io: 0.1,
      backup: 0.2,
      dataTransfer: 0,
      tax: 0,
      credit: 0,
      refund: 0,
    },
    withUtilization: false,
    utilization: null,
    withCostHistory: false,
    dailyCostHistory: [],
  },
  {
    key: "ha",
    resourceName: "seed-db-ha-aurora-001",
    dbService: "AmazonRDS",
    dbEngine: "postgresql",
    resourceType: "db.instance",
    capacityMode: "provisioned",
    instanceClass: "db.r6g.xlarge",
    clusterId: "seed-aurora-ha-cluster-001",
    isClusterResource: true,
    factDailyTotal: 4.0,
    factDailyBreakdown: {
      compute: 2.3,
      storage: 0.6,
      io: 0.1,
      backup: 0.2,
      dataTransfer: 0.8,
      tax: 0,
      credit: 0,
      refund: 0,
    },
    withUtilization: true,
    utilization: {
      cpuAvg: 24,
      cpuMax: 40,
      connectionsAvg: 14,
      connectionsMax: 22,
      readIops: 28,
      writeIops: 20,
      storageUsedGb: 300,
    },
    withCostHistory: true,
    dailyCostHistory: [
      { category: "compute", effective: 2.3 },
      { category: "storage", effective: 0.6 },
      { category: "backup", effective: 0.2 },
      { category: "io", effective: 0.1 },
      { category: "other", effective: 0.8 },
    ],
  },
  {
    key: "engine",
    resourceName: "seed-db-engine-aurora-001",
    dbService: "AmazonRDS",
    dbEngine: "aurora-postgresql",
    resourceType: "db.instance",
    capacityMode: "serverless",
    instanceClass: "db.t3.medium",
    clusterId: null,
    isClusterResource: false,
    factDailyTotal: 3.0,
    factDailyBreakdown: {
      compute: 1.8,
      storage: 0.7,
      io: 0.2,
      backup: 0.2,
      dataTransfer: 0.1,
      tax: 0,
      credit: 0,
      refund: 0,
    },
    withUtilization: true,
    utilization: {
      cpuAvg: 30,
      cpuMax: 44,
      connectionsAvg: 10,
      connectionsMax: 16,
      readIops: 21,
      writeIops: 17,
      storageUsedGb: 260,
    },
    withCostHistory: false,
    dailyCostHistory: [],
  },
];

const asDateOnly = (value: Date): string => value.toISOString().slice(0, 10);
const monthStart = (dateOnly: string): string => `${dateOnly.slice(0, 7)}-01`;

const buildUsageDates = (days: number): string[] => {
  const out: string[] = [];
  const today = new Date();
  for (let i = days; i >= 1; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(asDateOnly(d));
  }
  return out;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  const getValue = (flag: string): string | undefined => {
    const idx = args.findIndex((v) => v === flag);
    if (idx < 0) return undefined;
    const value = args[idx + 1];
    if (!value || value.startsWith("--")) return undefined;
    return value.trim();
  };
  return {
    generate: args.includes("--generate"),
    tenantId: getValue("--tenant-id"),
    cloudConnectionId: getValue("--cloud-connection-id"),
    billingSourceId: getValue("--billing-source-id"),
  };
};

async function ensureContext(): Promise<{
  tenantId: string;
  providerId: string;
  cloudConnectionId: string;
  billingSourceId: string;
  regionKey: string;
  subAccountKey: string;
}> {
  const [provider] = await CloudProvider.findOrCreate({
    where: { code: "aws" },
    defaults: { code: "aws", name: "Amazon Web Services", status: "active" },
  });

  const [tenant] = await Tenant.findOrCreate({
    where: { slug: TENANT_SLUG },
    defaults: { name: TENANT_NAME, slug: TENANT_SLUG, status: "active" },
  });

  const [connection] = await CloudConnectionV2.findOrCreate({
    where: { tenantId: String(tenant.id), connectionName: CONNECTION_NAME },
    defaults: {
      tenantId: String(tenant.id),
      providerId: String(provider.id),
      connectionName: CONNECTION_NAME,
      accountType: "payer",
      status: "active",
      region: REGION_ID,
      cloudAccountId: ACCOUNT_ID,
      payerAccountId: ACCOUNT_ID,
      createdBy: null,
      connectedAt: new Date(),
      lastValidatedAt: new Date(),
    },
  });

  const [billingSource] = await BillingSource.findOrCreate({
    where: {
      tenantId: String(tenant.id),
      cloudConnectionId: String(connection.id),
      sourceName: "KCX DB Rec Dev Seed Source",
    },
    defaults: {
      tenantId: String(tenant.id),
      cloudConnectionId: String(connection.id),
      cloudProviderId: String(provider.id),
      sourceName: "KCX DB Rec Dev Seed Source",
      sourceType: "manual_upload",
      setupMode: "manual",
      format: "csv",
      schemaType: "focus",
      isTemporary: true,
      status: "active",
    },
  });

  const [subAccount] = await DimSubAccount.findOrCreate({
    where: {
      tenantId: String(tenant.id),
      providerId: String(provider.id),
      subAccountId: ACCOUNT_ID,
    },
    defaults: {
      tenantId: String(tenant.id),
      providerId: String(provider.id),
      subAccountId: ACCOUNT_ID,
      subAccountName: "KCX DB Rec Dev Seed Account",
    },
  });

  const [region] = await DimRegion.findOrCreate({
    where: {
      providerId: String(provider.id),
      regionId: REGION_ID,
      regionName: REGION_NAME,
      availabilityZone: null,
    },
    defaults: {
      providerId: String(provider.id),
      regionId: REGION_ID,
      regionName: REGION_NAME,
      availabilityZone: null,
    },
  });

  return {
    tenantId: String(tenant.id),
    providerId: String(provider.id),
    cloudConnectionId: String(connection.id),
    billingSourceId: String(billingSource.id),
    regionKey: String(region.id),
    subAccountKey: String(subAccount.id),
  };
}

async function resolveExplicitContext(input: {
  tenantId: string;
  cloudConnectionId: string;
  billingSourceId: string;
}): Promise<{
  tenantId: string;
  providerId: string;
  cloudConnectionId: string;
  billingSourceId: string;
  regionKey: string;
  subAccountKey: string;
}> {
  const tenant = await Tenant.findByPk(input.tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${input.tenantId}`);

  const connection = await CloudConnectionV2.findByPk(input.cloudConnectionId);
  if (!connection) throw new Error(`Cloud connection not found: ${input.cloudConnectionId}`);
  if (String(connection.tenantId) !== input.tenantId) {
    throw new Error(`Cloud connection ${input.cloudConnectionId} does not belong to tenant ${input.tenantId}`);
  }

  const billingSource = await BillingSource.findByPk(input.billingSourceId);
  if (!billingSource) throw new Error(`Billing source not found: ${input.billingSourceId}`);
  if (String(billingSource.tenantId) !== input.tenantId) {
    throw new Error(`Billing source ${input.billingSourceId} does not belong to tenant ${input.tenantId}`);
  }
  if (String(billingSource.cloudConnectionId ?? "") !== input.cloudConnectionId) {
    throw new Error(`Billing source ${input.billingSourceId} is not attached to cloud connection ${input.cloudConnectionId}`);
  }

  const providerId = String(connection.providerId);

  const [subAccount] = await DimSubAccount.findOrCreate({
    where: {
      tenantId: input.tenantId,
      providerId,
      subAccountId: ACCOUNT_ID,
    },
    defaults: {
      tenantId: input.tenantId,
      providerId,
      subAccountId: ACCOUNT_ID,
      subAccountName: "KCX DB Rec Dev Seed Account",
    },
  });

  const [region] = await DimRegion.findOrCreate({
    where: {
      providerId,
      regionId: REGION_ID,
      regionName: REGION_NAME,
      availabilityZone: null,
    },
    defaults: {
      providerId,
      regionId: REGION_ID,
      regionName: REGION_NAME,
      availabilityZone: null,
    },
  });

  return {
    tenantId: input.tenantId,
    providerId,
    cloudConnectionId: input.cloudConnectionId,
    billingSourceId: input.billingSourceId,
    regionKey: String(region.id),
    subAccountKey: String(subAccount.id),
  };
}

async function cleanupSeededRows(scope: { tenantId: string; cloudConnectionId: string }): Promise<void> {
  const resourceIds = Object.values(RESOURCE_IDS);

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `
      DELETE FROM fact_recommendations
      WHERE tenant_id = :tenantId::uuid
        AND cloud_connection_id = :cloudConnectionId::uuid
        AND category = 'DB'
        AND source_system = :sourceSystem
        AND resource_id IN (:resourceIds)
      `,
      {
        replacements: {
          tenantId: scope.tenantId,
          cloudConnectionId: scope.cloudConnectionId,
          sourceSystem: SOURCE_SYSTEM,
          resourceIds,
        },
        type: QueryTypes.DELETE,
        transaction,
      },
    );

    await DbUtilizationDaily.destroy({
      where: { tenantId: scope.tenantId, cloudConnectionId: scope.cloudConnectionId, resourceId: { [Op.in]: resourceIds } },
      transaction,
    });
    await DbResourceInventorySnapshot.destroy({
      where: { tenantId: scope.tenantId, cloudConnectionId: scope.cloudConnectionId, resourceId: { [Op.in]: resourceIds } },
      transaction,
    });
    await DbCostHistoryDaily.destroy({
      where: { tenantId: scope.tenantId, cloudConnectionId: scope.cloudConnectionId, resourceId: { [Op.in]: resourceIds } },
      transaction,
    });
    await FactDbResourceDaily.destroy({
      where: { tenantId: scope.tenantId, cloudConnectionId: scope.cloudConnectionId, resourceId: { [Op.in]: resourceIds } },
      transaction,
    });
  });
}

async function seedData(scope: {
  tenantId: string;
  providerId: string;
  cloudConnectionId: string;
  billingSourceId: string;
  regionKey: string;
  subAccountKey: string;
}): Promise<void> {
  const usageDates = buildUsageDates(DAYS);
  const factRows: Record<string, unknown>[] = [];
  const costRows: Record<string, unknown>[] = [];
  const inventoryRows: Record<string, unknown>[] = [];
  const utilizationRows: Record<string, unknown>[] = [];

  for (const scenario of scenarios) {
    const resourceId = RESOURCE_IDS[scenario.key];
    const resourceArn = `arn:aws:rds:${REGION_ID}:${ACCOUNT_ID}:db:${resourceId}`;

    inventoryRows.push({
      tenantId: scope.tenantId,
      cloudConnectionId: scope.cloudConnectionId,
      providerId: scope.providerId,
      resourceId,
      resourceArn,
      resourceName: scenario.resourceName,
      dbService: scenario.dbService,
      dbEngine: scenario.dbEngine,
      dbEngineVersion: "seed-v1",
      resourceType: scenario.resourceType,
      regionKey: scope.regionKey,
      subAccountKey: scope.subAccountKey,
      status: "available",
      allocatedStorageGb: 500,
      dataFootprintGb: 280,
      instanceClass: scenario.instanceClass,
      capacityMode: scenario.capacityMode,
      clusterId: scenario.clusterId,
      isClusterResource: scenario.isClusterResource,
      tagsJson: { seed_tag: SEED_TAG },
      metadataJson: { seed_tag: SEED_TAG, scenario: scenario.key },
      discoveredAt: new Date(),
      isCurrent: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    for (const usageDate of usageDates) {
      factRows.push({
        tenantId: scope.tenantId,
        cloudConnectionId: scope.cloudConnectionId,
        billingSourceId: scope.billingSourceId,
        providerId: scope.providerId,
        usageDate,
        resourceId,
        resourceArn,
        resourceName: scenario.resourceName,
        dbService: scenario.dbService,
        dbEngine: scenario.dbEngine,
        dbEngineVersion: "seed-v1",
        resourceType: scenario.resourceType,
        regionKey: scope.regionKey,
        subAccountKey: scope.subAccountKey,
        status: "available",
        clusterId: scenario.clusterId,
        isClusterResource: scenario.isClusterResource,
        allocatedStorageGb: 500,
        dataFootprintGb: 280,
        storageUsedGb: scenario.utilization?.storageUsedGb ?? 260,
        computeCost: scenario.factDailyBreakdown.compute,
        storageCost: scenario.factDailyBreakdown.storage,
        ioCost: scenario.factDailyBreakdown.io,
        backupCost: scenario.factDailyBreakdown.backup,
        dataTransferCost: scenario.factDailyBreakdown.dataTransfer,
        taxCost: scenario.factDailyBreakdown.tax,
        creditAmount: scenario.factDailyBreakdown.credit,
        refundAmount: scenario.factDailyBreakdown.refund,
        totalBilledCost: scenario.factDailyTotal,
        totalEffectiveCost: scenario.factDailyTotal,
        totalListCost: scenario.factDailyTotal,
        currencyCode: "USD",
        cpuAvg: scenario.utilization?.cpuAvg ?? null,
        cpuMax: scenario.utilization?.cpuMax ?? null,
        loadAvg: null,
        connectionsAvg: scenario.utilization?.connectionsAvg ?? null,
        connectionsMax: scenario.utilization?.connectionsMax ?? null,
        requestCount: null,
        readIops: scenario.utilization?.readIops ?? null,
        writeIops: scenario.utilization?.writeIops ?? null,
        readThroughputBytes: null,
        writeThroughputBytes: null,
        createdAt: new Date(`${usageDate}T12:00:00.000Z`),
        updatedAt: new Date(`${usageDate}T12:00:00.000Z`),
      });

      if (scenario.withUtilization && scenario.utilization) {
        utilizationRows.push({
          tenantId: scope.tenantId,
          cloudConnectionId: scope.cloudConnectionId,
          providerId: scope.providerId,
          resourceId,
          usageDate,
          dbService: scenario.dbService,
          dbEngine: scenario.dbEngine,
          regionKey: scope.regionKey,
          subAccountKey: scope.subAccountKey,
          cpuAvg: scenario.utilization.cpuAvg,
          cpuMax: scenario.utilization.cpuMax,
          loadAvg: null,
          connectionsAvg: scenario.utilization.connectionsAvg,
          connectionsMax: scenario.utilization.connectionsMax,
          requestCount: null,
          readIops: scenario.utilization.readIops,
          writeIops: scenario.utilization.writeIops,
          readThroughputBytes: null,
          writeThroughputBytes: null,
          storageUsedGb: scenario.utilization.storageUsedGb,
          allocatedStorageGb: 500,
          sampleCount: 24,
          metricSource: "seed",
          createdAt: new Date(`${usageDate}T12:00:00.000Z`),
          updatedAt: new Date(`${usageDate}T12:00:00.000Z`),
        });
      }

      if (scenario.withCostHistory) {
        for (const row of scenario.dailyCostHistory) {
          costRows.push({
            usageDate,
            monthStart: monthStart(usageDate),
            tenantId: scope.tenantId,
            cloudConnectionId: scope.cloudConnectionId,
            billingSourceId: scope.billingSourceId,
            providerId: scope.providerId,
            regionKey: scope.regionKey,
            subAccountKey: scope.subAccountKey,
            resourceId,
            dbService: scenario.dbService,
            dbEngine: scenario.dbEngine,
            costCategory: row.category,
            billedCost: row.effective,
            effectiveCost: row.effective,
            listCost: row.effective,
            usageQuantity: null,
            currencyCode: "USD",
            ingestionRunId: null,
            createdAt: new Date(`${usageDate}T12:00:00.000Z`),
            updatedAt: new Date(`${usageDate}T12:00:00.000Z`),
          });
        }
      }
    }
  }

  await sequelize.transaction(async (transaction) => {
    await FactDbResourceDaily.bulkCreate(factRows, { transaction });
    if (costRows.length > 0) await DbCostHistoryDaily.bulkCreate(costRows, { transaction });
    await DbResourceInventorySnapshot.bulkCreate(inventoryRows, { transaction });
    if (utilizationRows.length > 0) await DbUtilizationDaily.bulkCreate(utilizationRows, { transaction });
  });

  console.log(JSON.stringify({ seedTag: SEED_TAG, factRows: factRows.length, costRows: costRows.length, inventoryRows: inventoryRows.length, utilizationRows: utilizationRows.length }, null, 2));
}

async function runGenerationAndVerify(scope: { tenantId: string; cloudConnectionId: string; billingSourceId: string }): Promise<void> {
  const service = new DbRecommendationsService();
  const generateResult = await service.generate({
    tenantId: scope.tenantId,
    cloudConnectionId: scope.cloudConnectionId,
    billingSourceId: Number(scope.billingSourceId),
  });

  const rows = await sequelize.query<{
    recommendation_type: string;
    resource_id: string;
    status: string;
    metadata_json: Record<string, unknown> | null;
  }>(
    `
    SELECT recommendation_type, resource_id, status, metadata_json
    FROM fact_recommendations
    WHERE source_system = 'KCX_DB_RECOMMENDATIONS_V1'
      AND category = 'DB'
      AND tenant_id = :tenantId::uuid
      AND cloud_connection_id = :cloudConnectionId::uuid
      AND resource_id LIKE 'seed-db-%'
    ORDER BY recommendation_type, resource_id
    `,
    {
      replacements: { tenantId: scope.tenantId, cloudConnectionId: scope.cloudConnectionId },
      type: QueryTypes.SELECT,
    },
  );

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.recommendation_type] = (acc[row.recommendation_type] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\nGeneration Result:");
  console.log(JSON.stringify(generateResult, null, 2));
  console.log("\nRecommendation Rows:");
  console.log(JSON.stringify(rows, null, 2));
  console.log("\nRecommendation Type Counts:");
  console.log(JSON.stringify(counts, null, 2));

  if (rows.length !== 4) {
    console.warn(`Expected 4 rows but found ${rows.length}. Extra/missing triggers likely occurred.`);
  }
}

async function printRollupChecks(scope: { tenantId: string; cloudConnectionId: string }): Promise<void> {
  const rows = await sequelize.query(
    `
    SELECT
      f.resource_id,
      SUM(f.total_effective_cost)::double precision AS total_effective_cost,
      COUNT(DISTINCT f.usage_date)::int AS usage_days,
      COALESCE(SUM(CASE WHEN ch.cost_category = 'compute' THEN ch.effective_cost ELSE 0 END), 0)::double precision AS compute_cost,
      COALESCE(SUM(CASE WHEN ch.cost_category = 'storage' THEN ch.effective_cost ELSE 0 END), 0)::double precision AS storage_cost,
      COALESCE(SUM(CASE WHEN ch.cost_category = 'backup' THEN ch.effective_cost ELSE 0 END), 0)::double precision AS backup_cost,
      COALESCE(SUM(CASE WHEN ch.cost_category = 'io' THEN ch.effective_cost ELSE 0 END), 0)::double precision AS io_cost
    FROM fact_db_resource_daily f
    LEFT JOIN db_cost_history_daily ch
      ON ch.tenant_id = f.tenant_id
     AND ch.cloud_connection_id = f.cloud_connection_id
     AND ch.resource_id = f.resource_id
     AND ch.usage_date = f.usage_date
    WHERE f.tenant_id = :tenantId::uuid
      AND f.cloud_connection_id = :cloudConnectionId::uuid
      AND f.resource_id LIKE 'seed-db-%'
    GROUP BY f.resource_id
    ORDER BY f.resource_id
    `,
    {
      replacements: { tenantId: scope.tenantId, cloudConnectionId: scope.cloudConnectionId },
      type: QueryTypes.SELECT,
    },
  );

  console.log("\nSeed Rollup Check:");
  console.log(JSON.stringify(rows, null, 2));
}

async function main(): Promise<void> {
  const cli = parseArgs();
  const explicitMode = Boolean(cli.tenantId || cli.cloudConnectionId || cli.billingSourceId);
  if (explicitMode && !(cli.tenantId && cli.cloudConnectionId && cli.billingSourceId)) {
    throw new Error("When using explicit mode, provide all: --tenant-id, --cloud-connection-id, --billing-source-id");
  }

  const scope = cli.tenantId && cli.cloudConnectionId && cli.billingSourceId
    ? await resolveExplicitContext({
        tenantId: cli.tenantId,
        cloudConnectionId: cli.cloudConnectionId,
        billingSourceId: cli.billingSourceId,
      })
    : await ensureContext();

  console.log(
    JSON.stringify(
      {
        mode: cli.tenantId ? "explicit-visible-context" : "isolated-seed-tenant",
        tenantId: scope.tenantId,
        cloudConnectionId: scope.cloudConnectionId,
        billingSourceId: Number(scope.billingSourceId),
      },
      null,
      2,
    ),
  );

  await cleanupSeededRows({ tenantId: scope.tenantId, cloudConnectionId: scope.cloudConnectionId });
  await seedData(scope);
  await printRollupChecks({ tenantId: scope.tenantId, cloudConnectionId: scope.cloudConnectionId });

  console.log("\nRun generator API:");
  console.log("POST /services/database/recommendations/generate");
  console.log(JSON.stringify({ tenantId: scope.tenantId, cloudConnectionId: scope.cloudConnectionId, billingSourceId: Number(scope.billingSourceId) }, null, 2));

  console.log("\nValidation SQL:");
  console.log(
    `SELECT recommendation_type, resource_id, status, metadata_json
FROM fact_recommendations
WHERE source_system = 'KCX_DB_RECOMMENDATIONS_V1'
  AND category = 'DB'
  AND resource_id LIKE 'seed-db-%'
ORDER BY recommendation_type;`,
  );

  if (!cli.tenantId) {
    console.log("\nVisibility note:");
    console.log("This run used an isolated seed tenant. UI will only show these rows when logged into that tenant.");
    console.log("To seed into your visible UI tenant/context, rerun with:");
    console.log("  --tenant-id <uuid> --cloud-connection-id <uuid> --billing-source-id <id>");
  }

  if (cli.generate) {
    await runGenerationAndVerify(scope);
  }
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
