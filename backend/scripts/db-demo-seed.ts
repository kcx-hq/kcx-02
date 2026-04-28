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

  await ClientCloudAccount.findOrCreate({
    where: { tenantId: tenant.id, providerId: provider.id, accountId: DEMO.awsAccountId },
    defaults: {
      tenantId: tenant.id,
      providerId: provider.id,
      cloudConnectionId: connection.id,
      accountId: DEMO.awsAccountId,
      accountName: "Demo AWS Account",
      onboardingStatus: "connected",
      computeOptimizerEnabled: true,
      lastRecommendationSyncAt: new Date(),
      lastSyncStatus: "success",
      lastSyncMessage: "Seeded demo account",
    },
  });

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

  const [subAccount] = await DimSubAccount.findOrCreate({
    where: { tenantId: tenant.id, providerId: provider.id, subAccountId: DEMO.subAccountId },
    defaults: {
      tenantId: tenant.id,
      providerId: provider.id,
      subAccountId: DEMO.subAccountId,
      subAccountName: "Demo Sub Account",
    },
  });

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
    ["Team", "Platform"], ["Team", "Payments"], ["Team", "Data"],
    ["Product", "EC2 Demo"], ["Product", "Billing API"], ["Product", "Analytics"],
    ["Environment", "Dev"], ["Environment", "Staging"], ["Environment", "Prod"],
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
  await FactCostLineItems.destroy({ where: { tenantId: tenant.id } });

  const discoveryTime = new Date(`${dates[dates.length - 1]}T12:00:00.000Z`);

  for (const item of INSTANCES) {
    await Ec2InstanceInventorySnapshot.create({
      tenantId: tenant.id,
      cloudConnectionId: connection.id,
      providerId: provider.id,
      instanceId: item.instanceId,
      resourceKey: resourceKeyMap.get(item.instanceId) ?? null,
      regionKey: regionMap.get(item.region) ?? null,
      subAccountKey: subAccount.id,
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
      tagsJson: { Name: item.name, Seed: SEED_MARKER },
      metadataJson: { seed: SEED_MARKER, scenario: item.instanceId },
      discoveredAt: discoveryTime,
      isCurrent: true,
    });
  }

  for (const usageDate of dates) {
    const usageDateKey = dimDateKeyMap.get(usageDate) ?? null;
    for (const item of INSTANCES) {
      const isRunning = item.state === "running";
      const networkBytes = Math.round(item.dailyNetMb * 1024 * 1024);
      const computeCost = isRunning ? item.computeDaily : 0;
      const ebsCost = item.ebsDaily;
      const total = computeCost + ebsCost;

      await FactEc2InstanceDaily.create({
        tenantId: tenant.id,
        cloudConnectionId: connection.id,
        billingSourceId: billingSource.id,
        providerId: provider.id,
        usageDate,
        instanceId: item.instanceId,
        resourceKey: resourceKeyMap.get(item.instanceId) ?? null,
        regionKey: regionMap.get(item.region) ?? null,
        subAccountKey: subAccount.id,
        instanceName: item.name,
        instanceType: "m6i.large",
        availabilityZone: `${item.region}a`,
        isSpot: false,
        state: item.state,
        isRunning,
        totalHours: isRunning ? 24 : 0,
        computeCost,
        ebsCost,
        dataTransferCost: 0,
        taxCost: 0,
        creditAmount: 0,
        refundAmount: 0,
        totalBilledCost: total,
        totalEffectiveCost: total,
        totalListCost: total,
        currencyCode: "USD",
        launchTime: new Date(`${dates[0]}T08:00:00.000Z`),
        source: "DEMO_DB_SEED",
        cpuAvg: item.cpuAvg,
        cpuMax: item.cpuMax,
        cpuMin: Math.max(0, item.cpuAvg - 5),
        memoryAvg: Math.min(92, item.cpuAvg + 8),
        memoryMax: Math.min(97, item.cpuMax + 2),
        diskUsedPercentAvg: 35,
        diskUsedPercentMax: 62,
        networkInBytes: networkBytes,
        networkOutBytes: networkBytes,
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
        subAccountKey: subAccount.id,
        instanceType: "m6i.large",
        currencyCode: "USD",
        computeCost,
        ebsCost,
        dataTransferCost: 0,
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
        subAccountKey: subAccount.id,
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
        subAccountKey: subAccount.id,
        cpuAvg: item.cpuAvg,
        cpuMax: item.cpuMax,
        cpuMin: Math.max(0, item.cpuAvg - 5),
        networkInBytes: networkBytes,
        networkOutBytes: networkBytes,
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
        memoryAvg: Math.min(92, item.cpuAvg + 8),
        memoryMax: Math.min(97, item.cpuMax + 2),
        swapUsedAvg: 10,
        diskUsedPercentAvg: 35,
        diskUsedPercentMax: 62,
        diskFreeBytesAvg: 40000000000,
        peakToAvgCpuRatio: item.cpuAvg > 0 ? item.cpuMax / item.cpuAvg : 1,
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
        subAccountKey: subAccount.id,
        cpuAvg: item.cpuAvg,
        cpuMax: item.cpuMax,
        cpuMin: Math.max(0, item.cpuAvg - 5),
        networkInBytes: Math.round(networkBytes / 24),
        networkOutBytes: Math.round(networkBytes / 24),
        sampleCount: 1,
        metricSource: "DEMO_DB_SEED",
      });

      await FactCostLineItems.create({
        tenantId: tenant.id,
        billingSourceId: billingSource.id,
        providerId: provider.id,
        billingAccountKey: billingAccount.id,
        subAccountKey: subAccount.id,
        regionKey: regionMap.get(item.region) ?? null,
        serviceKey: ec2Service.id,
        resourceKey: resourceKeyMap.get(item.instanceId) ?? null,
        usageDateKey,
        billingPeriodStartDateKey: billingStartDateKey,
        billingPeriodEndDateKey: billingEndDateKey,
        billedCost: total,
        effectiveCost: total,
        listCost: total,
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
        lineItemDescription: `Demo cost for ${item.instanceId}`,
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
    }
  }

  for (const volume of VOLUMES) {
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
      subAccountKey: subAccount.id,
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
      const attachedState = volume.attachedInstanceId === "i-demo-stopped-001";
      await FactEbsVolumeDaily.create({
        tenantId: tenant.id,
        cloudConnectionId: connection.id,
        billingSourceId: billingSource.id,
        providerId: provider.id,
        usageDate,
        volumeId: volume.volumeId,
        resourceKey: resourceKeyMap.get(volume.volumeId) ?? null,
        regionKey: regionMap.get(volume.region) ?? null,
        subAccountKey: subAccount.id,
        volumeType: "gp3",
        sizeGb: volume.sizeGb,
        iops: 3000,
        throughput: 125,
        availabilityZone: `${volume.region}a`,
        state: volume.attachedInstanceId ? "in-use" : "available",
        attachedInstanceId: volume.attachedInstanceId,
        isAttached: Boolean(volume.attachedInstanceId),
        storageCost: volume.dailyCost,
        ioCost: 0,
        throughputCost: 0,
        totalCost: volume.dailyCost,
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
        subAccountKey: subAccount.id,
        readBytes: volume.attachedInstanceId ? 250000000 : 1000,
        writeBytes: volume.attachedInstanceId ? 180000000 : 1000,
        readOps: volume.attachedInstanceId ? 10000 : 1,
        writeOps: volume.attachedInstanceId ? 9000 : 1,
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
        subAccountKey: subAccount.id,
        readBytes: volume.attachedInstanceId ? 12000000 : 100,
        writeBytes: volume.attachedInstanceId ? 7000000 : 100,
        readOps: volume.attachedInstanceId ? 450 : 1,
        writeOps: volume.attachedInstanceId ? 400 : 1,
        queueLengthMax: volume.attachedInstanceId ? 0.6 : 0,
        burstBalanceAvg: 90,
        idleTimeAvg: volume.attachedInstanceId ? 60 : 99,
        sampleCount: 1,
        metricSource: "DEMO_DB_SEED",
      });
    }
  }

  await Ec2SnapshotInventorySnapshot.create({
    tenantId: tenant.id,
    cloudConnectionId: connection.id,
    providerId: provider.id,
    snapshotId: "snap-demo-old-001",
    resourceKey: resourceKeyMap.get("snap-demo-old-001") ?? null,
    regionKey: regionMap.get("us-east-1") ?? null,
    subAccountKey: subAccount.id,
    sourceVolumeId: "vol-demo-unattached-001",
    sourceInstanceId: null,
    sizeGb: 500,
    startTime: addDays(new Date(), -120),
    state: "completed",
    storageTier: "standard",
    encrypted: false,
    progress: "100%",
    tagsJson: { Seed: SEED_MARKER },
    metadataJson: { seed: SEED_MARKER, ageDays: 120 },
    discoveredAt: discoveryTime,
    isCurrent: true,
  });

  // Seed snapshot cost line item so old_snapshot rule can evaluate snapshot_cost > $5.
  const snapshotUsageDate = dates[dates.length - 1];
  const snapshotUsageDateKey = dimDateKeyMap.get(snapshotUsageDate) ?? null;
  await FactCostLineItems.create({
    tenantId: tenant.id,
    billingSourceId: billingSource.id,
    providerId: provider.id,
    billingAccountKey: billingAccount.id,
    subAccountKey: subAccount.id,
    regionKey: regionMap.get("us-east-1") ?? null,
    serviceKey: ec2Service.id,
    resourceKey: resourceKeyMap.get("snap-demo-old-001") ?? null,
    usageDateKey: snapshotUsageDateKey,
    billingPeriodStartDateKey: billingStartDateKey,
    billingPeriodEndDateKey: billingEndDateKey,
    billedCost: 9.5,
    effectiveCost: 9.5,
    listCost: 9.5,
    consumedQuantity: 1,
    pricingQuantity: 1,
    usageStartTime: new Date(`${snapshotUsageDate}T00:00:00.000Z`),
    usageEndTime: new Date(`${snapshotUsageDate}T23:59:59.999Z`),
    usageType: "SnapshotUsage",
    productUsageType: "SnapshotUsage",
    productFamily: "Storage Snapshot",
    fromRegionCode: "us-east-1",
    toRegionCode: "us-east-1",
    billType: "Anniversary",
    lineItemDescription: "Demo snapshot storage cost",
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
