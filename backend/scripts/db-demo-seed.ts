// @ts-nocheck
import { Sequelize } from "sequelize";
import { activateDemoDbEnv, getSeedMarker } from "./demo-db-utils.js";

const DEMO_USER = {
  email: "demo@example.com",
  password: "Demo@123456",
  fullName: "Demo User",
};

const DEMO = {
  tenantSlug: "demo-organization",
  tenantName: "Demo Organization",
  cloudConnectionName: "Demo AWS Account",
  awsAccountId: "123456789012",
  payerAccountId: "123456789012",
  billingAccountId: "123456789012",
  subAccountId: "210987654321",
};

const REGIONS = ["us-east-1", "us-west-2", "ap-south-1"] as const;
const SEED_MARKER = getSeedMarker();

const DAYS = 30;

type InstanceScenario = {
  instanceId: string;
  name: string;
  state: "running" | "stopped";
  cpuAvg: number;
  cpuMax: number;
  dailyNetMb: number;
  computeDaily: number;
  ebsDaily: number;
  reservationType: "on_demand" | "reserved" | "savings_plan";
  recommendationType?: string;
  region: (typeof REGIONS)[number];
};

type InstanceContext = {
  accountId: string;
  accountName: string;
  team: string;
  product: string;
  environment: "dev" | "staging" | "prod";
};

const INSTANCES: InstanceScenario[] = [
  {
    instanceId: "i-demo-idle-001",
    name: "Idle Demo Instance",
    state: "running",
    cpuAvg: 2,
    cpuMax: 6,
    dailyNetMb: 40,
    computeDaily: 9.2,
    ebsDaily: 1.1,
    reservationType: "reserved",
    recommendationType: "idle_instance",
    region: "us-east-1",
  },
  {
    instanceId: "i-demo-under-001",
    name: "Underutilized Demo Instance",
    state: "running",
    cpuAvg: 12,
    cpuMax: 22,
    dailyNetMb: 300,
    computeDaily: 8.4,
    ebsDaily: 1.3,
    reservationType: "savings_plan",
    recommendationType: "underutilized_instance",
    region: "us-west-2",
  },
  {
    instanceId: "i-demo-over-001",
    name: "Overutilized Demo Instance",
    state: "running",
    cpuAvg: 85,
    cpuMax: 96,
    dailyNetMb: 520,
    computeDaily: 10.8,
    ebsDaily: 1.6,
    reservationType: "reserved",
    recommendationType: "overutilized_instance",
    region: "ap-south-1",
  },
  {
    instanceId: "i-demo-healthy-001",
    name: "Healthy Demo Instance",
    state: "running",
    cpuAvg: 45,
    cpuMax: 66,
    dailyNetMb: 260,
    computeDaily: 7.1,
    ebsDaily: 1.0,
    reservationType: "reserved",
    region: "us-east-1",
  },
  {
    instanceId: "i-demo-uncovered-001",
    name: "Uncovered OnDemand Instance",
    state: "running",
    cpuAvg: 38,
    cpuMax: 58,
    dailyNetMb: 210,
    computeDaily: 11.2,
    ebsDaily: 0.9,
    reservationType: "on_demand",
    recommendationType: "uncovered_on_demand",
    region: "us-west-2",
  },
  {
    instanceId: "i-demo-storage-heavy-001",
    name: "Storage Heavy Instance",
    state: "running",
    cpuAvg: 24,
    cpuMax: 42,
    dailyNetMb: 180,
    computeDaily: 3.8,
    ebsDaily: 9.2,
    reservationType: "on_demand",
    region: "ap-south-1",
  },
  {
    instanceId: "i-demo-stopped-001",
    name: "Stopped Instance With Volumes",
    state: "stopped",
    cpuAvg: 0.2,
    cpuMax: 1,
    dailyNetMb: 4,
    computeDaily: 0.2,
    ebsDaily: 6.4,
    reservationType: "on_demand",
    region: "us-east-1",
  },
];

const VOLUMES = [
  { volumeId: "vol-demo-unattached-001", region: "us-east-1", attachedInstanceId: null, sizeGb: 200, dailyCost: 6.3 },
  { volumeId: "vol-demo-idle-001", region: "us-east-1", attachedInstanceId: "i-demo-idle-001", sizeGb: 120, dailyCost: 1.1 },
  { volumeId: "vol-demo-under-001", region: "us-west-2", attachedInstanceId: "i-demo-under-001", sizeGb: 200, dailyCost: 1.3 },
  { volumeId: "vol-demo-over-001", region: "ap-south-1", attachedInstanceId: "i-demo-over-001", sizeGb: 150, dailyCost: 1.6 },
  { volumeId: "vol-demo-healthy-001", region: "us-east-1", attachedInstanceId: "i-demo-healthy-001", sizeGb: 100, dailyCost: 1.0 },
  { volumeId: "vol-demo-uncovered-001", region: "us-west-2", attachedInstanceId: "i-demo-uncovered-001", sizeGb: 120, dailyCost: 0.9 },
  { volumeId: "vol-demo-storage-heavy-001a", region: "ap-south-1", attachedInstanceId: "i-demo-storage-heavy-001", sizeGb: 500, dailyCost: 4.8 },
  { volumeId: "vol-demo-storage-heavy-001b", region: "ap-south-1", attachedInstanceId: "i-demo-storage-heavy-001", sizeGb: 600, dailyCost: 4.4 },
  { volumeId: "vol-demo-stopped-001", region: "us-east-1", attachedInstanceId: "i-demo-stopped-001", sizeGb: 300, dailyCost: 6.4 },
] as const;

const INSTANCE_CONTEXT: Record<string, InstanceContext> = {
  "i-demo-idle-001": {
    accountId: "210987654321",
    accountName: "Payments Prod",
    team: "payments",
    product: "checkout-api",
    environment: "prod",
  },
  "i-demo-under-001": {
    accountId: "210987654322",
    accountName: "Platform Staging",
    team: "platform",
    product: "core-services",
    environment: "staging",
  },
  "i-demo-over-001": {
    accountId: "210987654323",
    accountName: "Analytics Prod",
    team: "analytics",
    product: "reporting",
    environment: "prod",
  },
  "i-demo-healthy-001": {
    accountId: "210987654324",
    accountName: "Security Dev",
    team: "security",
    product: "audit",
    environment: "dev",
  },
  "i-demo-uncovered-001": {
    accountId: "210987654321",
    accountName: "Payments Prod",
    team: "payments",
    product: "checkout-api",
    environment: "prod",
  },
  "i-demo-storage-heavy-001": {
    accountId: "210987654322",
    accountName: "Platform Staging",
    team: "platform",
    product: "core-services",
    environment: "staging",
  },
  "i-demo-stopped-001": {
    accountId: "210987654324",
    accountName: "Security Dev",
    team: "security",
    product: "audit",
    environment: "dev",
  },
};

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function seededHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededUnit(input: string): number {
  return seededHash(input) / 0xffffffff;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothVariation(key: string, dayIndex: number, jitterScale = 0.04): number {
  const phase = seededUnit(`${key}:phase`) * Math.PI * 2;
  const periodDays = 10 + Math.floor(seededUnit(`${key}:period`) * 12); // 10..21
  const amplitude = 0.04 + seededUnit(`${key}:amp`) * 0.06; // 4%..10%
  const wave = Math.sin((2 * Math.PI * dayIndex) / periodDays + phase) * amplitude;
  const jitter = (seededUnit(`${key}:jitter:${dayIndex}`) - 0.5) * 2 * jitterScale;
  return wave + jitter;
}

function mbToBytes(mb: number): number {
  return Math.round(mb * 1024 * 1024);
}

function cpuBandForScenario(item: InstanceScenario): { min: number; max: number } {
  if (item.recommendationType === "idle_instance") return { min: 1, max: 4 };
  if (item.recommendationType === "underutilized_instance") return { min: 8, max: 18 };
  if (item.recommendationType === "overutilized_instance") return { min: 75, max: 95 };
  if (item.instanceId === "i-demo-healthy-001") return { min: 30, max: 60 };
  return { min: 0, max: 99 };
}

function otherRegion(region: (typeof REGIONS)[number]): (typeof REGIONS)[number] {
  if (region === "us-east-1") return "us-west-2";
  if (region === "us-west-2") return "ap-south-1";
  return "us-east-1";
}

export async function runDemoSeed(): Promise<void> {
  activateDemoDbEnv();

  const models = await import("../src/models/index.js");
  const { hashPassword } = await import("../src/utils/password.js");

  const {
    sequelize,
    Tenant,
    User,
    CloudProvider,
    CloudIntegration,
    CloudConnectionV2,
    BillingSource,
    ClientCloudAccount,
    DimBillingAccount,
    DimSubAccount,
    DimRegion,
    DimService,
    DimResource,
    DimTag,
    DimDate,
    FactCostLineItems,
    Ec2InstanceInventorySnapshot,
    Ec2InstanceUtilizationDaily,
    Ec2InstanceUtilizationHourly,
    FactEc2InstanceDaily,
    FactEc2InstanceCostDaily,
    FactEc2InstanceCoverageDaily,
    Ec2EipInventorySnapshot,
    Ec2VolumeInventorySnapshot,
    FactEbsVolumeDaily,
    EbsVolumeUtilizationDaily,
    EbsVolumeUtilizationHourly,
    Ec2SnapshotInventorySnapshot,
  } = models;

  const now = new Date();
  const end = startOfUtcDay(now);
  const start = addDays(end, -(DAYS - 1));
  const dates: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    dates.push(toDateOnly(d));
  }

  const provider = await CloudProvider.findOne({ where: { code: "aws" } })
    ?? await CloudProvider.create({ code: "aws", name: "Amazon Web Services", status: "active" });

  const tenant = await Tenant.findOne({ where: { slug: DEMO.tenantSlug } })
    ?? await Tenant.create({ name: DEMO.tenantName, slug: DEMO.tenantSlug, status: "active" });

  const passwordHash = await hashPassword(DEMO_USER.password);
  const user = await User.findOne({ where: { email: DEMO_USER.email } })
    ?? await User.create({
      tenantId: tenant.id,
      fullName: DEMO_USER.fullName,
      email: DEMO_USER.email,
      passwordHash,
      role: "owner",
      status: "active",
    });

  if (String(user.tenantId) !== String(tenant.id) || user.role !== "owner") {
    await user.update({ tenantId: tenant.id, role: "owner", status: "active", passwordHash });
  }

  const connection = await CloudConnectionV2.findOne({
    where: { tenantId: tenant.id, connectionName: DEMO.cloudConnectionName },
  }) ?? await CloudConnectionV2.create({
    tenantId: tenant.id,
    providerId: provider.id,
    connectionName: DEMO.cloudConnectionName,
    accountType: "payer",
    status: "active",
    region: "us-east-1",
    cloudAccountId: DEMO.awsAccountId,
    payerAccountId: DEMO.payerAccountId,
    createdBy: user.id,
    connectedAt: new Date(),
    lastValidatedAt: new Date(),
    externalId: `demo-${SEED_MARKER}`,
  });

  const integration = await CloudIntegration.findOne({
    where: {
      tenantId: tenant.id,
      detailRecordId: connection.id,
      detailRecordType: "cloud_connection",
    },
  });
  if (!integration) {
    await CloudIntegration.create({
      tenantId: tenant.id,
      createdBy: user.id,
      providerId: provider.id,
      connectionMode: "automatic",
      displayName: DEMO.cloudConnectionName,
      status: "active",
      detailRecordId: connection.id,
      detailRecordType: "cloud_connection",
      cloudAccountId: DEMO.awsAccountId,
      payerAccountId: DEMO.payerAccountId,
      lastValidatedAt: new Date(),
      lastSuccessAt: new Date(),
      lastCheckedAt: new Date(),
      statusMessage: "Demo integration seeded",
      connectedAt: new Date(),
    });
  } else {
    await integration.update({
      createdBy: user.id,
      providerId: provider.id,
      connectionMode: "automatic",
      displayName: DEMO.cloudConnectionName,
      status: "active",
      cloudAccountId: DEMO.awsAccountId,
      payerAccountId: DEMO.payerAccountId,
      lastValidatedAt: new Date(),
      lastSuccessAt: new Date(),
      lastCheckedAt: new Date(),
      statusMessage: "Demo integration seeded",
      errorMessage: null,
      connectedAt: new Date(),
    });
  }

  const billingSource = await BillingSource.findOne({
    where: { tenantId: tenant.id, sourceName: "Demo CUR2 Source" },
  }) ?? await BillingSource.create({
    tenantId: tenant.id,
    cloudConnectionId: connection.id,
    cloudProviderId: provider.id,
    sourceName: "Demo CUR2 Source",
    sourceType: "aws_data_exports_cur2",
    setupMode: "cloud_connected",
    format: "parquet",
    schemaType: "cur2",
    status: "active",
    isTemporary: false,
    bucketName: "demo-cur-bucket",
    pathPrefix: "cur2/demo",
    cadence: "daily",
    lastValidatedAt: new Date(),
    lastFileReceivedAt: new Date(),
    lastIngestedAt: new Date(),
  });

  const cloudAccounts = Array.from(
    new Map(
      Object.values(INSTANCE_CONTEXT).map((ctx) => [ctx.accountId, { accountId: ctx.accountId, accountName: ctx.accountName }]),
    ).values(),
  );
  for (const account of cloudAccounts) {
    await ClientCloudAccount.findOrCreate({
      where: { tenantId: tenant.id, providerId: provider.id, accountId: account.accountId },
      defaults: {
        tenantId: tenant.id,
        providerId: provider.id,
        cloudConnectionId: connection.id,
        accountId: account.accountId,
        accountName: account.accountName,
        onboardingStatus: "connected",
        computeOptimizerEnabled: true,
        lastRecommendationSyncAt: new Date(),
        lastSyncStatus: "success",
        lastSyncMessage: "Seeded demo account",
      },
    });
  }

  const [billingAccount] = await DimBillingAccount.findOrCreate({
    where: { tenantId: tenant.id, providerId: provider.id, billingAccountId: DEMO.billingAccountId },
    defaults: {
      tenantId: tenant.id,
      providerId: provider.id,
      billingAccountId: DEMO.billingAccountId,
      billingAccountName: "Demo Billing Account",
      billingCurrency: "USD",
    },
  });

  const uniqueSubAccounts = Array.from(
    new Map(
      Object.values(INSTANCE_CONTEXT).map((ctx) => [ctx.accountId, { accountId: ctx.accountId, accountName: ctx.accountName }]),
    ).values(),
  );
  const subAccountKeyById = new Map<string, number>();
  for (const sub of uniqueSubAccounts) {
    const [subAccount] = await DimSubAccount.findOrCreate({
      where: { tenantId: tenant.id, providerId: provider.id, subAccountId: sub.accountId },
      defaults: {
        tenantId: tenant.id,
        providerId: provider.id,
        subAccountId: sub.accountId,
        subAccountName: sub.accountName,
      },
    });
    subAccountKeyById.set(sub.accountId, Number(subAccount.id));
  }

  const [ec2Service] = await DimService.findOrCreate({
    where: {
      providerId: provider.id,
      serviceName: "Amazon Elastic Compute Cloud",
      serviceCategory: "Compute",
      serviceSubcategory: "EC2",
    },
    defaults: {
      providerId: provider.id,
      serviceName: "Amazon Elastic Compute Cloud",
      serviceCategory: "Compute",
      serviceSubcategory: "EC2",
    },
  });

  const regionMap = new Map<string, number>();
  for (const regionId of REGIONS) {
    const [region] = await DimRegion.findOrCreate({
      where: {
        providerId: provider.id,
        regionId,
        regionName: regionId,
        availabilityZone: null,
      },
      defaults: {
        providerId: provider.id,
        regionId,
        regionName: regionId,
        availabilityZone: null,
      },
    });
    regionMap.set(regionId, Number(region.id));
  }

  const tagValues = [
    ["Team", "payments"], ["Team", "platform"], ["Team", "analytics"], ["Team", "security"],
    ["Product", "checkout-api"], ["Product", "core-services"], ["Product", "reporting"], ["Product", "audit"],
    ["Environment", "dev"], ["Environment", "staging"], ["Environment", "prod"],
    ["Owner", "demo-owner"], ["Seed", SEED_MARKER],
  ] as const;

  for (const [tagKey, tagValue] of tagValues) {
    await DimTag.findOrCreate({
      where: {
        tenantId: tenant.id,
        providerId: provider.id,
        normalizedKey: tagKey.toLowerCase(),
        normalizedValue: tagValue.toLowerCase(),
      },
      defaults: {
        tenantId: tenant.id,
        providerId: provider.id,
        tagKey,
        tagValue,
        normalizedKey: tagKey.toLowerCase(),
        normalizedValue: tagValue.toLowerCase(),
      },
    });
  }

  const allResourceIds = [
    ...INSTANCES.map((x) => x.instanceId),
    ...VOLUMES.map((x) => x.volumeId),
    "snap-demo-old-001",
    "snap-demo-recent-001",
    "snap-demo-orphaned-001",
    "eipalloc-demo-unattached-001",
    "eipalloc-demo-attached-001",
    "eipalloc-demo-unattached-002",
  ];

  for (const resourceId of allResourceIds) {
    const resourceType = resourceId.startsWith("i-")
      ? "ec2_instance"
      : resourceId.startsWith("vol-")
      ? "ebs_volume"
      : "ec2_snapshot";

    await DimResource.findOrCreate({
      where: { tenantId: tenant.id, providerId: provider.id, resourceId },
      defaults: {
        tenantId: tenant.id,
        providerId: provider.id,
        resourceId,
        resourceName: resourceId,
        resourceType,
      },
    });
  }

  const dimResources = await DimResource.findAll({
    where: { tenantId: tenant.id, providerId: provider.id },
    attributes: ["id", "resourceId"],
  });
  const resourceKeyMap = new Map(dimResources.map((x) => [String(x.resourceId), Number(x.id)]));

  // Ensure dim_date rows exist and use surrogate keys for fact_cost_line_items FKs.
  for (const usageDate of dates) {
    const d = new Date(`${usageDate}T00:00:00.000Z`);
    const month = d.getUTCMonth() + 1;
    await DimDate.findOrCreate({
      where: { fullDate: usageDate },
      defaults: {
        fullDate: usageDate,
        dayOfMonth: d.getUTCDate(),
        monthOfYear: month,
        yearNumber: d.getUTCFullYear(),
        quarterNumber: Math.floor((month - 1) / 3) + 1,
        monthName: d.toLocaleString("en-US", { month: "long", timeZone: "UTC" }),
        dayName: d.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" }),
      },
    });
  }
  const dimDateRows = await DimDate.findAll({
    where: { fullDate: dates },
    attributes: ["id", "fullDate"],
  });
  const dimDateKeyMap = new Map(dimDateRows.map((row) => [String(row.fullDate), Number(row.id)]));
  const billingStartDateKey = dimDateKeyMap.get(dates[0]) ?? null;
  const billingEndDateKey = dimDateKeyMap.get(dates[dates.length - 1]) ?? null;

  await Ec2SnapshotInventorySnapshot.destroy({ where: { tenantId: tenant.id } });
  await EbsVolumeUtilizationHourly.destroy({ where: { tenantId: tenant.id } });
  await EbsVolumeUtilizationDaily.destroy({ where: { tenantId: tenant.id } });
  await FactEbsVolumeDaily.destroy({ where: { tenantId: tenant.id } });
  await Ec2VolumeInventorySnapshot.destroy({ where: { tenantId: tenant.id } });
  await Ec2InstanceUtilizationHourly.destroy({ where: { tenantId: tenant.id } });
  await Ec2InstanceUtilizationDaily.destroy({ where: { tenantId: tenant.id } });
  await FactEc2InstanceCoverageDaily.destroy({ where: { tenantId: tenant.id } });
  await FactEc2InstanceCostDaily.destroy({ where: { tenantId: tenant.id } });
  await FactEc2InstanceDaily.destroy({ where: { tenantId: tenant.id } });
  await Ec2InstanceInventorySnapshot.destroy({ where: { tenantId: tenant.id } });
  await Ec2EipInventorySnapshot.destroy({ where: { tenantId: tenant.id } });
  await FactCostLineItems.destroy({ where: { tenantId: tenant.id } });

  const discoveryTime = new Date(`${dates[dates.length - 1]}T12:00:00.000Z`);

  for (const item of INSTANCES) {
    const ctx = INSTANCE_CONTEXT[item.instanceId];
    const subAccountKey = subAccountKeyById.get(ctx.accountId) ?? null;
    await Ec2InstanceInventorySnapshot.create({
      tenantId: tenant.id,
      cloudConnectionId: connection.id,
      providerId: provider.id,
      instanceId: item.instanceId,
      resourceKey: resourceKeyMap.get(item.instanceId) ?? null,
      regionKey: regionMap.get(item.region) ?? null,
      subAccountKey,
      instanceType: "m6i.large",
      platform: "linux",
      platformDetails: "Linux/UNIX",
      architecture: "x86_64",
      virtualizationType: "hvm",
      tenancy: "default",
      state: item.state,
      launchTime: new Date(`${dates[0]}T08:00:00.000Z`),
      availabilityZone: `${item.region}a`,
      vpcId: "vpc-demo-01",
      subnetId: "subnet-demo-01",
      imageId: "ami-demo-001",
      privateIpAddress: "10.0.0.10",
      publicIpAddress: "44.0.0.10",
      tagsJson: {
        Name: item.name,
        Team: ctx.team,
        Product: ctx.product,
        Environment: ctx.environment,
        Owner: "demo-owner",
        Seed: SEED_MARKER,
      },
      metadataJson: { seed: SEED_MARKER, scenario: item.instanceId, accountId: ctx.accountId },
      discoveredAt: discoveryTime,
      isCurrent: true,
    });
  }

  const eipSnapshots = [
    {
      allocationId: "eipalloc-demo-unattached-001",
      publicIp: "54.240.10.10",
      region: "us-east-1" as const,
      accountId: "210987654321",
      associatedInstanceId: null,
      associatedResourceId: null,
      associationStatus: "unassociated",
      isAttached: false,
      scenario: "unattached_eip_use1",
    },
    {
      allocationId: "eipalloc-demo-attached-001",
      publicIp: "54.240.20.20",
      region: "us-west-2" as const,
      accountId: "210987654322",
      associatedInstanceId: "i-demo-under-001",
      associatedResourceId: "i-demo-under-001",
      associationStatus: "associated",
      isAttached: true,
      scenario: "attached_eip_usw2",
    },
    {
      allocationId: "eipalloc-demo-unattached-002",
      publicIp: "13.232.30.30",
      region: "ap-south-1" as const,
      accountId: "210987654323",
      associatedInstanceId: null,
      associatedResourceId: null,
      associationStatus: "available",
      isAttached: false,
      scenario: "unattached_eip_aps1",
    },
  ];
  for (const eip of eipSnapshots) {
    await Ec2EipInventorySnapshot.create({
      tenantId: tenant.id,
      cloudConnectionId: connection.id,
      providerId: provider.id,
      allocationId: eip.allocationId,
      publicIp: eip.publicIp,
      resourceKey: resourceKeyMap.get(eip.allocationId) ?? null,
      regionKey: regionMap.get(eip.region) ?? null,
      subAccountKey: subAccountKeyById.get(eip.accountId) ?? null,
      associatedInstanceId: eip.associatedInstanceId,
      associatedResourceId: eip.associatedResourceId,
      associationStatus: eip.associationStatus,
      isAttached: eip.isAttached,
      allocatedAt: new Date(`${dates[0]}T08:00:00.000Z`),
      tagsJson: { Name: eip.allocationId, Seed: SEED_MARKER },
      metadataJson: { seed: SEED_MARKER, scenario: eip.scenario },
      discoveredAt: discoveryTime,
      isCurrent: true,
      deletedAt: null,
    });
  }

  for (const usageDate of dates) {
    const dayIndex = dates.indexOf(usageDate);
    const usageDateKey = dimDateKeyMap.get(usageDate) ?? null;
    for (const item of INSTANCES) {
      const ctx = INSTANCE_CONTEXT[item.instanceId];
      const subAccountKey = subAccountKeyById.get(ctx.accountId) ?? null;
      const isRunning = item.state === "running";
      const cpuDelta = smoothVariation(`${item.instanceId}:cpu`, dayIndex, 0.02);
      const cpuBand = cpuBandForScenario(item);
      const cpuAvg = clamp(item.cpuAvg * (1 + cpuDelta), cpuBand.min, cpuBand.max);
      const cpuMax = clamp(Math.max(cpuAvg + 2, item.cpuMax * (1 + cpuDelta * 0.85)), 0, 99);
      const cpuMin = clamp(cpuAvg * (0.55 + seededUnit(`${item.instanceId}:${usageDate}:cpu:min`) * 0.2), 0, cpuAvg);
      const memAvg = clamp(cpuAvg + 6 + seededUnit(`${item.instanceId}:${usageDate}:mem:avg`) * 4, 6, 92);
      const memMax = clamp(Math.max(memAvg + 2, cpuMax + 1), 8, 97);
      const netInFactor = 0.8 + seededUnit(`${item.instanceId}:net-in-range`) * 0.8;
      const netOutFactor = 0.35 + seededUnit(`${item.instanceId}:net-out-range`) * 0.55;
      const netDelta = smoothVariation(`${item.instanceId}:network`, dayIndex, 0.05);
      const baseInMb = clamp(item.dailyNetMb * netInFactor, 50, 500);
      const baseOutMb = clamp(item.dailyNetMb * netOutFactor, 20, 300);
      const networkInMb = isRunning ? clamp(baseInMb * (1 + netDelta), 50, 500) : clamp(baseInMb * 0.03, 1, 20);
      const networkOutMb = isRunning ? clamp(baseOutMb * (1 + netDelta * 0.9), 20, 300) : clamp(baseOutMb * 0.03, 1, 15);
      const networkInBytes = mbToBytes(networkInMb);
      const networkOutBytes = mbToBytes(networkOutMb);
      const computeCost = isRunning ? round6(item.computeDaily * (1 + smoothVariation(`${item.instanceId}:compute`, dayIndex, 0.01))) : 0;
      const ebsCost = round6(item.ebsDaily * (1 + smoothVariation(`${item.instanceId}:ebs`, dayIndex, 0.006)));
      const transferRatePerGb = 0.028 + seededUnit(`${item.instanceId}:net-rate`) * 0.02; // $0.028..$0.048/GB
      const transferGb = (networkInBytes + networkOutBytes) / (1024 * 1024 * 1024);
      const dataTransferCost = round6(clamp(transferGb * transferRatePerGb, 0.02, 1.0));
      const otherCost = round6(0.04 + seededUnit(`${item.instanceId}:${usageDate}:other`) * 0.08);
      const total = round6(computeCost + ebsCost + dataTransferCost + otherCost);

      await FactEc2InstanceDaily.create({
        tenantId: tenant.id,
        cloudConnectionId: connection.id,
        billingSourceId: billingSource.id,
        providerId: provider.id,
        usageDate,
        instanceId: item.instanceId,
        resourceKey: resourceKeyMap.get(item.instanceId) ?? null,
        regionKey: regionMap.get(item.region) ?? null,
        subAccountKey,
        instanceName: item.name,
        instanceType: "m6i.large",
        availabilityZone: `${item.region}a`,
        isSpot: false,
        state: item.state,
        isRunning,
        totalHours: isRunning ? 24 : 0,
        computeCost,
        ebsCost,
        dataTransferCost,
        taxCost: 0,
        creditAmount: 0,
        refundAmount: 0,
        totalBilledCost: total,
        totalEffectiveCost: total,
        totalListCost: total,
        currencyCode: "USD",
        launchTime: new Date(`${dates[0]}T08:00:00.000Z`),
        source: "DEMO_DB_SEED",
        cpuAvg,
        cpuMax,
        cpuMin,
        memoryAvg: memAvg,
        memoryMax: memMax,
        diskUsedPercentAvg: 35,
        diskUsedPercentMax: 62,
        networkInBytes,
        networkOutBytes,
        pricingModel: item.reservationType,
        effectiveCost: total,
        billedCost: total,
        listCost: total,
        reservationType: item.reservationType,
        coveredHours: item.instanceId === "i-demo-storage-heavy-001"
          ? (isRunning ? 24 : 0)
          : (item.reservationType === "on_demand" ? 0 : (isRunning ? 24 : 0)),
        uncoveredHours: item.instanceId === "i-demo-storage-heavy-001"
          ? 0
          : (item.reservationType === "on_demand" ? (isRunning ? 24 : 0) : 0),
        coveredCost: item.instanceId === "i-demo-storage-heavy-001"
          ? total
          : (item.reservationType === "on_demand" ? 0 : total),
        uncoveredCost: item.instanceId === "i-demo-storage-heavy-001"
          ? 0
          : (item.reservationType === "on_demand" ? total : 0),
      });

      await FactEc2InstanceCostDaily.create({
        tenantId: tenant.id,
        cloudConnectionId: connection.id,
        billingSourceId: billingSource.id,
        providerId: provider.id,
        usageDate,
        instanceId: item.instanceId,
        resourceKey: resourceKeyMap.get(item.instanceId) ?? null,
        regionKey: regionMap.get(item.region) ?? null,
        subAccountKey,
        instanceType: "m6i.large",
        currencyCode: "USD",
        computeCost,
        ebsCost,
        dataTransferCost,
        taxCost: 0,
        creditAmount: 0,
        refundAmount: 0,
        totalBilledCost: total,
        totalEffectiveCost: total,
        totalListCost: total,
        usageHours: isRunning ? 24 : 0,
      });

      await FactEc2InstanceCoverageDaily.create({
        tenantId: tenant.id,
        cloudConnectionId: connection.id,
        billingSourceId: billingSource.id,
        providerId: provider.id,
        usageDate,
        instanceId: item.instanceId,
        resourceKey: resourceKeyMap.get(item.instanceId) ?? null,
        regionKey: regionMap.get(item.region) ?? null,
        subAccountKey,
        instanceType: "m6i.large",
        reservationType: item.reservationType,
        coveredHours: item.instanceId === "i-demo-storage-heavy-001"
          ? (isRunning ? 24 : 0)
          : (item.reservationType === "on_demand" ? 0 : (isRunning ? 24 : 0)),
        uncoveredHours: item.instanceId === "i-demo-storage-heavy-001"
          ? 0
          : (item.reservationType === "on_demand" ? (isRunning ? 24 : 0) : 0),
        coveredCost: item.instanceId === "i-demo-storage-heavy-001"
          ? total
          : (item.reservationType === "on_demand" ? 0 : total),
        uncoveredCost: item.instanceId === "i-demo-storage-heavy-001"
          ? 0
          : (item.reservationType === "on_demand" ? total : 0),
        effectiveCost: total,
      });

      await Ec2InstanceUtilizationDaily.create({
        tenantId: tenant.id,
        cloudConnectionId: connection.id,
        providerId: provider.id,
        instanceId: item.instanceId,
        usageDate,
        resourceKey: resourceKeyMap.get(item.instanceId) ?? null,
        regionKey: regionMap.get(item.region) ?? null,
        subAccountKey,
        cpuAvg,
        cpuMax,
        cpuMin,
        networkInBytes,
        networkOutBytes,
        networkPacketsIn: 1000,
        networkPacketsOut: 1200,
        diskReadBytes: 100000000,
        diskWriteBytes: 150000000,
        diskReadOps: 6000,
        diskWriteOps: 8000,
        statusCheckFailedMax: 0,
        statusCheckFailedInstanceMax: 0,
        statusCheckFailedSystemMax: 0,
        ebsReadBytes: 90000000,
        ebsWriteBytes: 120000000,
        ebsReadOps: 5000,
        ebsWriteOps: 7000,
        ebsQueueLengthMax: 0.8,
        ebsIdleTimeAvg: 80,
        ebsBurstBalanceAvg: 95,
        memoryAvg: memAvg,
        memoryMax: memMax,
        swapUsedAvg: 10,
        diskUsedPercentAvg: 35,
        diskUsedPercentMax: 62,
        diskFreeBytesAvg: 40000000000,
        peakToAvgCpuRatio: cpuAvg > 0 ? cpuMax / cpuAvg : 1,
        sampleCount: 24,
        metricSource: "DEMO_DB_SEED",
      });

      await Ec2InstanceUtilizationHourly.create({
        tenantId: tenant.id,
        cloudConnectionId: connection.id,
        providerId: provider.id,
        instanceId: item.instanceId,
        hourStart: new Date(`${usageDate}T00:00:00.000Z`),
        usageDate,
        resourceKey: resourceKeyMap.get(item.instanceId) ?? null,
        regionKey: regionMap.get(item.region) ?? null,
        subAccountKey,
        cpuAvg,
        cpuMax,
        cpuMin,
        networkInBytes: Math.round(networkInBytes / 24),
        networkOutBytes: Math.round(networkOutBytes / 24),
        sampleCount: 1,
        metricSource: "DEMO_DB_SEED",
      });

      await FactCostLineItems.create({
        tenantId: tenant.id,
        billingSourceId: billingSource.id,
        providerId: provider.id,
        billingAccountKey: billingAccount.id,
        subAccountKey,
        regionKey: regionMap.get(item.region) ?? null,
        serviceKey: ec2Service.id,
        resourceKey: resourceKeyMap.get(item.instanceId) ?? null,
        usageDateKey,
        billingPeriodStartDateKey: billingStartDateKey,
        billingPeriodEndDateKey: billingEndDateKey,
        billedCost: computeCost,
        effectiveCost: computeCost,
        listCost: computeCost,
        consumedQuantity: isRunning ? 24 : 0,
        pricingQuantity: isRunning ? 24 : 0,
        usageStartTime: new Date(`${usageDate}T00:00:00.000Z`),
        usageEndTime: new Date(`${usageDate}T23:59:59.999Z`),
        usageType: "BoxUsage:m6i.large",
        productUsageType: "BoxUsage:m6i.large",
        productFamily: "Compute Instance",
        fromRegionCode: item.region,
        toRegionCode: item.region,
        billType: "Anniversary",
        lineItemDescription: `Demo compute cost for ${item.instanceId}`,
        legalEntity: "Amazon Web Services, Inc.",
        operation: "RunInstances",
        lineItemType: "Usage",
        pricingTerm: item.reservationType === "on_demand" ? "OnDemand" : "Reserved",
        purchaseOption: item.reservationType,
        taxCost: 0,
        creditAmount: 0,
        refundAmount: 0,
        ingestedAt: new Date(),
      });

      await FactCostLineItems.create({
        tenantId: tenant.id,
        billingSourceId: billingSource.id,
        providerId: provider.id,
        billingAccountKey: billingAccount.id,
        subAccountKey,
        regionKey: regionMap.get(item.region) ?? null,
        serviceKey: ec2Service.id,
        resourceKey: resourceKeyMap.get(item.instanceId) ?? null,
        usageDateKey,
        billingPeriodStartDateKey: billingStartDateKey,
        billingPeriodEndDateKey: billingEndDateKey,
        billedCost: ebsCost,
        effectiveCost: ebsCost,
        listCost: ebsCost,
        consumedQuantity: 1,
        pricingQuantity: 1,
        usageStartTime: new Date(`${usageDate}T00:00:00.000Z`),
        usageEndTime: new Date(`${usageDate}T23:59:59.999Z`),
        usageType: "EBS:VolumeUsage.gp3",
        productUsageType: "EBS:VolumeUsage.gp3",
        productFamily: "Storage",
        fromRegionCode: item.region,
        toRegionCode: item.region,
        billType: "Anniversary",
        lineItemDescription: `Demo EBS cost for ${item.instanceId}`,
        legalEntity: "Amazon Web Services, Inc.",
        operation: "CreateVolume",
        lineItemType: "Usage",
        pricingTerm: "OnDemand",
        purchaseOption: "on_demand",
        taxCost: 0,
        creditAmount: 0,
        refundAmount: 0,
        ingestedAt: new Date(),
      });

      const usageDateObj = new Date(`${usageDate}T00:00:00.000Z`);
      const isWeekend = usageDateObj.getUTCDay() === 0 || usageDateObj.getUTCDay() === 6;
      const weekdayMultiplier = isWeekend ? 1.2 : 1;
      const baseTransferGb = isRunning
        ? (10 + seededUnit(`${item.instanceId}:${usageDate}:transfer:base`) * 40)
        : (0.5 + seededUnit(`${item.instanceId}:${usageDate}:transfer:base`) * 2.5);
      const spikeChance = seededUnit(`${item.instanceId}:${usageDate}:transfer:spike`);
      const spikeMultiplier = spikeChance > 0.86 ? (1.35 + seededUnit(`${item.instanceId}:${usageDate}:transfer:spike-amt`) * 0.5) : 1;
      const networkTotalGb = round6(clamp(baseTransferGb * weekdayMultiplier * spikeMultiplier, isRunning ? 10 : 0.5, isRunning ? 50 : 5));

      const internetShareRaw = 0.4 + seededUnit(`${item.instanceId}:${usageDate}:transfer:internet-share`) * 0.2;
      const interRegionShareRaw = 0.1 + seededUnit(`${item.instanceId}:${usageDate}:transfer:inter-region-share`) * 0.1;
      const interAzShareRaw = 0.1 + seededUnit(`${item.instanceId}:${usageDate}:transfer:inter-az-share`) * 0.1;
      const regionalShareRaw = 0.05 + seededUnit(`${item.instanceId}:${usageDate}:transfer:regional-share`) * 0.05;
      const unknownShareRaw = 0.01 + seededUnit(`${item.instanceId}:${usageDate}:transfer:unknown-share`) * 0.03;
      const totalShareRaw = internetShareRaw + interRegionShareRaw + interAzShareRaw + regionalShareRaw + unknownShareRaw;
      const internetShare = internetShareRaw / totalShareRaw;
      const interRegionShare = interRegionShareRaw / totalShareRaw;
      const interAzShare = interAzShareRaw / totalShareRaw;
      const regionalShare = regionalShareRaw / totalShareRaw;
      const internetGb = round6(networkTotalGb * internetShare);
      const interRegionGb = round6(networkTotalGb * interRegionShare);
      const interAzGb = round6(networkTotalGb * interAzShare);
      const regionalGb = round6(networkTotalGb * regionalShare);
      const unknownGb = round6(Math.max(0, networkTotalGb - internetGb - interRegionGb - interAzGb - regionalGb));

      const internetOutGb = round6(internetGb * 0.8);
      const internetInGb = round6(Math.max(0, internetGb - internetOutGb));

      const internetOutRate = 0.09;
      const internetInRate = 0;
      const interRegionRate = 0.035;
      const interAzRate = 0.01;
      const regionalRate = 0.008;
      const unknownRate = 0.02;

      const internetOutCost = round6(internetOutGb * internetOutRate);
      const internetInCost = round6(internetInGb * internetInRate);
      const interRegionCost = round6(interRegionGb * interRegionRate);
      const interAzCost = round6(interAzGb * interAzRate);
      const regionalCost = round6(regionalGb * regionalRate);
      const unknownCost = round6(unknownGb * unknownRate);
      const crossRegion = otherRegion(item.region);
      const networkLineItems = [
        {
          billedCost: internetOutCost,
          usageGb: internetOutGb,
          usageType: "DataTransfer-Out-Bytes",
          productUsageType: "DataTransfer-Out-Bytes",
          productFamily: "Data Transfer",
          fromRegionCode: item.region,
          toRegionCode: "",
          fromLocation: item.region,
          toLocation: "internet",
          lineItemDescription: `Demo internet egress data transfer for ${item.instanceId}`,
          operation: "DataTransfer",
        },
        {
          billedCost: internetInCost,
          usageGb: internetInGb,
          usageType: "DataTransfer-In-Bytes",
          productUsageType: "DataTransfer-In-Bytes",
          productFamily: "Data Transfer",
          fromRegionCode: "",
          toRegionCode: item.region,
          fromLocation: "internet",
          toLocation: item.region,
          lineItemDescription: `Demo internet ingress data transfer for ${item.instanceId}`,
          operation: "DataTransfer",
        },
        {
          billedCost: interRegionCost,
          usageGb: interRegionGb,
          usageType: `${item.region}-${crossRegion}-AWS-Out-Bytes`,
          productUsageType: `${item.region}-${crossRegion}-AWS-Out-Bytes`,
          productFamily: "Data Transfer",
          fromRegionCode: item.region,
          toRegionCode: crossRegion,
          fromLocation: item.region,
          toLocation: crossRegion,
          lineItemDescription: `Demo inter-region data transfer for ${item.instanceId}`,
          operation: "InterRegionDataTransfer",
        },
        {
          billedCost: interAzCost,
          usageGb: interAzGb,
          usageType: dayIndex % 2 === 0 ? "DataTransfer-Regional-Bytes" : "DataTransfer-InterAZ",
          productUsageType: dayIndex % 2 === 0 ? "DataTransfer-Regional-Bytes" : "DataTransfer-InterAZ",
          productFamily: "Data Transfer",
          fromRegionCode: item.region,
          toRegionCode: item.region,
          fromLocation: `${item.region}a`,
          toLocation: `${item.region}b`,
          lineItemDescription: `Demo inter-AZ data transfer for ${item.instanceId}`,
          operation: "DataTransfer-Regional",
        },
        {
          billedCost: regionalCost,
          usageGb: regionalGb,
          usageType: "Regional-DataTransfer-Bytes",
          productUsageType: "Regional-DataTransfer-Bytes",
          productFamily: "Data Transfer",
          fromRegionCode: item.region,
          toRegionCode: item.region,
          fromLocation: item.region,
          toLocation: item.region,
          lineItemDescription: `Demo regional data transfer for ${item.instanceId}`,
          operation: "DataTransfer-Regional",
        },
        {
          billedCost: unknownCost,
          usageGb: unknownGb,
          usageType: `MiscNet-${Math.floor(seededUnit(`${item.instanceId}:${usageDate}:transfer:unknown-pattern`) * 900 + 100)}-Bytes`,
          productUsageType: "MiscNetworkUsage",
          productFamily: "Data Transfer",
          fromRegionCode: item.region,
          toRegionCode: null,
          fromLocation: item.region,
          toLocation: "unknown",
          lineItemDescription: `Demo unclassified data transfer for ${item.instanceId}`,
          operation: "DataTransfer-Unknown",
        },
      ];

      for (const networkItem of networkLineItems) {
        await FactCostLineItems.create({
          tenantId: tenant.id,
          billingSourceId: billingSource.id,
          providerId: provider.id,
          billingAccountKey: billingAccount.id,
          subAccountKey,
          regionKey: regionMap.get(item.region) ?? null,
          serviceKey: ec2Service.id,
          resourceKey: resourceKeyMap.get(item.instanceId) ?? null,
          usageDateKey,
          billingPeriodStartDateKey: billingStartDateKey,
          billingPeriodEndDateKey: billingEndDateKey,
          billedCost: networkItem.billedCost,
          effectiveCost: networkItem.billedCost,
          listCost: networkItem.billedCost,
          consumedQuantity: networkItem.usageGb,
          pricingQuantity: networkItem.usageGb,
          usageStartTime: new Date(`${usageDate}T00:00:00.000Z`),
          usageEndTime: new Date(`${usageDate}T23:59:59.999Z`),
          usageType: networkItem.usageType,
          productUsageType: networkItem.productUsageType,
          productFamily: networkItem.productFamily,
          fromLocation: networkItem.fromLocation,
          toLocation: networkItem.toLocation,
          fromRegionCode: networkItem.fromRegionCode,
          toRegionCode: networkItem.toRegionCode,
          billType: "Anniversary",
          lineItemDescription: networkItem.lineItemDescription,
          legalEntity: "Amazon Web Services, Inc.",
          operation: networkItem.operation,
          lineItemType: "Usage",
          pricingTerm: "OnDemand",
          purchaseOption: "on_demand",
          taxCost: 0,
          creditAmount: 0,
          refundAmount: 0,
          ingestedAt: new Date(),
        });
      }

      await FactCostLineItems.create({
        tenantId: tenant.id,
        billingSourceId: billingSource.id,
        providerId: provider.id,
        billingAccountKey: billingAccount.id,
        subAccountKey,
        regionKey: regionMap.get(item.region) ?? null,
        serviceKey: ec2Service.id,
        resourceKey: resourceKeyMap.get(item.instanceId) ?? null,
        usageDateKey,
        billingPeriodStartDateKey: billingStartDateKey,
        billingPeriodEndDateKey: billingEndDateKey,
        billedCost: otherCost,
        effectiveCost: otherCost,
        listCost: otherCost,
        consumedQuantity: 1,
        pricingQuantity: 1,
        usageStartTime: new Date(`${usageDate}T00:00:00.000Z`),
        usageEndTime: new Date(`${usageDate}T23:59:59.999Z`),
        usageType: "Other:Monitoring",
        productUsageType: "Other:Monitoring",
        productFamily: "Other",
        fromRegionCode: item.region,
        toRegionCode: item.region,
        billType: "Anniversary",
        lineItemDescription: `Demo ancillary cost for ${item.instanceId}`,
        legalEntity: "Amazon Web Services, Inc.",
        operation: "Monitoring",
        lineItemType: "Usage",
        pricingTerm: "OnDemand",
        purchaseOption: "on_demand",
        taxCost: 0,
        creditAmount: 0,
        refundAmount: 0,
        ingestedAt: new Date(),
      });
    }
  }

  for (const usageDate of dates) {
    const usageDateKey = dimDateKeyMap.get(usageDate) ?? null;

    for (const eip of eipSnapshots) {
      const subAccountKey = subAccountKeyById.get(eip.accountId) ?? null;
      const isUnattached = !eip.isAttached;
      const hourlyCost = isUnattached ? 0.12 : 0.06;
      await FactCostLineItems.create({
        tenantId: tenant.id,
        billingSourceId: billingSource.id,
        providerId: provider.id,
        billingAccountKey: billingAccount.id,
        subAccountKey,
        regionKey: regionMap.get(eip.region) ?? null,
        serviceKey: ec2Service.id,
        resourceKey: resourceKeyMap.get(eip.allocationId) ?? null,
        usageDateKey,
        billingPeriodStartDateKey: billingStartDateKey,
        billingPeriodEndDateKey: billingEndDateKey,
        billedCost: round6(hourlyCost),
        effectiveCost: round6(hourlyCost),
        listCost: round6(hourlyCost),
        consumedQuantity: 24,
        pricingQuantity: 24,
        usageStartTime: new Date(`${usageDate}T00:00:00.000Z`),
        usageEndTime: new Date(`${usageDate}T23:59:59.999Z`),
        usageType: isUnattached ? "ElasticIP:IdleAddress" : "PublicIPv4:InUseAddress",
        productUsageType: isUnattached ? "ElasticIP:IdleAddress" : "PublicIPv4:InUseAddress",
        productFamily: "IP Address",
        fromRegionCode: eip.region,
        toRegionCode: eip.region,
        billType: "Anniversary",
        lineItemDescription: isUnattached
          ? `Demo unattached EIP ${eip.publicIp}`
          : `Demo attached EIP ${eip.publicIp} associated to ${eip.associatedResourceId}`,
        legalEntity: "Amazon Web Services, Inc.",
        operation: isUnattached ? "IdleAddress" : "InUseAddress",
        lineItemType: "Usage",
        pricingTerm: "OnDemand",
        purchaseOption: "on_demand",
        taxCost: 0,
        creditAmount: 0,
        refundAmount: 0,
        ingestedAt: new Date(),
      });
    }

    for (const region of REGIONS) {
      const natHoursCost = 0.36;
      await FactCostLineItems.create({
        tenantId: tenant.id,
        billingSourceId: billingSource.id,
        providerId: provider.id,
        billingAccountKey: billingAccount.id,
        subAccountKey: subAccountKeyById.get("210987654322") ?? null,
        regionKey: regionMap.get(region) ?? null,
        serviceKey: ec2Service.id,
        resourceKey: null,
        usageDateKey,
        billingPeriodStartDateKey: billingStartDateKey,
        billingPeriodEndDateKey: billingEndDateKey,
        billedCost: natHoursCost,
        effectiveCost: natHoursCost,
        listCost: natHoursCost,
        consumedQuantity: 24,
        pricingQuantity: 24,
        usageStartTime: new Date(`${usageDate}T00:00:00.000Z`),
        usageEndTime: new Date(`${usageDate}T23:59:59.999Z`),
        usageType: "NatGateway-Hours",
        productUsageType: "NatGateway-Hours",
        productFamily: "NAT Gateway",
        fromRegionCode: region,
        toRegionCode: region,
        fromLocation: region,
        toLocation: region,
        billType: "Anniversary",
        lineItemDescription: `Demo NAT Gateway hourly charge ${region}`,
        legalEntity: "Amazon Web Services, Inc.",
        operation: "NatGateway",
        lineItemType: "Usage",
        pricingTerm: "OnDemand",
        purchaseOption: "on_demand",
        taxCost: 0,
        creditAmount: 0,
        refundAmount: 0,
        ingestedAt: new Date(),
      });
    }
  }

  for (const volume of VOLUMES) {
    const volumeAccountId = volume.attachedInstanceId
      ? INSTANCE_CONTEXT[volume.attachedInstanceId]?.accountId
      : "210987654321";
    const volumeSubAccountKey = subAccountKeyById.get(volumeAccountId) ?? null;
    const volumeDiscoveredAt = volume.volumeId === "vol-demo-unattached-001"
      ? addDays(discoveryTime, -14)
      : discoveryTime;
    await Ec2VolumeInventorySnapshot.create({
      tenantId: tenant.id,
      cloudConnectionId: connection.id,
      providerId: provider.id,
      volumeId: volume.volumeId,
      resourceKey: resourceKeyMap.get(volume.volumeId) ?? null,
      regionKey: regionMap.get(volume.region) ?? null,
      subAccountKey: volumeSubAccountKey,
      volumeType: "gp3",
      sizeGb: volume.sizeGb,
      iops: 3000,
      throughput: 125,
      availabilityZone: `${volume.region}a`,
      state: volume.attachedInstanceId ? "in-use" : "available",
      attachedInstanceId: volume.attachedInstanceId,
      isAttached: Boolean(volume.attachedInstanceId),
      tagsJson: { Name: volume.volumeId, Seed: SEED_MARKER },
      metadataJson: { seed: SEED_MARKER },
      discoveredAt: volumeDiscoveredAt,
      isCurrent: true,
    });

    for (const usageDate of dates) {
      const dayIndex = dates.indexOf(usageDate);
      const attachedState = volume.attachedInstanceId === "i-demo-stopped-001";
      const iopsBase = volume.attachedInstanceId ? 180 : 110;
      const throughputBase = volume.attachedInstanceId ? 28 : 12;
      const iops = Math.round(clamp(iopsBase * (1 + smoothVariation(`${volume.volumeId}:iops`, dayIndex, 0.03)), 100, 300));
      const throughput = Math.round(clamp(throughputBase * (1 + smoothVariation(`${volume.volumeId}:throughput`, dayIndex, 0.03)), 10, 50));
      const storageCost = round6(volume.dailyCost * (1 + smoothVariation(`${volume.volumeId}:storage-cost`, dayIndex, 0.004)));
      const totalVolumeCost = round6(storageCost);
      await FactEbsVolumeDaily.create({
        tenantId: tenant.id,
        cloudConnectionId: connection.id,
        billingSourceId: billingSource.id,
        providerId: provider.id,
        usageDate,
        volumeId: volume.volumeId,
        resourceKey: resourceKeyMap.get(volume.volumeId) ?? null,
        regionKey: regionMap.get(volume.region) ?? null,
        subAccountKey: volumeSubAccountKey,
        volumeType: "gp3",
        sizeGb: volume.sizeGb,
        iops,
        throughput,
        availabilityZone: `${volume.region}a`,
        state: volume.attachedInstanceId ? "in-use" : "available",
        attachedInstanceId: volume.attachedInstanceId,
        isAttached: Boolean(volume.attachedInstanceId),
        storageCost,
        ioCost: 0,
        throughputCost: 0,
        totalCost: totalVolumeCost,
        currencyCode: "USD",
        isUnattached: !volume.attachedInstanceId,
        isAttachedToStoppedInstance: attachedState,
        isIdleCandidate: !volume.attachedInstanceId,
        isUnderutilizedCandidate: false,
        optimizationStatus: !volume.attachedInstanceId ? "idle" : "optimal",
      });

      await EbsVolumeUtilizationDaily.create({
        tenantId: tenant.id,
        cloudConnectionId: connection.id,
        providerId: provider.id,
        volumeId: volume.volumeId,
        usageDate,
        resourceKey: resourceKeyMap.get(volume.volumeId) ?? null,
        regionKey: regionMap.get(volume.region) ?? null,
        subAccountKey: volumeSubAccountKey,
        readBytes: volume.attachedInstanceId ? 250000000 : 1000,
        writeBytes: volume.attachedInstanceId ? 180000000 : 1000,
        readOps: volume.attachedInstanceId ? Math.round(iops * 42) : 1,
        writeOps: volume.attachedInstanceId ? Math.round(iops * 38) : 1,
        queueLengthMax: volume.attachedInstanceId ? 1.2 : 0.1,
        burstBalanceAvg: 90,
        idleTimeAvg: volume.attachedInstanceId ? 62 : 98,
        isIdleCandidate: !volume.attachedInstanceId,
        isUnderutilizedCandidate: false,
        sampleCount: 24,
        metricSource: "DEMO_DB_SEED",
      });

      await EbsVolumeUtilizationHourly.create({
        tenantId: tenant.id,
        cloudConnectionId: connection.id,
        providerId: provider.id,
        volumeId: volume.volumeId,
        hourStart: new Date(`${usageDate}T00:00:00.000Z`),
        usageDate,
        resourceKey: resourceKeyMap.get(volume.volumeId) ?? null,
        regionKey: regionMap.get(volume.region) ?? null,
        subAccountKey: volumeSubAccountKey,
        readBytes: volume.attachedInstanceId ? 12000000 : 100,
        writeBytes: volume.attachedInstanceId ? 7000000 : 100,
        readOps: volume.attachedInstanceId ? Math.round(iops / 4.5) : 1,
        writeOps: volume.attachedInstanceId ? Math.round(iops / 5) : 1,
        queueLengthMax: volume.attachedInstanceId ? 0.6 : 0,
        burstBalanceAvg: 90,
        idleTimeAvg: volume.attachedInstanceId ? 60 : 99,
        sampleCount: 1,
        metricSource: "DEMO_DB_SEED",
      });
    }
  }

  const snapshots = [
    {
      snapshotId: "snap-demo-old-001",
      region: "us-east-1" as const,
      accountId: "210987654321",
      sourceVolumeId: "vol-demo-unattached-001",
      sourceInstanceId: null,
      sizeGb: 500,
      ageDays: 120,
      storageTier: "standard",
      cost: 9.5,
      lineItemDescription: "Demo old snapshot storage cost",
    },
    {
      snapshotId: "snap-demo-recent-001",
      region: "us-west-2" as const,
      accountId: "210987654322",
      sourceVolumeId: "vol-demo-under-001",
      sourceInstanceId: "i-demo-under-001",
      sizeGb: 180,
      ageDays: 20,
      storageTier: "archive",
      cost: 2.4,
      lineItemDescription: "Demo recent snapshot storage cost",
    },
    {
      snapshotId: "snap-demo-orphaned-001",
      region: "ap-south-1" as const,
      accountId: "210987654323",
      sourceVolumeId: "vol-demo-missing-001",
      sourceInstanceId: null,
      sizeGb: 220,
      ageDays: 40,
      storageTier: "standard",
      cost: 7.1,
      lineItemDescription: "Demo orphaned snapshot storage cost",
    },
  ] as const;
  const snapshotUsageDate = dates[dates.length - 1];
  const snapshotUsageDateKey = dimDateKeyMap.get(snapshotUsageDate) ?? null;
  for (const snap of snapshots) {
    // Old snapshot >= 90 days should trigger "Delete or review old snapshot".
    await Ec2SnapshotInventorySnapshot.create({
      tenantId: tenant.id,
      cloudConnectionId: connection.id,
      providerId: provider.id,
      snapshotId: snap.snapshotId,
      resourceKey: resourceKeyMap.get(snap.snapshotId) ?? null,
      regionKey: regionMap.get(snap.region) ?? null,
      subAccountKey: subAccountKeyById.get(snap.accountId) ?? null,
      sourceVolumeId: snap.sourceVolumeId,
      sourceInstanceId: snap.sourceInstanceId,
      sizeGb: snap.sizeGb,
      startTime: addDays(new Date(), -snap.ageDays),
      state: "completed",
      storageTier: snap.storageTier,
      encrypted: false,
      progress: "100%",
      tagsJson: { Seed: SEED_MARKER },
      metadataJson: { seed: SEED_MARKER, ageDays: snap.ageDays },
      discoveredAt: discoveryTime,
      isCurrent: true,
    });

    await FactCostLineItems.create({
      tenantId: tenant.id,
      billingSourceId: billingSource.id,
      providerId: provider.id,
      billingAccountKey: billingAccount.id,
      subAccountKey: subAccountKeyById.get(snap.accountId) ?? null,
      regionKey: regionMap.get(snap.region) ?? null,
      serviceKey: ec2Service.id,
      resourceKey: resourceKeyMap.get(snap.snapshotId) ?? null,
      usageDateKey: snapshotUsageDateKey,
      billingPeriodStartDateKey: billingStartDateKey,
      billingPeriodEndDateKey: billingEndDateKey,
      billedCost: snap.cost,
      effectiveCost: snap.cost,
      listCost: snap.cost,
      consumedQuantity: 1,
      pricingQuantity: 1,
      usageStartTime: new Date(`${snapshotUsageDate}T00:00:00.000Z`),
      usageEndTime: new Date(`${snapshotUsageDate}T23:59:59.999Z`),
      usageType: "SnapshotUsage",
      productUsageType: "SnapshotUsage",
      productFamily: "Storage Snapshot",
      fromRegionCode: snap.region,
      toRegionCode: snap.region,
      billType: "Anniversary",
      lineItemDescription: snap.lineItemDescription,
      legalEntity: "Amazon Web Services, Inc.",
      operation: "CreateSnapshot",
      lineItemType: "Usage",
      pricingTerm: "OnDemand",
      purchaseOption: "on_demand",
      taxCost: 0,
      creditAmount: 0,
      refundAmount: 0,
      ingestedAt: new Date(),
    });
  }

  console.info("Demo DB seeding completed", {
    login: {
      email: DEMO_USER.email,
      password: DEMO_USER.password,
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    },
    cloudConnection: {
      id: connection.id,
      name: connection.connectionName,
      provider: "aws",
      status: connection.status,
      awsAccountId: DEMO.awsAccountId,
    },
    billingSource: {
      id: String(billingSource.id),
      sourceName: billingSource.sourceName,
      sourceType: billingSource.sourceType,
      status: billingSource.status,
    },
    seedMarker: SEED_MARKER,
  });

  await sequelize.close();
}

async function main(): Promise<void> {
  await runDemoSeed();
}

main().catch((error) => {
  console.error("Demo DB seed failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
