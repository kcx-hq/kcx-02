import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class Ec2InstanceInventorySnapshot extends Model<
  InferAttributes<Ec2InstanceInventorySnapshot>,
  InferCreationAttributes<Ec2InstanceInventorySnapshot>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare instanceId: string;
  declare resourceKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare instanceType: CreationOptional<string | null>;
  declare platform: CreationOptional<string | null>;
  declare platformDetails: CreationOptional<string | null>;
  declare architecture: CreationOptional<string | null>;
  declare virtualizationType: CreationOptional<string | null>;
  declare tenancy: CreationOptional<string | null>;
  declare state: CreationOptional<string | null>;
  declare instanceLifecycle: CreationOptional<string | null>;
  declare spotInstanceRequestId: CreationOptional<string | null>;
  declare launchTime: CreationOptional<Date | null>;
  declare availabilityZone: CreationOptional<string | null>;
  declare vpcId: CreationOptional<string | null>;
  declare subnetId: CreationOptional<string | null>;
  declare imageId: CreationOptional<string | null>;
  declare privateIpAddress: CreationOptional<string | null>;
  declare publicIpAddress: CreationOptional<string | null>;
  declare keyName: CreationOptional<string | null>;
  declare iamInstanceProfileArn: CreationOptional<string | null>;
  declare monitoringState: CreationOptional<string | null>;
  declare ebsOptimized: CreationOptional<boolean | null>;
  declare rootDeviceName: CreationOptional<string | null>;
  declare rootDeviceType: CreationOptional<string | null>;
  declare hypervisor: CreationOptional<string | null>;
  declare asgName: CreationOptional<string | null>;
  declare tagsJson: CreationOptional<Record<string, unknown> | null>;
  declare metadataJson: CreationOptional<Record<string, unknown> | null>;
  declare discoveredAt: Date;
  declare isCurrent: CreationOptional<boolean>;
  declare deletedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createEc2InstanceInventorySnapshotModel = (sequelize: Sequelize): typeof Ec2InstanceInventorySnapshot => {
  Ec2InstanceInventorySnapshot.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      instanceId: { type: DataTypes.TEXT, allowNull: false, field: "instance_id" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      instanceType: { type: DataTypes.TEXT, allowNull: true, field: "instance_type" },
      platform: { type: DataTypes.TEXT, allowNull: true },
      platformDetails: { type: DataTypes.TEXT, allowNull: true, field: "platform_details" },
      architecture: { type: DataTypes.TEXT, allowNull: true },
      virtualizationType: { type: DataTypes.TEXT, allowNull: true, field: "virtualization_type" },
      tenancy: { type: DataTypes.TEXT, allowNull: true },
      state: { type: DataTypes.TEXT, allowNull: true },
      instanceLifecycle: { type: DataTypes.TEXT, allowNull: true, field: "instance_lifecycle" },
      spotInstanceRequestId: { type: DataTypes.TEXT, allowNull: true, field: "spot_instance_request_id" },
      launchTime: { type: DataTypes.DATE, allowNull: true, field: "launch_time" },
      availabilityZone: { type: DataTypes.TEXT, allowNull: true, field: "availability_zone" },
      vpcId: { type: DataTypes.TEXT, allowNull: true, field: "vpc_id" },
      subnetId: { type: DataTypes.TEXT, allowNull: true, field: "subnet_id" },
      imageId: { type: DataTypes.TEXT, allowNull: true, field: "image_id" },
      privateIpAddress: { type: DataTypes.TEXT, allowNull: true, field: "private_ip_address" },
      publicIpAddress: { type: DataTypes.TEXT, allowNull: true, field: "public_ip_address" },
      keyName: { type: DataTypes.TEXT, allowNull: true, field: "key_name" },
      iamInstanceProfileArn: { type: DataTypes.TEXT, allowNull: true, field: "iam_instance_profile_arn" },
      monitoringState: { type: DataTypes.TEXT, allowNull: true, field: "monitoring_state" },
      ebsOptimized: { type: DataTypes.BOOLEAN, allowNull: true, field: "ebs_optimized" },
      rootDeviceName: { type: DataTypes.TEXT, allowNull: true, field: "root_device_name" },
      rootDeviceType: { type: DataTypes.TEXT, allowNull: true, field: "root_device_type" },
      hypervisor: { type: DataTypes.TEXT, allowNull: true },
      asgName: { type: DataTypes.TEXT, allowNull: true, field: "asg_name" },
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
      modelName: "Ec2InstanceInventorySnapshot",
      tableName: "ec2_instance_inventory_snapshots",
      timestamps: false,
    },
  );

  return Ec2InstanceInventorySnapshot;
};

export { Ec2InstanceInventorySnapshot };
export default createEc2InstanceInventorySnapshotModel;
