import { sequelize } from "../src/models/index.js";
import { processPendingCloudTrailFiles } from "../src/features/cloud-connections/aws/exports/aws-cloudtrail-file-processing.service.js";

type CliArgs = {
  limit: number;
};

const parseArgs = (argv: string[]): CliArgs => {
  const args = argv.slice(2);
  const parsedLimit = Number(args[0]);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : 25;

  return { limit };
};

async function main(): Promise<void> {
  const { limit } = parseArgs(process.argv);

  console.info("Starting CloudTrail file processing run", { limit });
  const summary = await processPendingCloudTrailFiles({ limit });

  console.info("CloudTrail file processing run completed", {
    pendingFound: summary.pendingFound,
    processed: summary.processed,
    failed: summary.failed,
    skipped: summary.skipped,
  });
}

main()
  .catch((error) => {
    console.error(
      "CloudTrail file processing failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
