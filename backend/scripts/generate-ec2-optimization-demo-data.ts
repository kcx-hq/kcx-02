import { Op, type Transaction } from "sequelize";

import {
  BillingSource,
  CloudConnectionV2,
  CloudProvider,
  DimRegion,
  DimResource,
  DimSubAccount,
  Ec2InstanceInventorySnapshot,
  Ec2InstanceUtilizationDaily,
  FactEc2InstanceCostDaily,
  FactEc2InstanceCoverageDaily,
  FactEc2InstanceDaily,
  Tenant,
  sequelize,
} from "../src/models/index.js";

type ReservationType = "on_demand" | "reserved" | "savings_plan";
type PrimaryScenario = "normal" | "idle" | "underutilized" | "overutilized" | "uncovered_on_demand";

type CliOptions = {
  tenantId: string;
  cloudConnectionId: string;
  billingSourceId: number;
  providerId: number;
  startDate: string | null;
  endDate: string | null;
  normalInstanceCount: number;
  idleCount: number;
  underutilizedCount: number;
  overutilizedCount: number;
  uncoveredCount: number;
  highCostCount: number;
  seed: string;
  demoPrefix: string;
  cleanupOnly: boolean;
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

type InstanceTypeSpec = {
  instanceType: string;
  hourlyRate: number;
};

type GeneratedInstance = {
  instanceId: string;
  instanceName: string;
  scenario: PrimaryScenario;
  reservationType: ReservationType;
  instanceType: string;
  hourlyRate: number;
  region: RegionRef;
  subAccount: SubAccountRef;
  resourceKey: number;
  availabilityZone: string;
  launchDate: string;
  highCostSignal: boolean;
};

type GeneratedDailyPoint = {
  usageDate: string;
  isRunning: boolean;
  totalHours: number;
  cpuAvg: number | null;
  cpuMin: number | null;
  cpuMax: number | null;
  memoryAvg: number | null;
  memoryMax: number | null;
  diskUsedPercentAvg: number | null;
  diskUsedPercentMax: number | null;
  networkInBytes: number;
  networkOutBytes: number;
  computeCost: number;
  ebsCost: number;
  dataTransferCost: number;
  taxCost: number;
  creditAmount: number;
  refundAmount: number;
  totalBilledCost: number;
  totalEffectiveCost: number;
  totalListCost: number;
  coveredHours: number;
  uncoveredHours: number;
  coveredCost: number;
  uncoveredCost: number;
};

type GeneratedDataset = {
  instances: GeneratedInstance[];
  dailyByInstanceId: Map<string, GeneratedDailyPoint[]>;
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LAST_DAYS = 30;
const DEFAULT_NORMAL_COUNT = 14;
const DEFAULT_IDLE_COUNT = 1;
const DEFAULT_UNDERUTILIZED_COUNT = 1;
const DEFAULT_OVERUTILIZED_COUNT = 1;
const DEFAULT_UNCOVERED_COUNT = 1;
const DEFAULT_HIGH_COST_COUNT = 1;
const DEFAULT_SEED = "ec2-optimization-demo-v1";
const DEFAULT_PREFIX = "i-demo-opt";
const DEMO_DATASET_TAG = "ec2_optimization_demo_dataset_v1";
const DEMO_METRIC_SOURCE = "ec2_optimization_demo_generator";

const REGION_CATALOG = [
  { regionId: "us-east-1", regionName: "US East (N. Virginia)" },
  { regionId: "us-west-2", regionName: "US West (Oregon)" },
  { regionId: "eu-west-1", regionName: "EU (Ireland)" },
] as const;

const NORMAL_INSTANCE_TYPES: readonly InstanceTypeSpec[] = [
  { instanceType: "t3.medium", hourlyRate: 0.0416 },
  { instanceType: "t3.large", hourlyRate: 0.0832 },
  { instanceType: "m5.large", hourlyRate: 0.0960 },
  { instanceType: "m6i.large", hourlyRate: 0.0960 },
  { instanceType: "c6i.large", hourlyRate: 0.0850 },
];

const TARGET_INSTANCE_TYPES: Record<Exclude<PrimaryScenario, "normal">, readonly InstanceTypeSpec[]> = {
  idle: [
    { instanceType: "m5.xlarge", hourlyRate: 0.1920 },
    { instanceType: "r6i.large", hourlyRate: 0.1260 },
  ],
  underutilized: [
    { instanceType: "m5.2xlarge", hourlyRate: 0.3840 },
    { instanceType: "c6i.2xlarge", hourlyRate: 0.3400 },
  ],
  overutilized: [
    { instanceType: "c5.2xlarge", hourlyRate: 0.3400 },
    { instanceType: "c6i.2xlarge", hourlyRate: 0.3400 },
    { instanceType: "m5.2xlarge", hourlyRate: 0.3840 },
  ],
  uncovered_on_demand: [
    { instanceType: "m6i.xlarge", hourlyRate: 0.1920 },
    { instanceType: "c6i.xlarge", hourlyRate: 0.1700 },
    { instanceType: "m5.xlarge", hourlyRate: 0.1920 },
  ],
};

const HIGH_COST_INSTANCE_TYPES: readonly InstanceTypeSpec[] = [
  { instanceType: "m5.4xlarge", hourlyRate: 0.7680 },
  { instanceType: "c6i.4xlarge", hourlyRate: 0.6800 },
  { instanceType: "r6i.4xlarge", hourlyRate: 1.0080 },
];

const RESERVATION_MULTIPLIER: Record<ReservationType, number> = {
  on_demand: 1,
  reserved: 0.72,
  savings_plan: 0.78,
};

function printUsage(): void {
  console.info(`
Usage:
  node dist/scripts/generate-ec2-optimization-demo-data.js --tenant-id=<uuid> --cloud-connection-id=<uuid> --billing-source-id=<id> --provider-id=<id> [options]

Required:
  --tenant-id=<uuid>
  --cloud-connection-id=<uuid>
  --billing-source-id=<id>
  --provider-id=<id>

Options:
  --start-date=YYYY-MM-DD
  --end-date=YYYY-MM-DD
  --normal-instance-count=<10-20>            (default: 14)
  --idle-count=<0-2>                         (default: 1)
  --underutilized-count=<0-2>                (default: 1)
  --overutilized-count=<0-2>                 (default: 1)
  --uncovered-count=<0-2>                    (default: 1)
  --high-cost-count=<1-2>                    (default: 1)
  --seed=<string>                            (default: ec2-optimization-demo-v1)
  --demo-prefix=<string>                     (default: i-demo-opt)
  --cleanup-only                             (delete demo rows only)
  --help

Examples:
  node dist/scripts/generate-ec2-optimization-demo-data.js --tenant-id=<uuid> --cloud-connection-id=<uuid> --billing-source-id=12 --provider-id=1
  node dist/scripts/generate-ec2-optimization-demo-data.js --tenant-id=<uuid> --cloud-connection-id=<uuid> --billing-source-id=12 --provider-id=1 --start-date=2026-03-25 --end-date=2026-04-23 --seed=demo-a
  node dist/scripts/generate-ec2-optimization-demo-data.js --tenant-id=<uuid> --cloud-connection-id=<uuid> --billing-source-id=12 --provider-id=1 --cleanup-only
`);
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseNonNegativeInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
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
    idleCount: DEFAULT_IDLE_COUNT,
    underutilizedCount: DEFAULT_UNDERUTILIZED_COUNT,
    overutilizedCount: DEFAULT_OVERUTILIZED_COUNT,
    uncoveredCount: DEFAULT_UNCOVERED_COUNT,
    highCostCount: DEFAULT_HIGH_COST_COUNT,
    seed: DEFAULT_SEED,
    demoPrefix: DEFAULT_PREFIX,
    cleanupOnly: false,
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
    if (key === "--idle-count") options.idleCount = parseNonNegativeInt(value) ?? options.idleCount;
    if (key === "--underutilized-count") options.underutilizedCount = parseNonNegativeInt(value) ?? options.underutilizedCount;
    if (key === "--overutilized-count") options.overutilizedCount = parseNonNegativeInt(value) ?? options.overutilizedCount;
    if (key === "--uncovered-count") options.uncoveredCount = parseNonNegativeInt(value) ?? options.uncoveredCount;
    if (key === "--high-cost-count") options.highCostCount = parsePositiveInt(value) ?? options.highCostCount;
    if (key === "--seed") options.seed = value;
    if (key === "--demo-prefix") options.demoPrefix = value;
  }

  return options;
}

function validateRunShape(options: CliOptions): void {
  if (!options.tenantId) throw new Error("--tenant-id is required");
  if (!options.cloudConnectionId) throw new Error("--cloud-connection-id is required");
  if (!options.billingSourceId) throw new Error("--billing-source-id is required");
  if (!options.providerId) throw new Error("--provider-id is required");

  if (options.normalInstanceCount < 10 || options.normalInstanceCount > 20) {
    throw new Error("--normal-instance-count must be between 10 and 20");
  }

  for (const [name, value] of [
    ["--idle-count", options.idleCount],
    ["--underutilized-count", options.underutilizedCount],
    ["--overutilized-count", options.overutilizedCount],
    ["--uncovered-count", options.uncoveredCount],
  ] as const) {
    if (value < 0 || value > 2) {
      throw new Error(`${name} must be between 0 and 2`);
    }
  }

  if (options.highCostCount < 1 || options.highCostCount > 2) {
    throw new Error("--high-cost-count must be between 1 and 2");
  }

  const optimizationTargetCount =
    options.idleCount + options.underutilizedCount + options.overutilizedCount + options.uncoveredCount;
  if (optimizationTargetCount < 2 || optimizationTargetCount > 5) {
    throw new Error("Total optimization-target instances (idle + underutilized + overutilized + uncovered) must be between 2 and 5");
  }
}

function resolveDateRange(options: CliOptions): { startDate: string; endDate: string } {
  if (options.startDate || options.endDate) {
    if (!options.startDate || !options.endDate) {
      throw new Error("Provide both --start-date and --end-date together");
    }
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
  for (let current = start; current.getTime() <= end.getTime(); current = addUtcDays(current, 1)) {
    out.push(toDateOnly(current));
  }
  return out;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
  if (Number(connection.providerId) !== options.providerId) {
    throw new Error(`Cloud connection ${options.cloudConnectionId} does not belong to provider ${options.providerId}`);
  }
  if (String(billingSource.tenantId) !== options.tenantId) {
    throw new Error(`Billing source ${options.billingSourceId} does not belong to tenant ${options.tenantId}`);
  }
  if (Number(billingSource.cloudProviderId) !== options.providerId) {
    throw new Error(`Billing source ${options.billingSourceId} does not belong to provider ${options.providerId}`);
  }
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
      regionKey: Number(row.id),
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
    { subAccountId: `demo-opt-prod-${suffix}`, subAccountName: "Demo Opt Production Account" },
    { subAccountId: `demo-opt-dev-${suffix}`, subAccountName: "Demo Opt Development Account" },
    { subAccountId: `demo-opt-analytics-${suffix}`, subAccountName: "Demo Opt Analytics Account" },
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
      subAccountKey: Number(row.id),
    });
  }
  return refs;
}

async function cleanupDemoRows(input: {
  transaction: Transaction;
  tenantId: string;
  cloudConnectionId: string;
  billingSourceId: number;
  providerId: number;
  demoPrefix: string;
}): Promise<Record<string, number>> {
  const instanceLike = `${input.demoPrefix}-%`;

  const deletedFactDaily = await FactEc2InstanceDaily.destroy({
    where: {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      billingSourceId: input.billingSourceId,
      providerId: input.providerId,
      instanceId: { [Op.like]: instanceLike },
    },
    transaction: input.transaction,
  });

  const deletedFactCostDaily = await FactEc2InstanceCostDaily.destroy({
    where: {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      billingSourceId: input.billingSourceId,
      providerId: input.providerId,
      instanceId: { [Op.like]: instanceLike },
    },
    transaction: input.transaction,
  });

  const deletedFactCoverageDaily = await FactEc2InstanceCoverageDaily.destroy({
    where: {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      billingSourceId: input.billingSourceId,
      providerId: input.providerId,
      instanceId: { [Op.like]: instanceLike },
    },
    transaction: input.transaction,
  });

  const deletedUtilizationDaily = await Ec2InstanceUtilizationDaily.destroy({
    where: {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      providerId: input.providerId,
      instanceId: { [Op.like]: instanceLike },
    },
    transaction: input.transaction,
  });

  const deletedInventory = await Ec2InstanceInventorySnapshot.destroy({
    where: {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      providerId: input.providerId,
      instanceId: { [Op.like]: instanceLike },
    },
    transaction: input.transaction,
  });

  const deletedResources = await DimResource.destroy({
    where: {
      tenantId: input.tenantId,
      providerId: input.providerId,
      resourceId: { [Op.like]: instanceLike },
    },
    transaction: input.transaction,
  });

  return {
    fact_ec2_instance_daily: deletedFactDaily,
    fact_ec2_instance_cost_daily: deletedFactCostDaily,
    fact_ec2_instance_coverage_daily: deletedFactCoverageDaily,
    ec2_instance_utilization_daily: deletedUtilizationDaily,
    ec2_instance_inventory_snapshots: deletedInventory,
    dim_resource: deletedResources,
  };
}

function buildScenarioQueue(options: CliOptions): PrimaryScenario[] {
  return [
    ...Array.from({ length: options.normalInstanceCount }, () => "normal" as const),
    ...Array.from({ length: options.idleCount }, () => "idle" as const),
    ...Array.from({ length: options.underutilizedCount }, () => "underutilized" as const),
    ...Array.from({ length: options.overutilizedCount }, () => "overutilized" as const),
    ...Array.from({ length: options.uncoveredCount }, () => "uncovered_on_demand" as const),
  ];
}

function pickReservationType(rng: () => number, scenario: PrimaryScenario): ReservationType {
  if (scenario === "uncovered_on_demand") return "on_demand";
  if (scenario === "idle") return pickOne(rng, ["reserved", "savings_plan", "on_demand"] as const);
  if (scenario === "underutilized") return pickOne(rng, ["savings_plan", "reserved", "on_demand"] as const);
  if (scenario === "overutilized") return pickOne(rng, ["reserved", "on_demand", "savings_plan"] as const);
  return pickOne(rng, ["reserved", "savings_plan", "on_demand"] as const);
}

function pickInstanceType(rng: () => number, scenario: PrimaryScenario): InstanceTypeSpec {
  if (scenario === "normal") return pickOne(rng, NORMAL_INSTANCE_TYPES);
  return pickOne(rng, TARGET_INSTANCE_TYPES[scenario]);
}

function pickLaunchDate(rng: () => number, startDate: string): string {
  const start = dateFromDateOnly(startDate);
  const daysBefore = Math.floor(randomInRange(rng, 14, 180));
  return toDateOnly(addUtcDays(start, -daysBefore));
}

function assignHighCostSignals(instances: GeneratedInstance[], highCostCount: number, rng: () => number): void {
  if (instances.length === 0 || highCostCount <= 0) return;

  const selected = new Set<string>();
  const preferred = instances.filter((instance) =>
    instance.scenario === "underutilized" || instance.scenario === "uncovered_on_demand",
  );
  const secondary = instances.filter((instance) => instance.scenario === "overutilized");
  const fallback = instances.filter((instance) => instance.scenario === "normal" || instance.scenario === "idle");

  const pickFrom = (pool: GeneratedInstance[]): GeneratedInstance | null => {
    const available = pool.filter((item) => !selected.has(item.instanceId));
    if (available.length === 0) return null;
    return pickOne(rng, available);
  };

  if (preferred.length > 0) {
    const picked = pickFrom(preferred);
    if (picked) selected.add(picked.instanceId);
  }

  while (selected.size < highCostCount) {
    const next =
      pickFrom(preferred) ??
      pickFrom(secondary) ??
      pickFrom(fallback) ??
      pickFrom(instances);
    if (!next) break;
    selected.add(next.instanceId);
  }

  for (const instance of instances) {
    if (!selected.has(instance.instanceId)) continue;
    const highType = pickOne(rng, HIGH_COST_INSTANCE_TYPES);
    instance.instanceType = highType.instanceType;
    instance.hourlyRate = highType.hourlyRate;
    instance.highCostSignal = true;
  }
}

function generateCpuProfile(input: {
  rng: () => number;
  scenario: PrimaryScenario;
  dayIndex: number;
}): { avg: number; min: number; max: number } {
  const { rng, scenario, dayIndex } = input;
  const wave = Math.sin(dayIndex / 6) * randomInRange(rng, 0.3, 2.1);

  let avg = 0;
  if (scenario === "idle") avg = randomInRange(rng, 1.0, 4.3) + wave;
  if (scenario === "underutilized") avg = randomInRange(rng, 7.5, 18.5) + wave;
  if (scenario === "overutilized") avg = randomInRange(rng, 79, 93) + wave;
  if (scenario === "uncovered_on_demand") avg = randomInRange(rng, 24, 52) + wave;
  if (scenario === "normal") avg = randomInRange(rng, 22, 55) + wave;

  if (scenario === "idle") avg = clamp(avg, 0.8, 4.8);
  if (scenario === "underutilized") avg = clamp(avg, 5.5, 19.8);
  if (scenario === "overutilized") avg = clamp(avg, 76.5, 96.5);
  if (scenario === "normal" || scenario === "uncovered_on_demand") avg = clamp(avg, 20, 58);

  const min = clamp(avg * randomInRange(rng, 0.45, 0.8), 0.1, 95);
  const max = clamp(avg * randomInRange(rng, 1.1, 1.35), avg, 99);
  return { avg: round6(avg), min: round6(min), max: round6(max) };
}

function generateNetworkBytes(input: {
  rng: () => number;
  scenario: PrimaryScenario;
  totalHours: number;
}): { inBytes: number; outBytes: number } {
  const { rng, scenario, totalHours } = input;
  const hoursFactor = totalHours / 24;

  let totalBytes = 0;
  if (scenario === "idle") totalBytes = randomInRange(rng, 22 * 1024 * 1024, 92 * 1024 * 1024);
  if (scenario === "underutilized") totalBytes = randomInRange(rng, 240 * 1024 * 1024, 920 * 1024 * 1024);
  if (scenario === "overutilized") totalBytes = randomInRange(rng, 1.2 * 1024 * 1024 * 1024, 6 * 1024 * 1024 * 1024);
  if (scenario === "uncovered_on_demand") totalBytes = randomInRange(rng, 1.1 * 1024 * 1024 * 1024, 3.6 * 1024 * 1024 * 1024);
  if (scenario === "normal") totalBytes = randomInRange(rng, 1.3 * 1024 * 1024 * 1024, 4.6 * 1024 * 1024 * 1024);

  totalBytes *= clamp(hoursFactor, 0.2, 1);
  const inRatio = randomInRange(rng, 0.42, 0.62);
  const inBytes = Math.max(0, Math.floor(totalBytes * inRatio));
  const outBytes = Math.max(0, Math.floor(totalBytes - inBytes));
  return { inBytes, outBytes };
}

function generateDailyPoints(input: {
  rng: () => number;
  dates: string[];
  scenario: PrimaryScenario;
  reservationType: ReservationType;
  hourlyRate: number;
  highCostSignal: boolean;
}): GeneratedDailyPoint[] {
  const points: GeneratedDailyPoint[] = [];
  const { rng, dates, scenario, reservationType, hourlyRate, highCostSignal } = input;
  const reservationMultiplier = RESERVATION_MULTIPLIER[reservationType];
  const highCostBoost = highCostSignal ? randomInRange(rng, 1.65, 2.5) : 1;

  for (let dayIndex = 0; dayIndex < dates.length; dayIndex += 1) {
    const usageDate = dates[dayIndex];
    const alwaysRunning = scenario !== "normal";
    const isRunning = alwaysRunning ? true : rng() < 0.92;
    const totalHours = isRunning ? randomInRange(rng, alwaysRunning ? 22.5 : 18, 24) : 0;

    const cpu = isRunning
      ? generateCpuProfile({
          rng,
          scenario,
          dayIndex,
        })
      : { avg: null, min: null, max: null };

    const network = generateNetworkBytes({
      rng,
      scenario,
      totalHours,
    });

    const baseCompute = totalHours * hourlyRate * reservationMultiplier * highCostBoost;
    const computeCost = round6(baseCompute * randomInRange(rng, 0.93, 1.12));
    const ebsCost = round6(computeCost * randomInRange(rng, 0.04, 0.13));
    const dataTransferCost = round6(computeCost * randomInRange(rng, 0.02, 0.09));
    const taxCost = 0;
    const creditAmount = 0;
    const refundAmount = 0;
    const totalBilledCost = round6(computeCost + ebsCost + dataTransferCost + taxCost - creditAmount - refundAmount);
    const totalEffectiveCost = totalBilledCost;
    const onDemandListCompute = totalHours * hourlyRate * highCostBoost;
    const totalListCost = round6(onDemandListCompute + ebsCost + dataTransferCost);

    let coveredHours = 0;
    let uncoveredHours = round6(totalHours);
    let coveredCost = 0;
    let uncoveredCost = computeCost;
    if (reservationType === "reserved" || reservationType === "savings_plan") {
      const coveredRatio = randomInRange(rng, 0.86, 0.99);
      coveredHours = round6(totalHours * coveredRatio);
      uncoveredHours = round6(Math.max(0, totalHours - coveredHours));
      coveredCost = round6(computeCost * coveredRatio);
      uncoveredCost = round6(Math.max(0, computeCost - coveredCost));
    }

    points.push({
      usageDate,
      isRunning,
      totalHours: round6(totalHours),
      cpuAvg: cpu.avg,
      cpuMin: cpu.min,
      cpuMax: cpu.max,
      memoryAvg: isRunning ? round6(randomInRange(rng, 32, 78)) : null,
      memoryMax: isRunning ? round6(randomInRange(rng, 48, 91)) : null,
      diskUsedPercentAvg: isRunning ? round6(randomInRange(rng, 24, 76)) : null,
      diskUsedPercentMax: isRunning ? round6(randomInRange(rng, 42, 91)) : null,
      networkInBytes: network.inBytes,
      networkOutBytes: network.outBytes,
      computeCost,
      ebsCost,
      dataTransferCost,
      taxCost,
      creditAmount,
      refundAmount,
      totalBilledCost,
      totalEffectiveCost,
      totalListCost,
      coveredHours,
      uncoveredHours,
      coveredCost,
      uncoveredCost,
    });
  }

  return points;
}

function generateDataset(input: {
  options: CliOptions;
  startDate: string;
  endDate: string;
  regions: RegionRef[];
  subAccounts: SubAccountRef[];
  resourceKeyByInstanceId: Map<string, number>;
}): GeneratedDataset {
  const rng = createRng(input.options.seed);
  const dates = listDateRange(input.startDate, input.endDate);
  const seedSuffix = seedToInt(input.options.seed).toString(16).padStart(8, "0").slice(0, 8);
  const scenarios = buildScenarioQueue(input.options);

  const instances: GeneratedInstance[] = scenarios.map((scenario, index) => {
    const instanceId = `${input.options.demoPrefix}-${seedSuffix}-${String(index + 1).padStart(3, "0")}`;
    const resourceKey = input.resourceKeyByInstanceId.get(instanceId);
    if (!resourceKey) {
      throw new Error(`Missing resource key for ${instanceId}`);
    }

    const typeSpec = pickInstanceType(rng, scenario);
    const region = pickOne(rng, input.regions);
    const subAccount = pickOne(rng, input.subAccounts);
    const availabilityZone = `${region.regionId}${pickOne(rng, ["a", "b", "c"] as const)}`;

    return {
      instanceId,
      instanceName: `demo-opt-${scenario.replace(/_/g, "-")}-${String(index + 1).padStart(2, "0")}`,
      scenario,
      reservationType: pickReservationType(rng, scenario),
      instanceType: typeSpec.instanceType,
      hourlyRate: typeSpec.hourlyRate,
      region,
      subAccount,
      resourceKey,
      availabilityZone,
      launchDate: pickLaunchDate(rng, input.startDate),
      highCostSignal: false,
    };
  });

  assignHighCostSignals(instances, input.options.highCostCount, rng);

  const dailyByInstanceId = new Map<string, GeneratedDailyPoint[]>();
  for (const instance of instances) {
    dailyByInstanceId.set(
      instance.instanceId,
      generateDailyPoints({
        rng,
        dates,
        scenario: instance.scenario,
        reservationType: instance.reservationType,
        hourlyRate: instance.hourlyRate,
        highCostSignal: instance.highCostSignal,
      }),
    );
  }

  return {
    instances,
    dailyByInstanceId,
  };
}

async function seedDemoData(input: {
  options: CliOptions;
  startDate: string;
  endDate: string;
}): Promise<{
  deletedCounts: Record<string, number>;
  insertedCounts: Record<string, number>;
  dataset: GeneratedDataset;
}> {
  const providerIdText = String(input.options.providerId);
  return sequelize.transaction(async (transaction) => {
    const deletedCounts = await cleanupDemoRows({
      transaction,
      tenantId: input.options.tenantId,
      cloudConnectionId: input.options.cloudConnectionId,
      billingSourceId: input.options.billingSourceId,
      providerId: input.options.providerId,
      demoPrefix: input.options.demoPrefix,
    });

    if (input.options.cleanupOnly) {
      return {
        deletedCounts,
        insertedCounts: {} as Record<string, number>,
        dataset: { instances: [], dailyByInstanceId: new Map() },
      };
    }

    const [regions, subAccounts] = await Promise.all([
      ensureRegionRefs(providerIdText, transaction),
      ensureSubAccountRefs(input.options.tenantId, providerIdText, input.options.seed, transaction),
    ]);

    const totalInstances =
      input.options.normalInstanceCount +
      input.options.idleCount +
      input.options.underutilizedCount +
      input.options.overutilizedCount +
      input.options.uncoveredCount;
    const seedSuffix = seedToInt(input.options.seed).toString(16).padStart(8, "0").slice(0, 8);
    const instanceIds = Array.from({ length: totalInstances }, (_, index) => {
      return `${input.options.demoPrefix}-${seedSuffix}-${String(index + 1).padStart(3, "0")}`;
    });

    const resourceRows = instanceIds.map((instanceId) => ({
      tenantId: input.options.tenantId,
      providerId: providerIdText,
      resourceId: instanceId,
      resourceName: `[${DEMO_DATASET_TAG}] ${instanceId}`,
      resourceType: "AWS::EC2::Instance",
    }));
    await DimResource.bulkCreate(resourceRows as any[], { transaction, ignoreDuplicates: true });

    const resourceRecords = await DimResource.findAll({
      where: {
        tenantId: input.options.tenantId,
        providerId: input.options.providerId,
        resourceId: { [Op.in]: instanceIds },
      },
      attributes: ["id", "resourceId"],
      transaction,
    });
    const resourceKeyByInstanceId = new Map<string, number>();
    for (const row of resourceRecords) {
      resourceKeyByInstanceId.set(String(row.resourceId), Number(row.id));
    }

    const dataset = generateDataset({
      options: input.options,
      startDate: input.startDate,
      endDate: input.endDate,
      regions,
      subAccounts,
      resourceKeyByInstanceId,
    });

    const inventoryRows: Array<Record<string, unknown>> = [];
    const factDailyRows: Array<Record<string, unknown>> = [];
    const factCostRows: Array<Record<string, unknown>> = [];
    const factCoverageRows: Array<Record<string, unknown>> = [];
    const utilizationRows: Array<Record<string, unknown>> = [];

    const rng = createRng(`${input.options.seed}-rows`);
    for (const instance of dataset.instances) {
      inventoryRows.push({
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
        architecture: pickOne(rng, ["x86_64", "arm64"] as const),
        virtualizationType: "hvm",
        tenancy: "default",
        state: "running",
        instanceLifecycle: instance.reservationType === "on_demand" ? "on-demand" : null,
        launchTime: new Date(`${instance.launchDate}T08:00:00.000Z`),
        availabilityZone: instance.availabilityZone,
        vpcId: `vpc-${seedToInt(`${instance.instanceId}-vpc`).toString(16).slice(0, 8)}`,
        subnetId: `subnet-${seedToInt(`${instance.instanceId}-subnet`).toString(16).slice(0, 8)}`,
        imageId: `ami-${seedToInt(`${instance.instanceId}-ami`).toString(16).slice(0, 8)}`,
        privateIpAddress: `10.${Math.floor(randomInRange(rng, 10, 220))}.${Math.floor(randomInRange(rng, 1, 250))}.${Math.floor(randomInRange(rng, 5, 250))}`,
        publicIpAddress: `44.${Math.floor(randomInRange(rng, 10, 220))}.${Math.floor(randomInRange(rng, 1, 250))}.${Math.floor(randomInRange(rng, 5, 250))}`,
        discoveredAt: new Date(`${input.endDate}T12:00:00.000Z`),
        isCurrent: true,
        tagsJson: {
          Name: instance.instanceName,
          Environment: pickOne(rng, ["prod", "staging", "dev"] as const),
          DemoDataset: DEMO_DATASET_TAG,
          DemoScenario: instance.scenario,
        },
        metadataJson: {
          generator: DEMO_DATASET_TAG,
          seed: input.options.seed,
          highCostSignal: instance.highCostSignal,
          reservationType: instance.reservationType,
        },
      });

      const points = dataset.dailyByInstanceId.get(instance.instanceId) ?? [];
      for (const point of points) {
        const reservationArn =
          instance.reservationType === "reserved"
            ? `arn:aws:ec2:${instance.region.regionId}:${instance.subAccount.subAccountId}:reserved-instances/demo-opt`
            : null;
        const savingsPlanArn =
          instance.reservationType === "savings_plan"
            ? `arn:aws:savingsplans::${instance.subAccount.subAccountId}:savingsplan/demo-opt`
            : null;

        factDailyRows.push({
          tenantId: input.options.tenantId,
          cloudConnectionId: input.options.cloudConnectionId,
          billingSourceId: input.options.billingSourceId,
          providerId: providerIdText,
          usageDate: point.usageDate,
          instanceId: instance.instanceId,
          resourceKey: instance.resourceKey,
          regionKey: instance.region.regionKey,
          subAccountKey: instance.subAccount.subAccountKey,
          instanceName: instance.instanceName,
          instanceType: instance.instanceType,
          availabilityZone: instance.availabilityZone,
          isSpot: false,
          state: point.isRunning ? "running" : "stopped",
          isRunning: point.isRunning,
          totalHours: point.totalHours,
          computeCost: point.computeCost,
          ebsCost: point.ebsCost,
          dataTransferCost: point.dataTransferCost,
          taxCost: point.taxCost,
          creditAmount: point.creditAmount,
          refundAmount: point.refundAmount,
          totalBilledCost: point.totalBilledCost,
          totalEffectiveCost: point.totalEffectiveCost,
          totalListCost: point.totalListCost,
          currencyCode: "USD",
          launchTime: new Date(`${instance.launchDate}T08:00:00.000Z`),
          source: DEMO_DATASET_TAG,
          platform: "linux",
          platformDetails: "Linux/UNIX",
          architecture: "x86_64",
          tenancy: "default",
          vpcId: `vpc-${seedToInt(`${instance.instanceId}-vpc`).toString(16).slice(0, 8)}`,
          subnetId: `subnet-${seedToInt(`${instance.instanceId}-subnet`).toString(16).slice(0, 8)}`,
          imageId: `ami-${seedToInt(`${instance.instanceId}-ami`).toString(16).slice(0, 8)}`,
          cpuAvg: point.cpuAvg,
          cpuMax: point.cpuMax,
          cpuMin: point.cpuMin,
          memoryAvg: point.memoryAvg,
          memoryMax: point.memoryMax,
          diskUsedPercentAvg: point.diskUsedPercentAvg,
          diskUsedPercentMax: point.diskUsedPercentMax,
          networkInBytes: point.networkInBytes,
          networkOutBytes: point.networkOutBytes,
          pricingModel: instance.reservationType,
          effectiveCost: point.totalEffectiveCost,
          billedCost: point.totalBilledCost,
          listCost: point.totalListCost,
          reservationType: instance.reservationType,
          reservationArn,
          savingsPlanArn,
          savingsPlanType: instance.reservationType === "savings_plan" ? "ComputeSavingsPlans" : null,
          coveredHours: point.coveredHours,
          uncoveredHours: point.uncoveredHours,
          coveredCost: point.coveredCost,
          uncoveredCost: point.uncoveredCost,
          isIdleCandidate: null,
          isUnderutilizedCandidate: null,
          isOverutilizedCandidate: null,
          idleScore: null,
          rightsizingScore: null,
        });

        factCostRows.push({
          tenantId: input.options.tenantId,
          cloudConnectionId: input.options.cloudConnectionId,
          billingSourceId: input.options.billingSourceId,
          providerId: providerIdText,
          usageDate: point.usageDate,
          instanceId: instance.instanceId,
          resourceKey: instance.resourceKey,
          regionKey: instance.region.regionKey,
          subAccountKey: instance.subAccount.subAccountKey,
          instanceType: instance.instanceType,
          currencyCode: "USD",
          computeCost: point.computeCost,
          ebsCost: point.ebsCost,
          dataTransferCost: point.dataTransferCost,
          taxCost: point.taxCost,
          creditAmount: point.creditAmount,
          refundAmount: point.refundAmount,
          totalBilledCost: point.totalBilledCost,
          totalEffectiveCost: point.totalEffectiveCost,
          totalListCost: point.totalListCost,
          usageHours: point.totalHours,
        });

        factCoverageRows.push({
          tenantId: input.options.tenantId,
          cloudConnectionId: input.options.cloudConnectionId,
          billingSourceId: input.options.billingSourceId,
          providerId: providerIdText,
          usageDate: point.usageDate,
          instanceId: instance.instanceId,
          resourceKey: instance.resourceKey,
          regionKey: instance.region.regionKey,
          subAccountKey: instance.subAccount.subAccountKey,
          instanceType: instance.instanceType,
          reservationType: instance.reservationType,
          reservationArn,
          savingsPlanArn,
          savingsPlanType: instance.reservationType === "savings_plan" ? "ComputeSavingsPlans" : null,
          coveredHours: point.coveredHours,
          uncoveredHours: point.uncoveredHours,
          coveredCost: point.coveredCost,
          uncoveredCost: point.uncoveredCost,
          effectiveCost: point.totalEffectiveCost,
        });

        utilizationRows.push({
          tenantId: input.options.tenantId,
          cloudConnectionId: input.options.cloudConnectionId,
          providerId: providerIdText,
          instanceId: instance.instanceId,
          usageDate: point.usageDate,
          resourceKey: instance.resourceKey,
          regionKey: instance.region.regionKey,
          subAccountKey: instance.subAccount.subAccountKey,
          cpuAvg: point.cpuAvg,
          cpuMax: point.cpuMax,
          cpuMin: point.cpuMin,
          networkInBytes: point.networkInBytes,
          networkOutBytes: point.networkOutBytes,
          networkPacketsIn: Math.floor(point.networkInBytes / randomInRange(rng, 450, 850)),
          networkPacketsOut: Math.floor(point.networkOutBytes / randomInRange(rng, 450, 850)),
          diskReadBytes: Math.floor(randomInRange(rng, 30_000_000, 1_100_000_000)),
          diskWriteBytes: Math.floor(randomInRange(rng, 30_000_000, 1_300_000_000)),
          diskReadOps: Math.floor(randomInRange(rng, 1_000, 100_000)),
          diskWriteOps: Math.floor(randomInRange(rng, 1_000, 120_000)),
          statusCheckFailedMax: 0,
          statusCheckFailedInstanceMax: 0,
          statusCheckFailedSystemMax: 0,
          ebsReadBytes: Math.floor(randomInRange(rng, 20_000_000, 900_000_000)),
          ebsWriteBytes: Math.floor(randomInRange(rng, 20_000_000, 900_000_000)),
          ebsReadOps: Math.floor(randomInRange(rng, 800, 50_000)),
          ebsWriteOps: Math.floor(randomInRange(rng, 800, 60_000)),
          ebsQueueLengthMax: round6(randomInRange(rng, 0.01, 2.8)),
          ebsIdleTimeAvg: round6(randomInRange(rng, 45, 96)),
          ebsBurstBalanceAvg: round6(randomInRange(rng, 72, 100)),
          memoryAvg: point.memoryAvg,
          memoryMax: point.memoryMax,
          swapUsedAvg: round6(randomInRange(rng, 0, 45)),
          diskUsedPercentAvg: point.diskUsedPercentAvg,
          diskUsedPercentMax: point.diskUsedPercentMax,
          diskFreeBytesAvg: Math.floor(randomInRange(rng, 8_000_000_000, 110_000_000_000)),
          isIdleCandidate: null,
          isUnderutilizedCandidate: null,
          isOverutilizedCandidate: null,
          peakToAvgCpuRatio:
            point.cpuAvg && point.cpuAvg > 0 && point.cpuMax ? round6(point.cpuMax / point.cpuAvg) : null,
          sampleCount: 24,
          metricSource: DEMO_METRIC_SOURCE,
        });
      }
    }

    await Ec2InstanceInventorySnapshot.bulkCreate(inventoryRows as any[], { transaction });
    await FactEc2InstanceDaily.bulkCreate(factDailyRows as any[], { transaction });
    await FactEc2InstanceCostDaily.bulkCreate(factCostRows as any[], { transaction });
    await FactEc2InstanceCoverageDaily.bulkCreate(factCoverageRows as any[], { transaction });
    await Ec2InstanceUtilizationDaily.bulkCreate(utilizationRows as any[], { transaction });

    return {
      deletedCounts,
      insertedCounts: {
        ec2_instance_inventory_snapshots: inventoryRows.length,
        fact_ec2_instance_daily: factDailyRows.length,
        fact_ec2_instance_cost_daily: factCostRows.length,
        fact_ec2_instance_coverage_daily: factCoverageRows.length,
        ec2_instance_utilization_daily: utilizationRows.length,
      },
      dataset,
    };
  });
}

function countByScenario(instances: GeneratedInstance[]): Record<PrimaryScenario, number> {
  return instances.reduce<Record<PrimaryScenario, number>>(
    (acc, instance) => {
      acc[instance.scenario] += 1;
      return acc;
    },
    {
      normal: 0,
      idle: 0,
      underutilized: 0,
      overutilized: 0,
      uncovered_on_demand: 0,
    },
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  if (options.help) {
    printUsage();
    return;
  }

  validateRunShape(options);
  const { startDate, endDate } = resolveDateRange(options);

  console.info("Starting EC2 optimization demo data generation", {
    tenantId: options.tenantId,
    cloudConnectionId: options.cloudConnectionId,
    billingSourceId: options.billingSourceId,
    providerId: options.providerId,
    startDate,
    endDate,
    normalInstanceCount: options.normalInstanceCount,
    idleCount: options.idleCount,
    underutilizedCount: options.underutilizedCount,
    overutilizedCount: options.overutilizedCount,
    uncoveredCount: options.uncoveredCount,
    highCostCount: options.highCostCount,
    seed: options.seed,
    demoPrefix: options.demoPrefix,
    cleanupOnly: options.cleanupOnly,
  });

  await assertScopeExists(options);

  const startedAt = Date.now();
  const result = await seedDemoData({ options, startDate, endDate });

  if (options.cleanupOnly) {
    console.info("EC2 optimization demo cleanup completed", {
      deletedRowsByTable: result.deletedCounts,
      cleanupOnly: true,
      durationMs: Date.now() - startedAt,
    });
    return;
  }

  const scenarioCounts = countByScenario(result.dataset.instances);
  const highCostSignals = result.dataset.instances
    .filter((instance) => instance.highCostSignal)
    .map((instance) => ({
      instanceId: instance.instanceId,
      scenario: instance.scenario,
      reservationType: instance.reservationType,
      instanceType: instance.instanceType,
    }));

  console.info("EC2 optimization demo data generation completed", {
    dateRange: { startDate, endDate },
    generatedResources: {
      normal: scenarioCounts.normal,
      optimizationTargets:
        scenarioCounts.idle +
        scenarioCounts.underutilized +
        scenarioCounts.overutilized +
        scenarioCounts.uncovered_on_demand,
      byOptimizationType: {
        idle: scenarioCounts.idle,
        underutilized: scenarioCounts.underutilized,
        overutilized: scenarioCounts.overutilized,
        uncovered_on_demand: scenarioCounts.uncovered_on_demand,
      },
      highCostSignals: highCostSignals.length,
    },
    highCostAssignments: highCostSignals,
    deletedRowsByTable: result.deletedCounts,
    insertedRowsByTable: result.insertedCounts,
    cleanupOnly: false,
    durationMs: Date.now() - startedAt,
  });
}

main()
  .catch((error) => {
    console.error(
      "EC2 optimization demo data generation failed:",
      error instanceof Error ? error.message : String(error),
    );
    printUsage();
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
