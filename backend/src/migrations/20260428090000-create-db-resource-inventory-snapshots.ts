import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS db_resource_inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID,
  cloud_connection_id UUID,
  provider_id BIGINT,

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
  allocated_storage_gb NUMERIC(18,6),
  data_footprint_gb NUMERIC(18,6),
  instance_class TEXT,
  capacity_mode TEXT,
  cluster_id TEXT,
  is_cluster_resource BOOLEAN DEFAULT false NOT NULL,

  tags_json JSONB,
  metadata_json JSONB,

  discovered_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_current BOOLEAN DEFAULT true NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_db_resource_inv_tenant_id
  ON db_resource_inventory_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_db_resource_inv_cloud_connection_id
  ON db_resource_inventory_snapshots(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_db_resource_inv_provider_id
  ON db_resource_inventory_snapshots(provider_id);
CREATE INDEX IF NOT EXISTS idx_db_resource_inv_resource_id
  ON db_resource_inventory_snapshots(resource_id);
CREATE INDEX IF NOT EXISTS idx_db_resource_inv_db_service
  ON db_resource_inventory_snapshots(db_service);
CREATE INDEX IF NOT EXISTS idx_db_resource_inv_db_engine
  ON db_resource_inventory_snapshots(db_engine);
CREATE INDEX IF NOT EXISTS idx_db_resource_inv_region_key
  ON db_resource_inventory_snapshots(region_key);
CREATE INDEX IF NOT EXISTS idx_db_resource_inv_sub_account_key
  ON db_resource_inventory_snapshots(sub_account_key);
CREATE INDEX IF NOT EXISTS idx_db_resource_inv_resource_key
  ON db_resource_inventory_snapshots(resource_key);
CREATE INDEX IF NOT EXISTS idx_db_resource_inv_is_current
  ON db_resource_inventory_snapshots(is_current);
CREATE INDEX IF NOT EXISTS idx_db_resource_inv_discovered_at
  ON db_resource_inventory_snapshots(discovered_at);
CREATE INDEX IF NOT EXISTS idx_db_resource_inv_tenant_conn_service_current
  ON db_resource_inventory_snapshots(tenant_id, cloud_connection_id, db_service, is_current);
CREATE INDEX IF NOT EXISTS idx_db_resource_inv_tenant_conn_resource_current
  ON db_resource_inventory_snapshots(tenant_id, cloud_connection_id, resource_id, is_current);

CREATE UNIQUE INDEX IF NOT EXISTS uq_db_resource_inv_current_resource
  ON db_resource_inventory_snapshots(tenant_id, cloud_connection_id, resource_id)
  WHERE is_current = true;

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_resource_inventory_snapshots'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.tenants'::regclass
        AND a.attname = 'tenant_id'
    ) THEN
    ALTER TABLE db_resource_inventory_snapshots
      ADD CONSTRAINT fk_db_resource_inv_tenant_id
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.cloud_connections') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_resource_inventory_snapshots'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.cloud_connections'::regclass
        AND a.attname = 'cloud_connection_id'
    ) THEN
    ALTER TABLE db_resource_inventory_snapshots
      ADD CONSTRAINT fk_db_resource_inv_cloud_connection_id
      FOREIGN KEY (cloud_connection_id) REFERENCES cloud_connections(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.cloud_providers') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_resource_inventory_snapshots'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.cloud_providers'::regclass
        AND a.attname = 'provider_id'
    ) THEN
    ALTER TABLE db_resource_inventory_snapshots
      ADD CONSTRAINT fk_db_resource_inv_provider_id
      FOREIGN KEY (provider_id) REFERENCES cloud_providers(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.dim_resource') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_resource_inventory_snapshots'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.dim_resource'::regclass
        AND a.attname = 'resource_key'
    ) THEN
    ALTER TABLE db_resource_inventory_snapshots
      ADD CONSTRAINT fk_db_resource_inv_resource_key
      FOREIGN KEY (resource_key) REFERENCES dim_resource(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.dim_region') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_resource_inventory_snapshots'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.dim_region'::regclass
        AND a.attname = 'region_key'
    ) THEN
    ALTER TABLE db_resource_inventory_snapshots
      ADD CONSTRAINT fk_db_resource_inv_region_key
      FOREIGN KEY (region_key) REFERENCES dim_region(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.dim_sub_account') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.db_resource_inventory_snapshots'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.dim_sub_account'::regclass
        AND a.attname = 'sub_account_key'
    ) THEN
    ALTER TABLE db_resource_inventory_snapshots
      ADD CONSTRAINT fk_db_resource_inv_sub_account_key
      FOREIGN KEY (sub_account_key) REFERENCES dim_sub_account(id) ON DELETE SET NULL;
  END IF;
END $$;
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS db_resource_inventory_snapshots;
`);
  },
};

export default migration;
