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
  declare id: CreationOptional<string | number>;
  declare tenantId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<string | number | null>;
  declare awsAccountId: string;
  declare awsRegionCode: string;
  declare category: string;
  declare recommendationType: string;
  declare serviceKey: CreationOptional<string | number | null>;
  declare subAccountKey: CreationOptional<string | number | null>;
  declare regionKey: CreationOptional<string | number | null>;
  declare resourceId: string;
  declare resourceArn: CreationOptional<string | null>;
  declare resourceName: CreationOptional<string | null>;
  declare currentResourceType: CreationOptional<string | null>;
  declare recommendedResourceType: CreationOptional<string | null>;
  declare currentMonthlyCost: CreationOptional<string | number>;
  declare estimatedMonthlySavings: CreationOptional<string | number>;
  declare projectedMonthlyCost: CreationOptional<string | number>;
  declare performanceRiskScore: CreationOptional<string | number | null>;
  declare performanceRiskLevel: CreationOptional<string | null>;
  declare sourceSystem: CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare effortLevel: CreationOptional<string | null>;
  declare riskLevel: CreationOptional<string | null>;
  declare recommendationTitle: CreationOptional<string | null>;
  declare recommendationText: CreationOptional<string | null>;
  declare observationStart: CreationOptional<Date | null>;
  declare observationEnd: CreationOptional<Date | null>;
  declare rawPayloadJson: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createFactRecommendationsModel = (sequelize: Sequelize): typeof FactRecommendations => {
  FactRecommendations.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      awsAccountId: { type: DataTypes.STRING(50), allowNull: false, field: "aws_account_id" },
      awsRegionCode: { type: DataTypes.STRING(50), allowNull: false, field: "aws_region_code" },
      category: { type: DataTypes.STRING(50), allowNull: false },
      recommendationType: { type: DataTypes.STRING(100), allowNull: false, field: "recommendation_type" },
      serviceKey: { type: DataTypes.BIGINT, allowNull: true, field: "service_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      resourceId: { type: DataTypes.STRING(255), allowNull: false, field: "resource_id" },
      resourceArn: { type: DataTypes.TEXT, allowNull: true, field: "resource_arn" },
      resourceName: { type: DataTypes.STRING(255), allowNull: true, field: "resource_name" },
      currentResourceType: { type: DataTypes.STRING(100), allowNull: true, field: "current_resource_type" },
      recommendedResourceType: { type: DataTypes.STRING(100), allowNull: true, field: "recommended_resource_type" },
      currentMonthlyCost: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: "0", field: "current_monthly_cost" },
      estimatedMonthlySavings: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: "0", field: "estimated_monthly_savings" },
      projectedMonthlyCost: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: "0", field: "projected_monthly_cost" },
      performanceRiskScore: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "performance_risk_score" },
      performanceRiskLevel: { type: DataTypes.STRING(20), allowNull: true, field: "performance_risk_level" },
      sourceSystem: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "AWS_COMPUTE_OPTIMIZER", field: "source_system" },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "OPEN" },
      effortLevel: { type: DataTypes.STRING(20), allowNull: true, field: "effort_level" },
      riskLevel: { type: DataTypes.STRING(20), allowNull: true, field: "risk_level" },
      recommendationTitle: { type: DataTypes.STRING(255), allowNull: true, field: "recommendation_title" },
      recommendationText: { type: DataTypes.TEXT, allowNull: true, field: "recommendation_text" },
      observationStart: { type: DataTypes.DATE, allowNull: true, field: "observation_start" },
      observationEnd: { type: DataTypes.DATE, allowNull: true, field: "observation_end" },
      rawPayloadJson: { type: DataTypes.TEXT, allowNull: true, field: "raw_payload_json" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
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

