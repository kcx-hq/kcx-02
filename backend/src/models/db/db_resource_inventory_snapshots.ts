import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class DbResourceInventorySnapshot extends Model<
  InferAttributes<DbResourceInventorySnapshot>,
  InferCreationAttributes<DbResourceInventorySnapshot>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare resourceId: string;
  declare resourceArn: CreationOptional<string | null>;
  declare resourceName: CreationOptional<string | null>;
  declare dbService: string;
  declare dbEngine: CreationOptional<string | null>;
  declare dbEngineVersion: CreationOptional<string | null>;
  declare resourceType: CreationOptional<string | null>;
  declare resourceKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare status: CreationOptional<string | null>;
  declare allocatedStorageGb: CreationOptional<string | null>;
  declare dataFootprintGb: CreationOptional<string | null>;
  declare instanceClass: CreationOptional<string | null>;
  declare capacityMode: CreationOptional<string | null>;
  declare clusterId: CreationOptional<string | null>;
  declare isClusterResource: CreationOptional<boolean>;
  declare tagsJson: CreationOptional<Record<string, unknown> | null>;
  declare metadataJson: CreationOptional<Record<string, unknown> | null>;
  declare discoveredAt: Date;
  declare isCurrent: CreationOptional<boolean>;
  declare deletedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createDbResourceInventorySnapshotModel = (sequelize: Sequelize): typeof DbResourceInventorySnapshot => {
  DbResourceInventorySnapshot.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      resourceId: { type: DataTypes.TEXT, allowNull: false, field: "resource_id" },
      resourceArn: { type: DataTypes.TEXT, allowNull: true, field: "resource_arn" },
      resourceName: { type: DataTypes.TEXT, allowNull: true, field: "resource_name" },
      dbService: { type: DataTypes.TEXT, allowNull: false, field: "db_service" },
      dbEngine: { type: DataTypes.TEXT, allowNull: true, field: "db_engine" },
      dbEngineVersion: { type: DataTypes.TEXT, allowNull: true, field: "db_engine_version" },
      resourceType: { type: DataTypes.TEXT, allowNull: true, field: "resource_type" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      status: { type: DataTypes.TEXT, allowNull: true },
      allocatedStorageGb: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "allocated_storage_gb" },
      dataFootprintGb: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "data_footprint_gb" },
      instanceClass: { type: DataTypes.TEXT, allowNull: true, field: "instance_class" },
      capacityMode: { type: DataTypes.TEXT, allowNull: true, field: "capacity_mode" },
      clusterId: { type: DataTypes.TEXT, allowNull: true, field: "cluster_id" },
      isClusterResource: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_cluster_resource",
      },
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
      modelName: "DbResourceInventorySnapshot",
      tableName: "db_resource_inventory_snapshots",
      timestamps: false,
    },
  );

  return DbResourceInventorySnapshot;
};

export { DbResourceInventorySnapshot };
export default createDbResourceInventorySnapshotModel;
