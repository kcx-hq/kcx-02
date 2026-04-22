import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS uq_fact_ec2_instance_coverage_daily_instance_date;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_ec2_instance_coverage_daily_tenant_instance_date
  ON fact_ec2_instance_coverage_daily(tenant_id, instance_id, usage_date);
`);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS uq_fact_ec2_instance_coverage_daily_tenant_instance_date;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_ec2_instance_coverage_daily_instance_date
  ON fact_ec2_instance_coverage_daily(instance_id, usage_date);
`);
  },
};

export default migration;
