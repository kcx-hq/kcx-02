import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE IF EXISTS fact_ec2_instance_daily
  ADD COLUMN IF NOT EXISTS ebs_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS data_transfer_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS tax_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS credit_amount NUMERIC(18,6) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(18,6) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_billed_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_effective_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_list_cost NUMERIC(18,6) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10) DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS uncovered_hours NUMERIC(18,6) DEFAULT 0 NOT NULL;

DROP INDEX IF EXISTS uq_fact_ec2_instance_daily_instance_date;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_ec2_instance_daily_tenant_instance_date
  ON fact_ec2_instance_daily(tenant_id, instance_id, usage_date);
`);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS uq_fact_ec2_instance_daily_tenant_instance_date;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_ec2_instance_daily_instance_date
  ON fact_ec2_instance_daily(instance_id, usage_date);

ALTER TABLE IF EXISTS fact_ec2_instance_daily
  DROP COLUMN IF EXISTS ebs_cost,
  DROP COLUMN IF EXISTS data_transfer_cost,
  DROP COLUMN IF EXISTS tax_cost,
  DROP COLUMN IF EXISTS credit_amount,
  DROP COLUMN IF EXISTS refund_amount,
  DROP COLUMN IF EXISTS total_billed_cost,
  DROP COLUMN IF EXISTS total_effective_cost,
  DROP COLUMN IF EXISTS total_list_cost,
  DROP COLUMN IF EXISTS currency_code,
  DROP COLUMN IF EXISTS uncovered_hours;
`);
  },
};

export default migration;
