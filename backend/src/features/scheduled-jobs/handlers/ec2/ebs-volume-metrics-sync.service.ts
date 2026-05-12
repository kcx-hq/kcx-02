import {
  CloudWatchClient,
  GetMetricDataCommand,
  type MetricDataQuery,
  type MetricDataResult,
  type MetricStat,
} from "@aws-sdk/client-cloudwatch";

import env from "../../../../config/env.js";
import { CloudConnectionV2, Ec2VolumeInventorySnapshot } from "../../../../models/index.js";
import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { logger } from "../../../../utils/logger.js";
import { assumeRole } from "../../../cloud-connections/aws/infrastructure/aws-sts.service.js";
import type { EbsVolumeRegionInventory, EbsVolumeUtilizationHourlyRow, HourlyMetricAggregation } from "./ebs-volume-metrics-sync.types.js";
import { EbsVolumeUtilizationHourlyRepository } from "./ebs-volume-utilization-hourly.repository.js";

type AwsConnectionContext = {
  tenantId: string | null;
  providerId: string | null;
  connectionId: string;
  actionRoleArn: string;
  externalId: string | null;
  defaultRegion: string;
};

type VolumeDimensionKeys = {
  resourceKey: string | null;
  regionKey: string | null;
  subAccountKey: string | null;
};

type MetricField = "readBytes" | "writeBytes" | "readOps" | "writeOps" | "queueLengthMax" | "burstBalanceAvg" | "idleTimeAvg";

type QueryTarget = { volumeId: string; field: MetricField; agg: HourlyMetricAggregation };
type MetricValueByHour = Map<string, number[]>;

const DEFAULT_LOOKBACK_HOURS = 24;
const PERIOD_SECONDS = 3600;
const CW_MAX_QUERIES = 500;
const CW_TARGET_QUERIES = 450;

const normalizeTrim = (value: string | null | undefined): string => String(value ?? "").trim();
const dedupe = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

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

const extractRegionFromAz = (availabilityZone: string | null): string | null => {
  const az = normalizeTrim(availabilityZone ?? "");
  if (!az || az.length < 2) return null;
  return az.slice(0, -1);
};

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

const loadInventoryVolumesByRegion = async (context: AwsConnectionContext): Promise<{
  regions: EbsVolumeRegionInventory[];
  dimensionKeysByVolumeId: Map<string, VolumeDimensionKeys>;
}> => {
  const rows = await Ec2VolumeInventorySnapshot.findAll({
    where: {
      cloudConnectionId: context.connectionId,
      isCurrent: true,
      deletedAt: null,
    },
    attributes: ["volumeId", "availabilityZone", "metadataJson", "resourceKey", "regionKey", "subAccountKey", "discoveredAt", "updatedAt"],
    order: [
      ["volumeId", "ASC"],
      ["discoveredAt", "DESC"],
      ["updatedAt", "DESC"],
    ],
  });

  const regionToVolumes = new Map<string, Set<string>>();
  const dimensionKeysByVolumeId = new Map<string, VolumeDimensionKeys>();

  for (const row of rows) {
    const volumeId = normalizeTrim(String(row.volumeId));
    if (!volumeId) continue;

    const metadata = row.metadataJson as Record<string, unknown> | null;
    const regionFromMetadata = metadata && typeof metadata.awsRegion === "string" ? normalizeTrim(metadata.awsRegion) : "";
    const region = regionFromMetadata || extractRegionFromAz(row.availabilityZone ? String(row.availabilityZone) : null) || context.defaultRegion;

    if (!regionToVolumes.has(region)) {
      regionToVolumes.set(region, new Set());
    }
    regionToVolumes.get(region)?.add(volumeId);

    if (!dimensionKeysByVolumeId.has(volumeId)) {
      dimensionKeysByVolumeId.set(volumeId, {
        resourceKey: row.resourceKey ? String(row.resourceKey) : null,
        regionKey: row.regionKey ? String(row.regionKey) : null,
        subAccountKey: row.subAccountKey ? String(row.subAccountKey) : null,
      });
    }
  }

  return {
    regions: Array.from(regionToVolumes.entries()).map(([region, ids]) => ({
      region,
      volumeIds: Array.from(ids),
    })),
    dimensionKeysByVolumeId,
  };
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

const makeQueryId = (prefix: string, index: number): string => `${prefix}${index}`;

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
    queries.push({
      Id: id,
      MetricStat: toMetricStat({
        namespace: "AWS/EBS",
        metricName: input.metricName,
        dimensions: [{ Name: "VolumeId", Value: input.volumeId }],
        stat: input.stat,
      }),
      ReturnData: true,
    });
    targets.set(id, { volumeId: input.volumeId, field: input.field, agg: input.agg });
  };

  for (const volumeId of volumeIds) {
    add({ volumeId, metricName: "VolumeReadBytes", field: "readBytes", stat: "Sum", agg: "sum" });
    add({ volumeId, metricName: "VolumeWriteBytes", field: "writeBytes", stat: "Sum", agg: "sum" });
    add({ volumeId, metricName: "VolumeReadOps", field: "readOps", stat: "Sum", agg: "sum" });
    add({ volumeId, metricName: "VolumeWriteOps", field: "writeOps", stat: "Sum", agg: "sum" });
    add({ volumeId, metricName: "VolumeQueueLength", field: "queueLengthMax", stat: "Maximum", agg: "max" });
    add({ volumeId, metricName: "BurstBalance", field: "burstBalanceAvg", stat: "Average", agg: "avg" });
    add({ volumeId, metricName: "VolumeIdleTime", field: "idleTimeAvg", stat: "Average", agg: "avg" });
  }

  return { queries, targets };
};

const splitQueriesByLimit = (queries: MetricDataQuery[], limit: number): MetricDataQuery[][] =>
  queries.length <= limit ? [queries] : chunk(queries, limit);

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

const mergeMetricField = (row: Partial<EbsVolumeUtilizationHourlyRow>, field: MetricField, value: number | null): void => {
  switch (field) {
    case "queueLengthMax":
    case "burstBalanceAvg":
    case "idleTimeAvg":
      row[field] = formatDecimal(value, 4);
      return;
    default:
      row[field] = formatBigIntLike(value);
  }
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
    if (!target) continue;

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

const mergeVolumeHourMaps = (
  base: Map<string, Map<string, Partial<Record<MetricField, number>>>>,
  extra: Map<string, Map<string, Partial<Record<MetricField, number>>>>,
): void => {
  for (const [volumeId, hourMap] of extra.entries()) {
    if (!base.has(volumeId)) base.set(volumeId, new Map());
    const baseHourMap = base.get(volumeId) as Map<string, Partial<Record<MetricField, number>>>;
    for (const [hourIso, metrics] of hourMap.entries()) {
      if (!baseHourMap.has(hourIso)) baseHourMap.set(hourIso, {});
      const baseMetrics = baseHourMap.get(hourIso) as Partial<Record<MetricField, number>>;
      for (const [field, value] of Object.entries(metrics) as [MetricField, number][]) {
        baseMetrics[field] = value;
      }
    }
  }
};

const buildUtilizationRows = (input: {
  context: AwsConnectionContext;
  volumeId: string;
  mergedByHour: Map<string, Partial<Record<MetricField, number>>>;
  dimensionKeys: VolumeDimensionKeys | null;
  now: Date;
}): EbsVolumeUtilizationHourlyRow[] => {
  const rows: EbsVolumeUtilizationHourlyRow[] = [];

  for (const [hourIso, metrics] of input.mergedByHour.entries()) {
    const hourStart = new Date(hourIso);
    if (Number.isNaN(hourStart.getTime())) continue;

    const row: Partial<EbsVolumeUtilizationHourlyRow> = {
      tenantId: input.context.tenantId,
      cloudConnectionId: input.context.connectionId,
      providerId: input.context.providerId,
      volumeId: input.volumeId,
      hourStart,
      usageDate: formatUsageDateUtc(hourStart),
      resourceKey: input.dimensionKeys?.resourceKey ?? null,
      regionKey: input.dimensionKeys?.regionKey ?? null,
      subAccountKey: input.dimensionKeys?.subAccountKey ?? null,
      readBytes: null,
      writeBytes: null,
      readOps: null,
      writeOps: null,
      queueLengthMax: null,
      burstBalanceAvg: null,
      idleTimeAvg: null,
      sampleCount: 1,
      metricSource: "cloudwatch",
      createdAt: input.now,
      updatedAt: input.now,
    };

    for (const [field, value] of Object.entries(metrics) as [MetricField, number][]) {
      mergeMetricField(row, field, typeof value === "number" ? value : null);
    }

    rows.push(row as EbsVolumeUtilizationHourlyRow);
  }

  return rows;
};

export async function syncEbsVolumeMetrics(job: ScheduledJob): Promise<void> {
  const startedAt = Date.now();
  const lookbackHoursRaw = typeof job.lookbackHours === "number" ? job.lookbackHours : Number(job.lookbackHours);
  const lookbackHours =
    Number.isFinite(lookbackHoursRaw) && lookbackHoursRaw > 0
      ? Math.min(168, Math.trunc(lookbackHoursRaw))
      : DEFAULT_LOOKBACK_HOURS;

  const now = new Date();
  const endTime = floorToUtcHour(now);
  const startTime = new Date(endTime.getTime() - lookbackHours * 60 * 60 * 1000);
  const hourIsos: string[] = [];
  for (let i = 0; i < lookbackHours; i += 1) {
    hourIsos.push(new Date(startTime.getTime() + i * 60 * 60 * 1000).toISOString());
  }
  const allowedHourIsos = new Set(hourIsos);

  const context = await resolveAwsConnectionContextForJob(job);
  if (!context.tenantId) {
    throw new Error("scheduled job missing tenant_id for EBS volume metrics sync");
  }

  logger.info("EBS volume metrics sync started", {
    jobId: String(job.id),
    connectionId: context.connectionId,
    tenantId: context.tenantId,
    providerId: context.providerId,
    lookbackHours,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  });

  const credentials = await assumeRole(context.actionRoleArn, context.externalId);
  const inventory = await loadInventoryVolumesByRegion(context);
  if (inventory.regions.length === 0) {
    logger.warn("EBS volume metrics sync skipped because volume inventory is empty", {
      jobId: String(job.id),
      connectionId: context.connectionId,
    });
    return;
  }

  const repository = new EbsVolumeUtilizationHourlyRepository();
  let totalVolumesProcessed = 0;
  let totalUpserted = 0;

  for (const regionInventory of inventory.regions) {
    const region = regionInventory.region;
    const volumeIds = dedupe(regionInventory.volumeIds);
    if (volumeIds.length === 0) continue;

    logger.info("EBS volume metrics sync region started", {
      connectionId: context.connectionId,
      region,
      volumes: volumeIds.length,
    });

    try {
      const cwClient = buildCloudWatchClient(region, credentials);
      const volumeBatches = chunk(volumeIds, 60);
      let regionUpserted = 0;
      let regionResultsReturned = 0;
      let regionResultsWithValues = 0;
      let cloudWatchBatches = 0;

      for (const volumeBatch of volumeBatches) {
        totalVolumesProcessed += volumeBatch.length;

        const metricsByVolumeHour = new Map<string, Map<string, Partial<Record<MetricField, number>>>>();
        for (const volumeId of volumeBatch) {
          const hourMap = new Map<string, Partial<Record<MetricField, number>>>();
          for (const hourIso of hourIsos) {
            hourMap.set(hourIso, {});
          }
          metricsByVolumeHour.set(volumeId, hourMap);
        }

        const queryPack = buildEbsMetricQueries(volumeBatch);
        if (queryPack.queries.length > CW_MAX_QUERIES) {
          throw new Error(`EBS volume metric query batch too large: ${queryPack.queries.length} queries`);
        }

        for (const q of splitQueriesByLimit(queryPack.queries, CW_TARGET_QUERIES)) {
          cloudWatchBatches += 1;
          const results = await fetchMetricDataAll({ client: cwClient, startTime, endTime, queries: q });
          regionResultsReturned += results.length;
          regionResultsWithValues += results.filter((r) => Array.isArray(r.Values) && r.Values.length > 0).length;
          const applied = applyCloudWatchResultsToVolumeRows({
            results,
            targetsById: queryPack.targets,
            allowedHourIsos,
          });
          mergeVolumeHourMaps(metricsByVolumeHour, applied);
        }

        const rowsToUpsert: EbsVolumeUtilizationHourlyRow[] = [];
        for (const volumeId of volumeBatch) {
          rowsToUpsert.push(
            ...buildUtilizationRows({
              context,
              volumeId,
              mergedByHour: metricsByVolumeHour.get(volumeId) ?? new Map<string, Partial<Record<MetricField, number>>>(),
              dimensionKeys: inventory.dimensionKeysByVolumeId.get(volumeId) ?? null,
              now,
            }),
          );
        }

        const upserted = await repository.upsertMany(rowsToUpsert);
        regionUpserted += upserted;
        totalUpserted += upserted;
      }

      logger.info("EBS volume metrics sync region completed", {
        connectionId: context.connectionId,
        region,
        volumes: volumeIds.length,
        cloudWatchBatches,
        metricDataResultsReturned: regionResultsReturned,
        metricDataResultsWithValues: regionResultsWithValues,
        hourlyRowsUpserted: regionUpserted,
      });
    } catch (error) {
      logger.warn("EBS volume metrics sync region failed", {
        connectionId: context.connectionId,
        region,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("EBS volume metrics sync completed", {
    jobId: String(job.id),
    connectionId: context.connectionId,
    volumesProcessed: totalVolumesProcessed,
    hourlyRowsUpserted: totalUpserted,
    durationMs: Date.now() - startedAt,
  });
}

export async function syncEbsVolumeMetricsForScheduledJob(job: ScheduledJob): Promise<void> {
  await syncEbsVolumeMetrics(job);
}
