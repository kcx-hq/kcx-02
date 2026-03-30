import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class BillingSource extends Model<InferAttributes<BillingSource>, InferCreationAttributes<BillingSource>> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  // migrated from provider string -> cloud_provider_id
  declare cloudProviderId: string;
  declare sourceName: string;
  declare sourceType: string;
  declare setupMode: string;
  declare format: string;
  declare schemaType: string;
  declare bucketName: CreationOptional<string | null>;
  declare pathPrefix: CreationOptional<string | null>;
  declare filePattern: CreationOptional<string | null>;
  declare cadence: CreationOptional<string | null>;
  declare status: CreationOptional<string>;
  declare lastValidatedAt: CreationOptional<Date | null>;
  declare lastFileReceivedAt: CreationOptional<Date | null>;
  declare lastIngestedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createBillingSourceModel = (sequelize: Sequelize): typeof BillingSource => {
  BillingSource.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      tenantId: { type: DataTypes.STRING(100), allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      cloudProviderId: { type: DataTypes.UUID, allowNull: false, field: "cloud_provider_id" },
      sourceName: { type: DataTypes.STRING(255), allowNull: false, field: "source_name" },
      sourceType: { type: DataTypes.STRING(50), allowNull: false, field: "source_type" },
      setupMode: { type: DataTypes.STRING(50), allowNull: false, field: "setup_mode" },
      format: { type: DataTypes.STRING(20), allowNull: false },
      schemaType: { type: DataTypes.STRING(50), allowNull: false, field: "schema_type" },
      bucketName: { type: DataTypes.STRING(255), allowNull: true, field: "bucket_name" },
      pathPrefix: { type: DataTypes.STRING(1000), allowNull: true, field: "path_prefix" },
      filePattern: { type: DataTypes.STRING(255), allowNull: true, field: "file_pattern" },
      cadence: { type: DataTypes.STRING(50), allowNull: true },
      status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "draft" },
      lastValidatedAt: { type: DataTypes.DATE, allowNull: true, field: "last_validated_at" },
      lastFileReceivedAt: { type: DataTypes.DATE, allowNull: true, field: "last_file_received_at" },
      lastIngestedAt: { type: DataTypes.DATE, allowNull: true, field: "last_ingested_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "BillingSource",
      tableName: "billing_sources",
      timestamps: false,
    },
  );
  return BillingSource;
};

export { BillingSource };
export default createBillingSourceModel;
