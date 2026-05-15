import { Op } from "sequelize";

import { CloudConnectionV2, DbResourceInventorySnapshot } from "../../../../../models/index.js";
import { DbAwsValidationError } from "../../errors/db-aws.errors.js";
import { fetchRdsAuroraCloudWatchMetrics } from "./rds-aurora-metrics.adapter.js";
import {
  persistRdsAuroraUtilizationDaily,
  type PersistRdsAuroraUtilizationResult,
} from "./rds-aurora-metrics.persistence.js";

type DbResourceInventorySnapshotRow = InstanceType<typeof DbResourceInventorySnapshot>;

type RoleSource = "billing" | "action" | "auto";

type BackfillSnapshotResource = {
  resourceId: string;
  resourceType: "db_instance" | "db_cluster";
  service: "rds" | "aurora";
  engine: string | null;
  region: string;
  allocatedStorageGb: number | null;
  identifier: string | null;
  arn: string | null;
};

export type BackfillRdsAuroraMetricsInput = {
  tenantId: string;
  cloudConnectionId: string;
  roleSource?: RoleSource;
  region?: string | null;
  days?: number;
  persist?: boolean;
  staticCredentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string | null;
  } | null;
};

export type BackfillRdsAuroraMetricsResult = {
  tenantId: string;
  cloudConnectionId: string;
  roleSourceUsed: "billing" | "action" | "static";
  regionResolved: string;
  days: number;
  resourcesScanned: number;
  generatedMetricRows: number;
  persistedRows: number;
  skippedInvalid: number;
  dailyBreakdown: Array<{
    usageDate: string;
    generatedRows: number;
    persistedRows: number;
    skippedInvalid: number;
  }>;
  sampleResourceIds: string[];
};

const DEFAULT_DAYS = 7;
const MAX_DAYS = 31;

const toRequired = (value: unknown, field: string): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new DbAwsValidationError(`${field} is required`, { field });
  }
  return normalized;
};

const toPositiveDays = (value: unknown): number => {
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : DEFAULT_DAYS;
  if (numeric <= 0) return DEFAULT_DAYS;
  return Math.min(numeric, MAX_DAYS);
};

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toUtcDayRange = (daysAgo: number): { start: Date; end: Date } => {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const targetStart = new Date(dayStart.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const targetEnd = new Date(targetStart.getTime() + 24 * 60 * 60 * 1000);
  return { start: targetStart, end: targetEnd };
};

const pickRole = (input: {
  billingRoleArn: string | null;
  actionRoleArn: string | null;
  roleSource: RoleSource;
}): { roleArn: string; roleSourceUsed: "billing" | "action" } => {
  const billingRoleArn = String(input.billingRoleArn ?? "").trim() || null;
  const actionRoleArn = String(input.actionRoleArn ?? "").trim() || null;

  if (input.roleSource === "billing") {
    if (!billingRoleArn) throw new DbAwsValidationError("billingRoleArn is not configured", {});
    return { roleArn: billingRoleArn, roleSourceUsed: "billing" };
  }

  if (input.roleSource === "action") {
    if (!actionRoleArn) throw new DbAwsValidationError("actionRoleArn is not configured", {});
    return { roleArn: actionRoleArn, roleSourceUsed: "action" };
  }

  if (billingRoleArn) return { roleArn: billingRoleArn, roleSourceUsed: "billing" };
  if (actionRoleArn) return { roleArn: actionRoleArn, roleSourceUsed: "action" };
  throw new DbAwsValidationError("No usable roleArn found on cloud connection", {});
};

const toSnapshotResource = (snapshot: DbResourceInventorySnapshotRow): BackfillSnapshotResource | null => {
  const resourceTypeRaw = toStringOrNull(snapshot.resourceType);
  const resourceType =
    resourceTypeRaw === "db_instance" || resourceTypeRaw === "db_cluster"
      ? resourceTypeRaw
      : null;
  if (!resourceType) return null;

  const dbServiceRaw = toStringOrNull(snapshot.dbService);
  const service = dbServiceRaw === "rds" || dbServiceRaw === "aurora" ? dbServiceRaw : null;
  if (!service) return null;

  const resourceId = toStringOrNull(snapshot.resourceId);
  if (!resourceId) return null;

  const metadataJson = (snapshot.metadataJson ?? {}) as Record<string, unknown>;

  const region =
    toStringOrNull(metadataJson.region)
    ?? "us-east-1";

  const identifier =
    resourceType === "db_instance"
      ? toStringOrNull(snapshot.resourceName)
      : toStringOrNull(snapshot.resourceName ?? snapshot.clusterId);

  return {
    resourceId,
    resourceType,
    service,
    engine: toStringOrNull(snapshot.dbEngine),
    region,
    allocatedStorageGb: toNumberOrNull(snapshot.allocatedStorageGb),
    identifier,
    arn: toStringOrNull(snapshot.resourceArn),
  };
};

const loadCurrentSnapshotResources = async (input: {
  tenantId: string;
  cloudConnectionId: string;
}): Promise<BackfillSnapshotResource[]> => {
  const rows = await DbResourceInventorySnapshot.findAll({
    where: {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      isCurrent: true,
      dbService: { [Op.in]: ["rds", "aurora"] },
      resourceType: { [Op.in]: ["db_instance", "db_cluster"] },
    },
    order: [["discoveredAt", "DESC"]],
  });

  const deduped = new Map<string, BackfillSnapshotResource>();
  for (const row of rows) {
    const mapped = toSnapshotResource(row);
    if (!mapped) continue;
    if (!deduped.has(mapped.resourceId)) {
      deduped.set(mapped.resourceId, mapped);
    }
  }

  return Array.from(deduped.values());
};

const toInventoryInput = (resources: BackfillSnapshotResource[]) => {
  return {
    instances: resources
      .filter((resource) => resource.resourceType === "db_instance")
      .map((resource) => ({
        dbInstanceIdentifier: resource.identifier,
        dbInstanceArn: resource.arn,
        engine: resource.engine,
        service: resource.service,
        region: resource.region,
        allocatedStorageGb: resource.allocatedStorageGb,
      })),
    clusters: resources
      .filter((resource) => resource.resourceType === "db_cluster")
      .map((resource) => ({
        dbClusterIdentifier: resource.identifier,
        dbClusterArn: resource.arn,
        engine: resource.engine,
        service: resource.service,
        region: resource.region,
      })),
  };
};

export const backfillRdsAuroraMetricsFromCurrentSnapshots = async (
  input: BackfillRdsAuroraMetricsInput,
): Promise<BackfillRdsAuroraMetricsResult> => {
  const tenantId = toRequired(input.tenantId, "tenantId");
  const cloudConnectionId = toRequired(input.cloudConnectionId, "cloudConnectionId");
  const days = toPositiveDays(input.days);
  const persist = input.persist === true;

  const connection = await CloudConnectionV2.findOne({
    where: {
      id: cloudConnectionId,
      tenantId,
    },
  });

  if (!connection) {
    throw new DbAwsValidationError("Cloud connection not found", {
      tenantId,
      cloudConnectionId,
    });
  }

  const staticCredentials = input.staticCredentials ?? null;

  const { roleArn, roleSourceUsed } = staticCredentials?.accessKeyId && staticCredentials.secretAccessKey
    ? { roleArn: "static-credentials", roleSourceUsed: "static" as const }
    : pickRole({
      billingRoleArn: connection.billingRoleArn,
      actionRoleArn: connection.actionRoleArn,
      roleSource: input.roleSource ?? "auto",
    });

  const externalId = String(connection.externalId ?? "").trim() || null;
  const resources = await loadCurrentSnapshotResources({
    tenantId,
    cloudConnectionId,
  });

  const inventory = toInventoryInput(resources);

  const regionResolved =
    toStringOrNull(input.region)
    ?? toStringOrNull(connection.region)
    ?? toStringOrNull(connection.exportRegion)
    ?? "us-east-1";

  let generatedMetricRows = 0;
  let persistedRows = 0;
  let skippedInvalid = 0;
  const sampleResourceIds = new Set<string>();
  const dailyBreakdown: BackfillRdsAuroraMetricsResult["dailyBreakdown"] = [];

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const { start, end } = toUtcDayRange(dayOffset);

    const metrics = await fetchRdsAuroraCloudWatchMetrics({
      tenantId,
      cloudConnectionId,
      roleArn,
      externalId,
      region: regionResolved,
      connectionRegion: connection.region,
      connectionExportRegion: connection.exportRegion,
      staticCredentials,
      inventory,
      window: {
        startTime: start,
        endTime: end,
        periodSeconds: 3600,
      },
    });

    generatedMetricRows += metrics.resources.length;

    let dayPersisted: PersistRdsAuroraUtilizationResult | null = null;
    if (persist && metrics.resources.length > 0) {
      dayPersisted = await persistRdsAuroraUtilizationDaily({
        tenantId,
        cloudConnectionId,
        providerId: connection.providerId ?? null,
        resources: metrics.resources,
      });
      persistedRows += dayPersisted.insertedOrUpdated;
      skippedInvalid += dayPersisted.skippedInvalid;
      for (const id of dayPersisted.sampleResourceIds) sampleResourceIds.add(id);
    }

    dailyBreakdown.push({
      usageDate: metrics.usageDate,
      generatedRows: metrics.resources.length,
      persistedRows: dayPersisted?.insertedOrUpdated ?? 0,
      skippedInvalid: dayPersisted?.skippedInvalid ?? 0,
    });
  }

  return {
    tenantId,
    cloudConnectionId,
    roleSourceUsed,
    regionResolved,
    days,
    resourcesScanned: resources.length,
    generatedMetricRows,
    persistedRows,
    skippedInvalid,
    dailyBreakdown,
    sampleResourceIds: Array.from(sampleResourceIds).slice(0, 20),
  };
};
