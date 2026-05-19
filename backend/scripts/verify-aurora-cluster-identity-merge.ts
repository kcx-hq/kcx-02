// @ts-nocheck
import { QueryTypes } from "sequelize";

import { sequelize } from "../src/models/index.js";
import { mergeDbUtilizationIntoFacts } from "../src/features/database/aws/metrics/rds-aurora/rds-aurora-fact-utilization-merge.service.js";

type CliArgs = {
  tenantId: string;
  cloudConnectionId: string;
  usageDate: string;
  utilizationResourceId: string;
};

const parseArgs = (argv: string[]): CliArgs => {
  const args = argv.slice(2);
  return {
    tenantId: String(args[0] ?? "").trim(),
    cloudConnectionId: String(args[1] ?? "").trim(),
    usageDate: String(args[2] ?? "").trim(),
    utilizationResourceId: String(args[3] ?? "").trim(),
  };
};

const printUsage = (): void => {
  console.error(
    "Usage: node dist/scripts/verify-aurora-cluster-identity-merge.js <tenantId> <cloudConnectionId> <usageDate:YYYY-MM-DD> <utilizationClusterResourceId>",
  );
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!args.tenantId || !args.cloudConnectionId || !args.usageDate || !args.utilizationResourceId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const utilRows = await sequelize.query(
    `
SELECT
  tenant_id,
  cloud_connection_id,
  usage_date,
  resource_id,
  cpu_avg,
  cpu_max,
  read_iops,
  write_iops
FROM db_utilization_daily
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND cloud_connection_id = CAST(:cloudConnectionId AS UUID)
  AND usage_date = CAST(:usageDate AS DATE)
  AND resource_id = :utilizationResourceId
LIMIT 1;
`,
    { type: QueryTypes.SELECT, replacements: args },
  );

  if (!utilRows[0]) {
    console.error("No utilization row found for provided key.");
    process.exitCode = 1;
    return;
  }

  const factBefore = await sequelize.query(
    `
SELECT
  resource_id,
  resource_arn,
  resource_name,
  cluster_id,
  resource_type,
  cpu_avg,
  cpu_max,
  read_iops,
  write_iops,
  compute_cost,
  storage_cost,
  io_cost,
  total_billed_cost,
  total_effective_cost
FROM fact_db_resource_daily
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND cloud_connection_id = CAST(:cloudConnectionId AS UUID)
  AND usage_date = CAST(:usageDate AS DATE)
  AND resource_type = 'cluster'
ORDER BY resource_id ASC;
`,
    { type: QueryTypes.SELECT, replacements: args },
  );

  const merge = await mergeDbUtilizationIntoFacts({
    tenantId: args.tenantId,
    cloudConnectionId: args.cloudConnectionId,
    usageDates: [args.usageDate],
    resourceIds: [args.utilizationResourceId],
  });

  const factAfter = await sequelize.query(
    `
SELECT
  resource_id,
  resource_arn,
  resource_name,
  cluster_id,
  resource_type,
  cpu_avg,
  cpu_max,
  read_iops,
  write_iops,
  compute_cost,
  storage_cost,
  io_cost,
  total_billed_cost,
  total_effective_cost
FROM fact_db_resource_daily
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND cloud_connection_id = CAST(:cloudConnectionId AS UUID)
  AND usage_date = CAST(:usageDate AS DATE)
  AND resource_type = 'cluster'
ORDER BY resource_id ASC;
`,
    { type: QueryTypes.SELECT, replacements: args },
  );

  const identityMap = await sequelize.query(
    `
SELECT
  inv.resource_id AS inventory_resource_id,
  inv.resource_arn AS inventory_resource_arn,
  inv.resource_name AS inventory_resource_name,
  inv.cluster_id AS inventory_cluster_id,
  inv.metadata_json->>'dbClusterResourceId' AS inventory_cluster_resource_id,
  CASE
    WHEN inv.resource_arn LIKE 'arn:%:cluster:%'
      AND COALESCE(NULLIF(inv.metadata_json->>'dbClusterResourceId', ''), '') <> ''
    THEN regexp_replace(
      inv.resource_arn,
      ':cluster:[^:]+$',
      ':cluster:' || (inv.metadata_json->>'dbClusterResourceId')
    )
    ELSE NULL
  END AS derived_legacy_cluster_arn
FROM db_resource_inventory_snapshots inv
WHERE inv.tenant_id = CAST(:tenantId AS UUID)
  AND inv.cloud_connection_id = CAST(:cloudConnectionId AS UUID)
  AND inv.is_current = TRUE
  AND inv.resource_type = 'db_cluster'
ORDER BY inv.discovered_at DESC;
`,
    { type: QueryTypes.SELECT, replacements: args },
  );

  console.info("Aurora cluster identity verification", {
    mergeUpdatedRows: merge.updatedRows,
    utilizationRow: utilRows[0],
    identityMap,
    factBefore,
    factAfter,
  });
}

main()
  .catch((error) => {
    console.error("Aurora identity verification failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
