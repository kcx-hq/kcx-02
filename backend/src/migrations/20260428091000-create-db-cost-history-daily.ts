import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS db_cost_history_daily (
  usage_date DATE NOT NULL,
  month_start DATE NOT NULL,

  tenant_id UUID NOT NULL,
  cloud_connection_id UUID,
  billing_source_id BIGINT,
  provider_id BIGINT,

  service_key BIGINT,
  region_key BIGINT,
  sub_account_key BIGINT,
  resource_key BIGINT,

  resource_id TEXT NOT NULL,

  db_service TEXT NOT NULL,
  db_engine TEXT,

  cost_category TEXT NOT NULL DEFAULT 'other',

  billed_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  effective_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  list_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  usage_quantity NUMERIC(18,6),
  currency_code TEXT,

  ingestion_run_id BIGINT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE db_cost_history_daily
  DROP CONSTRAINT IF EXISTS chk_db_cost_history_daily_cost_category;
ALTER TABLE db_cost_history_daily
  ADD CONSTRAINT chk_db_cost_history_daily_cost_category
  CHECK (cost_category IN ('compute', 'storage', 'io', 'backup', 'data_transfer', 'tax', 'credit', 'refund', 'other'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_db_cost_history_daily_resource_day_category
  ON db_cost_history_daily(tenant_id, cloud_connection_id, resource_id, usage_date, cost_category);

CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_tenant_id
  ON db_cost_history_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_cloud_connection_id
  ON db_cost_history_daily(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_billing_source_id
  ON db_cost_history_daily(billing_source_id);
CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_provider_id
  ON db_cost_history_daily(provider_id);
CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_usage_date
  ON db_cost_history_daily(usage_date);
CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_service_key
  ON db_cost_history_daily(service_key);
CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_region_key
  ON db_cost_history_daily(region_key);
CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_sub_account_key
  ON db_cost_history_daily(sub_account_key);
CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_resource_key
  ON db_cost_history_daily(resource_key);
CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_db_service
  ON db_cost_history_daily(db_service);
CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_db_engine
  ON db_cost_history_daily(db_engine);
CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_cost_category
  ON db_cost_history_daily(cost_category);

CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_tenant_conn_date
  ON db_cost_history_daily(tenant_id, cloud_connection_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_tenant_conn_service_date
  ON db_cost_history_daily(tenant_id, cloud_connection_id, db_service, usage_date);
CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_tenant_conn_service_category_date
  ON db_cost_history_daily(tenant_id, cloud_connection_id, db_service, cost_category, usage_date);
CREATE INDEX IF NOT EXISTS idx_db_cost_history_daily_tenant_conn_resource_date
  ON db_cost_history_daily(tenant_id, cloud_connection_id, resource_id, usage_date);

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_cost_history_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.tenants'::regclass
        AND a.attname = 'tenant_id'
    ) THEN
    ALTER TABLE db_cost_history_daily
      ADD CONSTRAINT fk_db_cost_history_daily_tenant_id
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.cloud_connections') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_cost_history_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.cloud_connections'::regclass
        AND a.attname = 'cloud_connection_id'
    ) THEN
    ALTER TABLE db_cost_history_daily
      ADD CONSTRAINT fk_db_cost_history_daily_cloud_connection_id
      FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.billing_sources') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_cost_history_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.billing_sources'::regclass
        AND a.attname = 'billing_source_id'
    ) THEN
    ALTER TABLE db_cost_history_daily
      ADD CONSTRAINT fk_db_cost_history_daily_billing_source_id
      FOREIGN KEY (billing_source_id) REFERENCES billing_sources(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.cloud_providers') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_cost_history_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.cloud_providers'::regclass
        AND a.attname = 'provider_id'
    ) THEN
    ALTER TABLE db_cost_history_daily
      ADD CONSTRAINT fk_db_cost_history_daily_provider_id
      FOREIGN KEY (provider_id) REFERENCES cloud_providers(id) ON DELETE RESTRICT;
  END IF;

  IF to_regclass('public.dim_service') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_cost_history_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.dim_service'::regclass
        AND a.attname = 'service_key'
    ) THEN
    ALTER TABLE db_cost_history_daily
      ADD CONSTRAINT fk_db_cost_history_daily_service_key
      FOREIGN KEY (service_key) REFERENCES dim_service(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.dim_region') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_cost_history_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.dim_region'::regclass
        AND a.attname = 'region_key'
    ) THEN
    ALTER TABLE db_cost_history_daily
      ADD CONSTRAINT fk_db_cost_history_daily_region_key
      FOREIGN KEY (region_key) REFERENCES dim_region(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.dim_sub_account') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_cost_history_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.dim_sub_account'::regclass
        AND a.attname = 'sub_account_key'
    ) THEN
    ALTER TABLE db_cost_history_daily
      ADD CONSTRAINT fk_db_cost_history_daily_sub_account_key
      FOREIGN KEY (sub_account_key) REFERENCES dim_sub_account(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.dim_resource') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_cost_history_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.dim_resource'::regclass
        AND a.attname = 'resource_key'
    ) THEN
    ALTER TABLE db_cost_history_daily
      ADD CONSTRAINT fk_db_cost_history_daily_resource_key
      FOREIGN KEY (resource_key) REFERENCES dim_resource(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.billing_ingestion_runs') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_cost_history_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.billing_ingestion_runs'::regclass
        AND a.attname = 'ingestion_run_id'
    ) THEN
    ALTER TABLE db_cost_history_daily
      ADD CONSTRAINT fk_db_cost_history_daily_ingestion_run_id
      FOREIGN KEY (ingestion_run_id) REFERENCES billing_ingestion_runs(id) ON DELETE SET NULL;
  END IF;
END $$;
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS db_cost_history_daily;
`);
  },
};

export default migration;
