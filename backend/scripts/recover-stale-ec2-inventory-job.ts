import { QueryTypes } from "sequelize";

import { ScheduledJobsRepository } from "../src/features/ec2/scheduled-jobs/scheduled-jobs.repository.js";
import { sequelize } from "../src/models/index.js";

type CliOptions = {
  apply: boolean;
  jobId: string | null;
  tenantId: string | null;
  cloudConnectionId: string | null;
  staleAfterMinutes: number;
  limit: number;
};

type StaleJobCandidateRow = {
  id: string;
  jobType: string;
  tenantId: string | null;
  cloudConnectionId: string | null;
  lastStatus: string | null;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  updatedAt: Date | null;
  staleReferenceAt: Date | null;
};

const MINUTE_MS = 60_000;

const toTrimmed = (value: string | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

const parsePositiveInteger = (value: string | undefined): number | null => {
  const normalized = toTrimmed(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    apply: false,
    jobId: null,
    tenantId: null,
    cloudConnectionId: null,
    staleAfterMinutes: 360,
    limit: 25,
  };

  for (const rawArg of argv.slice(2)) {
    const arg = String(rawArg ?? "").trim();
    if (!arg) continue;

    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    const [rawKey, ...rawValueParts] = arg.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim();
    if (!value) continue;

    if (key === "--job-id") options.jobId = value;
    if (key === "--tenant-id") options.tenantId = value;
    if (key === "--cloud-connection-id") options.cloudConnectionId = value;
    if (key === "--stale-after-minutes") {
      const parsed = parsePositiveInteger(value);
      if (parsed) options.staleAfterMinutes = parsed;
    }
    if (key === "--limit") {
      const parsed = parsePositiveInteger(value);
      if (parsed) options.limit = parsed;
    }
  }

  return options;
};

const printUsage = (): void => {
  console.info(`
Usage:
  node dist/scripts/recover-stale-ec2-inventory-job.js [options]

Options:
  --apply                               Apply recovery update (default is dry-run preview)
  --job-id=<uuid>                       Optional: target one scheduled_jobs row
  --tenant-id=<uuid>                    Optional tenant scope
  --cloud-connection-id=<uuid>          Optional cloud connection scope
  --stale-after-minutes=<n>             Optional stale threshold in minutes (default: 360)
  --limit=<n>                           Optional max rows to recover/list (default: 25)

Examples:
  node dist/scripts/recover-stale-ec2-inventory-job.js --job-id=<uuid>
  node dist/scripts/recover-stale-ec2-inventory-job.js --apply --job-id=<uuid>
  node dist/scripts/recover-stale-ec2-inventory-job.js --apply --stale-after-minutes=720 --limit=10
`);
};

const buildCandidateQuery = (input: {
  staleBefore: Date;
  jobId: string | null;
  tenantId: string | null;
  cloudConnectionId: string | null;
  limit: number;
}): { sql: string; bind: unknown[] } => {
  const whereParts: string[] = [
    "sj.is_enabled = true",
    "sj.job_type = 'ec2_inventory_sync'",
    "sj.last_status = 'running'",
    "COALESCE(sj.last_run_at, sj.updated_at) <= $1",
  ];
  const bind: unknown[] = [input.staleBefore];
  let nextIndex = 2;

  if (input.jobId) {
    whereParts.push(`sj.id = $${nextIndex}::uuid`);
    bind.push(input.jobId);
    nextIndex += 1;
  }

  if (input.tenantId) {
    whereParts.push(`sj.tenant_id = $${nextIndex}::uuid`);
    bind.push(input.tenantId);
    nextIndex += 1;
  }

  if (input.cloudConnectionId) {
    whereParts.push(`sj.cloud_connection_id = $${nextIndex}::uuid`);
    bind.push(input.cloudConnectionId);
    nextIndex += 1;
  }

  const limitIndex = nextIndex;
  bind.push(input.limit);

  return {
    sql: `
      SELECT
        sj.id::text AS "id",
        sj.job_type AS "jobType",
        sj.tenant_id::text AS "tenantId",
        sj.cloud_connection_id::text AS "cloudConnectionId",
        sj.last_status AS "lastStatus",
        sj.next_run_at AS "nextRunAt",
        sj.last_run_at AS "lastRunAt",
        sj.updated_at AS "updatedAt",
        COALESCE(sj.last_run_at, sj.updated_at) AS "staleReferenceAt"
      FROM scheduled_jobs sj
      WHERE ${whereParts.join("\n        AND ")}
      ORDER BY COALESCE(sj.last_run_at, sj.updated_at) ASC
      LIMIT $${limitIndex};
    `,
    bind,
  };
};

const toIsoOrNull = (value: Date | null): string | null => {
  if (!value) return null;
  return new Date(value).toISOString();
};

const toAgeMinutes = (value: Date | null): number | null => {
  if (!value) return null;
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / MINUTE_MS);
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const staleBefore = new Date(Date.now() - options.staleAfterMinutes * MINUTE_MS);

  const previewQuery = buildCandidateQuery({
    staleBefore,
    jobId: options.jobId,
    tenantId: options.tenantId,
    cloudConnectionId: options.cloudConnectionId,
    limit: options.limit,
  });

  const candidates = await sequelize.query<StaleJobCandidateRow>(previewQuery.sql, {
    bind: previewQuery.bind,
    type: QueryTypes.SELECT,
  });

  console.info("Stale running ec2_inventory_sync candidates", {
    apply: options.apply,
    staleAfterMinutes: options.staleAfterMinutes,
    staleBefore: staleBefore.toISOString(),
    filters: {
      jobId: options.jobId,
      tenantId: options.tenantId,
      cloudConnectionId: options.cloudConnectionId,
      limit: options.limit,
    },
    candidateCount: candidates.length,
    candidates: candidates.map((row) => ({
      id: row.id,
      jobType: row.jobType,
      tenantId: row.tenantId,
      cloudConnectionId: row.cloudConnectionId,
      lastStatus: row.lastStatus,
      nextRunAt: toIsoOrNull(row.nextRunAt),
      lastRunAt: toIsoOrNull(row.lastRunAt),
      updatedAt: toIsoOrNull(row.updatedAt),
      staleReferenceAt: toIsoOrNull(row.staleReferenceAt),
      staleAgeMinutes: toAgeMinutes(row.staleReferenceAt),
    })),
  });

  if (!options.apply) {
    console.info("Dry run complete. Re-run with --apply to recover matching stale job(s).");
    return;
  }

  const repository = new ScheduledJobsRepository();
  const recovered = await repository.recoverStaleRunningJobs({
    staleBefore,
    jobTypes: ["ec2_inventory_sync"],
    jobId: options.jobId,
    tenantId: options.tenantId,
    cloudConnectionId: options.cloudConnectionId,
    limit: options.limit,
  });

  console.info("Recovered stale running ec2_inventory_sync job(s)", {
    recoveredCount: recovered.length,
    recovered: recovered.map((row) => ({
      id: row.id,
      jobType: row.jobType,
      tenantId: row.tenantId,
      cloudConnectionId: row.cloudConnectionId,
      lastRunAt: toIsoOrNull(row.lastRunAt),
      updatedAt: toIsoOrNull(row.updatedAt),
      staleReferenceAt: toIsoOrNull(row.staleReferenceAt),
    })),
  });
}

main()
  .catch((error) => {
    console.error(
      "recover-stale-ec2-inventory-job failed:",
      error instanceof Error ? error.message : String(error),
    );
    printUsage();
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

