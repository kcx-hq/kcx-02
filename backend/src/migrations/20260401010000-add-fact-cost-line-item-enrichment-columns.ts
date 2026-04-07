/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const hasTable = async (queryInterface, tableName) => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    if (!(await hasTable(queryInterface, "fact_cost_line_items"))) {
      return;
    }

    await queryInterface.sequelize.query(`
ALTER TABLE fact_cost_line_items
  ADD COLUMN IF NOT EXISTS usage_start_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS usage_end_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS usage_type TEXT,
  ADD COLUMN IF NOT EXISTS operation TEXT,
  ADD COLUMN IF NOT EXISTS line_item_type TEXT,
  ADD COLUMN IF NOT EXISTS pricing_term TEXT,
  ADD COLUMN IF NOT EXISTS purchase_option TEXT,
  ADD COLUMN IF NOT EXISTS public_on_demand_cost NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS credit_amount NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS tax_cost NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS reservation_arn TEXT,
  ADD COLUMN IF NOT EXISTS savings_plan_arn TEXT,
  ADD COLUMN IF NOT EXISTS savings_plan_type TEXT,
  ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMP DEFAULT NOW();
`);
  },

  async down(queryInterface) {
    if (!(await hasTable(queryInterface, "fact_cost_line_items"))) {
      return;
    }

    await queryInterface.sequelize.query(`
ALTER TABLE fact_cost_line_items
  DROP COLUMN IF EXISTS usage_start_time,
  DROP COLUMN IF EXISTS usage_end_time,
  DROP COLUMN IF EXISTS usage_type,
  DROP COLUMN IF EXISTS operation,
  DROP COLUMN IF EXISTS line_item_type,
  DROP COLUMN IF EXISTS pricing_term,
  DROP COLUMN IF EXISTS purchase_option,
  DROP COLUMN IF EXISTS public_on_demand_cost,
  DROP COLUMN IF EXISTS discount_amount,
  DROP COLUMN IF EXISTS credit_amount,
  DROP COLUMN IF EXISTS refund_amount,
  DROP COLUMN IF EXISTS tax_cost,
  DROP COLUMN IF EXISTS reservation_arn,
  DROP COLUMN IF EXISTS savings_plan_arn,
  DROP COLUMN IF EXISTS savings_plan_type,
  DROP COLUMN IF EXISTS ingested_at;
`);
  },
};

export default migration;


