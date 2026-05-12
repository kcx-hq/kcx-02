import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class EbsVolumeUtilizationDaily extends Model<
  InferAttributes<EbsVolumeUtilizationDaily>,
  InferCreationAttributes<EbsVolumeUtilizationDaily>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare volumeId: string;
  declare usageDate: string;
  declare resourceKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare readBytes: CreationOptional<string | null>;
  declare writeBytes: CreationOptional<string | null>;
  declare readOps: CreationOptional<string | null>;
  declare writeOps: CreationOptional<string | null>;
  declare queueLengthMax: CreationOptional<string | null>;
  declare burstBalanceAvg: CreationOptional<string | null>;
  declare idleTimeAvg: CreationOptional<string | null>;
  declare isIdleCandidate: CreationOptional<boolean | null>;
  declare isUnderutilizedCandidate: CreationOptional<boolean | null>;
  declare sampleCount: CreationOptional<number>;
  declare metricSource: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createEbsVolumeUtilizationDailyModel = (sequelize: Sequelize): typeof EbsVolumeUtilizationDaily => {
  EbsVolumeUtilizationDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      volumeId: { type: DataTypes.TEXT, allowNull: false, field: "volume_id" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      readBytes: { type: DataTypes.BIGINT, allowNull: true, field: "read_bytes" },
      writeBytes: { type: DataTypes.BIGINT, allowNull: true, field: "write_bytes" },
      readOps: { type: DataTypes.BIGINT, allowNull: true, field: "read_ops" },
      writeOps: { type: DataTypes.BIGINT, allowNull: true, field: "write_ops" },
      queueLengthMax: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: "queue_length_max" },
      burstBalanceAvg: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "burst_balance_avg" },
      idleTimeAvg: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: "idle_time_avg" },
      isIdleCandidate: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_idle_candidate" },
      isUnderutilizedCandidate: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_underutilized_candidate" },
      sampleCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: "sample_count" },
      metricSource: { type: DataTypes.STRING(50), allowNull: true, field: "metric_source" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "EbsVolumeUtilizationDaily",
      tableName: "ebs_volume_utilization_daily",
      timestamps: false,
    },
  );

  return EbsVolumeUtilizationDaily;
};

export { EbsVolumeUtilizationDaily };
export default createEbsVolumeUtilizationDailyModel;
