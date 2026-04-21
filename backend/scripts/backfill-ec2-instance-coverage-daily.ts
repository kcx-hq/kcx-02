import { syncEc2InstanceCoverageDaily } from "../src/features/ec2/scheduled-jobs/handlers/ec2-instance-coverage-daily.service.js";
import { sequelize } from "../src/models/index.js";

type CliOptions = {
  tenantId: string | null;
  startDate: string | null;
  endDate: string | null;
  lastDays: number | null;
  currentOpenMonth: boolean;
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parsePositiveInt = (value: string | undefined): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    tenantId: null,
    startDate: null,
    endDate: null,
    lastDays: null,
    currentOpenMonth: false,
  };

  for (const rawArg of argv.slice(2)) {
    const arg = String(rawArg ?? "").trim();
    if (!arg) continue;

    if (arg === "--current-open-month") {
      options.currentOpenMonth = true;
      continue;
    }

    const [rawKey, ...rawValueParts] = arg.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim();

    if (key === "--tenant-id" && value) options.tenantId = value;
    if (key === "--start-date" && value) options.startDate = value;
    if (key === "--end-date" && value) options.endDate = value;
    if (key === "--last-days" && value) options.lastDays = parsePositiveInt(value);
  }

  return options;
};

const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);
const startOfUtcMonth = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const resolveDateRange = (options: CliOptions): { startDate: string; endDate: string } => {
  if (options.startDate && options.endDate) {
    if (!DATE_ONLY_REGEX.test(options.startDate) || !DATE_ONLY_REGEX.test(options.endDate)) {
      throw new Error("--start-date and --end-date must be YYYY-MM-DD");
    }
    if (options.startDate > options.endDate) {
      throw new Error("--start-date must be <= --end-date");
    }
    return { startDate: options.startDate, endDate: options.endDate };
  }

  const now = new Date();
  if (options.lastDays && options.lastDays > 0) {
    const endDate = toDateOnly(now);
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - (options.lastDays - 1));
    return { startDate: toDateOnly(start), endDate };
  }

  const useOpenMonth = options.currentOpenMonth || (!options.startDate && !options.endDate && !options.lastDays);
  if (useOpenMonth) {
    const startDate = toDateOnly(startOfUtcMonth(now));
    const endDate = toDateOnly(now);
    return { startDate, endDate };
  }

  throw new Error("Provide either --start-date/--end-date, --last-days, or --current-open-month");
};

const printUsage = (): void => {
  console.info(`
Usage:
  node dist/scripts/backfill-ec2-instance-coverage-daily.js [options]

Options:
  --tenant-id=<uuid>            Optional tenant scope
  --start-date=YYYY-MM-DD       Explicit start date
  --end-date=YYYY-MM-DD         Explicit end date
  --last-days=<n>               Backfill trailing N days (example: 30)
  --current-open-month          Backfill from first day of current UTC month to today

Examples:
  node dist/scripts/backfill-ec2-instance-coverage-daily.js --last-days=30
  node dist/scripts/backfill-ec2-instance-coverage-daily.js --current-open-month
  node dist/scripts/backfill-ec2-instance-coverage-daily.js --tenant-id=<uuid> --start-date=2026-04-01 --end-date=2026-04-21
`);
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const { startDate, endDate } = resolveDateRange(options);

  const startedAt = Date.now();
  console.info("Starting fact_ec2_instance_coverage_daily backfill", {
    tenantId: options.tenantId,
    startDate,
    endDate,
  });

  const result = await syncEc2InstanceCoverageDaily({
    tenantId: options.tenantId ?? undefined,
    startDate,
    endDate,
  });

  console.info("fact_ec2_instance_coverage_daily backfill completed", {
    tenantId: options.tenantId,
    startDate,
    endDate,
    rowsUpserted: result.rowsUpserted,
    durationMs: Date.now() - startedAt,
  });
}

main()
  .catch((error) => {
    console.error(
      "fact_ec2_instance_coverage_daily backfill failed:",
      error instanceof Error ? error.message : String(error),
    );
    printUsage();
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
