import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE IF EXISTS fact_ec2_instance_cost_daily
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10);

DROP INDEX IF EXISTS uq_fact_ec2_instance_cost_daily_instance_date;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_ec2_instance_cost_daily_tenant_instance_date
  ON fact_ec2_instance_cost_daily(tenant_id, instance_id, usage_date);
`);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS uq_fact_ec2_instance_cost_daily_tenant_instance_date;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_ec2_instance_cost_daily_instance_date
  ON fact_ec2_instance_cost_daily(instance_id, usage_date);

ALTER TABLE IF EXISTS fact_ec2_instance_cost_daily
  DROP COLUMN IF EXISTS currency_code;
`);
  },
};

export default migration;

