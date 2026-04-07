import { sequelize } from "../src/models/index.js";
import {
  manuallyIngestFile,
  manuallyIngestLatestFile,
} from "../src/features/cloud-connections/aws/exports/aws-export-ingestion.service.js";

type CliArgs = {
  connectionId: string;
  fileKey: string | null;
};

const parseArgs = (argv: string[]): CliArgs => {
  const args = argv.slice(2);
  const connectionId = String(args[0] ?? "").trim();
  const fileKey = String(args[1] ?? "").trim() || null;

  return {
    connectionId,
    fileKey,
  };
};

const printUsage = (): void => {
  console.error("Usage: node dist/scripts/manual-aws-export-ingestion.js <connectionId> [fileKey]");
};

async function main(): Promise<void> {
  const { connectionId, fileKey } = parseArgs(process.argv);

  if (!connectionId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.info("Starting AWS manual export ingestion", {
    connectionId,
    mode: fileKey ? "specific-file" : "latest-file",
  });

  const result = fileKey
    ? await manuallyIngestFile(connectionId, fileKey)
    : await manuallyIngestLatestFile(connectionId);

  console.info("Selected file", {
    fileKey: result.fileKey,
  });
  console.info("Ingestion summary", {
    fileKey: result.fileKey,
    recordsProcessed: result.recordsProcessed,
    message: result.message,
  });
}

main()
  .catch((error) => {
    console.error(
      "Manual AWS export ingestion failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
