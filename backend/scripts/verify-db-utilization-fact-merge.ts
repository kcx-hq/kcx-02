// @ts-nocheck
import { QueryTypes } from "sequelize";

import { sequelize } from "../src/models/index.js";
import { mergeDbUtilizationIntoFacts } from "../src/features/database/aws/metrics/rds-aurora/rds-aurora-fact-utilization-merge.service.js";

type CliArgs = {
  tenantId: string;
  cloudConnectionId: string;
  usageDate: string;
  resourceId: string;
};

const COST_COLUMNS = [
  "compute_cost",
  "storage_cost",
  "io_cost",
  "backup_cost",
  "data_transfer_cost",
  "tax_cost",
  "credit_amount",
  "refund_amount",
  "total_billed_cost",
  "total_effective_cost",
  "total_list_cost",
] as const;

const parseArgs = (argv: string[]): CliArgs => {
  const args = argv.slice(2);
  return {
    tenantId: String(args[0] ?? "").trim(),
    cloudConnectionId: String(args[1] ?? "").trim(),
    usageDate: String(args[2] ?? "").trim(),
    resourceId: String(args[3] ?? "").trim(),
  };
};

const printUsage = (): void => {
  console.error(
    "Usage: node dist/scripts/verify-db-utilization-fact-merge.js <tenantId> <cloudConnectionId> <usageDate:YYYY-MM-DD> <resourceId>",
  );
};

const loadUtilRow = async (params: CliArgs) =>
  sequelize.query(
    `
SELECT
  tenant_id,
  cloud_connection_id,
  usage_date,
  resource_id,
  cpu_avg,
  cpu_max,
  read_iops,
  write_iops,
  read_throughput_bytes,
  write_throughput_bytes,
  storage_used_gb
FROM db_utilization_daily
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND cloud_connection_id = CAST(:cloudConnectionId AS UUID)
  AND usage_date = CAST(:usageDate AS DATE)
  AND resource_id = :resourceId
LIMIT 1;
`,
    { type: QueryTypes.SELECT, replacements: params },
  );

const loadFactRow = async (params: CliArgs) =>
  sequelize.query(
    `
SELECT
  tenant_id,
  cloud_connection_id,
  usage_date,
  resource_id,
  cpu_avg,
  cpu_max,
  load_avg,
  connections_avg,
  connections_max,
  request_count,
  read_iops,
  write_iops,
  read_throughput_bytes,
  write_throughput_bytes,
  storage_used_gb,
  compute_cost,
  storage_cost,
  io_cost,
  backup_cost,
  data_transfer_cost,
  tax_cost,
  credit_amount,
  refund_amount,
  total_billed_cost,
  total_effective_cost,
  total_list_cost
FROM fact_db_resource_daily
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND cloud_connection_id = CAST(:cloudConnectionId AS UUID)
  AND usage_date = CAST(:usageDate AS DATE)
  AND resource_id = :resourceId
LIMIT 1;
`,
    { type: QueryTypes.SELECT, replacements: params },
  );

const pickCosts = (row: Record<string, unknown> | null) => {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const key of COST_COLUMNS) out[key] = row[key];
  return out;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!args.tenantId || !args.cloudConnectionId || !args.usageDate || !args.resourceId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const utilBefore = await loadUtilRow(args);
  const factBeforeRows = await loadFactRow(args);
  const factBefore = (factBeforeRows[0] ?? null) as Record<string, unknown> | null;

  if (!utilBefore[0]) {
    console.error("No db_utilization_daily row found for provided keys.");
    process.exitCode = 1;
    return;
  }
  if (!factBefore) {
    console.error("No fact_db_resource_daily row found for provided keys.");
    process.exitCode = 1;
    return;
  }

  const mergeResult = await mergeDbUtilizationIntoFacts({
    tenantId: args.tenantId,
    cloudConnectionId: args.cloudConnectionId,
    usageDates: [args.usageDate],
    resourceIds: [args.resourceId],
  });

  const factAfterRows = await loadFactRow(args);
  const factAfter = (factAfterRows[0] ?? null) as Record<string, unknown> | null;

  console.info("Verification summary", {
    mergeUpdatedRows: mergeResult.updatedRows,
    utilizationHasCpuOrIops:
      utilBefore[0].cpu_avg !== null ||
      utilBefore[0].cpu_max !== null ||
      utilBefore[0].read_iops !== null ||
      utilBefore[0].write_iops !== null,
    utilSnapshot: {
      cpu_avg: utilBefore[0].cpu_avg,
      cpu_max: utilBefore[0].cpu_max,
      read_iops: utilBefore[0].read_iops,
      write_iops: utilBefore[0].write_iops,
      read_throughput_bytes: utilBefore[0].read_throughput_bytes,
      write_throughput_bytes: utilBefore[0].write_throughput_bytes,
      storage_used_gb: utilBefore[0].storage_used_gb,
    },
    factUtilBefore: {
      cpu_avg: factBefore.cpu_avg,
      cpu_max: factBefore.cpu_max,
      read_iops: factBefore.read_iops,
      write_iops: factBefore.write_iops,
      read_throughput_bytes: factBefore.read_throughput_bytes,
      write_throughput_bytes: factBefore.write_throughput_bytes,
      storage_used_gb: factBefore.storage_used_gb,
    },
    factUtilAfter: {
      cpu_avg: factAfter?.cpu_avg ?? null,
      cpu_max: factAfter?.cpu_max ?? null,
      read_iops: factAfter?.read_iops ?? null,
      write_iops: factAfter?.write_iops ?? null,
      read_throughput_bytes: factAfter?.read_throughput_bytes ?? null,
      write_throughput_bytes: factAfter?.write_throughput_bytes ?? null,
      storage_used_gb: factAfter?.storage_used_gb ?? null,
    },
    costColumnsBefore: pickCosts(factBefore),
    costColumnsAfter: pickCosts(factAfter),
    costColumnsUnchanged:
      JSON.stringify(pickCosts(factBefore)) === JSON.stringify(pickCosts(factAfter)),
  });
}

main()
  .catch((error) => {
    console.error("DB utilization fact merge verification failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
