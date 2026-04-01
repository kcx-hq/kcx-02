import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class FactRecommendations extends Model<
  InferAttributes<FactRecommendations>,
  InferCreationAttributes<FactRecommendations>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: string;
  declare recommendationType: CreationOptional<string | null>;
  declare resourceId: CreationOptional<string | null>;
  declare serviceName: CreationOptional<string | null>;
  declare potentialMonthlySavings: CreationOptional<string | null>;
  declare riskLevel: CreationOptional<string | null>;
  declare confidenceScore: CreationOptional<string | null>;
  declare status: CreationOptional<string>;
  declare reason: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare closedAt: CreationOptional<Date | null>;
}

const createFactRecommendationsModel = (sequelize: Sequelize): typeof FactRecommendations => {
  FactRecommendations.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: false, field: "cloud_connection_id" },
      recommendationType: { type: DataTypes.TEXT, allowNull: true, field: "recommendation_type" },
      resourceId: { type: DataTypes.TEXT, allowNull: true, field: "resource_id" },
      serviceName: { type: DataTypes.TEXT, allowNull: true, field: "service_name" },
      potentialMonthlySavings: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "potential_monthly_savings" },
      riskLevel: { type: DataTypes.TEXT, allowNull: true, field: "risk_level" },
      confidenceScore: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: "confidence_score" },
      status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "open" },
      reason: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      closedAt: { type: DataTypes.DATE, allowNull: true, field: "closed_at" },
    },
    {
      sequelize,
      modelName: "FactRecommendations",
      tableName: "fact_recommendations",
      timestamps: false,
    },
  );
  return FactRecommendations;
};

export { FactRecommendations };
export default createFactRecommendationsModel;

