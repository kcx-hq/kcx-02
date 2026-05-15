import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DO $$
BEGIN
  IF to_regclass('public.agg_cost_hourly') IS NOT NULL THEN
    ALTER TABLE agg_cost_hourly
      ALTER COLUMN billed_cost TYPE NUMERIC(38,18) USING billed_cost::numeric,
      ALTER COLUMN effective_cost TYPE NUMERIC(38,18) USING effective_cost::numeric,
      ALTER COLUMN list_cost TYPE NUMERIC(38,18) USING list_cost::numeric,
      ALTER COLUMN usage_quantity TYPE NUMERIC(38,18) USING usage_quantity::numeric;
  END IF;

  IF to_regclass('public.agg_cost_daily') IS NOT NULL THEN
    ALTER TABLE agg_cost_daily
      ALTER COLUMN billed_cost TYPE NUMERIC(38,18) USING billed_cost::numeric,
      ALTER COLUMN effective_cost TYPE NUMERIC(38,18) USING effective_cost::numeric,
      ALTER COLUMN list_cost TYPE NUMERIC(38,18) USING list_cost::numeric,
      ALTER COLUMN usage_quantity TYPE NUMERIC(38,18) USING usage_quantity::numeric;
  END IF;

  IF to_regclass('public.agg_cost_monthly') IS NOT NULL THEN
    ALTER TABLE agg_cost_monthly
      ALTER COLUMN billed_cost TYPE NUMERIC(38,18) USING billed_cost::numeric,
      ALTER COLUMN effective_cost TYPE NUMERIC(38,18) USING effective_cost::numeric,
      ALTER COLUMN list_cost TYPE NUMERIC(38,18) USING list_cost::numeric,
      ALTER COLUMN usage_quantity TYPE NUMERIC(38,18) USING usage_quantity::numeric;
  END IF;
END $$;
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DO $$
BEGIN
  IF to_regclass('public.agg_cost_hourly') IS NOT NULL THEN
    ALTER TABLE agg_cost_hourly
      ALTER COLUMN billed_cost TYPE NUMERIC(18,4) USING billed_cost::numeric,
      ALTER COLUMN effective_cost TYPE NUMERIC(18,4) USING effective_cost::numeric,
      ALTER COLUMN list_cost TYPE NUMERIC(18,4) USING list_cost::numeric,
      ALTER COLUMN usage_quantity TYPE NUMERIC(18,4) USING usage_quantity::numeric;
  END IF;

  IF to_regclass('public.agg_cost_daily') IS NOT NULL THEN
    ALTER TABLE agg_cost_daily
      ALTER COLUMN billed_cost TYPE NUMERIC(18,4) USING billed_cost::numeric,
      ALTER COLUMN effective_cost TYPE NUMERIC(18,4) USING effective_cost::numeric,
      ALTER COLUMN list_cost TYPE NUMERIC(18,4) USING list_cost::numeric,
      ALTER COLUMN usage_quantity TYPE NUMERIC(18,4) USING usage_quantity::numeric;
  END IF;

  IF to_regclass('public.agg_cost_monthly') IS NOT NULL THEN
    ALTER TABLE agg_cost_monthly
      ALTER COLUMN billed_cost TYPE NUMERIC(18,4) USING billed_cost::numeric,
      ALTER COLUMN effective_cost TYPE NUMERIC(18,4) USING effective_cost::numeric,
      ALTER COLUMN list_cost TYPE NUMERIC(18,4) USING list_cost::numeric,
      ALTER COLUMN usage_quantity TYPE NUMERIC(18,4) USING usage_quantity::numeric;
  END IF;
END $$;
`);
  },
};

export default migration;

