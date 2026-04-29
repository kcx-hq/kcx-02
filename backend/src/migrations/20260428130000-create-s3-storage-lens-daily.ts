import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS s3_storage_lens_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cloud_connection_id UUID,
  billing_source_id BIGINT,
  provider_id BIGINT,
  region_key BIGINT,
  sub_account_key BIGINT,
  usage_date DATE NOT NULL,
  bucket_name TEXT NOT NULL,
  object_count NUMERIC(30,0),
  current_version_bytes NUMERIC(30,0),
  avg_object_size_bytes NUMERIC(30,6),
  bytes_standard NUMERIC(30,0),
  bytes_standard_ia NUMERIC(30,0),
  bytes_onezone_ia NUMERIC(30,0),
  bytes_intelligent_tiering NUMERIC(30,0),
  bytes_glacier NUMERIC(30,0),
  bytes_deep_archive NUMERIC(30,0),
  access_count NUMERIC(30,0),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_s3_storage_lens_daily_tenant_bucket_date
  ON s3_storage_lens_daily(tenant_id, bucket_name, usage_date);

CREATE INDEX IF NOT EXISTS idx_s3_storage_lens_daily_tenant_date
  ON s3_storage_lens_daily(tenant_id, usage_date);

CREATE INDEX IF NOT EXISTS idx_s3_storage_lens_daily_bucket
  ON s3_storage_lens_daily(bucket_name);

CREATE INDEX IF NOT EXISTS idx_s3_storage_lens_daily_provider
  ON s3_storage_lens_daily(provider_id);

CREATE INDEX IF NOT EXISTS idx_s3_storage_lens_daily_billing_source
  ON s3_storage_lens_daily(billing_source_id);
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS s3_storage_lens_daily;
`);
  },
};

export default migration;
