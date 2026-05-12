import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class FactDbResourceDaily extends Model<
  InferAttributes<FactDbResourceDaily>,
  InferCreationAttributes<FactDbResourceDaily>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare usageDate: string;
  declare resourceId: string;
  declare resourceArn: CreationOptional<string | null>;
  declare resourceName: CreationOptional<string | null>;
  declare dbService: string;
  declare dbEngine: CreationOptional<string | null>;
  declare dbEngineVersion: CreationOptional<string | null>;
  declare resourceType: CreationOptional<string | null>;
  declare resourceKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare status: CreationOptional<string | null>;
  declare clusterId: CreationOptional<string | null>;
  declare isClusterResource: CreationOptional<boolean>;
  declare allocatedStorageGb: CreationOptional<string | null>;
  declare dataFootprintGb: CreationOptional<string | null>;
  declare storageUsedGb: CreationOptional<string | null>;
  declare computeCost: CreationOptional<string>;
  declare storageCost: CreationOptional<string>;
  declare ioCost: CreationOptional<string>;
  declare backupCost: CreationOptional<string>;
  declare dataTransferCost: CreationOptional<string>;
  declare taxCost: CreationOptional<string>;
  declare creditAmount: CreationOptional<string>;
  declare refundAmount: CreationOptional<string>;
  declare totalBilledCost: CreationOptional<string>;
  declare totalEffectiveCost: CreationOptional<string>;
  declare totalListCost: CreationOptional<string>;
  declare currencyCode: CreationOptional<string | null>;
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
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createFactDbResourceDailyModel = (sequelize: Sequelize): typeof FactDbResourceDaily => {
  FactDbResourceDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      resourceId: { type: DataTypes.TEXT, allowNull: false, field: "resource_id" },
      resourceArn: { type: DataTypes.TEXT, allowNull: true, field: "resource_arn" },
      resourceName: { type: DataTypes.TEXT, allowNull: true, field: "resource_name" },
      dbService: { type: DataTypes.TEXT, allowNull: false, field: "db_service" },
      dbEngine: { type: DataTypes.TEXT, allowNull: true, field: "db_engine" },
      dbEngineVersion: { type: DataTypes.TEXT, allowNull: true, field: "db_engine_version" },
      resourceType: { type: DataTypes.TEXT, allowNull: true, field: "resource_type" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      status: { type: DataTypes.TEXT, allowNull: true },
      clusterId: { type: DataTypes.TEXT, allowNull: true, field: "cluster_id" },
      isClusterResource: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_cluster_resource" },
      allocatedStorageGb: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "allocated_storage_gb" },
      dataFootprintGb: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "data_footprint_gb" },
      storageUsedGb: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "storage_used_gb" },
      computeCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "compute_cost" },
      storageCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "storage_cost" },
      ioCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "io_cost" },
      backupCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "backup_cost" },
      dataTransferCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "data_transfer_cost" },
      taxCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "tax_cost" },
      creditAmount: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "credit_amount" },
      refundAmount: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "refund_amount" },
      totalBilledCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "total_billed_cost" },
      totalEffectiveCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "total_effective_cost" },
      totalListCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "total_list_cost" },
      currencyCode: { type: DataTypes.TEXT, allowNull: true, field: "currency_code" },
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
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "FactDbResourceDaily",
      tableName: "fact_db_resource_daily",
      timestamps: false,
      indexes: [
        { name: "uq_fact_db_resource_daily_resource_date", unique: true, fields: ["tenant_id", "cloud_connection_id", "resource_id", "usage_date"] },
        { name: "idx_fact_db_resource_daily_tenant_id", fields: ["tenant_id"] },
        { name: "idx_fact_db_resource_daily_cloud_connection_id", fields: ["cloud_connection_id"] },
        { name: "idx_fact_db_resource_daily_provider_id", fields: ["provider_id"] },
        { name: "idx_fact_db_resource_daily_resource_id", fields: ["resource_id"] },
        { name: "idx_fact_db_resource_daily_usage_date", fields: ["usage_date"] },
        { name: "idx_fact_db_resource_daily_db_service", fields: ["db_service"] },
        { name: "idx_fact_db_resource_daily_db_engine", fields: ["db_engine"] },
        { name: "idx_fact_db_resource_daily_region_key", fields: ["region_key"] },
        { name: "idx_fact_db_resource_daily_sub_account_key", fields: ["sub_account_key"] },
        { name: "idx_fact_db_resource_daily_resource_key", fields: ["resource_key"] },
        { name: "idx_fact_db_resource_daily_tenant_conn_date", fields: ["tenant_id", "cloud_connection_id", "usage_date"] },
        { name: "idx_fact_db_resource_daily_tenant_conn_service_date", fields: ["tenant_id", "cloud_connection_id", "db_service", "usage_date"] },
        { name: "idx_fact_db_resource_daily_tenant_conn_resource_date", fields: ["tenant_id", "cloud_connection_id", "resource_id", "usage_date"] },
      ],
    },
  );

  return FactDbResourceDaily;
};

export { FactDbResourceDaily };
export default createFactDbResourceDailyModel;
