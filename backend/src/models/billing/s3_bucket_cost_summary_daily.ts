import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class S3BucketCostSummaryDaily extends Model<
  InferAttributes<S3BucketCostSummaryDaily>,
  InferCreationAttributes<S3BucketCostSummaryDaily>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<number | null>;
  declare providerId: CreationOptional<number | null>;
  declare accountId: CreationOptional<string | null>;
  declare bucketName: string;
  declare snapshotDate: string;
  declare lastSeenUsageDate: CreationOptional<string | null>;
  declare mtdBucketCost: CreationOptional<string | null>;
  declare last30dBucketCost: CreationOptional<string | null>;
  declare requestCost30d: CreationOptional<string | null>;
  declare storageCost30d: CreationOptional<string | null>;
  declare transferCost30d: CreationOptional<string | null>;
  declare activeDays30d: CreationOptional<number | null>;
  declare topOperationsJson: CreationOptional<Record<string, unknown> | null>;
  declare regionsSeenJson: CreationOptional<Record<string, unknown> | null>;
  declare createdAt: CreationOptional<Date>;
}

const createS3BucketCostSummaryDailyModel = (sequelize: Sequelize): typeof S3BucketCostSummaryDaily => {
  S3BucketCostSummaryDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      accountId: { type: DataTypes.STRING(20), allowNull: true, field: "account_id" },
      bucketName: { type: DataTypes.TEXT, allowNull: false, field: "bucket_name" },
      snapshotDate: { type: DataTypes.DATEONLY, allowNull: false, field: "snapshot_date" },
      lastSeenUsageDate: { type: DataTypes.DATEONLY, allowNull: true, field: "last_seen_usage_date" },
      mtdBucketCost: { type: DataTypes.DECIMAL(20, 12), allowNull: true, field: "mtd_bucket_cost" },
      last30dBucketCost: { type: DataTypes.DECIMAL(20, 12), allowNull: true, field: "last_30d_bucket_cost" },
      requestCost30d: { type: DataTypes.DECIMAL(20, 12), allowNull: true, field: "request_cost_30d" },
      storageCost30d: { type: DataTypes.DECIMAL(20, 12), allowNull: true, field: "storage_cost_30d" },
      transferCost30d: { type: DataTypes.DECIMAL(20, 12), allowNull: true, field: "transfer_cost_30d" },
      activeDays30d: { type: DataTypes.INTEGER, allowNull: true, field: "active_days_30d" },
      topOperationsJson: { type: DataTypes.JSONB, allowNull: true, field: "top_operations_json" },
      regionsSeenJson: { type: DataTypes.JSONB, allowNull: true, field: "regions_seen_json" },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at", defaultValue: sequelize.literal("NOW()") },
    },
    {
      sequelize,
      modelName: "S3BucketCostSummaryDaily",
      tableName: "s3_bucket_cost_summary_daily",
      timestamps: false,
    },
  );
  return S3BucketCostSummaryDaily;
};

export { S3BucketCostSummaryDaily };
export default createS3BucketCostSummaryDailyModel;

