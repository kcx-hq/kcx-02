import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class ScheduledJob extends Model<InferAttributes<ScheduledJob>, InferCreationAttributes<ScheduledJob>> {
  declare id: CreationOptional<string>;
  declare jobType: string;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare scheduleType: CreationOptional<string>;
  declare cronExpression: CreationOptional<string | null>;
  declare intervalMinutes: CreationOptional<number | null>;
  declare isEnabled: CreationOptional<boolean>;
  declare lookbackHours: CreationOptional<number | null>;
  declare configJson: CreationOptional<Record<string, unknown> | null>;
  declare nextRunAt: CreationOptional<Date | null>;
  declare lastRunAt: CreationOptional<Date | null>;
  declare lastSuccessAt: CreationOptional<Date | null>;
  declare lastFailureAt: CreationOptional<Date | null>;
  declare lastStatus: CreationOptional<string | null>;
  declare lastErrorMessage: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createScheduledJobModel = (sequelize: Sequelize): typeof ScheduledJob => {
  ScheduledJob.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      jobType: { type: DataTypes.STRING(100), allowNull: false, field: "job_type" },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      scheduleType: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "interval", field: "schedule_type" },
      cronExpression: { type: DataTypes.STRING(100), allowNull: true, field: "cron_expression" },
      intervalMinutes: { type: DataTypes.INTEGER, allowNull: true, field: "interval_minutes" },
      isEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_enabled" },
      lookbackHours: { type: DataTypes.INTEGER, allowNull: true, field: "lookback_hours" },
      configJson: { type: DataTypes.JSONB, allowNull: true, field: "config_json" },
      nextRunAt: { type: DataTypes.DATE, allowNull: true, field: "next_run_at" },
      lastRunAt: { type: DataTypes.DATE, allowNull: true, field: "last_run_at" },
      lastSuccessAt: { type: DataTypes.DATE, allowNull: true, field: "last_success_at" },
      lastFailureAt: { type: DataTypes.DATE, allowNull: true, field: "last_failure_at" },
      lastStatus: { type: DataTypes.STRING(30), allowNull: true, field: "last_status" },
      lastErrorMessage: { type: DataTypes.TEXT, allowNull: true, field: "last_error_message" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "ScheduledJob",
      tableName: "scheduled_jobs",
      timestamps: false,
    },
  );

  return ScheduledJob;
};

export { ScheduledJob };
export default createScheduledJobModel;
