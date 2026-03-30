import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export type CloudAccountType = "payer" | "member";
export type CloudConnectionStatus =
  | "draft"
  | "connecting"
  | "awaiting_validation"
  | "active"
  | "active_with_warnings"
  | "failed"
  | "suspended";

class CloudConnectionV2 extends Model<
  InferAttributes<CloudConnectionV2, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<CloudConnectionV2, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare providerId: string;
  declare connectionName: string;
  declare accountType: CloudAccountType | string;
  declare status: CloudConnectionStatus | string;
  declare region: CreationOptional<string | null>;
  declare externalId: CreationOptional<string | null>;
  declare callbackToken: CreationOptional<string | null>;
  declare stackName: CreationOptional<string | null>;
  declare stackId: CreationOptional<string | null>;
  declare cloudAccountId: CreationOptional<string | null>;
  declare payerAccountId: CreationOptional<string | null>;
  declare roleArn: CreationOptional<string | null>;
  declare createdBy: CreationOptional<string | null>;
  declare connectedAt: CreationOptional<Date | null>;
  declare lastValidatedAt: CreationOptional<Date | null>;
  declare errorMessage: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createCloudConnectionV2Model = (sequelize: Sequelize): typeof CloudConnectionV2 => {
  CloudConnectionV2.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      providerId: { type: DataTypes.UUID, allowNull: false, field: "provider_id" },
      connectionName: { type: DataTypes.STRING(150), allowNull: false, field: "connection_name" },
      accountType: {
        type: DataTypes.ENUM("payer", "member"),
        allowNull: false,
        defaultValue: "payer",
        field: "account_type",
      },
      status: {
        type: DataTypes.ENUM(
          "draft",
          "connecting",
          "awaiting_validation",
          "active",
          "active_with_warnings",
          "failed",
          "suspended",
        ),
        allowNull: false,
        defaultValue: "draft",
      },
      region: { type: DataTypes.STRING(50), allowNull: true, defaultValue: "us-east-1" },
      externalId: { type: DataTypes.STRING(255), allowNull: true, field: "external_id" },
      callbackToken: { type: DataTypes.STRING(255), allowNull: true, field: "callback_token" },
      stackName: { type: DataTypes.STRING(255), allowNull: true, field: "stack_name" },
      stackId: { type: DataTypes.TEXT, allowNull: true, field: "stack_id" },
      cloudAccountId: { type: DataTypes.STRING(50), allowNull: true, field: "cloud_account_id" },
      payerAccountId: { type: DataTypes.STRING(50), allowNull: true, field: "payer_account_id" },
      roleArn: { type: DataTypes.TEXT, allowNull: true, field: "role_arn" },
      createdBy: { type: DataTypes.UUID, allowNull: true, field: "created_by" },
      connectedAt: { type: DataTypes.DATE, allowNull: true, field: "connected_at" },
      lastValidatedAt: { type: DataTypes.DATE, allowNull: true, field: "last_validated_at" },
      errorMessage: { type: DataTypes.TEXT, allowNull: true, field: "error_message" },
    },
    {
      sequelize,
      modelName: "CloudConnectionV2",
      tableName: "cloud_connections",
      timestamps: true,
      underscored: true,
    },
  );
  return CloudConnectionV2;
};

export { CloudConnectionV2 };
export default createCloudConnectionV2Model;

