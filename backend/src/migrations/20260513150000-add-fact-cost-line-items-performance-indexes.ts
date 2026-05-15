import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE INDEX IF NOT EXISTS idx_fact_cost_line_items_billing_source_usage_window
  ON fact_cost_line_items(billing_source_id, usage_start_time, usage_end_time);

CREATE INDEX IF NOT EXISTS idx_fact_cost_line_items_tenant_billing_source_usage_start
  ON fact_cost_line_items(tenant_id, billing_source_id, usage_start_time);
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS idx_fact_cost_line_items_tenant_billing_source_usage_start;
DROP INDEX IF EXISTS idx_fact_cost_line_items_billing_source_usage_window;
`);
  },
};

export default migration;

