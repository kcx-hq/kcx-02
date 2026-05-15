import { DbUtilizationDaily } from "../../../../../models/index.js";
import { normalizeDbAwsError } from "../../errors/db-aws-error-normalizer.js";
import { DbAwsValidationError } from "../../errors/db-aws.errors.js";
import type { RdsAuroraNormalizedMetricsResource } from "./rds-aurora-metrics.types.js";

export type PersistRdsAuroraUtilizationResult = {
  insertedOrUpdated: number;
  skippedInvalid: number;
  sampleResourceIds: string[];
};

const toRequiredString = (value: unknown, field: string): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new DbAwsValidationError(`${field} is required`, { field });
  }
  return normalized;
};

const toDecimalStringOrNull = (value: number | null): string | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value.toString();
};

const isValidResourceForPersistence = (resource: RdsAuroraNormalizedMetricsResource): boolean => {
  const resourceId = typeof resource.resourceId === "string" ? resource.resourceId.trim() : "";
  const usageDate = typeof resource.usageDate === "string" ? resource.usageDate.trim() : "";
  return resourceId.length > 0 && usageDate.length > 0;
};

const mapResourceToUpsertRow = (input: {
  tenantId: string;
  cloudConnectionId: string;
  providerId: string | null;
  resource: RdsAuroraNormalizedMetricsResource;
  now: Date;
}) => {
  const { resource } = input;

  return {
    tenantId: input.tenantId,
    cloudConnectionId: input.cloudConnectionId,
    providerId: input.providerId,
    resourceId: resource.resourceId,
    usageDate: resource.usageDate,
    dbService: resource.service,
    dbEngine: resource.engine,
    resourceKey: null,
    regionKey: null,
    subAccountKey: null,
    cpuAvg: toDecimalStringOrNull(resource.metrics.cpuUtilization.average),
    cpuMax: toDecimalStringOrNull(resource.metrics.cpuUtilization.maximum),
    loadAvg: null,
    connectionsAvg: toDecimalStringOrNull(resource.metrics.databaseConnections.average),
    connectionsMax: toDecimalStringOrNull(resource.metrics.databaseConnections.maximum),
    requestCount: null,
    readIops: toDecimalStringOrNull(resource.metrics.readIops.average),
    writeIops: toDecimalStringOrNull(resource.metrics.writeIops.average),
    readThroughputBytes: toDecimalStringOrNull(resource.metrics.readThroughput.average),
    writeThroughputBytes: toDecimalStringOrNull(resource.metrics.writeThroughput.average),
    storageUsedGb: toDecimalStringOrNull(resource.storageUsedGb),
    allocatedStorageGb: toDecimalStringOrNull(resource.allocatedStorageGb),
    sampleCount: resource.sampleCount > 0 ? resource.sampleCount : null,
    metricSource: resource.metricSource,
    createdAt: input.now,
    updatedAt: input.now,
  };
};

export const persistRdsAuroraUtilizationDaily = async (input: {
  tenantId: string;
  cloudConnectionId: string;
  providerId: string | null;
  resources: RdsAuroraNormalizedMetricsResource[];
}): Promise<PersistRdsAuroraUtilizationResult> => {
  const tenantId = toRequiredString(input.tenantId, "tenantId");
  const cloudConnectionId = toRequiredString(input.cloudConnectionId, "cloudConnectionId");
  const now = new Date();

  const validResources = input.resources.filter(isValidResourceForPersistence);

  const rows = validResources.map((resource) =>
    mapResourceToUpsertRow({
      tenantId,
      cloudConnectionId,
      providerId: input.providerId,
      resource,
      now,
    }),
  );

  try {
    if (rows.length > 0) {
      await DbUtilizationDaily.bulkCreate(rows, {
        validate: false,
        returning: false,
        updateOnDuplicate: [
          "dbService",
          "dbEngine",
          "cpuAvg",
          "cpuMax",
          "connectionsAvg",
          "connectionsMax",
          "readIops",
          "writeIops",
          "readThroughputBytes",
          "writeThroughputBytes",
          "storageUsedGb",
          "allocatedStorageGb",
          "sampleCount",
          "metricSource",
          "updatedAt",
        ],
      });
    }
  } catch (error) {
    throw normalizeDbAwsError(error, {
      tenantId,
      cloudConnectionId,
      stage: "persist_rds_aurora_utilization_daily",
    });
  }

  return {
    insertedOrUpdated: rows.length,
    skippedInvalid: input.resources.length - rows.length,
    sampleResourceIds: rows.slice(0, 10).map((row) => row.resourceId),
  };
};
