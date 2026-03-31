import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class DimBillingAccount extends Model<InferAttributes<DimBillingAccount>, InferCreationAttributes<DimBillingAccount>> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare providerId: string;
  declare billingAccountId: string;
  declare billingAccountName: CreationOptional<string | null>;
  declare billingCurrency: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createDimBillingAccountModel = (sequelize: Sequelize): typeof DimBillingAccount => {
  DimBillingAccount.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: false, field: "provider_id" },
      billingAccountId: { type: DataTypes.STRING(100), allowNull: false, field: "billing_account_id" },
      billingAccountName: { type: DataTypes.STRING(255), allowNull: true, field: "billing_account_name" },
      billingCurrency: { type: DataTypes.STRING(20), allowNull: true, field: "billing_currency" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "DimBillingAccount",
      tableName: "dim_billing_account",
      timestamps: false,
    },
  );
  return DimBillingAccount;
};

export { DimBillingAccount };
export default createDimBillingAccountModel;

