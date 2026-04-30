import { Op } from "sequelize";

import { syncDbCostHistoryForIngestionRun } from "../src/features/billing/services/db-cost-history.service.js";
import { BillingIngestionRun, RawBillingFile, sequelize } from "../src/models/index.js";

type CliOptions = {
  tenantId: string | null;
  providerId: string | null;
  billingSourceId: string | null;
  runIds: Set<string>;
  runId: string | null;
  fromRunId: number | null;
  toRunId: number | null;
};

type IngestionRunWithRawFile = InstanceType<typeof BillingIngestionRun> & {
  RawBillingFile?: InstanceType<typeof RawBillingFile>;
};

const parseNumericArg = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    tenantId: null,
    providerId: null,
    billingSourceId: null,
    runIds: new Set<string>(),
    runId: null,
    fromRunId: null,
    toRunId: null,
  };

  for (const rawArg of argv.slice(2)) {
    const arg = String(rawArg ?? "").trim();
    if (!arg) continue;

    const [rawKey, ...rawValueParts] = arg.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim();

    if (key === "--tenant-id" && value) {
      options.tenantId = value;
      continue;
    }
    if (key === "--provider-id" && value) {
      options.providerId = value;
      continue;
    }
    if (key === "--billing-source-id" && value) {
      options.billingSourceId = value;
      continue;
    }
    if (key === "--run-ids" && value) {
      for (const candidate of value.split(",")) {
        const runId = candidate.trim();
        if (runId) options.runIds.add(runId);
      }
      continue;
    }
    if ((key === "--runId" || key === "--run-id") && value) {
      options.runId = value;
      options.runIds.add(value);
      continue;
    }
    if (key === "--from-run-id") {
      options.fromRunId = parseNumericArg(value) ?? options.fromRunId;
      continue;
    }
    if (key === "--to-run-id") {
      options.toRunId = parseNumericArg(value) ?? options.toRunId;
      continue;
    }
  }

  return options;
};

const printUsage = (): void => {
  console.info(`
Usage:
  node dist/scripts/backfill-db-explorer.js [options]

Options:
  --tenant-id=<uuid>              Filter by tenant id
  --provider-id=<id>              Filter by provider id
  --billing-source-id=<id>        Filter by billing source id
  --runId=<id>                    Process exactly one ingestion run id (alias: --run-id)
  --run-ids=<id1,id2,...>         Only process specific ingestion run ids
  --from-run-id=<id>              Process runs with id >= this value
  --to-run-id=<id>                Process runs with id <= this value
`);
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  console.info("Starting DB Explorer backfill from fact_cost_line_items...", {
    tenantId: options.tenantId,
    providerId: options.providerId,
    billingSourceId: options.billingSourceId,
    runId: options.runId,
    runIds: [...options.runIds],
    fromRunId: options.fromRunId,
    toRunId: options.toRunId,
  });

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
  let skippedNoDbRows = 0;
  let sourceRowsFound = 0;
  let historyRowsWritten = 0;
  let factRowsWritten = 0;

  for (const run of runs) {
    const rawFile = run.RawBillingFile;
    const runId = String(run.id);
    const rowsLoaded = Number(run.rowsLoaded ?? 0);

    if (!rawFile || rowsLoaded <= 0) {
      skipped += 1;
      continue;
    }

    if (options.runIds.size > 0 && !options.runIds.has(runId)) {
      skipped += 1;
      continue;
    }

    if (options.fromRunId !== null && Number(runId) < options.fromRunId) {
      skipped += 1;
      continue;
    }
    if (options.toRunId !== null && Number(runId) > options.toRunId) {
      skipped += 1;
      continue;
    }

    const tenantId = String(rawFile.tenantId);
    const providerId = String(rawFile.cloudProviderId);
    const billingSourceId = String(run.billingSourceId);

    if (options.tenantId && tenantId !== options.tenantId) {
      skipped += 1;
      continue;
    }
    if (options.providerId && providerId !== options.providerId) {
      skipped += 1;
      continue;
    }
    if (options.billingSourceId && billingSourceId !== options.billingSourceId) {
      skipped += 1;
      continue;
    }

    const result = await syncDbCostHistoryForIngestionRun({
      ingestionRunId: runId,
      tenantId,
      providerId,
      billingSourceId,
    });

    processed += 1;
    sourceRowsFound += result.sourceRows;
    historyRowsWritten += result.historyRowsWritten;
    factRowsWritten += result.factRowsWritten;
    if (result.skipped) {
      skippedNoDbRows += 1;
    }

    console.info("DB Explorer backfill run processed", {
      runId,
      tenantId,
      providerId,
      billingSourceId,
      skipped: result.skipped,
      sourceRows: result.sourceRows,
      affectedDateCount: result.affectedDates.length,
      affectedDateStart: result.affectedDates[0] ?? null,
      affectedDateEnd: result.affectedDates[result.affectedDates.length - 1] ?? null,
      historyRowsWritten: result.historyRowsWritten,
      factRowsWritten: result.factRowsWritten,
    });
  }

  console.info("DB Explorer backfill completed", {
    totalRuns: runs.length,
    processed,
    skipped,
    skippedNoDbRows,
    sourceRowsFound,
    historyRowsWritten,
    factRowsWritten,
  });
}

main()
  .catch((error) => {
    console.error(
      "DB Explorer backfill failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
