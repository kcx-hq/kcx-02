import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class Ec2SnapshotInventorySnapshot extends Model<
  InferAttributes<Ec2SnapshotInventorySnapshot>,
  InferCreationAttributes<Ec2SnapshotInventorySnapshot>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare providerId: CreationOptional<number | null>;
  declare snapshotId: string;
  declare resourceKey: CreationOptional<number | null>;
  declare regionKey: CreationOptional<number | null>;
  declare subAccountKey: CreationOptional<number | null>;
  declare sourceVolumeId: CreationOptional<string | null>;
  declare sourceInstanceId: CreationOptional<string | null>;
  declare sizeGb: CreationOptional<number | null>;
  declare startTime: CreationOptional<Date | null>;
  declare state: CreationOptional<string | null>;
  declare tagsJson: CreationOptional<Record<string, unknown> | null>;
  declare metadataJson: CreationOptional<Record<string, unknown> | null>;
  declare discoveredAt: Date;
  declare isCurrent: CreationOptional<boolean>;
  declare deletedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createEc2SnapshotInventorySnapshotModel = (sequelize: Sequelize): typeof Ec2SnapshotInventorySnapshot => {
  Ec2SnapshotInventorySnapshot.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      snapshotId: { type: DataTypes.TEXT, allowNull: false, field: "snapshot_id" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      sourceVolumeId: { type: DataTypes.TEXT, allowNull: true, field: "source_volume_id" },
      sourceInstanceId: { type: DataTypes.TEXT, allowNull: true, field: "source_instance_id" },
      sizeGb: { type: DataTypes.INTEGER, allowNull: true, field: "size_gb" },
      startTime: { type: DataTypes.DATE, allowNull: true, field: "start_time" },
      state: { type: DataTypes.TEXT, allowNull: true },
      tagsJson: { type: DataTypes.JSONB, allowNull: true, field: "tags_json" },
      metadataJson: { type: DataTypes.JSONB, allowNull: true, field: "metadata_json" },
      discoveredAt: { type: DataTypes.DATE, allowNull: false, field: "discovered_at" },
      isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_current" },
      deletedAt: { type: DataTypes.DATE, allowNull: true, field: "deleted_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "Ec2SnapshotInventorySnapshot",
      tableName: "ec2_snapshot_inventory_snapshots",
      timestamps: false,
    },
  );

  return Ec2SnapshotInventorySnapshot;
};

export { Ec2SnapshotInventorySnapshot };
export default createEc2SnapshotInventorySnapshotModel;
