import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class DimSubAccount extends Model<InferAttributes<DimSubAccount>, InferCreationAttributes<DimSubAccount>> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare providerId: string;
  declare subAccountId: string;
  declare subAccountName: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createDimSubAccountModel = (sequelize: Sequelize): typeof DimSubAccount => {
  DimSubAccount.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: false, field: "provider_id" },
      subAccountId: { type: DataTypes.STRING(100), allowNull: false, field: "sub_account_id" },
      subAccountName: { type: DataTypes.STRING(255), allowNull: true, field: "sub_account_name" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "DimSubAccount",
      tableName: "dim_sub_account",
      timestamps: false,
      indexes: [
        { name: "uq_dim_sub_account_tenant_provider_sub_account_id", unique: true, fields: ["tenant_id", "provider_id", "sub_account_id"] },
        { name: "idx_dim_sub_account_tenant_provider", fields: ["tenant_id", "provider_id"] },
      ],
    },
  );
  return DimSubAccount;
};

export { DimSubAccount };
export default createDimSubAccountModel;

