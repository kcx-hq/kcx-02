import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class Budgets extends Model<InferAttributes<Budgets>, InferCreationAttributes<Budgets>> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare name: string;
  declare budgetAmount: string;
  declare currency: CreationOptional<string | null>;
  declare period: string;
  declare startDate: string;
  declare endDate: CreationOptional<string | null>;
  declare scopeType: CreationOptional<string | null>;
  declare scopeFilter: CreationOptional<Record<string, unknown> | null>;
  declare createdBy: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createBudgetsModel = (sequelize: Sequelize): typeof Budgets => {
  Budgets.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      name: { type: DataTypes.TEXT, allowNull: false },
      budgetAmount: { type: DataTypes.DECIMAL(18, 6), allowNull: false, field: "budget_amount" },
      currency: { type: DataTypes.TEXT, allowNull: true, defaultValue: "USD" },
      period: { type: DataTypes.TEXT, allowNull: false },
      startDate: { type: DataTypes.DATEONLY, allowNull: false, field: "start_date" },
      endDate: { type: DataTypes.DATEONLY, allowNull: true, field: "end_date" },
      scopeType: { type: DataTypes.TEXT, allowNull: true, field: "scope_type" },
      scopeFilter: { type: DataTypes.JSONB, allowNull: true, field: "scope_filter" },
      createdBy: { type: DataTypes.UUID, allowNull: true, field: "created_by" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "Budgets",
      tableName: "budgets",
      timestamps: false,
    },
  );
  return Budgets;
};

export { Budgets };
export default createBudgetsModel;

