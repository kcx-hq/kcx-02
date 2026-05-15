import { Op } from "sequelize";

import { upsertCostAggregationsForRun } from "../src/features/billing/services/cost-aggregation.service.js";
import { BillingIngestionRun, RawBillingFile, sequelize } from "../src/models/index.js";
import { QueryTypes } from "sequelize";

type IngestionRunWithRawFile = InstanceType<typeof BillingIngestionRun> & {
  RawBillingFile?: InstanceType<typeof RawBillingFile>;
};

async function main(): Promise<void> {
  console.info("Backfilling cost aggregation tables from completed ingestion runs...");

  await sequelize.query(`
TRUNCATE TABLE agg_cost_hourly;
TRUNCATE TABLE agg_cost_daily;
TRUNCATE TABLE agg_cost_monthly;
`);

  const runs = (await BillingIngestionRun.findAll({
    where: {
      status: {
        [Op.in]: ["completed", "completed_with_warnings"],
      },
    },
    include: [
      {
        model: RawBillingFile,
        required: true,
      },
    ],
    order: [["id", "ASC"]],
  })) as unknown as IngestionRunWithRawFile[];

  let processed = 0;
  let skipped = 0;

  for (const run of runs) {
    const rawFile = run.RawBillingFile;
    const rowsLoaded = Number(run.rowsLoaded ?? 0);

    if (!rawFile || rowsLoaded <= 0) {
      skipped += 1;
      continue;
    }

    const usageDateRows = await sequelize.query(
      `
        SELECT DISTINCT DATE(usage_start_time) AS usage_date
        FROM fact_cost_line_items
        WHERE ingestion_run_id = :ingestionRunId
          AND billing_source_id = :billingSourceId
          AND usage_start_time IS NOT NULL
        ORDER BY usage_date
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          ingestionRunId: String(run.id),
          billingSourceId: String(run.billingSourceId),
        },
      },
    );
    const affectedUsageDates = usageDateRows
      .map((row) => String((row as { usage_date?: string | null })?.usage_date ?? "").trim())
      .filter(Boolean);
    if (affectedUsageDates.length === 0) {
      skipped += 1;
      continue;
    }

    await upsertCostAggregationsForRun({
      ingestionRunId: run.id,
      tenantId: rawFile.tenantId,
      providerId: rawFile.cloudProviderId,
      billingSourceId: run.billingSourceId,
      uploadedBy: rawFile.uploadedBy,
      affectedUsageDates,
    });

    processed += 1;
    console.info("Backfilled run", {
      runId: String(run.id),
      rowsLoaded,
    });
  }

  console.info("Backfill completed", {
    totalRuns: runs.length,
    processed,
    skipped,
  });
}

main()
  .catch((error) => {
    console.error(
      "Backfill failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
