import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class LoadBalancerMetricsDaily extends Model<
  InferAttributes<LoadBalancerMetricsDaily>,
  InferCreationAttributes<LoadBalancerMetricsDaily>
> {
  declare id: CreationOptional<string>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare accountId: string;
  declare region: string;
  declare loadBalancerArn: string;
  declare metricDate: string;
  declare requestCount: CreationOptional<string>;
  declare processedBytes: CreationOptional<string>;
  declare processedGb: CreationOptional<string>;
  declare activeConnectionCount: CreationOptional<string>;
  declare newConnectionCount: CreationOptional<string>;
  declare activeFlowCount: CreationOptional<string>;
  declare newFlowCount: CreationOptional<string>;
  declare healthyHostCount: CreationOptional<string>;
  declare unhealthyHostCount: CreationOptional<string>;
  declare targetResponseTimeAvg: CreationOptional<string>;
  declare elb5xxCount: CreationOptional<string>;
  declare target5xxCount: CreationOptional<string>;
  declare tcpTargetResetCount: CreationOptional<string>;
  declare lastSyncedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createLoadBalancerMetricsDailyModel = (sequelize: Sequelize): typeof LoadBalancerMetricsDaily => {
  LoadBalancerMetricsDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      accountId: { type: DataTypes.STRING(20), allowNull: false, field: "account_id" },
      region: { type: DataTypes.STRING(64), allowNull: false, field: "region" },
      loadBalancerArn: { type: DataTypes.TEXT, allowNull: false, field: "load_balancer_arn" },
      metricDate: { type: DataTypes.DATEONLY, allowNull: false, field: "metric_date" },
      requestCount: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: "request_count" },
      processedBytes: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: "processed_bytes" },
      processedGb: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "processed_gb" },
      activeConnectionCount: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: "active_connection_count" },
      newConnectionCount: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: "new_connection_count" },
      activeFlowCount: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: "active_flow_count" },
      newFlowCount: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: "new_flow_count" },
      healthyHostCount: { type: DataTypes.DECIMAL(12, 4), allowNull: false, defaultValue: 0, field: "healthy_host_count" },
      unhealthyHostCount: { type: DataTypes.DECIMAL(12, 4), allowNull: false, defaultValue: 0, field: "unhealthy_host_count" },
      targetResponseTimeAvg: { type: DataTypes.DECIMAL(12, 6), allowNull: false, defaultValue: 0, field: "target_response_time_avg" },
      elb5xxCount: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: "elb_5xx_count" },
      target5xxCount: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: "target_5xx_count" },
      tcpTargetResetCount: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: "tcp_target_reset_count" },
      lastSyncedAt: { type: DataTypes.DATE, allowNull: true, field: "last_synced_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "LoadBalancerMetricsDaily",
      tableName: "load_balancer_metrics_daily",
      timestamps: false,
      indexes: [
        { name: "uq_lb_metrics_daily_identity", unique: true, fields: ["cloud_connection_id", "account_id", "region", "load_balancer_arn", "metric_date"] },
        { name: "idx_lb_metrics_daily_cloud_connection_id", fields: ["cloud_connection_id"] },
        { name: "idx_lb_metrics_daily_account_id", fields: ["account_id"] },
        { name: "idx_lb_metrics_daily_region", fields: ["region"] },
        { name: "idx_lb_metrics_daily_load_balancer_arn", fields: ["load_balancer_arn"] },
        { name: "idx_lb_metrics_daily_metric_date", fields: ["metric_date"] },
      ],
    },
  );

  return LoadBalancerMetricsDaily;
};

export { LoadBalancerMetricsDaily };
export default createLoadBalancerMetricsDailyModel;
