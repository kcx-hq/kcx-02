import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class ResourceInventorySnapshot extends Model<
  InferAttributes<ResourceInventorySnapshot>,
  InferCreationAttributes<ResourceInventorySnapshot>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: string;
  declare providerId: string;
  declare resourceId: string;
  declare resourceName: CreationOptional<string | null>;
  declare resourceType: CreationOptional<string | null>;
  declare regionId: CreationOptional<string | null>;
  declare accountId: CreationOptional<string | null>;
  declare state: CreationOptional<string | null>;
  declare metadataJson: CreationOptional<Record<string, unknown> | null>;
  declare discoveredAt: Date;
  declare createdAt: CreationOptional<Date>;
}

const createResourceInventorySnapshotModel = (sequelize: Sequelize): typeof ResourceInventorySnapshot => {
  ResourceInventorySnapshot.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: false, field: "cloud_connection_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: false, field: "provider_id" },
      resourceId: { type: DataTypes.TEXT, allowNull: false, field: "resource_id" },
      resourceName: { type: DataTypes.TEXT, allowNull: true, field: "resource_name" },
      resourceType: { type: DataTypes.TEXT, allowNull: true, field: "resource_type" },
      regionId: { type: DataTypes.TEXT, allowNull: true, field: "region_id" },
      accountId: { type: DataTypes.TEXT, allowNull: true, field: "account_id" },
      state: { type: DataTypes.TEXT, allowNull: true },
      metadataJson: { type: DataTypes.JSONB, allowNull: true, field: "metadata_json" },
      discoveredAt: { type: DataTypes.DATE, allowNull: false, field: "discovered_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "ResourceInventorySnapshot",
      tableName: "resource_inventory_snapshots",
      timestamps: false,
    },
  );
  return ResourceInventorySnapshot;
};

export { ResourceInventorySnapshot };
export default createResourceInventorySnapshotModel;
