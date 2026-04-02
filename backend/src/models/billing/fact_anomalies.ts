import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class FactAnomalies extends Model<InferAttributes<FactAnomalies>, InferCreationAttributes<FactAnomalies>> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: string;
  declare detectedAt: Date;
  declare usageDate: string;
  declare anomalyScope: CreationOptional<string | null>;
  declare serviceKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare resourceKey: CreationOptional<string | null>;
  declare expectedCost: CreationOptional<string | null>;
  declare actualCost: CreationOptional<string | null>;
  declare deltaCost: CreationOptional<string | null>;
  declare severity: CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare rootCauseHint: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createFactAnomaliesModel = (sequelize: Sequelize): typeof FactAnomalies => {
  FactAnomalies.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: false, field: "cloud_connection_id" },
      detectedAt: { type: DataTypes.DATE, allowNull: false, field: "detected_at" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      anomalyScope: { type: DataTypes.TEXT, allowNull: true, field: "anomaly_scope" },
      serviceKey: { type: DataTypes.BIGINT, allowNull: true, field: "service_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      expectedCost: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "expected_cost" },
      actualCost: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "actual_cost" },
      deltaCost: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "delta_cost" },
      severity: { type: DataTypes.TEXT, allowNull: false, defaultValue: "medium" },
      status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "open" },
      rootCauseHint: { type: DataTypes.TEXT, allowNull: true, field: "root_cause_hint" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "FactAnomalies",
      tableName: "fact_anomalies",
      timestamps: false,
    },
  );
  return FactAnomalies;
};

export { FactAnomalies };
export default createFactAnomaliesModel;

