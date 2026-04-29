import type { QueryInterface } from "sequelize";

const TABLE_NAME = "fact_cost_line_items";

const upSql = `
DO $$
BEGIN
  IF to_regclass('public.${TABLE_NAME}') IS NOT NULL THEN
    ALTER TABLE ${TABLE_NAME}
      ALTER COLUMN billed_cost TYPE NUMERIC(20,12) USING billed_cost::numeric,
      ALTER COLUMN effective_cost TYPE NUMERIC(20,12) USING effective_cost::numeric,
      ALTER COLUMN discount_amount TYPE NUMERIC(20,12) USING discount_amount::numeric,
      ALTER COLUMN public_on_demand_cost TYPE NUMERIC(20,12) USING public_on_demand_cost::numeric,
      ALTER COLUMN public_on_demand_rate TYPE NUMERIC(20,12) USING NULLIF(TRIM(public_on_demand_rate::text), '')::numeric;
  END IF;
END $$;
`;

const downSql = `
DO $$
BEGIN
  IF to_regclass('public.${TABLE_NAME}') IS NOT NULL THEN
    ALTER TABLE ${TABLE_NAME}
      ALTER COLUMN billed_cost TYPE NUMERIC(18,6) USING billed_cost::numeric,
      ALTER COLUMN effective_cost TYPE NUMERIC(18,6) USING effective_cost::numeric,
      ALTER COLUMN discount_amount TYPE NUMERIC(18,6) USING discount_amount::numeric,
      ALTER COLUMN public_on_demand_cost TYPE NUMERIC(18,6) USING public_on_demand_cost::numeric,
      ALTER COLUMN public_on_demand_rate TYPE TEXT USING public_on_demand_rate::text;
  END IF;
END $$;
`;

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(upSql);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(downSql);
}
