import { Op } from "sequelize";

import { upsertCostAggregationsForRun } from "../src/features/billing/services/cost-aggregation.service.js";
import { BillingIngestionRun, RawBillingFile, sequelize } from "../src/models/index.js";

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

    await upsertCostAggregationsForRun({
      ingestionRunId: run.id,
      tenantId: rawFile.tenantId,
      providerId: rawFile.cloudProviderId,
      billingSourceId: run.billingSourceId,
      uploadedBy: rawFile.uploadedBy,
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
