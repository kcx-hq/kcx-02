import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DO $$
BEGIN
  IF to_regclass('public.fact_cost_line_items') IS NOT NULL THEN
    ALTER TABLE fact_cost_line_items
      ALTER COLUMN consumed_quantity TYPE NUMERIC(38,18) USING consumed_quantity::numeric,
      ALTER COLUMN pricing_quantity TYPE NUMERIC(38,18) USING pricing_quantity::numeric,
      ALTER COLUMN billed_cost TYPE NUMERIC(38,18) USING billed_cost::numeric,
      ALTER COLUMN effective_cost TYPE NUMERIC(38,18) USING effective_cost::numeric,
      ALTER COLUMN list_cost TYPE NUMERIC(38,18) USING list_cost::numeric,
      ALTER COLUMN public_on_demand_cost TYPE NUMERIC(38,18) USING public_on_demand_cost::numeric,
      ALTER COLUMN public_on_demand_rate TYPE NUMERIC(38,18) USING public_on_demand_rate::numeric,
      ALTER COLUMN discount_amount TYPE NUMERIC(38,18) USING discount_amount::numeric,
      ALTER COLUMN bundled_discount TYPE NUMERIC(38,18) USING bundled_discount::numeric,
      ALTER COLUMN credit_amount TYPE NUMERIC(38,18) USING credit_amount::numeric,
      ALTER COLUMN refund_amount TYPE NUMERIC(38,18) USING refund_amount::numeric,
      ALTER COLUMN tax_cost TYPE NUMERIC(38,18) USING tax_cost::numeric;
  END IF;

  IF to_regclass('public.staging_cost_line_items') IS NOT NULL THEN
    ALTER TABLE staging_cost_line_items
      ALTER COLUMN consumed_quantity TYPE NUMERIC(38,18) USING consumed_quantity::numeric,
      ALTER COLUMN pricing_quantity TYPE NUMERIC(38,18) USING pricing_quantity::numeric,
      ALTER COLUMN billed_cost TYPE NUMERIC(38,18) USING billed_cost::numeric,
      ALTER COLUMN effective_cost TYPE NUMERIC(38,18) USING effective_cost::numeric,
      ALTER COLUMN list_cost TYPE NUMERIC(38,18) USING list_cost::numeric,
      ALTER COLUMN public_on_demand_cost TYPE NUMERIC(38,18) USING public_on_demand_cost::numeric,
      ALTER COLUMN public_on_demand_rate TYPE NUMERIC(38,18) USING public_on_demand_rate::numeric,
      ALTER COLUMN discount_amount TYPE NUMERIC(38,18) USING discount_amount::numeric,
      ALTER COLUMN bundled_discount TYPE NUMERIC(38,18) USING bundled_discount::numeric,
      ALTER COLUMN credit_amount TYPE NUMERIC(38,18) USING credit_amount::numeric,
      ALTER COLUMN refund_amount TYPE NUMERIC(38,18) USING refund_amount::numeric,
      ALTER COLUMN tax_cost TYPE NUMERIC(38,18) USING tax_cost::numeric;
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
      ALTER COLUMN consumed_quantity TYPE NUMERIC(18,6) USING consumed_quantity::numeric,
      ALTER COLUMN pricing_quantity TYPE NUMERIC(18,6) USING pricing_quantity::numeric,
      ALTER COLUMN billed_cost TYPE NUMERIC(20,12) USING billed_cost::numeric,
      ALTER COLUMN effective_cost TYPE NUMERIC(20,12) USING effective_cost::numeric,
      ALTER COLUMN list_cost TYPE NUMERIC(18,6) USING list_cost::numeric,
      ALTER COLUMN public_on_demand_cost TYPE NUMERIC(20,12) USING public_on_demand_cost::numeric,
      ALTER COLUMN public_on_demand_rate TYPE NUMERIC(20,12) USING public_on_demand_rate::numeric,
      ALTER COLUMN discount_amount TYPE NUMERIC(20,12) USING discount_amount::numeric,
      ALTER COLUMN bundled_discount TYPE NUMERIC(18,6) USING bundled_discount::numeric,
      ALTER COLUMN credit_amount TYPE NUMERIC(18,6) USING credit_amount::numeric,
      ALTER COLUMN refund_amount TYPE NUMERIC(18,6) USING refund_amount::numeric,
      ALTER COLUMN tax_cost TYPE NUMERIC(18,6) USING tax_cost::numeric;
  END IF;

  IF to_regclass('public.staging_cost_line_items') IS NOT NULL THEN
    ALTER TABLE staging_cost_line_items
      ALTER COLUMN consumed_quantity TYPE NUMERIC(18,6) USING consumed_quantity::numeric,
      ALTER COLUMN pricing_quantity TYPE NUMERIC(18,6) USING pricing_quantity::numeric,
      ALTER COLUMN billed_cost TYPE NUMERIC(20,12) USING billed_cost::numeric,
      ALTER COLUMN effective_cost TYPE NUMERIC(20,12) USING effective_cost::numeric,
      ALTER COLUMN list_cost TYPE NUMERIC(18,6) USING list_cost::numeric,
      ALTER COLUMN public_on_demand_cost TYPE NUMERIC(20,12) USING public_on_demand_cost::numeric,
      ALTER COLUMN public_on_demand_rate TYPE NUMERIC(20,12) USING public_on_demand_rate::numeric,
      ALTER COLUMN discount_amount TYPE NUMERIC(20,12) USING discount_amount::numeric,
      ALTER COLUMN bundled_discount TYPE NUMERIC(18,6) USING bundled_discount::numeric,
      ALTER COLUMN credit_amount TYPE NUMERIC(18,6) USING credit_amount::numeric,
      ALTER COLUMN refund_amount TYPE NUMERIC(18,6) USING refund_amount::numeric,
      ALTER COLUMN tax_cost TYPE NUMERIC(18,6) USING tax_cost::numeric;
  END IF;
END $$;
`);
  },
};

export default migration;

