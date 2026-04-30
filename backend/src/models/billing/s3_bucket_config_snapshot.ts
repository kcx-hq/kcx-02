import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class S3BucketConfigSnapshot extends Model<
  InferAttributes<S3BucketConfigSnapshot>,
  InferCreationAttributes<S3BucketConfigSnapshot>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<number | null>;
  declare providerId: CreationOptional<number | null>;
  declare accountId: string;
  declare bucketName: string;
  declare region: CreationOptional<string | null>;
  declare scanTime: Date;
  declare lifecycleStatus: CreationOptional<string | null>;
  declare lifecycleRulesCount: CreationOptional<number | null>;
  declare lifecycleRulesJson: CreationOptional<Record<string, unknown> | null>;
  declare encryptionStatus: CreationOptional<string | null>;
  declare encryptionType: CreationOptional<string | null>;
  declare kmsKeyId: CreationOptional<string | null>;
  declare publicAccessBlockStatus: CreationOptional<string | null>;
  declare blockPublicAcls: CreationOptional<boolean | null>;
  declare ignorePublicAcls: CreationOptional<boolean | null>;
  declare blockPublicPolicy: CreationOptional<boolean | null>;
  declare restrictPublicBuckets: CreationOptional<boolean | null>;
  declare policyPublicStatus: CreationOptional<string | null>;
  declare versioningStatus: CreationOptional<string | null>;
  declare mfaDeleteStatus: CreationOptional<string | null>;
  declare loggingStatus: CreationOptional<string | null>;
  declare loggingTargetBucket: CreationOptional<string | null>;
  declare loggingTargetPrefix: CreationOptional<string | null>;
  declare replicationStatus: CreationOptional<string | null>;
  declare replicationRulesCount: CreationOptional<number | null>;
  declare replicationConfigJson: CreationOptional<Record<string, unknown> | null>;
  declare ownershipStatus: CreationOptional<string | null>;
  declare rawErrorsJson: CreationOptional<Record<string, unknown> | null>;
  declare createdAt: CreationOptional<Date>;
}

const createS3BucketConfigSnapshotModel = (sequelize: Sequelize): typeof S3BucketConfigSnapshot => {
  S3BucketConfigSnapshot.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      accountId: { type: DataTypes.STRING(20), allowNull: false, field: "account_id" },
      bucketName: { type: DataTypes.TEXT, allowNull: false, field: "bucket_name" },
      region: { type: DataTypes.STRING(64), allowNull: true, field: "region" },
      scanTime: { type: DataTypes.DATE, allowNull: false, field: "scan_time", defaultValue: sequelize.literal("NOW()") },
      lifecycleStatus: { type: DataTypes.STRING(64), allowNull: true, field: "lifecycle_status" },
      lifecycleRulesCount: { type: DataTypes.INTEGER, allowNull: true, field: "lifecycle_rules_count" },
      lifecycleRulesJson: { type: DataTypes.JSONB, allowNull: true, field: "lifecycle_rules_json" },
      encryptionStatus: { type: DataTypes.STRING(64), allowNull: true, field: "encryption_status" },
      encryptionType: { type: DataTypes.STRING(64), allowNull: true, field: "encryption_type" },
      kmsKeyId: { type: DataTypes.TEXT, allowNull: true, field: "kms_key_id" },
      publicAccessBlockStatus: { type: DataTypes.STRING(64), allowNull: true, field: "public_access_block_status" },
      blockPublicAcls: { type: DataTypes.BOOLEAN, allowNull: true, field: "block_public_acls" },
      ignorePublicAcls: { type: DataTypes.BOOLEAN, allowNull: true, field: "ignore_public_acls" },
      blockPublicPolicy: { type: DataTypes.BOOLEAN, allowNull: true, field: "block_public_policy" },
      restrictPublicBuckets: { type: DataTypes.BOOLEAN, allowNull: true, field: "restrict_public_buckets" },
      policyPublicStatus: { type: DataTypes.STRING(64), allowNull: true, field: "policy_public_status" },
      versioningStatus: { type: DataTypes.STRING(64), allowNull: true, field: "versioning_status" },
      mfaDeleteStatus: { type: DataTypes.STRING(64), allowNull: true, field: "mfa_delete_status" },
      loggingStatus: { type: DataTypes.STRING(64), allowNull: true, field: "logging_status" },
      loggingTargetBucket: { type: DataTypes.TEXT, allowNull: true, field: "logging_target_bucket" },
      loggingTargetPrefix: { type: DataTypes.TEXT, allowNull: true, field: "logging_target_prefix" },
      replicationStatus: { type: DataTypes.STRING(64), allowNull: true, field: "replication_status" },
      replicationRulesCount: { type: DataTypes.INTEGER, allowNull: true, field: "replication_rules_count" },
      replicationConfigJson: { type: DataTypes.JSONB, allowNull: true, field: "replication_config_json" },
      ownershipStatus: { type: DataTypes.STRING(64), allowNull: true, field: "ownership_status" },
      rawErrorsJson: { type: DataTypes.JSONB, allowNull: true, field: "raw_errors_json" },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at", defaultValue: sequelize.literal("NOW()") },
    },
    {
      sequelize,
      modelName: "S3BucketConfigSnapshot",
      tableName: "s3_bucket_config_snapshot",
      timestamps: false,
    },
  );

  return S3BucketConfigSnapshot;
};

export { S3BucketConfigSnapshot };
export default createS3BucketConfigSnapshotModel;

