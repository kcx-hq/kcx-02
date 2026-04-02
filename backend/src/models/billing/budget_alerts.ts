import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class BudgetAlerts extends Model<InferAttributes<BudgetAlerts>, InferCreationAttributes<BudgetAlerts>> {
  declare id: CreationOptional<string>;
  declare budgetId: string;
  declare thresholdPercent: CreationOptional<string | null>;
  declare alertType: CreationOptional<string | null>;
  declare notificationType: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createBudgetAlertsModel = (sequelize: Sequelize): typeof BudgetAlerts => {
  BudgetAlerts.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      budgetId: { type: DataTypes.UUID, allowNull: false, field: "budget_id" },
      thresholdPercent: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: "threshold_percent" },
      alertType: { type: DataTypes.TEXT, allowNull: true, field: "alert_type" },
      notificationType: { type: DataTypes.TEXT, allowNull: true, field: "notification_type" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "BudgetAlerts",
      tableName: "budget_alerts",
      timestamps: false,
    },
  );
  return BudgetAlerts;
};

export { BudgetAlerts };
export default createBudgetAlertsModel;

