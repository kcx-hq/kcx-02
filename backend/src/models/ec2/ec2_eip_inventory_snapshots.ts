import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class Ec2EipInventorySnapshot extends Model<
  InferAttributes<Ec2EipInventorySnapshot>,
  InferCreationAttributes<Ec2EipInventorySnapshot>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare providerId: CreationOptional<number | null>;
  declare allocationId: string;
  declare publicIp: CreationOptional<string | null>;
  declare resourceKey: CreationOptional<number | null>;
  declare regionKey: CreationOptional<number | null>;
  declare subAccountKey: CreationOptional<number | null>;
  declare associatedInstanceId: CreationOptional<string | null>;
  declare associatedResourceId: CreationOptional<string | null>;
  declare associationStatus: CreationOptional<string | null>;
  declare isAttached: CreationOptional<boolean | null>;
  declare allocatedAt: CreationOptional<Date | null>;
  declare tagsJson: CreationOptional<Record<string, unknown> | null>;
  declare metadataJson: CreationOptional<Record<string, unknown> | null>;
  declare discoveredAt: Date;
  declare isCurrent: CreationOptional<boolean>;
  declare deletedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createEc2EipInventorySnapshotModel = (sequelize: Sequelize): typeof Ec2EipInventorySnapshot => {
  Ec2EipInventorySnapshot.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      allocationId: { type: DataTypes.TEXT, allowNull: false, field: "allocation_id" },
      publicIp: { type: DataTypes.TEXT, allowNull: true, field: "public_ip" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      associatedInstanceId: { type: DataTypes.TEXT, allowNull: true, field: "associated_instance_id" },
      associatedResourceId: { type: DataTypes.TEXT, allowNull: true, field: "associated_resource_id" },
      associationStatus: { type: DataTypes.TEXT, allowNull: true, field: "association_status" },
      isAttached: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_attached" },
      allocatedAt: { type: DataTypes.DATE, allowNull: true, field: "allocated_at" },
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
      modelName: "Ec2EipInventorySnapshot",
      tableName: "ec2_eip_inventory_snapshots",
      timestamps: false,
    },
  );

  return Ec2EipInventorySnapshot;
};

export { Ec2EipInventorySnapshot };
export default createEc2EipInventorySnapshotModel;
