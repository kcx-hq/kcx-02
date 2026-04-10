import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export const ANOMALY_DETECTION_RUN_TRIGGER_TYPES = ["ingestion", "manual", "system"] as const;
export const ANOMALY_DETECTION_RUN_MODES = ["incremental", "date_range", "full"] as const;
export const ANOMALY_DETECTION_RUN_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;

export type AnomalyDetectionRunTriggerType = (typeof ANOMALY_DETECTION_RUN_TRIGGER_TYPES)[number];
export type AnomalyDetectionRunMode = (typeof ANOMALY_DETECTION_RUN_MODES)[number];
export type AnomalyDetectionRunStatus = (typeof ANOMALY_DETECTION_RUN_STATUSES)[number];

class AnomalyDetectionRun extends Model<
  InferAttributes<AnomalyDetectionRun>,
  InferCreationAttributes<AnomalyDetectionRun>
> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare ingestionRunId: CreationOptional<string | null>;
  declare triggerType: AnomalyDetectionRunTriggerType | string;
  declare mode: AnomalyDetectionRunMode | string;
  declare status: CreationOptional<AnomalyDetectionRunStatus | string>;
  declare dateFrom: CreationOptional<string | null>;
  declare dateTo: CreationOptional<string | null>;
  declare includeHourly: CreationOptional<boolean>;
  declare forceRebuild: CreationOptional<boolean>;
  declare sourcesProcessed: CreationOptional<number>;
  declare anomaliesCreated: CreationOptional<number>;
  declare anomaliesUpdated: CreationOptional<number>;
  declare anomaliesResolved: CreationOptional<number>;
  declare errorMessage: CreationOptional<string | null>;
  declare statusMessage: CreationOptional<string | null>;
  declare startedAt: CreationOptional<Date | null>;
  declare finishedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare createdBy: CreationOptional<string | null>;
  declare metadataJson: CreationOptional<Record<string, unknown> | null>;
}

const createAnomalyDetectionRunModel = (sequelize: Sequelize): typeof AnomalyDetectionRun => {
  AnomalyDetectionRun.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      ingestionRunId: { type: DataTypes.BIGINT, allowNull: true, field: "ingestion_run_id" },
      triggerType: { type: DataTypes.STRING(30), allowNull: false, field: "trigger_type" },
      mode: { type: DataTypes.STRING(30), allowNull: false },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "queued" },
      dateFrom: { type: DataTypes.DATEONLY, allowNull: true, field: "date_from" },
      dateTo: { type: DataTypes.DATEONLY, allowNull: true, field: "date_to" },
      includeHourly: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "include_hourly" },
      forceRebuild: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "force_rebuild" },
      sourcesProcessed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "sources_processed" },
      anomaliesCreated: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "anomalies_created" },
      anomaliesUpdated: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "anomalies_updated" },
      anomaliesResolved: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "anomalies_resolved" },
      errorMessage: { type: DataTypes.TEXT, allowNull: true, field: "error_message" },
      statusMessage: { type: DataTypes.TEXT, allowNull: true, field: "status_message" },
      startedAt: { type: DataTypes.DATE, allowNull: true, field: "started_at" },
      finishedAt: { type: DataTypes.DATE, allowNull: true, field: "finished_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
      createdBy: { type: DataTypes.UUID, allowNull: true, field: "created_by" },
      metadataJson: { type: DataTypes.JSONB, allowNull: true, field: "metadata_json" },
    },
    {
      sequelize,
      modelName: "AnomalyDetectionRun",
      tableName: "anomaly_detection_runs",
      timestamps: false,
    },
  );
  return AnomalyDetectionRun;
};

export { AnomalyDetectionRun };
export default createAnomalyDetectionRunModel;
