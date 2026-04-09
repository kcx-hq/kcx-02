import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class CloudtrailSource extends Model<InferAttributes<CloudtrailSource>, InferCreationAttributes<CloudtrailSource>> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare cloudConnectionId: string;
  declare trailName: string;
  declare bucketName: string;
  declare bucketRegion: CreationOptional<string | null>;
  declare prefix: CreationOptional<string | null>;
  declare isMultiRegion: CreationOptional<boolean>;
  declare includeGlobalServiceEvents: CreationOptional<boolean>;
  declare managementEventsEnabled: CreationOptional<boolean>;
  declare status: CreationOptional<string>;
  declare lastValidatedAt: CreationOptional<Date | null>;
  declare lastIngestedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createCloudtrailSourceModel = (sequelize: Sequelize): typeof CloudtrailSource => {
  CloudtrailSource.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: false, field: "cloud_connection_id" },
      trailName: { type: DataTypes.STRING(255), allowNull: false, field: "trail_name" },
      bucketName: { type: DataTypes.STRING(255), allowNull: false, field: "bucket_name" },
      bucketRegion: { type: DataTypes.STRING(50), allowNull: true, field: "bucket_region" },
      prefix: { type: DataTypes.STRING(1000), allowNull: true },
      isMultiRegion: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_multi_region" },
      includeGlobalServiceEvents: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "include_global_service_events",
      },
      managementEventsEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "management_events_enabled",
      },
      status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "draft" },
      lastValidatedAt: { type: DataTypes.DATE, allowNull: true, field: "last_validated_at" },
      lastIngestedAt: { type: DataTypes.DATE, allowNull: true, field: "last_ingested_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "CloudtrailSource",
      tableName: "cloudtrail_sources",
      timestamps: false,
    },
  );

  return CloudtrailSource;
};

export { CloudtrailSource };
export default createCloudtrailSourceModel;
