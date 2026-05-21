import { Ec2InstanceUtilizationDailyRepository } from "../src/features/scheduled-jobs/handlers/ec2/ec2-instance-utilization-daily.repository.js";
import { syncEc2InstanceDailyFact } from "../src/features/scheduled-jobs/handlers/ec2/ec2-instance-daily-fact.service.js";
import { CloudConnectionV2, sequelize } from "../src/models/index.js";
import util from "node:util";

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

  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = String(args[i] ?? "").trim();
    if (!arg) continue;

    if (arg.includes("=")) {
      const [rawKey, ...rawValueParts] = arg.split("=");
      const key = rawKey.trim();
      const value = rawValueParts.join("=").trim();
      if (!value) continue;

      if (key === "--tenant-id") options.tenantId = value;
      if (key === "--provider-id") options.providerId = value;
      if (key === "--cloud-connection-id") options.cloudConnectionId = value;
      if (key === "--start-date") options.startDate = value;
      if (key === "--end-date") options.endDate = value;
      continue;
    }

    const key = arg;
    const next = String(args[i + 1] ?? "").trim();
    const value = next && !next.startsWith("--") ? next : "";
    if (!value) continue;

    if (key === "--tenant-id") options.tenantId = value;
    if (key === "--provider-id") options.providerId = value;
    if (key === "--cloud-connection-id") options.cloudConnectionId = value;
    if (key === "--start-date") options.startDate = value;
    if (key === "--end-date") options.endDate = value;

    i += 1;
  }

  return options;
};

const printUsageAndExit = (message?: string): never => {
  if (message) {
    console.error(message);
  }
  console.info(`
Usage:
  node dist/scripts/backfill-ec2-instance-daily.js --start-date=YYYY-MM-DD --end-date=YYYY-MM-DD [options]

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

  console.info("Starting fact_ec2_instance_daily backfill", {
    startDate,
    endDate,
    tenantId: options.tenantId,
    providerId: options.providerId,
    cloudConnectionId: options.cloudConnectionId,
    connections: connections.length,
  });

  const utilizationRepository = new Ec2InstanceUtilizationDailyRepository();
  for (const connection of connections) {
    const cloudConnectionId = String(connection.id);
    const tenantId = connection.tenantId ? String(connection.tenantId) : null;
    const providerId = connection.providerId ? String(connection.providerId) : null;

    let utilization: { hourlySourceRows: number; dailyRowsUpserted: number };
    try {
      utilization = await utilizationRepository.rollupFromHourly({
        cloudConnectionId,
        tenantId,
        providerId,
        startDate,
        endDate,
      });
    } catch (error) {
      console.error("Utilization daily rollup failed", {
        cloudConnectionId,
        tenantId,
        providerId,
        startDate,
        endDate,
      });
      console.error("Utilization daily rollup error (inspect):", util.inspect(error, { depth: 10, colors: false }));
      throw error;
    }

    let fact: { rowsUpserted: number };
    try {
      fact = await syncEc2InstanceDailyFact({
        cloudConnectionId,
        tenantId,
        providerId,
        startDate,
        endDate,
      });
    } catch (error) {
      console.error("EC2 instance daily unified fact sync failed", {
        cloudConnectionId,
        tenantId,
        providerId,
        startDate,
        endDate,
      });
      console.error("Unified fact sync error (inspect):", util.inspect(error, { depth: 10, colors: false }));
      throw error;
    }

    console.info("Backfilled cloud connection", {
      cloudConnectionId,
      tenantId,
      providerId,
      hourlySourceRows: utilization.hourlySourceRows,
      dailyRowsUpserted: utilization.dailyRowsUpserted,
      factDailyRowsUpserted: fact.rowsUpserted,
    });
  }

  console.info("fact_ec2_instance_daily backfill completed");
}

main()
  .catch((error) => {
    const details =
      error && typeof error === "object"
        ? {
            name: (error as { name?: unknown }).name,
            message: (error as { message?: unknown }).message,
            stack: (error as { stack?: unknown }).stack,
            parent: (error as { parent?: unknown }).parent,
            original: (error as { original?: unknown }).original,
            sql: (error as { sql?: unknown }).sql,
            parameters: (error as { parameters?: unknown }).parameters,
            errors: (error as { errors?: unknown }).errors,
          }
        : null;
    console.error(
      "fact_ec2_instance_daily backfill failed:",
      error instanceof Error ? error.message : String(error),
    );
    console.error("fact_ec2_instance_daily backfill failed (inspect):", util.inspect(error, { depth: 10, colors: false }));
    if (details) {
      console.error("fact_ec2_instance_daily backfill failure details:", details);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

