import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class LoadBalancer extends Model<
  InferAttributes<LoadBalancer>,
  InferCreationAttributes<LoadBalancer>
> {
  declare id: CreationOptional<string>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare accountId: string;
  declare region: string;
  declare arn: string;
  declare name: CreationOptional<string | null>;
  declare type: CreationOptional<string | null>;
  declare scheme: CreationOptional<string | null>;
  declare state: CreationOptional<string | null>;
  declare vpcId: CreationOptional<string | null>;
  declare dnsName: CreationOptional<string | null>;
  declare createdAtAws: CreationOptional<Date | null>;
  declare securityGroups: CreationOptional<unknown[] | Record<string, unknown> | null>;
  declare availabilityZones: CreationOptional<unknown[] | Record<string, unknown> | null>;
  declare tags: CreationOptional<Record<string, unknown> | null>;
  declare listenerCount: CreationOptional<number | null>;
  declare targetGroupCount: CreationOptional<number | null>;
  declare lastSyncedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createLoadBalancerModel = (sequelize: Sequelize): typeof LoadBalancer => {
  LoadBalancer.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      accountId: { type: DataTypes.STRING(20), allowNull: false, field: "account_id" },
      region: { type: DataTypes.STRING(64), allowNull: false, field: "region" },
      arn: { type: DataTypes.TEXT, allowNull: false, field: "arn" },
      name: { type: DataTypes.TEXT, allowNull: true, field: "name" },
      type: { type: DataTypes.STRING(32), allowNull: true, field: "type" },
      scheme: { type: DataTypes.STRING(32), allowNull: true, field: "scheme" },
      state: { type: DataTypes.STRING(64), allowNull: true, field: "state" },
      vpcId: { type: DataTypes.TEXT, allowNull: true, field: "vpc_id" },
      dnsName: { type: DataTypes.TEXT, allowNull: true, field: "dns_name" },
      createdAtAws: { type: DataTypes.DATE, allowNull: true, field: "created_at_aws" },
      securityGroups: { type: DataTypes.JSONB, allowNull: true, field: "security_groups" },
      availabilityZones: { type: DataTypes.JSONB, allowNull: true, field: "availability_zones" },
      tags: { type: DataTypes.JSONB, allowNull: true, field: "tags" },
      listenerCount: { type: DataTypes.INTEGER, allowNull: true, field: "listener_count" },
      targetGroupCount: { type: DataTypes.INTEGER, allowNull: true, field: "target_group_count" },
      lastSyncedAt: { type: DataTypes.DATE, allowNull: true, field: "last_synced_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "LoadBalancer",
      tableName: "load_balancers",
      timestamps: false,
      indexes: [
        { name: "uq_load_balancers_identity", unique: true, fields: ["cloud_connection_id", "account_id", "region", "arn"] },
        { name: "idx_load_balancers_cloud_connection_id", fields: ["cloud_connection_id"] },
        { name: "idx_load_balancers_account_id", fields: ["account_id"] },
        { name: "idx_load_balancers_region", fields: ["region"] },
        { name: "idx_load_balancers_arn", fields: ["arn"] },
      ],
    },
  );

  return LoadBalancer;
};

export { LoadBalancer };
export default createLoadBalancerModel;
