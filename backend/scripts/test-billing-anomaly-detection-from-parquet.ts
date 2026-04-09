import { sequelize } from "../src/models/index.js";
import { runAnomalyBackfillTest } from "../src/features/dashboard/anomaly-alerts/anomaly-backfill-test.service.js";

type CliArgs = {
  tenantId: string;
  connectionId?: string;
  fileKey?: string;
  ingestionRunId?: string;
  billingSourceId?: string;
  from?: string;
  to?: string;
  syntheticIfNoAnomaly: boolean;
  cleanup: boolean;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
};

const parseArgs = (argv: string[]): CliArgs => {
  const map = new Map<string, string>();
  for (const token of argv.slice(2)) {
    if (!token.startsWith("--")) continue;
    const eqIndex = token.indexOf("=");
    if (eqIndex < 0) {
      map.set(token.slice(2), "true");
      continue;
    }
    map.set(token.slice(2, eqIndex), token.slice(eqIndex + 1));
  }

  return {
    tenantId: String(map.get("tenantId") ?? "").trim(),
    connectionId: String(map.get("connectionId") ?? "").trim() || undefined,
    fileKey: String(map.get("fileKey") ?? "").trim() || undefined,
    ingestionRunId: String(map.get("ingestionRunId") ?? "").trim() || undefined,
    billingSourceId: String(map.get("billingSourceId") ?? "").trim() || undefined,
    from: String(map.get("from") ?? "").trim() || undefined,
    to: String(map.get("to") ?? "").trim() || undefined,
    syntheticIfNoAnomaly: parseBoolean(map.get("syntheticIfNoAnomaly"), true),
    cleanup: parseBoolean(map.get("cleanup"), false),
  };
};

const printUsage = (): void => {
  console.info(`Usage:
  node dist/scripts/test-billing-anomaly-detection-from-parquet.js --tenantId=<tenant-id> [options]

Options:
  --connectionId=<cloud-connection-id>     Manually ingest latest export file for the connection
  --fileKey=<s3-object-key>                Manually ingest a specific export file key (requires --connectionId)
  --ingestionRunId=<run-id>                Use a specific ingestion run
  --billingSourceId=<billing-source-id>    Scope to billing source when selecting latest completed run
  --from=YYYY-MM-DD                        Optional lower date bound
  --to=YYYY-MM-DD                          Optional upper date bound
  --syntheticIfNoAnomaly=true|false        Default true
  --cleanup=true|false                     Restore synthetic aggregate row and remove synthetic anomalies (default false)
`);
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!args.tenantId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.info("[anomaly-backfill-test] cli-start", args);

  const result = await runAnomalyBackfillTest({
    tenantId: args.tenantId,
    ...(args.connectionId ? { connectionId: args.connectionId } : {}),
    ...(args.fileKey ? { fileKey: args.fileKey } : {}),
    ...(args.ingestionRunId ? { ingestionRunId: args.ingestionRunId } : {}),
    ...(args.billingSourceId ? { billingSourceId: args.billingSourceId } : {}),
    ...(args.from ? { from: args.from } : {}),
    ...(args.to ? { to: args.to } : {}),
    syntheticIfNoAnomaly: args.syntheticIfNoAnomaly,
    runCleanup: args.cleanup,
  });

  console.info("[anomaly-backfill-test] result", JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(
      "[anomaly-backfill-test] failed",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

