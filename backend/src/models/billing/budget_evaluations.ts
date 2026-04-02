import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class BudgetEvaluations extends Model<InferAttributes<BudgetEvaluations>, InferCreationAttributes<BudgetEvaluations>> {
  declare id: CreationOptional<string>;
  declare budgetId: string;
  declare currentSpend: CreationOptional<string | null>;
  declare forecastSpend: CreationOptional<string | null>;
  declare thresholdPercent: CreationOptional<string | null>;
  declare evaluatedAt: CreationOptional<Date>;
  declare status: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createBudgetEvaluationsModel = (sequelize: Sequelize): typeof BudgetEvaluations => {
  BudgetEvaluations.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      budgetId: { type: DataTypes.UUID, allowNull: false, field: "budget_id" },
      currentSpend: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "current_spend" },
      forecastSpend: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "forecast_spend" },
      thresholdPercent: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: "threshold_percent" },
      evaluatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "evaluated_at" },
      status: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "BudgetEvaluations",
      tableName: "budget_evaluations",
      timestamps: false,
    },
  );
  return BudgetEvaluations;
};

export { BudgetEvaluations };
export default createBudgetEvaluationsModel;

