import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export type CloudIntegrationMode = "manual" | "automatic";

export type CloudIntegrationStatus =
  | "draft"
  | "connecting"
  | "awaiting_validation"
  | "active"
  | "active_with_warnings"
  | "failed"
  | "suspended";

class CloudIntegration extends Model<
  InferAttributes<CloudIntegration, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<CloudIntegration, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare createdBy: CreationOptional<string | null>;
  declare providerId: string;
  declare connectionMode: CloudIntegrationMode | string;
  declare displayName: string;
  declare status: CloudIntegrationStatus | string;
  declare detailRecordId: string;
  declare detailRecordType: string;
  declare cloudAccountId: CreationOptional<string | null>;
  declare payerAccountId: CreationOptional<string | null>;
  declare lastValidatedAt: CreationOptional<Date | null>;
  declare lastSuccessAt: CreationOptional<Date | null>;
  declare lastCheckedAt: CreationOptional<Date | null>;
  declare statusMessage: CreationOptional<string | null>;
  declare errorMessage: CreationOptional<string | null>;
  declare connectedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createCloudIntegrationModel = (sequelize: Sequelize): typeof CloudIntegration => {
  CloudIntegration.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      createdBy: { type: DataTypes.UUID, allowNull: true, field: "created_by" },
      providerId: { type: DataTypes.BIGINT, allowNull: false, field: "provider_id" },
      connectionMode: {
        type: DataTypes.ENUM("manual", "automatic"),
        allowNull: false,
        field: "connection_mode",
      },
      displayName: { type: DataTypes.STRING(150), allowNull: false, field: "display_name" },
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
      detailRecordId: { type: DataTypes.UUID, allowNull: false, field: "detail_record_id" },
      detailRecordType: { type: DataTypes.STRING(50), allowNull: false, field: "detail_record_type" },
      cloudAccountId: { type: DataTypes.STRING(50), allowNull: true, field: "cloud_account_id" },
      payerAccountId: { type: DataTypes.STRING(50), allowNull: true, field: "payer_account_id" },
      lastValidatedAt: { type: DataTypes.DATE, allowNull: true, field: "last_validated_at" },
      lastSuccessAt: { type: DataTypes.DATE, allowNull: true, field: "last_success_at" },
      lastCheckedAt: { type: DataTypes.DATE, allowNull: true, field: "last_checked_at" },
      statusMessage: { type: DataTypes.TEXT, allowNull: true, field: "status_message" },
      errorMessage: { type: DataTypes.TEXT, allowNull: true, field: "error_message" },
      connectedAt: { type: DataTypes.DATE, allowNull: true, field: "connected_at" },
    },
    {
      sequelize,
      modelName: "CloudIntegration",
      tableName: "cloud_integrations",
      timestamps: true,
      underscored: true,
    },
  );

  return CloudIntegration;
};

export { CloudIntegration };
export default createCloudIntegrationModel;
