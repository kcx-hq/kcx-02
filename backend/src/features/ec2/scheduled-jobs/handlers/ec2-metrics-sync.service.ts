import {
  CloudWatchClient,
  GetMetricDataCommand,
  type MetricDataQuery,
  type MetricDataResult,
  type MetricStat,
} from "@aws-sdk/client-cloudwatch";
import { DescribeInstancesCommand, DescribeRegionsCommand, EC2Client, type Instance } from "@aws-sdk/client-ec2";

import env from "../../../../config/env.js";
import { CloudConnectionV2, Ec2InstanceInventorySnapshot } from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";
import { assumeRole } from "../../../cloud-connections/aws/infrastructure/aws-sts.service.js";
import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { Ec2InstanceUtilizationHourlyRepository } from "./ec2-instance-utilization-hourly.repository.js";
import type { HourlyMetricAggregation, InstanceRegionInventory, UtilizationHourlyRow } from "./ec2-metrics-sync.types.js";

type AwsConnectionContext = {
  tenantId: string | null;
  providerId: string | null;
  connectionId: string;
  actionRoleArn: string;
  externalId: string | null;
  defaultRegion: string;
};

type InstanceDimensionKeys = {
  resourceKey: string | null;
  regionKey: string | null;
  subAccountKey: string | null;
};

type RegionInfo = {
  region: string;
  optInStatus: string | null;
};

type MetricField =
  | "cpuAvg"
  | "cpuMax"
  | "cpuMin"
  | "networkInBytes"
  | "networkOutBytes"
  | "networkPacketsIn"
  | "networkPacketsOut"
  | "diskReadBytes"
  | "diskWriteBytes"
  | "diskReadOps"
  | "diskWriteOps"
  | "statusCheckFailedMax"
  | "statusCheckFailedInstanceMax"
  | "statusCheckFailedSystemMax"
  | "ebsReadBytes"
  | "ebsWriteBytes"
  | "ebsReadOps"
  | "ebsWriteOps"
  | "ebsQueueLengthMax"
  | "ebsIdleTimeAvg"
  | "ebsBurstBalanceAvg";

type QueryTarget =
  | { targetType: "instance"; instanceId: string; field: MetricField; agg: HourlyMetricAggregation }
  | { targetType: "volume"; volumeId: string; field: MetricField; agg: HourlyMetricAggregation };

type MetricValueByHour = Map<string, number[]>;

const DEFAULT_LOOKBACK_HOURS = 24;
const PERIOD_SECONDS = 3600;
const CW_MAX_QUERIES = 500;
const CW_TARGET_QUERIES = 450;

const normalizeTrim = (value: string | null | undefined): string => String(value ?? "").trim();

const floorToUtcHour = (date: Date): Date => {
  const copy = new Date(date.getTime());
  copy.setUTCMinutes(0, 0, 0);
  return copy;
};

const formatUsageDateUtc = (hourStart: Date): string => hourStart.toISOString().slice(0, 10);

const chunk = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

const dedupe = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const isRegionEnabled = (optInStatus: string | null): boolean => {
  if (!optInStatus) return true;
  return optInStatus === "opt-in-not-required" || optInStatus === "opted-in";
};

const buildEc2Client = (
  region: string,
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string },
): EC2Client =>
  new EC2Client({
    region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });

const buildCloudWatchClient = (
  region: string,
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string },
): CloudWatchClient =>
  new CloudWatchClient({
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

const extractRegionFromAz = (availabilityZone: string | null): string | null => {
  const az = normalizeTrim(availabilityZone ?? "");
  if (!az || az.length < 2) return null;
  return az.slice(0, -1);
};

const loadInventoryInstancesByRegion = async (context: AwsConnectionContext): Promise<InstanceRegionInventory[]> => {
  const rows = await Ec2InstanceInventorySnapshot.findAll({
    where: {
      cloudConnectionId: context.connectionId,
      isCurrent: true,
      deletedAt: null,
    },
    attributes: ["instanceId", "availabilityZone", "metadataJson"],
  });

  const regionToInstances = new Map<string, Set<string>>();
  for (const row of rows) {
    const instanceId = normalizeTrim(String(row.instanceId));
    if (!instanceId) continue;

    const metadata = row.metadataJson as Record<string, unknown> | null;
    const regionFromMetadata = metadata && typeof metadata.awsRegion === "string" ? normalizeTrim(metadata.awsRegion) : "";
    const region = regionFromMetadata || extractRegionFromAz(row.availabilityZone ? String(row.availabilityZone) : null) || context.defaultRegion;

    if (!regionToInstances.has(region)) {
      regionToInstances.set(region, new Set());
    }
    regionToInstances.get(region)?.add(instanceId);
  }

  return Array.from(regionToInstances.entries()).map(([region, ids]) => ({
    region,
    instanceIds: Array.from(ids),
  }));
};

const loadLatestDimensionKeysForInstances = async (input: {
  cloudConnectionId: string;
  instanceIds: string[];
}): Promise<Map<string, InstanceDimensionKeys>> => {
  const ids = dedupe(input.instanceIds.map((id) => normalizeTrim(id)));
  if (ids.length === 0) return new Map();

  const rows = await Ec2InstanceInventorySnapshot.findAll({
    where: {
      cloudConnectionId: input.cloudConnectionId,
      instanceId: ids,
      deletedAt: null,
    },
    attributes: ["instanceId", "resourceKey", "regionKey", "subAccountKey", "isCurrent", "discoveredAt", "updatedAt"],
    order: [
      ["instanceId", "ASC"],
      ["isCurrent", "DESC"],
      ["discoveredAt", "DESC"],
      ["updatedAt", "DESC"],
    ],
  });

  const out = new Map<string, InstanceDimensionKeys>();
  for (const row of rows) {
    const instanceId = normalizeTrim(String(row.instanceId));
    if (!instanceId || out.has(instanceId)) continue;
    out.set(instanceId, {
      resourceKey: row.resourceKey ? String(row.resourceKey) : null,
      regionKey: row.regionKey ? String(row.regionKey) : null,
      subAccountKey: row.subAccountKey ? String(row.subAccountKey) : null,
    });
  }

  return out;
};

const listInstancesInRegion = async (client: EC2Client): Promise<string[]> => {
  const instanceIds: string[] = [];
  let nextToken: string | undefined;

  do {
    const response = await client.send(new DescribeInstancesCommand({ NextToken: nextToken }));
    for (const reservation of response.Reservations ?? []) {
      for (const instance of reservation.Instances ?? []) {
        const id = normalizeTrim(instance.InstanceId);
        if (id) instanceIds.push(id);
      }
    }
    nextToken = response.NextToken;
  } while (nextToken);

  return dedupe(instanceIds);
};

const discoverInstancesByRegion = async (
  context: AwsConnectionContext,
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string },
): Promise<InstanceRegionInventory[]> => {
  const discoveryClient = buildEc2Client(context.defaultRegion, credentials);
  const regions = await listRegions(discoveryClient);
  const enabled = regions.filter((r) => isRegionEnabled(r.optInStatus));

  const out: InstanceRegionInventory[] = [];
  for (const region of enabled) {
    try {
      const ec2 = buildEc2Client(region.region, credentials);
      const ids = await listInstancesInRegion(ec2);
      if (ids.length > 0) {
        out.push({ region: region.region, instanceIds: ids });
      }
    } catch (error) {
      logger.warn("EC2 metrics sync instance discovery failed for region", {
        connectionId: context.connectionId,
        region: region.region,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return out;
};

const describeInstancesVolumeMap = async (input: { client: EC2Client; instanceIds: string[] }): Promise<Map<string, string[]>> => {
  const map = new Map<string, string[]>();
  const batches = chunk(input.instanceIds, 100);

  for (const batch of batches) {
    const response = await input.client.send(new DescribeInstancesCommand({ InstanceIds: batch }));

    const instances: Instance[] = [];
    for (const reservation of response.Reservations ?? []) {
      for (const instance of reservation.Instances ?? []) {
        if (instance.InstanceId) instances.push(instance);
      }
    }

    for (const instance of instances) {
      const instanceId = normalizeTrim(instance.InstanceId);
      if (!instanceId) continue;

      const volumeIds: string[] = [];
      for (const mapping of instance.BlockDeviceMappings ?? []) {
        const volumeId = normalizeTrim(mapping.Ebs?.VolumeId);
        if (volumeId) volumeIds.push(volumeId);
      }

      map.set(instanceId, dedupe(volumeIds));
    }
  }

  return map;
};

const toMetricStat = (input: {
  namespace: string;
  metricName: string;
  dimensions: { Name: string; Value: string }[];
  stat: string;
}): MetricStat => ({
  Metric: {
    Namespace: input.namespace,
    MetricName: input.metricName,
    Dimensions: input.dimensions,
  },
  Period: PERIOD_SECONDS,
  Stat: input.stat,
});

const makeQueryId = (prefix: string, index: number): string => `${prefix}${index}`; // must start with letter

const fetchMetricDataAll = async (input: {
  client: CloudWatchClient;
  startTime: Date;
  endTime: Date;
  queries: MetricDataQuery[];
}): Promise<MetricDataResult[]> => {
  const results: MetricDataResult[] = [];
  let nextToken: string | undefined;

  do {
    const response = await input.client.send(
      new GetMetricDataCommand({
        StartTime: input.startTime,
        EndTime: input.endTime,
        MetricDataQueries: input.queries,
        ScanBy: "TimestampAscending",
        ...(nextToken ? { NextToken: nextToken } : {}),
      }),
    );

    results.push(...(response.MetricDataResults ?? []));
    nextToken = typeof response.NextToken === "string" && response.NextToken.trim() ? response.NextToken : undefined;
  } while (nextToken);

  return results;
};

const toHourStartIsoForDatapoint = (timestamp: Date): string => {
  const shifted = new Date(timestamp.getTime() - PERIOD_SECONDS * 1000);
  return floorToUtcHour(shifted).toISOString();
};

const recordPointsByHour = (target: MetricValueByHour, timestamps: Date[] | undefined, values: number[] | undefined): void => {
  if (!timestamps || !values || timestamps.length === 0 || values.length === 0) return;
  const count = Math.min(timestamps.length, values.length);
  for (let i = 0; i < count; i += 1) {
    const ts = timestamps[i];
    const value = values[i];
    if (!(ts instanceof Date) || !Number.isFinite(value)) continue;
    const hourIso = toHourStartIsoForDatapoint(ts);
    if (!target.has(hourIso)) target.set(hourIso, []);
    target.get(hourIso)?.push(value);
  }
};

const aggregateValues = (values: number[], agg: HourlyMetricAggregation): number | null => {
  if (!values || values.length === 0) return null;
  if (agg === "sum") return values.reduce((acc, v) => acc + v, 0);
  if (agg === "max") return values.reduce((acc, v) => (v > acc ? v : acc), values[0]);
  if (agg === "min") return values.reduce((acc, v) => (v < acc ? v : acc), values[0]);
  return values.reduce((acc, v) => acc + v, 0) / values.length;
};

const formatDecimal = (value: number | null, scale: number): string | null => {
  if (value === null || !Number.isFinite(value)) return null;
  return value.toFixed(scale);
};

const formatBigIntLike = (value: number | null): string | null => {
  if (value === null || !Number.isFinite(value)) return null;
  return String(Math.round(value));
};

const mergeMetricField = (row: Partial<UtilizationHourlyRow>, field: MetricField, value: number | null): void => {
  switch (field) {
    case "cpuAvg":
    case "cpuMax":
    case "cpuMin":
    case "statusCheckFailedMax":
    case "statusCheckFailedInstanceMax":
    case "statusCheckFailedSystemMax":
    case "ebsQueueLengthMax":
    case "ebsIdleTimeAvg":
    case "ebsBurstBalanceAvg":
      row[field] = formatDecimal(value, 4);
      return;
    default:
      row[field] = formatBigIntLike(value);
  }
};

const buildEc2MetricQueries = (instances: string[]): { queries: MetricDataQuery[]; targets: Map<string, QueryTarget> } => {
  const queries: MetricDataQuery[] = [];
  const targets = new Map<string, QueryTarget>();

  const add = (input: {
    instanceId: string;
    metricName: string;
    field: MetricField;
    stat: "Average" | "Maximum" | "Minimum" | "Sum";
    agg: HourlyMetricAggregation;
  }) => {
    const id = makeQueryId("m", queries.length + 1);
    const query: MetricDataQuery = {
      Id: id,
      MetricStat: toMetricStat({
        namespace: "AWS/EC2",
        metricName: input.metricName,
        dimensions: [{ Name: "InstanceId", Value: input.instanceId }],
        stat: input.stat,
      }),
      ReturnData: true,
    };
    queries.push(query);
    targets.set(id, { targetType: "instance", instanceId: input.instanceId, field: input.field, agg: input.agg });
  };

  for (const instanceId of instances) {
    add({ instanceId, metricName: "CPUUtilization", field: "cpuAvg", stat: "Average", agg: "avg" });
    add({ instanceId, metricName: "CPUUtilization", field: "cpuMax", stat: "Maximum", agg: "max" });
    add({ instanceId, metricName: "CPUUtilization", field: "cpuMin", stat: "Minimum", agg: "min" });

    add({ instanceId, metricName: "NetworkIn", field: "networkInBytes", stat: "Sum", agg: "sum" });
    add({ instanceId, metricName: "NetworkOut", field: "networkOutBytes", stat: "Sum", agg: "sum" });
    add({ instanceId, metricName: "NetworkPacketsIn", field: "networkPacketsIn", stat: "Sum", agg: "sum" });
    add({ instanceId, metricName: "NetworkPacketsOut", field: "networkPacketsOut", stat: "Sum", agg: "sum" });

    add({ instanceId, metricName: "DiskReadBytes", field: "diskReadBytes", stat: "Sum", agg: "sum" });
    add({ instanceId, metricName: "DiskWriteBytes", field: "diskWriteBytes", stat: "Sum", agg: "sum" });
    add({ instanceId, metricName: "DiskReadOps", field: "diskReadOps", stat: "Sum", agg: "sum" });
    add({ instanceId, metricName: "DiskWriteOps", field: "diskWriteOps", stat: "Sum", agg: "sum" });

    add({ instanceId, metricName: "StatusCheckFailed", field: "statusCheckFailedMax", stat: "Maximum", agg: "max" });
    add({
      instanceId,
      metricName: "StatusCheckFailed_Instance",
      field: "statusCheckFailedInstanceMax",
      stat: "Maximum",
      agg: "max",
    });
    add({
      instanceId,
      metricName: "StatusCheckFailed_System",
      field: "statusCheckFailedSystemMax",
      stat: "Maximum",
      agg: "max",
    });
  }

  return { queries, targets };
};

const buildEbsMetricQueries = (volumeIds: string[]): { queries: MetricDataQuery[]; targets: Map<string, QueryTarget> } => {
  const queries: MetricDataQuery[] = [];
  const targets = new Map<string, QueryTarget>();

  const add = (input: {
    volumeId: string;
    metricName: string;
    field: MetricField;
    stat: "Average" | "Maximum" | "Sum";
    agg: HourlyMetricAggregation;
  }) => {
    const id = makeQueryId("v", queries.length + 1);
    const query: MetricDataQuery = {
      Id: id,
      MetricStat: toMetricStat({
        namespace: "AWS/EBS",
        metricName: input.metricName,
        dimensions: [{ Name: "VolumeId", Value: input.volumeId }],
        stat: input.stat,
      }),
      ReturnData: true,
    };
    queries.push(query);
    targets.set(id, { targetType: "volume", volumeId: input.volumeId, field: input.field, agg: input.agg });
  };

  for (const volumeId of volumeIds) {
    add({ volumeId, metricName: "VolumeReadBytes", field: "ebsReadBytes", stat: "Sum", agg: "sum" });
    add({ volumeId, metricName: "VolumeWriteBytes", field: "ebsWriteBytes", stat: "Sum", agg: "sum" });
    add({ volumeId, metricName: "VolumeReadOps", field: "ebsReadOps", stat: "Sum", agg: "sum" });
    add({ volumeId, metricName: "VolumeWriteOps", field: "ebsWriteOps", stat: "Sum", agg: "sum" });
    add({ volumeId, metricName: "VolumeQueueLength", field: "ebsQueueLengthMax", stat: "Maximum", agg: "max" });
    add({ volumeId, metricName: "VolumeIdleTime", field: "ebsIdleTimeAvg", stat: "Average", agg: "avg" });
    add({ volumeId, metricName: "BurstBalance", field: "ebsBurstBalanceAvg", stat: "Average", agg: "avg" });
  }

  return { queries, targets };
};

const splitQueriesByLimit = (queries: MetricDataQuery[], limit: number): MetricDataQuery[][] =>
  queries.length <= limit ? [queries] : chunk(queries, limit);

const mergeInstanceHourMaps = (
  base: Map<string, Map<string, Partial<Record<MetricField, number>>>>,
  extra: Map<string, Map<string, Partial<Record<MetricField, number>>>>,
): void => {
  for (const [id, hourMap] of extra.entries()) {
    if (!base.has(id)) base.set(id, new Map());
    const baseHourMap = base.get(id) as Map<string, Partial<Record<MetricField, number>>>;
    for (const [hourIso, metrics] of hourMap.entries()) {
      if (!baseHourMap.has(hourIso)) baseHourMap.set(hourIso, {});
      const baseMetrics = baseHourMap.get(hourIso) as Partial<Record<MetricField, number>>;
      for (const [field, value] of Object.entries(metrics) as [MetricField, number][]) {
        baseMetrics[field] = value;
      }
    }
  }
};

const applyCloudWatchResultsToInstanceRows = (input: {
  results: MetricDataResult[];
  targetsById: Map<string, QueryTarget>;
  allowedHourIsos?: Set<string>;
}): Map<string, Map<string, Partial<Record<MetricField, number>>>> => {
  const out = new Map<string, Map<string, Partial<Record<MetricField, number>>>>();

  const ensure = (instanceId: string, hourIso: string): Partial<Record<MetricField, number>> => {
    if (!out.has(instanceId)) out.set(instanceId, new Map());
    const hourMap = out.get(instanceId) as Map<string, Partial<Record<MetricField, number>>>;
    if (!hourMap.has(hourIso)) hourMap.set(hourIso, {});
    return hourMap.get(hourIso) as Partial<Record<MetricField, number>>;
  };

  for (const result of input.results) {
    const id = normalizeTrim(result.Id);
    if (!id) continue;
    const target = input.targetsById.get(id);
    if (!target || target.targetType !== "instance") continue;

    const byHour: MetricValueByHour = new Map();
    recordPointsByHour(byHour, result.Timestamps, result.Values);

    for (const [hourIso, values] of byHour.entries()) {
      if (input.allowedHourIsos && !input.allowedHourIsos.has(hourIso)) continue;
      const aggregated = aggregateValues(values, target.agg);
      if (aggregated === null) continue;
      const row = ensure(target.instanceId, hourIso);
      row[target.field] = aggregated;
    }
  }

  return out;
};

const applyCloudWatchResultsToVolumeRows = (input: {
  results: MetricDataResult[];
  targetsById: Map<string, QueryTarget>;
  allowedHourIsos?: Set<string>;
}): Map<string, Map<string, Partial<Record<MetricField, number>>>> => {
  const out = new Map<string, Map<string, Partial<Record<MetricField, number>>>>();

  const ensure = (volumeId: string, hourIso: string): Partial<Record<MetricField, number>> => {
    if (!out.has(volumeId)) out.set(volumeId, new Map());
    const hourMap = out.get(volumeId) as Map<string, Partial<Record<MetricField, number>>>;
    if (!hourMap.has(hourIso)) hourMap.set(hourIso, {});
    return hourMap.get(hourIso) as Partial<Record<MetricField, number>>;
  };

  for (const result of input.results) {
    const id = normalizeTrim(result.Id);
    if (!id) continue;
    const target = input.targetsById.get(id);
    if (!target || target.targetType !== "volume") continue;

    const byHour: MetricValueByHour = new Map();
    recordPointsByHour(byHour, result.Timestamps, result.Values);

    for (const [hourIso, values] of byHour.entries()) {
      if (input.allowedHourIsos && !input.allowedHourIsos.has(hourIso)) continue;
      const aggregated = aggregateValues(values, target.agg);
      if (aggregated === null) continue;
      const row = ensure(target.volumeId, hourIso);
      row[target.field] = aggregated;
    }
  }

  return out;
};

const rollupEbsToInstances = (input: {
  instanceToVolumes: Map<string, string[]>;
  volumeMetrics: Map<string, Map<string, Partial<Record<MetricField, number>>>>;
}): Map<string, Map<string, Partial<Record<MetricField, number>>>> => {
  const out = new Map<string, Map<string, Partial<Record<MetricField, number>>>>();

  const ensure = (instanceId: string, hourIso: string): Partial<Record<MetricField, number>> => {
    if (!out.has(instanceId)) out.set(instanceId, new Map());
    const hourMap = out.get(instanceId) as Map<string, Partial<Record<MetricField, number>>>;
    if (!hourMap.has(hourIso)) hourMap.set(hourIso, {});
    return hourMap.get(hourIso) as Partial<Record<MetricField, number>>;
  };

  const addSum = (obj: Partial<Record<MetricField, number>>, field: MetricField, value: number) => {
    obj[field] = (obj[field] ?? 0) + value;
  };
  const addMax = (obj: Partial<Record<MetricField, number>>, field: MetricField, value: number) => {
    const current = obj[field];
    obj[field] = typeof current === "number" ? Math.max(current, value) : value;
  };
  const addAvgSum = (
    obj: Partial<Record<MetricField, number>>,
    field: MetricField,
    value: number,
    counters: Record<string, number>,
  ) => {
    const key = `${String(field)}__count`;
    counters[key] = (counters[key] ?? 0) + 1;
    obj[field] = (obj[field] ?? 0) + value;
  };

  for (const [instanceId, volumes] of input.instanceToVolumes.entries()) {
    const countersByHour = new Map<string, Record<string, number>>();

    for (const volumeId of volumes) {
      const volumeHours = input.volumeMetrics.get(volumeId);
      if (!volumeHours) continue;

      for (const [hourIso, metrics] of volumeHours.entries()) {
        const row = ensure(instanceId, hourIso);
        if (!countersByHour.has(hourIso)) countersByHour.set(hourIso, {});
        const counters = countersByHour.get(hourIso) as Record<string, number>;

        if (typeof metrics.ebsReadBytes === "number") addSum(row, "ebsReadBytes", metrics.ebsReadBytes);
        if (typeof metrics.ebsWriteBytes === "number") addSum(row, "ebsWriteBytes", metrics.ebsWriteBytes);
        if (typeof metrics.ebsReadOps === "number") addSum(row, "ebsReadOps", metrics.ebsReadOps);
        if (typeof metrics.ebsWriteOps === "number") addSum(row, "ebsWriteOps", metrics.ebsWriteOps);
        if (typeof metrics.ebsQueueLengthMax === "number") addMax(row, "ebsQueueLengthMax", metrics.ebsQueueLengthMax);
        if (typeof metrics.ebsIdleTimeAvg === "number") addAvgSum(row, "ebsIdleTimeAvg", metrics.ebsIdleTimeAvg, counters);
        if (typeof metrics.ebsBurstBalanceAvg === "number") addAvgSum(row, "ebsBurstBalanceAvg", metrics.ebsBurstBalanceAvg, counters);
      }
    }

    for (const [hourIso, counters] of countersByHour.entries()) {
      const row = ensure(instanceId, hourIso);
      const idleCount = counters["ebsIdleTimeAvg__count"] ?? 0;
      if (idleCount > 0 && typeof row.ebsIdleTimeAvg === "number") {
        row.ebsIdleTimeAvg = row.ebsIdleTimeAvg / idleCount;
      }
      const burstCount = counters["ebsBurstBalanceAvg__count"] ?? 0;
      if (burstCount > 0 && typeof row.ebsBurstBalanceAvg === "number") {
        row.ebsBurstBalanceAvg = row.ebsBurstBalanceAvg / burstCount;
      }
    }
  }

  return out;
};

const buildUtilizationRows = (input: {
  context: AwsConnectionContext;
  instanceId: string;
  mergedByHour: Map<string, Partial<Record<MetricField, number>>>;
  dimensionKeys: InstanceDimensionKeys | null;
  now: Date;
}): UtilizationHourlyRow[] => {
  const rows: UtilizationHourlyRow[] = [];

  for (const [hourIso, metrics] of input.mergedByHour.entries()) {
    const hourStart = new Date(hourIso);
    if (Number.isNaN(hourStart.getTime())) continue;

    const row: Partial<UtilizationHourlyRow> = {
      tenantId: input.context.tenantId,
      cloudConnectionId: input.context.connectionId,
      providerId: input.context.providerId,
      instanceId: input.instanceId,
      hourStart,
      usageDate: formatUsageDateUtc(hourStart),
      resourceKey: input.dimensionKeys?.resourceKey ?? null,
      regionKey: input.dimensionKeys?.regionKey ?? null,
      subAccountKey: input.dimensionKeys?.subAccountKey ?? null,
      metricSource: "cloudwatch",
      sampleCount: 1,
      cpuAvg: null,
      cpuMax: null,
      cpuMin: null,
      networkInBytes: null,
      networkOutBytes: null,
      networkPacketsIn: null,
      networkPacketsOut: null,
      diskReadBytes: null,
      diskWriteBytes: null,
      diskReadOps: null,
      diskWriteOps: null,
      statusCheckFailedMax: null,
      statusCheckFailedInstanceMax: null,
      statusCheckFailedSystemMax: null,
      ebsReadBytes: null,
      ebsWriteBytes: null,
      ebsReadOps: null,
      ebsWriteOps: null,
      ebsQueueLengthMax: null,
      ebsIdleTimeAvg: null,
      ebsBurstBalanceAvg: null,
      createdAt: input.now,
      updatedAt: input.now,
    };

    for (const [field, value] of Object.entries(metrics) as [MetricField, number][]) {
      mergeMetricField(row, field, typeof value === "number" ? value : null);
    }

    rows.push(row as UtilizationHourlyRow);
  }

  return rows;
};

export async function syncEc2MetricsForScheduledJob(job: ScheduledJob): Promise<void> {
  const startedAt = Date.now();

  const lookbackHoursRaw = typeof job.lookbackHours === "number" ? job.lookbackHours : Number(job.lookbackHours);
  const lookbackHours =
    Number.isFinite(lookbackHoursRaw) && lookbackHoursRaw > 0
      ? Math.min(168, Math.trunc(lookbackHoursRaw))
      : DEFAULT_LOOKBACK_HOURS;

  const now = new Date();
  const endTime = floorToUtcHour(now); // end is exclusive; only completed hours will be represented.
  const startTime = new Date(endTime.getTime() - lookbackHours * 60 * 60 * 1000);
  const hourIsos: string[] = [];
  for (let i = 0; i < lookbackHours; i += 1) {
    const hourStart = new Date(startTime.getTime() + i * 60 * 60 * 1000);
    hourIsos.push(hourStart.toISOString());
  }
  const allowedHourIsos = new Set(hourIsos);

  const context = await resolveAwsConnectionContextForJob(job);

  logger.info("EC2 metrics sync started", {
    jobId: String(job.id),
    connectionId: context.connectionId,
    tenantId: context.tenantId,
    providerId: context.providerId,
    lookbackHours,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    windowHours: hourIsos.length,
  });

  const credentials = await assumeRole(context.actionRoleArn, context.externalId);

  let inventories = await loadInventoryInstancesByRegion(context);
  if (inventories.length === 0) {
    logger.warn("EC2 metrics sync inventory empty; falling back to live EC2 discovery", {
      connectionId: context.connectionId,
    });
    inventories = await discoverInstancesByRegion(context, credentials);
  }

  logger.info("EC2 metrics sync regions loaded", {
    connectionId: context.connectionId,
    regions: inventories.length,
    totalInstances: inventories.reduce((acc, r) => acc + r.instanceIds.length, 0),
  });

  const utilizationRepository = new Ec2InstanceUtilizationHourlyRepository();

  let totalUpserted = 0;
  let totalInstancesProcessed = 0;
  let regionCount = 0;

  for (const regionInventory of inventories) {
    const region = regionInventory.region;
    const instanceIds = dedupe(regionInventory.instanceIds);
    if (instanceIds.length === 0) continue;

    regionCount += 1;

    logger.info("EC2 metrics sync region started", {
      connectionId: context.connectionId,
      region,
      instances: instanceIds.length,
    });

    try {
      const ec2Client = buildEc2Client(region, credentials);
      const cwClient = buildCloudWatchClient(region, credentials);

      const instanceVolumeMap = await describeInstancesVolumeMap({ client: ec2Client, instanceIds });
      const instanceBatches = chunk(instanceIds, 25);

      let regionUpserted = 0;
      let cwBatchCount = 0;
      let regionResultsReturned = 0;
      let regionResultsWithValues = 0;
      let regionInstanceHourWithAnyMetric = 0;
      let regionInstanceHourEmpty = 0;

      for (const instanceBatch of instanceBatches) {
        totalInstancesProcessed += instanceBatch.length;

        const metricsByInstanceHour = new Map<string, Map<string, Partial<Record<MetricField, number>>>>();
        for (const instanceId of instanceBatch) {
          const hourMap = new Map<string, Partial<Record<MetricField, number>>>();
          for (const hourIso of hourIsos) {
            hourMap.set(hourIso, {});
          }
          metricsByInstanceHour.set(instanceId, hourMap);
        }

        const ec2QueryPack = buildEc2MetricQueries(instanceBatch);
        if (ec2QueryPack.queries.length > CW_MAX_QUERIES) {
          throw new Error(`EC2 metric query batch too large: ${ec2QueryPack.queries.length} queries`);
        }

        for (const q of splitQueriesByLimit(ec2QueryPack.queries, CW_TARGET_QUERIES)) {
          cwBatchCount += 1;
          const results = await fetchMetricDataAll({ client: cwClient, startTime, endTime, queries: q });
          regionResultsReturned += results.length;
          regionResultsWithValues += results.filter((r) => Array.isArray(r.Values) && r.Values.length > 0).length;

          const applied = applyCloudWatchResultsToInstanceRows({
            results,
            targetsById: ec2QueryPack.targets,
            allowedHourIsos,
          });
          mergeInstanceHourMaps(metricsByInstanceHour, applied);
        }

        const volumes = dedupe(instanceBatch.flatMap((instanceId) => instanceVolumeMap.get(instanceId) ?? []));

        if (volumes.length > 0) {
          const ebsQueryPack = buildEbsMetricQueries(volumes);

          const volumeMetricsAll = new Map<string, Map<string, Partial<Record<MetricField, number>>>>();
          for (const q of splitQueriesByLimit(ebsQueryPack.queries, CW_TARGET_QUERIES)) {
            cwBatchCount += 1;
            const results = await fetchMetricDataAll({ client: cwClient, startTime, endTime, queries: q });
            regionResultsReturned += results.length;
            regionResultsWithValues += results.filter((r) => Array.isArray(r.Values) && r.Values.length > 0).length;

            const applied = applyCloudWatchResultsToVolumeRows({
              results,
              targetsById: ebsQueryPack.targets,
              allowedHourIsos,
            });

            for (const [volumeId, hours] of applied.entries()) {
              if (!volumeMetricsAll.has(volumeId)) volumeMetricsAll.set(volumeId, new Map());
              const baseHourMap = volumeMetricsAll.get(volumeId) as Map<string, Partial<Record<MetricField, number>>>;
              for (const [hourIso, metrics] of hours.entries()) {
                if (!baseHourMap.has(hourIso)) baseHourMap.set(hourIso, {});
                const existing = baseHourMap.get(hourIso);
                if (existing) {
                  Object.assign(existing, metrics);
                }
              }
            }
          }

          const instanceToVolumes = new Map<string, string[]>();
          for (const instanceId of instanceBatch) {
            instanceToVolumes.set(instanceId, instanceVolumeMap.get(instanceId) ?? []);
          }

          const rolled = rollupEbsToInstances({ instanceToVolumes, volumeMetrics: volumeMetricsAll });
          mergeInstanceHourMaps(metricsByInstanceHour, rolled);
        }

        const rowsToUpsert: UtilizationHourlyRow[] = [];
        const dimensionKeysByInstance = await loadLatestDimensionKeysForInstances({
          cloudConnectionId: context.connectionId,
          instanceIds: instanceBatch,
        });
        for (const instanceId of instanceBatch) {
          const hours = metricsByInstanceHour.get(instanceId) ?? new Map<string, Partial<Record<MetricField, number>>>();
          const rows = buildUtilizationRows({
            context,
            instanceId,
            mergedByHour: hours,
            dimensionKeys: dimensionKeysByInstance.get(instanceId) ?? null,
            now,
          });
          rowsToUpsert.push(...rows);
        }

        if (rowsToUpsert.length > 0) {
          let emptyCount = 0;
          let anyMetricCount = 0;
          for (const instanceId of instanceBatch) {
            const hours = metricsByInstanceHour.get(instanceId);
            if (!hours) continue;
            for (const metrics of hours.values()) {
              const hasAny = Object.keys(metrics).length > 0;
              if (hasAny) anyMetricCount += 1;
              else emptyCount += 1;
            }
          }
          regionInstanceHourWithAnyMetric += anyMetricCount;
          regionInstanceHourEmpty += emptyCount;

          logger.debug("EC2 metrics sync batch prepared", {
            connectionId: context.connectionId,
            region,
            instances: instanceBatch.length,
            windowHours: hourIsos.length,
            instanceHoursWithAnyMetric: anyMetricCount,
            instanceHoursEmpty: emptyCount,
            rowsToUpsert: rowsToUpsert.length,
            sampleRow: rowsToUpsert[0]
              ? {
                  instanceId: rowsToUpsert[0].instanceId,
                  hourStart: rowsToUpsert[0].hourStart.toISOString(),
                  cpuAvg: rowsToUpsert[0].cpuAvg,
                  networkInBytes: rowsToUpsert[0].networkInBytes,
                  ebsReadBytes: rowsToUpsert[0].ebsReadBytes,
                }
              : null,
          });

          const upserted = await utilizationRepository.upsertMany(rowsToUpsert);
          regionUpserted += upserted;
          totalUpserted += upserted;
        }
      }

      logger.info("EC2 metrics sync region completed", {
        connectionId: context.connectionId,
        region,
        instances: instanceIds.length,
        cloudWatchBatches: cwBatchCount,
        metricDataResultsReturned: regionResultsReturned,
        metricDataResultsWithValues: regionResultsWithValues,
        instanceHoursWithAnyMetric: regionInstanceHourWithAnyMetric,
        instanceHoursEmpty: regionInstanceHourEmpty,
        hourlyRowsUpserted: regionUpserted,
      });
    } catch (error) {
      logger.warn("EC2 metrics sync region failed", {
        connectionId: context.connectionId,
        region,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("EC2 metrics sync completed", {
    jobId: String(job.id),
    connectionId: context.connectionId,
    regionsProcessed: regionCount,
    instancesProcessed: totalInstancesProcessed,
    hourlyRowsUpserted: totalUpserted,
    durationMs: Date.now() - startedAt,
  });
}
