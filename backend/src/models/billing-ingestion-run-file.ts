import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class BillingIngestionRunFile extends Model<
  InferAttributes<BillingIngestionRunFile>,
  InferCreationAttributes<BillingIngestionRunFile>
> {
  declare id: CreationOptional<string>;
  declare ingestionRunId: string;
  declare rawBillingFileId: string;
  declare fileRole: CreationOptional<string>;
  declare processingOrder: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
}

const createBillingIngestionRunFileModel = (sequelize: Sequelize): typeof BillingIngestionRunFile => {
  BillingIngestionRunFile.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      ingestionRunId: { type: DataTypes.BIGINT, allowNull: false, field: "ingestion_run_id" },
      rawBillingFileId: { type: DataTypes.BIGINT, allowNull: false, field: "raw_billing_file_id" },
      fileRole: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "data", field: "file_role" },
      processingOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "processing_order" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "BillingIngestionRunFile",
      tableName: "billing_ingestion_run_files",
      timestamps: false,
    },
  );

  return BillingIngestionRunFile;
};

export { BillingIngestionRunFile };
export default createBillingIngestionRunFileModel;
