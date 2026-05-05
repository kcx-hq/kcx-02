// @ts-nocheck
import { QueryTypes } from "sequelize";
import { sequelize } from "../src/models/index.js";

type CliArgs = {
  tenantId: string;
  providerId: string;
  billingSourceId: string;
  ingestionRunId: string | null;
};

const parseArgs = (argv: string[]): CliArgs => {
  const args = argv.slice(2);
  return {
    tenantId: String(args[0] ?? "").trim(),
    providerId: String(args[1] ?? "").trim(),
    billingSourceId: String(args[2] ?? "").trim(),
    ingestionRunId: String(args[3] ?? "").trim() || null,
  };
};

const printUsage = (): void => {
  console.error(
    "Usage: node dist/scripts/verify-ec2-history-eligibility.js <tenantId> <providerId> <billingSourceId> [ingestionRunId]",
  );
};

const EC2_RELATED_FILTER_SQL = `
(
  LOWER(COALESCE(ds.service_name, '')) LIKE '%amazon ec2%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%elastic compute cloud%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%ebs%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%ec2%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%ec2%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%ebs%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%boxusage%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%spotusage%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%dedicatedusage%'
  OR LOWER(COALESCE(f.operation, '')) LIKE '%ec2%'
  OR LOWER(COALESCE(f.operation, '')) LIKE '%runinstances%'
  OR LOWER(COALESCE(f.operation, '')) LIKE '%datatransfer%'
  OR dres.resource_id ~ '^i-[a-z0-9]+$'
  OR dres.resource_name ~ '^i-[a-z0-9]+$'
  OR LOWER(COALESCE(dres.resource_id, '')) LIKE '%:instance/%'
  OR LOWER(COALESCE(dres.resource_name, '')) LIKE '%:instance/%'
)
`;

async function main(): Promise<void> {
  const { tenantId, providerId, billingSourceId, ingestionRunId } = parseArgs(process.argv);

  if (!tenantId || !providerId || !billingSourceId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const replacements = {
    tenantId,
    providerId,
    billingSourceId,
    ingestionRunId,
  };

  const scopeSql = `
WITH base AS (
  SELECT
    f.id,
    f.ingestion_run_id,
    f.usage_type,
    f.operation,
    f.usage_start_time,
    f.usage_end_time,
    ds.service_name,
    dres.resource_id,
    dres.resource_name,
    COALESCE(dd_usage.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) AS effective_usage_date
  FROM fact_cost_line_items f
  LEFT JOIN dim_service ds ON ds.id = f.service_key
  LEFT JOIN dim_resource dres ON dres.id = f.resource_key
  LEFT JOIN dim_date dd_usage ON dd_usage.id = f.usage_date_key
  WHERE f.tenant_id = CAST(:tenantId AS UUID)
    AND f.provider_id = CAST(:providerId AS BIGINT)
    AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
    AND (CAST(:ingestionRunId AS BIGINT) IS NULL OR f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT))
)
SELECT
  COUNT(*)::bigint AS total_rows,
  COUNT(*) FILTER (WHERE effective_usage_date IS NOT NULL)::bigint AS rows_with_usage_date,
  COUNT(*) FILTER (WHERE ${EC2_RELATED_FILTER_SQL})::bigint AS rows_matching_ec2_filter,
  COUNT(*) FILTER (WHERE effective_usage_date IS NOT NULL AND ${EC2_RELATED_FILTER_SQL})::bigint AS rows_eligible_for_ec2_history
FROM base f;
`;

  const [scope] = await sequelize.query(scopeSql, { replacements, type: QueryTypes.SELECT });

  const sampleSql = `
WITH base AS (
  SELECT
    f.ingestion_run_id,
    COALESCE(ds.service_name, '(null)') AS service_name,
    COALESCE(f.usage_type, '(null)') AS usage_type,
    COALESCE(f.operation, '(null)') AS operation,
    COALESCE(dres.resource_id, '(null)') AS resource_id,
    COALESCE(dd_usage.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) AS effective_usage_date
  FROM fact_cost_line_items f
  LEFT JOIN dim_service ds ON ds.id = f.service_key
  LEFT JOIN dim_resource dres ON dres.id = f.resource_key
  LEFT JOIN dim_date dd_usage ON dd_usage.id = f.usage_date_key
  WHERE f.tenant_id = CAST(:tenantId AS UUID)
    AND f.provider_id = CAST(:providerId AS BIGINT)
    AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
    AND (CAST(:ingestionRunId AS BIGINT) IS NULL OR f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT))
)
SELECT
  ingestion_run_id,
  service_name,
  usage_type,
  operation,
  resource_id,
  effective_usage_date
FROM base
WHERE effective_usage_date IS NOT NULL
  AND ${EC2_RELATED_FILTER_SQL}
ORDER BY ingestion_run_id DESC NULLS LAST
LIMIT 25;
`;

  const samples = await sequelize.query(sampleSql, { replacements, type: QueryTypes.SELECT });

  const periodSql = `
SELECT
  period_month,
  status,
  snapshot_version,
  source_ingestion_run_id
FROM cost_period_status
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND provider_id = CAST(:providerId AS BIGINT)
  AND billing_source_id = CAST(:billingSourceId AS BIGINT)
ORDER BY period_month DESC
LIMIT 12;
`;

  const periods = await sequelize.query(periodSql, { replacements, type: QueryTypes.SELECT });

  console.info("EC2 history eligibility summary", scope);
  console.info("Eligible sample rows (up to 25)", samples);
  console.info("Latest cost period status (up to 12 months)", periods);
}

main()
  .catch((error) => {
    console.error(
      "EC2 history eligibility verification failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
