import { QueryTypes, type Transaction } from "sequelize";

import { ScheduledJob as ScheduledJobModel, sequelize } from "../../../models/index.js";
import type { ScheduledJob } from "../../../models/ec2/scheduled_jobs.js";

type RecoveredScheduledJobRow = {
  id: string;
  jobType: string;
  tenantId: string | null;
  cloudConnectionId: string | null;
  lastRunAt: Date | null;
  updatedAt: Date | null;
  staleReferenceAt: Date | null;
};

type ClaimedDueJobRow = {
  id: string;
  reclaimedFromStaleRunning: boolean;
  staleReferenceAt: Date | null;
  previousLastStatus: string | null;
};

export type ClaimedScheduledJob = ScheduledJob & {
  reclaimedFromStaleRunning?: boolean;
  staleReferenceAt?: Date | null;
  previousLastStatus?: string | null;
};

export class ScheduledJobsRepository {
  async recoverStaleRunningJobs({
    staleBefore,
    jobTypes,
    tenantId,
    cloudConnectionId,
    jobId,
    limit,
  }: {
    staleBefore: Date;
    jobTypes?: string[] | null;
    tenantId?: string | null;
    cloudConnectionId?: string | null;
    jobId?: string | null;
    limit?: number;
  }): Promise<RecoveredScheduledJobRow[]> {
    const jobTypeFilter =
      Array.isArray(jobTypes) && jobTypes.length > 0
        ? Array.from(new Set(jobTypes.map((value) => String(value ?? "").trim()).filter(Boolean)))
        : null;
    const normalizedTenantId = tenantId ? String(tenantId).trim() : null;
    const normalizedCloudConnectionId = cloudConnectionId
      ? String(cloudConnectionId).trim()
      : null;
    const normalizedJobId = jobId ? String(jobId).trim() : null;
    const normalizedLimit =
      Number.isFinite(limit) && Number(limit) > 0 ? Math.floor(Number(limit)) : 100;

    const bind: unknown[] = [staleBefore];
    let nextIndex = 2;
    const whereParts: string[] = [
      "sj.is_enabled = true",
      "sj.last_status = 'running'",
      `COALESCE(sj.last_run_at, sj.updated_at) <= $1`,
    ];

    if (jobTypeFilter && jobTypeFilter.length > 0) {
      whereParts.push(`sj.job_type = ANY($${nextIndex}::text[])`);
      bind.push(jobTypeFilter);
      nextIndex += 1;
    }

    if (normalizedTenantId) {
      whereParts.push(`sj.tenant_id = $${nextIndex}::uuid`);
      bind.push(normalizedTenantId);
      nextIndex += 1;
    }

    if (normalizedCloudConnectionId) {
      whereParts.push(`sj.cloud_connection_id = $${nextIndex}::uuid`);
      bind.push(normalizedCloudConnectionId);
      nextIndex += 1;
    }

    if (normalizedJobId) {
      whereParts.push(`sj.id = $${nextIndex}::uuid`);
      bind.push(normalizedJobId);
      nextIndex += 1;
    }

    const limitIndex = nextIndex;
    bind.push(normalizedLimit);

    return sequelize.transaction(async (transaction: Transaction) => {
      const rows = await sequelize.query<RecoveredScheduledJobRow>(
        `
          WITH stale AS (
            SELECT
              sj.id,
              COALESCE(sj.last_run_at, sj.updated_at) AS stale_reference_at
            FROM scheduled_jobs sj
            WHERE ${whereParts.join("\n              AND ")}
            ORDER BY COALESCE(sj.last_run_at, sj.updated_at) ASC
            LIMIT $${limitIndex}
            FOR UPDATE SKIP LOCKED
          )
          UPDATE scheduled_jobs sj
          SET last_status = 'queued',
              next_run_at = CASE
                WHEN sj.next_run_at IS NULL OR sj.next_run_at > NOW() THEN NOW()
                ELSE sj.next_run_at
              END,
              updated_at = NOW()
          FROM stale
          WHERE sj.id = stale.id
          RETURNING
            sj.id::text AS "id",
            sj.job_type AS "jobType",
            sj.tenant_id::text AS "tenantId",
            sj.cloud_connection_id::text AS "cloudConnectionId",
            sj.last_run_at AS "lastRunAt",
            sj.updated_at AS "updatedAt",
            stale.stale_reference_at AS "staleReferenceAt";
        `,
        {
          bind,
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      return rows;
    });
  }

  async claimDueScheduledJobs({
    limit,
    staleBefore,
  }: {
    limit: number;
    staleBefore: Date;
  }): Promise<ClaimedScheduledJob[]> {
    if (!Number.isFinite(limit) || limit <= 0) {
      return [];
    }
    const staleCutoff =
      staleBefore instanceof Date && Number.isFinite(staleBefore.getTime())
        ? staleBefore
        : new Date(0);
    const normalizedLimit = Math.floor(limit);

    return sequelize.transaction(async (transaction: Transaction) => {
      const dueRows = await sequelize.query<ClaimedDueJobRow>(
        `
          SELECT
            sj.id::text AS "id",
            (sj.last_status = 'running')::boolean AS "reclaimedFromStaleRunning",
            COALESCE(sj.last_run_at, sj.updated_at) AS "staleReferenceAt",
            sj.last_status AS "previousLastStatus"
          FROM scheduled_jobs sj
          WHERE sj.is_enabled = true
            AND sj.next_run_at IS NOT NULL
            AND sj.next_run_at <= NOW()
            AND (
              sj.last_status IS DISTINCT FROM 'running'
              OR (
                sj.job_type = 'ec2_inventory_sync'
                AND sj.last_status = 'running'
                AND COALESCE(sj.last_run_at, sj.updated_at) <= $2
              )
            )
          ORDER BY sj.next_run_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED;
        `,
        {
          bind: [normalizedLimit, staleCutoff],
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      if (dueRows.length === 0) {
        return [];
      }

      const dueIds = dueRows.map((row) => row.id);
      const claimedRows = await sequelize.query<ScheduledJob>(
        `
          UPDATE scheduled_jobs sj
          SET last_status = 'running',
              last_run_at = NOW(),
              updated_at = NOW()
          WHERE sj.id = ANY($1::uuid[])
          RETURNING sj.*;
        `,
        {
          bind: [dueIds],
          type: QueryTypes.SELECT,
          transaction,
          model: ScheduledJobModel,
          mapToModel: true,
        },
      );

      const dueOrderById = new Map<string, number>();
      const dueMetaById = new Map<string, ClaimedDueJobRow>();
      for (let index = 0; index < dueRows.length; index += 1) {
        const row = dueRows[index];
        dueOrderById.set(String(row.id), index);
        dueMetaById.set(String(row.id), row);
      }

      const claimed = claimedRows
        .map((job) => {
          const normalizedId = String(job.id);
          const meta = dueMetaById.get(normalizedId);
          const withMeta = job as ClaimedScheduledJob;
          if (meta) {
            withMeta.reclaimedFromStaleRunning = meta.reclaimedFromStaleRunning;
            withMeta.staleReferenceAt = meta.staleReferenceAt;
            withMeta.previousLastStatus = meta.previousLastStatus;
          }
          return withMeta;
        })
        .sort((left, right) => {
          const leftOrder = dueOrderById.get(String(left.id)) ?? Number.MAX_SAFE_INTEGER;
          const rightOrder = dueOrderById.get(String(right.id)) ?? Number.MAX_SAFE_INTEGER;
          return leftOrder - rightOrder;
        });

      return claimed;
    });
  }

  async markScheduledJobSuccess({
    jobId,
    nextRunAt,
  }: {
    jobId: string;
    nextRunAt: Date;
  }): Promise<void> {
    await sequelize.query(
      `
        UPDATE scheduled_jobs
        SET last_status = 'completed',
            last_success_at = NOW(),
            last_error_message = NULL,
            next_run_at = $1,
            updated_at = NOW()
        WHERE id = $2;
      `,
      {
        bind: [nextRunAt, jobId],
        type: QueryTypes.UPDATE,
      },
    );
  }

  async markScheduledJobFailure({
    jobId,
    errorMessage,
    nextRunAt,
  }: {
    jobId: string;
    errorMessage: string;
    nextRunAt: Date;
  }): Promise<void> {
    await sequelize.query(
      `
        UPDATE scheduled_jobs
        SET last_status = 'failed',
            last_failure_at = NOW(),
            last_error_message = $1,
            next_run_at = $2,
            updated_at = NOW()
        WHERE id = $3;
      `,
      {
        bind: [errorMessage, nextRunAt, jobId],
        type: QueryTypes.UPDATE,
      },
    );
  }
}
