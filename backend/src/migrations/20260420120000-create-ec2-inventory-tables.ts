import { literal } from "sequelize";
import type { DataTypes, QueryInterface } from "sequelize";

type MigrationDataTypes = typeof DataTypes;
type IndexWithName = { name?: string };

const hasTable = async (queryInterface: QueryInterface, tableName: string): Promise<boolean> => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const hasIndex = async (queryInterface: QueryInterface, tableName: string, indexName: string): Promise<boolean> => {
  try {
    const indexes = (await queryInterface.showIndex(tableName)) as IndexWithName[];
    return indexes.some((index) => index.name === indexName);
  } catch {
    return false;
  }
};

const addIndexIfMissing = async (
  queryInterface: QueryInterface,
  tableName: string,
  fields: string[],
  indexName: string,
): Promise<void> => {
  if (await hasIndex(queryInterface, tableName, indexName)) {
    return;
  }

  await queryInterface.addIndex(tableName, fields, { name: indexName });
};

const migration = {
  async up(queryInterface: QueryInterface, Sequelize: MigrationDataTypes): Promise<void> {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    if (!(await hasTable(queryInterface, "ec2_volume_inventory_snapshots"))) {
      await queryInterface.createTable("ec2_volume_inventory_snapshots", {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: literal("gen_random_uuid()"),
        },
        tenant_id: { type: Sequelize.UUID, allowNull: true },
        cloud_connection_id: { type: Sequelize.UUID, allowNull: true },
        provider_id: { type: Sequelize.BIGINT, allowNull: true },
        volume_id: { type: Sequelize.TEXT, allowNull: false },
        resource_key: { type: Sequelize.BIGINT, allowNull: true },
        region_key: { type: Sequelize.BIGINT, allowNull: true },
        sub_account_key: { type: Sequelize.BIGINT, allowNull: true },
        volume_type: { type: Sequelize.TEXT, allowNull: true },
        size_gb: { type: Sequelize.INTEGER, allowNull: true },
        iops: { type: Sequelize.INTEGER, allowNull: true },
        throughput: { type: Sequelize.INTEGER, allowNull: true },
        availability_zone: { type: Sequelize.TEXT, allowNull: true },
        state: { type: Sequelize.TEXT, allowNull: true },
        attached_instance_id: { type: Sequelize.TEXT, allowNull: true },
        is_attached: { type: Sequelize.BOOLEAN, allowNull: true },
        tags_json: { type: Sequelize.JSONB, allowNull: true },
        metadata_json: { type: Sequelize.JSONB, allowNull: true },
        discovered_at: { type: Sequelize.DATE, allowNull: false },
        is_current: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: literal("NOW()") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: literal("NOW()") },
      });
    }

    await addIndexIfMissing(
      queryInterface,
      "ec2_volume_inventory_snapshots",
      ["resource_key"],
      "idx_ec2_volume_inventory_resource_key",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_volume_inventory_snapshots",
      ["region_key"],
      "idx_ec2_volume_inventory_region",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_volume_inventory_snapshots",
      ["cloud_connection_id"],
      "idx_ec2_volume_inventory_connection",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_volume_inventory_snapshots",
      ["is_current"],
      "idx_ec2_volume_inventory_is_current",
    );
    await addIndexIfMissing(queryInterface, "ec2_volume_inventory_snapshots", ["volume_id"], "idx_ec2_volume_inventory_volume_id");

    if (!(await hasTable(queryInterface, "ec2_snapshot_inventory_snapshots"))) {
      await queryInterface.createTable("ec2_snapshot_inventory_snapshots", {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: literal("gen_random_uuid()"),
        },
        tenant_id: { type: Sequelize.UUID, allowNull: true },
        cloud_connection_id: { type: Sequelize.UUID, allowNull: true },
        provider_id: { type: Sequelize.BIGINT, allowNull: true },
        snapshot_id: { type: Sequelize.TEXT, allowNull: false },
        resource_key: { type: Sequelize.BIGINT, allowNull: true },
        region_key: { type: Sequelize.BIGINT, allowNull: true },
        sub_account_key: { type: Sequelize.BIGINT, allowNull: true },
        source_volume_id: { type: Sequelize.TEXT, allowNull: true },
        source_instance_id: { type: Sequelize.TEXT, allowNull: true },
        size_gb: { type: Sequelize.INTEGER, allowNull: true },
        start_time: { type: Sequelize.DATE, allowNull: true },
        state: { type: Sequelize.TEXT, allowNull: true },
        tags_json: { type: Sequelize.JSONB, allowNull: true },
        metadata_json: { type: Sequelize.JSONB, allowNull: true },
        discovered_at: { type: Sequelize.DATE, allowNull: false },
        is_current: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: literal("NOW()") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: literal("NOW()") },
      });
    }

    await addIndexIfMissing(
      queryInterface,
      "ec2_snapshot_inventory_snapshots",
      ["resource_key"],
      "idx_ec2_snapshot_inventory_resource_key",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_snapshot_inventory_snapshots",
      ["region_key"],
      "idx_ec2_snapshot_inventory_region",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_snapshot_inventory_snapshots",
      ["cloud_connection_id"],
      "idx_ec2_snapshot_inventory_connection",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_snapshot_inventory_snapshots",
      ["is_current"],
      "idx_ec2_snapshot_inventory_is_current",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_snapshot_inventory_snapshots",
      ["snapshot_id"],
      "idx_ec2_snapshot_inventory_snapshot_id",
    );

    if (!(await hasTable(queryInterface, "ec2_eip_inventory_snapshots"))) {
      await queryInterface.createTable("ec2_eip_inventory_snapshots", {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: literal("gen_random_uuid()"),
        },
        tenant_id: { type: Sequelize.UUID, allowNull: true },
        cloud_connection_id: { type: Sequelize.UUID, allowNull: true },
        provider_id: { type: Sequelize.BIGINT, allowNull: true },
        allocation_id: { type: Sequelize.TEXT, allowNull: false },
        public_ip: { type: Sequelize.TEXT, allowNull: true },
        resource_key: { type: Sequelize.BIGINT, allowNull: true },
        region_key: { type: Sequelize.BIGINT, allowNull: true },
        sub_account_key: { type: Sequelize.BIGINT, allowNull: true },
        associated_instance_id: { type: Sequelize.TEXT, allowNull: true },
        associated_resource_id: { type: Sequelize.TEXT, allowNull: true },
        association_status: { type: Sequelize.TEXT, allowNull: true },
        is_attached: { type: Sequelize.BOOLEAN, allowNull: true },
        allocated_at: { type: Sequelize.DATE, allowNull: true },
        tags_json: { type: Sequelize.JSONB, allowNull: true },
        metadata_json: { type: Sequelize.JSONB, allowNull: true },
        discovered_at: { type: Sequelize.DATE, allowNull: false },
        is_current: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: literal("NOW()") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: literal("NOW()") },
      });
    }

    await addIndexIfMissing(
      queryInterface,
      "ec2_eip_inventory_snapshots",
      ["resource_key"],
      "idx_ec2_eip_inventory_resource_key",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_eip_inventory_snapshots",
      ["region_key"],
      "idx_ec2_eip_inventory_region",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_eip_inventory_snapshots",
      ["cloud_connection_id"],
      "idx_ec2_eip_inventory_connection",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_eip_inventory_snapshots",
      ["is_current"],
      "idx_ec2_eip_inventory_is_current",
    );
    await addIndexIfMissing(queryInterface, "ec2_eip_inventory_snapshots", ["allocation_id"], "idx_ec2_eip_inventory_allocation_id");

    if (!(await hasTable(queryInterface, "ec2_ami_inventory_snapshots"))) {
      await queryInterface.createTable("ec2_ami_inventory_snapshots", {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: literal("gen_random_uuid()"),
        },
        tenant_id: { type: Sequelize.UUID, allowNull: true },
        cloud_connection_id: { type: Sequelize.UUID, allowNull: true },
        provider_id: { type: Sequelize.BIGINT, allowNull: true },
        image_id: { type: Sequelize.TEXT, allowNull: false },
        resource_key: { type: Sequelize.BIGINT, allowNull: true },
        region_key: { type: Sequelize.BIGINT, allowNull: true },
        sub_account_key: { type: Sequelize.BIGINT, allowNull: true },
        image_name: { type: Sequelize.TEXT, allowNull: true },
        source_instance_id: { type: Sequelize.TEXT, allowNull: true },
        backing_snapshot_count: { type: Sequelize.INTEGER, allowNull: true },
        total_snapshot_size_gb: { type: Sequelize.INTEGER, allowNull: true },
        creation_date: { type: Sequelize.DATE, allowNull: true },
        state: { type: Sequelize.TEXT, allowNull: true },
        is_in_use: { type: Sequelize.BOOLEAN, allowNull: true },
        tags_json: { type: Sequelize.JSONB, allowNull: true },
        metadata_json: { type: Sequelize.JSONB, allowNull: true },
        discovered_at: { type: Sequelize.DATE, allowNull: false },
        is_current: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: literal("NOW()") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: literal("NOW()") },
      });
    }

    await addIndexIfMissing(
      queryInterface,
      "ec2_ami_inventory_snapshots",
      ["resource_key"],
      "idx_ec2_ami_inventory_resource_key",
    );
    await addIndexIfMissing(queryInterface, "ec2_ami_inventory_snapshots", ["region_key"], "idx_ec2_ami_inventory_region");
    await addIndexIfMissing(
      queryInterface,
      "ec2_ami_inventory_snapshots",
      ["cloud_connection_id"],
      "idx_ec2_ami_inventory_connection",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_ami_inventory_snapshots",
      ["is_current"],
      "idx_ec2_ami_inventory_is_current",
    );
    await addIndexIfMissing(queryInterface, "ec2_ami_inventory_snapshots", ["image_id"], "idx_ec2_ami_inventory_image_id");

    if (!(await hasTable(queryInterface, "ec2_load_balancer_inventory_snapshots"))) {
      await queryInterface.createTable("ec2_load_balancer_inventory_snapshots", {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: literal("gen_random_uuid()"),
        },
        tenant_id: { type: Sequelize.UUID, allowNull: true },
        cloud_connection_id: { type: Sequelize.UUID, allowNull: true },
        provider_id: { type: Sequelize.BIGINT, allowNull: true },
        load_balancer_arn: { type: Sequelize.TEXT, allowNull: false },
        resource_key: { type: Sequelize.BIGINT, allowNull: true },
        region_key: { type: Sequelize.BIGINT, allowNull: true },
        sub_account_key: { type: Sequelize.BIGINT, allowNull: true },
        load_balancer_name: { type: Sequelize.TEXT, allowNull: true },
        load_balancer_type: { type: Sequelize.TEXT, allowNull: true },
        scheme: { type: Sequelize.TEXT, allowNull: true },
        state: { type: Sequelize.TEXT, allowNull: true },
        target_group_count: { type: Sequelize.INTEGER, allowNull: true },
        healthy_targets_count: { type: Sequelize.INTEGER, allowNull: true },
        tags_json: { type: Sequelize.JSONB, allowNull: true },
        metadata_json: { type: Sequelize.JSONB, allowNull: true },
        discovered_at: { type: Sequelize.DATE, allowNull: false },
        is_current: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: literal("NOW()") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: literal("NOW()") },
      });
    }

    await addIndexIfMissing(
      queryInterface,
      "ec2_load_balancer_inventory_snapshots",
      ["resource_key"],
      "idx_ec2_load_balancer_inventory_resource_key",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_load_balancer_inventory_snapshots",
      ["region_key"],
      "idx_ec2_load_balancer_inventory_region",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_load_balancer_inventory_snapshots",
      ["cloud_connection_id"],
      "idx_ec2_load_balancer_inventory_connection",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_load_balancer_inventory_snapshots",
      ["is_current"],
      "idx_ec2_load_balancer_inventory_is_current",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_load_balancer_inventory_snapshots",
      ["load_balancer_arn"],
      "idx_ec2_load_balancer_inventory_load_balancer_arn",
    );

    if (!(await hasTable(queryInterface, "ec2_target_group_inventory_snapshots"))) {
      await queryInterface.createTable("ec2_target_group_inventory_snapshots", {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: literal("gen_random_uuid()"),
        },
        tenant_id: { type: Sequelize.UUID, allowNull: true },
        cloud_connection_id: { type: Sequelize.UUID, allowNull: true },
        provider_id: { type: Sequelize.BIGINT, allowNull: true },
        target_group_arn: { type: Sequelize.TEXT, allowNull: false },
        resource_key: { type: Sequelize.BIGINT, allowNull: true },
        region_key: { type: Sequelize.BIGINT, allowNull: true },
        sub_account_key: { type: Sequelize.BIGINT, allowNull: true },
        target_group_name: { type: Sequelize.TEXT, allowNull: true },
        load_balancer_arn: { type: Sequelize.TEXT, allowNull: true },
        registered_targets_count: { type: Sequelize.INTEGER, allowNull: true },
        healthy_targets_count: { type: Sequelize.INTEGER, allowNull: true },
        unhealthy_targets_count: { type: Sequelize.INTEGER, allowNull: true },
        state: { type: Sequelize.TEXT, allowNull: true },
        tags_json: { type: Sequelize.JSONB, allowNull: true },
        metadata_json: { type: Sequelize.JSONB, allowNull: true },
        discovered_at: { type: Sequelize.DATE, allowNull: false },
        is_current: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: literal("NOW()") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: literal("NOW()") },
      });
    }

    await addIndexIfMissing(
      queryInterface,
      "ec2_target_group_inventory_snapshots",
      ["resource_key"],
      "idx_ec2_target_group_inventory_resource_key",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_target_group_inventory_snapshots",
      ["region_key"],
      "idx_ec2_target_group_inventory_region",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_target_group_inventory_snapshots",
      ["cloud_connection_id"],
      "idx_ec2_target_group_inventory_connection",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_target_group_inventory_snapshots",
      ["is_current"],
      "idx_ec2_target_group_inventory_is_current",
    );
    await addIndexIfMissing(
      queryInterface,
      "ec2_target_group_inventory_snapshots",
      ["target_group_arn"],
      "idx_ec2_target_group_inventory_target_group_arn",
    );
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    if (await hasTable(queryInterface, "ec2_target_group_inventory_snapshots")) {
      await queryInterface.dropTable("ec2_target_group_inventory_snapshots");
    }
    if (await hasTable(queryInterface, "ec2_load_balancer_inventory_snapshots")) {
      await queryInterface.dropTable("ec2_load_balancer_inventory_snapshots");
    }
    if (await hasTable(queryInterface, "ec2_ami_inventory_snapshots")) {
      await queryInterface.dropTable("ec2_ami_inventory_snapshots");
    }
    if (await hasTable(queryInterface, "ec2_eip_inventory_snapshots")) {
      await queryInterface.dropTable("ec2_eip_inventory_snapshots");
    }
    if (await hasTable(queryInterface, "ec2_snapshot_inventory_snapshots")) {
      await queryInterface.dropTable("ec2_snapshot_inventory_snapshots");
    }
    if (await hasTable(queryInterface, "ec2_volume_inventory_snapshots")) {
      await queryInterface.dropTable("ec2_volume_inventory_snapshots");
    }
  },
};

export default migration;
