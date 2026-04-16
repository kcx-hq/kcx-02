import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class Ec2InstanceUtilizationDaily extends Model<
  InferAttributes<Ec2InstanceUtilizationDaily>,
  InferCreationAttributes<Ec2InstanceUtilizationDaily>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare instanceId: string;
  declare usageDate: string;
  declare resourceKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare cpuAvg: CreationOptional<string | null>;
  declare cpuMax: CreationOptional<string | null>;
  declare cpuMin: CreationOptional<string | null>;
  declare networkInBytes: CreationOptional<string | null>;
  declare networkOutBytes: CreationOptional<string | null>;
  declare networkPacketsIn: CreationOptional<string | null>;
  declare networkPacketsOut: CreationOptional<string | null>;
  declare diskReadBytes: CreationOptional<string | null>;
  declare diskWriteBytes: CreationOptional<string | null>;
  declare diskReadOps: CreationOptional<string | null>;
  declare diskWriteOps: CreationOptional<string | null>;
  declare statusCheckFailedMax: CreationOptional<string | null>;
  declare statusCheckFailedInstanceMax: CreationOptional<string | null>;
  declare statusCheckFailedSystemMax: CreationOptional<string | null>;
  declare ebsReadBytes: CreationOptional<string | null>;
  declare ebsWriteBytes: CreationOptional<string | null>;
  declare ebsReadOps: CreationOptional<string | null>;
  declare ebsWriteOps: CreationOptional<string | null>;
  declare ebsQueueLengthMax: CreationOptional<string | null>;
  declare ebsIdleTimeAvg: CreationOptional<string | null>;
  declare ebsBurstBalanceAvg: CreationOptional<string | null>;
  declare memoryAvg: CreationOptional<string | null>;
  declare memoryMax: CreationOptional<string | null>;
  declare swapUsedAvg: CreationOptional<string | null>;
  declare diskUsedPercentAvg: CreationOptional<string | null>;
  declare diskUsedPercentMax: CreationOptional<string | null>;
  declare diskFreeBytesAvg: CreationOptional<string | null>;
  declare isIdleCandidate: CreationOptional<boolean | null>;
  declare isUnderutilizedCandidate: CreationOptional<boolean | null>;
  declare isOverutilizedCandidate: CreationOptional<boolean | null>;
  declare peakToAvgCpuRatio: CreationOptional<string | null>;
  declare sampleCount: CreationOptional<number>;
  declare metricSource: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createEc2InstanceUtilizationDailyModel = (sequelize: Sequelize): typeof Ec2InstanceUtilizationDaily => {
  Ec2InstanceUtilizationDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      instanceId: { type: DataTypes.TEXT, allowNull: false, field: "instance_id" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      cpuAvg: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "cpu_avg" },
      cpuMax: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "cpu_max" },
      cpuMin: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "cpu_min" },
      networkInBytes: { type: DataTypes.BIGINT, allowNull: true, field: "network_in_bytes" },
      networkOutBytes: { type: DataTypes.BIGINT, allowNull: true, field: "network_out_bytes" },
      networkPacketsIn: { type: DataTypes.BIGINT, allowNull: true, field: "network_packets_in" },
      networkPacketsOut: { type: DataTypes.BIGINT, allowNull: true, field: "network_packets_out" },
      diskReadBytes: { type: DataTypes.BIGINT, allowNull: true, field: "disk_read_bytes" },
      diskWriteBytes: { type: DataTypes.BIGINT, allowNull: true, field: "disk_write_bytes" },
      diskReadOps: { type: DataTypes.BIGINT, allowNull: true, field: "disk_read_ops" },
      diskWriteOps: { type: DataTypes.BIGINT, allowNull: true, field: "disk_write_ops" },
      statusCheckFailedMax: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "status_check_failed_max" },
      statusCheckFailedInstanceMax: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: true,
        field: "status_check_failed_instance_max",
      },
      statusCheckFailedSystemMax: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "status_check_failed_system_max" },
      ebsReadBytes: { type: DataTypes.BIGINT, allowNull: true, field: "ebs_read_bytes" },
      ebsWriteBytes: { type: DataTypes.BIGINT, allowNull: true, field: "ebs_write_bytes" },
      ebsReadOps: { type: DataTypes.BIGINT, allowNull: true, field: "ebs_read_ops" },
      ebsWriteOps: { type: DataTypes.BIGINT, allowNull: true, field: "ebs_write_ops" },
      ebsQueueLengthMax: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: "ebs_queue_length_max" },
      ebsIdleTimeAvg: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: "ebs_idle_time_avg" },
      ebsBurstBalanceAvg: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "ebs_burst_balance_avg" },
      memoryAvg: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "memory_avg" },
      memoryMax: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "memory_max" },
      swapUsedAvg: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "swap_used_avg" },
      diskUsedPercentAvg: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "disk_used_percent_avg" },
      diskUsedPercentMax: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "disk_used_percent_max" },
      diskFreeBytesAvg: { type: DataTypes.BIGINT, allowNull: true, field: "disk_free_bytes_avg" },
      isIdleCandidate: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_idle_candidate" },
      isUnderutilizedCandidate: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_underutilized_candidate" },
      isOverutilizedCandidate: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_overutilized_candidate" },
      peakToAvgCpuRatio: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "peak_to_avg_cpu_ratio" },
      sampleCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: "sample_count" },
      metricSource: { type: DataTypes.STRING(50), allowNull: true, field: "metric_source" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "Ec2InstanceUtilizationDaily",
      tableName: "ec2_instance_utilization_daily",
      timestamps: false,
    },
  );

  return Ec2InstanceUtilizationDaily;
};

export { Ec2InstanceUtilizationDaily };
export default createEc2InstanceUtilizationDailyModel;
