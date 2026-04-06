import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class ManualCloudConnection extends Model<
  InferAttributes<ManualCloudConnection>,
  InferCreationAttributes<ManualCloudConnection>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare createdBy: CreationOptional<string | null>;
  declare connectionName: string;
  declare awsAccountId: string;
  declare roleArn: string;
  declare externalId: string;
  declare bucketName: string;
  declare prefix: CreationOptional<string | null>;
  declare reportName: CreationOptional<string | null>;
  declare lastValidatedAt: CreationOptional<Date | null>;
  declare validationStatus: CreationOptional<string>;
  declare assumeRoleSuccess: CreationOptional<boolean>;
  declare errorMessage: CreationOptional<string | null>;
  declare status: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createManualCloudConnectionModel = (sequelize: Sequelize): typeof ManualCloudConnection => {
  ManualCloudConnection.init(
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
      connectionName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: "connection_name",
      },
      awsAccountId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: "aws_account_id",
      },
      roleArn: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: "role_arn",
      },
      externalId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "external_id",
      },
      bucketName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "bucket_name",
      },
      prefix: {
        type: DataTypes.STRING(1000),
        allowNull: true,
      },
      reportName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "report_name",
      },
      lastValidatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "last_validated_at",
      },
      validationStatus: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "pending",
        field: "validation_status",
      },
      assumeRoleSuccess: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "assume_role_success",
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "error_message",
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "draft",
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
      modelName: "ManualCloudConnection",
      tableName: "manual_cloud_connections",
      timestamps: false,
      indexes: [
        {
          name: "idx_manual_cloud_connections_tenant_id",
          fields: ["tenant_id"],
        },
        {
          name: "idx_manual_cloud_connections_tenant_connection_name",
          fields: ["tenant_id", "connection_name"],
        },
      ],
    },
  );

  return ManualCloudConnection;
};

export { ManualCloudConnection };
export default createManualCloudConnectionModel;
