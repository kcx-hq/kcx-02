import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE fact_ec2_instance_daily
  ADD COLUMN IF NOT EXISTS instance_name text,
  ADD COLUMN IF NOT EXISTS availability_zone text,
  ADD COLUMN IF NOT EXISTS is_spot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_hours numeric(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compute_cost numeric(18,6) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_ec2_instance_daily_instance_date
  ON fact_ec2_instance_daily(instance_id, usage_date);

CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_daily_tenant_id
  ON fact_ec2_instance_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_daily_cloud_connection_id
  ON fact_ec2_instance_daily(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_daily_usage_date
  ON fact_ec2_instance_daily(usage_date);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_daily_sub_account_key
  ON fact_ec2_instance_daily(sub_account_key);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_daily_region_key
  ON fact_ec2_instance_daily(region_key);
CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_daily_is_running
  ON fact_ec2_instance_daily(is_running);
`);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE fact_ec2_instance_daily
  DROP COLUMN IF EXISTS instance_name,
  DROP COLUMN IF EXISTS availability_zone,
  DROP COLUMN IF EXISTS is_spot,
  DROP COLUMN IF EXISTS total_hours,
  DROP COLUMN IF EXISTS compute_cost;
`);
  },
};

export default migration;

