import { QueryTypes } from "sequelize";

import { sequelize } from "../src/models/index.js";

type CliOptions = {
  billingSourceId: string;
  tenantId: string | null;
};

type BillingSourceRow = {
  id: string;
  tenant_id: string;
};

const BUCKET_PREFIX = "seed-s3-anom-";

const parseArgs = (argv: string[]): CliOptions => {
  let billingSourceId: string | null = null;
  let tenantId: string | null = null;

  for (const rawArg of argv.slice(2)) {
    const arg = String(rawArg ?? "").trim();
    if (!arg) continue;
    const [key, ...rest] = arg.split("=");
    const value = rest.join("=").trim();
    if (!value) continue;

    if (key === "--billing-source-id") {
      billingSourceId = value;
      continue;
    }
    if (key === "--tenant-id") {
      tenantId = value;
    }
  }

  if (!billingSourceId || !/^\d+$/.test(billingSourceId)) {
    throw new Error("Provide valid --billing-source-id=<number>");
  }

  return { billingSourceId, tenantId };
};

async function resolveScope(input: CliOptions): Promise<BillingSourceRow> {
  const [row] = await sequelize.query<BillingSourceRow>(
    `
      SELECT
        bs.id::text AS id,
        bs.tenant_id::text AS tenant_id
      FROM billing_sources bs
      WHERE bs.id = CAST(:billingSourceId AS BIGINT)
        AND (:tenantId IS NULL OR bs.tenant_id::text = :tenantId)
      LIMIT 1
    `,
    {
      replacements: {
        billingSourceId: input.billingSourceId,
        tenantId: input.tenantId,
      },
      type: QueryTypes.SELECT,
    },
  );

  if (!row) {
    throw new Error("Billing source not found for provided scope");
  }
  return row;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const scope = await resolveScope(options);

  const [deletedCostRows] = await sequelize.query<{ deleted_count: string }>(
    `
      WITH deleted AS (
        DELETE FROM s3_cost_daily
        WHERE tenant_id = CAST(:tenantId AS UUID)
          AND billing_source_id = CAST(:billingSourceId AS BIGINT)
          AND bucket_name LIKE :bucketPrefix
        RETURNING 1
      )
      SELECT COUNT(*)::text AS deleted_count FROM deleted
    `,
    {
      replacements: {
        tenantId: scope.tenant_id,
        billingSourceId: scope.id,
        bucketPrefix: `${BUCKET_PREFIX}%`,
      },
      type: QueryTypes.SELECT,
    },
  );

  const [deletedStorageRows] = await sequelize.query<{ deleted_count: string }>(
    `
      WITH deleted AS (
        DELETE FROM s3_storage_lens_daily
        WHERE tenant_id = CAST(:tenantId AS UUID)
          AND billing_source_id = CAST(:billingSourceId AS BIGINT)
          AND bucket_name LIKE :bucketPrefix
        RETURNING 1
      )
      SELECT COUNT(*)::text AS deleted_count FROM deleted
    `,
    {
      replacements: {
        tenantId: scope.tenant_id,
        billingSourceId: scope.id,
        bucketPrefix: `${BUCKET_PREFIX}%`,
      },
      type: QueryTypes.SELECT,
    },
  );

  console.info("S3 anomaly dummy source data cleanup completed", {
    tenantId: scope.tenant_id,
    billingSourceId: scope.id,
    bucketPrefix: BUCKET_PREFIX,
    deletedCostRows: Number(deletedCostRows?.deleted_count ?? 0),
    deletedStorageRows: Number(deletedStorageRows?.deleted_count ?? 0),
    note: "This script only deletes seeded source-table rows and does not touch fact_anomalies.",
  });
}

main()
  .catch((error) => {
    console.error("cleanup-s3-anomaly-dummy-data failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

