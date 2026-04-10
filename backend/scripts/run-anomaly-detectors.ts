import { sequelize } from "../src/models/index.js";
import { runAnomalyDetectorsForDate } from "../src/features/dashboard/anomaly-alerts/anomaly.engine.js";

type CliArgs = {
  usageDate: string;
};

const parseArgs = (argv: string[]): CliArgs => {
  const dateArg = String(argv[2] ?? "").trim();
  return {
    usageDate: dateArg || new Date().toISOString().slice(0, 10),
  };
};

async function main(): Promise<void> {
  const { usageDate } = parseArgs(process.argv);
  console.info("Running anomaly detectors", { usageDate });
  const summary = await runAnomalyDetectorsForDate(usageDate);
  console.info("Anomaly detector run complete", {
    usageDate: summary.usageDate,
    detectorsRun: summary.detectorsRun,
    examined: summary.examined,
    anomaliesInserted: summary.anomaliesInserted,
    duplicatesSkipped: summary.duplicatesSkipped,
    failures: summary.failures,
  });
}

main()
  .catch((error) => {
    const message =
      (error instanceof Error && error.message) ||
      (typeof error === "object" && error && "parent" in error
        ? String((error as { parent?: { message?: string } }).parent?.message ?? "")
        : "") ||
      String(error);
    console.error("Anomaly detector run failed", {
      error: message,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
