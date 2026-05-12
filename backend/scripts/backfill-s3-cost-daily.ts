import { syncS3CostDaily } from "../src/features/billing/services/s3-cost-daily.service.js";
import { BillingSource, sequelize } from "../src/models/index.js";

type CliOptions = {
  tenantId: string | null;
  billingSourceId: string | null;
  cloudConnectionId: string | null;
  providerId: string | null;
  accountId: string | null;
  region: string | null;
  startDate: string | null;
  endDate: string | null;
  lastDays: number | null;
  currentOpenMonth: boolean;
  chunkDays: number;
  rebuildRange: boolean;
};

type DateRange = { startDate: string; endDate: string };

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parsePositiveInt = (value: string | undefined): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);
const startOfUtcMonth = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const dateFromDateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    tenantId: null,
    billingSourceId: null,
    cloudConnectionId: null,
    providerId: null,
    accountId: null,
    region: null,
    startDate: null,
    endDate: null,
    lastDays: null,
    currentOpenMonth: false,
    chunkDays: 14,
    rebuildRange: true,
  };

  for (const rawArg of argv.slice(2)) {
    const arg = String(rawArg ?? "").trim();
    if (!arg) continue;

    if (arg === "--current-open-month") {
      options.currentOpenMonth = true;
      continue;
    }
    if (arg === "--no-rebuild") {
      options.rebuildRange = false;
      continue;
    }

    const [rawKey, ...rawValueParts] = arg.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim();
    if (!value) continue;

    if (key === "--tenant-id") options.tenantId = value;
    if (key === "--billing-source-id") options.billingSourceId = value;
    if (key === "--cloud-connection-id") options.cloudConnectionId = value;
    if (key === "--provider-id") options.providerId = value;
    if (key === "--account-id") options.accountId = value;
    if (key === "--region") options.region = value;
    if (key === "--start-date") options.startDate = value;
    if (key === "--end-date") options.endDate = value;
    if (key === "--last-days") options.lastDays = parsePositiveInt(value);
    if (key === "--chunk-days") {
      const parsed = parsePositiveInt(value);
      if (parsed) options.chunkDays = parsed;
    }
  }

  return options;
};

const resolveDateRange = (options: CliOptions): DateRange => {
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
    return { startDate: toDateOnly(startOfUtcMonth(now)), endDate: toDateOnly(now) };
  }

  throw new Error("Provide either --start-date/--end-date, --last-days, or --current-open-month");
};

const splitDateRange = (range: DateRange, chunkDays: number): DateRange[] => {
  const chunks: DateRange[] = [];
  let cursor = dateFromDateOnly(range.startDate);
  const end = dateFromDateOnly(range.endDate);
  while (cursor <= end) {
    const chunkStart = new Date(cursor.getTime());
    const chunkEnd = new Date(Math.min(end.getTime(), chunkStart.getTime() + (chunkDays - 1) * MS_PER_DAY));
    chunks.push({ startDate: toDateOnly(chunkStart), endDate: toDateOnly(chunkEnd) });
    cursor = new Date(chunkEnd.getTime() + MS_PER_DAY);
  }
  return chunks;
};

const printUsage = (): void => {
  console.info(`
Usage:
  node dist/scripts/backfill-s3-cost-daily.js [options]

Options:
  --tenant-id=<uuid>               Optional tenant scope
  --billing-source-id=<id>         Optional billing source scope
  --cloud-connection-id=<uuid>     Optional cloud connection scope
  --provider-id=<id>               Optional provider scope
  --account-id=<value>             Optional account filter
  --region=<value>                 Optional region filter
  --start-date=YYYY-MM-DD          Explicit start date
  --end-date=YYYY-MM-DD            Explicit end date
  --last-days=<n>                  Backfill trailing N days
  --current-open-month             Backfill current UTC month (default when no date options)
  --chunk-days=<n>                 Split backfill into N-day chunks (default: 14)
  --no-rebuild                     Skip delete step and only upsert aggregated rows

Examples:
  node dist/scripts/backfill-s3-cost-daily.js --last-days=30
  node dist/scripts/backfill-s3-cost-daily.js --tenant-id=<uuid> --current-open-month
  node dist/scripts/backfill-s3-cost-daily.js --tenant-id=<uuid> --billing-source-id=123 --start-date=2026-04-01 --end-date=2026-04-30
`);
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const dateRange = resolveDateRange(options);
  const chunks = splitDateRange(dateRange, options.chunkDays);

  const where: Record<string, unknown> = {};
  if (options.tenantId) where.tenantId = options.tenantId;
  if (options.billingSourceId) where.id = Number(options.billingSourceId);
  if (options.providerId) where.cloudProviderId = Number(options.providerId);
  if (options.cloudConnectionId) where.cloudConnectionId = options.cloudConnectionId;

  const sources = await BillingSource.findAll({
    where,
    attributes: ["id", "tenantId", "cloudConnectionId", "cloudProviderId"],
    order: [["id", "ASC"]],
  });

  if (!sources.length) {
    console.info("No billing sources matched the filter. Nothing to backfill.");
    return;
  }

  console.info("Starting s3_cost_daily backfill", {
    range: dateRange,
    chunkDays: options.chunkDays,
    chunkCount: chunks.length,
    sources: sources.length,
    filters: {
      tenantId: options.tenantId,
      billingSourceId: options.billingSourceId,
      cloudConnectionId: options.cloudConnectionId,
      providerId: options.providerId,
      accountId: options.accountId,
      region: options.region,
      rebuildRange: options.rebuildRange,
    },
  });

  let totalDeleted = 0;
  let totalInserted = 0;
  let processedJobs = 0;

  for (const source of sources) {
    const tenantId = String(source.tenantId ?? "").trim();
    if (!tenantId) continue;

    const billingSourceId = Number(source.id);
    const cloudConnectionId = source.cloudConnectionId ? String(source.cloudConnectionId) : null;
    const providerId = Number(source.cloudProviderId);

    for (const chunk of chunks) {
      const startedAt = Date.now();
      const result = await syncS3CostDaily({
        tenantId,
        cloudConnectionId,
        billingSourceId,
        providerId,
        accountId: options.accountId,
        region: options.region,
        startDate: chunk.startDate,
        endDate: chunk.endDate,
        rebuildRange: options.rebuildRange,
      });

      totalDeleted += result.rowsDeleted;
      totalInserted += result.rowsInserted;
      processedJobs += 1;

      console.info("Backfilled chunk", {
        tenantId,
        billingSourceId,
        cloudConnectionId,
        providerId,
        startDate: chunk.startDate,
        endDate: chunk.endDate,
        rowsDeleted: result.rowsDeleted,
        rowsInserted: result.rowsInserted,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  console.info("s3_cost_daily backfill completed", {
    range: dateRange,
    processedJobs,
    rowsDeleted: totalDeleted,
    rowsInserted: totalInserted,
  });
}

main()
  .catch((error) => {
    console.error("s3_cost_daily backfill failed:", error instanceof Error ? error.message : String(error));
    printUsage();
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
