import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class LoadBalancerListener extends Model<
  InferAttributes<LoadBalancerListener>,
  InferCreationAttributes<LoadBalancerListener>
> {
  declare id: CreationOptional<string>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare accountId: string;
  declare region: string;
  declare arn: string;
  declare loadBalancerArn: CreationOptional<string | null>;
  declare protocol: CreationOptional<string | null>;
  declare port: CreationOptional<number | null>;
  declare sslPolicy: CreationOptional<string | null>;
  declare certificates: CreationOptional<unknown[] | Record<string, unknown> | null>;
  declare defaultActions: CreationOptional<unknown[] | Record<string, unknown> | null>;
  declare lastSyncedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createLoadBalancerListenerModel = (sequelize: Sequelize): typeof LoadBalancerListener => {
  LoadBalancerListener.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      accountId: { type: DataTypes.STRING(20), allowNull: false, field: "account_id" },
      region: { type: DataTypes.STRING(64), allowNull: false, field: "region" },
      arn: { type: DataTypes.TEXT, allowNull: false, field: "arn" },
      loadBalancerArn: { type: DataTypes.TEXT, allowNull: true, field: "load_balancer_arn" },
      protocol: { type: DataTypes.STRING(32), allowNull: true, field: "protocol" },
      port: { type: DataTypes.INTEGER, allowNull: true, field: "port" },
      sslPolicy: { type: DataTypes.TEXT, allowNull: true, field: "ssl_policy" },
      certificates: { type: DataTypes.JSONB, allowNull: true, field: "certificates" },
      defaultActions: { type: DataTypes.JSONB, allowNull: true, field: "default_actions" },
      lastSyncedAt: { type: DataTypes.DATE, allowNull: true, field: "last_synced_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "LoadBalancerListener",
      tableName: "load_balancer_listeners",
      timestamps: false,
      indexes: [
        { name: "uq_lb_listeners_identity", unique: true, fields: ["cloud_connection_id", "account_id", "region", "arn"] },
        { name: "idx_lb_listeners_cloud_connection_id", fields: ["cloud_connection_id"] },
        { name: "idx_lb_listeners_account_id", fields: ["account_id"] },
        { name: "idx_lb_listeners_region", fields: ["region"] },
        { name: "idx_lb_listeners_arn", fields: ["arn"] },
        { name: "idx_lb_listeners_load_balancer_arn", fields: ["load_balancer_arn"] },
      ],
    },
  );

  return LoadBalancerListener;
};

export { LoadBalancerListener };
export default createLoadBalancerListenerModel;
