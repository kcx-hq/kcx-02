import { Op, type Transaction } from "sequelize";

import { syncEc2InstanceCostDaily } from "../src/features/ec2/scheduled-jobs/handlers/ec2-instance-cost-daily.service.js";
import { syncEc2InstanceDailyFact } from "../src/features/ec2/scheduled-jobs/handlers/ec2-instance-daily-fact.service.js";
import {
  BillingSource,
  CloudConnectionV2,
  CloudProvider,
  DimRegion,
  DimResource,
  DimService,
  DimSubAccount,
  Ec2CostHistoryDaily,
  Ec2InstanceInventorySnapshot,
  Ec2InstanceUtilizationDaily,
  FactCostLineItems,
  FactEc2InstanceCostDaily,
  FactEc2InstanceDaily,
  sequelize,
  Tenant,
} from "../src/models/index.js";

type ScenarioType = "normal" | "cost_spike" | "cost_drop" | "new_instance";

type CliOptions = {
  tenantId: string;
  cloudConnectionId: string;
  billingSourceId: number;
  providerId: number;
  startDate: string | null;
  endDate: string | null;
  normalInstanceCount: number;
  costSpikeCount: number;
  costDropCount: number;
  newInstanceCount: number;
  seed: string;
  demoPrefix: string;
  cleanupOnly: boolean;
  skipTransforms: boolean;
  help: boolean;
};

type RegionRef = {
  regionId: string;
  regionName: string;
  regionKey: number;
};

type SubAccountRef = {
  subAccountId: string;
  subAccountName: string;
  subAccountKey: number;
};

type GeneratedInstance = {
  scenario: ScenarioType;
  instanceId: string;
  instanceName: string;
  instanceType: string;
  region: RegionRef;
  subAccount: SubAccountRef;
  availabilityZone: string;
  resourceKey: number;
  baselineDailyCost: number;
  anomalyCost: number | null;
  anomalyStartDate: string | null;
  anomalyEndDate: string | null;
  launchDate: string;
};

type GeneratedDailyPoint = {
  instanceId: string;
  usageDate: string;
  billedCost: number;
  effectiveCost: number;
  listCost: number;
  usageHours: number;
  scenario: ScenarioType;
};

type GenerationResult = {
  instances: GeneratedInstance[];
  dailyPoints: GeneratedDailyPoint[];
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LAST_DAYS = 30;
const DEFAULT_NORMAL_COUNT = 14;
const DEFAULT_SPIKE_COUNT = 1;
const DEFAULT_DROP_COUNT = 1;
const DEFAULT_NEW_COUNT = 1;
const DEFAULT_SEED = "anomaly-demo-v1";
const DEFAULT_PREFIX = "i-demo-anom";
const DEMO_OPERATION = "DEMO_ANOMALY_GENERATOR";
const DEMO_METRIC_SOURCE = "demo_anomaly_generator";
const DEMO_DATASET_TAG = "anomaly_demo_dataset_v1";

const REGION_CATALOG = [
  { regionId: "us-east-1", regionName: "US East (N. Virginia)" },
  { regionId: "us-west-2", regionName: "US West (Oregon)" },
  { regionId: "eu-west-1", regionName: "EU (Ireland)" },
] as const;

const INSTANCE_TYPE_CATALOG = [
  { instanceType: "t3.medium", minCost: 1.5, maxCost: 2.8 },
  { instanceType: "t3.large", minCost: 2.2, maxCost: 3.8 },
  { instanceType: "m5.large", minCost: 3.2, maxCost: 5.0 },
  { instanceType: "m6i.large", minCost: 3.6, maxCost: 5.5 },
  { instanceType: "c5.large", minCost: 2.4, maxCost: 4.1 },
  { instanceType: "c5.xlarge", minCost: 4.4, maxCost: 6.8 },
  { instanceType: "r5.large", minCost: 4.3, maxCost: 6.5 },
] as const;

function printUsage(): void {
  console.info(`
Usage:
  node dist/scripts/generate-anomaly-demo-data.js --tenant-id=<uuid> --cloud-connection-id=<uuid> --billing-source-id=<id> --provider-id=<id> [options]

Required:
  --tenant-id=<uuid>
  --cloud-connection-id=<uuid>
  --billing-source-id=<id>
  --provider-id=<id>

Options:
  --start-date=YYYY-MM-DD
  --end-date=YYYY-MM-DD
  --normal-instance-count=<10-20>            (default: 14)
  --cost-spike-count=<1-2>                   (default: 1)
  --cost-drop-count=<1-2>                    (default: 1)
  --new-instance-count=<1-2>                 (default: 1)
  --seed=<string>                            (default: anomaly-demo-v1)
  --demo-prefix=<string>                     (default: i-demo-anom)
  --cleanup-only                             (delete demo rows only)
  --skip-transforms                          (do not run EC2 rollups)
  --help

Examples:
  node dist/scripts/generate-anomaly-demo-data.js --tenant-id=<uuid> --cloud-connection-id=<uuid> --billing-source-id=12 --provider-id=1
  node dist/scripts/generate-anomaly-demo-data.js --tenant-id=<uuid> --cloud-connection-id=<uuid> --billing-source-id=12 --provider-id=1 --start-date=2026-03-25 --end-date=2026-04-23 --seed=demo-a
  node dist/scripts/generate-anomaly-demo-data.js --tenant-id=<uuid> --cloud-connection-id=<uuid> --billing-source-id=12 --provider-id=1 --cleanup-only
`);
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    tenantId: "",
    cloudConnectionId: "",
    billingSourceId: 0,
    providerId: 0,
    startDate: null,
    endDate: null,
    normalInstanceCount: DEFAULT_NORMAL_COUNT,
    costSpikeCount: DEFAULT_SPIKE_COUNT,
    costDropCount: DEFAULT_DROP_COUNT,
    newInstanceCount: DEFAULT_NEW_COUNT,
    seed: DEFAULT_SEED,
    demoPrefix: DEFAULT_PREFIX,
    cleanupOnly: false,
    skipTransforms: false,
    help: false,
  };

  for (const rawArg of argv.slice(2)) {
    const arg = String(rawArg ?? "").trim();
    if (!arg) continue;
    if (arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--cleanup-only") {
      options.cleanupOnly = true;
      continue;
    }
    if (arg === "--skip-transforms") {
      options.skipTransforms = true;
      continue;
    }

    const [rawKey, ...rawValueParts] = arg.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim();

    if (!value) continue;

    if (key === "--tenant-id") options.tenantId = value;
    if (key === "--cloud-connection-id") options.cloudConnectionId = value;
    if (key === "--billing-source-id") options.billingSourceId = parsePositiveInt(value) ?? 0;
    if (key === "--provider-id") options.providerId = parsePositiveInt(value) ?? 0;
    if (key === "--start-date") options.startDate = value;
    if (key === "--end-date") options.endDate = value;
    if (key === "--normal-instance-count") options.normalInstanceCount = parsePositiveInt(value) ?? options.normalInstanceCount;
    if (key === "--cost-spike-count") options.costSpikeCount = parsePositiveInt(value) ?? options.costSpikeCount;
    if (key === "--cost-drop-count") options.costDropCount = parsePositiveInt(value) ?? options.costDropCount;
    if (key === "--new-instance-count") options.newInstanceCount = parsePositiveInt(value) ?? options.newInstanceCount;
    if (key === "--seed") options.seed = value;
    if (key === "--demo-prefix") options.demoPrefix = value;
  }

  return options;
}

function resolveDateRange(options: CliOptions): { startDate: string; endDate: string } {
  if (options.startDate && options.endDate) {
    if (!DATE_ONLY_REGEX.test(options.startDate) || !DATE_ONLY_REGEX.test(options.endDate)) {
      throw new Error("--start-date and --end-date must be YYYY-MM-DD");
    }
    if (options.startDate > options.endDate) {
      throw new Error("--start-date must be <= --end-date");
    }
    return { startDate: options.startDate, endDate: options.endDate };
  }

  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (DEFAULT_LAST_DAYS - 1));
  return { startDate: toDateOnly(start), endDate: toDateOnly(end) };
}

function validateRunShape(options: CliOptions): void {
  if (!options.tenantId) throw new Error("--tenant-id is required");
  if (!options.cloudConnectionId) throw new Error("--cloud-connection-id is required");
  if (!options.billingSourceId) throw new Error("--billing-source-id is required");
  if (!options.providerId) throw new Error("--provider-id is required");

  if (options.normalInstanceCount < 10 || options.normalInstanceCount > 20) {
    throw new Error("--normal-instance-count must be between 10 and 20");
  }

  const anomalyCount = options.costSpikeCount + options.costDropCount + options.newInstanceCount;
  if (anomalyCount < 2 || anomalyCount > 5) {
    throw new Error("Total anomaly resources (spike + drop + new) must be between 2 and 5");
  }
}

function seedToInt(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: string): () => number {
  let state = seedToInt(seed) || 0x12345678;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInRange(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

function pickOne<T>(rng: () => number, items: readonly T[]): T {
  const index = Math.floor(rng() * items.length);
  return items[Math.max(0, Math.min(items.length - 1, index))];
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function dateFromDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function listDateRange(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const start = dateFromDateOnly(startDate);
  const end = dateFromDateOnly(endDate);
  for (let d = start; d.getTime() <= end.getTime(); d = addUtcDays(d, 1)) {
    out.push(toDateOnly(d));
  }
  return out;
}

function monthStart(dateOnly: string): string {
  return `${dateOnly.slice(0, 7)}-01`;
}

function toNumber(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value: ${String(value)}`);
  }
  return parsed;
}

async function assertScopeExists(options: CliOptions): Promise<void> {
  const [tenant, connection, billingSource, provider] = await Promise.all([
    Tenant.findByPk(options.tenantId),
    CloudConnectionV2.findByPk(options.cloudConnectionId),
    BillingSource.findByPk(options.billingSourceId),
    CloudProvider.findByPk(options.providerId),
  ]);

  if (!tenant) throw new Error(`Tenant not found: ${options.tenantId}`);
  if (!connection) throw new Error(`Cloud connection not found: ${options.cloudConnectionId}`);
  if (!billingSource) throw new Error(`Billing source not found: ${options.billingSourceId}`);
  if (!provider) throw new Error(`Provider not found: ${options.providerId}`);

  if (String(connection.tenantId) !== options.tenantId) {
    throw new Error(`Cloud connection ${options.cloudConnectionId} does not belong to tenant ${options.tenantId}`);
  }
  if (toNumber(String(connection.providerId)) !== options.providerId) {
    throw new Error(`Cloud connection ${options.cloudConnectionId} does not belong to provider ${options.providerId}`);
  }
  if (String(billingSource.tenantId) !== options.tenantId) {
    throw new Error(`Billing source ${options.billingSourceId} does not belong to tenant ${options.tenantId}`);
  }
  if (toNumber(String(billingSource.cloudProviderId)) !== options.providerId) {
    throw new Error(`Billing source ${options.billingSourceId} does not belong to provider ${options.providerId}`);
  }
}

async function ensureServiceKey(providerId: string, transaction: Transaction): Promise<number> {
  const existing = await DimService.findOne({
    where: {
      providerId,
      serviceName: {
        [Op.iLike]: "%ec2%",
      },
    },
    transaction,
  });
  if (existing) {
    return toNumber(String(existing.id));
  }

  const created = await DimService.create(
    {
      providerId,
      serviceName: "Amazon Elastic Compute Cloud",
      serviceCategory: "Compute",
      serviceSubcategory: "Instances",
    },
    { transaction },
  );
  return toNumber(String(created.id));
}

async function ensureRegionRefs(providerId: string, transaction: Transaction): Promise<RegionRef[]> {
  const refs: RegionRef[] = [];
  for (const region of REGION_CATALOG) {
    const [row] = await DimRegion.findOrCreate({
      where: {
        providerId,
        regionId: region.regionId,
        regionName: region.regionName,
        availabilityZone: null,
      },
      defaults: {
        providerId,
        regionId: region.regionId,
        regionName: region.regionName,
        availabilityZone: null,
      },
      transaction,
    });
    refs.push({
      regionId: region.regionId,
      regionName: region.regionName,
      regionKey: toNumber(String(row.id)),
    });
  }
  return refs;
}

async function ensureSubAccountRefs(
  tenantId: string,
  providerId: string,
  seed: string,
  transaction: Transaction,
): Promise<SubAccountRef[]> {
  const suffix = seedToInt(seed).toString(16).slice(0, 6);
  const defs = [
    { subAccountId: `demo-prod-${suffix}`, subAccountName: "Demo Production Account" },
    { subAccountId: `demo-dev-${suffix}`, subAccountName: "Demo Development Account" },
    { subAccountId: `demo-analytics-${suffix}`, subAccountName: "Demo Analytics Account" },
  ];
  const refs: SubAccountRef[] = [];

  for (const def of defs) {
    const [row] = await DimSubAccount.findOrCreate({
      where: {
        tenantId,
        providerId,
        subAccountId: def.subAccountId,
      },
      defaults: {
        tenantId,
        providerId,
        subAccountId: def.subAccountId,
        subAccountName: def.subAccountName,
      },
      transaction,
    });
    refs.push({
      subAccountId: def.subAccountId,
      subAccountName: def.subAccountName,
      subAccountKey: toNumber(String(row.id)),
    });
  }

  return refs;
}

function scenarioDisplayName(scenario: ScenarioType): string {
  if (scenario === "normal") return "normal";
  if (scenario === "cost_spike") return "cost_spike";
  if (scenario === "cost_drop") return "cost_drop";
  return "new_instance";
}

function generateInstances(input: {
  rng: () => number;
  startDate: string;
  endDate: string;
  options: CliOptions;
  regions: RegionRef[];
  subAccounts: SubAccountRef[];
  resourceKeyByInstanceId: Map<string, number>;
}): GenerationResult {
  const dates = listDateRange(input.startDate, input.endDate);
  const dateCount = dates.length;
  const scenarioQueue: ScenarioType[] = [
    ...Array.from({ length: input.options.normalInstanceCount }, () => "normal" as const),
    ...Array.from({ length: input.options.costSpikeCount }, () => "cost_spike" as const),
    ...Array.from({ length: input.options.costDropCount }, () => "cost_drop" as const),
    ...Array.from({ length: input.options.newInstanceCount }, () => "new_instance" as const),
  ];

  const instances: GeneratedInstance[] = [];
  const dailyPoints: GeneratedDailyPoint[] = [];
  const seedSuffix = seedToInt(input.options.seed).toString(16).padStart(8, "0").slice(0, 8);

  for (let i = 0; i < scenarioQueue.length; i += 1) {
    const scenario = scenarioQueue[i];
    const instanceTypeSpec = pickOne(input.rng, INSTANCE_TYPE_CATALOG);
    const region = pickOne(input.rng, input.regions);
    const subAccount = pickOne(input.rng, input.subAccounts);
    const instanceId = `${input.options.demoPrefix}-${seedSuffix}-${String(i + 1).padStart(3, "0")}`;
    const resourceKey = input.resourceKeyByInstanceId.get(instanceId);
    if (!resourceKey) {
      throw new Error(`Missing resource key for generated instance ${instanceId}`);
    }

    let baselineDailyCost: number;
    let anomalyCost: number | null = null;
    if (scenario === "normal") baselineDailyCost = randomInRange(input.rng, 1.5, 6.0);
    else if (scenario === "cost_spike") {
      baselineDailyCost = randomInRange(input.rng, 2.0, 4.0);
      anomalyCost = randomInRange(input.rng, 20.0, 40.0);
    } else if (scenario === "cost_drop") {
      baselineDailyCost = randomInRange(input.rng, 8.0, 12.0);
      anomalyCost = randomInRange(input.rng, 0.5, 2.0);
    } else {
      baselineDailyCost = randomInRange(input.rng, 10.0, 25.0);
    }

    baselineDailyCost = Math.max(
      baselineDailyCost,
      instanceTypeSpec.minCost,
    );
    baselineDailyCost = Math.min(
      baselineDailyCost,
      Math.max(instanceTypeSpec.maxCost, baselineDailyCost),
    );

    let launchIndex = 0;
    let anomalyStartIndex: number | null = null;
    let anomalyEndIndex: number | null = null;

    if (scenario === "new_instance") {
      const earliest = Math.max(5, Math.floor(dateCount * 0.65));
      const latest = Math.max(earliest, dateCount - 5);
      launchIndex = Math.floor(randomInRange(input.rng, earliest, latest + 1));
    } else if (scenario === "cost_spike" || scenario === "cost_drop") {
      const windowLength = Math.floor(randomInRange(input.rng, 1, 4));
      const endBound = Math.max(7, dateCount - 1);
      anomalyEndIndex = Math.floor(randomInRange(input.rng, Math.max(7, endBound - 4), endBound + 1));
      anomalyStartIndex = Math.max(0, anomalyEndIndex - windowLength + 1);
    }

    const launchDate = dates[Math.max(0, Math.min(dates.length - 1, launchIndex))] ?? input.startDate;
    const anomalyStartDate =
      anomalyStartIndex === null ? null : dates[Math.max(0, Math.min(dates.length - 1, anomalyStartIndex))] ?? null;
    const anomalyEndDate =
      anomalyEndIndex === null ? null : dates[Math.max(0, Math.min(dates.length - 1, anomalyEndIndex))] ?? null;

    const instance: GeneratedInstance = {
      scenario,
      instanceId,
      instanceName: `demo-${scenarioDisplayName(scenario)}-${String(i + 1).padStart(2, "0")}`,
      instanceType: instanceTypeSpec.instanceType,
      region,
      subAccount,
      availabilityZone: `${region.regionId}${pickOne(input.rng, ["a", "b", "c"])}`,
      resourceKey,
      baselineDailyCost: round6(baselineDailyCost),
      anomalyCost: anomalyCost === null ? null : round6(anomalyCost),
      anomalyStartDate,
      anomalyEndDate,
      launchDate,
    };
    instances.push(instance);

    for (let d = 0; d < dates.length; d += 1) {
      if (d < launchIndex) continue;

      const usageDate = dates[d];
      const isSpikeWindow =
        scenario === "cost_spike" &&
        anomalyStartIndex !== null &&
        anomalyEndIndex !== null &&
        d >= anomalyStartIndex &&
        d <= anomalyEndIndex;
      const isDropWindow =
        scenario === "cost_drop" &&
        anomalyStartIndex !== null &&
        anomalyEndIndex !== null &&
        d >= anomalyStartIndex &&
        d <= anomalyEndIndex;

      let billedCost = baselineDailyCost;
      if (isSpikeWindow && anomalyCost !== null) {
        billedCost = anomalyCost;
      } else if (isDropWindow && anomalyCost !== null) {
        billedCost = anomalyCost;
      }

      const noisePct =
        scenario === "normal"
          ? randomInRange(input.rng, -0.12, 0.12)
          : scenario === "new_instance"
            ? randomInRange(input.rng, -0.10, 0.10)
            : randomInRange(input.rng, -0.07, 0.07);

      const finalBilled = round6(Math.max(0.05, billedCost * (1 + noisePct)));
      const finalEffective = round6(finalBilled * randomInRange(input.rng, 0.97, 1.0));
      const finalList = round6(finalBilled * randomInRange(input.rng, 1.01, 1.08));
      const usageHours = round6(Math.max(1, randomInRange(input.rng, 22.0, 24.0)));

      dailyPoints.push({
        instanceId,
        usageDate,
        billedCost: finalBilled,
        effectiveCost: finalEffective,
        listCost: finalList,
        usageHours,
        scenario,
      });
    }
  }

  return { instances, dailyPoints };
}

async function cleanupExistingDemoRows(input: {
  transaction: Transaction;
  tenantId: string;
  cloudConnectionId: string;
  billingSourceId: number;
  providerId: number;
  startDate: string;
  endDate: string;
  demoPrefix: string;
}): Promise<Record<string, number>> {
  const whereInstanceLike = `${input.demoPrefix}-%`;
  const destroyedFactDaily = await FactEc2InstanceDaily.destroy({
    where: {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      billingSourceId: input.billingSourceId,
      providerId: input.providerId,
      instanceId: { [Op.like]: whereInstanceLike },
      usageDate: { [Op.gte]: input.startDate, [Op.lte]: input.endDate },
    },
    transaction: input.transaction,
  });

  const destroyedFactCostDaily = await FactEc2InstanceCostDaily.destroy({
    where: {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      billingSourceId: input.billingSourceId,
      providerId: input.providerId,
      instanceId: { [Op.like]: whereInstanceLike },
      usageDate: { [Op.gte]: input.startDate, [Op.lte]: input.endDate },
    },
    transaction: input.transaction,
  });

  const destroyedUtilDaily = await Ec2InstanceUtilizationDaily.destroy({
    where: {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      providerId: input.providerId,
      instanceId: { [Op.like]: whereInstanceLike },
      usageDate: { [Op.gte]: input.startDate, [Op.lte]: input.endDate },
    },
    transaction: input.transaction,
  });

  const destroyedInventory = await Ec2InstanceInventorySnapshot.destroy({
    where: {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      providerId: input.providerId,
      instanceId: { [Op.like]: whereInstanceLike },
    },
    transaction: input.transaction,
  });

  const destroyedEc2History = await Ec2CostHistoryDaily.destroy({
    where: {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      billingSourceId: input.billingSourceId,
      providerId: input.providerId,
      instanceId: { [Op.like]: whereInstanceLike },
      usageDate: { [Op.gte]: input.startDate, [Op.lte]: input.endDate },
    },
    transaction: input.transaction,
  });

  const destroyedFactLineItems = await FactCostLineItems.destroy({
    where: {
      tenantId: input.tenantId,
      billingSourceId: input.billingSourceId,
      providerId: input.providerId,
      operation: DEMO_OPERATION,
      usageStartTime: {
        [Op.gte]: new Date(`${input.startDate}T00:00:00.000Z`),
        [Op.lt]: new Date(`${input.endDate}T23:59:59.999Z`),
      },
    },
    transaction: input.transaction,
  });

  const destroyedResources = await DimResource.destroy({
    where: {
      tenantId: input.tenantId,
      providerId: input.providerId,
      resourceId: { [Op.like]: whereInstanceLike },
    },
    transaction: input.transaction,
  });

  return {
    fact_ec2_instance_daily: destroyedFactDaily,
    fact_ec2_instance_cost_daily: destroyedFactCostDaily,
    ec2_instance_utilization_daily: destroyedUtilDaily,
    ec2_instance_inventory_snapshots: destroyedInventory,
    ec2_cost_history_daily: destroyedEc2History,
    fact_cost_line_items: destroyedFactLineItems,
    dim_resource: destroyedResources,
  };
}

async function seedDemoData(input: {
  options: CliOptions;
  startDate: string;
  endDate: string;
}): Promise<{
  generation: GenerationResult;
  insertedCounts: Record<string, number>;
  deletedCounts: Record<string, number>;
}> {
  const rng = createRng(input.options.seed);

  const result = await sequelize.transaction(async (transaction) => {
    const deletedCounts = await cleanupExistingDemoRows({
      transaction,
      tenantId: input.options.tenantId,
      cloudConnectionId: input.options.cloudConnectionId,
      billingSourceId: input.options.billingSourceId,
      providerId: input.options.providerId,
      startDate: input.startDate,
      endDate: input.endDate,
      demoPrefix: input.options.demoPrefix,
    });

    if (input.options.cleanupOnly) {
      return {
        generation: { instances: [], dailyPoints: [] },
        insertedCounts: {} as Record<string, number>,
        deletedCounts,
      };
    }

    const providerIdText = String(input.options.providerId);
    const [serviceKey, regions, subAccounts] = await Promise.all([
      ensureServiceKey(providerIdText, transaction),
      ensureRegionRefs(providerIdText, transaction),
      ensureSubAccountRefs(input.options.tenantId, providerIdText, input.options.seed, transaction),
    ]);

    const totalInstances =
      input.options.normalInstanceCount +
      input.options.costSpikeCount +
      input.options.costDropCount +
      input.options.newInstanceCount;

    const seedSuffix = seedToInt(input.options.seed).toString(16).padStart(8, "0").slice(0, 8);
    const instanceIds = Array.from({ length: totalInstances }, (_, index) => {
      return `${input.options.demoPrefix}-${seedSuffix}-${String(index + 1).padStart(3, "0")}`;
    });

    const resourceRows: Array<{
      tenantId: string;
      providerId: string;
      resourceId: string;
      resourceName: string;
      resourceType: string;
    }> = instanceIds.map((instanceId) => ({
      tenantId: input.options.tenantId,
      providerId: providerIdText,
      resourceId: instanceId,
      resourceName: `[${DEMO_DATASET_TAG}] ${instanceId}`,
      resourceType: "AWS::EC2::Instance",
    }));

    await DimResource.bulkCreate(resourceRows as any[], {
      transaction,
      ignoreDuplicates: true,
    });

    const createdResources = await DimResource.findAll({
      where: {
        tenantId: input.options.tenantId,
        providerId: providerIdText,
        resourceId: { [Op.in]: instanceIds },
      },
      attributes: ["id", "resourceId"],
      transaction,
    });

    const resourceKeyByInstanceId = new Map<string, number>();
    for (const row of createdResources) {
      resourceKeyByInstanceId.set(String(row.resourceId), toNumber(String(row.id)));
    }

    const generation = generateInstances({
      rng,
      startDate: input.startDate,
      endDate: input.endDate,
      options: input.options,
      regions,
      subAccounts,
      resourceKeyByInstanceId,
    });

    const inventoryRows = generation.instances.map((instance) => ({
      tenantId: input.options.tenantId,
      cloudConnectionId: input.options.cloudConnectionId,
      providerId: providerIdText,
      instanceId: instance.instanceId,
      resourceKey: instance.resourceKey,
      regionKey: instance.region.regionKey,
      subAccountKey: instance.subAccount.subAccountKey,
      instanceType: instance.instanceType,
      platform: "linux",
      platformDetails: "Linux/UNIX",
      architecture: pickOne(rng, ["x86_64", "arm64"]),
      virtualizationType: "hvm",
      tenancy: "default",
      state: "running",
      instanceLifecycle: "on-demand",
      launchTime: new Date(`${instance.launchDate}T08:00:00.000Z`),
      availabilityZone: instance.availabilityZone,
      vpcId: `vpc-${seedToInt(`${instance.instanceId}-vpc`).toString(16).padStart(8, "0").slice(0, 8)}`,
      subnetId: `subnet-${seedToInt(`${instance.instanceId}-subnet`).toString(16).padStart(8, "0").slice(0, 8)}`,
      imageId: `ami-${seedToInt(`${instance.instanceId}-ami`).toString(16).padStart(8, "0").slice(0, 8)}`,
      privateIpAddress: `10.${Math.floor(randomInRange(rng, 10, 250))}.${Math.floor(randomInRange(rng, 1, 250))}.${Math.floor(randomInRange(rng, 5, 250))}`,
      publicIpAddress: `44.${Math.floor(randomInRange(rng, 10, 250))}.${Math.floor(randomInRange(rng, 1, 250))}.${Math.floor(randomInRange(rng, 5, 250))}`,
      discoveredAt: new Date(`${input.endDate}T12:00:00.000Z`),
      isCurrent: true,
      tagsJson: {
        Name: instance.instanceName,
        Environment: pickOne(rng, ["production", "dev", "staging"]),
        DemoDataset: DEMO_DATASET_TAG,
        AnomalyScenario: scenarioDisplayName(instance.scenario),
      },
      metadataJson: {
        demo_generator: DEMO_DATASET_TAG,
        seed: input.options.seed,
        scenario: scenarioDisplayName(instance.scenario),
      },
    }));

    await Ec2InstanceInventorySnapshot.bulkCreate(inventoryRows as any[], { transaction });

    const pointByInstance = new Map<string, GeneratedDailyPoint[]>();
    for (const point of generation.dailyPoints) {
      const arr = pointByInstance.get(point.instanceId) ?? [];
      arr.push(point);
      pointByInstance.set(point.instanceId, arr);
    }

    const utilizationRows: Array<Record<string, unknown>> = [];
    const ec2HistoryRows: Array<Record<string, unknown>> = [];
    const factLineRows: Array<Record<string, unknown>> = [];

    for (const instance of generation.instances) {
      const points = pointByInstance.get(instance.instanceId) ?? [];
      for (const point of points) {
        const cpuBase =
          instance.scenario === "cost_spike" && instance.anomalyStartDate && instance.anomalyEndDate &&
          point.usageDate >= instance.anomalyStartDate &&
          point.usageDate <= instance.anomalyEndDate
            ? randomInRange(rng, 68, 92)
            : instance.scenario === "cost_drop" && instance.anomalyStartDate && instance.anomalyEndDate &&
                point.usageDate >= instance.anomalyStartDate &&
                point.usageDate <= instance.anomalyEndDate
              ? randomInRange(rng, 4, 12)
              : randomInRange(rng, 25, 52);

        utilizationRows.push({
          tenantId: input.options.tenantId,
          cloudConnectionId: input.options.cloudConnectionId,
          providerId: providerIdText,
          instanceId: instance.instanceId,
          usageDate: point.usageDate,
          resourceKey: instance.resourceKey,
          regionKey: instance.region.regionKey,
          subAccountKey: instance.subAccount.subAccountKey,
          cpuAvg: round6(cpuBase),
          cpuMax: round6(Math.min(99, cpuBase * randomInRange(rng, 1.08, 1.35))),
          cpuMin: round6(Math.max(0.2, cpuBase * randomInRange(rng, 0.45, 0.75))),
          memoryAvg: round6(randomInRange(rng, 35, 76)),
          memoryMax: round6(randomInRange(rng, 52, 89)),
          networkInBytes: Math.floor(randomInRange(rng, 100_000_000, 3_500_000_000)),
          networkOutBytes: Math.floor(randomInRange(rng, 80_000_000, 2_700_000_000)),
          diskReadBytes: Math.floor(randomInRange(rng, 25_000_000, 900_000_000)),
          diskWriteBytes: Math.floor(randomInRange(rng, 25_000_000, 1_100_000_000)),
          diskReadOps: Math.floor(randomInRange(rng, 1_000, 90_000)),
          diskWriteOps: Math.floor(randomInRange(rng, 1_000, 120_000)),
          ebsReadBytes: Math.floor(randomInRange(rng, 20_000_000, 700_000_000)),
          ebsWriteBytes: Math.floor(randomInRange(rng, 20_000_000, 900_000_000)),
          ebsReadOps: Math.floor(randomInRange(rng, 500, 50_000)),
          ebsWriteOps: Math.floor(randomInRange(rng, 500, 55_000)),
          ebsQueueLengthMax: round6(randomInRange(rng, 0.05, 3.2)),
          ebsIdleTimeAvg: round6(randomInRange(rng, 40, 95)),
          ebsBurstBalanceAvg: round6(randomInRange(rng, 65, 100)),
          diskUsedPercentAvg: round6(randomInRange(rng, 28, 82)),
          diskUsedPercentMax: round6(randomInRange(rng, 45, 96)),
          statusCheckFailedMax: 0,
          statusCheckFailedInstanceMax: 0,
          statusCheckFailedSystemMax: 0,
          isIdleCandidate: false,
          isUnderutilizedCandidate: false,
          isOverutilizedCandidate: false,
          peakToAvgCpuRatio: round6(randomInRange(rng, 1.1, 1.8)),
          metricSource: DEMO_METRIC_SOURCE,
        });

        ec2HistoryRows.push({
          usageDate: point.usageDate,
          monthStart: monthStart(point.usageDate),
          tenantId: input.options.tenantId,
          providerId: providerIdText,
          billingSourceId: input.options.billingSourceId,
          cloudConnectionId: input.options.cloudConnectionId,
          serviceKey,
          subAccountKey: instance.subAccount.subAccountKey,
          regionKey: instance.region.regionKey,
          resourceKey: instance.resourceKey,
          instanceId: instance.instanceId,
          instanceType: instance.instanceType,
          state: "running",
          pricingModel: "on_demand",
          chargeCategory: "compute",
          lineItemType: "Usage",
          billedCost: point.billedCost,
          effectiveCost: point.effectiveCost,
          listCost: point.listCost,
          usageQuantity: point.usageHours,
          currencyCode: "USD",
          allocationScope: "resource",
          isSharedCost: false,
          allocationMethod: "direct",
          ingestionRunId: null,
          snapshotVersion: 1,
        });

        const usageStart = new Date(`${point.usageDate}T00:00:00.000Z`);
        const usageEnd = new Date(`${point.usageDate}T23:59:59.000Z`);

        factLineRows.push({
          tenantId: input.options.tenantId,
          billingSourceId: input.options.billingSourceId,
          ingestionRunId: null,
          providerId: providerIdText,
          subAccountKey: instance.subAccount.subAccountKey,
          regionKey: instance.region.regionKey,
          serviceKey,
          resourceKey: instance.resourceKey,
          billedCost: point.billedCost,
          effectiveCost: point.effectiveCost,
          listCost: point.listCost,
          consumedQuantity: point.usageHours,
          pricingQuantity: point.usageHours,
          usageStartTime: usageStart,
          usageEndTime: usageEnd,
          usageType: `BoxUsage:${instance.instanceType}`,
          operation: DEMO_OPERATION,
          lineItemType: "Usage",
          pricingTerm: "OnDemand",
          purchaseOption: "OnDemand",
          publicOnDemandCost: point.listCost,
          discountAmount: round6(Math.max(0, point.listCost - point.effectiveCost)),
          creditAmount: 0,
          refundAmount: 0,
          taxCost: 0,
        });
      }
    }

    await Ec2InstanceUtilizationDaily.bulkCreate(utilizationRows as any[], { transaction });
    await Ec2CostHistoryDaily.bulkCreate(ec2HistoryRows as any[], { transaction });
    await FactCostLineItems.bulkCreate(factLineRows as any[], { transaction });

    return {
      generation,
      insertedCounts: {
        ec2_instance_inventory_snapshots: inventoryRows.length,
        ec2_instance_utilization_daily: utilizationRows.length,
        ec2_cost_history_daily: ec2HistoryRows.length,
        fact_cost_line_items: factLineRows.length,
      },
      deletedCounts,
    };
  });

  return result;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);

  if (options.help) {
    printUsage();
    return;
  }

  validateRunShape(options);
  const { startDate, endDate } = resolveDateRange(options);

  console.info("Starting anomaly demo data generation", {
    tenantId: options.tenantId,
    cloudConnectionId: options.cloudConnectionId,
    billingSourceId: options.billingSourceId,
    providerId: options.providerId,
    startDate,
    endDate,
    normalInstanceCount: options.normalInstanceCount,
    costSpikeCount: options.costSpikeCount,
    costDropCount: options.costDropCount,
    newInstanceCount: options.newInstanceCount,
    seed: options.seed,
    demoPrefix: options.demoPrefix,
    cleanupOnly: options.cleanupOnly,
    skipTransforms: options.skipTransforms,
  });

  await assertScopeExists(options);

  const startedAt = Date.now();
  const seeded = await seedDemoData({ options, startDate, endDate });

  if (options.cleanupOnly) {
    console.info("Demo data cleanup completed", {
      deletedRowsByTable: seeded.deletedCounts,
      durationMs: Date.now() - startedAt,
    });
    return;
  }

  let transformedCostRows = 0;
  let transformedDailyRows = 0;

  if (!options.skipTransforms) {
    const [costSync, dailySync] = await Promise.all([
      syncEc2InstanceCostDaily({
        tenantId: options.tenantId,
        startDate,
        endDate,
      }),
      syncEc2InstanceDailyFact({
        tenantId: options.tenantId,
        cloudConnectionId: options.cloudConnectionId,
        providerId: String(options.providerId),
        startDate,
        endDate,
      }),
    ]);
    transformedCostRows = costSync.rowsUpserted;
    transformedDailyRows = dailySync.rowsUpserted;
  }

  const anomalyAssignments = seeded.generation.instances
    .filter((instance) => instance.scenario !== "normal")
    .map((instance) => ({
      instanceId: instance.instanceId,
      instanceName: instance.instanceName,
      anomalyType: scenarioDisplayName(instance.scenario),
      launchDate: instance.launchDate,
      anomalyStartDate: instance.anomalyStartDate,
      anomalyEndDate: instance.anomalyEndDate,
      baselineDailyCost: instance.baselineDailyCost,
      anomalyCost: instance.anomalyCost,
    }));

  const scenarioCounts = seeded.generation.instances.reduce<Record<ScenarioType, number>>(
    (acc, instance) => {
      acc[instance.scenario] += 1;
      return acc;
    },
    { normal: 0, cost_spike: 0, cost_drop: 0, new_instance: 0 },
  );

  console.info("Anomaly demo data generation completed", {
    dateRange: { startDate, endDate },
    generatedResources: {
      normal: scenarioCounts.normal,
      anomalous: scenarioCounts.cost_spike + scenarioCounts.cost_drop + scenarioCounts.new_instance,
      byAnomalyType: {
        cost_spike: scenarioCounts.cost_spike,
        cost_drop: scenarioCounts.cost_drop,
        new_instance: scenarioCounts.new_instance,
      },
    },
    anomalyAssignments,
    deletedRowsByTable: seeded.deletedCounts,
    insertedRowsByTable: seeded.insertedCounts,
    transformedRowsByTable: options.skipTransforms
      ? { fact_ec2_instance_cost_daily: 0, fact_ec2_instance_daily: 0 }
      : {
          fact_ec2_instance_cost_daily: transformedCostRows,
          fact_ec2_instance_daily: transformedDailyRows,
        },
    durationMs: Date.now() - startedAt,
  });
}

main()
  .catch((error) => {
    console.error(
      "Anomaly demo data generation failed:",
      error instanceof Error ? error.message : String(error),
    );
    printUsage();
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
