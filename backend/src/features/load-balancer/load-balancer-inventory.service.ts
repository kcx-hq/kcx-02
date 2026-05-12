import {
  DescribeListenersCommand,
  DescribeLoadBalancersCommand,
  DescribeTagsCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
  ElasticLoadBalancingV2Client,
  type Listener,
  type LoadBalancer as AwsLoadBalancer,
  type TargetGroup,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { DescribeRegionsCommand, EC2Client } from "@aws-sdk/client-ec2";

import env from "../../config/env.js";
import { CloudConnectionV2 } from "../../models/index.js";
import { logger } from "../../utils/logger.js";
import { assumeRole } from "../cloud-connections/aws/infrastructure/aws-sts.service.js";
import type { ScheduledJob } from "../../models/ec2/scheduled_jobs.js";
import { LoadBalancerInventoryRepository } from "./load-balancer-inventory.repository.js";
import type {
  AwsConnectionContext,
  LoadBalancerInventoryRow,
  LoadBalancerListenerInventoryRow,
  LoadBalancerTargetGroupInventoryRow,
  RegionInfo,
  TargetHealthSummary,
} from "./load-balancer-inventory.types.js";

const normalizeTrim = (value: string | null | undefined): string => String(value ?? "").trim();
const dedupe = <T>(values: T[]): T[] => Array.from(new Set(values));
const chunk = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const isRegionEnabled = (optInStatus: string | null): boolean => {
  if (!optInStatus) return true;
  return optInStatus === "opt-in-not-required" || optInStatus === "opted-in";
};

const isAlbOrNlb = (lb: AwsLoadBalancer): lb is AwsLoadBalancer & { Type: "application" | "network" } =>
  lb.Type === "application" || lb.Type === "network";

const buildElbClient = (
  region: string,
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string },
): ElasticLoadBalancingV2Client =>
  new ElasticLoadBalancingV2Client({
    region,
    credentials,
  });

const buildEc2Client = (
  region: string,
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string },
): EC2Client =>
  new EC2Client({
    region,
    credentials,
  });

const listRegions = async (client: EC2Client): Promise<RegionInfo[]> => {
  const response = await client.send(new DescribeRegionsCommand({ AllRegions: true }));
  return (response.Regions ?? [])
    .map((r) => ({
      region: normalizeTrim(r.RegionName),
      optInStatus: r.OptInStatus ? String(r.OptInStatus) : null,
    }))
    .filter((r) => Boolean(r.region));
};

const listLoadBalancersInRegion = async (client: ElasticLoadBalancingV2Client): Promise<AwsLoadBalancer[]> => {
  const rows: AwsLoadBalancer[] = [];
  let marker: string | undefined;

  do {
    const response = await client.send(new DescribeLoadBalancersCommand({ Marker: marker }));
    rows.push(...(response.LoadBalancers ?? []));
    marker = response.NextMarker;
  } while (marker);

  return rows.filter(isAlbOrNlb);
};

const listTargetGroupsForLoadBalancer = async (
  client: ElasticLoadBalancingV2Client,
  loadBalancerArn: string,
): Promise<TargetGroup[]> => {
  const rows: TargetGroup[] = [];
  let marker: string | undefined;

  do {
    const response = await client.send(
      new DescribeTargetGroupsCommand({
        LoadBalancerArn: loadBalancerArn,
        Marker: marker,
      }),
    );
    rows.push(...(response.TargetGroups ?? []));
    marker = response.NextMarker;
  } while (marker);

  return rows;
};

const listListenersForLoadBalancer = async (
  client: ElasticLoadBalancingV2Client,
  loadBalancerArn: string,
): Promise<Listener[]> => {
  const rows: Listener[] = [];
  let marker: string | undefined;

  do {
    const response = await client.send(
      new DescribeListenersCommand({
        LoadBalancerArn: loadBalancerArn,
        Marker: marker,
      }),
    );
    rows.push(...(response.Listeners ?? []));
    marker = response.NextMarker;
  } while (marker);

  return rows;
};

const listTagsByArn = async (
  client: ElasticLoadBalancingV2Client,
  arns: string[],
): Promise<Map<string, Record<string, string>>> => {
  const out = new Map<string, Record<string, string>>();
  const cleanArns = dedupe(arns.map((arn) => normalizeTrim(arn)).filter(Boolean));

  for (const batch of chunk(cleanArns, 20)) {
    const response = await client.send(new DescribeTagsCommand({ ResourceArns: batch }));
    for (const description of response.TagDescriptions ?? []) {
      const arn = normalizeTrim(description.ResourceArn);
      if (!arn) continue;
      const tags: Record<string, string> = {};
      for (const tag of description.Tags ?? []) {
        const key = normalizeTrim(tag.Key);
        if (!key) continue;
        tags[key] = normalizeTrim(tag.Value);
      }
      out.set(arn, Object.keys(tags).length > 0 ? tags : {});
    }
  }

  return out;
};

const loadTargetHealthSummary = async (
  client: ElasticLoadBalancingV2Client,
  targetGroupArn: string,
): Promise<TargetHealthSummary> => {
  const response = await client.send(new DescribeTargetHealthCommand({ TargetGroupArn: targetGroupArn }));

  let healthy = 0;
  let unhealthy = 0;

  for (const description of response.TargetHealthDescriptions ?? []) {
    const state = normalizeTrim(description.TargetHealth?.State);
    if (state === "healthy") healthy += 1;
    if (state === "unhealthy") unhealthy += 1;
  }

  return { healthyTargetCount: healthy, unhealthyTargetCount: unhealthy };
};

const resolveAwsConnectionContextForJob = async (job: ScheduledJob): Promise<AwsConnectionContext> => {
  const connectionId = normalizeTrim(job.cloudConnectionId ? String(job.cloudConnectionId) : "");
  if (!connectionId) throw new Error("scheduled job missing cloud_connection_id");

  const tenantId = normalizeTrim(job.tenantId ? String(job.tenantId) : "") || null;

  const connection = await CloudConnectionV2.findOne({
    where: {
      id: connectionId,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  if (!connection) throw new Error(`cloud connection not found for scheduled job: ${connectionId}`);

  const roleArn = normalizeTrim(connection.actionRoleArn) || normalizeTrim(connection.billingRoleArn);
  if (!roleArn) throw new Error(`cloud connection missing action_role_arn (or billing_role_arn fallback): ${connectionId}`);

  const accountId =
    normalizeTrim(connection.cloudAccountId) ||
    normalizeTrim(connection.payerAccountId) ||
    ((roleArn.match(/::(\d{12}):/) ?? [])[1] ?? "");

  if (!accountId) {
    throw new Error(`unable to resolve account id for cloud connection: ${connectionId}`);
  }

  return {
    tenantId: tenantId ?? (connection.tenantId ? String(connection.tenantId) : null),
    providerId: job.providerId ? String(job.providerId) : connection.providerId ? String(connection.providerId) : null,
    connectionId: String(connection.id),
    actionRoleArn: roleArn,
    externalId: connection.externalId ? String(connection.externalId) : null,
    defaultRegion: normalizeTrim(connection.region) || env.awsRegion,
    accountId,
  };
};

const normalizeLoadBalancer = (input: {
  row: AwsLoadBalancer & { Type: "application" | "network" };
  context: AwsConnectionContext;
  region: string;
  listenerCount: number;
  targetGroupCount: number;
  tags: Record<string, string> | undefined;
  discoveredAt: Date;
}): LoadBalancerInventoryRow => ({
  cloudConnectionId: input.context.connectionId,
  accountId: input.context.accountId,
  region: input.region,
  arn: normalizeTrim(input.row.LoadBalancerArn),
  name: normalizeTrim(input.row.LoadBalancerName) || null,
  type: input.row.Type,
  scheme: normalizeTrim(input.row.Scheme) || null,
  state: normalizeTrim(input.row.State?.Code) || null,
  vpcId: normalizeTrim(input.row.VpcId) || null,
  dnsName: normalizeTrim(input.row.DNSName) || null,
  createdAtAws: input.row.CreatedTime ?? null,
  securityGroups: (input.row.SecurityGroups ?? []).map((group) => normalizeTrim(group)).filter(Boolean),
  availabilityZones: (input.row.AvailabilityZones ?? []).map((az) => ({
    zoneName: normalizeTrim(az.ZoneName) || null,
    subnetId: normalizeTrim(az.SubnetId) || null,
    outpostId: normalizeTrim(az.OutpostId) || null,
  })),
  tags: input.tags && Object.keys(input.tags).length > 0 ? input.tags : null,
  listenerCount: input.listenerCount,
  targetGroupCount: input.targetGroupCount,
  lastSyncedAt: input.discoveredAt,
  createdAt: input.discoveredAt,
  updatedAt: input.discoveredAt,
});

const normalizeTargetGroup = (input: {
  row: TargetGroup;
  context: AwsConnectionContext;
  region: string;
  health: TargetHealthSummary;
  tags: Record<string, string> | undefined;
  discoveredAt: Date;
}): LoadBalancerTargetGroupInventoryRow | null => {
  const arn = normalizeTrim(input.row.TargetGroupArn);
  if (!arn) return null;

  const lbArn = normalizeTrim(input.row.LoadBalancerArns?.[0]) || null;

  return {
    cloudConnectionId: input.context.connectionId,
    accountId: input.context.accountId,
    region: input.region,
    arn,
    name: normalizeTrim(input.row.TargetGroupName) || null,
    loadBalancerArn: lbArn,
    protocol: normalizeTrim(input.row.Protocol) || null,
    port: typeof input.row.Port === "number" ? input.row.Port : null,
    targetType: normalizeTrim(input.row.TargetType) || null,
    vpcId: normalizeTrim(input.row.VpcId) || null,
    healthCheckProtocol: normalizeTrim(input.row.HealthCheckProtocol) || null,
    healthCheckPath: normalizeTrim(input.row.HealthCheckPath) || null,
    healthyTargetCount: input.health.healthyTargetCount,
    unhealthyTargetCount: input.health.unhealthyTargetCount,
    tags: input.tags && Object.keys(input.tags).length > 0 ? input.tags : null,
    lastSyncedAt: input.discoveredAt,
    createdAt: input.discoveredAt,
    updatedAt: input.discoveredAt,
  };
};

const normalizeListener = (input: {
  row: Listener;
  context: AwsConnectionContext;
  region: string;
  discoveredAt: Date;
}): LoadBalancerListenerInventoryRow | null => {
  const arn = normalizeTrim(input.row.ListenerArn);
  if (!arn) return null;

  return {
    cloudConnectionId: input.context.connectionId,
    accountId: input.context.accountId,
    region: input.region,
    arn,
    loadBalancerArn: normalizeTrim(input.row.LoadBalancerArn) || null,
    protocol: normalizeTrim(input.row.Protocol) || null,
    port: typeof input.row.Port === "number" ? input.row.Port : null,
    sslPolicy: normalizeTrim(input.row.SslPolicy) || null,
    certificates: (input.row.Certificates ?? []).map((certificate) => ({
      certificateArn: normalizeTrim(certificate.CertificateArn) || null,
      isDefault: typeof certificate.IsDefault === "boolean" ? certificate.IsDefault : null,
    })),
    defaultActions: (input.row.DefaultActions ?? []).map((action) => ({
      type: normalizeTrim(action.Type) || null,
      targetGroupArn: normalizeTrim(action.TargetGroupArn) || null,
      order: typeof action.Order === "number" ? action.Order : null,
      redirectConfig: action.RedirectConfig ?? null,
      fixedResponseConfig: action.FixedResponseConfig ?? null,
      forwardConfig: action.ForwardConfig ?? null,
      authenticateOidcConfig: action.AuthenticateOidcConfig ?? null,
      authenticateCognitoConfig: action.AuthenticateCognitoConfig ?? null,
    })),
    lastSyncedAt: input.discoveredAt,
    createdAt: input.discoveredAt,
    updatedAt: input.discoveredAt,
  };
};

export async function syncLoadBalancerInventoryForScheduledJob(job: ScheduledJob): Promise<void> {
  const startedAt = Date.now();
  const discoveredAt = new Date();
  const jobKey = "load-balancer-inventory-sync";

  try {
    const context = await resolveAwsConnectionContextForJob(job);
    const repository = new LoadBalancerInventoryRepository();

    logger.info("Load balancer inventory sync job started", {
      jobId: String(job.id),
      jobKey,
      cloudConnectionCount: 1,
      connectionId: context.connectionId,
      tenantId: context.tenantId,
      providerId: context.providerId,
    });

    const credentials = await assumeRole(context.actionRoleArn, context.externalId);
    const regionDiscoveryClient = buildEc2Client(context.defaultRegion, credentials);
    const allRegions = await listRegions(regionDiscoveryClient);
    const enabledRegions = allRegions.filter((region) => isRegionEnabled(region.optInStatus));

    let regionsProcessed = 0;
    let totalLoadBalancers = 0;
    let totalTargetGroups = 0;
    let totalListeners = 0;

    for (const region of enabledRegions) {
      const regionName = region.region;
      regionsProcessed += 1;

      try {
        const elbClient = buildElbClient(regionName, credentials);
        const loadBalancers = await listLoadBalancersInRegion(elbClient);
        totalLoadBalancers += loadBalancers.length;

        if (loadBalancers.length === 0) {
          continue;
        }

        const loadBalancerRows: LoadBalancerInventoryRow[] = [];
        const targetGroupRows: LoadBalancerTargetGroupInventoryRow[] = [];
        const listenerRows: LoadBalancerListenerInventoryRow[] = [];

        const lbArns = loadBalancers.map((lb) => normalizeTrim(lb.LoadBalancerArn)).filter(Boolean);
        const lbTagsByArn = await listTagsByArn(elbClient, lbArns);

        for (const lb of loadBalancers) {
          const lbArn = normalizeTrim(lb.LoadBalancerArn);
          if (!lbArn || !isAlbOrNlb(lb)) continue;

          const listeners = await listListenersForLoadBalancer(elbClient, lbArn);
          const targetGroups = await listTargetGroupsForLoadBalancer(elbClient, lbArn);

          totalListeners += listeners.length;
          totalTargetGroups += targetGroups.length;

          const tgArns = targetGroups.map((tg) => normalizeTrim(tg.TargetGroupArn)).filter(Boolean);
          const tgTagsByArn = await listTagsByArn(elbClient, tgArns);

          loadBalancerRows.push(
            normalizeLoadBalancer({
              row: lb,
              context,
              region: regionName,
              listenerCount: listeners.length,
              targetGroupCount: targetGroups.length,
              tags: lbTagsByArn.get(lbArn),
              discoveredAt,
            }),
          );

          for (const listener of listeners) {
            const normalized = normalizeListener({
              row: listener,
              context,
              region: regionName,
              discoveredAt,
            });
            if (normalized) listenerRows.push(normalized);
          }

          for (const targetGroup of targetGroups) {
            const targetGroupArn = normalizeTrim(targetGroup.TargetGroupArn);
            if (!targetGroupArn) continue;

            const health = await loadTargetHealthSummary(elbClient, targetGroupArn);
            const normalized = normalizeTargetGroup({
              row: targetGroup,
              context,
              region: regionName,
              health,
              tags: tgTagsByArn.get(targetGroupArn),
              discoveredAt,
            });
            if (normalized) targetGroupRows.push(normalized);
          }
        }

        await repository.upsertLoadBalancers(loadBalancerRows);
        await repository.upsertTargetGroups(targetGroupRows);
        await repository.upsertListeners(listenerRows);

        logger.info("Load balancer inventory sync region completed", {
          jobId: String(job.id),
          jobKey,
          connectionId: context.connectionId,
          region: regionName,
          loadBalancersSynced: loadBalancerRows.length,
          targetGroupsSynced: targetGroupRows.length,
          listenersSynced: listenerRows.length,
        });
      } catch (error) {
        logger.warn("Load balancer inventory sync region failed", {
          jobId: String(job.id),
          jobKey,
          connectionId: context.connectionId,
          region: regionName,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("Load balancer inventory sync job completed", {
      jobId: String(job.id),
      jobKey,
      cloudConnectionCount: 1,
      connectionId: context.connectionId,
      regionsProcessed,
      loadBalancersSynced: totalLoadBalancers,
      targetGroupsSynced: totalTargetGroups,
      listenersSynced: totalListeners,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error("Load balancer inventory sync job failed", {
      jobId: String(job.id),
      jobKey,
      reason: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}
