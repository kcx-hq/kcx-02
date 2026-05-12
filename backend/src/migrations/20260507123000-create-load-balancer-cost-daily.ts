import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS load_balancer_cost_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cloud_connection_id UUID,
  account_id VARCHAR(20) NOT NULL,
  region VARCHAR(64) NOT NULL,
  load_balancer_arn TEXT NOT NULL,
  usage_date DATE NOT NULL,
  total_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  fixed_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  lcu_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  data_processing_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  processed_bytes_gb NUMERIC(18,6) NOT NULL DEFAULT 0,
  usage_quantity NUMERIC(18,6) NOT NULL DEFAULT 0,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
  line_item_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_cost_daily_identity
  ON load_balancer_cost_daily(cloud_connection_id, account_id, region, load_balancer_arn, usage_date);

CREATE INDEX IF NOT EXISTS idx_lb_cost_daily_cloud_connection_id
  ON load_balancer_cost_daily(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_lb_cost_daily_account_id
  ON load_balancer_cost_daily(account_id);
CREATE INDEX IF NOT EXISTS idx_lb_cost_daily_region
  ON load_balancer_cost_daily(region);
CREATE INDEX IF NOT EXISTS idx_lb_cost_daily_load_balancer_arn
  ON load_balancer_cost_daily(load_balancer_arn);
CREATE INDEX IF NOT EXISTS idx_lb_cost_daily_usage_date
  ON load_balancer_cost_daily(usage_date);
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS load_balancer_cost_daily;
`);
  },
};

export default migration;

