import {
  DescribeInstancesCommand,
  DescribeRegionsCommand,
  DescribeVolumesCommand,
  EC2Client,
  type Instance,
  type Tag,
  type Volume,
} from "@aws-sdk/client-ec2";
import { QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";

import env from "../../../../config/env.js";
import {
  CloudConnectionV2,
  DimRegion,
  DimResource,
  DimSubAccount,
  Ec2InstanceInventorySnapshot,
  Ec2VolumeInventorySnapshot,
  sequelize,
} from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";
import { assumeRole } from "../../../cloud-connections/aws/infrastructure/aws-sts.service.js";
import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";

type AwsConnectionContext = {
  tenantId: string | null;
  providerId: string | null;
  connectionId: string;
  actionRoleArn: string;
  externalId: string | null;
  defaultRegion: string;
  subAccountId: string | null;
  subAccountName: string | null;
};

type RegionInfo = {
  region: string;
  optInStatus: string | null;
};

type SnapshotRowInput = {
  tenantId: string | null;
  cloudConnectionId: string | null;
  providerId: string | null;
  instanceId: string;
  resourceKey: string | null;
  regionKey: string | null;
  subAccountKey: string | null;
  instanceType: string | null;
  state: string | null;
  launchTime: Date | null;
  availabilityZone: string | null;
  vpcId: string | null;
  subnetId: string | null;
  platform: string | null;
  platformDetails: string | null;
  architecture: string | null;
  instanceLifecycle: string | null;
  privateIpAddress: string | null;
  publicIpAddress: string | null;
  tagsJson: Record<string, unknown> | null;
  metadataJson: Record<string, unknown> | null;
  discoveredAt: Date;
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type VolumeSnapshotRowInput = {
  tenantId: string | null;
  cloudConnectionId: string | null;
  providerId: number | null;
  volumeId: string;
  resourceKey: number | null;
  regionKey: number | null;
  subAccountKey: number | null;
  volumeType: string | null;
  sizeGb: number | null;
  iops: number | null;
  throughput: number | null;
  availabilityZone: string | null;
  state: string | null;
  attachedInstanceId: string | null;
  isAttached: boolean | null;
  tagsJson: Record<string, unknown> | null;
  metadataJson: Record<string, unknown> | null;
  discoveredAt: Date;
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const normalizeTrim = (value: string | null | undefined): string => String(value ?? "").trim();
const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const normalized = normalizeTrim(typeof value === "string" ? value : null);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
const isUniqueViolation = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return msg.includes("duplicate key value violates unique constraint");
};

type InventoryDimensionCache = {
  resourceByInstanceId: Map<string, string | null>;
  resourceByVolumeId: Map<string, string | null>;
  regionByRegionAz: Map<string, string | null>;
  subAccountByExternalId: Map<string, string | null>;
};

const createInventoryDimensionCache = (): InventoryDimensionCache => ({
  resourceByInstanceId: new Map(),
  resourceByVolumeId: new Map(),
  regionByRegionAz: new Map(),
  subAccountByExternalId: new Map(),
});

const resolveSubAccountKey = async (input: {
  tenantId: string | null;
  providerId: string | null;
  subAccountId: string | null;
  subAccountName: string | null;
  cache: InventoryDimensionCache;
}): Promise<string | null> => {
  const tenantId = normalizeTrim(input.tenantId);
  const providerId = normalizeTrim(input.providerId);
  const subAccountId = normalizeTrim(input.subAccountId);
  if (!tenantId || !providerId || !subAccountId) return null;

  const cacheKey = `${tenantId}|${providerId}|${subAccountId}`;
  if (input.cache.subAccountByExternalId.has(cacheKey)) {
    return input.cache.subAccountByExternalId.get(cacheKey) ?? null;
  }

  const where = { tenantId, providerId, subAccountId };
  const existing = await DimSubAccount.findOne({ where });
  if (existing) {
    const id = String(existing.id);
    input.cache.subAccountByExternalId.set(cacheKey, id);
    return id;
  }

  try {
    const created = await DimSubAccount.create({
      tenantId,
      providerId,
      subAccountId,
      subAccountName: normalizeTrim(input.subAccountName) || null,
    });
    const id = String(created.id);
    input.cache.subAccountByExternalId.set(cacheKey, id);
    return id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const retried = await DimSubAccount.findOne({ where });
    const id = retried ? String(retried.id) : null;
    input.cache.subAccountByExternalId.set(cacheKey, id);
    return id;
  }
};

const resolveRegionKey = async (input: {
  providerId: string | null;
  region: string;
  availabilityZone: string | null;
  cache: InventoryDimensionCache;
}): Promise<string | null> => {
  const providerId = normalizeTrim(input.providerId);
  const region = normalizeTrim(input.region);
  const az = normalizeTrim(input.availabilityZone) || null;
  if (!providerId || !region) return null;

  const cacheKey = `${providerId}|${region}|${az ?? ""}`;
  if (input.cache.regionByRegionAz.has(cacheKey)) {
    return input.cache.regionByRegionAz.get(cacheKey) ?? null;
  }

  const candidates = [
    { providerId, regionId: region, availabilityZone: az },
    { providerId, regionId: region, availabilityZone: null },
    { providerId, regionName: region, availabilityZone: az },
    { providerId, regionName: region, availabilityZone: null },
  ] as const;

  for (const where of candidates) {
    const existing = await DimRegion.findOne({ where });
    if (existing) {
      const id = String(existing.id);
      input.cache.regionByRegionAz.set(cacheKey, id);
      return id;
    }
  }

  try {
    const created = await DimRegion.create({
      providerId,
      regionId: region,
      regionName: region,
      availabilityZone: az,
    });
    const id = String(created.id);
    input.cache.regionByRegionAz.set(cacheKey, id);
    return id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const retried = await DimRegion.findOne({
      where: { providerId, regionId: region, availabilityZone: az },
    });
    const id = retried ? String(retried.id) : null;
    input.cache.regionByRegionAz.set(cacheKey, id);
    return id;
  }
};

const resolveResourceKey = async (input: {
  tenantId: string | null;
  providerId: string | null;
  instanceId: string;
  instanceName: string | null;
  cache: InventoryDimensionCache;
}): Promise<string | null> => {
  const tenantId = normalizeTrim(input.tenantId);
  const providerId = normalizeTrim(input.providerId);
  const instanceId = normalizeTrim(input.instanceId);
  if (!tenantId || !providerId || !instanceId) return null;

  const cacheKey = `${tenantId}|${providerId}|${instanceId}`;
  if (input.cache.resourceByInstanceId.has(cacheKey)) {
    return input.cache.resourceByInstanceId.get(cacheKey) ?? null;
  }

  const where = { tenantId, providerId, resourceId: instanceId };
  const existing = await DimResource.findOne({ where });
  if (existing) {
    const id = String(existing.id);
    input.cache.resourceByInstanceId.set(cacheKey, id);
    return id;
  }

  try {
    const created = await DimResource.create({
      tenantId,
      providerId,
      resourceId: instanceId,
      resourceName: normalizeTrim(input.instanceName) || instanceId,
      resourceType: "ec2_instance",
    });
    const id = String(created.id);
    input.cache.resourceByInstanceId.set(cacheKey, id);
    return id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const retried = await DimResource.findOne({ where });
    const id = retried ? String(retried.id) : null;
    input.cache.resourceByInstanceId.set(cacheKey, id);
    return id;
  }
};

const resolveVolumeResourceKey = async (input: {
  tenantId: string | null;
  providerId: string | null;
  volumeId: string;
  volumeName: string | null;
  cache: InventoryDimensionCache;
}): Promise<string | null> => {
  const tenantId = normalizeTrim(input.tenantId);
  const providerId = normalizeTrim(input.providerId);
  const volumeId = normalizeTrim(input.volumeId);
  if (!tenantId || !providerId || !volumeId) return null;

  const cacheKey = `${tenantId}|${providerId}|${volumeId}`;
  if (input.cache.resourceByVolumeId.has(cacheKey)) {
    return input.cache.resourceByVolumeId.get(cacheKey) ?? null;
  }

  const where = { tenantId, providerId, resourceId: volumeId };
  const existing = await DimResource.findOne({ where });
  if (existing) {
    const id = String(existing.id);
    input.cache.resourceByVolumeId.set(cacheKey, id);
    return id;
  }

  try {
    const created = await DimResource.create({
      tenantId,
      providerId,
      resourceId: volumeId,
      resourceName: normalizeTrim(input.volumeName) || volumeId,
      resourceType: "ec2_volume",
    });
    const id = String(created.id);
    input.cache.resourceByVolumeId.set(cacheKey, id);
    return id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const retried = await DimResource.findOne({ where });
    const id = retried ? String(retried.id) : null;
    input.cache.resourceByVolumeId.set(cacheKey, id);
    return id;
  }
};

const enrichSnapshotsWithDimensionKeys = async (input: {
  rows: SnapshotRowInput[];
  context: AwsConnectionContext;
  cache: InventoryDimensionCache;
  region: string;
}): Promise<void> => {
  for (const row of input.rows) {
    const tagName =
      row.tagsJson && typeof row.tagsJson.Name === "string" ? normalizeTrim(String(row.tagsJson.Name)) : null;

    row.subAccountKey = await resolveSubAccountKey({
      tenantId: input.context.tenantId,
      providerId: input.context.providerId,
      subAccountId: input.context.subAccountId,
      subAccountName: input.context.subAccountName,
      cache: input.cache,
    });
    row.regionKey = await resolveRegionKey({
      providerId: input.context.providerId,
      region: input.region,
      availabilityZone: row.availabilityZone,
      cache: input.cache,
    });
    row.resourceKey = await resolveResourceKey({
      tenantId: input.context.tenantId,
      providerId: input.context.providerId,
      instanceId: row.instanceId,
      instanceName: tagName,
      cache: input.cache,
    });
  }
};

const enrichVolumeSnapshotsWithDimensionKeys = async (input: {
  rows: VolumeSnapshotRowInput[];
  context: AwsConnectionContext;
  cache: InventoryDimensionCache;
  region: string;
}): Promise<void> => {
  for (const row of input.rows) {
    const tagName =
      row.tagsJson && typeof row.tagsJson.Name === "string" ? normalizeTrim(String(row.tagsJson.Name)) : null;

    const subAccountKey = await resolveSubAccountKey({
      tenantId: input.context.tenantId,
      providerId: input.context.providerId,
      subAccountId: input.context.subAccountId,
      subAccountName: input.context.subAccountName,
      cache: input.cache,
    });
    row.subAccountKey = toNullableNumber(subAccountKey);

    const regionKey = await resolveRegionKey({
      providerId: input.context.providerId,
      region: input.region,
      availabilityZone: row.availabilityZone,
      cache: input.cache,
    });
    row.regionKey = toNullableNumber(regionKey);

    const resourceKey = await resolveVolumeResourceKey({
      tenantId: input.context.tenantId,
      providerId: input.context.providerId,
      volumeId: row.volumeId,
      volumeName: tagName,
      cache: input.cache,
    });
    row.resourceKey = toNullableNumber(resourceKey);
  }
};

const toTagMap = (tags: Tag[] | undefined): Record<string, string> | null => {
  if (!tags || tags.length === 0) return null;

  const out: Record<string, string> = {};
  for (const tag of tags) {
    const key = normalizeTrim(tag.Key);
    if (!key) continue;
    const value = normalizeTrim(tag.Value);
    out[key] = value;
  }

  return Object.keys(out).length > 0 ? out : null;
};

const extractIpDetails = (
  instance: Instance,
): {
  privateIpAddress: string | null;
  publicIpAddress: string | null;
  privateIpAddresses: string[];
  publicIpAddresses: string[];
  ipv6Addresses: string[];
} => {
  const primaryPrivate = normalizeTrim(instance.PrivateIpAddress) || null;
  const primaryPublic = normalizeTrim(instance.PublicIpAddress) || null;

  const privateIpAddresses: string[] = [];
  const publicIpAddresses: string[] = [];
  const ipv6Addresses: string[] = [];

  for (const iface of instance.NetworkInterfaces ?? []) {
    for (const ip of iface.PrivateIpAddresses ?? []) {
      const privateIp = normalizeTrim(ip.PrivateIpAddress);
      if (privateIp) privateIpAddresses.push(privateIp);

      const publicIp = normalizeTrim(ip.Association?.PublicIp);
      if (publicIp) publicIpAddresses.push(publicIp);
    }

    for (const ipv6 of iface.Ipv6Addresses ?? []) {
      const address = normalizeTrim(ipv6.Ipv6Address);
      if (address) ipv6Addresses.push(address);
    }
  }

  const dedupe = (values: string[]): string[] => Array.from(new Set(values));
  return {
    privateIpAddress: primaryPrivate,
    publicIpAddress: primaryPublic,
    privateIpAddresses: dedupe(privateIpAddresses),
    publicIpAddresses: dedupe(publicIpAddresses),
    ipv6Addresses: dedupe(ipv6Addresses),
  };
};

const buildEc2Client = (region: string, credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string }): EC2Client =>
  new EC2Client({
    region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });

const resolveAwsConnectionContextForJob = async (job: ScheduledJob): Promise<AwsConnectionContext> => {
  const connectionId = normalizeTrim(job.cloudConnectionId ? String(job.cloudConnectionId) : "");
  if (!connectionId) {
    throw new Error("scheduled job missing cloud_connection_id");
  }

  const tenantId = normalizeTrim(job.tenantId ? String(job.tenantId) : "") || null;

  const connection = await CloudConnectionV2.findOne({
    where: {
      id: connectionId,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  if (!connection) {
    throw new Error(`cloud connection not found for scheduled job: ${connectionId}`);
  }

  const roleArn = normalizeTrim(connection.actionRoleArn) || normalizeTrim(connection.billingRoleArn);
  if (!roleArn) {
    throw new Error(`cloud connection missing action_role_arn (or billing_role_arn fallback): ${connectionId}`);
  }

  const defaultRegion = normalizeTrim(connection.region) || env.awsRegion;

  return {
    tenantId: tenantId ?? (connection.tenantId ? String(connection.tenantId) : null),
    providerId: job.providerId ? String(job.providerId) : connection.providerId ? String(connection.providerId) : null,
    connectionId: String(connection.id),
    actionRoleArn: roleArn,
    externalId: connection.externalId ? String(connection.externalId) : null,
    defaultRegion,
    subAccountId: normalizeTrim(connection.cloudAccountId) || normalizeTrim(connection.payerAccountId) || null,
    subAccountName: normalizeTrim(connection.connectionName) || null,
  };
};

const listRegions = async (client: EC2Client): Promise<RegionInfo[]> => {
  const response = await client.send(new DescribeRegionsCommand({ AllRegions: true }));
  return (response.Regions ?? [])
    .map((region) => ({
      region: normalizeTrim(region.RegionName),
      optInStatus: region.OptInStatus ? String(region.OptInStatus) : null,
    }))
    .filter((row) => Boolean(row.region));
};

const isRegionEnabled = (optInStatus: string | null): boolean => {
  if (!optInStatus) return true;
  return optInStatus === "opt-in-not-required" || optInStatus === "opted-in";
};

const listInstancesInRegion = async (client: EC2Client): Promise<Instance[]> => {
  const instances: Instance[] = [];
  let nextToken: string | undefined;

  do {
    const response = await client.send(
      new DescribeInstancesCommand({
        NextToken: nextToken,
      }),
    );

    for (const reservation of response.Reservations ?? []) {
      for (const instance of reservation.Instances ?? []) {
        if (instance.InstanceId) {
          instances.push(instance);
        }
      }
    }

    nextToken = response.NextToken;
  } while (nextToken);

  return instances;
};

const listVolumesInRegion = async (client: EC2Client): Promise<Volume[]> => {
  const volumes: Volume[] = [];
  let nextToken: string | undefined;

  do {
    const response = await client.send(
      new DescribeVolumesCommand({
        NextToken: nextToken,
      }),
    );

    for (const volume of response.Volumes ?? []) {
      if (volume.VolumeId) {
        volumes.push(volume);
      }
    }

    nextToken = response.NextToken;
  } while (nextToken);

  return volumes;
};

const toSnapshotRow = (input: {
  context: AwsConnectionContext;
  instance: Instance;
  region: string;
  discoveredAt: Date;
}): SnapshotRowInput => {
  const instanceId = normalizeTrim(input.instance.InstanceId);
  if (!instanceId) {
    throw new Error("DescribeInstances returned instance without InstanceId");
  }

  const tagsJson = toTagMap(input.instance.Tags);
  const { privateIpAddress, publicIpAddress, privateIpAddresses, publicIpAddresses, ipv6Addresses } = extractIpDetails(
    input.instance,
  );

  const availabilityZone = normalizeTrim(input.instance.Placement?.AvailabilityZone) || null;

  const metadataJson: Record<string, unknown> = {
    awsRegion: input.region,
    availabilityZone,
    placement: input.instance.Placement ?? null,
    securityGroupIds: (input.instance.SecurityGroups ?? []).map((sg) => normalizeTrim(sg.GroupId)).filter(Boolean),
    securityGroupNames: (input.instance.SecurityGroups ?? []).map((sg) => normalizeTrim(sg.GroupName)).filter(Boolean),
    privateIpAddresses,
    publicIpAddresses,
    ipv6Addresses,
    ebsOptimized: input.instance.EbsOptimized ?? null,
    hypervisor: input.instance.Hypervisor ?? null,
    rootDeviceName: input.instance.RootDeviceName ?? null,
    rootDeviceType: input.instance.RootDeviceType ?? null,
    virtualizationType: input.instance.VirtualizationType ?? null,
    tenancy: input.instance.Placement?.Tenancy ?? null,
    iamInstanceProfileArn: input.instance.IamInstanceProfile?.Arn ?? null,
    keyName: input.instance.KeyName ?? null,
    imageId: input.instance.ImageId ?? null,
    spotInstanceRequestId: input.instance.SpotInstanceRequestId ?? null,
    monitoringState: input.instance.Monitoring?.State ?? null,
  };

  return {
    tenantId: input.context.tenantId,
    cloudConnectionId: input.context.connectionId,
    providerId: input.context.providerId,
    instanceId,
    resourceKey: null,
    regionKey: null,
    subAccountKey: null,
    instanceType: input.instance.InstanceType ? String(input.instance.InstanceType) : null,
    state: input.instance.State?.Name ? String(input.instance.State.Name) : null,
    launchTime: input.instance.LaunchTime ?? null,
    availabilityZone,
    vpcId: input.instance.VpcId ?? null,
    subnetId: input.instance.SubnetId ?? null,
    platform: input.instance.Platform ? String(input.instance.Platform) : null,
    platformDetails: input.instance.PlatformDetails ? String(input.instance.PlatformDetails) : null,
    architecture: input.instance.Architecture ? String(input.instance.Architecture) : null,
    instanceLifecycle: input.instance.InstanceLifecycle ? String(input.instance.InstanceLifecycle) : null,
    privateIpAddress,
    publicIpAddress,
    tagsJson,
    metadataJson,
    discoveredAt: input.discoveredAt,
    isCurrent: true,
    createdAt: input.discoveredAt,
    updatedAt: input.discoveredAt,
  };
};

const toVolumeSnapshotRow = (input: {
  context: AwsConnectionContext;
  volume: Volume;
  region: string;
  discoveredAt: Date;
}): VolumeSnapshotRowInput => {
  const volumeId = normalizeTrim(input.volume.VolumeId);
  if (!volumeId) {
    throw new Error("DescribeVolumes returned volume without VolumeId");
  }

  const tagsJson = toTagMap(input.volume.Tags);
  const availabilityZone = normalizeTrim(input.volume.AvailabilityZone) || null;
  const attachments = Array.isArray(input.volume.Attachments) ? input.volume.Attachments : [];
  const attachedInstanceId = normalizeTrim(attachments[0]?.InstanceId) || null;
  const isAttached = attachments.length > 0;

  const metadataJson: Record<string, unknown> = {
    awsRegion: input.region,
    availabilityZone,
    createTime: input.volume.CreateTime ?? null,
    encrypted: input.volume.Encrypted ?? null,
    kmsKeyId: input.volume.KmsKeyId ?? null,
    multiAttachEnabled: input.volume.MultiAttachEnabled ?? null,
    outpostArn: input.volume.OutpostArn ?? null,
    snapshotId: input.volume.SnapshotId ?? null,
    state: input.volume.State ? String(input.volume.State) : null,
    attachments,
  };

  return {
    tenantId: input.context.tenantId,
    cloudConnectionId: input.context.connectionId,
    providerId: toNullableNumber(input.context.providerId),
    volumeId,
    resourceKey: null,
    regionKey: null,
    subAccountKey: null,
    volumeType: input.volume.VolumeType ? String(input.volume.VolumeType) : null,
    sizeGb: typeof input.volume.Size === "number" ? input.volume.Size : null,
    iops: typeof input.volume.Iops === "number" ? input.volume.Iops : null,
    throughput: typeof input.volume.Throughput === "number" ? input.volume.Throughput : null,
    availabilityZone,
    state: input.volume.State ? String(input.volume.State) : null,
    attachedInstanceId,
    isAttached,
    tagsJson,
    metadataJson,
    discoveredAt: input.discoveredAt,
    isCurrent: true,
    createdAt: input.discoveredAt,
    updatedAt: input.discoveredAt,
  };
};

const markOlderSnapshotsNotCurrent = async (input: {
  cloudConnectionId: string;
  instanceIds: string[];
  transaction?: Transaction;
}): Promise<void> => {
  if (input.instanceIds.length === 0) return;

  await sequelize.query(
    `
      UPDATE ec2_instance_inventory_snapshots
      SET is_current = false,
          updated_at = NOW()
      WHERE cloud_connection_id = $1
        AND is_current = true
        AND instance_id = ANY($2::text[]);
    `,
    {
      bind: [input.cloudConnectionId, input.instanceIds],
      type: QueryTypes.UPDATE,
      transaction: input.transaction,
    },
  );
};

const markOlderVolumeSnapshotsNotCurrent = async (input: {
  cloudConnectionId: string;
  volumeIds: string[];
  transaction?: Transaction;
}): Promise<void> => {
  if (input.volumeIds.length === 0) return;

  await sequelize.query(
    `
      UPDATE ec2_volume_inventory_snapshots
      SET is_current = false,
          updated_at = NOW()
      WHERE cloud_connection_id = $1
        AND is_current = true
        AND volume_id = ANY($2::text[]);
    `,
    {
      bind: [input.cloudConnectionId, input.volumeIds],
      type: QueryTypes.UPDATE,
      transaction: input.transaction,
    },
  );
};

const insertSnapshots = async (rows: SnapshotRowInput[], transaction?: Transaction): Promise<number> => {
  if (rows.length === 0) return 0;
  await Ec2InstanceInventorySnapshot.bulkCreate(rows, {
    validate: false,
    transaction,
  });
  return rows.length;
};

const insertVolumeSnapshots = async (rows: VolumeSnapshotRowInput[], transaction?: Transaction): Promise<number> => {
  if (rows.length === 0) return 0;
  await Ec2VolumeInventorySnapshot.bulkCreate(rows, {
    validate: false,
    transaction,
  });
  return rows.length;
};

export async function syncEc2InventoryForScheduledJob(job: ScheduledJob): Promise<void> {
  const startedAt = Date.now();
  const discoveredAt = new Date();

  const context = await resolveAwsConnectionContextForJob(job);

  logger.info("EC2 inventory sync started", {
    jobId: String(job.id),
    connectionId: context.connectionId,
    tenantId: context.tenantId,
    providerId: context.providerId,
  });

  const credentials = await assumeRole(context.actionRoleArn, context.externalId);

  const regionDiscoveryClient = buildEc2Client(context.defaultRegion, credentials);
  const allRegions = await listRegions(regionDiscoveryClient);
  const enabledRegions = allRegions.filter((region) => isRegionEnabled(region.optInStatus));

  logger.info("EC2 inventory sync regions discovered", {
    connectionId: context.connectionId,
    totalRegions: allRegions.length,
    enabledRegions: enabledRegions.length,
  });

  let totalInstances = 0;
  let totalInserted = 0;
  let totalVolumes = 0;
  let totalVolumesInserted = 0;
  const dimensionCache = createInventoryDimensionCache();

  for (const region of enabledRegions) {
    const regionName = region.region;
    try {
      const regionClient = buildEc2Client(regionName, credentials);

      logger.info("EC2 inventory sync region scan started", {
        connectionId: context.connectionId,
        region: regionName,
      });

      const instances = await listInstancesInRegion(regionClient);
      totalInstances += instances.length;

      const snapshotRows: SnapshotRowInput[] = [];
      for (const instance of instances) {
        try {
          snapshotRows.push(
            toSnapshotRow({
              context,
              instance,
              region: regionName,
              discoveredAt,
            }),
          );
        } catch (error) {
          logger.warn("EC2 inventory sync skipped instance due to mapping error", {
            connectionId: context.connectionId,
            region: regionName,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const instanceIds = snapshotRows.map((row) => row.instanceId);
      await enrichSnapshotsWithDimensionKeys({
        rows: snapshotRows,
        context,
        cache: dimensionCache,
        region: regionName,
      });

      const insertedForRegion = await sequelize.transaction(async (transaction) => {
        await markOlderSnapshotsNotCurrent({
          cloudConnectionId: context.connectionId,
          instanceIds,
          transaction,
        });
        return insertSnapshots(snapshotRows, transaction);
      });

      totalInserted += insertedForRegion;

      logger.info("EC2 inventory sync region scan completed", {
        connectionId: context.connectionId,
        region: regionName,
        instancesDiscovered: instances.length,
        snapshotsInserted: insertedForRegion,
      });

      try {
        logger.info("EC2 volume inventory sync region scan started", {
          connectionId: context.connectionId,
          region: regionName,
        });

        const volumes = await listVolumesInRegion(regionClient);
        totalVolumes += volumes.length;

        const volumeSnapshotRows: VolumeSnapshotRowInput[] = [];
        for (const volume of volumes) {
          try {
            volumeSnapshotRows.push(
              toVolumeSnapshotRow({
                context,
                volume,
                region: regionName,
                discoveredAt,
              }),
            );
          } catch (error) {
            logger.warn("EC2 volume inventory sync skipped volume due to mapping error", {
              connectionId: context.connectionId,
              region: regionName,
              reason: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const volumeIds = volumeSnapshotRows.map((row) => row.volumeId);
        await enrichVolumeSnapshotsWithDimensionKeys({
          rows: volumeSnapshotRows,
          context,
          cache: dimensionCache,
          region: regionName,
        });

        const insertedVolumeForRegion = await sequelize.transaction(async (transaction) => {
          await markOlderVolumeSnapshotsNotCurrent({
            cloudConnectionId: context.connectionId,
            volumeIds,
            transaction,
          });
          return insertVolumeSnapshots(volumeSnapshotRows, transaction);
        });

        totalVolumesInserted += insertedVolumeForRegion;

        logger.info("EC2 volume inventory sync region scan completed", {
          connectionId: context.connectionId,
          region: regionName,
          volumesDiscovered: volumes.length,
          snapshotsInserted: insertedVolumeForRegion,
        });
      } catch (error) {
        logger.warn("EC2 volume inventory sync region scan failed", {
          connectionId: context.connectionId,
          region: regionName,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      logger.warn("EC2 inventory sync region scan failed", {
        connectionId: context.connectionId,
        region: regionName,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("EC2 inventory sync completed", {
    jobId: String(job.id),
    connectionId: context.connectionId,
    totalInstances,
    totalInserted,
    totalVolumes,
    totalVolumesInserted,
    durationMs: Date.now() - startedAt,
  });
}
