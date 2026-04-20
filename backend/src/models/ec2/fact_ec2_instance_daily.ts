import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class FactEc2InstanceDaily extends Model<InferAttributes<FactEc2InstanceDaily>, InferCreationAttributes<FactEc2InstanceDaily>> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare usageDate: string;
  declare instanceId: string;
  declare resourceKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare instanceType: CreationOptional<string | null>;
  declare state: CreationOptional<string | null>;
  declare isRunning: boolean;
  declare launchTime: CreationOptional<Date | null>;
  declare deletedAt: CreationOptional<Date | null>;
  declare source: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createFactEc2InstanceDailyModel = (sequelize: Sequelize): typeof FactEc2InstanceDaily => {
  FactEc2InstanceDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      instanceId: { type: DataTypes.TEXT, allowNull: false, field: "instance_id" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      instanceType: { type: DataTypes.TEXT, allowNull: true, field: "instance_type" },
      state: { type: DataTypes.TEXT, allowNull: true },
      isRunning: { type: DataTypes.BOOLEAN, allowNull: false, field: "is_running" },
      launchTime: { type: DataTypes.DATE, allowNull: true, field: "launch_time" },
      deletedAt: { type: DataTypes.DATE, allowNull: true, field: "deleted_at" },
      source: { type: DataTypes.STRING(50), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "FactEc2InstanceDaily",
      tableName: "fact_ec2_instance_daily",
      timestamps: false,
    },
  );

  return FactEc2InstanceDaily;
};

export { FactEc2InstanceDaily };
export default createFactEc2InstanceDailyModel;
