import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DO $$
BEGIN
  IF to_regclass('public.fact_cost_line_items') IS NOT NULL THEN
    ALTER TABLE fact_cost_line_items
      ADD COLUMN IF NOT EXISTS product_usage_type TEXT,
      ADD COLUMN IF NOT EXISTS product_family TEXT,
      ADD COLUMN IF NOT EXISTS from_location TEXT,
      ADD COLUMN IF NOT EXISTS to_location TEXT,
      ADD COLUMN IF NOT EXISTS from_region_code TEXT,
      ADD COLUMN IF NOT EXISTS to_region_code TEXT,
      ADD COLUMN IF NOT EXISTS bill_type TEXT,
      ADD COLUMN IF NOT EXISTS line_item_description TEXT,
      ADD COLUMN IF NOT EXISTS legal_entity TEXT,
      ADD COLUMN IF NOT EXISTS public_on_demand_rate TEXT,
      ADD COLUMN IF NOT EXISTS bundled_discount NUMERIC(18,6);
  END IF;
END $$;
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DO $$
BEGIN
  IF to_regclass('public.fact_cost_line_items') IS NOT NULL THEN
    ALTER TABLE fact_cost_line_items
      DROP COLUMN IF EXISTS bundled_discount,
      DROP COLUMN IF EXISTS public_on_demand_rate,
      DROP COLUMN IF EXISTS legal_entity,
      DROP COLUMN IF EXISTS line_item_description,
      DROP COLUMN IF EXISTS bill_type,
      DROP COLUMN IF EXISTS to_region_code,
      DROP COLUMN IF EXISTS from_region_code,
      DROP COLUMN IF EXISTS to_location,
      DROP COLUMN IF EXISTS from_location,
      DROP COLUMN IF EXISTS product_family,
      DROP COLUMN IF EXISTS product_usage_type;
  END IF;
END $$;
`);
  },
};

export default migration;

