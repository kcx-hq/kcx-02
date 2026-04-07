import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class AggCostHourly extends Model<InferAttributes<AggCostHourly>, InferCreationAttributes<AggCostHourly>> {
  declare hourStart: Date;
  declare usageDate: string;
  declare billingPeriodStartDate: string;
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

const createAggCostHourlyModel = (sequelize: Sequelize): typeof AggCostHourly => {
  AggCostHourly.init(
    {
      hourStart: { type: DataTypes.DATE, allowNull: false, primaryKey: true, field: "hour_start" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      billingPeriodStartDate: { type: DataTypes.DATEONLY, allowNull: false, field: "billing_period_start_date" },
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
      modelName: "AggCostHourly",
      tableName: "agg_cost_hourly",
      timestamps: false,
    },
  );
  return AggCostHourly;
};

export { AggCostHourly };
export default createAggCostHourlyModel;
