import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class StorageLensIngestionRun extends Model<
  InferAttributes<StorageLensIngestionRun>,
  InferCreationAttributes<StorageLensIngestionRun>
> {
  declare id: CreationOptional<string>;
  declare billingSourceId: string;
  declare status: CreationOptional<string>;
  declare currentStep: CreationOptional<string | null>;
  declare progressPercent: CreationOptional<number>;
  declare statusMessage: CreationOptional<string | null>;
  declare filesDiscovered: CreationOptional<number>;
  declare filesProcessed: CreationOptional<number>;
  declare rowsRead: CreationOptional<number>;
  declare rowsLoaded: CreationOptional<number>;
  declare rowsFailed: CreationOptional<number>;
  declare totalRowsEstimated: CreationOptional<number | null>;
  declare errorMessage: CreationOptional<string | null>;
  declare startedAt: CreationOptional<Date | null>;
  declare finishedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createStorageLensIngestionRunModel = (sequelize: Sequelize): typeof StorageLensIngestionRun => {
  StorageLensIngestionRun.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: false, field: "billing_source_id" },
      status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "queued" },
      currentStep: { type: DataTypes.STRING(100), allowNull: true, field: "current_step" },
      progressPercent: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "progress_percent" },
      statusMessage: { type: DataTypes.TEXT, allowNull: true, field: "status_message" },
      filesDiscovered: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "files_discovered" },
      filesProcessed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "files_processed" },
      rowsRead: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rows_read" },
      rowsLoaded: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rows_loaded" },
      rowsFailed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "rows_failed" },
      totalRowsEstimated: { type: DataTypes.INTEGER, allowNull: true, field: "total_rows_estimated" },
      errorMessage: { type: DataTypes.TEXT, allowNull: true, field: "error_message" },
      startedAt: { type: DataTypes.DATE, allowNull: true, field: "started_at" },
      finishedAt: { type: DataTypes.DATE, allowNull: true, field: "finished_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "StorageLensIngestionRun",
      tableName: "storage_lens_ingestion_runs",
      timestamps: false,
    },
  );
  return StorageLensIngestionRun;
};

export { StorageLensIngestionRun };
export default createStorageLensIngestionRunModel;

