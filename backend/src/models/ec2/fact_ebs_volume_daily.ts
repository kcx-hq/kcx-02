import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class FactEbsVolumeDaily extends Model<InferAttributes<FactEbsVolumeDaily>, InferCreationAttributes<FactEbsVolumeDaily>> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare usageDate: string;
  declare volumeId: string;
  declare resourceKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare volumeType: CreationOptional<string | null>;
  declare sizeGb: CreationOptional<number | null>;
  declare iops: CreationOptional<number | null>;
  declare throughput: CreationOptional<number | null>;
  declare availabilityZone: CreationOptional<string | null>;
  declare state: CreationOptional<string | null>;
  declare attachedInstanceId: CreationOptional<string | null>;
  declare isAttached: CreationOptional<boolean | null>;
  declare storageCost: CreationOptional<string>;
  declare ioCost: CreationOptional<string>;
  declare throughputCost: CreationOptional<string>;
  declare totalCost: CreationOptional<string>;
  declare currencyCode: CreationOptional<string | null>;
  declare isUnattached: CreationOptional<boolean | null>;
  declare isAttachedToStoppedInstance: CreationOptional<boolean | null>;
  declare isIdleCandidate: CreationOptional<boolean | null>;
  declare isUnderutilizedCandidate: CreationOptional<boolean | null>;
  declare optimizationStatus: CreationOptional<"idle" | "underutilized" | "optimal" | "warning" | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createFactEbsVolumeDailyModel = (sequelize: Sequelize): typeof FactEbsVolumeDaily => {
  FactEbsVolumeDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      volumeId: { type: DataTypes.TEXT, allowNull: false, field: "volume_id" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      volumeType: { type: DataTypes.TEXT, allowNull: true, field: "volume_type" },
      sizeGb: { type: DataTypes.INTEGER, allowNull: true, field: "size_gb" },
      iops: { type: DataTypes.INTEGER, allowNull: true },
      throughput: { type: DataTypes.INTEGER, allowNull: true },
      availabilityZone: { type: DataTypes.TEXT, allowNull: true, field: "availability_zone" },
      state: { type: DataTypes.TEXT, allowNull: true },
      attachedInstanceId: { type: DataTypes.TEXT, allowNull: true, field: "attached_instance_id" },
      isAttached: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_attached" },
      storageCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "storage_cost" },
      ioCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "io_cost" },
      throughputCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "throughput_cost" },
      totalCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "total_cost" },
      currencyCode: { type: DataTypes.STRING(10), allowNull: true, defaultValue: "USD", field: "currency_code" },
      isUnattached: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_unattached" },
      isAttachedToStoppedInstance: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_attached_to_stopped_instance" },
      isIdleCandidate: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_idle_candidate" },
      isUnderutilizedCandidate: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_underutilized_candidate" },
      optimizationStatus: { type: DataTypes.STRING(30), allowNull: true, field: "optimization_status" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "FactEbsVolumeDaily",
      tableName: "fact_ebs_volume_daily",
      timestamps: false,
    },
  );

  return FactEbsVolumeDaily;
};

export { FactEbsVolumeDaily };
export default createFactEbsVolumeDailyModel;
