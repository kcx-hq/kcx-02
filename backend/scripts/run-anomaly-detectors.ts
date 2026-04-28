import { QueryTypes } from "sequelize";

import {
  createAnomalyDetectionRun,
  getAnomalyDetectionRunById,
} from "../src/features/dashboard/anomaly-alerts/anomaly-detection-run.service.js";
import { executeAnomalyDetectionRun } from "../src/features/dashboard/anomaly-alerts/anomaly-execution.service.js";
import { sequelize } from "../src/models/index.js";

type CliOptions = {
  billingSourceId: string | null;
  tenantId: string | null;
  fromDate: string | null;
  toDate: string | null;
};

type SourceScopeRow = {
  billing_source_id: string;
  tenant_id: string | null;
  cloud_connection_id: string | null;
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    billingSourceId: null,
    tenantId: null,
    fromDate: null,
    toDate: null,
  };

  for (const rawArg of argv.slice(2)) {
    const arg = String(rawArg ?? "").trim();
    if (!arg) continue;

    const [rawKey, ...valueParts] = arg.split("=");
    const key = rawKey.trim();
    const value = valueParts.join("=").trim();
    if (!value) continue;

    if (key === "--billing-source-id") {
      if (!/^\d+$/.test(value)) {
        throw new Error(`Invalid --billing-source-id value: ${value}`);
      }
      options.billingSourceId = value;
      continue;
    }

    if (key === "--tenant-id") {
      options.tenantId = value;
      continue;
    }

    if (key === "--from-date") {
      if (!DATE_ONLY_REGEX.test(value)) {
        throw new Error(`Invalid --from-date value: ${value}. Expected YYYY-MM-DD.`);
      }
      options.fromDate = value;
      continue;
    }

    if (key === "--to-date") {
      if (!DATE_ONLY_REGEX.test(value)) {
        throw new Error(`Invalid --to-date value: ${value}. Expected YYYY-MM-DD.`);
      }
      options.toDate = value;
      continue;
    }
  }

  if ((options.fromDate && !options.toDate) || (!options.fromDate && options.toDate)) {
    throw new Error("Provide both --from-date and --to-date together, or neither.");
  }
  if (options.fromDate && options.toDate && options.fromDate > options.toDate) {
    throw new Error("--from-date must be <= --to-date.");
  }

  return options;
};

const printUsage = (): void => {
  console.info(`
Usage:
  node dist/scripts/run-anomaly-detectors.js [options]

Options:
  --billing-source-id=<id>           Optional: limit to one billing source
  --tenant-id=<uuid>                 Optional: limit to one tenant
  --from-date=YYYY-MM-DD             Optional: run date_range mode
  --to-date=YYYY-MM-DD               Optional: run date_range mode

Notes:
  - Without date range, this runs in incremental mode.
  - With --from-date and --to-date, this runs in date_range mode.
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
      )
        AND (:billingSourceId IS NULL OR bs.id = CAST(:billingSourceId AS BIGINT))
        AND (:tenantId IS NULL OR bs.tenant_id::text = :tenantId)
      ORDER BY bs.id::text ASC
    `,
    {
      replacements: {
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
  const sourceScopes = await loadSourceScopes(options);

  if (sourceScopes.length === 0) {
    console.info("No billing sources found with agg_cost_daily data.");
    return;
  }

  const runMode = options.fromDate && options.toDate ? "date_range" : "incremental";

  console.info("Starting anomaly detector runs", {
    runMode,
    billingSourceId: options.billingSourceId,
    tenantId: options.tenantId,
    fromDate: options.fromDate,
    toDate: options.toDate,
    sourceCount: sourceScopes.length,
  });

  let processed = 0;
  let failed = 0;

  for (const source of sourceScopes) {
    try {
      const run = await createAnomalyDetectionRun({
        triggerType: "system",
        mode: runMode,
        billingSourceId: source.billing_source_id,
        tenantId: source.tenant_id,
        cloudConnectionId: source.cloud_connection_id,
        dateFrom: options.fromDate,
        dateTo: options.toDate,
        includeHourly: false,
        forceRebuild: true,
        statusMessage:
          runMode === "date_range"
            ? `CLI anomaly detection date_range ${options.fromDate}..${options.toDate}`
            : "CLI anomaly detection incremental run",
        metadataJson: {
          source: "run_anomaly_detectors_script",
          runMode,
          requestedDateFrom: options.fromDate,
          requestedDateTo: options.toDate,
          requestedAt: new Date().toISOString(),
        },
      });

      await executeAnomalyDetectionRun(run.id);
      const completed = await getAnomalyDetectionRunById(run.id);
      processed += 1;

      console.info("Anomaly run completed", {
        runId: run.id,
        billingSourceId: source.billing_source_id,
        status: completed?.status ?? "unknown",
        anomaliesCreated: completed?.anomaliesCreated ?? 0,
        anomaliesUpdated: completed?.anomaliesUpdated ?? 0,
        anomaliesResolved: completed?.anomaliesResolved ?? 0,
      });
    } catch (error) {
      failed += 1;
      console.error("Anomaly run failed", {
        billingSourceId: source.billing_source_id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.info("Anomaly detector run finished", {
    sourceCount: sourceScopes.length,
    processed,
    failed,
    runMode,
  });
}

main()
  .catch((error) => {
    console.error(
      "run-anomaly-detectors script failed:",
      error instanceof Error ? error.message : String(error),
    );
    printUsage();
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

