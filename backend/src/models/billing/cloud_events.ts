import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class CloudEvent extends Model<InferAttributes<CloudEvent>, InferCreationAttributes<CloudEvent>> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare cloudConnectionId: string;
  declare providerId: string;
  declare eventTime: Date;
  declare eventName: string;
  declare eventSource: CreationOptional<string | null>;
  declare eventCategory: CreationOptional<string | null>;
  declare awsAccountId: CreationOptional<string | null>;
  declare awsRegion: CreationOptional<string | null>;
  declare resourceId: CreationOptional<string | null>;
  declare resourceName: CreationOptional<string | null>;
  declare userArn: CreationOptional<string | null>;
  declare userType: CreationOptional<string | null>;
  declare requestId: CreationOptional<string | null>;
  declare metadataJson: CreationOptional<Record<string, unknown> | null>;
  declare rawPayload: CreationOptional<Record<string, unknown> | null>;
  declare processingStatus: CreationOptional<string | null>;
  declare processedAt: CreationOptional<Date | null>;
  declare processingError: CreationOptional<string | null>;
  declare eventFingerprint: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createCloudEventModel = (sequelize: Sequelize): typeof CloudEvent => {
  CloudEvent.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: false, field: "cloud_connection_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: false, field: "provider_id" },
      eventTime: { type: DataTypes.DATE, allowNull: false, field: "event_time" },
      eventName: { type: DataTypes.STRING(255), allowNull: false, field: "event_name" },
      eventSource: { type: DataTypes.STRING(255), allowNull: true, field: "event_source" },
      eventCategory: { type: DataTypes.STRING(100), allowNull: true, field: "event_category" },
      awsAccountId: { type: DataTypes.STRING(50), allowNull: true, field: "aws_account_id" },
      awsRegion: { type: DataTypes.STRING(50), allowNull: true, field: "aws_region" },
      resourceId: { type: DataTypes.TEXT, allowNull: true, field: "resource_id" },
      resourceName: { type: DataTypes.TEXT, allowNull: true, field: "resource_name" },
      userArn: { type: DataTypes.TEXT, allowNull: true, field: "user_arn" },
      userType: { type: DataTypes.STRING(100), allowNull: true, field: "user_type" },
      requestId: { type: DataTypes.STRING(255), allowNull: true, field: "request_id" },
      metadataJson: { type: DataTypes.JSONB, allowNull: true, field: "metadata_json" },
      rawPayload: { type: DataTypes.JSONB, allowNull: true, field: "raw_payload" },
      processingStatus: { type: DataTypes.STRING(20), allowNull: true, field: "processing_status" },
      processedAt: { type: DataTypes.DATE, allowNull: true, field: "processed_at" },
      processingError: { type: DataTypes.TEXT, allowNull: true, field: "processing_error" },
      eventFingerprint: { type: DataTypes.STRING(128), allowNull: true, field: "event_fingerprint" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "CloudEvent",
      tableName: "cloud_events",
      timestamps: false,
    },
  );

  return CloudEvent;
};

export { CloudEvent };
export default createCloudEventModel;
