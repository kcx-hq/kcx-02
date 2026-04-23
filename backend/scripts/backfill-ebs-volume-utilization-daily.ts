import { EbsVolumeUtilizationDailyRepository } from "../src/features/ec2/scheduled-jobs/handlers/ebs-volume-utilization-daily.repository.js";
import { CloudConnectionV2, sequelize } from "../src/models/index.js";

type CliOptions = {
  tenantId: string | null;
  providerId: string | null;
  cloudConnectionId: string | null;
  startDate: string | null;
  endDate: string | null;
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    tenantId: null,
    providerId: null,
    cloudConnectionId: null,
    startDate: null,
    endDate: null,
  };

  for (const rawArg of argv.slice(2)) {
    const arg = String(rawArg ?? "").trim();
    if (!arg) continue;

    const [rawKey, ...rawValueParts] = arg.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim();
    if (!value) continue;

    if (key === "--tenant-id") options.tenantId = value;
    if (key === "--provider-id") options.providerId = value;
    if (key === "--cloud-connection-id") options.cloudConnectionId = value;
    if (key === "--start-date") options.startDate = value;
    if (key === "--end-date") options.endDate = value;
  }

  return options;
};

const printUsageAndExit = (message?: string): never => {
  if (message) {
    console.error(message);
  }
  console.info(`
Usage:
  node dist/scripts/backfill-ebs-volume-utilization-daily.js --start-date=YYYY-MM-DD --end-date=YYYY-MM-DD [options]

Options:
  --tenant-id=<uuid>               Filter by tenant id
  --provider-id=<id>               Filter by provider id
  --cloud-connection-id=<uuid>     Only backfill one cloud connection
`);
  process.exit(1);
};

const assertDateOnly = (value: string | null, flag: string): string => {
  const normalized = value?.trim() ?? "";
  if (!DATE_ONLY_REGEX.test(normalized)) {
    printUsageAndExit(`${flag} is required and must be YYYY-MM-DD`);
  }
  return normalized;
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const startDate = assertDateOnly(options.startDate, "--start-date");
  const endDate = assertDateOnly(options.endDate, "--end-date");
  if (startDate > endDate) {
    printUsageAndExit("--start-date must be less than or equal to --end-date");
  }

  const where: Record<string, unknown> = {};
  if (options.cloudConnectionId) where.id = options.cloudConnectionId;
  if (options.tenantId) where.tenantId = options.tenantId;
  if (options.providerId) where.providerId = options.providerId;

  const connections = await CloudConnectionV2.findAll({
    where,
    attributes: ["id", "tenantId", "providerId"],
    order: [["createdAt", "ASC"]],
  });

  console.info("Starting ebs_volume_utilization_daily backfill", {
    startDate,
    endDate,
    tenantId: options.tenantId,
    providerId: options.providerId,
    cloudConnectionId: options.cloudConnectionId,
    connections: connections.length,
  });

  const repository = new EbsVolumeUtilizationDailyRepository();
  for (const connection of connections) {
    const cloudConnectionId = String(connection.id);
    const tenantId = connection.tenantId ? String(connection.tenantId) : null;
    const providerId = connection.providerId ? String(connection.providerId) : null;

    const result = await repository.rollupFromHourly({
      cloudConnectionId,
      tenantId,
      providerId,
      startDate,
      endDate,
    });

    console.info("Backfilled cloud connection", {
      cloudConnectionId,
      tenantId,
      providerId,
      hourlySourceRows: result.hourlySourceRows,
      dailyRowsUpserted: result.dailyRowsUpserted,
    });
  }

  console.info("ebs_volume_utilization_daily backfill completed");
}

main()
  .catch((error) => {
    console.error(
      "ebs_volume_utilization_daily backfill failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
