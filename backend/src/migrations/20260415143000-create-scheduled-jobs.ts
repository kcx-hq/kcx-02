import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS "scheduled_jobs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    "job_type" varchar(100) NOT NULL,
    "tenant_id" uuid,
    "cloud_connection_id" uuid,
    "billing_source_id" bigint,
    "provider_id" bigint,

    "schedule_type" varchar(30) DEFAULT 'interval' NOT NULL,
    "cron_expression" varchar(100),
    "interval_minutes" integer,

    "is_enabled" boolean DEFAULT true NOT NULL,

    "lookback_hours" integer,
    "config_json" jsonb,

    "next_run_at" timestamp with time zone,
    "last_run_at" timestamp with time zone,
    "last_success_at" timestamp with time zone,
    "last_failure_at" timestamp with time zone,
    "last_status" varchar(30),
    "last_error_message" text,

    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT "chk_scheduled_jobs_job_type"
      CHECK ("job_type" IN (
        'ec2_inventory_sync',
        'ec2_metrics_sync',
        'ec2_daily_rollup'
      )),

    CONSTRAINT "chk_scheduled_jobs_schedule_type"
      CHECK ("schedule_type" IN ('interval', 'cron')),

    CONSTRAINT "chk_scheduled_jobs_schedule_config"
      CHECK (
        ("schedule_type" = 'interval' AND "interval_minutes" IS NOT NULL)
        OR
        ("schedule_type" = 'cron' AND "cron_expression" IS NOT NULL)
      ),

    CONSTRAINT "chk_scheduled_jobs_last_status"
      CHECK (
        "last_status" IS NULL
        OR "last_status" IN ('queued', 'running', 'completed', 'failed', 'disabled')
      ),

    CONSTRAINT "scheduled_jobs_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "scheduled_jobs_cloud_connection_id_fkey"
      FOREIGN KEY ("cloud_connection_id") REFERENCES "cloud_connections"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "scheduled_jobs_billing_source_id_fkey"
      FOREIGN KEY ("billing_source_id") REFERENCES "billing_sources"("id")
      ON DELETE SET NULL ON UPDATE CASCADE,

    CONSTRAINT "scheduled_jobs_provider_id_fkey"
      FOREIGN KEY ("provider_id") REFERENCES "cloud_providers"("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_scheduled_jobs_enabled_next_run"
ON "scheduled_jobs" ("is_enabled", "next_run_at");

CREATE INDEX IF NOT EXISTS "idx_scheduled_jobs_tenant_id"
ON "scheduled_jobs" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_scheduled_jobs_cloud_connection_id"
ON "scheduled_jobs" ("cloud_connection_id");

CREATE INDEX IF NOT EXISTS "idx_scheduled_jobs_billing_source_id"
ON "scheduled_jobs" ("billing_source_id");

CREATE INDEX IF NOT EXISTS "idx_scheduled_jobs_provider_id"
ON "scheduled_jobs" ("provider_id");

CREATE INDEX IF NOT EXISTS "idx_scheduled_jobs_job_type"
ON "scheduled_jobs" ("job_type");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_scheduled_jobs_connection_job_type"
ON "scheduled_jobs" ("cloud_connection_id", "job_type");
`);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS "scheduled_jobs";
`);
  },
};

export default migration;
