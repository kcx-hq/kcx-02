import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class DimRegion extends Model<InferAttributes<DimRegion>, InferCreationAttributes<DimRegion>> {
  declare id: CreationOptional<string>;
  declare providerId: string;
  declare regionId: CreationOptional<string | null>;
  declare regionName: string;
  declare availabilityZone: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createDimRegionModel = (sequelize: Sequelize): typeof DimRegion => {
  DimRegion.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      providerId: { type: DataTypes.BIGINT, allowNull: false, field: "provider_id" },
      regionId: { type: DataTypes.STRING(100), allowNull: true, field: "region_id" },
      regionName: { type: DataTypes.STRING(100), allowNull: false, field: "region_name" },
      availabilityZone: { type: DataTypes.STRING(100), allowNull: true, field: "availability_zone" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "DimRegion",
      tableName: "dim_region",
      timestamps: false,
      indexes: [
        { name: "uq_dim_region_provider_region_zone", unique: true, fields: ["provider_id", "region_id", "region_name", "availability_zone"] },
        { name: "idx_dim_region_provider_id", fields: ["provider_id"] },
      ],
    },
  );
  return DimRegion;
};

export { DimRegion };
export default createDimRegionModel;

