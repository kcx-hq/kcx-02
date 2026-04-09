import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class AnomalyContributor extends Model<InferAttributes<AnomalyContributor>, InferCreationAttributes<AnomalyContributor>> {
  declare id: CreationOptional<string>;
  declare anomalyId: string;
  declare dimensionType: string;
  declare dimensionKey: CreationOptional<string | null>;
  declare dimensionValue: CreationOptional<string | null>;
  declare contributionCost: CreationOptional<string | null>;
  declare contributionPercent: CreationOptional<string | null>;
  declare rank: CreationOptional<number | null>;
  declare createdAt: CreationOptional<Date>;
}

const createAnomalyContributorModel = (sequelize: Sequelize): typeof AnomalyContributor => {
  AnomalyContributor.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      anomalyId: { type: DataTypes.UUID, allowNull: false, field: "anomaly_id" },
      dimensionType: { type: DataTypes.STRING(50), allowNull: false, field: "dimension_type" },
      dimensionKey: { type: DataTypes.BIGINT, allowNull: true, field: "dimension_key" },
      dimensionValue: { type: DataTypes.TEXT, allowNull: true, field: "dimension_value" },
      contributionCost: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "contribution_cost" },
      contributionPercent: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "contribution_percent" },
      rank: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "AnomalyContributor",
      tableName: "anomaly_contributors",
      timestamps: false,
    },
  );

  return AnomalyContributor;
};

export { AnomalyContributor };
export default createAnomalyContributorModel;
