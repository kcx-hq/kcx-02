import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class DimService extends Model<InferAttributes<DimService>, InferCreationAttributes<DimService>> {
  declare id: CreationOptional<string>;
  declare providerId: string;
  declare serviceName: string;
  declare serviceCategory: CreationOptional<string | null>;
  declare serviceSubcategory: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createDimServiceModel = (sequelize: Sequelize): typeof DimService => {
  DimService.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      providerId: { type: DataTypes.BIGINT, allowNull: false, field: "provider_id" },
      serviceName: { type: DataTypes.STRING(255), allowNull: false, field: "service_name" },
      serviceCategory: { type: DataTypes.STRING(255), allowNull: true, field: "service_category" },
      serviceSubcategory: { type: DataTypes.STRING(255), allowNull: true, field: "service_subcategory" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "DimService",
      tableName: "dim_service",
      timestamps: false,
      indexes: [
        { name: "uq_dim_service_provider_name_category_subcategory", unique: true, fields: ["provider_id", "service_name", "service_category", "service_subcategory"] },
        { name: "idx_dim_service_provider_id", fields: ["provider_id"] },
      ],
    },
  );
  return DimService;
};

export { DimService };
export default createDimServiceModel;

