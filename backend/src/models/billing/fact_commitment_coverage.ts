import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class FactCommitmentCoverage extends Model<
  InferAttributes<FactCommitmentCoverage>,
  InferCreationAttributes<FactCommitmentCoverage>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: string;
  declare usageDate: string;
  declare serviceName: CreationOptional<string | null>;
  declare coveredCost: CreationOptional<string | null>;
  declare uncoveredCost: CreationOptional<string | null>;
  declare riCoveredCost: CreationOptional<string | null>;
  declare spCoveredCost: CreationOptional<string | null>;
  declare coveragePercent: CreationOptional<string | null>;
  declare utilizationPercent: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createFactCommitmentCoverageModel = (sequelize: Sequelize): typeof FactCommitmentCoverage => {
  FactCommitmentCoverage.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: false, field: "cloud_connection_id" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      serviceName: { type: DataTypes.TEXT, allowNull: true, field: "service_name" },
      coveredCost: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "covered_cost" },
      uncoveredCost: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "uncovered_cost" },
      riCoveredCost: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "ri_covered_cost" },
      spCoveredCost: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "sp_covered_cost" },
      coveragePercent: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: "coverage_percent" },
      utilizationPercent: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: "utilization_percent" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "FactCommitmentCoverage",
      tableName: "fact_commitment_coverage",
      timestamps: false,
    },
  );
  return FactCommitmentCoverage;
};

export { FactCommitmentCoverage };
export default createFactCommitmentCoverageModel;

