import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class S3StorageLensDaily extends Model<
  InferAttributes<S3StorageLensDaily>,
  InferCreationAttributes<S3StorageLensDaily>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<number | null>;
  declare providerId: CreationOptional<number | null>;
  declare regionKey: CreationOptional<number | null>;
  declare subAccountKey: CreationOptional<number | null>;
  declare usageDate: string;
  declare bucketName: string;
  declare objectCount: CreationOptional<string | null>;
  declare currentVersionBytes: CreationOptional<string | null>;
  declare avgObjectSizeBytes: CreationOptional<string | null>;
  declare bytesStandard: CreationOptional<string | null>;
  declare bytesStandardIa: CreationOptional<string | null>;
  declare bytesOnezoneIa: CreationOptional<string | null>;
  declare bytesIntelligentTiering: CreationOptional<string | null>;
  declare bytesGlacier: CreationOptional<string | null>;
  declare bytesDeepArchive: CreationOptional<string | null>;
  declare accessCount: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createS3StorageLensDailyModel = (sequelize: Sequelize): typeof S3StorageLensDaily => {
  S3StorageLensDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      bucketName: { type: DataTypes.TEXT, allowNull: false, field: "bucket_name" },
      objectCount: { type: DataTypes.DECIMAL(30, 0), allowNull: true, field: "object_count" },
      currentVersionBytes: { type: DataTypes.DECIMAL(30, 0), allowNull: true, field: "current_version_bytes" },
      avgObjectSizeBytes: { type: DataTypes.DECIMAL(30, 6), allowNull: true, field: "avg_object_size_bytes" },
      bytesStandard: { type: DataTypes.DECIMAL(30, 0), allowNull: true, field: "bytes_standard" },
      bytesStandardIa: { type: DataTypes.DECIMAL(30, 0), allowNull: true, field: "bytes_standard_ia" },
      bytesOnezoneIa: { type: DataTypes.DECIMAL(30, 0), allowNull: true, field: "bytes_onezone_ia" },
      bytesIntelligentTiering: { type: DataTypes.DECIMAL(30, 0), allowNull: true, field: "bytes_intelligent_tiering" },
      bytesGlacier: { type: DataTypes.DECIMAL(30, 0), allowNull: true, field: "bytes_glacier" },
      bytesDeepArchive: { type: DataTypes.DECIMAL(30, 0), allowNull: true, field: "bytes_deep_archive" },
      accessCount: { type: DataTypes.DECIMAL(30, 0), allowNull: true, field: "access_count" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "S3StorageLensDaily",
      tableName: "s3_storage_lens_daily",
      timestamps: false,
    },
  );
  return S3StorageLensDaily;
};

export { S3StorageLensDaily };
export default createS3StorageLensDailyModel;
