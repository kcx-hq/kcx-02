import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class DimDate extends Model<InferAttributes<DimDate>, InferCreationAttributes<DimDate>> {
  declare id: CreationOptional<string>;
  declare fullDate: string;
  declare dayOfMonth: number;
  declare monthOfYear: number;
  declare yearNumber: number;
  declare quarterNumber: number;
  declare monthName: string;
  declare dayName: string;
  declare createdAt: CreationOptional<Date>;
}

const createDimDateModel = (sequelize: Sequelize): typeof DimDate => {
  DimDate.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      fullDate: { type: DataTypes.DATEONLY, allowNull: false, unique: true, field: "full_date" },
      dayOfMonth: { type: DataTypes.INTEGER, allowNull: false, field: "day_of_month" },
      monthOfYear: { type: DataTypes.INTEGER, allowNull: false, field: "month_of_year" },
      yearNumber: { type: DataTypes.INTEGER, allowNull: false, field: "year_number" },
      quarterNumber: { type: DataTypes.INTEGER, allowNull: false, field: "quarter_number" },
      monthName: { type: DataTypes.STRING(20), allowNull: false, field: "month_name" },
      dayName: { type: DataTypes.STRING(20), allowNull: false, field: "day_name" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "DimDate",
      tableName: "dim_date",
      timestamps: false,
    },
  );
  return DimDate;
};

export { DimDate };
export default createDimDateModel;

