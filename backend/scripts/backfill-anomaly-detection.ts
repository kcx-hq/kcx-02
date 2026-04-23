import { QueryTypes } from "sequelize";

import { createAnomalyDetectionRun, getAnomalyDetectionRunById } from "../src/features/dashboard/anomaly-alerts/anomaly-detection-run.service.js";
import { executeAnomalyDetectionRun } from "../src/features/dashboard/anomaly-alerts/anomaly-execution.service.js";
import { sequelize } from "../src/models/index.js";

type CliOptions = {
  fromDate: string;
  toDate: string;
  billingSourceId: string | null;
  tenantId: string | null;
};

type SourceScopeRow = {
  billing_source_id: string;
  tenant_id: string | null;
  cloud_connection_id: string | null;
};

const DEFAULT_FROM_DATE = "2026-04-20";
const DEFAULT_TIMEZONE = "Asia/Kolkata";

const isValidDateOnly = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toISOString().slice(0, 10) === value;
};

const getTodayDateInTimezone = (timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
};

const normalizeDateInput = (value: string | undefined | null): string | null => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  if (normalized.toLowerCase() === "today") {
    return getTodayDateInTimezone(DEFAULT_TIMEZONE);
  }

  if (isValidDateOnly(normalized)) {
    return normalized;
  }

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!slashMatch) {
    return null;
  }

  const day = Number(slashMatch[1]);
  const month = Number(slashMatch[2]);
  const year = Number(slashMatch[3]);
  const rebuilt = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  if (!isValidDateOnly(rebuilt)) {
    return null;
  }

  return rebuilt;
};

const parseArgs = (argv: string[]): CliOptions => {
  const today = getTodayDateInTimezone(DEFAULT_TIMEZONE);
  let fromDate: string = DEFAULT_FROM_DATE;
  let toDate: string = today;
  let billingSourceId: string | null = null;
  let tenantId: string | null = null;

  for (const rawArg of argv.slice(2)) {
    const arg = String(rawArg ?? "").trim();
    if (!arg) continue;

    const [rawKey, ...valueParts] = arg.split("=");
    const key = rawKey.trim();
    const value = valueParts.join("=").trim();

    if (key === "--from-date" && value) {
      const parsed = normalizeDateInput(value);
      if (!parsed) {
        throw new Error(`Invalid --from-date value: ${value}`);
      }
      fromDate = parsed;
      continue;
    }

    if (key === "--to-date" && value) {
      const parsed = normalizeDateInput(value);
      if (!parsed) {
        throw new Error(`Invalid --to-date value: ${value}`);
      }
      toDate = parsed;
      continue;
    }

    if (key === "--billing-source-id" && value) {
      if (!/^\d+$/.test(value)) {
        throw new Error(`Invalid --billing-source-id value: ${value}`);
      }
      billingSourceId = value;
      continue;
    }

    if (key === "--tenant-id" && value) {
      tenantId = value;
      continue;
    }
  }

  if (fromDate > toDate) {
    throw new Error(`Invalid date range: fromDate (${fromDate}) must be <= toDate (${toDate})`);
  }

  return {
    fromDate,
    toDate,
    billingSourceId,
    tenantId,
  };
};

const printUsage = (): void => {
  console.info(`
Usage:
  node dist/scripts/backfill-anomaly-detection.js [options]

Options:
  --from-date=<YYYY-MM-DD|D/M/YYYY|today>    Start date (default: 2026-04-20)
  --to-date=<YYYY-MM-DD|D/M/YYYY|today>      End date (default: today in Asia/Kolkata)
  --billing-source-id=<id>                   Optional: limit to one billing source
  --tenant-id=<id>                           Optional: limit to one tenant
`);
};

const loadSourceScopes = async (options: CliOptions): Promise<SourceScopeRow[]> => {
  const rows = await sequelize.query<SourceScopeRow>(
    `
      SELECT DISTINCT
        bs.id::text AS billing_source_id,
        bs.tenant_id::text AS tenant_id,
        bs.cloud_connection_id::text AS cloud_connection_id
      FROM billing_sources bs
      WHERE EXISTS (
        SELECT 1
        FROM agg_cost_daily acd
        WHERE acd.billing_source_id = bs.id
          AND acd.usage_date BETWEEN :fromDate AND :toDate
      )
        AND (:billingSourceId IS NULL OR bs.id = CAST(:billingSourceId AS BIGINT))
        AND (:tenantId IS NULL OR bs.tenant_id::text = :tenantId)
      ORDER BY bs.id::text ASC
    `,
    {
      replacements: {
        fromDate: options.fromDate,
        toDate: options.toDate,
        billingSourceId: options.billingSourceId,
        tenantId: options.tenantId,
      },
      type: QueryTypes.SELECT,
    },
  );

  return rows;
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv);

  console.info("Starting anomaly backfill from existing billing data", {
    fromDate: options.fromDate,
    toDate: options.toDate,
    billingSourceId: options.billingSourceId,
    tenantId: options.tenantId,
  });

  const sourceScopes = await loadSourceScopes(options);
  if (sourceScopes.length === 0) {
    console.info("No billing sources found with aggregated data in the requested date range.");
    return;
  }

  let processed = 0;
  let failed = 0;

  for (const source of sourceScopes) {
    try {
      const run = await createAnomalyDetectionRun({
        triggerType: "system",
        mode: "date_range",
        billingSourceId: source.billing_source_id,
        tenantId: source.tenant_id,
        cloudConnectionId: source.cloud_connection_id,
        dateFrom: options.fromDate,
        dateTo: options.toDate,
        includeHourly: false,
        forceRebuild: true,
        statusMessage: `Backfill anomaly detection for ${options.fromDate} to ${options.toDate}`,
        metadataJson: {
          source: "backfill_script",
          script: "backfill-anomaly-detection",
          requestedDateFrom: options.fromDate,
          requestedDateTo: options.toDate,
          requestedAt: new Date().toISOString(),
        },
      });

      await executeAnomalyDetectionRun(run.id);

      const completedRun = await getAnomalyDetectionRunById(run.id);
      processed += 1;

      console.info("Anomaly backfill run completed", {
        runId: run.id,
        billingSourceId: source.billing_source_id,
        status: completedRun?.status ?? "unknown",
        anomaliesCreated: completedRun?.anomaliesCreated ?? 0,
        anomaliesUpdated: completedRun?.anomaliesUpdated ?? 0,
        anomaliesResolved: completedRun?.anomaliesResolved ?? 0,
      });
    } catch (error) {
      failed += 1;
      console.error("Anomaly backfill run failed", {
        billingSourceId: source.billing_source_id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.info("Anomaly backfill finished", {
    totalSources: sourceScopes.length,
    processed,
    failed,
    fromDate: options.fromDate,
    toDate: options.toDate,
  });
}

main()
  .catch((error) => {
    console.error(
      "Anomaly backfill script failed:",
      error instanceof Error ? error.message : String(error),
    );
    printUsage();
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
