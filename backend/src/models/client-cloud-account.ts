import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class ClientCloudAccount extends Model<
  InferAttributes<ClientCloudAccount>,
  InferCreationAttributes<ClientCloudAccount>
> {
  declare id: CreationOptional<string | number>;
  declare tenantId: string;
  declare providerId: string | number;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare accountId: string;
  declare accountName: CreationOptional<string | null>;
  declare onboardingStatus: CreationOptional<string>;
  declare computeOptimizerEnabled: CreationOptional<boolean>;
  declare lastRecommendationSyncAt: CreationOptional<Date | null>;
  declare lastSyncStatus: CreationOptional<string | null>;
  declare lastSyncMessage: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createClientCloudAccountModel = (sequelize: Sequelize): typeof ClientCloudAccount => {
  ClientCloudAccount.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: false, field: "provider_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      accountId: { type: DataTypes.STRING(50), allowNull: false, field: "account_id" },
      accountName: { type: DataTypes.STRING(255), allowNull: true, field: "account_name" },
      onboardingStatus: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "connected", field: "onboarding_status" },
      computeOptimizerEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "compute_optimizer_enabled" },
      lastRecommendationSyncAt: { type: DataTypes.DATE, allowNull: true, field: "last_recommendation_sync_at" },
      lastSyncStatus: { type: DataTypes.STRING(30), allowNull: true, field: "last_sync_status" },
      lastSyncMessage: { type: DataTypes.TEXT, allowNull: true, field: "last_sync_message" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "ClientCloudAccount",
      tableName: "client_cloud_accounts",
      timestamps: false,
      indexes: [
        { name: "uq_client_cloud_accounts_tenant_provider_account", unique: true, fields: ["tenant_id", "provider_id", "account_id"] },
        { name: "idx_client_cloud_accounts_tenant", fields: ["tenant_id"] },
        { name: "idx_client_cloud_accounts_connection", fields: ["cloud_connection_id"] },
      ],
    },
  );
  return ClientCloudAccount;
};

export { ClientCloudAccount };
export default createClientCloudAccountModel;

