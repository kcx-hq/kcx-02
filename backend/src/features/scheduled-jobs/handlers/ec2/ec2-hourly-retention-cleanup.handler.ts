import { QueryTypes } from "sequelize";

import env from "../../../../config/env.js";
import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { sequelize } from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";

type CleanupTable = {
  tableName: "ec2_instance_utilization_hourly" | "ebs_volume_utilization_hourly" | "agg_cost_hourly";
  timestampColumn: "hour_start";
};

type DeleteCountRow = {
  deleted_count: string | number;
};

const CLEANUP_TABLES: CleanupTable[] = [
  { tableName: "ec2_instance_utilization_hourly", timestampColumn: "hour_start" },
  { tableName: "ebs_volume_utilization_hourly", timestampColumn: "hour_start" },
  { tableName: "agg_cost_hourly", timestampColumn: "hour_start" },
];

const normalizeRetentionDays = (job: ScheduledJob): number => {
  const config = (job.configJson ?? null) as Record<string, unknown> | null;
  const fromJobConfig = config?.retention_days;
  const parsed =
    typeof fromJobConfig === "number"
      ? fromJobConfig
      : typeof fromJobConfig === "string"
        ? Number(fromJobConfig)
        : NaN;

  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.trunc(parsed);
  }

  return env.ec2HourlyRetentionDays;
};

const extractDeletedCount = (rows: DeleteCountRow[]): number => {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const raw = rows[0]?.deleted_count;
  const value = typeof raw === "number" ? raw : Number(raw ?? 0);
  return Number.isFinite(value) ? value : 0;
};

async function deleteOlderThan(table: CleanupTable, cutoff: Date): Promise<number> {
  const rows = await sequelize.query<DeleteCountRow>(
    `
      WITH deleted AS (
        DELETE FROM ${table.tableName}
        WHERE ${table.timestampColumn} < $1::timestamptz
        RETURNING 1
      )
      SELECT COUNT(*)::bigint AS deleted_count
      FROM deleted;
    `,
    {
      bind: [cutoff],
      type: QueryTypes.SELECT,
    },
  );

  return extractDeletedCount(rows);
}

export async function handleEc2HourlyRetentionCleanup(job: ScheduledJob): Promise<void> {
  const retentionDays = normalizeRetentionDays(job);
  const startedAt = Date.now();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  logger.info("EC2 hourly retention cleanup started", {
    jobId: String(job.id),
    retentionDays,
    cutoffIso: cutoff.toISOString(),
  });

  const deletedByTable: Record<string, number> = {};
  for (const table of CLEANUP_TABLES) {
    const deletedCount = await deleteOlderThan(table, cutoff);
    deletedByTable[table.tableName] = deletedCount;

    logger.info("EC2 hourly retention cleanup table completed", {
      jobId: String(job.id),
      tableName: table.tableName,
      deletedRows: deletedCount,
      retentionDays,
      cutoffIso: cutoff.toISOString(),
    });
  }

  logger.info("EC2 hourly retention cleanup completed", {
    jobId: String(job.id),
    retentionDays,
    cutoffIso: cutoff.toISOString(),
    deletedByTable,
    durationMs: Date.now() - startedAt,
  });
}

