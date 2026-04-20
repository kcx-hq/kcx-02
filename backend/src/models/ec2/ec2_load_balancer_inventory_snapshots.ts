import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class Ec2LoadBalancerInventorySnapshot extends Model<
  InferAttributes<Ec2LoadBalancerInventorySnapshot>,
  InferCreationAttributes<Ec2LoadBalancerInventorySnapshot>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare providerId: CreationOptional<number | null>;
  declare loadBalancerArn: string;
  declare resourceKey: CreationOptional<number | null>;
  declare regionKey: CreationOptional<number | null>;
  declare subAccountKey: CreationOptional<number | null>;
  declare loadBalancerName: CreationOptional<string | null>;
  declare loadBalancerType: CreationOptional<string | null>;
  declare scheme: CreationOptional<string | null>;
  declare state: CreationOptional<string | null>;
  declare targetGroupCount: CreationOptional<number | null>;
  declare healthyTargetsCount: CreationOptional<number | null>;
  declare tagsJson: CreationOptional<Record<string, unknown> | null>;
  declare metadataJson: CreationOptional<Record<string, unknown> | null>;
  declare discoveredAt: Date;
  declare isCurrent: CreationOptional<boolean>;
  declare deletedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createEc2LoadBalancerInventorySnapshotModel = (sequelize: Sequelize): typeof Ec2LoadBalancerInventorySnapshot => {
  Ec2LoadBalancerInventorySnapshot.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      loadBalancerArn: { type: DataTypes.TEXT, allowNull: false, field: "load_balancer_arn" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      loadBalancerName: { type: DataTypes.TEXT, allowNull: true, field: "load_balancer_name" },
      loadBalancerType: { type: DataTypes.TEXT, allowNull: true, field: "load_balancer_type" },
      scheme: { type: DataTypes.TEXT, allowNull: true },
      state: { type: DataTypes.TEXT, allowNull: true },
      targetGroupCount: { type: DataTypes.INTEGER, allowNull: true, field: "target_group_count" },
      healthyTargetsCount: { type: DataTypes.INTEGER, allowNull: true, field: "healthy_targets_count" },
      tagsJson: { type: DataTypes.JSONB, allowNull: true, field: "tags_json" },
      metadataJson: { type: DataTypes.JSONB, allowNull: true, field: "metadata_json" },
      discoveredAt: { type: DataTypes.DATE, allowNull: false, field: "discovered_at" },
      isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_current" },
      deletedAt: { type: DataTypes.DATE, allowNull: true, field: "deleted_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "Ec2LoadBalancerInventorySnapshot",
      tableName: "ec2_load_balancer_inventory_snapshots",
      timestamps: false,
    },
  );

  return Ec2LoadBalancerInventorySnapshot;
};

export { Ec2LoadBalancerInventorySnapshot };
export default createEc2LoadBalancerInventorySnapshotModel;
