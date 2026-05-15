import { DbAwsError, backfillRdsAuroraMetricsFromCurrentSnapshots } from "../src/features/database/aws/index.js";
import { sequelize } from "../src/models/index.js";

type ScriptArgs = {
  tenantId: string;
  connectionId: string;
  roleSource: "billing" | "action" | "auto";
  authMode: "assume-role" | "env-creds";
  region?: string;
  days: number;
  persist: boolean;
  accessKeyId: string | null;
  secretAccessKey: string | null;
  sessionToken: string | null;
};

const parseArgs = (): ScriptArgs => {
  const args = process.argv.slice(2);
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "";
    if (value) values.set(key, value);
    else flags.add(key);
  }

  const tenantId = String(values.get("tenant-id") ?? "").trim();
  const connectionId = String(values.get("connection-id") ?? "").trim();
  const roleSourceRaw = String(values.get("role-source") ?? "auto").trim().toLowerCase();
  const authModeRaw = String(values.get("auth-mode") ?? "assume-role").trim().toLowerCase();
  const region = String(values.get("region") ?? "").trim() || undefined;
  const daysRaw = Number(values.get("days") ?? "7");
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.floor(daysRaw) : 7;
  const persist = flags.has("persist");
  const accessKeyId = String(values.get("access-key-id") ?? process.env.AWS_ACCESS_KEY_ID ?? "").trim() || null;
  const secretAccessKey = String(values.get("secret-access-key") ?? process.env.AWS_SECRET_ACCESS_KEY ?? "").trim() || null;
  const sessionToken = String(values.get("session-token") ?? process.env.AWS_SESSION_TOKEN ?? "").trim() || null;

  if (!tenantId || !connectionId) {
    throw new Error(
      "Usage: tsx scripts/verify-db-aws-rds-aurora-metrics-backfill.ts --tenant-id <uuid> --connection-id <uuid> [--days 7] [--role-source billing|action|auto] [--region us-east-1] [--persist]",
    );
  }

  const roleSource =
    roleSourceRaw === "billing" || roleSourceRaw === "action" || roleSourceRaw === "auto"
      ? (roleSourceRaw as ScriptArgs["roleSource"])
      : "auto";
  const authMode = authModeRaw === "env-creds" ? "env-creds" : "assume-role";
  if (authMode === "env-creds" && (!accessKeyId || !secretAccessKey)) {
    throw new Error("auth-mode env-creds requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (or --access-key-id/--secret-access-key).");
  }

  return {
    tenantId,
    connectionId,
    roleSource,
    authMode,
    region,
    days,
    persist,
    accessKeyId,
    secretAccessKey,
    sessionToken,
  };
};

async function main(): Promise<void> {
  const args = parseArgs();

  const result = await backfillRdsAuroraMetricsFromCurrentSnapshots({
    tenantId: args.tenantId,
    cloudConnectionId: args.connectionId,
    roleSource: args.roleSource,
    region: args.region ?? null,
    days: args.days,
    persist: args.persist,
    staticCredentials:
      args.authMode === "env-creds" && args.accessKeyId && args.secretAccessKey
        ? {
          accessKeyId: args.accessKeyId,
          secretAccessKey: args.secretAccessKey,
          sessionToken: args.sessionToken,
        }
        : null,
  });

  console.info(
    JSON.stringify(
      {
        mode: args.persist ? "persist" : "dry-run",
        tenantId: result.tenantId,
        connectionId: result.cloudConnectionId,
        roleSourceUsed: result.roleSourceUsed,
        regionResolved: result.regionResolved,
        days: result.days,
        resourcesScanned: result.resourcesScanned,
        generatedMetricRows: result.generatedMetricRows,
        persistedRows: result.persistedRows,
        skippedInvalid: result.skippedInvalid,
        sampleResourceIds: result.sampleResourceIds,
      },
      null,
      2,
    ),
  );

  console.table(result.dailyBreakdown);
}

main()
  .catch((error: unknown) => {
    if (error instanceof DbAwsError) {
      console.error(
        JSON.stringify(
          {
            name: error.name,
            code: error.code,
            message: error.message,
            details: error.details ?? null,
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
      return;
    }

    console.error("Backfill verification failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
