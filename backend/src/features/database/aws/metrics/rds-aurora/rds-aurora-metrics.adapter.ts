import {
  GetMetricDataCommand,
  type CloudWatchClient,
  type Dimension,
  type MetricDataQuery,
  type MetricDataResult,
} from "@aws-sdk/client-cloudwatch";

import {
  createAwsCloudWatchClient,
  createAwsDatabaseClientFromCredentials,
} from "../../clients/db-aws-client.factory.js";
import { normalizeDbAwsError } from "../../errors/db-aws-error-normalizer.js";
import { DbAwsValidationError } from "../../errors/db-aws.errors.js";
import { collectAwsPages } from "../../utils/db-aws-pagination.utils.js";
import type { AwsDatabaseClientContext, AwsDatabaseService } from "../../types/db-aws.types.js";
import type {
  FetchRdsAuroraMetricsInput,
  FetchRdsAuroraMetricsResult,
  RdsAuroraMetricsByName,
  RdsAuroraMetricStatSummary,
  RdsAuroraMetricsFetchWindow,
  RdsAuroraNormalizedMetricsResource,
} from "./rds-aurora-metrics.types.js";

type MetricKey = keyof RdsAuroraMetricsByName;
type ResourceType = "db_instance" | "db_cluster";

type ResourceDescriptor = {
  resourceId: string;
  resourceName: string | null;
  resourceType: ResourceType;
  service: AwsDatabaseService;
  engine: string | null;
  region: string;
  allocatedStorageGb: number | null;
  dimensionName: "DBInstanceIdentifier" | "DBClusterIdentifier";
  dimensionValue: string;
};

type CloudWatchMetricSpec = {
  key: MetricKey;
  metricName: string;
  statistic: "Average" | "Maximum";
};

const DB_NAMESPACE = "AWS/RDS";
const DEFAULT_PERIOD_SECONDS = 3600;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

const METRIC_SPECS: readonly CloudWatchMetricSpec[] = [
  { key: "cpuUtilization", metricName: "CPUUtilization", statistic: "Average" },
  { key: "cpuUtilization", metricName: "CPUUtilization", statistic: "Maximum" },
  { key: "databaseConnections", metricName: "DatabaseConnections", statistic: "Average" },
  { key: "databaseConnections", metricName: "DatabaseConnections", statistic: "Maximum" },
  { key: "readIops", metricName: "ReadIOPS", statistic: "Average" },
  { key: "writeIops", metricName: "WriteIOPS", statistic: "Average" },
  { key: "readThroughput", metricName: "ReadThroughput", statistic: "Average" },
  { key: "writeThroughput", metricName: "WriteThroughput", statistic: "Average" },
  { key: "freeStorageSpace", metricName: "FreeStorageSpace", statistic: "Average" },
  { key: "volumeBytesUsed", metricName: "VolumeBytesUsed", statistic: "Average" },
];

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== "number") return null;
  return Number.isFinite(value) ? value : null;
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  return null;
};

const isoDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const buildDefaultWindow = (): RdsAuroraMetricsFetchWindow => {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - MS_IN_DAY);
  return { startTime, endTime, periodSeconds: DEFAULT_PERIOD_SECONDS };
};

const resolveWindow = (window?: Partial<RdsAuroraMetricsFetchWindow>): RdsAuroraMetricsFetchWindow => {
  const fallback = buildDefaultWindow();
  const startTime = toDate(window?.startTime) ?? fallback.startTime;
  const endTime = toDate(window?.endTime) ?? fallback.endTime;
  const periodSeconds =
    typeof window?.periodSeconds === "number" && Number.isInteger(window.periodSeconds) && window.periodSeconds > 0
      ? window.periodSeconds
      : DEFAULT_PERIOD_SECONDS;

  if (endTime <= startTime) {
    throw new DbAwsValidationError("metrics window endTime must be greater than startTime", {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });
  }

  return { startTime, endTime, periodSeconds };
};

const emptyMetricSummary = (): RdsAuroraMetricStatSummary => ({
  average: null,
  maximum: null,
  sampleCount: 0,
});

const emptyMetrics = (): RdsAuroraMetricsByName => ({
  cpuUtilization: emptyMetricSummary(),
  databaseConnections: emptyMetricSummary(),
  readIops: emptyMetricSummary(),
  writeIops: emptyMetricSummary(),
  readThroughput: emptyMetricSummary(),
  writeThroughput: emptyMetricSummary(),
  freeStorageSpace: emptyMetricSummary(),
  volumeBytesUsed: emptyMetricSummary(),
});

const summarizeResult = (result: MetricDataResult): { value: number | null; points: number } => {
  const values = Array.isArray(result.Values) ? result.Values.map(toFiniteNumber).filter((v): v is number => v !== null) : [];
  if (values.length === 0) return { value: null, points: 0 };
  const sum = values.reduce((acc, value) => acc + value, 0);
  return { value: sum / values.length, points: values.length };
};

const toResourceDescriptors = (input: FetchRdsAuroraMetricsInput["inventory"]): ResourceDescriptor[] => {
  const fromInstances = input.instances
    .map((instance): ResourceDescriptor | null => {
      const identifier = toStringOrNull(instance.dbInstanceIdentifier);
      if (!identifier) return null;
      return {
        resourceId: toStringOrNull(instance.dbInstanceArn) ?? identifier,
        resourceName: identifier,
        resourceType: "db_instance",
        service: instance.service,
        engine: toStringOrNull(instance.engine),
        region: toStringOrNull(instance.region) ?? "us-east-1",
        allocatedStorageGb: toFiniteNumber(instance.allocatedStorageGb),
        dimensionName: "DBInstanceIdentifier",
        dimensionValue: identifier,
      };
    })
    .filter((item): item is ResourceDescriptor => Boolean(item));

  const fromClusters = input.clusters
    .map((cluster): ResourceDescriptor | null => {
      const identifier = toStringOrNull(cluster.dbClusterIdentifier);
      if (!identifier) return null;
      return {
        resourceId: toStringOrNull(cluster.dbClusterArn) ?? identifier,
        resourceName: identifier,
        resourceType: "db_cluster",
        service: cluster.service,
        engine: toStringOrNull(cluster.engine),
        region: toStringOrNull(cluster.region) ?? "us-east-1",
        allocatedStorageGb: null,
        dimensionName: "DBClusterIdentifier",
        dimensionValue: identifier,
      };
    })
    .filter((item): item is ResourceDescriptor => Boolean(item));

  const deduped = new Map<string, ResourceDescriptor>();
  for (const item of [...fromInstances, ...fromClusters]) {
    deduped.set(item.resourceId, item);
  }

  return Array.from(deduped.values());
};

const metricIdFor = (metricKey: MetricKey, statistic: "Average" | "Maximum"): string => {
  return `${metricKey}_${statistic.toLowerCase()}`;
};

const buildMetricQueries = (resource: ResourceDescriptor, periodSeconds: number): MetricDataQuery[] => {
  const dimension: Dimension = {
    Name: resource.dimensionName,
    Value: resource.dimensionValue,
  };

  return METRIC_SPECS.map((spec) => ({
    Id: metricIdFor(spec.key, spec.statistic),
    ReturnData: true,
    MetricStat: {
      Metric: {
        Namespace: DB_NAMESPACE,
        MetricName: spec.metricName,
        Dimensions: [dimension],
      },
      Period: periodSeconds,
      Stat: spec.statistic,
    },
  }));
};

const loadMetricDataResults = async (input: {
  client: CloudWatchClient;
  queries: MetricDataQuery[];
  window: RdsAuroraMetricsFetchWindow;
}): Promise<MetricDataResult[]> => {
  const pages = await collectAwsPages(async (nextToken?: string) => {
    const response = await input.client.send(
      new GetMetricDataCommand({
        MetricDataQueries: input.queries,
        StartTime: input.window.startTime,
        EndTime: input.window.endTime,
        NextToken: nextToken,
      }),
    );

    return {
      page: response,
      nextToken: response.NextToken,
    };
  });

  return pages.flatMap((page) => (Array.isArray(page.MetricDataResults) ? page.MetricDataResults : []));
};

const applyResultToMetrics = (metrics: RdsAuroraMetricsByName, result: MetricDataResult): void => {
  const id = toStringOrNull(result.Id);
  if (!id) return;

  const [metricKeyRaw, statRaw] = id.split("_");
  const metricKey = metricKeyRaw as MetricKey;
  if (!(metricKey in metrics)) return;

  const statType = statRaw === "maximum" ? "maximum" : statRaw === "average" ? "average" : null;
  if (!statType) return;

  const summary = summarizeResult(result);
  metrics[metricKey] = {
    ...metrics[metricKey],
    [statType]: summary.value,
    sampleCount: Math.max(metrics[metricKey].sampleCount, summary.points),
  };
};

const toStorageUsedGb = (input: {
  volumeBytesUsed: number | null;
  freeStorageSpace: number | null;
  allocatedStorageGb: number | null;
}): number | null => {
  if (typeof input.volumeBytesUsed === "number" && Number.isFinite(input.volumeBytesUsed)) {
    return input.volumeBytesUsed / (1024 ** 3);
  }

  if (
    typeof input.allocatedStorageGb === "number" &&
    Number.isFinite(input.allocatedStorageGb) &&
    typeof input.freeStorageSpace === "number" &&
    Number.isFinite(input.freeStorageSpace)
  ) {
    const freeGb = input.freeStorageSpace / (1024 ** 3);
    const usedGb = input.allocatedStorageGb - freeGb;
    return usedGb >= 0 ? usedGb : null;
  }

  return null;
};

const normalizeResourceMetrics = (input: {
  descriptor: ResourceDescriptor;
  results: MetricDataResult[];
  usageDate: string;
}): RdsAuroraNormalizedMetricsResource => {
  const metrics = emptyMetrics();
  for (const result of input.results) {
    applyResultToMetrics(metrics, result);
  }

  const sampleCount = Object.values(metrics).reduce((maxCount, stat) => Math.max(maxCount, stat.sampleCount), 0);

  const storageUsedGb = toStorageUsedGb({
    volumeBytesUsed: metrics.volumeBytesUsed.average,
    freeStorageSpace: metrics.freeStorageSpace.average,
    allocatedStorageGb: input.descriptor.allocatedStorageGb,
  });

  return {
    resourceId: input.descriptor.resourceId,
    resourceName: input.descriptor.resourceName,
    resourceType: input.descriptor.resourceType,
    service: input.descriptor.service,
    engine: input.descriptor.engine,
    region: input.descriptor.region,
    usageDate: input.usageDate,
    allocatedStorageGb: input.descriptor.allocatedStorageGb,
    storageUsedGb,
    metrics,
    sampleCount,
    metricSource: "cloudwatch",
  };
};

export const fetchRdsAuroraCloudWatchMetrics = async (
  input: FetchRdsAuroraMetricsInput,
): Promise<FetchRdsAuroraMetricsResult> => {
  const tenantId = toStringOrNull(input.tenantId);
  const cloudConnectionId = toStringOrNull(input.cloudConnectionId);

  if (!tenantId || !cloudConnectionId) {
    throw new DbAwsValidationError("tenantId and cloudConnectionId are required", {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
    });
  }

  const descriptors = toResourceDescriptors(input.inventory);
  const region =
    toStringOrNull(input.region)
    ?? toStringOrNull(input.connectionRegion)
    ?? toStringOrNull(input.connectionExportRegion)
    ?? "us-east-1";
  const window = resolveWindow(input.window);
  const usageDate = isoDateOnly(window.endTime);

  if (descriptors.length === 0) {
    return {
      region,
      usageDate,
      window,
      resources: [],
    };
  }

  let client: CloudWatchClient;
  try {
    if (input.staticCredentials?.accessKeyId && input.staticCredentials?.secretAccessKey) {
      client = await createAwsDatabaseClientFromCredentials<CloudWatchClient>({
        kind: "cloudwatch",
        credentialsContext: {
          tenantId,
          cloudConnectionId,
          roleArn: "static-credentials",
          externalId: null,
          region,
          accessKeyId: input.staticCredentials.accessKeyId,
          secretAccessKey: input.staticCredentials.secretAccessKey,
          sessionToken: input.staticCredentials.sessionToken ?? "",
        },
      });
    } else {
      client = await createAwsCloudWatchClient<CloudWatchClient>({
        tenantId,
        cloudConnectionId,
        roleArn: input.roleArn,
        externalId: input.externalId ?? null,
        region,
        connectionRegion: input.connectionRegion ?? null,
        connectionExportRegion: input.connectionExportRegion ?? null,
      } as AwsDatabaseClientContext);
    }
  } catch (error) {
    throw normalizeDbAwsError(error, {
      tenantId,
      cloudConnectionId,
      stage: "create_cloudwatch_client",
      region,
    });
  }

  try {
    const resources: RdsAuroraNormalizedMetricsResource[] = [];

    for (const descriptor of descriptors) {
      const queries = buildMetricQueries(descriptor, window.periodSeconds);
      const results = await loadMetricDataResults({
        client,
        queries,
        window,
      });

      resources.push(
        normalizeResourceMetrics({
          descriptor,
          results,
          usageDate,
        }),
      );
    }

    return {
      region,
      usageDate,
      window,
      resources,
    };
  } catch (error) {
    throw normalizeDbAwsError(error, {
      tenantId,
      cloudConnectionId,
      stage: "fetch_rds_aurora_cloudwatch_metrics",
      region,
    });
  }
};
