import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class BillingIngestionRun extends Model<
  InferAttributes<BillingIngestionRun>,
  InferCreationAttributes<BillingIngestionRun>
> {
  declare id: CreationOptional<string>;
  declare billingSourceId: string;
  declare rawBillingFileId: string;
  declare status: CreationOptional<string>;
  declare currentStep: CreationOptional<string | null>;
  declare progressPercent: CreationOptional<number>;
  declare statusMessage: CreationOptional<string | null>;
  declare rowsRead: CreationOptional<number>;
  declare rowsLoaded: CreationOptional<number>;
  declare rowsFailed: CreationOptional<number>;
  declare totalRowsEstimated: CreationOptional<number | null>;
  declare lastHeartbeatAt: CreationOptional<Date | null>;
  declare errorMessage: CreationOptional<string | null>;
  declare startedAt: CreationOptional<Date | null>;
  declare finishedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createBillingIngestionRunModel = (sequelize: Sequelize): typeof BillingIngestionRun => {
  BillingIngestionRun.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: false, field: "billing_source_id" },
      rawBillingFileId: { type: DataTypes.BIGINT, allowNull: false, field: "raw_billing_file_id" },
      status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "queued" },
      currentStep: { type: DataTypes.STRING(100), allowNull: true, field: "current_step" },
      progressPercent: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "progress_percent" },
      statusMessage: { type: DataTypes.TEXT, allowNull: true, field: "status_message" },
      rowsRead: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rows_read" },
      rowsLoaded: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rows_loaded" },
      rowsFailed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rows_failed" },
      totalRowsEstimated: { type: DataTypes.INTEGER, allowNull: true, field: "total_rows_estimated" },
      lastHeartbeatAt: { type: DataTypes.DATE, allowNull: true, field: "last_heartbeat_at" },
      errorMessage: { type: DataTypes.TEXT, allowNull: true, field: "error_message" },
      startedAt: { type: DataTypes.DATE, allowNull: true, field: "started_at" },
      finishedAt: { type: DataTypes.DATE, allowNull: true, field: "finished_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "BillingIngestionRun",
      tableName: "billing_ingestion_runs",
      timestamps: false,
    },
  );
  return BillingIngestionRun;
};

export { BillingIngestionRun };
export default createBillingIngestionRunModel;
