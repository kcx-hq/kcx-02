import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class Ec2VolumeInventorySnapshot extends Model<
  InferAttributes<Ec2VolumeInventorySnapshot>,
  InferCreationAttributes<Ec2VolumeInventorySnapshot>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare providerId: CreationOptional<number | null>;
  declare volumeId: string;
  declare resourceKey: CreationOptional<number | null>;
  declare regionKey: CreationOptional<number | null>;
  declare subAccountKey: CreationOptional<number | null>;
  declare volumeType: CreationOptional<string | null>;
  declare sizeGb: CreationOptional<number | null>;
  declare iops: CreationOptional<number | null>;
  declare throughput: CreationOptional<number | null>;
  declare availabilityZone: CreationOptional<string | null>;
  declare state: CreationOptional<string | null>;
  declare attachedInstanceId: CreationOptional<string | null>;
  declare isAttached: CreationOptional<boolean | null>;
  declare tagsJson: CreationOptional<Record<string, unknown> | null>;
  declare metadataJson: CreationOptional<Record<string, unknown> | null>;
  declare discoveredAt: Date;
  declare isCurrent: CreationOptional<boolean>;
  declare deletedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createEc2VolumeInventorySnapshotModel = (sequelize: Sequelize): typeof Ec2VolumeInventorySnapshot => {
  Ec2VolumeInventorySnapshot.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      volumeId: { type: DataTypes.TEXT, allowNull: false, field: "volume_id" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      volumeType: { type: DataTypes.TEXT, allowNull: true, field: "volume_type" },
      sizeGb: { type: DataTypes.INTEGER, allowNull: true, field: "size_gb" },
      iops: { type: DataTypes.INTEGER, allowNull: true },
      throughput: { type: DataTypes.INTEGER, allowNull: true },
      availabilityZone: { type: DataTypes.TEXT, allowNull: true, field: "availability_zone" },
      state: { type: DataTypes.TEXT, allowNull: true },
      attachedInstanceId: { type: DataTypes.TEXT, allowNull: true, field: "attached_instance_id" },
      isAttached: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_attached" },
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
      modelName: "Ec2VolumeInventorySnapshot",
      tableName: "ec2_volume_inventory_snapshots",
      timestamps: false,
    },
  );

  return Ec2VolumeInventorySnapshot;
};

export { Ec2VolumeInventorySnapshot };
export default createEc2VolumeInventorySnapshotModel;
