import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class S3CostDaily extends Model<
  InferAttributes<S3CostDaily>,
  InferCreationAttributes<S3CostDaily>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<number | null>;
  declare providerId: CreationOptional<number | null>;
  declare subAccountKey: CreationOptional<number | null>;
  declare regionKey: CreationOptional<number | null>;
  declare accountId: CreationOptional<string | null>;
  declare region: CreationOptional<string | null>;
  declare bucketName: CreationOptional<string | null>;
  declare usageDate: string;
  declare costCategory: string;
  declare storageClass: string;
  declare usageType: string;
  declare operation: string;
  declare productFamily: string;
  declare pricingUnit: CreationOptional<string>;
  declare totalCost: CreationOptional<string>;
  declare usageQuantity: CreationOptional<string>;
  declare currencyCode: CreationOptional<string>;
  declare lineItemCount: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createS3CostDailyModel = (sequelize: Sequelize): typeof S3CostDaily => {
  S3CostDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      accountId: { type: DataTypes.STRING(20), allowNull: true, field: "account_id" },
      region: { type: DataTypes.STRING(64), allowNull: true, field: "region" },
      bucketName: { type: DataTypes.TEXT, allowNull: true, field: "bucket_name" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      costCategory: { type: DataTypes.STRING(32), allowNull: false, field: "cost_category" },
      storageClass: { type: DataTypes.STRING(64), allowNull: false, field: "storage_class" },
      usageType: { type: DataTypes.TEXT, allowNull: false, field: "usage_type" },
      operation: { type: DataTypes.TEXT, allowNull: false, field: "operation" },
      productFamily: { type: DataTypes.TEXT, allowNull: false, field: "product_family" },
      pricingUnit: { type: DataTypes.STRING(64), allowNull: false, defaultValue: "Units", field: "pricing_unit" },
      totalCost: { type: DataTypes.DECIMAL(20, 12), allowNull: false, defaultValue: 0, field: "total_cost" },
      usageQuantity: { type: DataTypes.DECIMAL(24, 8), allowNull: false, defaultValue: 0, field: "usage_quantity" },
      currencyCode: { type: DataTypes.STRING(12), allowNull: false, defaultValue: "USD", field: "currency_code" },
      lineItemCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "line_item_count" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "S3CostDaily",
      tableName: "s3_cost_daily",
      timestamps: false,
      indexes: [
        {
          name: "uq_s3_cost_daily_row",
          unique: true,
          fields: [
            "tenant_id",
            "cloud_connection_id",
            "billing_source_id",
            "provider_id",
            "sub_account_key",
            "region_key",
            "account_id",
            "region",
            "bucket_name",
            "usage_date",
            "cost_category",
            "storage_class",
            "usage_type",
            "operation",
            "product_family",
            "pricing_unit",
            "currency_code",
          ],
        },
        { name: "idx_s3_cost_daily_tenant_id", fields: ["tenant_id"] },
        { name: "idx_s3_cost_daily_cloud_connection_id", fields: ["cloud_connection_id"] },
        { name: "idx_s3_cost_daily_account_id", fields: ["account_id"] },
        { name: "idx_s3_cost_daily_region", fields: ["region"] },
        { name: "idx_s3_cost_daily_bucket_name", fields: ["bucket_name"] },
        { name: "idx_s3_cost_daily_usage_date", fields: ["usage_date"] },
        { name: "idx_s3_cost_daily_cost_category", fields: ["cost_category"] },
      ],
    },
  );

  return S3CostDaily;
};

export { S3CostDaily };
export default createS3CostDailyModel;

