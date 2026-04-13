/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS client_cloud_accounts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id BIGINT NOT NULL REFERENCES cloud_providers(id) ON DELETE RESTRICT,
  cloud_connection_id UUID NULL REFERENCES cloud_connections(id) ON DELETE SET NULL,
  account_id VARCHAR(50) NOT NULL,
  account_name VARCHAR(255) NULL,
  onboarding_status VARCHAR(30) NOT NULL DEFAULT 'connected',
  compute_optimizer_enabled BOOLEAN NOT NULL DEFAULT false,
  last_recommendation_sync_at TIMESTAMP NULL,
  last_sync_status VARCHAR(30) NULL,
  last_sync_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_client_cloud_accounts_tenant_provider_account
    UNIQUE (tenant_id, provider_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_client_cloud_accounts_tenant
  ON client_cloud_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_cloud_accounts_connection
  ON client_cloud_accounts(cloud_connection_id);
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS client_cloud_accounts;
`);
  },
};

export default migration;

