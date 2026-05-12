import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

type DbCostCategory = "compute" | "storage" | "io" | "backup" | "data_transfer" | "tax" | "credit" | "refund" | "other";

class DbCostHistoryDaily extends Model<
  InferAttributes<DbCostHistoryDaily>,
  InferCreationAttributes<DbCostHistoryDaily>
> {
  declare usageDate: string;
  declare monthStart: string;
  declare tenantId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare serviceKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare resourceKey: CreationOptional<string | null>;
  declare resourceId: string;
  declare dbService: string;
  declare dbEngine: CreationOptional<string | null>;
  declare costCategory: CreationOptional<DbCostCategory>;
  declare billedCost: CreationOptional<string>;
  declare effectiveCost: CreationOptional<string>;
  declare listCost: CreationOptional<string>;
  declare usageQuantity: CreationOptional<string | null>;
  declare currencyCode: CreationOptional<string | null>;
  declare ingestionRunId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createDbCostHistoryDailyModel = (sequelize: Sequelize): typeof DbCostHistoryDaily => {
  DbCostHistoryDaily.init(
    {
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      monthStart: { type: DataTypes.DATEONLY, allowNull: false, field: "month_start" },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      serviceKey: { type: DataTypes.BIGINT, allowNull: true, field: "service_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      resourceId: { type: DataTypes.TEXT, allowNull: false, field: "resource_id" },
      dbService: { type: DataTypes.TEXT, allowNull: false, field: "db_service" },
      dbEngine: { type: DataTypes.TEXT, allowNull: true, field: "db_engine" },
      costCategory: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "other",
        field: "cost_category",
        validate: {
          isIn: [["compute", "storage", "io", "backup", "data_transfer", "tax", "credit", "refund", "other"]],
        },
      },
      billedCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "billed_cost" },
      effectiveCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "effective_cost" },
      listCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "list_cost" },
      usageQuantity: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "usage_quantity" },
      currencyCode: { type: DataTypes.TEXT, allowNull: true, field: "currency_code" },
      ingestionRunId: { type: DataTypes.BIGINT, allowNull: true, field: "ingestion_run_id" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "DbCostHistoryDaily",
      tableName: "db_cost_history_daily",
      timestamps: false,
      indexes: [
        { name: "uq_db_cost_history_daily_resource_day_category", unique: true, fields: ["tenant_id", "cloud_connection_id", "resource_id", "usage_date", "cost_category"] },
        { name: "idx_db_cost_history_daily_tenant_id", fields: ["tenant_id"] },
        { name: "idx_db_cost_history_daily_cloud_connection_id", fields: ["cloud_connection_id"] },
        { name: "idx_db_cost_history_daily_billing_source_id", fields: ["billing_source_id"] },
        { name: "idx_db_cost_history_daily_provider_id", fields: ["provider_id"] },
        { name: "idx_db_cost_history_daily_usage_date", fields: ["usage_date"] },
        { name: "idx_db_cost_history_daily_service_key", fields: ["service_key"] },
        { name: "idx_db_cost_history_daily_region_key", fields: ["region_key"] },
        { name: "idx_db_cost_history_daily_sub_account_key", fields: ["sub_account_key"] },
        { name: "idx_db_cost_history_daily_resource_key", fields: ["resource_key"] },
        { name: "idx_db_cost_history_daily_db_service", fields: ["db_service"] },
        { name: "idx_db_cost_history_daily_db_engine", fields: ["db_engine"] },
        { name: "idx_db_cost_history_daily_cost_category", fields: ["cost_category"] },
        { name: "idx_db_cost_history_daily_tenant_conn_date", fields: ["tenant_id", "cloud_connection_id", "usage_date"] },
        { name: "idx_db_cost_history_daily_tenant_conn_service_date", fields: ["tenant_id", "cloud_connection_id", "db_service", "usage_date"] },
        { name: "idx_db_cost_history_daily_tenant_conn_service_category_date", fields: ["tenant_id", "cloud_connection_id", "db_service", "cost_category", "usage_date"] },
        { name: "idx_db_cost_history_daily_tenant_conn_resource_date", fields: ["tenant_id", "cloud_connection_id", "resource_id", "usage_date"] },
      ],
    },
  );

  DbCostHistoryDaily.removeAttribute("id");

  return DbCostHistoryDaily;
};

export { DbCostHistoryDaily };
export default createDbCostHistoryDailyModel;
