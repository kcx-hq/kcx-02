import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class DbUtilizationDaily extends Model<
  InferAttributes<DbUtilizationDaily>,
  InferCreationAttributes<DbUtilizationDaily>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare resourceId: string;
  declare usageDate: string;
  declare dbService: string;
  declare dbEngine: CreationOptional<string | null>;
  declare resourceKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare cpuAvg: CreationOptional<string | null>;
  declare cpuMax: CreationOptional<string | null>;
  declare loadAvg: CreationOptional<string | null>;
  declare connectionsAvg: CreationOptional<string | null>;
  declare connectionsMax: CreationOptional<string | null>;
  declare requestCount: CreationOptional<string | null>;
  declare readIops: CreationOptional<string | null>;
  declare writeIops: CreationOptional<string | null>;
  declare readThroughputBytes: CreationOptional<string | null>;
  declare writeThroughputBytes: CreationOptional<string | null>;
  declare storageUsedGb: CreationOptional<string | null>;
  declare allocatedStorageGb: CreationOptional<string | null>;
  declare sampleCount: CreationOptional<number | null>;
  declare metricSource: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createDbUtilizationDailyModel = (sequelize: Sequelize): typeof DbUtilizationDaily => {
  DbUtilizationDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      resourceId: { type: DataTypes.TEXT, allowNull: false, field: "resource_id" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      dbService: { type: DataTypes.TEXT, allowNull: false, field: "db_service" },
      dbEngine: { type: DataTypes.TEXT, allowNull: true, field: "db_engine" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      cpuAvg: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "cpu_avg" },
      cpuMax: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "cpu_max" },
      loadAvg: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "load_avg" },
      connectionsAvg: { type: DataTypes.DECIMAL(18, 4), allowNull: true, field: "connections_avg" },
      connectionsMax: { type: DataTypes.DECIMAL(18, 4), allowNull: true, field: "connections_max" },
      requestCount: { type: DataTypes.DECIMAL(20, 4), allowNull: true, field: "request_count" },
      readIops: { type: DataTypes.DECIMAL(18, 4), allowNull: true, field: "read_iops" },
      writeIops: { type: DataTypes.DECIMAL(18, 4), allowNull: true, field: "write_iops" },
      readThroughputBytes: { type: DataTypes.DECIMAL(20, 4), allowNull: true, field: "read_throughput_bytes" },
      writeThroughputBytes: { type: DataTypes.DECIMAL(20, 4), allowNull: true, field: "write_throughput_bytes" },
      storageUsedGb: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "storage_used_gb" },
      allocatedStorageGb: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "allocated_storage_gb" },
      sampleCount: { type: DataTypes.INTEGER, allowNull: true, field: "sample_count" },
      metricSource: { type: DataTypes.TEXT, allowNull: true, field: "metric_source" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "DbUtilizationDaily",
      tableName: "db_utilization_daily",
      timestamps: false,
      indexes: [
        { name: "uq_db_utilization_daily_resource_date", unique: true, fields: ["tenant_id", "cloud_connection_id", "resource_id", "usage_date"] },
        { name: "idx_db_utilization_daily_tenant_id", fields: ["tenant_id"] },
        { name: "idx_db_utilization_daily_cloud_connection_id", fields: ["cloud_connection_id"] },
        { name: "idx_db_utilization_daily_provider_id", fields: ["provider_id"] },
        { name: "idx_db_utilization_daily_resource_id", fields: ["resource_id"] },
        { name: "idx_db_utilization_daily_usage_date", fields: ["usage_date"] },
        { name: "idx_db_utilization_daily_db_service", fields: ["db_service"] },
        { name: "idx_db_utilization_daily_db_engine", fields: ["db_engine"] },
        { name: "idx_db_utilization_daily_region_key", fields: ["region_key"] },
        { name: "idx_db_utilization_daily_sub_account_key", fields: ["sub_account_key"] },
        { name: "idx_db_utilization_daily_resource_key", fields: ["resource_key"] },
        { name: "idx_db_utilization_daily_tenant_conn_date", fields: ["tenant_id", "cloud_connection_id", "usage_date"] },
        { name: "idx_db_utilization_daily_tenant_conn_service_date", fields: ["tenant_id", "cloud_connection_id", "db_service", "usage_date"] },
        { name: "idx_db_utilization_daily_tenant_conn_resource_date", fields: ["tenant_id", "cloud_connection_id", "resource_id", "usage_date"] },
      ],
    },
  );

  return DbUtilizationDaily;
};

export { DbUtilizationDaily };
export default createDbUtilizationDailyModel;
