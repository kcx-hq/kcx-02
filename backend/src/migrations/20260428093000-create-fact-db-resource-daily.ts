import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS fact_db_resource_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL,
  cloud_connection_id UUID,
  billing_source_id BIGINT,
  provider_id BIGINT,

  usage_date DATE NOT NULL,

  resource_id TEXT NOT NULL,
  resource_arn TEXT,
  resource_name TEXT,

  db_service TEXT NOT NULL,
  db_engine TEXT,
  db_engine_version TEXT,
  resource_type TEXT,

  resource_key BIGINT,
  region_key BIGINT,
  sub_account_key BIGINT,

  status TEXT,
  cluster_id TEXT,
  is_cluster_resource BOOLEAN DEFAULT false NOT NULL,

  allocated_storage_gb NUMERIC(18,6),
  data_footprint_gb NUMERIC(18,6),
  storage_used_gb NUMERIC(18,6),

  compute_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  storage_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  io_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  backup_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  data_transfer_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  tax_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  credit_amount NUMERIC(18,6) DEFAULT 0 NOT NULL,
  refund_amount NUMERIC(18,6) DEFAULT 0 NOT NULL,
  total_billed_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  total_effective_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  total_list_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  currency_code TEXT,

  cpu_avg NUMERIC(10,4),
  cpu_max NUMERIC(10,4),
  load_avg NUMERIC(10,4),
  connections_avg NUMERIC(18,4),
  connections_max NUMERIC(18,4),
  request_count NUMERIC(20,4),
  read_iops NUMERIC(18,4),
  write_iops NUMERIC(18,4),
  read_throughput_bytes NUMERIC(20,4),
  write_throughput_bytes NUMERIC(20,4),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_db_resource_daily_resource_date
  ON fact_db_resource_daily(tenant_id, cloud_connection_id, resource_id, usage_date);

CREATE INDEX IF NOT EXISTS idx_fact_db_resource_daily_tenant_id
  ON fact_db_resource_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fact_db_resource_daily_cloud_connection_id
  ON fact_db_resource_daily(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_fact_db_resource_daily_provider_id
  ON fact_db_resource_daily(provider_id);
CREATE INDEX IF NOT EXISTS idx_fact_db_resource_daily_resource_id
  ON fact_db_resource_daily(resource_id);
CREATE INDEX IF NOT EXISTS idx_fact_db_resource_daily_usage_date
  ON fact_db_resource_daily(usage_date);
CREATE INDEX IF NOT EXISTS idx_fact_db_resource_daily_db_service
  ON fact_db_resource_daily(db_service);
CREATE INDEX IF NOT EXISTS idx_fact_db_resource_daily_db_engine
  ON fact_db_resource_daily(db_engine);
CREATE INDEX IF NOT EXISTS idx_fact_db_resource_daily_region_key
  ON fact_db_resource_daily(region_key);
CREATE INDEX IF NOT EXISTS idx_fact_db_resource_daily_sub_account_key
  ON fact_db_resource_daily(sub_account_key);
CREATE INDEX IF NOT EXISTS idx_fact_db_resource_daily_resource_key
  ON fact_db_resource_daily(resource_key);

CREATE INDEX IF NOT EXISTS idx_fact_db_resource_daily_tenant_conn_date
  ON fact_db_resource_daily(tenant_id, cloud_connection_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_fact_db_resource_daily_tenant_conn_service_date
  ON fact_db_resource_daily(tenant_id, cloud_connection_id, db_service, usage_date);
CREATE INDEX IF NOT EXISTS idx_fact_db_resource_daily_tenant_conn_resource_date
  ON fact_db_resource_daily(tenant_id, cloud_connection_id, resource_id, usage_date);

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.fact_db_resource_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.tenants'::regclass
        AND a.attname = 'tenant_id'
    ) THEN
    ALTER TABLE fact_db_resource_daily
      ADD CONSTRAINT fk_fact_db_resource_daily_tenant_id
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.cloud_connections') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.fact_db_resource_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.cloud_connections'::regclass
        AND a.attname = 'cloud_connection_id'
    ) THEN
    ALTER TABLE fact_db_resource_daily
      ADD CONSTRAINT fk_fact_db_resource_daily_cloud_connection_id
      FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.billing_sources') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.fact_db_resource_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.billing_sources'::regclass
        AND a.attname = 'billing_source_id'
    ) THEN
    ALTER TABLE fact_db_resource_daily
      ADD CONSTRAINT fk_fact_db_resource_daily_billing_source_id
      FOREIGN KEY (billing_source_id) REFERENCES billing_sources(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.cloud_providers') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.fact_db_resource_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.cloud_providers'::regclass
        AND a.attname = 'provider_id'
    ) THEN
    ALTER TABLE fact_db_resource_daily
      ADD CONSTRAINT fk_fact_db_resource_daily_provider_id
      FOREIGN KEY (provider_id) REFERENCES cloud_providers(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.dim_resource') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.fact_db_resource_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.dim_resource'::regclass
        AND a.attname = 'resource_key'
    ) THEN
    ALTER TABLE fact_db_resource_daily
      ADD CONSTRAINT fk_fact_db_resource_daily_resource_key
      FOREIGN KEY (resource_key) REFERENCES dim_resource(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.dim_region') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.fact_db_resource_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.dim_region'::regclass
        AND a.attname = 'region_key'
    ) THEN
    ALTER TABLE fact_db_resource_daily
      ADD CONSTRAINT fk_fact_db_resource_daily_region_key
      FOREIGN KEY (region_key) REFERENCES dim_region(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.dim_sub_account') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.fact_db_resource_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.dim_sub_account'::regclass
        AND a.attname = 'sub_account_key'
    ) THEN
    ALTER TABLE fact_db_resource_daily
      ADD CONSTRAINT fk_fact_db_resource_daily_sub_account_key
      FOREIGN KEY (sub_account_key) REFERENCES dim_sub_account(id) ON DELETE SET NULL;
  END IF;
END $$;
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS fact_db_resource_daily;
`);
  },
};

export default migration;
