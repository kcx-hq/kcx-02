import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class DimSku extends Model<InferAttributes<DimSku>, InferCreationAttributes<DimSku>> {
  declare id: CreationOptional<string>;
  declare providerId: string;
  declare skuId: CreationOptional<string | null>;
  declare skuPriceId: CreationOptional<string | null>;
  declare pricingCategory: CreationOptional<string | null>;
  declare pricingUnit: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createDimSkuModel = (sequelize: Sequelize): typeof DimSku => {
  DimSku.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      providerId: { type: DataTypes.BIGINT, allowNull: false, field: "provider_id" },
      skuId: { type: DataTypes.STRING(255), allowNull: true, field: "sku_id" },
      skuPriceId: { type: DataTypes.STRING(255), allowNull: true, field: "sku_price_id" },
      pricingCategory: { type: DataTypes.STRING(100), allowNull: true, field: "pricing_category" },
      pricingUnit: { type: DataTypes.STRING(100), allowNull: true, field: "pricing_unit" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "DimSku",
      tableName: "dim_sku",
      timestamps: false,
    },
  );
  return DimSku;
};

export { DimSku };
export default createDimSkuModel;

