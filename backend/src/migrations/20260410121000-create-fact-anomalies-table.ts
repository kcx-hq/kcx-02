/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "fact_anomalies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "cloud_connection_id" uuid REFERENCES "cloud_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "detected_at" timestamp NOT NULL,
  "usage_date" date NOT NULL,
  "anomaly_scope" text,
  "service_key" bigint REFERENCES "dim_service"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "region_key" bigint REFERENCES "dim_region"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "resource_key" bigint REFERENCES "dim_resource"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "expected_cost" numeric(18, 6),
  "actual_cost" numeric(18, 6),
  "delta_cost" numeric(18, 6),
  "anomaly_type" varchar(50),
  "baseline_type" varchar(50),
  "delta_percent" numeric(10, 4),
  "currency_code" varchar(10) DEFAULT 'USD',
  "confidence_score" numeric(5, 2),
  "source_granularity" varchar(20),
  "source_table" varchar(100),
  "sub_account_key" bigint REFERENCES "dim_sub_account"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "billing_source_id" bigint NOT NULL REFERENCES "billing_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "explanation_json" jsonb,
  "metadata_json" jsonb,
  "first_seen_at" timestamp,
  "last_seen_at" timestamp,
  "resolved_at" timestamp,
  "ignored_reason" text,
  "fingerprint" varchar(255),
  "severity" text NOT NULL DEFAULT 'medium',
  "status" text NOT NULL DEFAULT 'open',
  "root_cause_hint" text,
  "created_at" timestamp DEFAULT NOW(),
  CONSTRAINT "chk_fact_anomalies_severity" CHECK ("severity" IN ('low', 'medium', 'high')),
  CONSTRAINT "chk_fact_anomalies_status" CHECK ("status" IN ('open', 'resolved', 'ignored')),
  CONSTRAINT "chk_fact_anomalies_anomaly_type"
    CHECK (
      "anomaly_type" IS NULL OR
      "anomaly_type" IN (
        'cost_spike',
        'cost_drop',
        'service_cost_anomaly',
        'region_cost_anomaly',
        'sub_account_cost_anomaly',
        'tag_cost_anomaly',
        'usage_spike',
        'usage_drop',
        'usage_mismatch',
        'idle_cost',
        'data_transfer_spike',
        'storage_growth',
        'pricing_rate_change',
        'commitment_coverage_drop',
        'recurring_pattern_break',
        'change_event_correlated',
        'forecast_deviation',
        'resource_cost_anomaly',
        'spike',
        'drop'
      )
    ),
  CONSTRAINT "chk_fact_anomalies_baseline_type"
    CHECK (
      "baseline_type" IS NULL OR
      "baseline_type" IN ('rolling_7d', 'same_weekday_4w', 'hourly_pattern', 'same_hour_7d', 'rolling_median')
    ),
  CONSTRAINT "chk_fact_anomalies_source_granularity"
    CHECK (
      "source_granularity" IS NULL OR
      "source_granularity" IN ('daily', 'hourly')
    )
);

CREATE INDEX IF NOT EXISTS "idx_fact_anomalies_tenant_id" ON "fact_anomalies" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_fact_anomalies_connection_date" ON "fact_anomalies" ("cloud_connection_id", "usage_date");
CREATE INDEX IF NOT EXISTS "idx_fact_anomalies_status" ON "fact_anomalies" ("status");
CREATE INDEX IF NOT EXISTS "idx_fact_anomalies_severity" ON "fact_anomalies" ("severity");
CREATE INDEX IF NOT EXISTS "idx_fact_anomalies_tenant_usage_date_type" ON "fact_anomalies" ("tenant_id", "usage_date", "anomaly_type");
CREATE INDEX IF NOT EXISTS "idx_fact_anomalies_connection_usage_date_status" ON "fact_anomalies" ("cloud_connection_id", "usage_date", "status");
CREATE INDEX IF NOT EXISTS "idx_fact_anomalies_service_usage_date" ON "fact_anomalies" ("service_key", "usage_date");
CREATE INDEX IF NOT EXISTS "idx_fact_anomalies_sub_account_key" ON "fact_anomalies" ("sub_account_key");
CREATE INDEX IF NOT EXISTS "idx_fact_anomalies_billing_source_id" ON "fact_anomalies" ("billing_source_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fact_anomalies_fingerprint"
  ON "fact_anomalies" ("fingerprint")
  WHERE "fingerprint" IS NOT NULL;
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS "fact_anomalies";
`);
  },
};

export default migration;

