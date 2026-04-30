import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS s3_policy_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cloud_connection_id UUID,
  billing_source_id BIGINT,
  provider_id BIGINT,
  service_name VARCHAR(32) NOT NULL DEFAULT 'S3',
  policy_type VARCHAR(64) NOT NULL DEFAULT 'LIFECYCLE',
  account_id VARCHAR(20),
  region VARCHAR(64),
  bucket_name TEXT NOT NULL,
  rule_name TEXT,
  scope_type VARCHAR(32),
  scope_prefix TEXT,
  status VARCHAR(32) NOT NULL,
  error_message TEXT,
  request_payload_json JSONB,
  response_payload_json JSONB,
  created_by_user_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_s3_policy_action_logs_tenant_created
  ON s3_policy_action_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_s3_policy_action_logs_bucket
  ON s3_policy_action_logs(bucket_name);
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS s3_policy_action_logs;
`);
  },
};

export default migration;
