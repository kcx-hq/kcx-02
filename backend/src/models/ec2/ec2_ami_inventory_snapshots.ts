import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class Ec2AmiInventorySnapshot extends Model<
  InferAttributes<Ec2AmiInventorySnapshot>,
  InferCreationAttributes<Ec2AmiInventorySnapshot>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare providerId: CreationOptional<number | null>;
  declare imageId: string;
  declare resourceKey: CreationOptional<number | null>;
  declare regionKey: CreationOptional<number | null>;
  declare subAccountKey: CreationOptional<number | null>;
  declare imageName: CreationOptional<string | null>;
  declare sourceInstanceId: CreationOptional<string | null>;
  declare backingSnapshotCount: CreationOptional<number | null>;
  declare totalSnapshotSizeGb: CreationOptional<number | null>;
  declare creationDate: CreationOptional<Date | null>;
  declare state: CreationOptional<string | null>;
  declare isInUse: CreationOptional<boolean | null>;
  declare tagsJson: CreationOptional<Record<string, unknown> | null>;
  declare metadataJson: CreationOptional<Record<string, unknown> | null>;
  declare discoveredAt: Date;
  declare isCurrent: CreationOptional<boolean>;
  declare deletedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createEc2AmiInventorySnapshotModel = (sequelize: Sequelize): typeof Ec2AmiInventorySnapshot => {
  Ec2AmiInventorySnapshot.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      imageId: { type: DataTypes.TEXT, allowNull: false, field: "image_id" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      imageName: { type: DataTypes.TEXT, allowNull: true, field: "image_name" },
      sourceInstanceId: { type: DataTypes.TEXT, allowNull: true, field: "source_instance_id" },
      backingSnapshotCount: { type: DataTypes.INTEGER, allowNull: true, field: "backing_snapshot_count" },
      totalSnapshotSizeGb: { type: DataTypes.INTEGER, allowNull: true, field: "total_snapshot_size_gb" },
      creationDate: { type: DataTypes.DATE, allowNull: true, field: "creation_date" },
      state: { type: DataTypes.TEXT, allowNull: true },
      isInUse: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_in_use" },
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
      modelName: "Ec2AmiInventorySnapshot",
      tableName: "ec2_ami_inventory_snapshots",
      timestamps: false,
    },
  );

  return Ec2AmiInventorySnapshot;
};

export { Ec2AmiInventorySnapshot };
export default createEc2AmiInventorySnapshotModel;
