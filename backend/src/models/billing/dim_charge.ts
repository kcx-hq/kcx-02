import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class DimCharge extends Model<InferAttributes<DimCharge>, InferCreationAttributes<DimCharge>> {
  declare id: CreationOptional<string>;
  declare chargeCategory: CreationOptional<string | null>;
  declare chargeClass: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createDimChargeModel = (sequelize: Sequelize): typeof DimCharge => {
  DimCharge.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      chargeCategory: { type: DataTypes.STRING(100), allowNull: true, field: "charge_category" },
      chargeClass: { type: DataTypes.STRING(100), allowNull: true, field: "charge_class" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "DimCharge",
      tableName: "dim_charge",
      timestamps: false,
    },
  );
  return DimCharge;
};

export { DimCharge };
export default createDimChargeModel;

