import { Op } from "sequelize";

import { syncDbCostHistoryForIngestionRun } from "../src/features/billing/services/db-cost-history.service.js";
import { BillingIngestionRun, RawBillingFile, sequelize } from "../src/models/index.js";

type IngestionRunWithRawFile = InstanceType<typeof BillingIngestionRun> & {
  RawBillingFile?: InstanceType<typeof RawBillingFile>;
};

type CliOptions = {
  ingestionRunId?: string;
  tenantId?: string;
  billingSourceId?: string;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const out: CliOptions = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--ingestion-run-id" && next) {
      out.ingestionRunId = next;
      i += 1;
      continue;
    }
    if (arg === "--tenant-id" && next) {
      out.tenantId = next;
      i += 1;
      continue;
    }
    if (arg === "--billing-source-id" && next) {
      out.billingSourceId = next;
      i += 1;
    }
  }
  return out;
};

async function main(): Promise<void> {
  const opts = parseArgs();

  const where: Record<string, unknown> = {
    status: {
      [Op.in]: ["completed", "completed_with_warnings"],
    },
  };
  if (opts.ingestionRunId) {
    where.id = Number(opts.ingestionRunId);
  }
  if (opts.billingSourceId) {
    where.billingSourceId = Number(opts.billingSourceId);
  }

  const runs = (await BillingIngestionRun.findAll({
    where,
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
    if (!rawFile) {
      skipped += 1;
      continue;
    }
    if (opts.tenantId && String(rawFile.tenantId) !== opts.tenantId) {
      skipped += 1;
      continue;
    }

    const providerId = rawFile.cloudProviderId;
    if (providerId == null) {
      skipped += 1;
      continue;
    }

    const result = await syncDbCostHistoryForIngestionRun({
      ingestionRunId: String(run.id),
      tenantId: String(rawFile.tenantId),
      providerId: String(providerId),
      billingSourceId: String(run.billingSourceId),
    });

    processed += 1;
    console.info("Rebuilt DB cost history", {
      runId: String(run.id),
      billingSourceId: String(run.billingSourceId),
      skipped: result.skipped,
      sourceRows: result.sourceRows,
      affectedDates: result.affectedDates.length,
      historyRowsWritten: result.historyRowsWritten,
      factRowsWritten: result.factRowsWritten,
    });
  }

  console.info("DB cost history backfill done", {
    totalRuns: runs.length,
    processed,
    skipped,
    filters: opts,
  });
}

main()
  .catch((error) => {
    console.error(
      "DB cost history backfill failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

