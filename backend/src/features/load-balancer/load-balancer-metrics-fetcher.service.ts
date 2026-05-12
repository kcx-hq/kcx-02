import {
  CloudWatchClient,
  GetMetricDataCommand,
  type MetricDataQuery,
  type MetricDataResult,
  type MetricStat,
} from "@aws-sdk/client-cloudwatch";

import env from "../../config/env.js";
import type { ScheduledJob } from "../../models/ec2/scheduled_jobs.js";
import { CloudConnectionV2, LoadBalancer } from "../../models/index.js";
import { logger } from "../../utils/logger.js";
import { assumeRole } from "../cloud-connections/aws/infrastructure/aws-sts.service.js";

type AwsConnectionContext = {
  tenantId: string | null;
  providerId: string | null;
  connectionId: string;
  actionRoleArn: string;
  externalId: string | null;
  defaultRegion: string;
};

type LoadBalancerType = "application" | "network";

type LoadBalancerInventoryMetricTarget = {
  accountId: string;
  region: string;
  loadBalancerArn: string;
  loadBalancerDimension: string;
  loadBalancerType: LoadBalancerType;
};

type MetricField =
  | "requestCount"
  | "processedBytes"
  | "activeConnectionCount"
  | "newConnectionCount"
  | "activeFlowCount"
  | "newFlowCount"
  | "healthyHostCount"
  | "unhealthyHostCount"
  | "targetResponseTimeAvg"
  | "elb5xxCount"
  | "target5xxCount"
  | "tcpTargetResetCount";

type DailyMetricAggregation = "sum" | "avg";

type QueryTarget = {
  target: LoadBalancerInventoryMetricTarget;
  field: MetricField;
  agg: DailyMetricAggregation;
};

export type LoadBalancerDailyMetricRow = {
  cloudConnectionId: string;
  accountId: string;
  region: string;
  loadBalancerArn: string;
  metricDate: string;
  requestCount: string | null;
  processedBytes: string | null;
  processedGb: string | null;
  activeConnectionCount: string | null;
  newConnectionCount: string | null;
  activeFlowCount: string | null;
  newFlowCount: string | null;
  healthyHostCount: string | null;
  unhealthyHostCount: string | null;
  targetResponseTimeAvg: string | null;
  elb5xxCount: string | null;
  target5xxCount: string | null;
  tcpTargetResetCount: string | null;
  lastSyncedAt: Date;
};

export type FetchLoadBalancerDailyMetricsInput = {
  cloudConnectionId: string;
  tenantId?: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  accountId?: string | null;
  region?: string | null;
};

const PERIOD_SECONDS = 86_400;
const CW_MAX_QUERIES = 500;
const CW_TARGET_QUERIES = 450;

const normalizeTrim = (value: string | null | undefined): string => String(value ?? "").trim();

const dedupe = <T>(values: T[]): T[] => Array.from(new Set(values));

const chunk = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
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

const parseDateOnlyUtc = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const formatDateOnlyUtc = (value: Date): string => value.toISOString().slice(0, 10);

const toDateRange = (input: { startDate: string; endDate: string }): { startDate: string; endDate: string } => {
  const start = parseDateOnlyUtc(input.startDate);
  const end = parseDateOnlyUtc(input.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid startDate/endDate. Expected YYYY-MM-DD.");
  }

  if (start.getTime() <= end.getTime()) {
    return { startDate: formatDateOnlyUtc(start), endDate: formatDateOnlyUtc(end) };
  }

  return { startDate: formatDateOnlyUtc(end), endDate: formatDateOnlyUtc(start) };
};

const buildDateWindow = (input: { startDate: string; endDate: string }): {
  startTime: Date;
  endTimeExclusive: Date;
  allowedMetricDates: Set<string>;
} => {
  const normalized = toDateRange(input);
  const startTime = parseDateOnlyUtc(normalized.startDate);
  const endInclusive = parseDateOnlyUtc(normalized.endDate);
  const endTimeExclusive = new Date(endInclusive.getTime() + PERIOD_SECONDS * 1000);

  const allowedMetricDates = new Set<string>();
  for (let cursor = new Date(startTime); cursor.getTime() < endTimeExclusive.getTime(); cursor = new Date(cursor.getTime() + PERIOD_SECONDS * 1000)) {
    allowedMetricDates.add(formatDateOnlyUtc(cursor));
  }

  return { startTime, endTimeExclusive, allowedMetricDates };
};

const toMetricStat = (input: {
  namespace: string;
  metricName: string;
  stat: "Sum" | "Average";
  dimensions: Array<{ Name: string; Value: string }>;
}): MetricStat => ({
  Metric: {
    Namespace: input.namespace,
    MetricName: input.metricName,
    Dimensions: input.dimensions,
  },
  Period: PERIOD_SECONDS,
  Stat: input.stat,
});

const makeQueryId = (index: number): string => `m${index + 1}`;

const fetchMetricDataAll = async (input: {
  client: CloudWatchClient;
  startTime: Date;
  endTime: Date;
  queries: MetricDataQuery[];
}): Promise<MetricDataResult[]> => {
  const out: MetricDataResult[] = [];
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

    out.push(...(response.MetricDataResults ?? []));
    nextToken = typeof response.NextToken === "string" && response.NextToken.trim() ? response.NextToken : undefined;
  } while (nextToken);

  return out;
};

const toMetricDateForDatapoint = (timestamp: Date): string => {
  const shifted = new Date(timestamp.getTime() - PERIOD_SECONDS * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return formatDateOnlyUtc(shifted);
};

const formatDecimal = (value: number | null, scale: number): string | null => {
  if (value === null || !Number.isFinite(value)) return null;
  return value.toFixed(scale);
};

const formatBigIntLike = (value: number | null): string | null => {
  if (value === null || !Number.isFinite(value)) return null;
  return String(Math.round(value));
};

const toProcessedGb = (processedBytes: number | null): string | null => {
  if (processedBytes === null || !Number.isFinite(processedBytes)) return null;
  return (processedBytes / (1024 * 1024 * 1024)).toFixed(6);
};

const mapLoadBalancerType = (value: string | null | undefined): LoadBalancerType | null => {
  const normalized = normalizeTrim(value).toLowerCase();
  if (normalized === "application") return "application";
  if (normalized === "network") return "network";
  return null;
};

const toLoadBalancerDimensionFromArn = (loadBalancerArn: string): string | null => {
  const match = normalizeTrim(loadBalancerArn).match(/loadbalancer\/(.+)$/i);
  if (!match || !match[1]) return null;
  return normalizeTrim(match[1]);
};

const resolveAwsConnectionContext = async (input: {
  cloudConnectionId: string;
  tenantId?: string | null;
}): Promise<AwsConnectionContext> => {
  const connectionId = normalizeTrim(input.cloudConnectionId);
  if (!connectionId) {
    throw new Error("cloudConnectionId is required");
  }

  const tenantId = normalizeTrim(input.tenantId ?? "") || null;
  const connection = await CloudConnectionV2.findOne({
    where: {
      id: connectionId,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  if (!connection) throw new Error(`cloud connection not found: ${connectionId}`);

  const roleArn = normalizeTrim(connection.actionRoleArn) || normalizeTrim(connection.billingRoleArn);
  if (!roleArn) throw new Error(`cloud connection missing action_role_arn (or billing_role_arn fallback): ${connectionId}`);

  return {
    tenantId: tenantId ?? (connection.tenantId ? String(connection.tenantId) : null),
    providerId: connection.providerId ? String(connection.providerId) : null,
    connectionId: String(connection.id),
    actionRoleArn: roleArn,
    externalId: connection.externalId ? String(connection.externalId) : null,
    defaultRegion: normalizeTrim(connection.region) || env.awsRegion,
  };
};

const loadInventoryTargets = async (input: {
  cloudConnectionId: string;
  accountId?: string | null;
  region?: string | null;
}): Promise<LoadBalancerInventoryMetricTarget[]> => {
  const accountFilter = normalizeTrim(input.accountId ?? "") || null;
  const regionFilter = normalizeTrim(input.region ?? "") || null;

  const rows = await LoadBalancer.findAll({
    where: {
      cloudConnectionId: input.cloudConnectionId,
      ...(accountFilter ? { accountId: accountFilter } : {}),
      ...(regionFilter ? { region: regionFilter } : {}),
    },
    attributes: ["accountId", "region", "arn", "type"],
  });

  const out: LoadBalancerInventoryMetricTarget[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const accountId = normalizeTrim(row.accountId ? String(row.accountId) : "");
    const region = normalizeTrim(row.region ? String(row.region) : "");
    const arn = normalizeTrim(row.arn ? String(row.arn) : "");
    const loadBalancerType = mapLoadBalancerType(row.type ? String(row.type) : null);
    const dimension = toLoadBalancerDimensionFromArn(arn);
    if (!accountId || !region || !arn || !loadBalancerType || !dimension) continue;

    const key = `${accountId}|${region}|${arn}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      accountId,
      region,
      loadBalancerArn: arn,
      loadBalancerDimension: dimension,
      loadBalancerType,
    });
  }

  return out;
};

const splitQueriesByLimit = (queries: MetricDataQuery[], limit: number): MetricDataQuery[][] =>
  queries.length <= limit ? [queries] : chunk(queries, limit);

const buildMetricQueries = (targets: LoadBalancerInventoryMetricTarget[]): {
  queries: MetricDataQuery[];
  queryTargetsById: Map<string, QueryTarget>;
} => {
  const queries: MetricDataQuery[] = [];
  const queryTargetsById = new Map<string, QueryTarget>();

  const add = (input: {
    target: LoadBalancerInventoryMetricTarget;
    namespace: "AWS/ApplicationELB" | "AWS/NetworkELB";
    metricName: string;
    field: MetricField;
    stat: "Sum" | "Average";
    agg: DailyMetricAggregation;
  }) => {
    const id = makeQueryId(queries.length);
    queries.push({
      Id: id,
      MetricStat: toMetricStat({
        namespace: input.namespace,
        metricName: input.metricName,
        stat: input.stat,
        dimensions: [{ Name: "LoadBalancer", Value: input.target.loadBalancerDimension }],
      }),
      ReturnData: true,
    });
    queryTargetsById.set(id, {
      target: input.target,
      field: input.field,
      agg: input.agg,
    });
  };

  for (const target of targets) {
    if (target.loadBalancerType === "application") {
      add({ target, namespace: "AWS/ApplicationELB", metricName: "RequestCount", field: "requestCount", stat: "Sum", agg: "sum" });
      add({ target, namespace: "AWS/ApplicationELB", metricName: "ProcessedBytes", field: "processedBytes", stat: "Sum", agg: "sum" });
      add({ target, namespace: "AWS/ApplicationELB", metricName: "ActiveConnectionCount", field: "activeConnectionCount", stat: "Average", agg: "avg" });
      add({ target, namespace: "AWS/ApplicationELB", metricName: "NewConnectionCount", field: "newConnectionCount", stat: "Sum", agg: "sum" });
      add({ target, namespace: "AWS/ApplicationELB", metricName: "TargetResponseTime", field: "targetResponseTimeAvg", stat: "Average", agg: "avg" });
      add({ target, namespace: "AWS/ApplicationELB", metricName: "HTTPCode_ELB_5XX_Count", field: "elb5xxCount", stat: "Sum", agg: "sum" });
      add({ target, namespace: "AWS/ApplicationELB", metricName: "HTTPCode_Target_5XX_Count", field: "target5xxCount", stat: "Sum", agg: "sum" });
      add({ target, namespace: "AWS/ApplicationELB", metricName: "HealthyHostCount", field: "healthyHostCount", stat: "Average", agg: "avg" });
      add({ target, namespace: "AWS/ApplicationELB", metricName: "UnHealthyHostCount", field: "unhealthyHostCount", stat: "Average", agg: "avg" });
      continue;
    }

    add({ target, namespace: "AWS/NetworkELB", metricName: "ProcessedBytes", field: "processedBytes", stat: "Sum", agg: "sum" });
    add({ target, namespace: "AWS/NetworkELB", metricName: "ActiveFlowCount", field: "activeFlowCount", stat: "Average", agg: "avg" });
    add({ target, namespace: "AWS/NetworkELB", metricName: "NewFlowCount", field: "newFlowCount", stat: "Sum", agg: "sum" });
    add({ target, namespace: "AWS/NetworkELB", metricName: "HealthyHostCount", field: "healthyHostCount", stat: "Average", agg: "avg" });
    add({ target, namespace: "AWS/NetworkELB", metricName: "UnHealthyHostCount", field: "unhealthyHostCount", stat: "Average", agg: "avg" });
    add({ target, namespace: "AWS/NetworkELB", metricName: "TCP_Target_Reset_Count", field: "tcpTargetResetCount", stat: "Sum", agg: "sum" });
  }

  return { queries, queryTargetsById };
};

const aggregateValues = (values: number[], agg: DailyMetricAggregation): number | null => {
  if (!values || values.length === 0) return null;
  if (agg === "sum") return values.reduce((acc, value) => acc + value, 0);
  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

const applyResults = (input: {
  results: MetricDataResult[];
  queryTargetsById: Map<string, QueryTarget>;
  allowedMetricDates: Set<string>;
}): Map<string, Partial<Record<MetricField, number>>> => {
  const out = new Map<string, Partial<Record<MetricField, number>>>();

  for (const result of input.results) {
    const id = normalizeTrim(result.Id);
    if (!id) continue;
    const queryTarget = input.queryTargetsById.get(id);
    if (!queryTarget) continue;

    const timestamps = result.Timestamps ?? [];
    const values = result.Values ?? [];
    const count = Math.min(timestamps.length, values.length);

    const valuesByDate = new Map<string, number[]>();
    for (let i = 0; i < count; i += 1) {
      const timestamp = timestamps[i];
      const value = values[i];
      if (!(timestamp instanceof Date) || !Number.isFinite(value)) continue;
      const metricDate = toMetricDateForDatapoint(timestamp);
      if (!input.allowedMetricDates.has(metricDate)) continue;
      if (!valuesByDate.has(metricDate)) valuesByDate.set(metricDate, []);
      valuesByDate.get(metricDate)?.push(value);
    }

    for (const [metricDate, metricValues] of valuesByDate.entries()) {
      const aggregated = aggregateValues(metricValues, queryTarget.agg);
      if (aggregated === null) continue;

      const rowKey = `${queryTarget.target.accountId}|${queryTarget.target.region}|${queryTarget.target.loadBalancerArn}|${metricDate}`;
      if (!out.has(rowKey)) out.set(rowKey, {});
      const row = out.get(rowKey) as Partial<Record<MetricField, number>>;
      row[queryTarget.field] = aggregated;
    }
  }

  return out;
};

const buildNormalizedRows = (input: {
  cloudConnectionId: string;
  rowMetrics: Map<string, Partial<Record<MetricField, number>>>;
}): LoadBalancerDailyMetricRow[] => {
  const rows: LoadBalancerDailyMetricRow[] = [];
  const now = new Date();

  for (const [rowKey, metrics] of input.rowMetrics.entries()) {
    const [accountId, region, loadBalancerArn, metricDate] = rowKey.split("|");

    const processedBytesValue = typeof metrics.processedBytes === "number" ? metrics.processedBytes : null;

    rows.push({
      cloudConnectionId: input.cloudConnectionId,
      accountId,
      region,
      loadBalancerArn,
      metricDate,
      requestCount: formatBigIntLike(metrics.requestCount ?? null),
      processedBytes: formatBigIntLike(processedBytesValue),
      processedGb: toProcessedGb(processedBytesValue),
      activeConnectionCount: formatBigIntLike(metrics.activeConnectionCount ?? null),
      newConnectionCount: formatBigIntLike(metrics.newConnectionCount ?? null),
      activeFlowCount: formatBigIntLike(metrics.activeFlowCount ?? null),
      newFlowCount: formatBigIntLike(metrics.newFlowCount ?? null),
      healthyHostCount: formatDecimal(metrics.healthyHostCount ?? null, 4),
      unhealthyHostCount: formatDecimal(metrics.unhealthyHostCount ?? null, 4),
      targetResponseTimeAvg: formatDecimal(metrics.targetResponseTimeAvg ?? null, 6),
      elb5xxCount: formatBigIntLike(metrics.elb5xxCount ?? null),
      target5xxCount: formatBigIntLike(metrics.target5xxCount ?? null),
      tcpTargetResetCount: formatBigIntLike(metrics.tcpTargetResetCount ?? null),
      lastSyncedAt: now,
    });
  }

  rows.sort((left, right) =>
    left.metricDate.localeCompare(right.metricDate) ||
    left.accountId.localeCompare(right.accountId) ||
    left.region.localeCompare(right.region) ||
    left.loadBalancerArn.localeCompare(right.loadBalancerArn));

  return rows;
};

export async function fetchLoadBalancerDailyCloudWatchMetrics(
  input: FetchLoadBalancerDailyMetricsInput,
): Promise<LoadBalancerDailyMetricRow[]> {
  const { startTime, endTimeExclusive, allowedMetricDates } = buildDateWindow({
    startDate: input.startDate,
    endDate: input.endDate,
  });

  const connectionContext = await resolveAwsConnectionContext({
    cloudConnectionId: input.cloudConnectionId,
    tenantId: input.tenantId ?? null,
  });

  const inventoryTargets = await loadInventoryTargets({
    cloudConnectionId: connectionContext.connectionId,
    accountId: input.accountId ?? null,
    region: input.region ?? null,
  });

  if (inventoryTargets.length === 0) {
    logger.info("Load balancer metrics fetch skipped: no inventory targets", {
      cloudConnectionId: connectionContext.connectionId,
      accountId: normalizeTrim(input.accountId ?? "") || null,
      region: normalizeTrim(input.region ?? "") || null,
      startDate: input.startDate,
      endDate: input.endDate,
    });
    return [];
  }

  const probeQueryPack = buildMetricQueries(inventoryTargets);
  if (probeQueryPack.queries.length > CW_MAX_QUERIES && CW_TARGET_QUERIES > CW_MAX_QUERIES) {
    throw new Error(`Invalid query batching configuration: target=${CW_TARGET_QUERIES}, max=${CW_MAX_QUERIES}`);
  }

  const credentials = await assumeRole(connectionContext.actionRoleArn, connectionContext.externalId);
  const targetsByRegion = new Map<string, LoadBalancerInventoryMetricTarget[]>();
  for (const target of inventoryTargets) {
    if (!targetsByRegion.has(target.region)) targetsByRegion.set(target.region, []);
    targetsByRegion.get(target.region)?.push(target);
  }

  const allRows = new Map<string, Partial<Record<MetricField, number>>>();

  for (const [region, targetsInRegion] of targetsByRegion.entries()) {
    const regionalQueryPack = buildMetricQueries(targetsInRegion);
    if (regionalQueryPack.queries.length === 0) continue;

    logger.info("Load balancer metrics fetch region started", {
      cloudConnectionId: connectionContext.connectionId,
      region,
      loadBalancers: targetsInRegion.length,
      queries: regionalQueryPack.queries.length,
    });

    try {
      const cloudWatchClient = buildCloudWatchClient(region, credentials);
      for (const queryBatch of splitQueriesByLimit(regionalQueryPack.queries, CW_TARGET_QUERIES)) {
        const results = await fetchMetricDataAll({
          client: cloudWatchClient,
          startTime,
          endTime: endTimeExclusive,
          queries: queryBatch,
        });

        const batchRows = applyResults({
          results,
          queryTargetsById: regionalQueryPack.queryTargetsById,
          allowedMetricDates,
        });

        for (const [key, metrics] of batchRows.entries()) {
          if (!allRows.has(key)) allRows.set(key, {});
          Object.assign(allRows.get(key) as Partial<Record<MetricField, number>>, metrics);
        }
      }
    } catch (error) {
      logger.warn("Load balancer metrics fetch region failed", {
        cloudConnectionId: connectionContext.connectionId,
        region,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const rows = buildNormalizedRows({
    cloudConnectionId: connectionContext.connectionId,
    rowMetrics: allRows,
  });

  logger.info("Load balancer metrics fetch completed", {
    cloudConnectionId: connectionContext.connectionId,
    loadBalancers: inventoryTargets.length,
    dailyRows: rows.length,
    startDate: formatDateOnlyUtc(startTime),
    endDate: formatDateOnlyUtc(new Date(endTimeExclusive.getTime() - PERIOD_SECONDS * 1000)),
  });

  return rows;
}

export async function fetchLoadBalancerDailyCloudWatchMetricsForScheduledJob(
  job: ScheduledJob,
  input?: {
    startDate: string;
    endDate: string;
    accountId?: string | null;
    region?: string | null;
  },
): Promise<LoadBalancerDailyMetricRow[]> {
  const cloudConnectionId = normalizeTrim(job.cloudConnectionId ? String(job.cloudConnectionId) : "");
  if (!cloudConnectionId) {
    throw new Error("scheduled job missing cloud_connection_id");
  }

  const today = new Date();
  const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
  const fallbackDate = formatDateOnlyUtc(yesterday);

  return fetchLoadBalancerDailyCloudWatchMetrics({
    cloudConnectionId,
    tenantId: job.tenantId ? String(job.tenantId) : null,
    startDate: input?.startDate ?? fallbackDate,
    endDate: input?.endDate ?? fallbackDate,
    accountId: input?.accountId ?? null,
    region: input?.region ?? null,
  });
}
