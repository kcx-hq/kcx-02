import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS s3_cost_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cloud_connection_id UUID,
  billing_source_id BIGINT,
  provider_id BIGINT,
  sub_account_key BIGINT,
  region_key BIGINT,
  account_id VARCHAR(20),
  region VARCHAR(64),
  bucket_name TEXT NOT NULL,
  usage_date DATE NOT NULL,
  cost_category VARCHAR(32) NOT NULL,
  storage_class VARCHAR(64) NOT NULL,
  usage_type TEXT NOT NULL,
  operation TEXT NOT NULL,
  product_family TEXT NOT NULL,
  pricing_unit VARCHAR(64) NOT NULL DEFAULT 'Units',
  total_cost NUMERIC(20,12) NOT NULL DEFAULT 0,
  usage_quantity NUMERIC(24,8) NOT NULL DEFAULT 0,
  currency_code VARCHAR(12) NOT NULL DEFAULT 'USD',
  line_item_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_s3_cost_daily_row
  ON s3_cost_daily(
    tenant_id, cloud_connection_id, billing_source_id, provider_id, sub_account_key, region_key,
    account_id, region, bucket_name, usage_date, cost_category, storage_class, usage_type, operation, product_family, pricing_unit, currency_code
  );

CREATE INDEX IF NOT EXISTS idx_s3_cost_daily_tenant_id
  ON s3_cost_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_s3_cost_daily_cloud_connection_id
  ON s3_cost_daily(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_s3_cost_daily_account_id
  ON s3_cost_daily(account_id);
CREATE INDEX IF NOT EXISTS idx_s3_cost_daily_region
  ON s3_cost_daily(region);
CREATE INDEX IF NOT EXISTS idx_s3_cost_daily_bucket_name
  ON s3_cost_daily(bucket_name);
CREATE INDEX IF NOT EXISTS idx_s3_cost_daily_usage_date
  ON s3_cost_daily(usage_date);
CREATE INDEX IF NOT EXISTS idx_s3_cost_daily_cost_category
  ON s3_cost_daily(cost_category);
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS s3_cost_daily;
`);
  },
};

export default migration;

