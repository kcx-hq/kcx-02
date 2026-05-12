import type { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fact_ec2_instance_daily_tenant_usage_date_desc
      ON fact_ec2_instance_daily (tenant_id, usage_date DESC);
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fact_ec2_instance_daily_tenant_instance_usage_date_desc
      ON fact_ec2_instance_daily (tenant_id, instance_id, usage_date DESC);
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fact_ec2_instance_daily_tenant_connection_usage_date_desc
      ON fact_ec2_instance_daily (tenant_id, cloud_connection_id, usage_date DESC);
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fact_ec2_instance_daily_tenant_region_usage_date_desc
      ON fact_ec2_instance_daily (tenant_id, region_key, usage_date DESC);
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fact_ec2_instance_daily_tenant_subacct_usage_date_desc
      ON fact_ec2_instance_daily (tenant_id, sub_account_key, usage_date DESC);
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ec2_cost_history_daily_tenant_usage_date_desc
      ON ec2_cost_history_daily (tenant_id, usage_date DESC);
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ec2_cost_history_daily_tenant_instance_usage_date_desc
      ON ec2_cost_history_daily (tenant_id, instance_id, usage_date DESC);
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ec2_cost_history_daily_tenant_billing_source_usage_date_desc
      ON ec2_cost_history_daily (tenant_id, billing_source_id, usage_date DESC);
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ec2_cost_history_daily_tenant_charge_pricing_usage_date_desc
      ON ec2_cost_history_daily (tenant_id, charge_category, pricing_model, usage_date DESC);
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ec2_instance_inventory_snapshots_tenant_connection_instance_current
      ON ec2_instance_inventory_snapshots (tenant_id, cloud_connection_id, instance_id, is_current);
  `);

  await queryInterface.sequelize.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ec2_instance_inventory_snapshots_tenant_connection_region_current
      ON ec2_instance_inventory_snapshots (tenant_id, cloud_connection_id, region_key, is_current);
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    DROP INDEX CONCURRENTLY IF EXISTS idx_ec2_instance_inventory_snapshots_tenant_connection_region_current;
  `);
  await queryInterface.sequelize.query(`
    DROP INDEX CONCURRENTLY IF EXISTS idx_ec2_instance_inventory_snapshots_tenant_connection_instance_current;
  `);
  await queryInterface.sequelize.query(`
    DROP INDEX CONCURRENTLY IF EXISTS idx_ec2_cost_history_daily_tenant_charge_pricing_usage_date_desc;
  `);
  await queryInterface.sequelize.query(`
    DROP INDEX CONCURRENTLY IF EXISTS idx_ec2_cost_history_daily_tenant_billing_source_usage_date_desc;
  `);
  await queryInterface.sequelize.query(`
    DROP INDEX CONCURRENTLY IF EXISTS idx_ec2_cost_history_daily_tenant_instance_usage_date_desc;
  `);
  await queryInterface.sequelize.query(`
    DROP INDEX CONCURRENTLY IF EXISTS idx_ec2_cost_history_daily_tenant_usage_date_desc;
  `);
  await queryInterface.sequelize.query(`
    DROP INDEX CONCURRENTLY IF EXISTS idx_fact_ec2_instance_daily_tenant_subacct_usage_date_desc;
  `);
  await queryInterface.sequelize.query(`
    DROP INDEX CONCURRENTLY IF EXISTS idx_fact_ec2_instance_daily_tenant_region_usage_date_desc;
  `);
  await queryInterface.sequelize.query(`
    DROP INDEX CONCURRENTLY IF EXISTS idx_fact_ec2_instance_daily_tenant_connection_usage_date_desc;
  `);
  await queryInterface.sequelize.query(`
    DROP INDEX CONCURRENTLY IF EXISTS idx_fact_ec2_instance_daily_tenant_instance_usage_date_desc;
  `);
  await queryInterface.sequelize.query(`
    DROP INDEX CONCURRENTLY IF EXISTS idx_fact_ec2_instance_daily_tenant_usage_date_desc;
  `);
}

