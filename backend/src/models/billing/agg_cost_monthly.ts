import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class AggCostMonthly extends Model<InferAttributes<AggCostMonthly>, InferCreationAttributes<AggCostMonthly>> {
  declare monthStart: string;
  declare tenantId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<string | null>;
  declare ingestionRunId: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare uploadedBy: CreationOptional<string | null>;
  declare serviceKey: string;
  declare subAccountKey: string;
  declare regionKey: string;
  declare billedCost: CreationOptional<string>;
  declare effectiveCost: CreationOptional<string>;
  declare listCost: CreationOptional<string>;
  declare usageQuantity: CreationOptional<string>;
  declare currencyCode: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createAggCostMonthlyModel = (sequelize: Sequelize): typeof AggCostMonthly => {
  AggCostMonthly.init(
    {
      monthStart: { type: DataTypes.DATEONLY, allowNull: false, primaryKey: true, field: "month_start" },
      tenantId: { type: DataTypes.UUID, allowNull: true, primaryKey: true, field: "tenant_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      ingestionRunId: { type: DataTypes.BIGINT, allowNull: true, field: "ingestion_run_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      uploadedBy: { type: DataTypes.UUID, allowNull: true, field: "uploaded_by" },
      serviceKey: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true, field: "service_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true, field: "sub_account_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true, field: "region_key" },
      billedCost: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0, field: "billed_cost" },
      effectiveCost: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0, field: "effective_cost" },
      listCost: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0, field: "list_cost" },
      usageQuantity: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0, field: "usage_quantity" },
      currencyCode: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "USD", primaryKey: true, field: "currency_code" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "AggCostMonthly",
      tableName: "agg_cost_monthly",
      timestamps: false,
    },
  );
  return AggCostMonthly;
};

export { AggCostMonthly };
export default createAggCostMonthlyModel;
