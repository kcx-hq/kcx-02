import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class StorageLensRawFile extends Model<
  InferAttributes<StorageLensRawFile>,
  InferCreationAttributes<StorageLensRawFile>
> {
  declare id: CreationOptional<string>;
  declare billingSourceId: string;
  declare ingestionRunId: CreationOptional<string | null>;
  declare tenantId: string;
  declare cloudProviderId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare storageBucket: string;
  declare storageKey: string;
  declare fileFormat: string;
  declare fileSizeBytes: CreationOptional<string | null>;
  declare etag: CreationOptional<string | null>;
  declare lastModifiedAt: CreationOptional<Date | null>;
  declare status: CreationOptional<string>;
  declare processedAt: CreationOptional<Date | null>;
  declare errorMessage: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createStorageLensRawFileModel = (sequelize: Sequelize): typeof StorageLensRawFile => {
  StorageLensRawFile.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: false, field: "billing_source_id" },
      ingestionRunId: { type: DataTypes.BIGINT, allowNull: true, field: "ingestion_run_id" },
      tenantId: { type: DataTypes.STRING(100), allowNull: false, field: "tenant_id" },
      cloudProviderId: { type: DataTypes.BIGINT, allowNull: false, field: "cloud_provider_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      storageBucket: { type: DataTypes.STRING(255), allowNull: false, field: "storage_bucket" },
      storageKey: { type: DataTypes.STRING(1000), allowNull: false, field: "storage_key" },
      fileFormat: { type: DataTypes.STRING(20), allowNull: false, field: "file_format" },
      fileSizeBytes: { type: DataTypes.BIGINT, allowNull: true, field: "file_size_bytes" },
      etag: { type: DataTypes.STRING(255), allowNull: true },
      lastModifiedAt: { type: DataTypes.DATE, allowNull: true, field: "last_modified_at" },
      status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "discovered" },
      processedAt: { type: DataTypes.DATE, allowNull: true, field: "processed_at" },
      errorMessage: { type: DataTypes.TEXT, allowNull: true, field: "error_message" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "StorageLensRawFile",
      tableName: "storage_lens_raw_files",
      timestamps: false,
    },
  );
  return StorageLensRawFile;
};

export { StorageLensRawFile };
export default createStorageLensRawFileModel;

