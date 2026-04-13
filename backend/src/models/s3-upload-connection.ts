import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class S3UploadConnection extends Model<
  InferAttributes<S3UploadConnection>,
  InferCreationAttributes<S3UploadConnection>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare createdBy: CreationOptional<string | null>;
  declare roleArn: string;
  declare externalId: CreationOptional<string | null>;
  declare bucketName: string;
  declare basePrefix: CreationOptional<string | null>;
  declare awsAccountId: CreationOptional<string | null>;
  declare assumedArn: CreationOptional<string | null>;
  declare resolvedRegion: CreationOptional<string | null>;
  declare lastValidatedAt: CreationOptional<Date>;
  declare status: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createS3UploadConnectionModel = (sequelize: Sequelize): typeof S3UploadConnection => {
  S3UploadConnection.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "tenant_id",
      },
      createdBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: "created_by",
      },
      roleArn: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: "role_arn",
      },
      externalId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "external_id",
      },
      bucketName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "bucket_name",
      },
      basePrefix: {
        type: DataTypes.STRING(1000),
        allowNull: true,
        field: "base_prefix",
      },
      awsAccountId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "aws_account_id",
      },
      assumedArn: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "assumed_arn",
      },
      resolvedRegion: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "resolved_region",
      },
      lastValidatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("NOW()"),
        field: "last_validated_at",
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "active",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("NOW()"),
        field: "created_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("NOW()"),
        field: "updated_at",
      },
    },
    {
      sequelize,
      modelName: "S3UploadConnection",
      tableName: "s3_upload_connections",
      timestamps: false,
      indexes: [
        {
          name: "idx_s3_upload_connections_tenant_id",
          fields: ["tenant_id"],
        },
        {
          name: "idx_s3_upload_connections_status",
          fields: ["status"],
        },
      ],
    },
  );

  return S3UploadConnection;
};

export { S3UploadConnection };
export default createS3UploadConnectionModel;
