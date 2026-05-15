import { Op, type Transaction } from "sequelize";

import { DbResourceInventorySnapshot, sequelize } from "../../../../../models/index.js";
import { normalizeDbAwsError } from "../../errors/db-aws-error-normalizer.js";
import { DbAwsValidationError } from "../../errors/db-aws.errors.js";
import type { AwsRdsAuroraInventoryResult } from "./rds-aurora-inventory.types.js";
import {
  mapRdsAuroraClusterToSnapshot,
  mapRdsAuroraInstanceToSnapshot,
  type PersistableSnapshotRow,
} from "./rds-aurora-inventory.persistence.mapper.js";

export type PersistRdsAuroraInventoryResult = {
  instancesPersisted: number;
  clustersPersisted: number;
  totalPersisted: number;
  skippedInvalid: number;
  metadataOnlyFields: string[];
  sampleResourceIds: string[];
};

const REQUIRED_STRING = (value: unknown, field: string): string => {
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

const buildSnapshotInsertRows = (input: {
  tenantId: string;
  cloudConnectionId: string;
  providerId: string | null;
  discoveredAt: Date;
  rows: PersistableSnapshotRow[];
}) => {
  return input.rows.map((row) => ({
    tenantId: input.tenantId,
    cloudConnectionId: input.cloudConnectionId,
    providerId: input.providerId,
    resourceId: row.resourceId,
    resourceArn: row.resourceArn,
    resourceName: row.resourceName,
    dbService: row.dbService,
    dbEngine: row.dbEngine,
    dbEngineVersion: row.dbEngineVersion,
    resourceType: row.resourceType,
    resourceKey: null,
    regionKey: null,
    subAccountKey: null,
    status: row.status,
    allocatedStorageGb: toDecimalStringOrNull(row.allocatedStorageGb),
    dataFootprintGb: toDecimalStringOrNull(row.dataFootprintGb),
    instanceClass: row.instanceClass,
    capacityMode: row.capacityMode,
    clusterId: row.clusterId,
    isClusterResource: row.isClusterResource,
    tagsJson: row.tagsJson,
    metadataJson: row.metadataJson,
    discoveredAt: input.discoveredAt,
    isCurrent: true,
    deletedAt: null,
    createdAt: input.discoveredAt,
    updatedAt: input.discoveredAt,
  }));
};

const markExistingCurrentRowsNotCurrent = async (input: {
  tenantId: string;
  cloudConnectionId: string;
  resourceIds: string[];
  transaction: Transaction;
  discoveredAt: Date;
}): Promise<void> => {
  if (input.resourceIds.length === 0) return;

  await DbResourceInventorySnapshot.update(
    {
      isCurrent: false,
      updatedAt: input.discoveredAt,
    },
    {
      where: {
        tenantId: input.tenantId,
        cloudConnectionId: input.cloudConnectionId,
        resourceId: { [Op.in]: input.resourceIds },
        isCurrent: true,
      },
      transaction: input.transaction,
    },
  );
};

export const persistRdsAuroraInventorySnapshots = async (input: {
  tenantId: string;
  cloudConnectionId: string;
  providerId: string | null;
  inventory: AwsRdsAuroraInventoryResult;
  discoveredAt?: Date;
}): Promise<PersistRdsAuroraInventoryResult> => {
  const tenantId = REQUIRED_STRING(input.tenantId, "tenantId");
  const cloudConnectionId = REQUIRED_STRING(input.cloudConnectionId, "cloudConnectionId");
  const discoveredAt =
    input.discoveredAt instanceof Date && Number.isFinite(input.discoveredAt.getTime())
      ? input.discoveredAt
      : new Date();

  const metadataOnlyFields = [
    "availabilityZone",
    "availabilityZones",
    "endpointAddress",
    "endpointPort",
    "endpoint",
    "readerEndpoint",
    "members",
    "serverlessV2ScalingConfiguration",
    "backupRetentionPeriod",
    "preferredBackupWindow",
    "preferredMaintenanceWindow",
    "deletionProtection",
    "storageEncrypted",
    "publiclyAccessible",
    "multiAz",
  ];

  const mappedInstanceRows = input.inventory.instances.map(mapRdsAuroraInstanceToSnapshot);
  const mappedClusterRows = input.inventory.clusters.map(mapRdsAuroraClusterToSnapshot);

  const validInstanceRows = mappedInstanceRows.filter((row): row is PersistableSnapshotRow => Boolean(row));
  const validClusterRows = mappedClusterRows.filter((row): row is PersistableSnapshotRow => Boolean(row));

  const skippedInvalid =
    mappedInstanceRows.length - validInstanceRows.length +
    mappedClusterRows.length - validClusterRows.length;

  const allRows = [...validInstanceRows, ...validClusterRows];
  const uniqueByResourceId = new Map<string, PersistableSnapshotRow>();
  for (const row of allRows) {
    uniqueByResourceId.set(row.resourceId, row);
  }

  const dedupedRows = Array.from(uniqueByResourceId.values());
  const resourceIds = dedupedRows.map((row) => row.resourceId);

  try {
    await sequelize.transaction(async (transaction: Transaction) => {
      await markExistingCurrentRowsNotCurrent({
        tenantId,
        cloudConnectionId,
        resourceIds,
        transaction,
        discoveredAt,
      });

      if (dedupedRows.length > 0) {
        const insertRows = buildSnapshotInsertRows({
          tenantId,
          cloudConnectionId,
          providerId: input.providerId,
          discoveredAt,
          rows: dedupedRows,
        });

        await DbResourceInventorySnapshot.bulkCreate(insertRows, {
          transaction,
          validate: false,
          returning: false,
        });
      }
    });
  } catch (error) {
    throw normalizeDbAwsError(error, {
      tenantId,
      cloudConnectionId,
      stage: "persist_rds_aurora_inventory_snapshots",
    });
  }

  return {
    instancesPersisted: validInstanceRows.length,
    clustersPersisted: validClusterRows.length,
    totalPersisted: dedupedRows.length,
    skippedInvalid,
    metadataOnlyFields,
    sampleResourceIds: dedupedRows.slice(0, 10).map((row) => row.resourceId),
  };
};
