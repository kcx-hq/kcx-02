import { QueryTypes } from "sequelize";

import { sequelize } from "../src/models/index.js";

type CliOptions = {
  billingSourceId: string;
  tenantId: string | null;
  days: number;
};

type BillingSourceRow = {
  id: string;
  tenant_id: string;
  cloud_connection_id: string | null;
};

const BUCKET_PREFIX = "seed-s3-anom-";
const ACCOUNT_ID = "999999999999";
const REGION = "us-east-1";

const parseArgs = (argv: string[]): CliOptions => {
  let billingSourceId: string | null = null;
  let tenantId: string | null = null;
  let days = 30;

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
      continue;
    }
    if (key === "--days") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 2 || parsed > 365) {
        throw new Error("Provide valid --days=<number> between 2 and 365");
      }
      days = Math.floor(parsed);
    }
  }

  if (!billingSourceId || !/^\d+$/.test(billingSourceId)) {
    throw new Error("Provide valid --billing-source-id=<number>");
  }

  return { billingSourceId, tenantId, days };
};

const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

async function resolveScope(input: CliOptions): Promise<BillingSourceRow> {
  const [row] = await sequelize.query<BillingSourceRow>(
    `
      SELECT
        bs.id::text AS id,
        bs.tenant_id::text AS tenant_id,
        bs.cloud_connection_id::text AS cloud_connection_id
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

async function seedS3CostDaily(scope: BillingSourceRow, dates: string[]): Promise<number> {
  const buckets = [`${BUCKET_PREFIX}storage`, `${BUCKET_PREFIX}transfer`, `${BUCKET_PREFIX}request`];

  let inserted = 0;
  for (const usageDate of dates) {
    const isSpikeDay = usageDate === dates[dates.length - 1];

    const rows = [
      {
        bucketName: buckets[0],
        category: "Storage",
        usageType: "TimedStorage-ByteHrs",
        operation: "StandardStorage",
        productFamily: "Storage",
        storageClass: "S3 Standard",
        totalCost: isSpikeDay ? 0.4 : 0.05,
        usageQuantity: isSpikeDay ? 200 : 20,
      },
      {
        bucketName: buckets[1],
        category: "Transfer",
        usageType: "DataTransfer-Out-Bytes",
        operation: "DataTransfer",
        productFamily: "Data Transfer",
        storageClass: "Unknown",
        totalCost: isSpikeDay ? 0.5 : 0.06,
        usageQuantity: isSpikeDay ? 300 : 30,
      },
      {
        bucketName: buckets[2],
        category: "Request",
        usageType: "Requests-Tier1",
        operation: "GetObject",
        productFamily: "API Request",
        storageClass: "Unknown",
        totalCost: isSpikeDay ? 0.45 : 0.05,
        usageQuantity: isSpikeDay ? 5000 : 500,
      },
    ];

    for (const row of rows) {
      await sequelize.query(
        `
          INSERT INTO s3_cost_daily (
            tenant_id, cloud_connection_id, billing_source_id,
            account_id, region, bucket_name, usage_date,
            cost_category, storage_class, usage_type, operation, product_family,
            pricing_unit, total_cost, usage_quantity, currency_code, line_item_count, created_at, updated_at
          )
          VALUES (
            CAST(:tenantId AS UUID), CAST(:cloudConnectionId AS UUID), CAST(:billingSourceId AS BIGINT),
            :accountId, :region, :bucketName, CAST(:usageDate AS DATE),
            :costCategory, :storageClass, :usageType, :operation, :productFamily,
            'Units', :totalCost, :usageQuantity, 'USD', 1, NOW(), NOW()
          )
          ON CONFLICT (
            tenant_id, cloud_connection_id, billing_source_id, provider_id, sub_account_key, region_key,
            account_id, region, bucket_name, usage_date, cost_category, storage_class, usage_type, operation, product_family, pricing_unit, currency_code
          )
          DO UPDATE SET
            total_cost = EXCLUDED.total_cost,
            usage_quantity = EXCLUDED.usage_quantity,
            line_item_count = EXCLUDED.line_item_count,
            updated_at = NOW()
        `,
        {
          replacements: {
            tenantId: scope.tenant_id,
            cloudConnectionId: scope.cloud_connection_id,
            billingSourceId: scope.id,
            accountId: ACCOUNT_ID,
            region: REGION,
            bucketName: row.bucketName,
            usageDate,
            costCategory: row.category,
            storageClass: row.storageClass,
            usageType: row.usageType,
            operation: row.operation,
            productFamily: row.productFamily,
            totalCost: row.totalCost,
            usageQuantity: row.usageQuantity,
          },
          type: QueryTypes.INSERT,
        },
      );
      inserted += 1;
    }
  }

  return inserted;
}

async function seedS3StorageLensDaily(scope: BillingSourceRow, dates: string[]): Promise<number> {
  // 10TB -> 30TB style growth on last day for storage growth anomaly.
  const baseBytes = 10 * 1024 ** 4;
  const spikeBytes = 30 * 1024 ** 4;

  let inserted = 0;
  for (const usageDate of dates) {
    const isSpikeDay = usageDate === dates[dates.length - 1];
    const currentBytes = isSpikeDay ? spikeBytes : baseBytes;

    await sequelize.query(
      `
        INSERT INTO s3_storage_lens_daily (
          tenant_id, cloud_connection_id, billing_source_id,
          usage_date, bucket_name, object_count, current_version_bytes, avg_object_size_bytes,
          bytes_standard, bytes_standard_ia, bytes_onezone_ia, bytes_intelligent_tiering, bytes_glacier, bytes_deep_archive,
          access_count, noncurrent_version_bytes, created_at, updated_at
        )
        VALUES (
          CAST(:tenantId AS UUID), CAST(:cloudConnectionId AS UUID), CAST(:billingSourceId AS BIGINT),
          CAST(:usageDate AS DATE), :bucketName, :objectCount, :currentVersionBytes, :avgObjectSizeBytes,
          :bytesStandard, 0, 0, 0, 0, 0,
          :accessCount, :noncurrentVersionBytes, NOW(), NOW()
        )
        ON CONFLICT (tenant_id, bucket_name, usage_date)
        DO UPDATE SET
          current_version_bytes = EXCLUDED.current_version_bytes,
          bytes_standard = EXCLUDED.bytes_standard,
          object_count = EXCLUDED.object_count,
          avg_object_size_bytes = EXCLUDED.avg_object_size_bytes,
          access_count = EXCLUDED.access_count,
          noncurrent_version_bytes = EXCLUDED.noncurrent_version_bytes,
          updated_at = NOW()
      `,
      {
        replacements: {
          tenantId: scope.tenant_id,
          cloudConnectionId: scope.cloud_connection_id,
          billingSourceId: scope.id,
          usageDate,
          bucketName: `${BUCKET_PREFIX}growth`,
          objectCount: isSpikeDay ? 4_500_000 : 1_500_000,
          currentVersionBytes: currentBytes,
          avgObjectSizeBytes: 5 * 1024 * 1024,
          bytesStandard: currentBytes,
          accessCount: isSpikeDay ? 120_000 : 20_000,
          noncurrentVersionBytes: isSpikeDay ? Math.floor(currentBytes * 0.2) : Math.floor(currentBytes * 0.05),
        },
        type: QueryTypes.INSERT,
      },
    );
    inserted += 1;
  }

  return inserted;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const scope = await resolveScope(options);
  const today = new Date();
  const start = addDays(today, -(options.days - 1));
  const dates = Array.from({ length: options.days }, (_, i) => toDateOnly(addDays(start, i)));

  const insertedCostRows = await seedS3CostDaily(scope, dates);
  const insertedStorageRows = await seedS3StorageLensDaily(scope, dates);

  console.info("S3 anomaly dummy source data seeded", {
    tenantId: scope.tenant_id,
    billingSourceId: scope.id,
    cloudConnectionId: scope.cloud_connection_id,
    bucketPrefix: BUCKET_PREFIX,
    days: options.days,
    dates,
    insertedCostRows,
    insertedStorageRows,
    note: "No rows inserted into fact_anomalies. Run anomaly detectors after this seed.",
  });
}

main()
  .catch((error) => {
    console.error("seed-s3-anomaly-dummy-data failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

