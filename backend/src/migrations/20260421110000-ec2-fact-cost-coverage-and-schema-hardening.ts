import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      t.relname AS table_name,
      c.conname AS constraint_name,
      ARRAY_AGG(a.attname::text ORDER BY u.ordinality) AS cols
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN unnest(c.conkey) WITH ORDINALITY AS u(attnum, ordinality) ON TRUE
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = u.attnum
    WHERE c.contype = 'u'
      AND t.relname IN (
        'fact_ec2_instance_daily',
        'fact_ec2_instance_cost_daily',
        'fact_ec2_instance_coverage_daily',
        'ec2_cost_history_daily',
        'ec2_cost_history_monthly'
      )
    GROUP BY n.nspname, t.relname, c.conname
    HAVING ARRAY_AGG(a.attname::text ORDER BY u.ordinality) = ARRAY['instance_id']
       OR (t.relname = 'ec2_cost_history_daily' AND ARRAY_AGG(a.attname::text ORDER BY u.ordinality) = ARRAY['instance_id','usage_date'])
       OR (t.relname = 'ec2_cost_history_monthly' AND ARRAY_AGG(a.attname::text ORDER BY u.ordinality) = ARRAY['instance_id','month_start'])
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', r.schema_name, r.table_name, r.constraint_name);
  END LOOP;

  FOR r IN
    SELECT
      ns.nspname AS schema_name,
      idx.relname AS index_name,
      tbl.relname AS table_name,
      ARRAY_AGG(att.attname::text ORDER BY k.ord) AS cols
    FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_namespace ns ON ns.oid = idx.relnamespace
    JOIN pg_class tbl ON tbl.oid = i.indrelid
    JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
    JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = k.attnum
    LEFT JOIN pg_constraint c ON c.conindid = i.indexrelid
    WHERE i.indisunique = true
      AND i.indisprimary = false
      AND c.oid IS NULL
      AND tbl.relname IN (
        'fact_ec2_instance_daily',
        'fact_ec2_instance_cost_daily',
        'fact_ec2_instance_coverage_daily',
        'ec2_cost_history_daily',
        'ec2_cost_history_monthly'
      )
    GROUP BY ns.nspname, idx.relname, tbl.relname
    HAVING ARRAY_AGG(att.attname::text ORDER BY k.ord) = ARRAY['instance_id']
       OR (tbl.relname = 'ec2_cost_history_daily' AND ARRAY_AGG(att.attname::text ORDER BY k.ord) = ARRAY['instance_id','usage_date'])
       OR (tbl.relname = 'ec2_cost_history_monthly' AND ARRAY_AGG(att.attname::text ORDER BY k.ord) = ARRAY['instance_id','month_start'])
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', r.schema_name, r.index_name);
  END LOOP;
END $$;

ALTER TABLE IF EXISTS fact_ec2_instance_daily
  ADD COLUMN IF NOT EXISTS billing_source_id BIGINT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS platform_details TEXT,
  ADD COLUMN IF NOT EXISTS architecture TEXT,
  ADD COLUMN IF NOT EXISTS tenancy TEXT,
  ADD COLUMN IF NOT EXISTS asg_name TEXT,
  ADD COLUMN IF NOT EXISTS vpc_id TEXT,
  ADD COLUMN IF NOT EXISTS subnet_id TEXT,
  ADD COLUMN IF NOT EXISTS image_id TEXT,
  ADD COLUMN IF NOT EXISTS cpu_avg NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS cpu_max NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS cpu_min NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS memory_avg NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS memory_max NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS disk_used_percent_avg NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS disk_used_percent_max NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS network_in_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS network_out_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS pricing_model VARCHAR(30),
  ADD COLUMN IF NOT EXISTS effective_cost NUMERIC(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billed_cost NUMERIC(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS list_cost NUMERIC(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reservation_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS reservation_arn TEXT,
  ADD COLUMN IF NOT EXISTS savings_plan_arn TEXT,
  ADD COLUMN IF NOT EXISTS savings_plan_type TEXT,
  ADD COLUMN IF NOT EXISTS covered_hours NUMERIC(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS covered_cost NUMERIC(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uncovered_cost NUMERIC(18,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_idle_candidate BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_underutilized_candidate BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_overutilized_candidate BOOLEAN,
  ADD COLUMN IF NOT EXISTS idle_score NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS rightsizing_score NUMERIC(10,4);

ALTER TABLE IF EXISTS fact_ec2_instance_daily
  DROP CONSTRAINT IF EXISTS chk_fact_ec2_instance_daily_pricing_model;
ALTER TABLE IF EXISTS fact_ec2_instance_daily
  ADD CONSTRAINT chk_fact_ec2_instance_daily_pricing_model
  CHECK (pricing_model IS NULL OR pricing_model IN ('on_demand','reserved','savings_plan','spot','other'));

ALTER TABLE IF EXISTS fact_ec2_instance_daily
  DROP CONSTRAINT IF EXISTS chk_fact_ec2_instance_daily_reservation_type;
ALTER TABLE IF EXISTS fact_ec2_instance_daily
  ADD CONSTRAINT chk_fact_ec2_instance_daily_reservation_type
  CHECK (reservation_type IS NULL OR reservation_type IN ('on_demand','reserved','savings_plan','spot'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_ec2_instance_daily_instance_date
  ON fact_ec2_instance_daily(instance_id, usage_date);

CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_daily_billing_source_id
  ON fact_ec2_instance_daily(billing_source_id);

CREATE TABLE IF NOT EXISTS fact_ec2_instance_cost_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cloud_connection_id UUID,
  billing_source_id BIGINT,
  provider_id BIGINT,
  usage_date DATE NOT NULL,
  instance_id TEXT NOT NULL,
  resource_key BIGINT,
  region_key BIGINT,
  sub_account_key BIGINT,
  instance_type TEXT,
  compute_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  ebs_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  data_transfer_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  tax_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  credit_amount NUMERIC(18,6) DEFAULT 0 NOT NULL,
  refund_amount NUMERIC(18,6) DEFAULT 0 NOT NULL,
  total_billed_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  total_effective_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  total_list_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  usage_hours NUMERIC(18,6) DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_ec2_instance_cost_daily_instance_date
  ON fact_ec2_instance_cost_daily(instance_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_cost_daily_tenant_id
  ON fact_ec2_instance_cost_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_cost_daily_cloud_connection_id
  ON fact_ec2_instance_cost_daily(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_cost_daily_billing_source_id
  ON fact_ec2_instance_cost_daily(billing_source_id);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_cost_daily_usage_date
  ON fact_ec2_instance_cost_daily(usage_date);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_cost_daily_region_key
  ON fact_ec2_instance_cost_daily(region_key);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_cost_daily_sub_account_key
  ON fact_ec2_instance_cost_daily(sub_account_key);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_cost_daily_instance_type
  ON fact_ec2_instance_cost_daily(instance_type);

CREATE TABLE IF NOT EXISTS fact_ec2_instance_coverage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cloud_connection_id UUID,
  billing_source_id BIGINT,
  provider_id BIGINT,
  usage_date DATE NOT NULL,
  instance_id TEXT NOT NULL,
  resource_key BIGINT,
  region_key BIGINT,
  sub_account_key BIGINT,
  instance_type TEXT,
  reservation_type VARCHAR(30) NOT NULL,
  reservation_arn TEXT,
  savings_plan_arn TEXT,
  savings_plan_type TEXT,
  covered_hours NUMERIC(18,6) DEFAULT 0 NOT NULL,
  uncovered_hours NUMERIC(18,6) DEFAULT 0 NOT NULL,
  covered_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  uncovered_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  effective_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

ALTER TABLE IF EXISTS fact_ec2_instance_coverage_daily
  DROP CONSTRAINT IF EXISTS chk_fact_ec2_instance_coverage_daily_reservation_type;
ALTER TABLE IF EXISTS fact_ec2_instance_coverage_daily
  ADD CONSTRAINT chk_fact_ec2_instance_coverage_daily_reservation_type
  CHECK (reservation_type IN ('on_demand','reserved','savings_plan','spot'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_ec2_instance_coverage_daily_instance_date
  ON fact_ec2_instance_coverage_daily(instance_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_coverage_daily_tenant_id
  ON fact_ec2_instance_coverage_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_coverage_daily_cloud_connection_id
  ON fact_ec2_instance_coverage_daily(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_coverage_daily_billing_source_id
  ON fact_ec2_instance_coverage_daily(billing_source_id);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_coverage_daily_usage_date
  ON fact_ec2_instance_coverage_daily(usage_date);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_coverage_daily_region_key
  ON fact_ec2_instance_coverage_daily(region_key);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_coverage_daily_sub_account_key
  ON fact_ec2_instance_coverage_daily(sub_account_key);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_coverage_daily_instance_type
  ON fact_ec2_instance_coverage_daily(instance_type);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_coverage_daily_reservation_type
  ON fact_ec2_instance_coverage_daily(reservation_type);

ALTER TABLE IF EXISTS ec2_cost_history_daily
  ADD COLUMN IF NOT EXISTS allocation_scope VARCHAR(30),
  ADD COLUMN IF NOT EXISTS is_shared_cost BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allocation_method VARCHAR(50);

ALTER TABLE IF EXISTS ec2_cost_history_daily
  DROP CONSTRAINT IF EXISTS chk_ec2_cost_history_daily_pricing_model;
ALTER TABLE IF EXISTS ec2_cost_history_daily
  ADD CONSTRAINT chk_ec2_cost_history_daily_pricing_model
  CHECK (pricing_model IN ('on_demand', 'reserved', 'savings_plan', 'spot', 'other'));

ALTER TABLE IF EXISTS ec2_cost_history_daily
  DROP CONSTRAINT IF EXISTS chk_ec2_cost_history_daily_charge_category;
ALTER TABLE IF EXISTS ec2_cost_history_daily
  ADD CONSTRAINT chk_ec2_cost_history_daily_charge_category
  CHECK (charge_category IN ('compute', 'ebs', 'data_transfer', 'tax', 'credit', 'refund', 'other'));

CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_daily_scope_usage_date
  ON ec2_cost_history_daily(tenant_id, provider_id, billing_source_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_daily_instance_usage_date
  ON ec2_cost_history_daily(instance_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_daily_category_pricing
  ON ec2_cost_history_daily(charge_category, pricing_model);

ALTER TABLE IF EXISTS ec2_cost_history_monthly
  ADD COLUMN IF NOT EXISTS allocation_scope VARCHAR(30),
  ADD COLUMN IF NOT EXISTS is_shared_cost BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allocation_method VARCHAR(50);

ALTER TABLE IF EXISTS ec2_cost_history_monthly
  DROP CONSTRAINT IF EXISTS chk_ec2_cost_history_monthly_pricing_model;
ALTER TABLE IF EXISTS ec2_cost_history_monthly
  ADD CONSTRAINT chk_ec2_cost_history_monthly_pricing_model
  CHECK (pricing_model IN ('on_demand', 'reserved', 'savings_plan', 'spot', 'other'));

ALTER TABLE IF EXISTS ec2_cost_history_monthly
  DROP CONSTRAINT IF EXISTS chk_ec2_cost_history_monthly_charge_category;
ALTER TABLE IF EXISTS ec2_cost_history_monthly
  ADD CONSTRAINT chk_ec2_cost_history_monthly_charge_category
  CHECK (charge_category IN ('compute', 'ebs', 'data_transfer', 'tax', 'credit', 'refund', 'other'));

CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_monthly_scope
  ON ec2_cost_history_monthly(tenant_id, provider_id, billing_source_id, month_start);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_monthly_instance_month_start
  ON ec2_cost_history_monthly(instance_id, month_start);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_monthly_month_start_final
  ON ec2_cost_history_monthly(month_start, is_final);
CREATE INDEX IF NOT EXISTS idx_ec2_cost_history_monthly_category_pricing
  ON ec2_cost_history_monthly(charge_category, pricing_model);

DO $$
BEGIN
  IF to_regclass('public.cloud_connections') IS NOT NULL THEN
    ALTER TABLE IF EXISTS ec2_cost_history_daily
      DROP CONSTRAINT IF EXISTS fk_ec2_cost_history_daily_cloud_connection_id;
    ALTER TABLE IF EXISTS ec2_cost_history_monthly
      DROP CONSTRAINT IF EXISTS fk_ec2_cost_history_monthly_cloud_connection_id;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_daily_cloud_connection_id') THEN
      ALTER TABLE ec2_cost_history_daily
        ADD CONSTRAINT fk_ec2_cost_history_daily_cloud_connection_id
        FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ec2_cost_history_monthly_cloud_connection_id') THEN
      ALTER TABLE ec2_cost_history_monthly
        ADD CONSTRAINT fk_ec2_cost_history_monthly_cloud_connection_id
        FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_daily_tenant_id') THEN
      ALTER TABLE fact_ec2_instance_daily
        ADD CONSTRAINT fk_fact_ec2_instance_daily_tenant_id
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_cost_daily_tenant_id') THEN
      ALTER TABLE fact_ec2_instance_cost_daily
        ADD CONSTRAINT fk_fact_ec2_instance_cost_daily_tenant_id
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_coverage_daily_tenant_id') THEN
      ALTER TABLE fact_ec2_instance_coverage_daily
        ADD CONSTRAINT fk_fact_ec2_instance_coverage_daily_tenant_id
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public.cloud_providers') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_daily_provider_id') THEN
      ALTER TABLE fact_ec2_instance_daily
        ADD CONSTRAINT fk_fact_ec2_instance_daily_provider_id
        FOREIGN KEY (provider_id) REFERENCES cloud_providers(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_cost_daily_provider_id') THEN
      ALTER TABLE fact_ec2_instance_cost_daily
        ADD CONSTRAINT fk_fact_ec2_instance_cost_daily_provider_id
        FOREIGN KEY (provider_id) REFERENCES cloud_providers(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_coverage_daily_provider_id') THEN
      ALTER TABLE fact_ec2_instance_coverage_daily
        ADD CONSTRAINT fk_fact_ec2_instance_coverage_daily_provider_id
        FOREIGN KEY (provider_id) REFERENCES cloud_providers(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF to_regclass('public.billing_sources') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_daily_billing_source_id') THEN
      ALTER TABLE fact_ec2_instance_daily
        ADD CONSTRAINT fk_fact_ec2_instance_daily_billing_source_id
        FOREIGN KEY (billing_source_id) REFERENCES billing_sources(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_cost_daily_billing_source_id') THEN
      ALTER TABLE fact_ec2_instance_cost_daily
        ADD CONSTRAINT fk_fact_ec2_instance_cost_daily_billing_source_id
        FOREIGN KEY (billing_source_id) REFERENCES billing_sources(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_coverage_daily_billing_source_id') THEN
      ALTER TABLE fact_ec2_instance_coverage_daily
        ADD CONSTRAINT fk_fact_ec2_instance_coverage_daily_billing_source_id
        FOREIGN KEY (billing_source_id) REFERENCES billing_sources(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF to_regclass('public.cloud_connections') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_daily_cloud_connection_id') THEN
      ALTER TABLE fact_ec2_instance_daily
        ADD CONSTRAINT fk_fact_ec2_instance_daily_cloud_connection_id
        FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_cost_daily_cloud_connection_id') THEN
      ALTER TABLE fact_ec2_instance_cost_daily
        ADD CONSTRAINT fk_fact_ec2_instance_cost_daily_cloud_connection_id
        FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_coverage_daily_cloud_connection_id') THEN
      ALTER TABLE fact_ec2_instance_coverage_daily
        ADD CONSTRAINT fk_fact_ec2_instance_coverage_daily_cloud_connection_id
        FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF to_regclass('public.dim_region') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_daily_region_key') THEN
      ALTER TABLE fact_ec2_instance_daily
        ADD CONSTRAINT fk_fact_ec2_instance_daily_region_key
        FOREIGN KEY (region_key) REFERENCES dim_region(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_cost_daily_region_key') THEN
      ALTER TABLE fact_ec2_instance_cost_daily
        ADD CONSTRAINT fk_fact_ec2_instance_cost_daily_region_key
        FOREIGN KEY (region_key) REFERENCES dim_region(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_coverage_daily_region_key') THEN
      ALTER TABLE fact_ec2_instance_coverage_daily
        ADD CONSTRAINT fk_fact_ec2_instance_coverage_daily_region_key
        FOREIGN KEY (region_key) REFERENCES dim_region(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF to_regclass('public.dim_sub_account') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_daily_sub_account_key') THEN
      ALTER TABLE fact_ec2_instance_daily
        ADD CONSTRAINT fk_fact_ec2_instance_daily_sub_account_key
        FOREIGN KEY (sub_account_key) REFERENCES dim_sub_account(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_cost_daily_sub_account_key') THEN
      ALTER TABLE fact_ec2_instance_cost_daily
        ADD CONSTRAINT fk_fact_ec2_instance_cost_daily_sub_account_key
        FOREIGN KEY (sub_account_key) REFERENCES dim_sub_account(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_coverage_daily_sub_account_key') THEN
      ALTER TABLE fact_ec2_instance_coverage_daily
        ADD CONSTRAINT fk_fact_ec2_instance_coverage_daily_sub_account_key
        FOREIGN KEY (sub_account_key) REFERENCES dim_sub_account(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF to_regclass('public.dim_resource') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_daily_resource_key') THEN
      ALTER TABLE fact_ec2_instance_daily
        ADD CONSTRAINT fk_fact_ec2_instance_daily_resource_key
        FOREIGN KEY (resource_key) REFERENCES dim_resource(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_cost_daily_resource_key') THEN
      ALTER TABLE fact_ec2_instance_cost_daily
        ADD CONSTRAINT fk_fact_ec2_instance_cost_daily_resource_key
        FOREIGN KEY (resource_key) REFERENCES dim_resource(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fact_ec2_instance_coverage_daily_resource_key') THEN
      ALTER TABLE fact_ec2_instance_coverage_daily
        ADD CONSTRAINT fk_fact_ec2_instance_coverage_daily_resource_key
        FOREIGN KEY (resource_key) REFERENCES dim_resource(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
`);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE IF EXISTS fact_ec2_instance_daily
  DROP CONSTRAINT IF EXISTS chk_fact_ec2_instance_daily_pricing_model,
  DROP CONSTRAINT IF EXISTS chk_fact_ec2_instance_daily_reservation_type;

ALTER TABLE IF EXISTS fact_ec2_instance_coverage_daily
  DROP CONSTRAINT IF EXISTS chk_fact_ec2_instance_coverage_daily_reservation_type;

ALTER TABLE IF EXISTS ec2_cost_history_daily
  DROP COLUMN IF EXISTS allocation_scope,
  DROP COLUMN IF EXISTS is_shared_cost,
  DROP COLUMN IF EXISTS allocation_method;

ALTER TABLE IF EXISTS ec2_cost_history_monthly
  DROP COLUMN IF EXISTS allocation_scope,
  DROP COLUMN IF EXISTS is_shared_cost,
  DROP COLUMN IF EXISTS allocation_method;

DROP TABLE IF EXISTS fact_ec2_instance_coverage_daily;
DROP TABLE IF EXISTS fact_ec2_instance_cost_daily;
`);
  },
};

export default migration;