/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const TABLE_NAME = "fact_recommendation_actions";

const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  recommendation_id BIGINT NOT NULL REFERENCES fact_recommendations(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  requested_by_user_id VARCHAR(64) NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  instance_id VARCHAR(255) NULL,
  from_instance_type VARCHAR(100) NULL,
  to_instance_type VARCHAR(100) NULL,
  cloud_connection_id UUID NULL,
  aws_account_id VARCHAR(50) NULL,
  aws_region_code VARCHAR(50) NULL,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  idempotency_key VARCHAR(128) NULL,
  error_code VARCHAR(80) NULL,
  error_message TEXT NULL,
  details_json JSONB NULL,
  aws_request_ids_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_recommendation_actions_tenant_recommendation
  ON ${TABLE_NAME} (tenant_id, recommendation_id);

CREATE INDEX IF NOT EXISTS idx_fact_recommendation_actions_tenant_status_requested
  ON ${TABLE_NAME} (tenant_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_fact_recommendation_actions_recommendation_active
  ON ${TABLE_NAME} (tenant_id, recommendation_id, action_type)
  WHERE status IN ('QUEUED', 'RUNNING');

CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_recommendation_actions_idempotency
  ON ${TABLE_NAME} (tenant_id, recommendation_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS ${TABLE_NAME};
`);
  },
};

export default migration;

