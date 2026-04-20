import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class CostPeriodStatus extends Model<InferAttributes<CostPeriodStatus>, InferCreationAttributes<CostPeriodStatus>> {
  declare tenantId: string;
  declare providerId: string;
  declare billingSourceId: string;
  declare periodMonth: string;
  declare status: CreationOptional<"open" | "frozen" | "adjusted">;
  declare snapshotVersion: CreationOptional<number>;
  declare sourceIngestionRunId: CreationOptional<string | null>;
  declare closedAt: CreationOptional<Date | null>;
  declare notes: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createCostPeriodStatusModel = (sequelize: Sequelize): typeof CostPeriodStatus => {
  CostPeriodStatus.init(
    {
      tenantId: { type: DataTypes.UUID, allowNull: false, primaryKey: true, field: "tenant_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true, field: "provider_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true, field: "billing_source_id" },
      periodMonth: { type: DataTypes.DATEONLY, allowNull: false, primaryKey: true, field: "period_month" },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "open",
      },
      snapshotVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: "snapshot_version" },
      sourceIngestionRunId: { type: DataTypes.BIGINT, allowNull: true, field: "source_ingestion_run_id" },
      closedAt: { type: DataTypes.DATE, allowNull: true, field: "closed_at" },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "CostPeriodStatus",
      tableName: "cost_period_status",
      timestamps: false,
    },
  );
  return CostPeriodStatus;
};

export { CostPeriodStatus };
export default createCostPeriodStatusModel;
