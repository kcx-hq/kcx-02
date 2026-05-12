import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS db_utilization_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID,
  cloud_connection_id UUID,
  provider_id BIGINT,

  resource_id TEXT NOT NULL,
  usage_date DATE NOT NULL,

  db_service TEXT NOT NULL,
  db_engine TEXT,

  resource_key BIGINT,
  region_key BIGINT,
  sub_account_key BIGINT,

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

  storage_used_gb NUMERIC(18,6),
  allocated_storage_gb NUMERIC(18,6),

  sample_count INTEGER,
  metric_source TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_db_utilization_daily_resource_date
  ON db_utilization_daily(tenant_id, cloud_connection_id, resource_id, usage_date);

CREATE INDEX IF NOT EXISTS idx_db_utilization_daily_tenant_id
  ON db_utilization_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_db_utilization_daily_cloud_connection_id
  ON db_utilization_daily(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_db_utilization_daily_provider_id
  ON db_utilization_daily(provider_id);
CREATE INDEX IF NOT EXISTS idx_db_utilization_daily_resource_id
  ON db_utilization_daily(resource_id);
CREATE INDEX IF NOT EXISTS idx_db_utilization_daily_usage_date
  ON db_utilization_daily(usage_date);
CREATE INDEX IF NOT EXISTS idx_db_utilization_daily_db_service
  ON db_utilization_daily(db_service);
CREATE INDEX IF NOT EXISTS idx_db_utilization_daily_db_engine
  ON db_utilization_daily(db_engine);
CREATE INDEX IF NOT EXISTS idx_db_utilization_daily_region_key
  ON db_utilization_daily(region_key);
CREATE INDEX IF NOT EXISTS idx_db_utilization_daily_sub_account_key
  ON db_utilization_daily(sub_account_key);
CREATE INDEX IF NOT EXISTS idx_db_utilization_daily_resource_key
  ON db_utilization_daily(resource_key);

CREATE INDEX IF NOT EXISTS idx_db_utilization_daily_tenant_conn_date
  ON db_utilization_daily(tenant_id, cloud_connection_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_db_utilization_daily_tenant_conn_service_date
  ON db_utilization_daily(tenant_id, cloud_connection_id, db_service, usage_date);
CREATE INDEX IF NOT EXISTS idx_db_utilization_daily_tenant_conn_resource_date
  ON db_utilization_daily(tenant_id, cloud_connection_id, resource_id, usage_date);

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_utilization_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.tenants'::regclass
        AND a.attname = 'tenant_id'
    ) THEN
    ALTER TABLE db_utilization_daily
      ADD CONSTRAINT fk_db_utilization_daily_tenant_id
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.cloud_connections') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_utilization_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.cloud_connections'::regclass
        AND a.attname = 'cloud_connection_id'
    ) THEN
    ALTER TABLE db_utilization_daily
      ADD CONSTRAINT fk_db_utilization_daily_cloud_connection_id
      FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.cloud_providers') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_utilization_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.cloud_providers'::regclass
        AND a.attname = 'provider_id'
    ) THEN
    ALTER TABLE db_utilization_daily
      ADD CONSTRAINT fk_db_utilization_daily_provider_id
      FOREIGN KEY (provider_id) REFERENCES cloud_providers(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.dim_resource') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_utilization_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.dim_resource'::regclass
        AND a.attname = 'resource_key'
    ) THEN
    ALTER TABLE db_utilization_daily
      ADD CONSTRAINT fk_db_utilization_daily_resource_key
      FOREIGN KEY (resource_key) REFERENCES dim_resource(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.dim_region') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_utilization_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.dim_region'::regclass
        AND a.attname = 'region_key'
    ) THEN
    ALTER TABLE db_utilization_daily
      ADD CONSTRAINT fk_db_utilization_daily_region_key
      FOREIGN KEY (region_key) REFERENCES dim_region(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.dim_sub_account') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_utilization_daily'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.dim_sub_account'::regclass
        AND a.attname = 'sub_account_key'
    ) THEN
    ALTER TABLE db_utilization_daily
      ADD CONSTRAINT fk_db_utilization_daily_sub_account_key
      FOREIGN KEY (sub_account_key) REFERENCES dim_sub_account(id) ON DELETE SET NULL;
  END IF;
END $$;
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS db_utilization_daily;
`);
  },
};

export default migration;
