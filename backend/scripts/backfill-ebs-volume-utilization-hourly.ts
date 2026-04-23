import { syncEbsVolumeMetrics } from "../src/features/ec2/scheduled-jobs/handlers/ebs-volume-metrics-sync.service.js";
import { CloudConnectionV2, sequelize } from "../src/models/index.js";
import type { ScheduledJob } from "../src/models/ec2/scheduled_jobs.js";

type CliOptions = {
  tenantId: string | null;
  providerId: string | null;
  cloudConnectionId: string | null;
  lookbackHours: number;
};

const DEFAULT_LOOKBACK_HOURS = 24;

const parsePositiveInt = (value: string | undefined): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    tenantId: null,
    providerId: null,
    cloudConnectionId: null,
    lookbackHours: DEFAULT_LOOKBACK_HOURS,
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
    if (key === "--lookback-hours") {
      const parsed = parsePositiveInt(value);
      if (parsed) options.lookbackHours = parsed;
    }
  }

  return options;
};

const printUsage = (): void => {
  console.info(`
Usage:
  node dist/scripts/backfill-ebs-volume-utilization-hourly.js [options]

Options:
  --tenant-id=<uuid>               Optional tenant filter
  --provider-id=<id>               Optional provider filter
  --cloud-connection-id=<uuid>     Optional single cloud connection filter
  --lookback-hours=<n>             Optional lookback window in hours (default: 24, service max: 168)

Examples:
  node dist/scripts/backfill-ebs-volume-utilization-hourly.js --cloud-connection-id=<uuid> --lookback-hours=24
  node dist/scripts/backfill-ebs-volume-utilization-hourly.js --tenant-id=<uuid> --lookback-hours=72
`);
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv);

  const where: Record<string, unknown> = {};
  if (options.cloudConnectionId) where.id = options.cloudConnectionId;
  if (options.tenantId) where.tenantId = options.tenantId;
  if (options.providerId) where.providerId = options.providerId;

  const connections = await CloudConnectionV2.findAll({
    where,
    attributes: ["id", "tenantId", "providerId"],
    order: [["createdAt", "ASC"]],
  });

  console.info("Starting ebs_volume_utilization_hourly backfill", {
    tenantId: options.tenantId,
    providerId: options.providerId,
    cloudConnectionId: options.cloudConnectionId,
    lookbackHours: options.lookbackHours,
    connections: connections.length,
  });

  if (connections.length === 0) {
    console.info("No cloud connections matched the provided filters.");
    return;
  }

  const startedAt = Date.now();
  for (const connection of connections) {
    const cloudConnectionId = String(connection.id);
    const tenantId = connection.tenantId ? String(connection.tenantId) : null;
    const providerId = connection.providerId ? String(connection.providerId) : null;

    const job = {
      id: `manual-ebs-hourly-${cloudConnectionId}-${Date.now()}`,
      jobType: "ec2_metrics_sync",
      tenantId,
      cloudConnectionId,
      providerId,
      lookbackHours: options.lookbackHours,
      configJson: null,
    } as unknown as ScheduledJob;

    console.info("Syncing EBS volume hourly metrics for connection", {
      cloudConnectionId,
      tenantId,
      providerId,
      lookbackHours: options.lookbackHours,
    });

    await syncEbsVolumeMetrics(job);
  }

  console.info("ebs_volume_utilization_hourly backfill completed", {
    connections: connections.length,
    durationMs: Date.now() - startedAt,
  });
}

main()
  .catch((error) => {
    console.error(
      "ebs_volume_utilization_hourly backfill failed:",
      error instanceof Error ? error.message : String(error),
    );
    printUsage();
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
