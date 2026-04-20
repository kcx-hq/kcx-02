import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS fact_ec2_instance_daily (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id uuid,
    cloud_connection_id uuid,
    provider_id bigint,

    usage_date date NOT NULL,
    instance_id text NOT NULL,
    resource_key bigint,
    region_key bigint,
    sub_account_key bigint,

    instance_type text,
    state text,
    is_running boolean NOT NULL,
    launch_time timestamp,
    deleted_at timestamp,
    source varchar(50),

    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_ec2_instance_daily_instance_date
ON fact_ec2_instance_daily(instance_id, usage_date);

CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_daily_tenant_id
ON fact_ec2_instance_daily(tenant_id);

CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_daily_cloud_connection_id
ON fact_ec2_instance_daily(cloud_connection_id);

CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_daily_usage_date
ON fact_ec2_instance_daily(usage_date);

CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_daily_region_key
ON fact_ec2_instance_daily(region_key);

CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_daily_sub_account_key
ON fact_ec2_instance_daily(sub_account_key);

CREATE INDEX IF NOT EXISTS idx_fact_ec2_instance_daily_is_running
ON fact_ec2_instance_daily(is_running);
`);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS fact_ec2_instance_daily;
`);
  },
};

export default migration;
