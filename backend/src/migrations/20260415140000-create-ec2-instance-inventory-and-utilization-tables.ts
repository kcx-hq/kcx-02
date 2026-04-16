import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS ec2_instance_inventory_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id uuid,
    cloud_connection_id uuid,
    provider_id bigint,

    instance_id text NOT NULL,
    resource_key bigint,
    region_key bigint,
    sub_account_key bigint,

    instance_type text,
    platform text,
    platform_details text,
    architecture text,
    virtualization_type text,
    tenancy text,

    state text,
    instance_lifecycle text,
    spot_instance_request_id text,

    launch_time timestamp,
    availability_zone text,

    vpc_id text,
    subnet_id text,
    image_id text,

    private_ip_address text,
    public_ip_address text,
    key_name text,

    iam_instance_profile_arn text,
    monitoring_state text,
    ebs_optimized boolean,

    root_device_name text,
    root_device_type text,
    hypervisor text,

    asg_name text,

    tags_json jsonb,
    metadata_json jsonb,

    discovered_at timestamp NOT NULL,
    is_current boolean DEFAULT true,
    deleted_at timestamp,

    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ec2_inventory_instance_id ON ec2_instance_inventory_snapshots(instance_id);
CREATE INDEX IF NOT EXISTS idx_ec2_inventory_tenant ON ec2_instance_inventory_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ec2_inventory_connection ON ec2_instance_inventory_snapshots(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_ec2_inventory_region ON ec2_instance_inventory_snapshots(region_key);
CREATE INDEX IF NOT EXISTS idx_ec2_inventory_resource_key ON ec2_instance_inventory_snapshots(resource_key);
CREATE INDEX IF NOT EXISTS idx_ec2_inventory_is_current ON ec2_instance_inventory_snapshots(is_current);
`);

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS ec2_instance_utilization_hourly (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id uuid,
    cloud_connection_id uuid,
    provider_id bigint,

    instance_id text NOT NULL,
    hour_start timestamp NOT NULL,
    usage_date date NOT NULL,

    resource_key bigint,
    region_key bigint,
    sub_account_key bigint,

    cpu_avg numeric(10,4),
    cpu_max numeric(10,4),
    cpu_min numeric(10,4),

    network_in_bytes bigint,
    network_out_bytes bigint,
    network_packets_in bigint,
    network_packets_out bigint,

    disk_read_bytes bigint,
    disk_write_bytes bigint,
    disk_read_ops bigint,
    disk_write_ops bigint,

    status_check_failed_max numeric(10,4),
    status_check_failed_instance_max numeric(10,4),
    status_check_failed_system_max numeric(10,4),

    ebs_read_bytes bigint,
    ebs_write_bytes bigint,
    ebs_read_ops bigint,
    ebs_write_ops bigint,
    ebs_queue_length_max numeric(12,4),
    ebs_idle_time_avg numeric(12,4),
    ebs_burst_balance_avg numeric(10,4),

    memory_avg numeric(10,4),
    memory_max numeric(10,4),
    swap_used_avg numeric(10,4),

    disk_used_percent_avg numeric(10,4),
    disk_free_bytes_avg bigint,

    sample_count integer DEFAULT 1,
    metric_source varchar(50),

    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ec2_hourly_instance_hour
ON ec2_instance_utilization_hourly(instance_id, hour_start);

CREATE INDEX IF NOT EXISTS idx_ec2_hourly_tenant ON ec2_instance_utilization_hourly(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ec2_hourly_connection ON ec2_instance_utilization_hourly(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_ec2_hourly_date ON ec2_instance_utilization_hourly(usage_date);
CREATE INDEX IF NOT EXISTS idx_ec2_hourly_resource_key ON ec2_instance_utilization_hourly(resource_key);
`);

    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS ec2_instance_utilization_daily (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id uuid,
    cloud_connection_id uuid,
    provider_id bigint,

    instance_id text NOT NULL,
    usage_date date NOT NULL,

    resource_key bigint,
    region_key bigint,
    sub_account_key bigint,

    cpu_avg numeric(10,4),
    cpu_max numeric(10,4),
    cpu_min numeric(10,4),

    network_in_bytes bigint,
    network_out_bytes bigint,
    network_packets_in bigint,
    network_packets_out bigint,

    disk_read_bytes bigint,
    disk_write_bytes bigint,
    disk_read_ops bigint,
    disk_write_ops bigint,

    status_check_failed_max numeric(10,4),
    status_check_failed_instance_max numeric(10,4),
    status_check_failed_system_max numeric(10,4),

    ebs_read_bytes bigint,
    ebs_write_bytes bigint,
    ebs_read_ops bigint,
    ebs_write_ops bigint,
    ebs_queue_length_max numeric(12,4),
    ebs_idle_time_avg numeric(12,4),
    ebs_burst_balance_avg numeric(10,4),

    memory_avg numeric(10,4),
    memory_max numeric(10,4),
    swap_used_avg numeric(10,4),

    disk_used_percent_avg numeric(10,4),
    disk_used_percent_max numeric(10,4),
    disk_free_bytes_avg bigint,

    is_idle_candidate boolean,
    is_underutilized_candidate boolean,
    is_overutilized_candidate boolean,
    peak_to_avg_cpu_ratio numeric(10,4),

    sample_count integer DEFAULT 1,
    metric_source varchar(50),

    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ec2_daily_instance_date
ON ec2_instance_utilization_daily(instance_id, usage_date);

CREATE INDEX IF NOT EXISTS idx_ec2_daily_tenant ON ec2_instance_utilization_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ec2_daily_connection ON ec2_instance_utilization_daily(cloud_connection_id);
CREATE INDEX IF NOT EXISTS idx_ec2_daily_resource_key ON ec2_instance_utilization_daily(resource_key);
`);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS ec2_instance_utilization_daily;
DROP TABLE IF EXISTS ec2_instance_utilization_hourly;
DROP TABLE IF EXISTS ec2_instance_inventory_snapshots;
`);
  },
};

export default migration;
