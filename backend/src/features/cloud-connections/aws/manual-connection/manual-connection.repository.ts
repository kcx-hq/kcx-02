import { ManualCloudConnection } from "../../../../models/index.js";

type CreateManualConnectionRecordInput = {
  tenantId: string;
  createdBy: string;
  connectionName: string;
  awsAccountId: string;
  billingRoleArn: string;
  externalId: string;
  bucketName: string;
  prefix?: string;
  reportName: string;
  validationStatus: string;
  assumeRoleSuccess: boolean;
  lastValidatedAt: Date;
  status: string;
  errorMessage?: string | null;
};

type UpdateValidationStatusInput = {
  validationStatus: string;
  assumeRoleSuccess: boolean;
  lastValidatedAt?: Date | null;
  errorMessage?: string | null;
  status?: string;
};

type UpsertManualConnectionCompletionInput = {
  tenantId: string;
  userId: string;
  connectionName: string;
  awsAccountId: string;
  awsRegion: string;
  externalId: string;
  kcxPrincipalArn: string;
  fileEventCallbackUrl: string;
  callbackToken: string;
  billingRoleName: string;
  billingRoleArn: string;
  exportBucketName: string;
  exportPrefix: string;
  exportName: string | null;
  exportArn: string | null;
  actionRoleEnabled: boolean;
  actionRoleName: string | null;
  actionRoleArn: string | null;
  ec2ModuleEnabled: boolean;
  useTagScopedAccess: boolean;
  billingFileEventLambdaArn: string;
  billingEventbridgeRuleName: string;
  billingFileEventStatus: string;
  billingFileEventValidatedAt: Date;
  cloudtrailEnabled: boolean;
  cloudtrailBucketName: string | null;
  cloudtrailPrefix: string | null;
  cloudtrailTrailName: string | null;
  cloudtrailLambdaArn: string | null;
  cloudtrailEventbridgeRuleName: string | null;
  cloudtrailStatus: string | null;
  cloudtrailValidatedAt: Date | null;
  setupStep: number;
  setupPayloadJson: Record<string, unknown>;
  status: string;
  validationStatus: string;
  assumeRoleSuccess: boolean;
  lastValidatedAt: Date;
  errorMessage: string | null;
};

export async function createManualConnectionRecord(input: CreateManualConnectionRecordInput) {
  const inferredBillingRoleName = input.billingRoleArn.includes("/")
    ? input.billingRoleArn.slice(input.billingRoleArn.lastIndexOf("/") + 1)
    : input.billingRoleArn;

  return ManualCloudConnection.create({
    tenantId: input.tenantId,
    createdBy: input.createdBy,
    connectionName: input.connectionName,
    awsAccountId: input.awsAccountId,
    billingRoleArn: input.billingRoleArn,
    externalId: input.externalId,
    bucketName: input.bucketName,
    prefix: input.prefix ?? null,
    reportName: input.reportName,
    billingRoleName: inferredBillingRoleName || null,
    exportBucketName: input.bucketName,
    exportPrefix: input.prefix ?? null,
    exportName: input.reportName,
    validationStatus: input.validationStatus,
    assumeRoleSuccess: input.assumeRoleSuccess,
    lastValidatedAt: input.lastValidatedAt,
    status: input.status,
    errorMessage: input.errorMessage ?? null,
  });
}

export async function updateManualConnectionValidationStatus(
  id: string,
  input: UpdateValidationStatusInput,
) {
  const record = await ManualCloudConnection.findByPk(id);
  if (!record) return null;

  await record.update({
    validationStatus: input.validationStatus,
    assumeRoleSuccess: input.assumeRoleSuccess,
    lastValidatedAt: input.lastValidatedAt ?? null,
    errorMessage: input.errorMessage ?? null,
    ...(input.status ? { status: input.status } : {}),
  });

  return record;
}

export async function listManualConnectionsByTenant(tenantId: string) {
  return ManualCloudConnection.findAll({
    where: { tenantId },
    order: [["createdAt", "DESC"]],
  });
}

export async function findManualConnectionByTenantAndName(tenantId: string, connectionName: string) {
  return ManualCloudConnection.findOne({
    where: {
      tenantId,
      connectionName,
    },
  });
}

export async function upsertManualConnectionCompletion(input: UpsertManualConnectionCompletionInput) {
  const existing = await findManualConnectionByTenantAndName(input.tenantId, input.connectionName);

  const payload = {
    tenantId: input.tenantId,
    connectionName: input.connectionName,
    awsAccountId: input.awsAccountId,
    awsRegion: input.awsRegion,
    externalId: input.externalId,
    bucketName: input.exportBucketName,
    prefix: input.exportPrefix,
    reportName: input.exportName,
    kcxPrincipalArn: input.kcxPrincipalArn,
    fileEventCallbackUrl: input.fileEventCallbackUrl,
    callbackToken: input.callbackToken,
    billingRoleName: input.billingRoleName,
    billingRoleArn: input.billingRoleArn,
    exportBucketName: input.exportBucketName,
    exportPrefix: input.exportPrefix,
    exportName: input.exportName,
    exportArn: input.exportArn,
    actionRoleEnabled: input.actionRoleEnabled,
    actionRoleName: input.actionRoleName,
    actionRoleArn: input.actionRoleArn,
    ec2ModuleEnabled: input.ec2ModuleEnabled,
    useTagScopedAccess: input.useTagScopedAccess,
    billingFileEventLambdaArn: input.billingFileEventLambdaArn,
    billingEventbridgeRuleName: input.billingEventbridgeRuleName,
    billingFileEventStatus: input.billingFileEventStatus,
    billingFileEventValidatedAt: input.billingFileEventValidatedAt,
    cloudtrailEnabled: input.cloudtrailEnabled,
    cloudtrailBucketName: input.cloudtrailBucketName,
    cloudtrailPrefix: input.cloudtrailPrefix,
    cloudtrailTrailName: input.cloudtrailTrailName,
    cloudtrailLambdaArn: input.cloudtrailLambdaArn,
    cloudtrailEventbridgeRuleName: input.cloudtrailEventbridgeRuleName,
    cloudtrailStatus: input.cloudtrailStatus,
    cloudtrailValidatedAt: input.cloudtrailValidatedAt,
    setupStep: input.setupStep,
    isComplete: true,
    completedAt: new Date(),
    completedBy: input.userId,
    setupPayloadJson: input.setupPayloadJson,
    status: input.status,
    validationStatus: input.validationStatus,
    assumeRoleSuccess: input.assumeRoleSuccess,
    lastValidatedAt: input.lastValidatedAt,
    errorMessage: input.errorMessage,
    updatedAt: new Date(),
  };

  if (existing) {
    await existing.update(payload);
    return existing;
  }

  return ManualCloudConnection.create({
    ...payload,
    createdBy: input.userId,
    createdAt: new Date(),
  });
}
