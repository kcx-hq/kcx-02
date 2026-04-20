import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class Ec2CostHistoryMonthly extends Model<
  InferAttributes<Ec2CostHistoryMonthly>,
  InferCreationAttributes<Ec2CostHistoryMonthly>
> {
  declare monthStart: string;
  declare tenantId: string;
  declare providerId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare serviceKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare resourceKey: CreationOptional<string | null>;
  declare instanceId: CreationOptional<string | null>;
  declare instanceType: CreationOptional<string | null>;
  declare state: CreationOptional<string | null>;
  declare pricingModel: CreationOptional<"on_demand" | "reserved" | "savings_plan" | "spot" | "other">;
  declare chargeCategory: CreationOptional<"compute" | "ebs" | "data_transfer" | "tax" | "credit" | "refund" | "other">;
  declare billedCost: CreationOptional<string>;
  declare effectiveCost: CreationOptional<string>;
  declare listCost: CreationOptional<string>;
  declare usageQuantity: CreationOptional<string>;
  declare currencyCode: CreationOptional<string>;
  declare isFinal: CreationOptional<boolean>;
  declare finalizedAt: CreationOptional<Date | null>;
  declare snapshotVersion: CreationOptional<number>;
  declare ingestionRunId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createEc2CostHistoryMonthlyModel = (sequelize: Sequelize): typeof Ec2CostHistoryMonthly => {
  Ec2CostHistoryMonthly.init(
    {
      monthStart: { type: DataTypes.DATEONLY, allowNull: false, primaryKey: true, field: "month_start" },
      tenantId: { type: DataTypes.UUID, allowNull: false, primaryKey: true, field: "tenant_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, primaryKey: true, field: "provider_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, primaryKey: true, field: "billing_source_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, primaryKey: true, field: "cloud_connection_id" },
      serviceKey: { type: DataTypes.BIGINT, allowNull: true, primaryKey: true, field: "service_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, primaryKey: true, field: "sub_account_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, primaryKey: true, field: "region_key" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, primaryKey: true, field: "resource_key" },
      instanceId: { type: DataTypes.TEXT, allowNull: true, primaryKey: true, field: "instance_id" },
      instanceType: { type: DataTypes.TEXT, allowNull: true, primaryKey: true, field: "instance_type" },
      state: { type: DataTypes.TEXT, allowNull: true, primaryKey: true },
      pricingModel: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "other", primaryKey: true, field: "pricing_model" },
      chargeCategory: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "other", primaryKey: true, field: "charge_category" },
      billedCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "billed_cost" },
      effectiveCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "effective_cost" },
      listCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "list_cost" },
      usageQuantity: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "usage_quantity" },
      currencyCode: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "USD", primaryKey: true, field: "currency_code" },
      isFinal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_final" },
      finalizedAt: { type: DataTypes.DATE, allowNull: true, field: "finalized_at" },
      snapshotVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, primaryKey: true, field: "snapshot_version" },
      ingestionRunId: { type: DataTypes.BIGINT, allowNull: true, field: "ingestion_run_id" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "Ec2CostHistoryMonthly",
      tableName: "ec2_cost_history_monthly",
      timestamps: false,
    },
  );
  return Ec2CostHistoryMonthly;
};

export { Ec2CostHistoryMonthly };
export default createEc2CostHistoryMonthlyModel;
