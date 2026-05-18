import { ingestionOrchestrator } from "../src/features/billing/services/ingestion-orchestrator.service.js";
import { BillingIngestionRun, sequelize } from "../src/models/index.js";

type CliOptions = {
  runIds: string[];
};

const parseArgs = (argv: string[]): CliOptions => {
  const rawArgs = argv.slice(2);
  const parsedRunIds = new Set<string>();

  for (const rawArg of rawArgs) {
    const arg = String(rawArg ?? "").trim();
    if (!arg) continue;

    if (arg.startsWith("--run-id=")) {
      const value = arg.slice("--run-id=".length).trim();
      if (value) parsedRunIds.add(value);
      continue;
    }

    if (arg.startsWith("--run-ids=")) {
      const value = arg.slice("--run-ids=".length).trim();
      for (const candidate of value.split(",")) {
        const runId = candidate.trim();
        if (runId) parsedRunIds.add(runId);
      }
      continue;
    }

    // Support positional args as run IDs.
    if (!arg.startsWith("--")) {
      parsedRunIds.add(arg);
    }
  }

  return { runIds: [...parsedRunIds] };
};

const printUsage = (): void => {
  console.info(`
Usage:
  npm run reingest:billing:run -- --run-id=<id>
  npm run reingest:billing:run -- --run-ids=<id1,id2,...>
  npm run reingest:billing:run -- <id1> <id2> ...
`);
};

async function main(): Promise<void> {
  const { runIds } = parseArgs(process.argv);
  if (runIds.length === 0) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.info("Starting billing reingest for run(s)", { runIds });

  for (const runId of runIds) {
    const run = await BillingIngestionRun.findByPk(String(runId));
    if (!run) {
      console.warn("Skipping run: not found", { runId });
      continue;
    }

    console.info("Reingesting billing run", {
      runId: String(run.id),
      previousStatus: run.status ?? null,
      rawBillingFileId: String(run.rawBillingFileId ?? ""),
      billingSourceId: String(run.billingSourceId ?? ""),
    });

    await ingestionOrchestrator.processIngestionRun(String(run.id));

    const refreshed = await BillingIngestionRun.findByPk(String(run.id));
    console.info("Reingest completed for run", {
      runId: String(run.id),
      status: refreshed?.status ?? null,
      rowsRead: Number(refreshed?.rowsRead ?? 0),
      rowsLoaded: Number(refreshed?.rowsLoaded ?? 0),
      rowsFailed: Number(refreshed?.rowsFailed ?? 0),
      finishedAt: refreshed?.finishedAt ?? null,
    });
  }

  await ingestionOrchestrator.waitForPendingPostIngestionTasks();
  console.info("Billing run reingest script finished");
}

main()
  .catch((error) => {
    if (error instanceof Error) {
      console.error("Billing run reingest failed:", error.message);
      if (error.stack) {
        console.error(error.stack);
      }
    } else {
      console.error("Billing run reingest failed:", String(error));
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
