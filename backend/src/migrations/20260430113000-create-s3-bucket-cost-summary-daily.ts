import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS s3_bucket_cost_summary_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cloud_connection_id UUID,
  billing_source_id BIGINT,
  provider_id BIGINT,
  account_id VARCHAR(20),
  bucket_name TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  last_seen_usage_date DATE,
  mtd_bucket_cost NUMERIC(20,12),
  last_30d_bucket_cost NUMERIC(20,12),
  request_cost_30d NUMERIC(20,12),
  storage_cost_30d NUMERIC(20,12),
  transfer_cost_30d NUMERIC(20,12),
  active_days_30d INTEGER,
  top_operations_json JSONB,
  regions_seen_json JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_s3_bucket_cost_summary_daily_scope
  ON s3_bucket_cost_summary_daily(tenant_id, billing_source_id, bucket_name, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_s3_bucket_cost_summary_daily_tenant_date
  ON s3_bucket_cost_summary_daily(tenant_id, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_s3_bucket_cost_summary_daily_conn
  ON s3_bucket_cost_summary_daily(cloud_connection_id);
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS s3_bucket_cost_summary_daily;
`);
  },
};

export default migration;

