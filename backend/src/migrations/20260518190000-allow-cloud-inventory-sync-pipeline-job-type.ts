import type { QueryInterface } from "sequelize";

const CONSTRAINT_NAME = "chk_scheduled_jobs_job_type";

const JOB_TYPES_WITH_PIPELINE = [
  "ec2_inventory_sync",
  "load_balancer_inventory_sync",
  "load_balancer_cost_aggregation",
  "load_balancer_metrics_sync",
  "ec2_metrics_sync",
  "ec2_daily_rollup",
  "ec2_hourly_retention_cleanup",
  "staging_cost_line_items_cleanup",
  "cloud_inventory_sync_pipeline",
];

const JOB_TYPES_BEFORE_PIPELINE = JOB_TYPES_WITH_PIPELINE.filter(
  (jobType) => jobType !== "cloud_inventory_sync_pipeline",
);

const buildConstraintSql = (jobTypes: string[]): string =>
  `
  DO $$
  BEGIN
    IF to_regclass('public.scheduled_jobs') IS NULL THEN
      RETURN;
    END IF;

    ALTER TABLE scheduled_jobs
      DROP CONSTRAINT IF EXISTS ${CONSTRAINT_NAME};

    ALTER TABLE scheduled_jobs
      ADD CONSTRAINT ${CONSTRAINT_NAME}
      CHECK (job_type = ANY (ARRAY[${jobTypes.map((jobType) => `'${jobType}'`).join(", ")}]::text[]));
  END $$;
  `;

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(buildConstraintSql(JOB_TYPES_WITH_PIPELINE));
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(buildConstraintSql(JOB_TYPES_BEFORE_PIPELINE));
}

