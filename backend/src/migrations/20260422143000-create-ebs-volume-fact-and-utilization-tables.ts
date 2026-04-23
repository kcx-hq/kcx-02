import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS fact_ebs_volume_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL,
  cloud_connection_id UUID,
  billing_source_id BIGINT,
  provider_id BIGINT,

  usage_date DATE NOT NULL,
  volume_id TEXT NOT NULL,
  resource_key BIGINT,
  region_key BIGINT,
  sub_account_key BIGINT,

  volume_type TEXT,
  size_gb INTEGER,
  iops INTEGER,
  throughput INTEGER,
  availability_zone TEXT,
  state TEXT,
  attached_instance_id TEXT,
  is_attached BOOLEAN,

  storage_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  io_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  throughput_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  total_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  currency_code VARCHAR(10) DEFAULT 'USD',

  is_unattached BOOLEAN,
  is_attached_to_stopped_instance BOOLEAN,
  is_idle_candidate BOOLEAN,
  is_underutilized_candidate BOOLEAN,
  optimization_status VARCHAR(30),

  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS ebs_volume_utilization_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL,
  cloud_connection_id UUID,
  provider_id BIGINT,

  volume_id TEXT NOT NULL,
  hour_start TIMESTAMP NOT NULL,
  usage_date DATE NOT NULL,

  resource_key BIGINT,
  region_key BIGINT,
  sub_account_key BIGINT,

  read_bytes BIGINT,
  write_bytes BIGINT,
  read_ops BIGINT,
  write_ops BIGINT,
  queue_length_max NUMERIC(12,4),
  burst_balance_avg NUMERIC(10,4),
  idle_time_avg NUMERIC(12,4),

  sample_count INTEGER DEFAULT 1,
  metric_source VARCHAR(50),

  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS ebs_volume_utilization_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL,
  cloud_connection_id UUID,
  provider_id BIGINT,

  volume_id TEXT NOT NULL,
  usage_date DATE NOT NULL,

  resource_key BIGINT,
  region_key BIGINT,
  sub_account_key BIGINT,

  read_bytes BIGINT,
  write_bytes BIGINT,
  read_ops BIGINT,
  write_ops BIGINT,
  queue_length_max NUMERIC(12,4),
  burst_balance_avg NUMERIC(10,4),
  idle_time_avg NUMERIC(12,4),

  is_idle_candidate BOOLEAN,
  is_underutilized_candidate BOOLEAN,
  sample_count INTEGER DEFAULT 1,
  metric_source VARCHAR(50),

  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_fact_ebs_volume_daily_optimization_status'
  ) THEN
    ALTER TABLE fact_ebs_volume_daily
      ADD CONSTRAINT chk_fact_ebs_volume_daily_optimization_status
      CHECK (
        optimization_status IS NULL OR optimization_status IN ('idle', 'underutilized', 'optimal', 'warning')
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_ebs_volume_daily_tenant_volume_date
  ON fact_ebs_volume_daily(tenant_id, volume_id, usage_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ebs_volume_utilization_hourly_tenant_volume_hour
  ON ebs_volume_utilization_hourly(tenant_id, volume_id, hour_start);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ebs_volume_utilization_daily_tenant_volume_date
  ON ebs_volume_utilization_daily(tenant_id, volume_id, usage_date);

CREATE INDEX IF NOT EXISTS idx_fact_ebs_volume_daily_tenant_id
  ON fact_ebs_volume_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fact_ebs_volume_daily_cloud_connection_id
  ON fact_ebs_volume_daily(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_fact_ebs_volume_daily_billing_source_id
  ON fact_ebs_volume_daily(billing_source_id);
CREATE INDEX IF NOT EXISTS idx_fact_ebs_volume_daily_usage_date
  ON fact_ebs_volume_daily(usage_date);
CREATE INDEX IF NOT EXISTS idx_fact_ebs_volume_daily_region_key
  ON fact_ebs_volume_daily(region_key);
CREATE INDEX IF NOT EXISTS idx_fact_ebs_volume_daily_sub_account_key
  ON fact_ebs_volume_daily(sub_account_key);
CREATE INDEX IF NOT EXISTS idx_fact_ebs_volume_daily_volume_type
  ON fact_ebs_volume_daily(volume_type);
CREATE INDEX IF NOT EXISTS idx_fact_ebs_volume_daily_attached_instance_id
  ON fact_ebs_volume_daily(attached_instance_id);
CREATE INDEX IF NOT EXISTS idx_fact_ebs_volume_daily_is_attached
  ON fact_ebs_volume_daily(is_attached);
CREATE INDEX IF NOT EXISTS idx_fact_ebs_volume_daily_is_unattached
  ON fact_ebs_volume_daily(is_unattached);
CREATE INDEX IF NOT EXISTS idx_fact_ebs_volume_daily_is_attached_to_stopped_instance
  ON fact_ebs_volume_daily(is_attached_to_stopped_instance);

CREATE INDEX IF NOT EXISTS idx_ebs_volume_hourly_tenant_id
  ON ebs_volume_utilization_hourly(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ebs_volume_hourly_cloud_connection_id
  ON ebs_volume_utilization_hourly(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_ebs_volume_hourly_usage_date
  ON ebs_volume_utilization_hourly(usage_date);
CREATE INDEX IF NOT EXISTS idx_ebs_volume_hourly_resource_key
  ON ebs_volume_utilization_hourly(resource_key);
CREATE INDEX IF NOT EXISTS idx_ebs_volume_hourly_region_key
  ON ebs_volume_utilization_hourly(region_key);
CREATE INDEX IF NOT EXISTS idx_ebs_volume_hourly_sub_account_key
  ON ebs_volume_utilization_hourly(sub_account_key);
CREATE INDEX IF NOT EXISTS idx_ebs_volume_hourly_volume_id
  ON ebs_volume_utilization_hourly(volume_id);

CREATE INDEX IF NOT EXISTS idx_ebs_volume_daily_tenant_id
  ON ebs_volume_utilization_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ebs_volume_daily_cloud_connection_id
  ON ebs_volume_utilization_daily(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_ebs_volume_daily_usage_date
  ON ebs_volume_utilization_daily(usage_date);
CREATE INDEX IF NOT EXISTS idx_ebs_volume_daily_resource_key
  ON ebs_volume_utilization_daily(resource_key);
CREATE INDEX IF NOT EXISTS idx_ebs_volume_daily_region_key
  ON ebs_volume_utilization_daily(region_key);
CREATE INDEX IF NOT EXISTS idx_ebs_volume_daily_sub_account_key
  ON ebs_volume_utilization_daily(sub_account_key);
CREATE INDEX IF NOT EXISTS idx_ebs_volume_daily_volume_id
  ON ebs_volume_utilization_daily(volume_id);
CREATE INDEX IF NOT EXISTS idx_ebs_volume_daily_is_idle_candidate
  ON ebs_volume_utilization_daily(is_idle_candidate);
CREATE INDEX IF NOT EXISTS idx_ebs_volume_daily_is_underutilized_candidate
  ON ebs_volume_utilization_daily(is_underutilized_candidate);

DO $$
BEGIN
  IF to_regclass('public.ec2_volume_inventory_snapshots') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_ec2_volume_inventory_tenant_provider_volume_discovered
      ON ec2_volume_inventory_snapshots(tenant_id, provider_id, volume_id, discovered_at);
    CREATE INDEX IF NOT EXISTS idx_ec2_volume_inventory_tenant_connection_volume_current
      ON ec2_volume_inventory_snapshots(tenant_id, cloud_connection_id, volume_id, is_current);
    CREATE INDEX IF NOT EXISTS idx_ec2_volume_inventory_attached_instance_current
      ON ec2_volume_inventory_snapshots(attached_instance_id, is_current);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ebs_volume_daily_tenant_id') THEN
      ALTER TABLE fact_ebs_volume_daily
        ADD CONSTRAINT fk_fact_ebs_volume_daily_tenant_id
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ebs_volume_utilization_hourly_tenant_id') THEN
      ALTER TABLE ebs_volume_utilization_hourly
        ADD CONSTRAINT fk_ebs_volume_utilization_hourly_tenant_id
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ebs_volume_utilization_daily_tenant_id') THEN
      ALTER TABLE ebs_volume_utilization_daily
        ADD CONSTRAINT fk_ebs_volume_utilization_daily_tenant_id
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public.cloud_connections') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ebs_volume_daily_cloud_connection_id') THEN
      ALTER TABLE fact_ebs_volume_daily
        ADD CONSTRAINT fk_fact_ebs_volume_daily_cloud_connection_id
        FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ebs_volume_utilization_hourly_cloud_connection_id') THEN
      ALTER TABLE ebs_volume_utilization_hourly
        ADD CONSTRAINT fk_ebs_volume_utilization_hourly_cloud_connection_id
        FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ebs_volume_utilization_daily_cloud_connection_id') THEN
      ALTER TABLE ebs_volume_utilization_daily
        ADD CONSTRAINT fk_ebs_volume_utilization_daily_cloud_connection_id
        FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF to_regclass('public.billing_sources') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ebs_volume_daily_billing_source_id') THEN
      ALTER TABLE fact_ebs_volume_daily
        ADD CONSTRAINT fk_fact_ebs_volume_daily_billing_source_id
        FOREIGN KEY (billing_source_id) REFERENCES billing_sources(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF to_regclass('public.cloud_providers') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ebs_volume_daily_provider_id') THEN
      ALTER TABLE fact_ebs_volume_daily
        ADD CONSTRAINT fk_fact_ebs_volume_daily_provider_id
        FOREIGN KEY (provider_id) REFERENCES cloud_providers(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ebs_volume_utilization_hourly_provider_id') THEN
      ALTER TABLE ebs_volume_utilization_hourly
        ADD CONSTRAINT fk_ebs_volume_utilization_hourly_provider_id
        FOREIGN KEY (provider_id) REFERENCES cloud_providers(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ebs_volume_utilization_daily_provider_id') THEN
      ALTER TABLE ebs_volume_utilization_daily
        ADD CONSTRAINT fk_ebs_volume_utilization_daily_provider_id
        FOREIGN KEY (provider_id) REFERENCES cloud_providers(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF to_regclass('public.dim_resource') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ebs_volume_daily_resource_key') THEN
      ALTER TABLE fact_ebs_volume_daily
        ADD CONSTRAINT fk_fact_ebs_volume_daily_resource_key
        FOREIGN KEY (resource_key) REFERENCES dim_resource(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ebs_volume_utilization_hourly_resource_key') THEN
      ALTER TABLE ebs_volume_utilization_hourly
        ADD CONSTRAINT fk_ebs_volume_utilization_hourly_resource_key
        FOREIGN KEY (resource_key) REFERENCES dim_resource(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ebs_volume_utilization_daily_resource_key') THEN
      ALTER TABLE ebs_volume_utilization_daily
        ADD CONSTRAINT fk_ebs_volume_utilization_daily_resource_key
        FOREIGN KEY (resource_key) REFERENCES dim_resource(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF to_regclass('public.dim_region') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ebs_volume_daily_region_key') THEN
      ALTER TABLE fact_ebs_volume_daily
        ADD CONSTRAINT fk_fact_ebs_volume_daily_region_key
        FOREIGN KEY (region_key) REFERENCES dim_region(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ebs_volume_utilization_hourly_region_key') THEN
      ALTER TABLE ebs_volume_utilization_hourly
        ADD CONSTRAINT fk_ebs_volume_utilization_hourly_region_key
        FOREIGN KEY (region_key) REFERENCES dim_region(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ebs_volume_utilization_daily_region_key') THEN
      ALTER TABLE ebs_volume_utilization_daily
        ADD CONSTRAINT fk_ebs_volume_utilization_daily_region_key
        FOREIGN KEY (region_key) REFERENCES dim_region(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF to_regclass('public.dim_sub_account') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ebs_volume_daily_sub_account_key') THEN
      ALTER TABLE fact_ebs_volume_daily
        ADD CONSTRAINT fk_fact_ebs_volume_daily_sub_account_key
        FOREIGN KEY (sub_account_key) REFERENCES dim_sub_account(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ebs_volume_utilization_hourly_sub_account_key') THEN
      ALTER TABLE ebs_volume_utilization_hourly
        ADD CONSTRAINT fk_ebs_volume_utilization_hourly_sub_account_key
        FOREIGN KEY (sub_account_key) REFERENCES dim_sub_account(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ebs_volume_utilization_daily_sub_account_key') THEN
      ALTER TABLE ebs_volume_utilization_daily
        ADD CONSTRAINT fk_ebs_volume_utilization_daily_sub_account_key
        FOREIGN KEY (sub_account_key) REFERENCES dim_sub_account(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
`);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS idx_ec2_volume_inventory_attached_instance_current;
DROP INDEX IF EXISTS idx_ec2_volume_inventory_tenant_connection_volume_current;
DROP INDEX IF EXISTS idx_ec2_volume_inventory_tenant_provider_volume_discovered;

DROP TABLE IF EXISTS ebs_volume_utilization_daily;
DROP TABLE IF EXISTS ebs_volume_utilization_hourly;
DROP TABLE IF EXISTS fact_ebs_volume_daily;
`);
  },
};

export default migration;
