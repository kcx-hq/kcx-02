import { DescribeInstancesCommand, DescribeRegionsCommand, EC2Client, type Instance, type Tag } from "@aws-sdk/client-ec2";
import { QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";

import env from "../../../../config/env.js";
import { CloudConnectionV2, Ec2InstanceInventorySnapshot, sequelize } from "../../../../models/index.js";
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

const normalizeTrim = (value: string | null | undefined): string => String(value ?? "").trim();

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

const insertSnapshots = async (rows: SnapshotRowInput[], transaction?: Transaction): Promise<number> => {
  if (rows.length === 0) return 0;
  await Ec2InstanceInventorySnapshot.bulkCreate(rows, {
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
    durationMs: Date.now() - startedAt,
  });
}
