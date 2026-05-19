import { QueryTypes } from "sequelize";

import { sequelize } from "../src/models/index.js";

type ConnectionRow = {
  tenantId: string;
  cloudConnectionId: string;
  provider: string | null;
  status: string | null;
  accountId: string | null;
  billingRoleArn: string | null;
  actionRoleArn: string | null;
  externalId: string | null;
  region: string | null;
  exportRegion: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

type InventorySummaryRow = {
  tenantId: string | null;
  cloudConnectionId: string | null;
  dbService: string | null;
  resourceType: string | null;
  resourceCount: string | number;
};

const toIsoOrNull = (value: Date | string | null): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const maskToken = (value: string | null, options?: { head?: number; tail?: number }): string => {
  if (!value) return "absent";
  const normalized = value.trim();
  if (!normalized) return "absent";

  const head = options?.head ?? 6;
  const tail = options?.tail ?? 4;

  if (normalized.length <= head + tail) {
    return `${normalized.slice(0, 2)}***(${normalized.length})`;
  }

  return `${normalized.slice(0, head)}...${normalized.slice(-tail)} (${normalized.length} chars)`;
};

const toCount = (value: string | number): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function main(): Promise<void> {
  const [connectionRows, inventoryRows] = await Promise.all([
    sequelize.query<ConnectionRow>(
      `
SELECT
  c.tenant_id::text AS "tenantId",
  c.id::text AS "cloudConnectionId",
  COALESCE(p.code, p.name, c.provider_id::text) AS "provider",
  c.status AS "status",
  NULLIF(STRING_AGG(DISTINCT cca.account_id, ', '), '') AS "accountId",
  c.billing_role_arn AS "billingRoleArn",
  c.action_role_arn AS "actionRoleArn",
  c.external_id AS "externalId",
  c.region AS "region",
  c.export_region AS "exportRegion",
  c.created_at AS "createdAt",
  c.updated_at AS "updatedAt"
FROM cloud_connections c
LEFT JOIN cloud_providers p ON p.id = c.provider_id
LEFT JOIN client_cloud_accounts cca
  ON cca.cloud_connection_id = c.id
 AND cca.tenant_id = c.tenant_id
GROUP BY
  c.tenant_id,
  c.id,
  p.code,
  p.name,
  c.provider_id,
  c.status,
  c.billing_role_arn,
  c.action_role_arn,
  c.external_id,
  c.region,
  c.export_region,
  c.created_at,
  c.updated_at
ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST;
      `,
      { type: QueryTypes.SELECT },
    ),
    sequelize.query<InventorySummaryRow>(
      `
SELECT
  tenant_id::text AS "tenantId",
  cloud_connection_id::text AS "cloudConnectionId",
  db_service AS "dbService",
  resource_type AS "resourceType",
  COUNT(*) AS "resourceCount"
FROM db_resource_inventory_snapshots
WHERE is_current = TRUE
GROUP BY tenant_id, cloud_connection_id, db_service, resource_type
ORDER BY tenant_id, cloud_connection_id, db_service, resource_type;
      `,
      { type: QueryTypes.SELECT },
    ),
  ]);

  const inventoryByConnection = new Map<string, { groups: InventorySummaryRow[]; totalCount: number }>();

  for (const row of inventoryRows) {
    if (!row.tenantId || !row.cloudConnectionId) continue;
    const key = `${row.tenantId}::${row.cloudConnectionId}`;
    const current = inventoryByConnection.get(key) ?? { groups: [], totalCount: 0 };
    current.groups.push(row);
    current.totalCount += toCount(row.resourceCount);
    inventoryByConnection.set(key, current);
  }

  console.info("DB Cloud Connection Diagnostic (read-only)");
  console.info(
    JSON.stringify(
      {
        totalConnections: connectionRows.length,
        totalInventoryGroups: inventoryRows.length,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  const printableConnections = connectionRows.map((row) => {
    const key = `${row.tenantId}::${row.cloudConnectionId}`;
    const inventory = inventoryByConnection.get(key);
    const hasCurrentInventory = Boolean(inventory && inventory.totalCount > 0);

    const hasBillingRole = Boolean(row.billingRoleArn && row.billingRoleArn.trim());
    const hasActionRole = Boolean(row.actionRoleArn && row.actionRoleArn.trim());
    const hasAnyRole = hasBillingRole || hasActionRole;

    return {
      tenant_id: row.tenantId,
      cloud_connection_id: row.cloudConnectionId,
      provider: row.provider ?? "unknown",
      status: row.status ?? "unknown",
      account_id: row.accountId ?? "n/a",
      billing_role_arn: hasBillingRole ? maskToken(row.billingRoleArn, { head: 16, tail: 8 }) : "absent",
      action_role_arn: hasActionRole ? maskToken(row.actionRoleArn, { head: 16, tail: 8 }) : "absent",
      external_id: row.externalId ? maskToken(row.externalId, { head: 4, tail: 4 }) : "absent",
      region: row.region ?? null,
      export_region: row.exportRegion ?? null,
      created_at: toIsoOrNull(row.createdAt),
      updated_at: toIsoOrNull(row.updatedAt),
      has_current_db_inventory: hasCurrentInventory,
      current_db_inventory_resource_count: inventory?.totalCount ?? 0,
      metrics_backfill_eligible: hasCurrentInventory && hasAnyRole,
      eligibility_reason: !hasCurrentInventory
        ? "missing current db inventory snapshots"
        : !hasAnyRole
          ? "missing billing/action role arn"
          : "eligible",
    };
  });

  console.info("\nConnections:");
  console.table(printableConnections);

  console.info("\nCurrent DB inventory groups (is_current=true):");
  console.table(
    inventoryRows.map((row) => ({
      tenant_id: row.tenantId,
      cloud_connection_id: row.cloudConnectionId,
      db_service: row.dbService,
      resource_type: row.resourceType,
      resource_count: toCount(row.resourceCount),
    })),
  );

  const eligible = printableConnections
    .filter((row) => row.metrics_backfill_eligible)
    .map((row) => ({
      tenant_id: row.tenant_id,
      cloud_connection_id: row.cloud_connection_id,
      provider: row.provider,
      status: row.status,
      current_db_inventory_resource_count: row.current_db_inventory_resource_count,
    }));

  console.info("\nEligible for metrics backfill (current inventory + role ARN present):");
  if (eligible.length === 0) {
    console.info("No eligible cloud connections found.");
  } else {
    console.table(eligible);
  }
}

main()
  .catch((error: unknown) => {
    console.error("Diagnostic failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
