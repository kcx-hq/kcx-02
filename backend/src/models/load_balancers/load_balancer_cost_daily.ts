import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class LoadBalancerCostDaily extends Model<
  InferAttributes<LoadBalancerCostDaily>,
  InferCreationAttributes<LoadBalancerCostDaily>
> {
  declare id: CreationOptional<string>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare accountId: string;
  declare region: string;
  declare loadBalancerArn: string;
  declare usageDate: string;
  declare totalCost: CreationOptional<string>;
  declare fixedCost: CreationOptional<string>;
  declare lcuCost: CreationOptional<string>;
  declare dataProcessingCost: CreationOptional<string>;
  declare processedBytesGb: CreationOptional<string>;
  declare usageQuantity: CreationOptional<string>;
  declare currencyCode: CreationOptional<string>;
  declare lineItemCount: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createLoadBalancerCostDailyModel = (sequelize: Sequelize): typeof LoadBalancerCostDaily => {
  LoadBalancerCostDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      accountId: { type: DataTypes.STRING(20), allowNull: false, field: "account_id" },
      region: { type: DataTypes.STRING(64), allowNull: false, field: "region" },
      loadBalancerArn: { type: DataTypes.TEXT, allowNull: false, field: "load_balancer_arn" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      totalCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "total_cost" },
      fixedCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "fixed_cost" },
      lcuCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "lcu_cost" },
      dataProcessingCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "data_processing_cost" },
      processedBytesGb: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "processed_bytes_gb" },
      usageQuantity: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "usage_quantity" },
      currencyCode: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "USD", field: "currency_code" },
      lineItemCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "line_item_count" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "LoadBalancerCostDaily",
      tableName: "load_balancer_cost_daily",
      timestamps: false,
      indexes: [
        { name: "uq_lb_cost_daily_identity", unique: true, fields: ["cloud_connection_id", "account_id", "region", "load_balancer_arn", "usage_date"] },
        { name: "idx_lb_cost_daily_cloud_connection_id", fields: ["cloud_connection_id"] },
        { name: "idx_lb_cost_daily_account_id", fields: ["account_id"] },
        { name: "idx_lb_cost_daily_region", fields: ["region"] },
        { name: "idx_lb_cost_daily_load_balancer_arn", fields: ["load_balancer_arn"] },
        { name: "idx_lb_cost_daily_usage_date", fields: ["usage_date"] },
      ],
    },
  );

  return LoadBalancerCostDaily;
};

export { LoadBalancerCostDaily };
export default createLoadBalancerCostDailyModel;

