import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS s3_bucket_config_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cloud_connection_id UUID,
  billing_source_id BIGINT,
  provider_id BIGINT,
  account_id VARCHAR(20) NOT NULL,
  bucket_name TEXT NOT NULL,
  region VARCHAR(64),
  scan_time TIMESTAMP NOT NULL DEFAULT now(),
  lifecycle_status VARCHAR(64),
  lifecycle_rules_count INTEGER,
  lifecycle_rules_json JSONB,
  encryption_status VARCHAR(64),
  encryption_type VARCHAR(64),
  kms_key_id TEXT,
  public_access_block_status VARCHAR(64),
  block_public_acls BOOLEAN,
  ignore_public_acls BOOLEAN,
  block_public_policy BOOLEAN,
  restrict_public_buckets BOOLEAN,
  policy_public_status VARCHAR(64),
  versioning_status VARCHAR(64),
  mfa_delete_status VARCHAR(64),
  logging_status VARCHAR(64),
  logging_target_bucket TEXT,
  logging_target_prefix TEXT,
  replication_status VARCHAR(64),
  replication_rules_count INTEGER,
  replication_config_json JSONB,
  ownership_status VARCHAR(64),
  raw_errors_json JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_s3_bucket_config_snapshot_tenant_bucket_scan
  ON s3_bucket_config_snapshot(tenant_id, bucket_name, scan_time DESC);

CREATE INDEX IF NOT EXISTS idx_s3_bucket_config_snapshot_conn
  ON s3_bucket_config_snapshot(cloud_connection_id);

CREATE INDEX IF NOT EXISTS idx_s3_bucket_config_snapshot_source
  ON s3_bucket_config_snapshot(billing_source_id);

CREATE INDEX IF NOT EXISTS idx_s3_bucket_config_snapshot_account
  ON s3_bucket_config_snapshot(account_id);
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS s3_bucket_config_snapshot;
`);
  },
};

export default migration;

