import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class FactEc2InstanceCostDaily extends Model<
  InferAttributes<FactEc2InstanceCostDaily>,
  InferCreationAttributes<FactEc2InstanceCostDaily>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare usageDate: string;
  declare instanceId: string;
  declare resourceKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare instanceType: CreationOptional<string | null>;
  declare currencyCode: CreationOptional<string | null>;
  declare computeCost: CreationOptional<string>;
  declare ebsCost: CreationOptional<string>;
  declare dataTransferCost: CreationOptional<string>;
  declare taxCost: CreationOptional<string>;
  declare creditAmount: CreationOptional<string>;
  declare refundAmount: CreationOptional<string>;
  declare totalBilledCost: CreationOptional<string>;
  declare totalEffectiveCost: CreationOptional<string>;
  declare totalListCost: CreationOptional<string>;
  declare usageHours: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createFactEc2InstanceCostDailyModel = (sequelize: Sequelize): typeof FactEc2InstanceCostDaily => {
  FactEc2InstanceCostDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      instanceId: { type: DataTypes.TEXT, allowNull: false, field: "instance_id" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      instanceType: { type: DataTypes.TEXT, allowNull: true, field: "instance_type" },
      currencyCode: { type: DataTypes.STRING(10), allowNull: true, field: "currency_code" },
      computeCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "compute_cost" },
      ebsCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "ebs_cost" },
      dataTransferCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "data_transfer_cost" },
      taxCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "tax_cost" },
      creditAmount: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "credit_amount" },
      refundAmount: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "refund_amount" },
      totalBilledCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "total_billed_cost" },
      totalEffectiveCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "total_effective_cost" },
      totalListCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "total_list_cost" },
      usageHours: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "usage_hours" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "FactEc2InstanceCostDaily",
      tableName: "fact_ec2_instance_cost_daily",
      timestamps: false,
    },
  );

  return FactEc2InstanceCostDaily;
};

export { FactEc2InstanceCostDaily };
export default createFactEc2InstanceCostDailyModel;
