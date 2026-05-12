import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class S3PolicyActionLogs extends Model<
  InferAttributes<S3PolicyActionLogs>,
  InferCreationAttributes<S3PolicyActionLogs>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<number | null>;
  declare providerId: CreationOptional<number | null>;
  declare serviceName: CreationOptional<string>;
  declare policyType: CreationOptional<string>;
  declare accountId: CreationOptional<string | null>;
  declare region: CreationOptional<string | null>;
  declare bucketName: string;
  declare ruleName: CreationOptional<string | null>;
  declare scopeType: CreationOptional<string | null>;
  declare scopePrefix: CreationOptional<string | null>;
  declare status: string;
  declare errorMessage: CreationOptional<string | null>;
  declare requestPayloadJson: CreationOptional<Record<string, unknown> | null>;
  declare responsePayloadJson: CreationOptional<Record<string, unknown> | null>;
  declare createdByUserId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

const createS3PolicyActionLogsModel = (sequelize: Sequelize): typeof S3PolicyActionLogs => {
  S3PolicyActionLogs.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      serviceName: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "S3", field: "service_name" },
      policyType: { type: DataTypes.STRING(64), allowNull: false, defaultValue: "LIFECYCLE", field: "policy_type" },
      accountId: { type: DataTypes.STRING(20), allowNull: true, field: "account_id" },
      region: { type: DataTypes.STRING(64), allowNull: true, field: "region" },
      bucketName: { type: DataTypes.TEXT, allowNull: false, field: "bucket_name" },
      ruleName: { type: DataTypes.TEXT, allowNull: true, field: "rule_name" },
      scopeType: { type: DataTypes.STRING(32), allowNull: true, field: "scope_type" },
      scopePrefix: { type: DataTypes.TEXT, allowNull: true, field: "scope_prefix" },
      status: { type: DataTypes.STRING(32), allowNull: false, field: "status" },
      errorMessage: { type: DataTypes.TEXT, allowNull: true, field: "error_message" },
      requestPayloadJson: { type: DataTypes.JSONB, allowNull: true, field: "request_payload_json" },
      responsePayloadJson: { type: DataTypes.JSONB, allowNull: true, field: "response_payload_json" },
      createdByUserId: { type: DataTypes.UUID, allowNull: true, field: "created_by_user_id" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "S3PolicyActionLogs",
      tableName: "s3_policy_action_logs",
      timestamps: false,
      indexes: [
        { name: "idx_s3_policy_action_logs_tenant_created", fields: ["tenant_id", "created_at"] },
        { name: "idx_s3_policy_action_logs_bucket", fields: ["bucket_name"] },
      ],
    },
  );

  return S3PolicyActionLogs;
};

export { S3PolicyActionLogs };
export default createS3PolicyActionLogsModel;

