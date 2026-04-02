import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class FactCostAllocations extends Model<
  InferAttributes<FactCostAllocations>,
  InferCreationAttributes<FactCostAllocations>
> {
  declare id: CreationOptional<string>;
  declare factId: string;
  declare tagKey: CreationOptional<string | null>;
  declare tagValue: CreationOptional<string | null>;
  declare allocatedCost: CreationOptional<string | null>;
  declare allocationType: CreationOptional<string | null>;
  declare allocationSource: CreationOptional<string | null>;
  declare usageDate: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createFactCostAllocationsModel = (sequelize: Sequelize): typeof FactCostAllocations => {
  FactCostAllocations.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      factId: { type: DataTypes.BIGINT, allowNull: false, field: "fact_id" },
      tagKey: { type: DataTypes.TEXT, allowNull: true, field: "tag_key" },
      tagValue: { type: DataTypes.TEXT, allowNull: true, field: "tag_value" },
      allocatedCost: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "allocated_cost" },
      allocationType: { type: DataTypes.TEXT, allowNull: true, field: "allocation_type" },
      allocationSource: { type: DataTypes.TEXT, allowNull: true, field: "allocation_source" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: true, field: "usage_date" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "FactCostAllocations",
      tableName: "fact_cost_allocations",
      timestamps: false,
    },
  );
  return FactCostAllocations;
};

export { FactCostAllocations };
export default createFactCostAllocationsModel;

