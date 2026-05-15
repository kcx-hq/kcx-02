import { QueryTypes } from "sequelize";

import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { sequelize } from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";

type DeleteCountRow = {
  deleted_count: string | number;
};

const STAGING_RETENTION_DAYS = 2;
const ACTIVE_INGESTION_STATUSES = ["queued", "validating_schema", "reading_rows", "normalizing", "upserting_dimensions", "inserting_facts", "finalizing"];

const extractDeletedCount = (rows: DeleteCountRow[]): number => {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const raw = rows[0]?.deleted_count;
  const value = typeof raw === "number" ? raw : Number(raw ?? 0);
  return Number.isFinite(value) ? value : 0;
};

export async function handleStagingCostLineItemsCleanup(job: ScheduledJob): Promise<void> {
  const startedAt = Date.now();
  const cutoff = new Date(Date.now() - STAGING_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  logger.info("Staging cost line items cleanup started", {
    jobId: String(job.id),
    retentionDays: STAGING_RETENTION_DAYS,
    cutoffIso: cutoff.toISOString(),
  });

  const rows = await sequelize.query<DeleteCountRow>(
    `
      WITH deleted AS (
        DELETE FROM staging_cost_line_items s
        WHERE s.created_at < $1::timestamptz
          AND NOT EXISTS (
            SELECT 1
            FROM billing_ingestion_runs bir
            WHERE bir.id = s.ingestion_run_id
              AND bir.status = ANY($2::text[])
          )
        RETURNING 1
      )
      SELECT COUNT(*)::bigint AS deleted_count
      FROM deleted;
    `,
    {
      bind: [cutoff, ACTIVE_INGESTION_STATUSES],
      type: QueryTypes.SELECT,
    },
  );

  const deletedCount = extractDeletedCount(rows);

  logger.info("Staging cost line items cleanup completed", {
    jobId: String(job.id),
    retentionDays: STAGING_RETENTION_DAYS,
    cutoffIso: cutoff.toISOString(),
    deletedRows: deletedCount,
    durationMs: Date.now() - startedAt,
  });
}

