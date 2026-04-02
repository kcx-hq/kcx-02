import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class DimResource extends Model<InferAttributes<DimResource>, InferCreationAttributes<DimResource>> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare providerId: string;
  declare resourceId: string;
  declare resourceName: CreationOptional<string | null>;
  declare resourceType: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createDimResourceModel = (sequelize: Sequelize): typeof DimResource => {
  DimResource.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: false, field: "provider_id" },
      resourceId: { type: DataTypes.STRING(255), allowNull: false, field: "resource_id" },
      resourceName: { type: DataTypes.STRING(255), allowNull: true, field: "resource_name" },
      resourceType: { type: DataTypes.STRING(100), allowNull: true, field: "resource_type" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "DimResource",
      tableName: "dim_resource",
      timestamps: false,
      indexes: [
        { name: "uq_dim_resource_tenant_provider_resource_id", unique: true, fields: ["tenant_id", "provider_id", "resource_id"] },
        { name: "idx_dim_resource_tenant_provider", fields: ["tenant_id", "provider_id"] },
      ],
    },
  );
  return DimResource;
};

export { DimResource };
export default createDimResourceModel;

