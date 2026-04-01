import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class RawBillingFile extends Model<InferAttributes<RawBillingFile>, InferCreationAttributes<RawBillingFile>> {
  declare id: CreationOptional<string>;
  declare billingSourceId: CreationOptional<string | null>;
  declare tenantId: string;
  // migrated from provider string -> cloud_provider_id
  declare cloudProviderId: string;
  declare sourceType: string;
  declare setupMode: string;
  declare originalFileName: string;
  declare originalFilePath: CreationOptional<string | null>;
  declare rawStorageBucket: string;
  declare rawStorageKey: string;
  declare fileFormat: string;
  declare fileSizeBytes: CreationOptional<string | null>;
  declare checksum: CreationOptional<string | null>;
  declare status: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
}

const createRawBillingFileModel = (sequelize: Sequelize): typeof RawBillingFile => {
  RawBillingFile.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      billingSourceId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: "billing_source_id",
      },
      tenantId: { type: DataTypes.STRING(100), allowNull: false, field: "tenant_id" },
      cloudProviderId: { type: DataTypes.BIGINT, allowNull: false, field: "cloud_provider_id" },
      sourceType: { type: DataTypes.STRING(50), allowNull: false, field: "source_type" },
      setupMode: { type: DataTypes.STRING(50), allowNull: false, field: "setup_mode" },
      originalFileName: { type: DataTypes.STRING(255), allowNull: false, field: "original_file_name" },
      originalFilePath: { type: DataTypes.STRING(1000), allowNull: true, field: "original_file_path" },
      rawStorageBucket: { type: DataTypes.STRING(255), allowNull: false, field: "raw_storage_bucket" },
      rawStorageKey: { type: DataTypes.STRING(1000), allowNull: false, field: "raw_storage_key" },
      fileFormat: { type: DataTypes.STRING(20), allowNull: false, field: "file_format" },
      fileSizeBytes: { type: DataTypes.BIGINT, allowNull: true, field: "file_size_bytes" },
      checksum: { type: DataTypes.STRING(255), allowNull: true },
      status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "stored" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "RawBillingFile",
      tableName: "raw_billing_files",
      timestamps: false,
    },
  );
  return RawBillingFile;
};

export { RawBillingFile };
export default createRawBillingFileModel;
