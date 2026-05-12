import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class DimTag extends Model<InferAttributes<DimTag>, InferCreationAttributes<DimTag>> {
  declare id: CreationOptional<string>;
  declare providerId: string;
  declare tenantId: string;
  declare tagKey: string;
  declare tagValue: string;
  declare normalizedKey: string;
  declare normalizedValue: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createDimTagModel = (sequelize: Sequelize): typeof DimTag => {
  DimTag.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      providerId: { type: DataTypes.BIGINT, allowNull: false, field: "provider_id" },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      tagKey: { type: DataTypes.STRING(100), allowNull: false, field: "tag_key" },
      tagValue: { type: DataTypes.STRING(255), allowNull: false, field: "tag_value" },
      normalizedKey: { type: DataTypes.STRING(100), allowNull: false, field: "normalized_key" },
      normalizedValue: { type: DataTypes.STRING(255), allowNull: false, field: "normalized_value" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "DimTag",
      tableName: "dim_tag",
      timestamps: false,
      indexes: [
        {
          name: "uq_dim_tag_tenant_provider_key_value",
          unique: true,
          fields: ["tenant_id", "provider_id", "normalized_key", "normalized_value"],
        },
        { name: "idx_dim_tag_tenant_provider", fields: ["tenant_id", "provider_id"] },
      ],
    },
  );
  return DimTag;
};

export { DimTag };
export default createDimTagModel;

