import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class Ec2TargetGroupInventorySnapshot extends Model<
  InferAttributes<Ec2TargetGroupInventorySnapshot>,
  InferCreationAttributes<Ec2TargetGroupInventorySnapshot>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare providerId: CreationOptional<number | null>;
  declare targetGroupArn: string;
  declare resourceKey: CreationOptional<number | null>;
  declare regionKey: CreationOptional<number | null>;
  declare subAccountKey: CreationOptional<number | null>;
  declare targetGroupName: CreationOptional<string | null>;
  declare loadBalancerArn: CreationOptional<string | null>;
  declare registeredTargetsCount: CreationOptional<number | null>;
  declare healthyTargetsCount: CreationOptional<number | null>;
  declare unhealthyTargetsCount: CreationOptional<number | null>;
  declare state: CreationOptional<string | null>;
  declare tagsJson: CreationOptional<Record<string, unknown> | null>;
  declare metadataJson: CreationOptional<Record<string, unknown> | null>;
  declare discoveredAt: Date;
  declare isCurrent: CreationOptional<boolean>;
  declare deletedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createEc2TargetGroupInventorySnapshotModel = (sequelize: Sequelize): typeof Ec2TargetGroupInventorySnapshot => {
  Ec2TargetGroupInventorySnapshot.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      targetGroupArn: { type: DataTypes.TEXT, allowNull: false, field: "target_group_arn" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      targetGroupName: { type: DataTypes.TEXT, allowNull: true, field: "target_group_name" },
      loadBalancerArn: { type: DataTypes.TEXT, allowNull: true, field: "load_balancer_arn" },
      registeredTargetsCount: { type: DataTypes.INTEGER, allowNull: true, field: "registered_targets_count" },
      healthyTargetsCount: { type: DataTypes.INTEGER, allowNull: true, field: "healthy_targets_count" },
      unhealthyTargetsCount: { type: DataTypes.INTEGER, allowNull: true, field: "unhealthy_targets_count" },
      state: { type: DataTypes.TEXT, allowNull: true },
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
      modelName: "Ec2TargetGroupInventorySnapshot",
      tableName: "ec2_target_group_inventory_snapshots",
      timestamps: false,
    },
  );

  return Ec2TargetGroupInventorySnapshot;
};

export { Ec2TargetGroupInventorySnapshot };
export default createEc2TargetGroupInventorySnapshotModel;
