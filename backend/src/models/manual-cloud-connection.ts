import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class ManualCloudConnection extends Model<
  InferAttributes<ManualCloudConnection>,
  InferCreationAttributes<ManualCloudConnection>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare createdBy: CreationOptional<string | null>;
  declare connectionName: string;
  declare awsAccountId: string;
  declare awsRegion: CreationOptional<string | null>;
  declare externalId: string;
  declare kcxPrincipalArn: CreationOptional<string | null>;
  declare fileEventCallbackUrl: CreationOptional<string | null>;
  declare callbackToken: CreationOptional<string | null>;
  declare billingRoleName: CreationOptional<string | null>;
  declare billingRoleArn: CreationOptional<string | null>;
  declare bucketName: string;
  declare exportBucketName: CreationOptional<string | null>;
  declare prefix: CreationOptional<string | null>;
  declare exportPrefix: CreationOptional<string | null>;
  declare reportName: CreationOptional<string | null>;
  declare exportName: CreationOptional<string | null>;
  declare exportArn: CreationOptional<string | null>;
  declare actionRoleEnabled: CreationOptional<boolean>;
  declare actionRoleName: CreationOptional<string | null>;
  declare actionRoleArn: CreationOptional<string | null>;
  declare ec2ModuleEnabled: CreationOptional<boolean>;
  declare useTagScopedAccess: CreationOptional<boolean>;
  declare billingFileEventLambdaArn: CreationOptional<string | null>;
  declare billingEventbridgeRuleName: CreationOptional<string | null>;
  declare billingFileEventStatus: CreationOptional<string | null>;
  declare billingFileEventValidatedAt: CreationOptional<Date | null>;
  declare cloudtrailEnabled: CreationOptional<boolean>;
  declare cloudtrailBucketName: CreationOptional<string | null>;
  declare cloudtrailPrefix: CreationOptional<string | null>;
  declare cloudtrailTrailName: CreationOptional<string | null>;
  declare cloudtrailLambdaArn: CreationOptional<string | null>;
  declare cloudtrailEventbridgeRuleName: CreationOptional<string | null>;
  declare cloudtrailStatus: CreationOptional<string | null>;
  declare cloudtrailValidatedAt: CreationOptional<Date | null>;
  declare setupStep: CreationOptional<number>;
  declare isComplete: CreationOptional<boolean>;
  declare completedAt: CreationOptional<Date | null>;
  declare completedBy: CreationOptional<string | null>;
  declare setupPayloadJson: CreationOptional<Record<string, unknown> | null>;
  declare lastValidatedAt: CreationOptional<Date | null>;
  declare validationStatus: CreationOptional<string>;
  declare assumeRoleSuccess: CreationOptional<boolean>;
  declare errorMessage: CreationOptional<string | null>;
  declare status: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createManualCloudConnectionModel = (sequelize: Sequelize): typeof ManualCloudConnection => {
  ManualCloudConnection.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "tenant_id",
      },
      createdBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: "created_by",
      },
      connectionName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: "connection_name",
      },
      awsAccountId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: "aws_account_id",
      },
      awsRegion: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "aws_region",
      },
      externalId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "external_id",
      },
      kcxPrincipalArn: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "kcx_principal_arn",
      },
      fileEventCallbackUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "file_event_callback_url",
      },
      callbackToken: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "callback_token",
      },
      billingRoleName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "billing_role_name",
      },
      billingRoleArn: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: "billing_role_arn",
      },
      bucketName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "bucket_name",
      },
      exportBucketName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "export_bucket_name",
      },
      prefix: {
        type: DataTypes.STRING(1000),
        allowNull: true,
      },
      exportPrefix: {
        type: DataTypes.STRING(1000),
        allowNull: true,
        field: "export_prefix",
      },
      reportName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "report_name",
      },
      exportName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "export_name",
      },
      exportArn: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "export_arn",
      },
      actionRoleEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "action_role_enabled",
      },
      actionRoleName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "action_role_name",
      },
      actionRoleArn: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "action_role_arn",
      },
      ec2ModuleEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "ec2_module_enabled",
      },
      useTagScopedAccess: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "use_tag_scoped_access",
      },
      billingFileEventLambdaArn: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "billing_file_event_lambda_arn",
      },
      billingEventbridgeRuleName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "billing_eventbridge_rule_name",
      },
      billingFileEventStatus: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "billing_file_event_status",
      },
      billingFileEventValidatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "billing_file_event_validated_at",
      },
      cloudtrailEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "cloudtrail_enabled",
      },
      cloudtrailBucketName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "cloudtrail_bucket_name",
      },
      cloudtrailPrefix: {
        type: DataTypes.STRING(1000),
        allowNull: true,
        field: "cloudtrail_prefix",
      },
      cloudtrailTrailName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "cloudtrail_trail_name",
      },
      cloudtrailLambdaArn: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "cloudtrail_lambda_arn",
      },
      cloudtrailEventbridgeRuleName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "cloudtrail_eventbridge_rule_name",
      },
      cloudtrailStatus: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "cloudtrail_status",
      },
      cloudtrailValidatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "cloudtrail_validated_at",
      },
      setupStep: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: "setup_step",
      },
      isComplete: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_complete",
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "completed_at",
      },
      completedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: "completed_by",
      },
      setupPayloadJson: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: "setup_payload_json",
      },
      lastValidatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "last_validated_at",
      },
      validationStatus: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "pending",
        field: "validation_status",
      },
      assumeRoleSuccess: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "assume_role_success",
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "error_message",
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "draft",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("NOW()"),
        field: "created_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("NOW()"),
        field: "updated_at",
      },
    },
    {
      sequelize,
      modelName: "ManualCloudConnection",
      tableName: "manual_cloud_connections",
      timestamps: false,
      indexes: [
        {
          name: "idx_manual_cloud_connections_tenant_id",
          fields: ["tenant_id"],
        },
        {
          name: "uq_manual_cloud_connections_tenant_connection_name",
          unique: true,
          fields: ["tenant_id", "connection_name"],
        },
        {
          name: "idx_manual_cloud_connections_status",
          fields: ["status"],
        },
        {
          name: "idx_manual_cloud_connections_is_complete",
          fields: ["is_complete"],
        },
        {
          name: "idx_manual_cloud_connections_cloudtrail_enabled",
          fields: ["cloudtrail_enabled"],
        },
      ],
    },
  );

  return ManualCloudConnection;
};

export { ManualCloudConnection };
export default createManualCloudConnectionModel;
