import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS cost_period_status (
  tenant_id uuid NOT NULL,
  provider_id bigint NOT NULL,
  billing_source_id bigint NOT NULL,
  period_month date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'open',
  snapshot_version integer NOT NULL DEFAULT 1,
  source_ingestion_run_id bigint,
  closed_at timestamp,
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  PRIMARY KEY (tenant_id, provider_id, billing_source_id, period_month)
);

ALTER TABLE cost_period_status
  DROP CONSTRAINT IF EXISTS chk_cost_period_status_status;
ALTER TABLE cost_period_status
  ADD CONSTRAINT chk_cost_period_status_status
  CHECK (status IN ('open', 'frozen', 'adjusted'));

CREATE INDEX IF NOT EXISTS idx_cost_period_status_lookup
  ON cost_period_status(tenant_id, provider_id, billing_source_id, period_month, status);
CREATE INDEX IF NOT EXISTS idx_cost_period_status_ingestion_run
  ON cost_period_status(source_ingestion_run_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_period_status_tenant_id') THEN
    ALTER TABLE cost_period_status
      ADD CONSTRAINT fk_cost_period_status_tenant_id
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_period_status_provider_id') THEN
    ALTER TABLE cost_period_status
      ADD CONSTRAINT fk_cost_period_status_provider_id
      FOREIGN KEY (provider_id) REFERENCES cloud_providers(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_period_status_billing_source_id') THEN
    ALTER TABLE cost_period_status
      ADD CONSTRAINT fk_cost_period_status_billing_source_id
      FOREIGN KEY (billing_source_id) REFERENCES billing_sources(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_period_status_source_ingestion_run_id') THEN
    ALTER TABLE cost_period_status
      ADD CONSTRAINT fk_cost_period_status_source_ingestion_run_id
      FOREIGN KEY (source_ingestion_run_id) REFERENCES billing_ingestion_runs(id) ON DELETE SET NULL;
  END IF;
END $$;
`);

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS ec2_cost_history_daily (
  usage_date date NOT NULL,
  month_start date NOT NULL,
  tenant_id uuid NOT NULL,
  provider_id bigint,
  billing_source_id bigint,
  cloud_connection_id uuid,

  service_key bigint,
  sub_account_key bigint,
  region_key bigint,
  resource_key bigint,

  instance_id text,
  instance_type text,
  state text,

  pricing_model varchar(30) NOT NULL DEFAULT 'other',
  charge_category varchar(50) NOT NULL DEFAULT 'other',
  line_item_type text,

  billed_cost numeric(18,6) DEFAULT 0,
  effective_cost numeric(18,6) DEFAULT 0,
  list_cost numeric(18,6) DEFAULT 0,
  usage_quantity numeric(18,6) DEFAULT 0,
  currency_code varchar(10) DEFAULT 'USD',

  ingestion_run_id bigint,
  snapshot_version integer DEFAULT 1,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

ALTER TABLE ec2_cost_history_daily
  DROP CONSTRAINT IF EXISTS chk_ec2_cost_history_daily_pricing_model;
ALTER TABLE ec2_cost_history_daily
  ADD CONSTRAINT chk_ec2_cost_history_daily_pricing_model
  CHECK (pricing_model IN ('on_demand', 'reserved', 'savings_plan', 'spot', 'other'));

ALTER TABLE ec2_cost_history_daily
  DROP CONSTRAINT IF EXISTS chk_ec2_cost_history_daily_charge_category;
ALTER TABLE ec2_cost_history_daily
  ADD CONSTRAINT chk_ec2_cost_history_daily_charge_category
  CHECK (charge_category IN ('compute', 'ebs', 'data_transfer', 'tax', 'credit', 'refund', 'other'));

CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_daily_month_scope
  ON ec2_cost_history_daily(tenant_id, provider_id, billing_source_id, month_start);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_daily_usage_date
  ON ec2_cost_history_daily(usage_date);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_daily_instance
  ON ec2_cost_history_daily(instance_id, instance_type);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_daily_dims
  ON ec2_cost_history_daily(service_key, sub_account_key, region_key, resource_key);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_daily_category
  ON ec2_cost_history_daily(charge_category, pricing_model);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_daily_ingestion_run
  ON ec2_cost_history_daily(ingestion_run_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_daily_tenant_id') THEN
    ALTER TABLE ec2_cost_history_daily
      ADD CONSTRAINT fk_ec2_cost_history_daily_tenant_id
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_daily_provider_id') THEN
    ALTER TABLE ec2_cost_history_daily
      ADD CONSTRAINT fk_ec2_cost_history_daily_provider_id
      FOREIGN KEY (provider_id) REFERENCES cloud_providers(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_daily_billing_source_id') THEN
    ALTER TABLE ec2_cost_history_daily
      ADD CONSTRAINT fk_ec2_cost_history_daily_billing_source_id
      FOREIGN KEY (billing_source_id) REFERENCES billing_sources(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_daily_cloud_connection_id') THEN
    ALTER TABLE ec2_cost_history_daily
      ADD CONSTRAINT fk_ec2_cost_history_daily_cloud_connection_id
      FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections_v2(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_daily_service_key') THEN
    ALTER TABLE ec2_cost_history_daily
      ADD CONSTRAINT fk_ec2_cost_history_daily_service_key
      FOREIGN KEY (service_key) REFERENCES dim_service(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_daily_sub_account_key') THEN
    ALTER TABLE ec2_cost_history_daily
      ADD CONSTRAINT fk_ec2_cost_history_daily_sub_account_key
      FOREIGN KEY (sub_account_key) REFERENCES dim_sub_account(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_daily_region_key') THEN
    ALTER TABLE ec2_cost_history_daily
      ADD CONSTRAINT fk_ec2_cost_history_daily_region_key
      FOREIGN KEY (region_key) REFERENCES dim_region(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_daily_resource_key') THEN
    ALTER TABLE ec2_cost_history_daily
      ADD CONSTRAINT fk_ec2_cost_history_daily_resource_key
      FOREIGN KEY (resource_key) REFERENCES dim_resource(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_daily_ingestion_run_id') THEN
    ALTER TABLE ec2_cost_history_daily
      ADD CONSTRAINT fk_ec2_cost_history_daily_ingestion_run_id
      FOREIGN KEY (ingestion_run_id) REFERENCES billing_ingestion_runs(id) ON DELETE SET NULL;
  END IF;
END $$;
`);

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS ec2_cost_history_monthly (
  month_start date NOT NULL,
  tenant_id uuid NOT NULL,
  provider_id bigint,
  billing_source_id bigint,
  cloud_connection_id uuid,

  service_key bigint,
  sub_account_key bigint,
  region_key bigint,
  resource_key bigint,

  instance_id text,
  instance_type text,
  state text,

  pricing_model varchar(30) NOT NULL DEFAULT 'other',
  charge_category varchar(50) NOT NULL DEFAULT 'other',

  billed_cost numeric(18,6) DEFAULT 0,
  effective_cost numeric(18,6) DEFAULT 0,
  list_cost numeric(18,6) DEFAULT 0,
  usage_quantity numeric(18,6) DEFAULT 0,
  currency_code varchar(10) DEFAULT 'USD',

  is_final boolean DEFAULT false,
  finalized_at timestamp,
  snapshot_version integer DEFAULT 1,

  ingestion_run_id bigint,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

ALTER TABLE ec2_cost_history_monthly
  DROP CONSTRAINT IF EXISTS chk_ec2_cost_history_monthly_pricing_model;
ALTER TABLE ec2_cost_history_monthly
  ADD CONSTRAINT chk_ec2_cost_history_monthly_pricing_model
  CHECK (pricing_model IN ('on_demand', 'reserved', 'savings_plan', 'spot', 'other'));

ALTER TABLE ec2_cost_history_monthly
  DROP CONSTRAINT IF EXISTS chk_ec2_cost_history_monthly_charge_category;
ALTER TABLE ec2_cost_history_monthly
  ADD CONSTRAINT chk_ec2_cost_history_monthly_charge_category
  CHECK (charge_category IN ('compute', 'ebs', 'data_transfer', 'tax', 'credit', 'refund', 'other'));

CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_monthly_scope
  ON ec2_cost_history_monthly(tenant_id, provider_id, billing_source_id, month_start);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_monthly_instance
  ON ec2_cost_history_monthly(instance_id, instance_type);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_monthly_dims
  ON ec2_cost_history_monthly(service_key, sub_account_key, region_key, resource_key);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_monthly_category
  ON ec2_cost_history_monthly(charge_category, pricing_model);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_monthly_final
  ON ec2_cost_history_monthly(month_start, is_final);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_monthly_ingestion_run
  ON ec2_cost_history_monthly(ingestion_run_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_monthly_tenant_id') THEN
    ALTER TABLE ec2_cost_history_monthly
      ADD CONSTRAINT fk_ec2_cost_history_monthly_tenant_id
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_monthly_provider_id') THEN
    ALTER TABLE ec2_cost_history_monthly
      ADD CONSTRAINT fk_ec2_cost_history_monthly_provider_id
      FOREIGN KEY (provider_id) REFERENCES cloud_providers(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_monthly_billing_source_id') THEN
    ALTER TABLE ec2_cost_history_monthly
      ADD CONSTRAINT fk_ec2_cost_history_monthly_billing_source_id
      FOREIGN KEY (billing_source_id) REFERENCES billing_sources(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_monthly_cloud_connection_id') THEN
    ALTER TABLE ec2_cost_history_monthly
      ADD CONSTRAINT fk_ec2_cost_history_monthly_cloud_connection_id
      FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections_v2(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_monthly_service_key') THEN
    ALTER TABLE ec2_cost_history_monthly
      ADD CONSTRAINT fk_ec2_cost_history_monthly_service_key
      FOREIGN KEY (service_key) REFERENCES dim_service(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_monthly_sub_account_key') THEN
    ALTER TABLE ec2_cost_history_monthly
      ADD CONSTRAINT fk_ec2_cost_history_monthly_sub_account_key
      FOREIGN KEY (sub_account_key) REFERENCES dim_sub_account(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_monthly_region_key') THEN
    ALTER TABLE ec2_cost_history_monthly
      ADD CONSTRAINT fk_ec2_cost_history_monthly_region_key
      FOREIGN KEY (region_key) REFERENCES dim_region(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_monthly_resource_key') THEN
    ALTER TABLE ec2_cost_history_monthly
      ADD CONSTRAINT fk_ec2_cost_history_monthly_resource_key
      FOREIGN KEY (resource_key) REFERENCES dim_resource(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_monthly_ingestion_run_id') THEN
    ALTER TABLE ec2_cost_history_monthly
      ADD CONSTRAINT fk_ec2_cost_history_monthly_ingestion_run_id
      FOREIGN KEY (ingestion_run_id) REFERENCES billing_ingestion_runs(id) ON DELETE SET NULL;
  END IF;
END $$;
`);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS ec2_cost_history_monthly;
DROP TABLE IF EXISTS ec2_cost_history_daily;
DROP TABLE IF EXISTS cost_period_status;
`);
  },
};

export default migration;
