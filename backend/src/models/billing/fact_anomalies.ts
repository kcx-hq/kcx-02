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
  declare anomalyType: CreationOptional<string | null>;
  declare baselineType: CreationOptional<string | null>;
  declare deltaPercent: CreationOptional<string | null>;
  declare currencyCode: CreationOptional<string | null>;
  declare confidenceScore: CreationOptional<string | null>;
  declare sourceGranularity: CreationOptional<string | null>;
  declare sourceTable: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<string | null>;
  declare explanationJson: CreationOptional<Record<string, unknown> | null>;
  declare metadataJson: CreationOptional<Record<string, unknown> | null>;
  declare firstSeenAt: CreationOptional<Date | null>;
  declare lastSeenAt: CreationOptional<Date | null>;
  declare resolvedAt: CreationOptional<Date | null>;
  declare ignoredReason: CreationOptional<string | null>;
  declare fingerprint: CreationOptional<string | null>;
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
      anomalyType: { type: DataTypes.STRING(50), allowNull: true, field: "anomaly_type" },
      baselineType: { type: DataTypes.STRING(50), allowNull: true, field: "baseline_type" },
      deltaPercent: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "delta_percent" },
      currencyCode: { type: DataTypes.STRING(10), allowNull: true, defaultValue: "USD", field: "currency_code" },
      confidenceScore: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: "confidence_score" },
      sourceGranularity: { type: DataTypes.STRING(20), allowNull: true, field: "source_granularity" },
      sourceTable: { type: DataTypes.STRING(100), allowNull: true, field: "source_table" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      explanationJson: { type: DataTypes.JSONB, allowNull: true, field: "explanation_json" },
      metadataJson: { type: DataTypes.JSONB, allowNull: true, field: "metadata_json" },
      firstSeenAt: { type: DataTypes.DATE, allowNull: true, field: "first_seen_at" },
      lastSeenAt: { type: DataTypes.DATE, allowNull: true, field: "last_seen_at" },
      resolvedAt: { type: DataTypes.DATE, allowNull: true, field: "resolved_at" },
      ignoredReason: { type: DataTypes.TEXT, allowNull: true, field: "ignored_reason" },
      fingerprint: { type: DataTypes.STRING(255), allowNull: true },
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
