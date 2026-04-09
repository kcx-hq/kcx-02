import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class ResourceUtilizationDaily extends Model<
  InferAttributes<ResourceUtilizationDaily>,
  InferCreationAttributes<ResourceUtilizationDaily>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: string;
  declare resourceId: string;
  declare usageDate: string;
  declare resourceKey: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare sampleCount: CreationOptional<number | null>;
  declare metricSource: CreationOptional<string | null>;
  declare cpuAvg: CreationOptional<string | null>;
  declare memoryAvg: CreationOptional<string | null>;
  declare networkInBytes: CreationOptional<string | null>;
  declare networkOutBytes: CreationOptional<string | null>;
  declare diskReadBytes: CreationOptional<string | null>;
  declare diskWriteBytes: CreationOptional<string | null>;
  declare maxCpu: CreationOptional<string | null>;
  declare maxMemory: CreationOptional<string | null>;
  declare idleScore: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createResourceUtilizationDailyModel = (sequelize: Sequelize): typeof ResourceUtilizationDaily => {
  ResourceUtilizationDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: false, field: "cloud_connection_id" },
      resourceId: { type: DataTypes.TEXT, allowNull: false, field: "resource_id" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      sampleCount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1, field: "sample_count" },
      metricSource: { type: DataTypes.STRING(50), allowNull: true, field: "metric_source" },
      cpuAvg: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "cpu_avg" },
      memoryAvg: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "memory_avg" },
      networkInBytes: { type: DataTypes.BIGINT, allowNull: true, field: "network_in_bytes" },
      networkOutBytes: { type: DataTypes.BIGINT, allowNull: true, field: "network_out_bytes" },
      diskReadBytes: { type: DataTypes.BIGINT, allowNull: true, field: "disk_read_bytes" },
      diskWriteBytes: { type: DataTypes.BIGINT, allowNull: true, field: "disk_write_bytes" },
      maxCpu: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "max_cpu" },
      maxMemory: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "max_memory" },
      idleScore: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: "idle_score" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "ResourceUtilizationDaily",
      tableName: "resource_utilization_daily",
      timestamps: false,
    },
  );
  return ResourceUtilizationDaily;
};

export { ResourceUtilizationDaily };
export default createResourceUtilizationDailyModel;
