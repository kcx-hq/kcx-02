import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class FactCostLineItemTags extends Model<
  InferAttributes<FactCostLineItemTags>,
  InferCreationAttributes<FactCostLineItemTags>
> {
  declare factId: string;
  declare tagId: string;
  declare tenantId: string;
  declare providerId: string;
  declare createdAt: CreationOptional<Date>;
}

const createFactCostLineItemTagsModel = (sequelize: Sequelize): typeof FactCostLineItemTags => {
  FactCostLineItemTags.init(
    {
      factId: { type: DataTypes.BIGINT, allowNull: false, field: "fact_id", primaryKey: true },
      tagId: { type: DataTypes.BIGINT, allowNull: false, field: "tag_id", primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: false, field: "provider_id" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "FactCostLineItemTags",
      tableName: "fact_cost_line_item_tags",
      timestamps: false,
      indexes: [
        { name: "pk_fact_cost_line_item_tags", unique: true, fields: ["fact_id", "tag_id"] },
        { name: "idx_fact_cost_line_item_tags_tag_id", fields: ["tag_id"] },
        { name: "idx_fact_cost_line_item_tags_tenant_provider", fields: ["tenant_id", "provider_id"] },
      ],
    },
  );
  return FactCostLineItemTags;
};

export { FactCostLineItemTags };
export default createFactCostLineItemTagsModel;

