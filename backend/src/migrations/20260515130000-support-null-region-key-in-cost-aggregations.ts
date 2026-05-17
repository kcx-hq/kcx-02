import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DO $$
DECLARE
  pk_name text;
BEGIN
  -- If a PK includes region_key, drop it so region_key can be nullable.
  SELECT c.conname INTO pk_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'agg_cost_hourly'
    AND c.contype = 'p'
    AND EXISTS (
      SELECT 1
      FROM unnest(c.conkey) AS k(attnum)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      WHERE a.attname = 'region_key'
    );
  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.agg_cost_hourly DROP CONSTRAINT %I', pk_name);
  END IF;

  SELECT c.conname INTO pk_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'agg_cost_daily'
    AND c.contype = 'p'
    AND EXISTS (
      SELECT 1
      FROM unnest(c.conkey) AS k(attnum)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      WHERE a.attname = 'region_key'
    );
  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.agg_cost_daily DROP CONSTRAINT %I', pk_name);
  END IF;

  SELECT c.conname INTO pk_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'agg_cost_monthly'
    AND c.contype = 'p'
    AND EXISTS (
      SELECT 1
      FROM unnest(c.conkey) AS k(attnum)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      WHERE a.attname = 'region_key'
    );
  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.agg_cost_monthly DROP CONSTRAINT %I', pk_name);
  END IF;

  ALTER TABLE IF EXISTS agg_cost_hourly ALTER COLUMN region_key DROP NOT NULL;
  ALTER TABLE IF EXISTS agg_cost_daily ALTER COLUMN region_key DROP NOT NULL;
  ALTER TABLE IF EXISTS agg_cost_monthly ALTER COLUMN region_key DROP NOT NULL;
END $$;
`);

    await queryInterface.sequelize.query(`
CREATE UNIQUE INDEX IF NOT EXISTS ux_agg_cost_hourly_conflict_norm_region
  ON agg_cost_hourly (
    tenant_id,
    hour_start,
    service_key,
    sub_account_key,
    COALESCE(region_key, -1),
    currency_code
  );
`);

    await queryInterface.sequelize.query(`
CREATE UNIQUE INDEX IF NOT EXISTS ux_agg_cost_daily_conflict_norm_region
  ON agg_cost_daily (
    tenant_id,
    usage_date,
    service_key,
    sub_account_key,
    COALESCE(region_key, -1),
    currency_code
  );
`);

    await queryInterface.sequelize.query(`
CREATE UNIQUE INDEX IF NOT EXISTS ux_agg_cost_monthly_conflict_norm_region
  ON agg_cost_monthly (
    tenant_id,
    month_start,
    service_key,
    sub_account_key,
    COALESCE(region_key, -1),
    currency_code
  );
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS ux_agg_cost_monthly_conflict_norm_region;
DROP INDEX IF EXISTS ux_agg_cost_daily_conflict_norm_region;
DROP INDEX IF EXISTS ux_agg_cost_hourly_conflict_norm_region;
`);
  },
};

export default migration;

