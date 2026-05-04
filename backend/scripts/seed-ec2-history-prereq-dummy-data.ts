// @ts-nocheck
import { QueryTypes } from "sequelize";
import {
  BillingSource,
  CloudConnectionV2,
  Ec2InstanceInventorySnapshot,
  Ec2VolumeInventorySnapshot,
  sequelize,
} from "../src/models/index.js";

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
    "Usage: node dist/scripts/seed-ec2-history-prereq-dummy-data.js <tenantId> <providerId> <billingSourceId> [ingestionRunId]",
  );
};

async function main(): Promise<void> {
  const { tenantId, providerId, billingSourceId, ingestionRunId } = parseArgs(process.argv);
  if (!tenantId || !providerId || !billingSourceId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const billingSource = await BillingSource.findByPk(billingSourceId);
  if (!billingSource) {
    throw new Error("Billing source not found");
  }

  const connection = billingSource.cloudConnectionId
    ? await CloudConnectionV2.findByPk(String(billingSource.cloudConnectionId))
    : null;
  const cloudConnectionId = connection?.id ?? null;

  const replacements = {
    tenantId,
    providerId,
    billingSourceId,
    ingestionRunId,
  };

  const instanceRows = await sequelize.query<{
    instance_id: string;
    resource_key: string | null;
    region_key: string | null;
    sub_account_key: string | null;
    usage_date: string;
  }>(
    `
SELECT DISTINCT
  COALESCE(dres.resource_id, dres.resource_name) AS instance_id,
  f.resource_key,
  f.region_key,
  f.sub_account_key,
  COALESCE(dd.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) AS usage_date
FROM fact_cost_line_items f
LEFT JOIN dim_resource dres ON dres.id = f.resource_key
LEFT JOIN dim_date dd ON dd.id = f.usage_date_key
WHERE f.tenant_id = CAST(:tenantId AS UUID)
  AND f.provider_id = CAST(:providerId AS BIGINT)
  AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND (CAST(:ingestionRunId AS BIGINT) IS NULL OR f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT))
  AND (
    COALESCE(dres.resource_id, '') ~ '^i-[a-z0-9]+$'
    OR COALESCE(dres.resource_name, '') ~ '^i-[a-z0-9]+$'
  )
  AND COALESCE(dd.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) IS NOT NULL
`,
    { replacements, type: QueryTypes.SELECT },
  );

  let instanceInserted = 0;
  for (const row of instanceRows) {
    const instanceId = String(row.instance_id ?? "").trim();
    if (!instanceId) continue;
    const discoveredAt = new Date(`${row.usage_date}T12:00:00.000Z`);

    const exists = await Ec2InstanceInventorySnapshot.findOne({
      where: {
        tenantId,
        providerId,
        instanceId,
        discoveredAt,
      },
    });
    if (exists) continue;

    await Ec2InstanceInventorySnapshot.create({
      tenantId,
      cloudConnectionId,
      providerId,
      instanceId,
      resourceKey: row.resource_key ?? null,
      regionKey: row.region_key ?? null,
      subAccountKey: row.sub_account_key ?? null,
      instanceType: "unknown",
      state: "unknown",
      discoveredAt,
      isCurrent: true,
      tagsJson: { Seeded: "ec2-history-prereq" },
      metadataJson: { source: "seed-ec2-history-prereq-dummy-data" },
    });
    instanceInserted += 1;
  }

  const volumeRows = await sequelize.query<{
    volume_id: string;
    resource_key: string | null;
    region_key: string | null;
    sub_account_key: string | null;
    usage_date: string;
    attached_instance_id: string | null;
  }>(
    `
WITH volumes AS (
  SELECT DISTINCT
    COALESCE(dres.resource_id, dres.resource_name) AS volume_id,
    f.resource_key,
    f.region_key,
    f.sub_account_key,
    COALESCE(dd.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) AS usage_date
  FROM fact_cost_line_items f
  LEFT JOIN dim_resource dres ON dres.id = f.resource_key
  LEFT JOIN dim_date dd ON dd.id = f.usage_date_key
  WHERE f.tenant_id = CAST(:tenantId AS UUID)
    AND f.provider_id = CAST(:providerId AS BIGINT)
    AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
    AND (CAST(:ingestionRunId AS BIGINT) IS NULL OR f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT))
    AND (
      COALESCE(dres.resource_id, '') ~ '^vol-[a-z0-9]+$'
      OR COALESCE(dres.resource_name, '') ~ '^vol-[a-z0-9]+$'
    )
    AND COALESCE(dd.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) IS NOT NULL
),
candidate_instance AS (
  SELECT DISTINCT
    COALESCE(dres.resource_id, dres.resource_name) AS instance_id,
    f.region_key,
    f.sub_account_key
  FROM fact_cost_line_items f
  LEFT JOIN dim_resource dres ON dres.id = f.resource_key
  WHERE f.tenant_id = CAST(:tenantId AS UUID)
    AND f.provider_id = CAST(:providerId AS BIGINT)
    AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
    AND (CAST(:ingestionRunId AS BIGINT) IS NULL OR f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT))
    AND (
      COALESCE(dres.resource_id, '') ~ '^i-[a-z0-9]+$'
      OR COALESCE(dres.resource_name, '') ~ '^i-[a-z0-9]+$'
    )
)
SELECT
  v.volume_id,
  v.resource_key,
  v.region_key,
  v.sub_account_key,
  v.usage_date,
  (
    SELECT c.instance_id
    FROM candidate_instance c
    WHERE (c.region_key IS NOT DISTINCT FROM v.region_key)
      AND (c.sub_account_key IS NOT DISTINCT FROM v.sub_account_key)
    LIMIT 1
  ) AS attached_instance_id
FROM volumes v
`,
    { replacements, type: QueryTypes.SELECT },
  );

  let volumeInserted = 0;
  for (const row of volumeRows) {
    const volumeId = String(row.volume_id ?? "").trim();
    if (!volumeId) continue;
    const discoveredAt = new Date(`${row.usage_date}T12:00:00.000Z`);
    const attachedInstanceId = String(row.attached_instance_id ?? "").trim() || null;

    const exists = await Ec2VolumeInventorySnapshot.findOne({
      where: {
        tenantId,
        providerId,
        volumeId,
        discoveredAt,
      },
    });
    if (exists) continue;

    await Ec2VolumeInventorySnapshot.create({
      tenantId,
      cloudConnectionId,
      providerId,
      volumeId,
      resourceKey: row.resource_key ?? null,
      regionKey: row.region_key ?? null,
      subAccountKey: row.sub_account_key ?? null,
      volumeType: "gp3",
      sizeGb: 100,
      iops: 3000,
      throughput: 125,
      state: attachedInstanceId ? "in-use" : "available",
      attachedInstanceId,
      isAttached: Boolean(attachedInstanceId),
      discoveredAt,
      isCurrent: true,
      tagsJson: { Seeded: "ec2-history-prereq" },
      metadataJson: { source: "seed-ec2-history-prereq-dummy-data" },
    });
    volumeInserted += 1;
  }

  console.info("EC2 history prerequisite dummy seed completed", {
    tenantId,
    providerId,
    billingSourceId,
    ingestionRunId,
    instanceRowsScanned: instanceRows.length,
    volumeRowsScanned: volumeRows.length,
    instanceInserted,
    volumeInserted,
  });
}

main()
  .catch((error) => {
    console.error(
      "EC2 history prerequisite dummy seed failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
