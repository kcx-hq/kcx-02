/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "cloudtrail_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL,
  "cloud_connection_id" uuid NOT NULL,
  "trail_name" varchar(255) NOT NULL,
  "bucket_name" varchar(255) NOT NULL,
  "bucket_region" varchar(50),
  "prefix" varchar(1000),
  "is_multi_region" boolean DEFAULT true NOT NULL,
  "include_global_service_events" boolean DEFAULT true NOT NULL,
  "management_events_enabled" boolean DEFAULT true NOT NULL,
  "status" varchar(50) DEFAULT 'draft' NOT NULL,
  "last_validated_at" timestamp with time zone,
  "last_ingested_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "cloudtrail_sources"
  ADD CONSTRAINT "cloudtrail_sources_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cloudtrail_sources"
  ADD CONSTRAINT "cloudtrail_sources_cloud_connection_id_fkey"
  FOREIGN KEY ("cloud_connection_id") REFERENCES "cloud_connections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "idx_cloudtrail_sources_tenant_id"
  ON "cloudtrail_sources" ("tenant_id");

CREATE INDEX "idx_cloudtrail_sources_cloud_connection_id"
  ON "cloudtrail_sources" ("cloud_connection_id");

CREATE INDEX "idx_cloudtrail_sources_status"
  ON "cloudtrail_sources" ("status");

CREATE UNIQUE INDEX "uq_cloudtrail_sources_connection_trail"
  ON "cloudtrail_sources" ("cloud_connection_id", "trail_name");

CREATE TABLE "cloud_events" (
  "id" bigserial PRIMARY KEY,
  "tenant_id" uuid NOT NULL,
  "cloud_connection_id" uuid NOT NULL,
  "provider_id" bigint NOT NULL,
  "event_time" timestamp with time zone NOT NULL,
  "event_name" varchar(255) NOT NULL,
  "event_source" varchar(255),
  "event_category" varchar(100),
  "aws_account_id" varchar(50),
  "aws_region" varchar(50),
  "resource_id" text,
  "resource_name" text,
  "user_arn" text,
  "user_type" varchar(100),
  "request_id" varchar(255),
  "metadata_json" jsonb,
  "raw_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "cloud_events"
  ADD CONSTRAINT "cloud_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cloud_events"
  ADD CONSTRAINT "cloud_events_cloud_connection_id_fkey"
  FOREIGN KEY ("cloud_connection_id") REFERENCES "cloud_connections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cloud_events"
  ADD CONSTRAINT "cloud_events_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "cloud_providers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_cloud_events_tenant_time"
  ON "cloud_events" ("tenant_id", "event_time");

CREATE INDEX "idx_cloud_events_connection_time"
  ON "cloud_events" ("cloud_connection_id", "event_time");

CREATE INDEX "idx_cloud_events_resource_time"
  ON "cloud_events" ("resource_id", "event_time");

CREATE INDEX "idx_cloud_events_event_name_time"
  ON "cloud_events" ("event_name", "event_time");

CREATE INDEX "idx_cloud_events_event_source"
  ON "cloud_events" ("event_source");

CREATE TABLE "anomaly_contributors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "anomaly_id" uuid NOT NULL,
  "dimension_type" varchar(50) NOT NULL,
  "dimension_key" bigint,
  "dimension_value" text,
  "contribution_cost" numeric(18, 6),
  "contribution_percent" numeric(10, 4),
  "rank" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "anomaly_contributors"
  ADD CONSTRAINT "anomaly_contributors_anomaly_id_fkey"
  FOREIGN KEY ("anomaly_id") REFERENCES "fact_anomalies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "idx_anomaly_contributors_anomaly_id"
  ON "anomaly_contributors" ("anomaly_id");

CREATE INDEX "idx_anomaly_contributors_dimension_type"
  ON "anomaly_contributors" ("dimension_type");

CREATE INDEX "idx_anomaly_contributors_anomaly_rank"
  ON "anomaly_contributors" ("anomaly_id", "rank");

ALTER TABLE "fact_anomalies"
  ADD COLUMN "anomaly_type" varchar(50),
  ADD COLUMN "baseline_type" varchar(50),
  ADD COLUMN "delta_percent" numeric(10, 4),
  ADD COLUMN "currency_code" varchar(10) DEFAULT 'USD',
  ADD COLUMN "confidence_score" numeric(5, 2),
  ADD COLUMN "source_granularity" varchar(20),
  ADD COLUMN "source_table" varchar(100),
  ADD COLUMN "sub_account_key" bigint,
  ADD COLUMN "billing_source_id" bigint,
  ADD COLUMN "explanation_json" jsonb,
  ADD COLUMN "metadata_json" jsonb,
  ADD COLUMN "first_seen_at" timestamp,
  ADD COLUMN "last_seen_at" timestamp,
  ADD COLUMN "resolved_at" timestamp,
  ADD COLUMN "ignored_reason" text,
  ADD COLUMN "fingerprint" varchar(255);

ALTER TABLE "fact_anomalies"
  ADD CONSTRAINT "fact_anomalies_sub_account_key_fkey"
  FOREIGN KEY ("sub_account_key") REFERENCES "dim_sub_account"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fact_anomalies"
  ADD CONSTRAINT "fact_anomalies_billing_source_id_fkey"
  FOREIGN KEY ("billing_source_id") REFERENCES "billing_sources"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fact_anomalies"
  ADD CONSTRAINT "chk_fact_anomalies_anomaly_type"
  CHECK (
    "anomaly_type" IS NULL OR
    "anomaly_type" IN ('spike', 'drop', 'usage_mismatch', 'idle_cost')
  );

ALTER TABLE "fact_anomalies"
  ADD CONSTRAINT "chk_fact_anomalies_baseline_type"
  CHECK (
    "baseline_type" IS NULL OR
    "baseline_type" IN ('rolling_7d', 'same_weekday_4w', 'hourly_pattern')
  );

ALTER TABLE "fact_anomalies"
  ADD CONSTRAINT "chk_fact_anomalies_source_granularity"
  CHECK (
    "source_granularity" IS NULL OR
    "source_granularity" IN ('daily', 'hourly')
  );

CREATE INDEX "idx_fact_anomalies_tenant_usage_date_type"
  ON "fact_anomalies" ("tenant_id", "usage_date", "anomaly_type");

CREATE INDEX "idx_fact_anomalies_connection_usage_date_status"
  ON "fact_anomalies" ("cloud_connection_id", "usage_date", "status");

CREATE INDEX "idx_fact_anomalies_service_usage_date"
  ON "fact_anomalies" ("service_key", "usage_date");

CREATE INDEX "idx_fact_anomalies_sub_account_key"
  ON "fact_anomalies" ("sub_account_key");

CREATE INDEX "idx_fact_anomalies_billing_source_id"
  ON "fact_anomalies" ("billing_source_id");

CREATE UNIQUE INDEX "uq_fact_anomalies_fingerprint"
  ON "fact_anomalies" ("fingerprint")
  WHERE "fingerprint" IS NOT NULL;

ALTER TABLE "resource_utilization_daily"
  ADD COLUMN "resource_key" bigint,
  ADD COLUMN "provider_id" bigint,
  ADD COLUMN "region_key" bigint,
  ADD COLUMN "sub_account_key" bigint,
  ADD COLUMN "sample_count" integer DEFAULT 1,
  ADD COLUMN "metric_source" varchar(50),
  ADD COLUMN "disk_read_bytes" bigint,
  ADD COLUMN "disk_write_bytes" bigint,
  ADD COLUMN "max_cpu" numeric(10, 4),
  ADD COLUMN "max_memory" numeric(10, 4);

ALTER TABLE "resource_utilization_daily"
  ADD CONSTRAINT "resource_utilization_daily_resource_key_fkey"
  FOREIGN KEY ("resource_key") REFERENCES "dim_resource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "resource_utilization_daily"
  ADD CONSTRAINT "resource_utilization_daily_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "cloud_providers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "resource_utilization_daily"
  ADD CONSTRAINT "resource_utilization_daily_region_key_fkey"
  FOREIGN KEY ("region_key") REFERENCES "dim_region"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "resource_utilization_daily"
  ADD CONSTRAINT "resource_utilization_daily_sub_account_key_fkey"
  FOREIGN KEY ("sub_account_key") REFERENCES "dim_sub_account"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "resource_utilization_daily"
  ADD CONSTRAINT "chk_resource_utilization_daily_metric_source"
  CHECK (
    "metric_source" IS NULL OR
    "metric_source" IN ('cloudwatch_basic', 'cloudwatch_agent')
  );

CREATE INDEX "idx_rud_resource_key"
  ON "resource_utilization_daily" ("resource_key");

CREATE INDEX "idx_rud_provider_id"
  ON "resource_utilization_daily" ("provider_id");

CREATE INDEX "idx_rud_region_key"
  ON "resource_utilization_daily" ("region_key");

CREATE INDEX "idx_rud_sub_account_key"
  ON "resource_utilization_daily" ("sub_account_key");

ALTER TABLE "resource_inventory_snapshots"
  ADD COLUMN "resource_key" bigint,
  ADD COLUMN "service_key" bigint,
  ADD COLUMN "region_key" bigint,
  ADD COLUMN "sub_account_key" bigint,
  ADD COLUMN "is_current" boolean DEFAULT true NOT NULL,
  ADD COLUMN "deleted_at" timestamp;

ALTER TABLE "resource_inventory_snapshots"
  ADD CONSTRAINT "resource_inventory_snapshots_resource_key_fkey"
  FOREIGN KEY ("resource_key") REFERENCES "dim_resource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "resource_inventory_snapshots"
  ADD CONSTRAINT "resource_inventory_snapshots_service_key_fkey"
  FOREIGN KEY ("service_key") REFERENCES "dim_service"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "resource_inventory_snapshots"
  ADD CONSTRAINT "resource_inventory_snapshots_region_key_fkey"
  FOREIGN KEY ("region_key") REFERENCES "dim_region"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "resource_inventory_snapshots"
  ADD CONSTRAINT "resource_inventory_snapshots_sub_account_key_fkey"
  FOREIGN KEY ("sub_account_key") REFERENCES "dim_sub_account"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_ris_resource_key"
  ON "resource_inventory_snapshots" ("resource_key");

CREATE INDEX "idx_ris_service_key"
  ON "resource_inventory_snapshots" ("service_key");

CREATE INDEX "idx_ris_region_key"
  ON "resource_inventory_snapshots" ("region_key");

CREATE INDEX "idx_ris_sub_account_key"
  ON "resource_inventory_snapshots" ("sub_account_key");

CREATE INDEX "idx_ris_is_current"
  ON "resource_inventory_snapshots" ("is_current");
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS "idx_ris_is_current";
DROP INDEX IF EXISTS "idx_ris_sub_account_key";
DROP INDEX IF EXISTS "idx_ris_region_key";
DROP INDEX IF EXISTS "idx_ris_service_key";
DROP INDEX IF EXISTS "idx_ris_resource_key";

ALTER TABLE "resource_inventory_snapshots"
  DROP CONSTRAINT IF EXISTS "resource_inventory_snapshots_sub_account_key_fkey",
  DROP CONSTRAINT IF EXISTS "resource_inventory_snapshots_region_key_fkey",
  DROP CONSTRAINT IF EXISTS "resource_inventory_snapshots_service_key_fkey",
  DROP CONSTRAINT IF EXISTS "resource_inventory_snapshots_resource_key_fkey",
  DROP COLUMN IF EXISTS "deleted_at",
  DROP COLUMN IF EXISTS "is_current",
  DROP COLUMN IF EXISTS "sub_account_key",
  DROP COLUMN IF EXISTS "region_key",
  DROP COLUMN IF EXISTS "service_key",
  DROP COLUMN IF EXISTS "resource_key";

DROP INDEX IF EXISTS "idx_rud_sub_account_key";
DROP INDEX IF EXISTS "idx_rud_region_key";
DROP INDEX IF EXISTS "idx_rud_provider_id";
DROP INDEX IF EXISTS "idx_rud_resource_key";

ALTER TABLE "resource_utilization_daily"
  DROP CONSTRAINT IF EXISTS "chk_resource_utilization_daily_metric_source",
  DROP CONSTRAINT IF EXISTS "resource_utilization_daily_sub_account_key_fkey",
  DROP CONSTRAINT IF EXISTS "resource_utilization_daily_region_key_fkey",
  DROP CONSTRAINT IF EXISTS "resource_utilization_daily_provider_id_fkey",
  DROP CONSTRAINT IF EXISTS "resource_utilization_daily_resource_key_fkey",
  DROP COLUMN IF EXISTS "max_memory",
  DROP COLUMN IF EXISTS "max_cpu",
  DROP COLUMN IF EXISTS "disk_write_bytes",
  DROP COLUMN IF EXISTS "disk_read_bytes",
  DROP COLUMN IF EXISTS "metric_source",
  DROP COLUMN IF EXISTS "sample_count",
  DROP COLUMN IF EXISTS "sub_account_key",
  DROP COLUMN IF EXISTS "region_key",
  DROP COLUMN IF EXISTS "provider_id",
  DROP COLUMN IF EXISTS "resource_key";

DROP INDEX IF EXISTS "uq_fact_anomalies_fingerprint";
DROP INDEX IF EXISTS "idx_fact_anomalies_billing_source_id";
DROP INDEX IF EXISTS "idx_fact_anomalies_sub_account_key";
DROP INDEX IF EXISTS "idx_fact_anomalies_service_usage_date";
DROP INDEX IF EXISTS "idx_fact_anomalies_connection_usage_date_status";
DROP INDEX IF EXISTS "idx_fact_anomalies_tenant_usage_date_type";

ALTER TABLE "fact_anomalies"
  DROP CONSTRAINT IF EXISTS "chk_fact_anomalies_source_granularity",
  DROP CONSTRAINT IF EXISTS "chk_fact_anomalies_baseline_type",
  DROP CONSTRAINT IF EXISTS "chk_fact_anomalies_anomaly_type",
  DROP CONSTRAINT IF EXISTS "fact_anomalies_billing_source_id_fkey",
  DROP CONSTRAINT IF EXISTS "fact_anomalies_sub_account_key_fkey",
  DROP COLUMN IF EXISTS "fingerprint",
  DROP COLUMN IF EXISTS "ignored_reason",
  DROP COLUMN IF EXISTS "resolved_at",
  DROP COLUMN IF EXISTS "last_seen_at",
  DROP COLUMN IF EXISTS "first_seen_at",
  DROP COLUMN IF EXISTS "metadata_json",
  DROP COLUMN IF EXISTS "explanation_json",
  DROP COLUMN IF EXISTS "billing_source_id",
  DROP COLUMN IF EXISTS "sub_account_key",
  DROP COLUMN IF EXISTS "source_table",
  DROP COLUMN IF EXISTS "source_granularity",
  DROP COLUMN IF EXISTS "confidence_score",
  DROP COLUMN IF EXISTS "currency_code",
  DROP COLUMN IF EXISTS "delta_percent",
  DROP COLUMN IF EXISTS "baseline_type",
  DROP COLUMN IF EXISTS "anomaly_type";

DROP INDEX IF EXISTS "idx_anomaly_contributors_anomaly_rank";
DROP INDEX IF EXISTS "idx_anomaly_contributors_dimension_type";
DROP INDEX IF EXISTS "idx_anomaly_contributors_anomaly_id";
DROP TABLE IF EXISTS "anomaly_contributors";

DROP INDEX IF EXISTS "idx_cloud_events_event_source";
DROP INDEX IF EXISTS "idx_cloud_events_event_name_time";
DROP INDEX IF EXISTS "idx_cloud_events_resource_time";
DROP INDEX IF EXISTS "idx_cloud_events_connection_time";
DROP INDEX IF EXISTS "idx_cloud_events_tenant_time";
DROP TABLE IF EXISTS "cloud_events";

DROP INDEX IF EXISTS "uq_cloudtrail_sources_connection_trail";
DROP INDEX IF EXISTS "idx_cloudtrail_sources_status";
DROP INDEX IF EXISTS "idx_cloudtrail_sources_cloud_connection_id";
DROP INDEX IF EXISTS "idx_cloudtrail_sources_tenant_id";
DROP TABLE IF EXISTS "cloudtrail_sources";
`);
  },
};

export default migration;
