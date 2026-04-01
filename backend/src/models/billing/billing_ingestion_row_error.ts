import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class BillingIngestionRowError extends Model<
  InferAttributes<BillingIngestionRowError>,
  InferCreationAttributes<BillingIngestionRowError>
> {
  declare id: CreationOptional<string>;
  declare ingestionRunId: string;
  declare rawBillingFileId: CreationOptional<string | null>;
  declare rowNumber: CreationOptional<number | null>;
  declare errorCode: CreationOptional<string | null>;
  declare errorMessage: string;
  declare rawRowJson: CreationOptional<Record<string, unknown> | null>;
  declare createdAt: CreationOptional<Date>;
}

const createBillingIngestionRowErrorModel = (sequelize: Sequelize): typeof BillingIngestionRowError => {
  BillingIngestionRowError.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      ingestionRunId: { type: DataTypes.BIGINT, allowNull: false, field: "ingestion_run_id" },
      rawBillingFileId: { type: DataTypes.BIGINT, allowNull: true, field: "raw_billing_file_id" },
      rowNumber: { type: DataTypes.INTEGER, allowNull: true, field: "row_number" },
      errorCode: { type: DataTypes.STRING(100), allowNull: true, field: "error_code" },
      errorMessage: { type: DataTypes.TEXT, allowNull: false, field: "error_message" },
      rawRowJson: { type: DataTypes.JSONB, allowNull: true, field: "raw_row_json" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "BillingIngestionRowError",
      tableName: "billing_ingestion_row_errors",
      timestamps: false,
    },
  );
  return BillingIngestionRowError;
};

export { BillingIngestionRowError };
export default createBillingIngestionRowErrorModel;
