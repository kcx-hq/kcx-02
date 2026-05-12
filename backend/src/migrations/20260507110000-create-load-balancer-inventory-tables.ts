import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS load_balancers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cloud_connection_id UUID,
  account_id VARCHAR(20) NOT NULL,
  region VARCHAR(64) NOT NULL,
  arn TEXT NOT NULL,
  name TEXT,
  type VARCHAR(32),
  scheme VARCHAR(32),
  state VARCHAR(64),
  vpc_id TEXT,
  dns_name TEXT,
  created_at_aws TIMESTAMP,
  security_groups JSONB,
  availability_zones JSONB,
  tags JSONB,
  listener_count INTEGER,
  target_group_count INTEGER,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS load_balancer_target_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cloud_connection_id UUID,
  account_id VARCHAR(20) NOT NULL,
  region VARCHAR(64) NOT NULL,
  arn TEXT NOT NULL,
  name TEXT,
  load_balancer_arn TEXT,
  protocol VARCHAR(32),
  port INTEGER,
  target_type VARCHAR(32),
  vpc_id TEXT,
  health_check_protocol VARCHAR(32),
  health_check_path TEXT,
  healthy_target_count INTEGER,
  unhealthy_target_count INTEGER,
  tags JSONB,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS load_balancer_listeners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cloud_connection_id UUID,
  account_id VARCHAR(20) NOT NULL,
  region VARCHAR(64) NOT NULL,
  arn TEXT NOT NULL,
  load_balancer_arn TEXT,
  protocol VARCHAR(32),
  port INTEGER,
  ssl_policy TEXT,
  certificates JSONB,
  default_actions JSONB,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_load_balancers_identity
  ON load_balancers(cloud_connection_id, account_id, region, arn);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_target_groups_identity
  ON load_balancer_target_groups(cloud_connection_id, account_id, region, arn);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_listeners_identity
  ON load_balancer_listeners(cloud_connection_id, account_id, region, arn);

CREATE INDEX IF NOT EXISTS idx_load_balancers_cloud_connection_id
  ON load_balancers(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_load_balancers_account_id
  ON load_balancers(account_id);
CREATE INDEX IF NOT EXISTS idx_load_balancers_region
  ON load_balancers(region);
CREATE INDEX IF NOT EXISTS idx_load_balancers_arn
  ON load_balancers(arn);

CREATE INDEX IF NOT EXISTS idx_lb_target_groups_cloud_connection_id
  ON load_balancer_target_groups(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_lb_target_groups_account_id
  ON load_balancer_target_groups(account_id);
CREATE INDEX IF NOT EXISTS idx_lb_target_groups_region
  ON load_balancer_target_groups(region);
CREATE INDEX IF NOT EXISTS idx_lb_target_groups_arn
  ON load_balancer_target_groups(arn);
CREATE INDEX IF NOT EXISTS idx_lb_target_groups_load_balancer_arn
  ON load_balancer_target_groups(load_balancer_arn);

CREATE INDEX IF NOT EXISTS idx_lb_listeners_cloud_connection_id
  ON load_balancer_listeners(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_lb_listeners_account_id
  ON load_balancer_listeners(account_id);
CREATE INDEX IF NOT EXISTS idx_lb_listeners_region
  ON load_balancer_listeners(region);
CREATE INDEX IF NOT EXISTS idx_lb_listeners_arn
  ON load_balancer_listeners(arn);
CREATE INDEX IF NOT EXISTS idx_lb_listeners_load_balancer_arn
  ON load_balancer_listeners(load_balancer_arn);
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS load_balancer_listeners;
DROP TABLE IF EXISTS load_balancer_target_groups;
DROP TABLE IF EXISTS load_balancers;
`);
  },
};

export default migration;
