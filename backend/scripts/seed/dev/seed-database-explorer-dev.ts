import util from "node:util";
import { Op } from "sequelize";

import {
  CloudConnectionV2,
  DbCostHistoryDaily,
  DbResourceInventorySnapshot,
  DimRegion,
  FactDbResourceDaily,
  sequelize,
} from "../../../src/models/index.js";

type SeedMode = "upsert" | "cleanup";
type RegionCode = "us-east-1" | "us-west-2" | "eu-west-1" | "ap-south-1";
type ResourceType = "cluster" | "instance" | "node" | "table" | "cache" | "graph" | "stream";
type Environment = "prod" | "staging";
type WorkloadPattern = "transactional" | "analytics" | "cache" | "document" | "graph" | "wide_column" | "timeseries";
type CostCategory = "compute" | "storage" | "io" | "backup" | "data_transfer" | "tax" | "credit" | "refund";

type RegionKeys = Record<RegionCode, string>;

type CategoryMix = {
  compute: number;
  storage: number;
  io: number;
  backup: number;
  data_transfer: number;
};

type ResourceTemplate = {
  resourceId: string;
  resourceName: string;
  resourceType: ResourceType;
  dbService: "AmazonRDS" | "Aurora" | "DynamoDB" | "ElastiCache" | "MemoryDB" | "DocumentDB" | "Neptune" | "Keyspaces" | "Timestream";
  dbEngine:
    | "PostgreSQL"
    | "MySQL"
    | "Aurora PostgreSQL"
    | "Aurora MySQL"
    | "DynamoDB"
    | "Redis OSS"
    | "Valkey"
    | "MongoDB-compatible"
    | "Neptune Graph"
    | "Apache Cassandra-compatible"
    | "Timestream LiveAnalytics";
  dbEngineVersion: string;
  environment: Environment;
  workloadPattern: WorkloadPattern;
  regionCode: RegionCode;
  instanceClass: string;
  status: "available" | "modifying" | "scaling";
  clusterId?: string;
  clusterRole?: "writer" | "reader" | "primary" | "replica" | "member";
  isClusterResource?: boolean;
  capacityMode?: string;
  allocatedStorageGb: number;
  storageUsedRatio: number;
  dataFootprintBaseGb: number;
  dataFootprintTrendPerDay: number;
  loadBase: number;
  loadTrendPerDay: number;
  connectionsBase: number;
  connectionsTrendPerDay: number;
  readThroughputBaseBytes: number;
  writeThroughputBaseBytes: number;
  throughputTrendPerDay: number;
  baseDailyCost: number;
  costTrendPerDay: number;
  weekendMultiplier: number;
  spikeDays: ReadonlySet<string>;
  spikeMultiplier: number;
  seasonalityAmplitude: number;
  seasonalityPhase: number;
  billedCostMultiplier: number;
  listCostMultiplier: number;
  taxRate: number;
  creditRate: number;
  refundRate: number;
  refundDays: ReadonlySet<string>;
  categoryMix: CategoryMix;
};

type FactSeedRow = {
  tenantId: string;
  cloudConnectionId: string;
  providerId: string;
  usageDate: string;
  resourceId: string;
  resourceArn: string | null;
  resourceName: string;
  dbService: ResourceTemplate["dbService"];
  dbEngine: ResourceTemplate["dbEngine"];
  dbEngineVersion: string;
  resourceType: ResourceType;
  regionKey: string;
  status: string;
  clusterId: string | null;
  isClusterResource: boolean;
  allocatedStorageGb: string;
  dataFootprintGb: string;
  storageUsedGb: string;
  computeCost: string;
  storageCost: string;
  ioCost: string;
  backupCost: string;
  dataTransferCost: string;
  taxCost: string;
  creditAmount: string;
  refundAmount: string;
  totalBilledCost: string;
  totalEffectiveCost: string;
  totalListCost: string;
  loadAvg: string;
  connectionsAvg: string;
  connectionsMax: string;
  cpuAvg: string | null;
  cpuMax: string | null;
  requestCount: string | null;
  readIops: string | null;
  writeIops: string | null;
  readThroughputBytes: string;
  writeThroughputBytes: string;
  currencyCode: "USD";
};

type CostHistorySeedRow = {
  usageDate: string;
  monthStart: string;
  tenantId: string;
  cloudConnectionId: string;
  providerId: string;
  regionKey: string;
  resourceId: string;
  dbService: ResourceTemplate["dbService"];
  dbEngine: ResourceTemplate["dbEngine"];
  costCategory: CostCategory;
  billedCost: string;
  effectiveCost: string;
  listCost: string;
  usageQuantity: string | null;
  currencyCode: "USD";
};

type InventorySeedRow = {
  tenantId: string;
  cloudConnectionId: string;
  providerId: string;
  resourceId: string;
  resourceArn: string | null;
  resourceName: string;
  dbService: ResourceTemplate["dbService"];
  dbEngine: ResourceTemplate["dbEngine"];
  dbEngineVersion: string;
  resourceType: ResourceType;
  regionKey: string;
  status: string;
  allocatedStorageGb: string;
  dataFootprintGb: string;
  instanceClass: string;
  capacityMode: string | null;
  clusterId: string | null;
  isClusterResource: boolean;
  tagsJson: Record<string, unknown>;
  metadataJson: Record<string, unknown>;
  discoveredAt: Date;
  isCurrent: true;
  deletedAt: null;
};

type SeedDataset = {
  factRows: FactSeedRow[];
  costRows: CostHistorySeedRow[];
  inventoryRows: InventorySeedRow[];
};

const CONNECTION_NAME = "janu-674";
const ACTIVE_STATUSES = ["active", "active_with_warnings"] as const;
const DEMO_RESOURCE_PREFIX = "kcx-dev-dbexp-";
const SEED_START = "2026-03-01";
const SEED_END = "2026-05-10";
const GLOBAL_SPIKE_DAYS = new Set(["2026-03-17", "2026-04-09", "2026-04-24", "2026-05-06"]);
const GLOBAL_REFUND_DAYS = new Set(["2026-03-12", "2026-04-18", "2026-05-02"]);

const REGION_METADATA: Record<RegionCode, { regionId: RegionCode; regionName: string }> = {
  "us-east-1": { regionId: "us-east-1", regionName: "US East (N. Virginia)" },
  "us-west-2": { regionId: "us-west-2", regionName: "US West (Oregon)" },
  "eu-west-1": { regionId: "eu-west-1", regionName: "Europe (Ireland)" },
  "ap-south-1": { regionId: "ap-south-1", regionName: "Asia Pacific (Mumbai)" },
};

const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}prod-aurora-orders-writer`,
    resourceName: "prod-aurora-orders-writer",
    resourceType: "node",
    dbService: "Aurora",
    dbEngine: "Aurora PostgreSQL",
    dbEngineVersion: "15.4",
    environment: "prod",
    workloadPattern: "transactional",
    regionCode: "us-east-1",
    instanceClass: "db.r6g.2xlarge",
    status: "available",
    clusterId: "prod-aurora-orders",
    clusterRole: "writer",
    allocatedStorageGb: 1800,
    storageUsedRatio: 0.76,
    dataFootprintBaseGb: 1320,
    dataFootprintTrendPerDay: 3.2,
    loadBase: 8.9,
    loadTrendPerDay: 0.016,
    connectionsBase: 980,
    connectionsTrendPerDay: 2.8,
    readThroughputBaseBytes: 138_000_000,
    writeThroughputBaseBytes: 94_000_000,
    throughputTrendPerDay: 780_000,
    baseDailyCost: 238,
    costTrendPerDay: 0.86,
    weekendMultiplier: 0.91,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.24,
    seasonalityAmplitude: 0.07,
    seasonalityPhase: 0.2,
    billedCostMultiplier: 1.03,
    listCostMultiplier: 1.11,
    taxRate: 0.014,
    creditRate: 0.018,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.58, storage: 0.19, io: 0.11, backup: 0.08, data_transfer: 0.04 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}prod-aurora-orders-reader`,
    resourceName: "prod-aurora-orders-reader",
    resourceType: "node",
    dbService: "Aurora",
    dbEngine: "Aurora PostgreSQL",
    dbEngineVersion: "15.4",
    environment: "prod",
    workloadPattern: "transactional",
    regionCode: "us-east-1",
    instanceClass: "db.r6g.xlarge",
    status: "available",
    clusterId: "prod-aurora-orders",
    clusterRole: "reader",
    allocatedStorageGb: 1600,
    storageUsedRatio: 0.74,
    dataFootprintBaseGb: 1180,
    dataFootprintTrendPerDay: 2.7,
    loadBase: 5.8,
    loadTrendPerDay: 0.012,
    connectionsBase: 620,
    connectionsTrendPerDay: 1.9,
    readThroughputBaseBytes: 126_000_000,
    writeThroughputBaseBytes: 41_000_000,
    throughputTrendPerDay: 640_000,
    baseDailyCost: 156,
    costTrendPerDay: 0.54,
    weekendMultiplier: 0.92,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.19,
    seasonalityAmplitude: 0.06,
    seasonalityPhase: 0.9,
    billedCostMultiplier: 1.03,
    listCostMultiplier: 1.1,
    taxRate: 0.014,
    creditRate: 0.014,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.53, storage: 0.22, io: 0.12, backup: 0.08, data_transfer: 0.05 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}prod-aurora-profile-writer`,
    resourceName: "prod-aurora-profile-writer",
    resourceType: "node",
    dbService: "Aurora",
    dbEngine: "Aurora MySQL",
    dbEngineVersion: "8.0.mysql_aurora.3.06.1",
    environment: "prod",
    workloadPattern: "transactional",
    regionCode: "us-west-2",
    instanceClass: "db.r6g.2xlarge",
    status: "available",
    clusterId: "prod-aurora-profile",
    clusterRole: "writer",
    allocatedStorageGb: 1450,
    storageUsedRatio: 0.7,
    dataFootprintBaseGb: 1010,
    dataFootprintTrendPerDay: 2.4,
    loadBase: 7.2,
    loadTrendPerDay: 0.013,
    connectionsBase: 760,
    connectionsTrendPerDay: 2.2,
    readThroughputBaseBytes: 102_000_000,
    writeThroughputBaseBytes: 71_000_000,
    throughputTrendPerDay: 590_000,
    baseDailyCost: 192,
    costTrendPerDay: 0.67,
    weekendMultiplier: 0.92,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.2,
    seasonalityAmplitude: 0.065,
    seasonalityPhase: 1.6,
    billedCostMultiplier: 1.03,
    listCostMultiplier: 1.1,
    taxRate: 0.013,
    creditRate: 0.017,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.56, storage: 0.21, io: 0.1, backup: 0.08, data_transfer: 0.05 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}prod-aurora-profile-reader`,
    resourceName: "prod-aurora-profile-reader",
    resourceType: "node",
    dbService: "Aurora",
    dbEngine: "Aurora MySQL",
    dbEngineVersion: "8.0.mysql_aurora.3.06.1",
    environment: "prod",
    workloadPattern: "transactional",
    regionCode: "us-west-2",
    instanceClass: "db.r6g.xlarge",
    status: "available",
    clusterId: "prod-aurora-profile",
    clusterRole: "reader",
    allocatedStorageGb: 1320,
    storageUsedRatio: 0.69,
    dataFootprintBaseGb: 910,
    dataFootprintTrendPerDay: 2.1,
    loadBase: 4.9,
    loadTrendPerDay: 0.01,
    connectionsBase: 540,
    connectionsTrendPerDay: 1.7,
    readThroughputBaseBytes: 88_000_000,
    writeThroughputBaseBytes: 32_000_000,
    throughputTrendPerDay: 480_000,
    baseDailyCost: 128,
    costTrendPerDay: 0.42,
    weekendMultiplier: 0.93,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.17,
    seasonalityAmplitude: 0.055,
    seasonalityPhase: 2.1,
    billedCostMultiplier: 1.03,
    listCostMultiplier: 1.09,
    taxRate: 0.013,
    creditRate: 0.013,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.52, storage: 0.23, io: 0.12, backup: 0.08, data_transfer: 0.05 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}prod-rds-ledger-postgres`,
    resourceName: "prod-rds-ledger-postgres",
    resourceType: "instance",
    dbService: "AmazonRDS",
    dbEngine: "PostgreSQL",
    dbEngineVersion: "15.5",
    environment: "prod",
    workloadPattern: "analytics",
    regionCode: "eu-west-1",
    instanceClass: "db.r5.2xlarge",
    status: "available",
    allocatedStorageGb: 980,
    storageUsedRatio: 0.72,
    dataFootprintBaseGb: 706,
    dataFootprintTrendPerDay: 2.6,
    loadBase: 6.1,
    loadTrendPerDay: 0.014,
    connectionsBase: 340,
    connectionsTrendPerDay: 1.5,
    readThroughputBaseBytes: 84_000_000,
    writeThroughputBaseBytes: 53_000_000,
    throughputTrendPerDay: 420_000,
    baseDailyCost: 136,
    costTrendPerDay: 0.51,
    weekendMultiplier: 0.86,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.16,
    seasonalityAmplitude: 0.08,
    seasonalityPhase: 0.5,
    billedCostMultiplier: 1.025,
    listCostMultiplier: 1.08,
    taxRate: 0.012,
    creditRate: 0.012,
    refundRate: 0.006,
    refundDays: GLOBAL_REFUND_DAYS,
    categoryMix: { compute: 0.49, storage: 0.24, io: 0.13, backup: 0.1, data_transfer: 0.04 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}stg-rds-reporting-mysql`,
    resourceName: "stg-rds-reporting-mysql",
    resourceType: "instance",
    dbService: "AmazonRDS",
    dbEngine: "MySQL",
    dbEngineVersion: "8.0.39",
    environment: "staging",
    workloadPattern: "analytics",
    regionCode: "ap-south-1",
    instanceClass: "db.r6g.large",
    status: "available",
    allocatedStorageGb: 420,
    storageUsedRatio: 0.58,
    dataFootprintBaseGb: 244,
    dataFootprintTrendPerDay: 0.9,
    loadBase: 2.2,
    loadTrendPerDay: 0.007,
    connectionsBase: 96,
    connectionsTrendPerDay: 0.45,
    readThroughputBaseBytes: 24_000_000,
    writeThroughputBaseBytes: 12_000_000,
    throughputTrendPerDay: 170_000,
    baseDailyCost: 52,
    costTrendPerDay: 0.18,
    weekendMultiplier: 0.8,
    spikeDays: new Set(["2026-03-10", "2026-04-14", "2026-05-07"]),
    spikeMultiplier: 1.1,
    seasonalityAmplitude: 0.05,
    seasonalityPhase: 1.2,
    billedCostMultiplier: 1.02,
    listCostMultiplier: 1.06,
    taxRate: 0.008,
    creditRate: 0,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.43, storage: 0.28, io: 0.12, backup: 0.14, data_transfer: 0.03 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}analytics-dynamodb-events`,
    resourceName: "analytics-dynamodb-events",
    resourceType: "table",
    dbService: "DynamoDB",
    dbEngine: "DynamoDB",
    dbEngineVersion: "global-table-v2019",
    environment: "prod",
    workloadPattern: "transactional",
    regionCode: "us-east-1",
    instanceClass: "dynamodb.on-demand",
    status: "scaling",
    capacityMode: "OnDemand",
    allocatedStorageGb: 580,
    storageUsedRatio: 0.64,
    dataFootprintBaseGb: 372,
    dataFootprintTrendPerDay: 1.7,
    loadBase: 4.4,
    loadTrendPerDay: 0.01,
    connectionsBase: 430,
    connectionsTrendPerDay: 1.3,
    readThroughputBaseBytes: 68_000_000,
    writeThroughputBaseBytes: 47_000_000,
    throughputTrendPerDay: 610_000,
    baseDailyCost: 108,
    costTrendPerDay: 0.44,
    weekendMultiplier: 0.95,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.27,
    seasonalityAmplitude: 0.09,
    seasonalityPhase: 0.4,
    billedCostMultiplier: 1.04,
    listCostMultiplier: 1.09,
    taxRate: 0.011,
    creditRate: 0.015,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.46, storage: 0.23, io: 0.16, backup: 0.08, data_transfer: 0.07 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}stg-dynamodb-session-state`,
    resourceName: "stg-dynamodb-session-state",
    resourceType: "table",
    dbService: "DynamoDB",
    dbEngine: "DynamoDB",
    dbEngineVersion: "global-table-v2019",
    environment: "staging",
    workloadPattern: "transactional",
    regionCode: "eu-west-1",
    instanceClass: "dynamodb.provisioned",
    status: "available",
    capacityMode: "Provisioned",
    allocatedStorageGb: 220,
    storageUsedRatio: 0.6,
    dataFootprintBaseGb: 132,
    dataFootprintTrendPerDay: 0.5,
    loadBase: 1.8,
    loadTrendPerDay: 0.004,
    connectionsBase: 120,
    connectionsTrendPerDay: 0.38,
    readThroughputBaseBytes: 18_000_000,
    writeThroughputBaseBytes: 11_000_000,
    throughputTrendPerDay: 120_000,
    baseDailyCost: 38,
    costTrendPerDay: 0.12,
    weekendMultiplier: 0.9,
    spikeDays: new Set(["2026-03-19", "2026-04-23"]),
    spikeMultiplier: 1.16,
    seasonalityAmplitude: 0.04,
    seasonalityPhase: 2.3,
    billedCostMultiplier: 1.03,
    listCostMultiplier: 1.07,
    taxRate: 0.008,
    creditRate: 0,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.42, storage: 0.24, io: 0.17, backup: 0.1, data_transfer: 0.07 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}prod-redis-session-primary`,
    resourceName: "prod-redis-session-primary",
    resourceType: "cache",
    dbService: "ElastiCache",
    dbEngine: "Redis OSS",
    dbEngineVersion: "7.1",
    environment: "prod",
    workloadPattern: "cache",
    regionCode: "ap-south-1",
    instanceClass: "cache.r6g.large",
    status: "available",
    clusterId: "prod-redis-session",
    clusterRole: "primary",
    allocatedStorageGb: 180,
    storageUsedRatio: 0.51,
    dataFootprintBaseGb: 92,
    dataFootprintTrendPerDay: 0.34,
    loadBase: 3.6,
    loadTrendPerDay: 0.008,
    connectionsBase: 1280,
    connectionsTrendPerDay: 4.1,
    readThroughputBaseBytes: 94_000_000,
    writeThroughputBaseBytes: 46_000_000,
    throughputTrendPerDay: 530_000,
    baseDailyCost: 92,
    costTrendPerDay: 0.31,
    weekendMultiplier: 0.97,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.21,
    seasonalityAmplitude: 0.06,
    seasonalityPhase: 0.7,
    billedCostMultiplier: 1.025,
    listCostMultiplier: 1.07,
    taxRate: 0.01,
    creditRate: 0.008,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.61, storage: 0.14, io: 0.07, backup: 0.04, data_transfer: 0.14 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}prod-redis-session-replica`,
    resourceName: "prod-redis-session-replica",
    resourceType: "cache",
    dbService: "ElastiCache",
    dbEngine: "Redis OSS",
    dbEngineVersion: "7.1",
    environment: "prod",
    workloadPattern: "cache",
    regionCode: "ap-south-1",
    instanceClass: "cache.r6g.large",
    status: "available",
    clusterId: "prod-redis-session",
    clusterRole: "replica",
    allocatedStorageGb: 180,
    storageUsedRatio: 0.5,
    dataFootprintBaseGb: 90,
    dataFootprintTrendPerDay: 0.32,
    loadBase: 2.8,
    loadTrendPerDay: 0.007,
    connectionsBase: 860,
    connectionsTrendPerDay: 3.1,
    readThroughputBaseBytes: 76_000_000,
    writeThroughputBaseBytes: 29_000_000,
    throughputTrendPerDay: 410_000,
    baseDailyCost: 67,
    costTrendPerDay: 0.22,
    weekendMultiplier: 0.98,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.18,
    seasonalityAmplitude: 0.05,
    seasonalityPhase: 1.8,
    billedCostMultiplier: 1.025,
    listCostMultiplier: 1.07,
    taxRate: 0.01,
    creditRate: 0.006,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.56, storage: 0.16, io: 0.08, backup: 0.05, data_transfer: 0.15 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}prod-memorydb-auth-primary`,
    resourceName: "prod-memorydb-auth-primary",
    resourceType: "node",
    dbService: "MemoryDB",
    dbEngine: "Valkey",
    dbEngineVersion: "7.2",
    environment: "prod",
    workloadPattern: "cache",
    regionCode: "us-east-1",
    instanceClass: "db.r6g.large",
    status: "available",
    clusterId: "prod-memorydb-auth",
    clusterRole: "primary",
    allocatedStorageGb: 210,
    storageUsedRatio: 0.47,
    dataFootprintBaseGb: 99,
    dataFootprintTrendPerDay: 0.42,
    loadBase: 3.1,
    loadTrendPerDay: 0.008,
    connectionsBase: 940,
    connectionsTrendPerDay: 2.9,
    readThroughputBaseBytes: 72_000_000,
    writeThroughputBaseBytes: 33_000_000,
    throughputTrendPerDay: 460_000,
    baseDailyCost: 88,
    costTrendPerDay: 0.28,
    weekendMultiplier: 0.98,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.19,
    seasonalityAmplitude: 0.055,
    seasonalityPhase: 1.1,
    billedCostMultiplier: 1.025,
    listCostMultiplier: 1.08,
    taxRate: 0.01,
    creditRate: 0.01,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.59, storage: 0.15, io: 0.08, backup: 0.04, data_transfer: 0.14 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}prod-memorydb-auth-replica`,
    resourceName: "prod-memorydb-auth-replica",
    resourceType: "node",
    dbService: "MemoryDB",
    dbEngine: "Valkey",
    dbEngineVersion: "7.2",
    environment: "prod",
    workloadPattern: "cache",
    regionCode: "us-east-1",
    instanceClass: "db.r6g.large",
    status: "available",
    clusterId: "prod-memorydb-auth",
    clusterRole: "replica",
    allocatedStorageGb: 210,
    storageUsedRatio: 0.46,
    dataFootprintBaseGb: 96,
    dataFootprintTrendPerDay: 0.4,
    loadBase: 2.4,
    loadTrendPerDay: 0.006,
    connectionsBase: 710,
    connectionsTrendPerDay: 2.1,
    readThroughputBaseBytes: 60_000_000,
    writeThroughputBaseBytes: 22_000_000,
    throughputTrendPerDay: 320_000,
    baseDailyCost: 63,
    costTrendPerDay: 0.2,
    weekendMultiplier: 0.99,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.16,
    seasonalityAmplitude: 0.05,
    seasonalityPhase: 2.4,
    billedCostMultiplier: 1.025,
    listCostMultiplier: 1.08,
    taxRate: 0.01,
    creditRate: 0.008,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.55, storage: 0.17, io: 0.09, backup: 0.04, data_transfer: 0.15 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}prod-documentdb-profile-primary`,
    resourceName: "prod-documentdb-profile-primary",
    resourceType: "cluster",
    dbService: "DocumentDB",
    dbEngine: "MongoDB-compatible",
    dbEngineVersion: "5.0",
    environment: "prod",
    workloadPattern: "document",
    regionCode: "us-west-2",
    instanceClass: "db.r6g.xlarge",
    status: "available",
    clusterId: "prod-documentdb-profile",
    clusterRole: "primary",
    isClusterResource: true,
    allocatedStorageGb: 860,
    storageUsedRatio: 0.71,
    dataFootprintBaseGb: 611,
    dataFootprintTrendPerDay: 1.8,
    loadBase: 4.3,
    loadTrendPerDay: 0.009,
    connectionsBase: 280,
    connectionsTrendPerDay: 1.1,
    readThroughputBaseBytes: 52_000_000,
    writeThroughputBaseBytes: 35_000_000,
    throughputTrendPerDay: 250_000,
    baseDailyCost: 142,
    costTrendPerDay: 0.49,
    weekendMultiplier: 0.9,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.15,
    seasonalityAmplitude: 0.07,
    seasonalityPhase: 1.3,
    billedCostMultiplier: 1.03,
    listCostMultiplier: 1.09,
    taxRate: 0.012,
    creditRate: 0.01,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.47, storage: 0.26, io: 0.11, backup: 0.11, data_transfer: 0.05 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}prod-documentdb-profile-replica`,
    resourceName: "prod-documentdb-profile-replica",
    resourceType: "node",
    dbService: "DocumentDB",
    dbEngine: "MongoDB-compatible",
    dbEngineVersion: "5.0",
    environment: "prod",
    workloadPattern: "document",
    regionCode: "us-west-2",
    instanceClass: "db.r6g.large",
    status: "available",
    clusterId: "prod-documentdb-profile",
    clusterRole: "replica",
    allocatedStorageGb: 740,
    storageUsedRatio: 0.69,
    dataFootprintBaseGb: 510,
    dataFootprintTrendPerDay: 1.4,
    loadBase: 3.1,
    loadTrendPerDay: 0.007,
    connectionsBase: 210,
    connectionsTrendPerDay: 0.82,
    readThroughputBaseBytes: 39_000_000,
    writeThroughputBaseBytes: 22_000_000,
    throughputTrendPerDay: 180_000,
    baseDailyCost: 96,
    costTrendPerDay: 0.33,
    weekendMultiplier: 0.91,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.12,
    seasonalityAmplitude: 0.06,
    seasonalityPhase: 2.2,
    billedCostMultiplier: 1.03,
    listCostMultiplier: 1.09,
    taxRate: 0.012,
    creditRate: 0.008,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.44, storage: 0.29, io: 0.11, backup: 0.11, data_transfer: 0.05 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}prod-neptune-relationship-core`,
    resourceName: "prod-neptune-relationship-core",
    resourceType: "graph",
    dbService: "Neptune",
    dbEngine: "Neptune Graph",
    dbEngineVersion: "1.3.2.0",
    environment: "prod",
    workloadPattern: "graph",
    regionCode: "us-east-1",
    instanceClass: "db.r6g.large",
    status: "available",
    clusterId: "prod-neptune-core",
    clusterRole: "member",
    allocatedStorageGb: 460,
    storageUsedRatio: 0.63,
    dataFootprintBaseGb: 290,
    dataFootprintTrendPerDay: 1.05,
    loadBase: 2.9,
    loadTrendPerDay: 0.007,
    connectionsBase: 148,
    connectionsTrendPerDay: 0.52,
    readThroughputBaseBytes: 28_000_000,
    writeThroughputBaseBytes: 17_000_000,
    throughputTrendPerDay: 110_000,
    baseDailyCost: 118,
    costTrendPerDay: 0.38,
    weekendMultiplier: 0.94,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.14,
    seasonalityAmplitude: 0.05,
    seasonalityPhase: 1.5,
    billedCostMultiplier: 1.025,
    listCostMultiplier: 1.08,
    taxRate: 0.011,
    creditRate: 0.01,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.52, storage: 0.22, io: 0.1, backup: 0.1, data_transfer: 0.06 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}telemetry-keyspaces-core`,
    resourceName: "telemetry-keyspaces-core",
    resourceType: "table",
    dbService: "Keyspaces",
    dbEngine: "Apache Cassandra-compatible",
    dbEngineVersion: "1.0",
    environment: "prod",
    workloadPattern: "wide_column",
    regionCode: "eu-west-1",
    instanceClass: "keyspaces.provisioned",
    status: "available",
    capacityMode: "Provisioned",
    allocatedStorageGb: 680,
    storageUsedRatio: 0.66,
    dataFootprintBaseGb: 449,
    dataFootprintTrendPerDay: 1.55,
    loadBase: 3,
    loadTrendPerDay: 0.008,
    connectionsBase: 166,
    connectionsTrendPerDay: 0.6,
    readThroughputBaseBytes: 34_000_000,
    writeThroughputBaseBytes: 26_000_000,
    throughputTrendPerDay: 210_000,
    baseDailyCost: 74,
    costTrendPerDay: 0.27,
    weekendMultiplier: 0.9,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.18,
    seasonalityAmplitude: 0.06,
    seasonalityPhase: 0.8,
    billedCostMultiplier: 1.03,
    listCostMultiplier: 1.08,
    taxRate: 0.01,
    creditRate: 0.006,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.41, storage: 0.29, io: 0.17, backup: 0.06, data_transfer: 0.07 },
  },
  {
    resourceId: `${DEMO_RESOURCE_PREFIX}billing-timeseries-core`,
    resourceName: "billing-timeseries-core",
    resourceType: "stream",
    dbService: "Timestream",
    dbEngine: "Timestream LiveAnalytics",
    dbEngineVersion: "2026.04",
    environment: "prod",
    workloadPattern: "timeseries",
    regionCode: "us-east-1",
    instanceClass: "timestream.memory-magnetic",
    status: "available",
    capacityMode: "MemoryAndMagnetic",
    allocatedStorageGb: 920,
    storageUsedRatio: 0.73,
    dataFootprintBaseGb: 672,
    dataFootprintTrendPerDay: 2.35,
    loadBase: 2.2,
    loadTrendPerDay: 0.006,
    connectionsBase: 104,
    connectionsTrendPerDay: 0.34,
    readThroughputBaseBytes: 30_000_000,
    writeThroughputBaseBytes: 28_000_000,
    throughputTrendPerDay: 230_000,
    baseDailyCost: 46,
    costTrendPerDay: 0.19,
    weekendMultiplier: 0.93,
    spikeDays: GLOBAL_SPIKE_DAYS,
    spikeMultiplier: 1.22,
    seasonalityAmplitude: 0.07,
    seasonalityPhase: 2.7,
    billedCostMultiplier: 1.02,
    listCostMultiplier: 1.06,
    taxRate: 0.009,
    creditRate: 0.005,
    refundRate: 0,
    refundDays: new Set<string>(),
    categoryMix: { compute: 0.28, storage: 0.43, io: 0.15, backup: 0.08, data_transfer: 0.06 },
  },
];

const toFixed = (value: number, digits = 6): string => value.toFixed(digits);

const round = (value: number, digits = 6): number => Number(value.toFixed(digits));

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

const toMonthStart = (dateOnly: string): string => {
  const date = parseDateOnlyUtc(dateOnly);
  date.setUTCDate(1);
  return toDateOnlyUtc(date);
};

const isMonthEnd = (dateOnly: string): boolean => {
  const date = parseDateOnlyUtc(dateOnly);
  const nextDay = new Date(date.getTime());
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return nextDay.getUTCMonth() !== date.getUTCMonth();
};

const isMonthStartWindow = (dateOnly: string): boolean => {
  const date = parseDateOnlyUtc(dateOnly);
  return date.getUTCDate() <= 3;
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

const ensureCategoryMix = (mix: CategoryMix): void => {
  const total = mix.compute + mix.storage + mix.io + mix.backup + mix.data_transfer;
  if (Math.abs(total - 1) > 0.0001) {
    throw new Error(`Category mix must total 1.0, received ${total.toFixed(6)}`);
  }
};

const regionCostMultiplier = (regionCode: RegionCode): number => {
  if (regionCode === "us-west-2") return 1.06;
  if (regionCode === "eu-west-1") return 1.11;
  if (regionCode === "ap-south-1") return 1.04;
  return 1;
};

const patternPulse = (pattern: WorkloadPattern, dateOnly: string): number => {
  const date = parseDateOnlyUtc(dateOnly);
  const day = date.getUTCDay();
  const dayOfMonth = date.getUTCDate();

  switch (pattern) {
    case "transactional":
      if (day === 1 || day === 2) return 1.07;
      if (day === 5 || day === 6) return 1.03;
      return dayOfMonth >= 24 ? 1.05 : 1;
    case "analytics":
      if (isMonthEnd(dateOnly)) return 1.2;
      if (day === 1 || day === 2) return 1.12;
      return day === 0 || day === 6 ? 0.94 : 1.05;
    case "cache":
      if (day === 5 || day === 6) return 1.08;
      return day === 0 ? 0.98 : 1.02;
    case "document":
      return dayOfMonth >= 25 ? 1.08 : 1;
    case "graph":
      return day === 2 ? 1.05 : 1;
    case "wide_column":
      return day === 1 || day === 2 ? 1.09 : 1;
    case "timeseries":
      if (isMonthEnd(dateOnly)) return 1.16;
      return isMonthStartWindow(dateOnly) ? 1.08 : 1.01;
    default:
      return 1;
  }
};

const seasonalMultiplier = (index: number, amplitude: number, phase: number): number =>
  1 + Math.sin(index / 5.2 + phase) * amplitude;

const effectiveDailyCost = (template: ResourceTemplate, usageDate: string, index: number): number => {
  const weekendMultiplier = parseDateOnlyUtc(usageDate).getUTCDay() === 0 || parseDateOnlyUtc(usageDate).getUTCDay() === 6
    ? template.weekendMultiplier
    : 1;
  const spikeMultiplier = template.spikeDays.has(usageDate) ? template.spikeMultiplier : 1;
  const baseCost = template.baseDailyCost + template.costTrendPerDay * index;
  const monthEdgeMultiplier =
    isMonthEnd(usageDate) && (template.workloadPattern === "analytics" || template.workloadPattern === "timeseries")
      ? 1.12
      : 1;

  return round(
    baseCost *
      weekendMultiplier *
      spikeMultiplier *
      regionCostMultiplier(template.regionCode) *
      seasonalMultiplier(index, template.seasonalityAmplitude, template.seasonalityPhase) *
      patternPulse(template.workloadPattern, usageDate) *
      monthEdgeMultiplier,
  );
};

const operationalPressure = (template: ResourceTemplate, usageDate: string, index: number): number => {
  const spike = template.spikeDays.has(usageDate) ? 1.14 : 1;
  const weekend =
    parseDateOnlyUtc(usageDate).getUTCDay() === 0 || parseDateOnlyUtc(usageDate).getUTCDay() === 6
      ? Math.max(template.weekendMultiplier + 0.04, 0.84)
      : 1.03;
  const monthPulse =
    template.workloadPattern === "analytics" || template.workloadPattern === "timeseries"
      ? isMonthEnd(usageDate)
        ? 1.11
        : 1
      : isMonthStartWindow(usageDate)
        ? 1.03
        : 1;

  return round(
    seasonalMultiplier(index, Math.min(template.seasonalityAmplitude + 0.02, 0.12), template.seasonalityPhase + 0.6) *
      spike *
      weekend *
      monthPulse,
    4,
  );
};

const positiveCategoryAmounts = (template: ResourceTemplate, effectiveCost: number) => ({
  compute: round(effectiveCost * template.categoryMix.compute),
  storage: round(effectiveCost * template.categoryMix.storage),
  io: round(effectiveCost * template.categoryMix.io),
  backup: round(effectiveCost * template.categoryMix.backup),
  data_transfer: round(effectiveCost * template.categoryMix.data_transfer),
});

const taxAmount = (template: ResourceTemplate, effectiveCost: number, usageDate: string): number =>
  template.taxRate > 0 && isMonthEnd(usageDate) ? round(effectiveCost * template.taxRate) : 0;

const creditAmount = (template: ResourceTemplate, effectiveCost: number, usageDate: string): number =>
  template.creditRate > 0 && isMonthStartWindow(usageDate) ? round(-effectiveCost * template.creditRate) : 0;

const refundAmount = (template: ResourceTemplate, effectiveCost: number, usageDate: string): number =>
  template.refundRate > 0 && template.refundDays.has(usageDate) ? round(-effectiveCost * template.refundRate) : 0;

const usageQuantityForCategory = (
  template: ResourceTemplate,
  category: CostCategory,
  footprintGb: number,
  readThroughputBytes: number,
  writeThroughputBytes: number,
): string | null => {
  if (category === "compute") return toFixed(24, 3);
  if (category === "storage") return toFixed(footprintGb, 3);
  if (category === "io") return toFixed((readThroughputBytes + writeThroughputBytes) / 1_000_000_000, 6);
  if (category === "backup") return toFixed(Math.max(template.allocatedStorageGb * 0.55, footprintGb * 0.4), 3);
  if (category === "data_transfer") return toFixed((readThroughputBytes * 0.35 + writeThroughputBytes * 0.2) / 1_000_000_000, 6);
  return null;
};

const maybeCpuMetrics = (template: ResourceTemplate, loadAvg: number): { cpuAvg: string | null; cpuMax: string | null } => {
  if (template.resourceType === "table" || template.resourceType === "stream") {
    return { cpuAvg: null, cpuMax: null };
  }

  const cpuAvg = round(Math.min(loadAvg * 7.8, 82), 4);
  const cpuMax = round(Math.min(cpuAvg * 1.34, 96), 4);
  return { cpuAvg: toFixed(cpuAvg, 4), cpuMax: toFixed(cpuMax, 4) };
};

const maybeRequestCount = (template: ResourceTemplate, connectionsAvg: number, loadAvg: number): string | null => {
  if (template.resourceType !== "table" && template.resourceType !== "stream") {
    return null;
  }
  return toFixed(connectionsAvg * 110 + loadAvg * 4_000, 2);
};

const maybeIops = (
  template: ResourceTemplate,
  readThroughputBytes: number,
  writeThroughputBytes: number,
): { readIops: string | null; writeIops: string | null } => {
  if (template.resourceType === "cache" || template.resourceType === "table" || template.resourceType === "stream") {
    return { readIops: null, writeIops: null };
  }
  return {
    readIops: toFixed(readThroughputBytes / 64_000, 2),
    writeIops: toFixed(writeThroughputBytes / 64_000, 2),
  };
};

const buildResourceArn = (template: ResourceTemplate, accountId: string): string | null => {
  const name = template.resourceName;
  switch (template.dbService) {
    case "AmazonRDS":
      return `arn:aws:rds:${template.regionCode}:${accountId}:db:${name}`;
    case "Aurora":
      return `arn:aws:rds:${template.regionCode}:${accountId}:${template.clusterRole === "writer" || template.clusterRole === "reader" ? "db" : "cluster"}:${name}`;
    case "DynamoDB":
      return `arn:aws:dynamodb:${template.regionCode}:${accountId}:table/${name}`;
    case "ElastiCache":
      return `arn:aws:elasticache:${template.regionCode}:${accountId}:cluster:${name}`;
    case "MemoryDB":
      return `arn:aws:memorydb:${template.regionCode}:${accountId}:cluster:${name}`;
    case "DocumentDB":
      return `arn:aws:rds:${template.regionCode}:${accountId}:cluster:${name}`;
    case "Neptune":
      return `arn:aws:rds:${template.regionCode}:${accountId}:cluster:${name}`;
    case "Keyspaces":
      return `arn:aws:cassandra:${template.regionCode}:${accountId}:keyspace/default/table/${name}`;
    case "Timestream":
      return `arn:aws:timestream:${template.regionCode}:${accountId}:database/kcx-demo/table/${name}`;
    default:
      return null;
  }
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

async function ensureRegionKeys(providerId: string): Promise<RegionKeys> {
  const output = {} as RegionKeys;

  for (const [regionCode, metadata] of Object.entries(REGION_METADATA) as Array<[RegionCode, (typeof REGION_METADATA)[RegionCode]]>) {
    const [row] = await DimRegion.findOrCreate({
      where: {
        providerId,
        regionId: metadata.regionId,
        regionName: metadata.regionName,
        availabilityZone: null,
      },
      defaults: {
        providerId,
        regionId: metadata.regionId,
        regionName: metadata.regionName,
        availabilityZone: null,
      },
    });

    output[regionCode] = String(row.id);
  }

  return output;
}

const resolveRegionKey = (regionCode: RegionCode, regionKeys: RegionKeys): string => regionKeys[regionCode];

const buildDataset = (
  connection: {
    tenantId: string;
    cloudConnectionId: string;
    providerId: string;
    accountId: string;
  },
  regionKeys: RegionKeys,
): SeedDataset => {
  const dates = buildDateRange(SEED_START, SEED_END);
  const factRows: FactSeedRow[] = [];
  const costRows: CostHistorySeedRow[] = [];
  const inventoryRows: InventorySeedRow[] = [];
  const inventoryDiscoveredAt = new Date(`${SEED_END}T12:00:00.000Z`);

  for (const template of RESOURCE_TEMPLATES) {
    ensureCategoryMix(template.categoryMix);
    const regionKey = resolveRegionKey(template.regionCode, regionKeys);
    const resourceArn = buildResourceArn(template, connection.accountId);
    const latestFootprint = round(
      template.dataFootprintBaseGb + template.dataFootprintTrendPerDay * (dates.length - 1),
      6,
    );

    inventoryRows.push({
      tenantId: connection.tenantId,
      cloudConnectionId: connection.cloudConnectionId,
      providerId: connection.providerId,
      resourceId: template.resourceId,
      resourceArn,
      resourceName: template.resourceName,
      dbService: template.dbService,
      dbEngine: template.dbEngine,
      dbEngineVersion: template.dbEngineVersion,
      resourceType: template.resourceType,
      regionKey,
      status: template.status,
      allocatedStorageGb: toFixed(template.allocatedStorageGb),
      dataFootprintGb: toFixed(latestFootprint),
      instanceClass: template.instanceClass,
      capacityMode: template.capacityMode ?? null,
      clusterId: template.clusterId ?? null,
      isClusterResource: Boolean(template.isClusterResource),
      tagsJson: {
        environment: template.environment,
        platform: "KCX Demo",
        service: template.dbService,
        workload: template.workloadPattern,
        tier: template.environment === "prod" ? "critical" : "non-prod",
      },
      metadataJson: {
        clusterRole: template.clusterRole ?? null,
        regionCode: template.regionCode,
        engineVersion: template.dbEngineVersion,
      },
      discoveredAt: inventoryDiscoveredAt,
      isCurrent: true,
      deletedAt: null,
    });

    for (let index = 0; index < dates.length; index += 1) {
      const usageDate = dates[index];
      const dailyEffectivePositiveCost = effectiveDailyCost(template, usageDate, index);
      const pressure = operationalPressure(template, usageDate, index);
      const dataFootprintGb = round(template.dataFootprintBaseGb + template.dataFootprintTrendPerDay * index);
      const storageUsedGb = round(dataFootprintGb * template.storageUsedRatio);
      const loadAvg = round((template.loadBase + template.loadTrendPerDay * index) * pressure, 4);
      const connectionsAvg = round((template.connectionsBase + template.connectionsTrendPerDay * index) * pressure, 4);
      const connectionsMax = round(connectionsAvg * 1.27, 4);
      const readThroughputBytes = round(
        (template.readThroughputBaseBytes + template.throughputTrendPerDay * index) * pressure,
        4,
      );
      const writeThroughputBytes = round(
        (template.writeThroughputBaseBytes + template.throughputTrendPerDay * 0.72 * index) * pressure,
        4,
      );
      const categories = positiveCategoryAmounts(template, dailyEffectivePositiveCost);
      const tax = taxAmount(template, dailyEffectivePositiveCost, usageDate);
      const credit = creditAmount(template, dailyEffectivePositiveCost, usageDate);
      const refund = refundAmount(template, dailyEffectivePositiveCost, usageDate);
      const categoryRows: Array<{ costCategory: CostCategory; effectiveCost: number; billedCost: number; listCost: number; usageQuantity: string | null }> = [];

      for (const [costCategory, effectiveCost] of Object.entries(categories) as Array<[keyof CategoryMix, number]>) {
        const billedCost = round(effectiveCost * template.billedCostMultiplier);
        const listCost = round(effectiveCost * template.listCostMultiplier);
        categoryRows.push({
          costCategory,
          effectiveCost,
          billedCost,
          listCost,
          usageQuantity: usageQuantityForCategory(template, costCategory, dataFootprintGb, readThroughputBytes, writeThroughputBytes),
        });
      }

      if (tax !== 0) {
        categoryRows.push({
          costCategory: "tax",
          effectiveCost: tax,
          billedCost: tax,
          listCost: tax,
          usageQuantity: null,
        });
      }

      if (credit !== 0) {
        categoryRows.push({
          costCategory: "credit",
          effectiveCost: credit,
          billedCost: credit,
          listCost: credit,
          usageQuantity: null,
        });
      }

      if (refund !== 0) {
        categoryRows.push({
          costCategory: "refund",
          effectiveCost: refund,
          billedCost: refund,
          listCost: refund,
          usageQuantity: null,
        });
      }

      for (const costRow of categoryRows) {
        costRows.push({
          usageDate,
          monthStart: toMonthStart(usageDate),
          tenantId: connection.tenantId,
          cloudConnectionId: connection.cloudConnectionId,
          providerId: connection.providerId,
          regionKey,
          resourceId: template.resourceId,
          dbService: template.dbService,
          dbEngine: template.dbEngine,
          costCategory: costRow.costCategory,
          billedCost: toFixed(costRow.billedCost),
          effectiveCost: toFixed(costRow.effectiveCost),
          listCost: toFixed(costRow.listCost),
          usageQuantity: costRow.usageQuantity,
          currencyCode: "USD",
        });
      }

      const totalBilledCost = round(categoryRows.reduce((sum, row) => sum + row.billedCost, 0));
      const totalEffectiveCost = round(categoryRows.reduce((sum, row) => sum + row.effectiveCost, 0));
      const totalListCost = round(categoryRows.reduce((sum, row) => sum + row.listCost, 0));
      const cpuMetrics = maybeCpuMetrics(template, loadAvg);
      const iops = maybeIops(template, readThroughputBytes, writeThroughputBytes);

      factRows.push({
        tenantId: connection.tenantId,
        cloudConnectionId: connection.cloudConnectionId,
        providerId: connection.providerId,
        usageDate,
        resourceId: template.resourceId,
        resourceArn,
        resourceName: template.resourceName,
        dbService: template.dbService,
        dbEngine: template.dbEngine,
        dbEngineVersion: template.dbEngineVersion,
        resourceType: template.resourceType,
        regionKey,
        status: template.status,
        clusterId: template.clusterId ?? null,
        isClusterResource: Boolean(template.isClusterResource),
        allocatedStorageGb: toFixed(template.allocatedStorageGb),
        dataFootprintGb: toFixed(dataFootprintGb),
        storageUsedGb: toFixed(storageUsedGb),
        computeCost: toFixed(categories.compute),
        storageCost: toFixed(categories.storage),
        ioCost: toFixed(categories.io),
        backupCost: toFixed(categories.backup),
        dataTransferCost: toFixed(categories.data_transfer),
        taxCost: toFixed(tax),
        creditAmount: toFixed(credit),
        refundAmount: toFixed(refund),
        totalBilledCost: toFixed(totalBilledCost),
        totalEffectiveCost: toFixed(totalEffectiveCost),
        totalListCost: toFixed(totalListCost),
        loadAvg: toFixed(loadAvg, 4),
        connectionsAvg: toFixed(connectionsAvg, 4),
        connectionsMax: toFixed(connectionsMax, 4),
        cpuAvg: cpuMetrics.cpuAvg,
        cpuMax: cpuMetrics.cpuMax,
        requestCount: maybeRequestCount(template, connectionsAvg, loadAvg),
        readIops: iops.readIops,
        writeIops: iops.writeIops,
        readThroughputBytes: toFixed(readThroughputBytes, 4),
        writeThroughputBytes: toFixed(writeThroughputBytes, 4),
        currencyCode: "USD",
      });
    }
  }

  return { factRows, costRows, inventoryRows };
};

async function cleanupRows(connection: { tenantId: string; cloudConnectionId: string }): Promise<{ fact: number; cost: number; inventory: number }> {
  const [fact, cost, inventory] = await Promise.all([
    FactDbResourceDaily.destroy({
      where: {
        tenantId: connection.tenantId,
        cloudConnectionId: connection.cloudConnectionId,
        resourceId: {
          [Op.like]: `${DEMO_RESOURCE_PREFIX}%`,
        },
        usageDate: {
          [Op.between]: [SEED_START, SEED_END],
        },
      },
    }),
    DbCostHistoryDaily.destroy({
      where: {
        tenantId: connection.tenantId,
        cloudConnectionId: connection.cloudConnectionId,
        resourceId: {
          [Op.like]: `${DEMO_RESOURCE_PREFIX}%`,
        },
        usageDate: {
          [Op.between]: [SEED_START, SEED_END],
        },
      },
    }),
    DbResourceInventorySnapshot.destroy({
      where: {
        tenantId: connection.tenantId,
        cloudConnectionId: connection.cloudConnectionId,
        resourceId: {
          [Op.like]: `${DEMO_RESOURCE_PREFIX}%`,
        },
      },
    }),
  ]);

  return { fact, cost, inventory };
}

async function upsertRows(): Promise<void> {
  const connection = await resolveConnection();
  const tenantId = String(connection.tenantId);
  const cloudConnectionId = String(connection.id);
  const providerId = String(connection.providerId);
  const accountId = String(connection.cloudAccountId ?? connection.payerAccountId ?? "118800441122");
  const regionKeys = await ensureRegionKeys(providerId);
  const dataset = buildDataset({ tenantId, cloudConnectionId, providerId, accountId }, regionKeys);

  console.info("[db-explorer-seed] Resolved connection", {
    connectionName: CONNECTION_NAME,
    cloudConnectionId,
    tenantId,
    providerId,
    accountId,
    regionKeys,
  });

  await sequelize.transaction(async (transaction) => {
    await Promise.all([
      FactDbResourceDaily.destroy({
        where: {
          tenantId,
          cloudConnectionId,
          resourceId: { [Op.like]: `${DEMO_RESOURCE_PREFIX}%` },
          usageDate: { [Op.between]: [SEED_START, SEED_END] },
        },
        transaction,
      }),
      DbCostHistoryDaily.destroy({
        where: {
          tenantId,
          cloudConnectionId,
          resourceId: { [Op.like]: `${DEMO_RESOURCE_PREFIX}%` },
          usageDate: { [Op.between]: [SEED_START, SEED_END] },
        },
        transaction,
      }),
      DbResourceInventorySnapshot.destroy({
        where: {
          tenantId,
          cloudConnectionId,
          resourceId: { [Op.like]: `${DEMO_RESOURCE_PREFIX}%` },
        },
        transaction,
      }),
    ]);

    await FactDbResourceDaily.bulkCreate(
      dataset.factRows.map((row) => ({
        ...row,
        createdAt: new Date(`${row.usageDate}T12:00:00.000Z`),
        updatedAt: new Date(`${row.usageDate}T12:00:00.000Z`),
      })),
      { transaction },
    );

    await DbCostHistoryDaily.bulkCreate(
      dataset.costRows.map((row) => ({
        ...row,
        createdAt: new Date(`${row.usageDate}T12:00:00.000Z`),
        updatedAt: new Date(`${row.usageDate}T12:00:00.000Z`),
      })),
      { transaction },
    );

    await DbResourceInventorySnapshot.bulkCreate(
      dataset.inventoryRows.map((row) => ({
        ...row,
        createdAt: row.discoveredAt,
        updatedAt: row.discoveredAt,
      })),
      { transaction },
    );
  });

  const representedServices = [...new Set(RESOURCE_TEMPLATES.map((template) => template.dbService))];
  const representedEngines = [...new Set(RESOURCE_TEMPLATES.map((template) => template.dbEngine))];
  const representedRegions = [...new Set(RESOURCE_TEMPLATES.map((template) => template.regionCode))];

  console.info("[db-explorer-seed] Upsert complete", {
    factRows: dataset.factRows.length,
    costRows: dataset.costRows.length,
    inventoryRows: dataset.inventoryRows.length,
    resources: RESOURCE_TEMPLATES.length,
    representedServices,
    representedEngines,
    representedRegions,
    seededWindow: {
      start: SEED_START,
      end: SEED_END,
      dayCount: buildDateRange(SEED_START, SEED_END).length,
    },
  });
}

async function cleanupOnly(): Promise<void> {
  const connection = await resolveConnection();
  const tenantId = String(connection.tenantId);
  const cloudConnectionId = String(connection.id);
  const deleted = await cleanupRows({ tenantId, cloudConnectionId });

  console.info("[db-explorer-seed] Cleanup complete", {
    tenantId,
    cloudConnectionId,
    deleted,
    seededWindow: {
      start: SEED_START,
      end: SEED_END,
    },
  });
}

async function main(): Promise<void> {
  const mode = parseMode();
  console.info("[db-explorer-seed] Starting", { mode, connectionName: CONNECTION_NAME });

  if (mode === "cleanup") {
    await cleanupOnly();
    return;
  }

  await upsertRows();
}

void main()
  .catch((error) => {
    console.error("[db-explorer-seed] Failed", util.inspect(error, { depth: 10, colors: false }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
