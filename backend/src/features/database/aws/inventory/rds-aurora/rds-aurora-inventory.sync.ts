import { CloudConnectionV2 } from "../../../../../models/index.js";
import { DbAwsValidationError } from "../../errors/db-aws.errors.js";
import { fetchRdsAuroraInventory } from "./rds-aurora-inventory.adapter.js";
import {
  persistRdsAuroraInventorySnapshots,
  type PersistRdsAuroraInventoryResult,
} from "./rds-aurora-inventory.persistence.js";

export type SyncRdsAuroraInventoryInput = {
  tenantId: string;
  cloudConnectionId: string;
  roleSource?: "billing" | "action" | "auto";
  region?: string | null;
  dryRun?: boolean;
};

export type SyncRdsAuroraInventoryResult = {
  tenantId: string;
  cloudConnectionId: string;
  roleSourceUsed: "billing" | "action";
  regionResolved: string;
  fetchedInstances: number;
  fetchedClusters: number;
  persisted: PersistRdsAuroraInventoryResult | null;
};

const toRequired = (value: unknown, field: string): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new DbAwsValidationError(`${field} is required`, { field });
  }
  return normalized;
};

const pickRole = (input: {
  billingRoleArn: string | null;
  actionRoleArn: string | null;
  roleSource: "billing" | "action" | "auto";
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

export const syncRdsAuroraInventory = async (
  input: SyncRdsAuroraInventoryInput,
): Promise<SyncRdsAuroraInventoryResult> => {
  const tenantId = toRequired(input.tenantId, "tenantId");
  const cloudConnectionId = toRequired(input.cloudConnectionId, "cloudConnectionId");

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

  const { roleArn, roleSourceUsed } = pickRole({
    billingRoleArn: connection.billingRoleArn,
    actionRoleArn: connection.actionRoleArn,
    roleSource: input.roleSource ?? "auto",
  });

  const externalId = String(connection.externalId ?? "").trim() || null;

  const inventory = await fetchRdsAuroraInventory({
    tenantId,
    cloudConnectionId,
    roleArn,
    externalId,
    region: input.region ?? null,
    connectionRegion: connection.region,
    connectionExportRegion: connection.exportRegion,
  });

  if (input.dryRun) {
    return {
      tenantId,
      cloudConnectionId,
      roleSourceUsed,
      regionResolved: inventory.region,
      fetchedInstances: inventory.instances.length,
      fetchedClusters: inventory.clusters.length,
      persisted: null,
    };
  }

  const persisted = await persistRdsAuroraInventorySnapshots({
    tenantId,
    cloudConnectionId,
    providerId: connection.providerId ?? null,
    inventory,
  });

  return {
    tenantId,
    cloudConnectionId,
    roleSourceUsed,
    regionResolved: inventory.region,
    fetchedInstances: inventory.instances.length,
    fetchedClusters: inventory.clusters.length,
    persisted,
  };
};
