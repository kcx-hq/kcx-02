import { QueryTypes, type Transaction } from "sequelize";

import { ScheduledJob as ScheduledJobModel, sequelize } from "../../../models/index.js";
import type { ScheduledJob } from "../../../models/ec2/scheduled_jobs.js";

export class ScheduledJobsRepository {
  async claimDueScheduledJobs({
    limit,
  }: {
    limit: number;
  }): Promise<ScheduledJob[]> {
    if (!Number.isFinite(limit) || limit <= 0) {
      return [];
    }

    return sequelize.transaction(async (transaction: Transaction) => {
      const claimed = await sequelize.query<ScheduledJob>(
        `
          WITH due AS (
            SELECT id
            FROM scheduled_jobs
            WHERE is_enabled = true
              AND next_run_at IS NOT NULL
              AND next_run_at <= NOW()
              AND (last_status IS DISTINCT FROM 'running')
            ORDER BY next_run_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
          )
          UPDATE scheduled_jobs sj
          SET last_status = 'running',
              last_run_at = NOW(),
              updated_at = NOW()
          FROM due
          WHERE sj.id = due.id
          RETURNING sj.*;
        `,
        {
          bind: [Math.floor(limit)],
          type: QueryTypes.SELECT,
          transaction,
          model: ScheduledJobModel,
          mapToModel: true,
        },
      );

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
