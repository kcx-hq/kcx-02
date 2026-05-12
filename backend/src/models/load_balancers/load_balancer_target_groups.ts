import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class LoadBalancerTargetGroup extends Model<
  InferAttributes<LoadBalancerTargetGroup>,
  InferCreationAttributes<LoadBalancerTargetGroup>
> {
  declare id: CreationOptional<string>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare accountId: string;
  declare region: string;
  declare arn: string;
  declare name: CreationOptional<string | null>;
  declare loadBalancerArn: CreationOptional<string | null>;
  declare protocol: CreationOptional<string | null>;
  declare port: CreationOptional<number | null>;
  declare targetType: CreationOptional<string | null>;
  declare vpcId: CreationOptional<string | null>;
  declare healthCheckProtocol: CreationOptional<string | null>;
  declare healthCheckPath: CreationOptional<string | null>;
  declare healthyTargetCount: CreationOptional<number | null>;
  declare unhealthyTargetCount: CreationOptional<number | null>;
  declare tags: CreationOptional<Record<string, unknown> | null>;
  declare lastSyncedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createLoadBalancerTargetGroupModel = (sequelize: Sequelize): typeof LoadBalancerTargetGroup => {
  LoadBalancerTargetGroup.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      accountId: { type: DataTypes.STRING(20), allowNull: false, field: "account_id" },
      region: { type: DataTypes.STRING(64), allowNull: false, field: "region" },
      arn: { type: DataTypes.TEXT, allowNull: false, field: "arn" },
      name: { type: DataTypes.TEXT, allowNull: true, field: "name" },
      loadBalancerArn: { type: DataTypes.TEXT, allowNull: true, field: "load_balancer_arn" },
      protocol: { type: DataTypes.STRING(32), allowNull: true, field: "protocol" },
      port: { type: DataTypes.INTEGER, allowNull: true, field: "port" },
      targetType: { type: DataTypes.STRING(32), allowNull: true, field: "target_type" },
      vpcId: { type: DataTypes.TEXT, allowNull: true, field: "vpc_id" },
      healthCheckProtocol: { type: DataTypes.STRING(32), allowNull: true, field: "health_check_protocol" },
      healthCheckPath: { type: DataTypes.TEXT, allowNull: true, field: "health_check_path" },
      healthyTargetCount: { type: DataTypes.INTEGER, allowNull: true, field: "healthy_target_count" },
      unhealthyTargetCount: { type: DataTypes.INTEGER, allowNull: true, field: "unhealthy_target_count" },
      tags: { type: DataTypes.JSONB, allowNull: true, field: "tags" },
      lastSyncedAt: { type: DataTypes.DATE, allowNull: true, field: "last_synced_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "LoadBalancerTargetGroup",
      tableName: "load_balancer_target_groups",
      timestamps: false,
      indexes: [
        { name: "uq_lb_target_groups_identity", unique: true, fields: ["cloud_connection_id", "account_id", "region", "arn"] },
        { name: "idx_lb_target_groups_cloud_connection_id", fields: ["cloud_connection_id"] },
        { name: "idx_lb_target_groups_account_id", fields: ["account_id"] },
        { name: "idx_lb_target_groups_region", fields: ["region"] },
        { name: "idx_lb_target_groups_arn", fields: ["arn"] },
        { name: "idx_lb_target_groups_load_balancer_arn", fields: ["load_balancer_arn"] },
      ],
    },
  );

  return LoadBalancerTargetGroup;
};

export { LoadBalancerTargetGroup };
export default createLoadBalancerTargetGroupModel;
