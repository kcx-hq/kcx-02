import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS load_balancer_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cloud_connection_id UUID,
  account_id VARCHAR(20) NOT NULL,
  region VARCHAR(64) NOT NULL,
  load_balancer_arn TEXT NOT NULL,
  metric_date DATE NOT NULL,
  request_count BIGINT NOT NULL DEFAULT 0,
  processed_bytes BIGINT NOT NULL DEFAULT 0,
  processed_gb NUMERIC(18,6) NOT NULL DEFAULT 0,
  active_connection_count BIGINT NOT NULL DEFAULT 0,
  new_connection_count BIGINT NOT NULL DEFAULT 0,
  active_flow_count BIGINT NOT NULL DEFAULT 0,
  new_flow_count BIGINT NOT NULL DEFAULT 0,
  healthy_host_count NUMERIC(12,4) NOT NULL DEFAULT 0,
  unhealthy_host_count NUMERIC(12,4) NOT NULL DEFAULT 0,
  target_response_time_avg NUMERIC(12,6) NOT NULL DEFAULT 0,
  elb_5xx_count BIGINT NOT NULL DEFAULT 0,
  target_5xx_count BIGINT NOT NULL DEFAULT 0,
  tcp_target_reset_count BIGINT NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_metrics_daily_identity
  ON load_balancer_metrics_daily(cloud_connection_id, account_id, region, load_balancer_arn, metric_date);

CREATE INDEX IF NOT EXISTS idx_lb_metrics_daily_cloud_connection_id
  ON load_balancer_metrics_daily(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_lb_metrics_daily_account_id
  ON load_balancer_metrics_daily(account_id);
CREATE INDEX IF NOT EXISTS idx_lb_metrics_daily_region
  ON load_balancer_metrics_daily(region);
CREATE INDEX IF NOT EXISTS idx_lb_metrics_daily_load_balancer_arn
  ON load_balancer_metrics_daily(load_balancer_arn);
CREATE INDEX IF NOT EXISTS idx_lb_metrics_daily_metric_date
  ON load_balancer_metrics_daily(metric_date);
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS load_balancer_metrics_daily;
`);
  },
};

export default migration;
