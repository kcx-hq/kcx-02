import { ManualCloudConnection } from "../../../../models/index.js";

type CreateManualConnectionRecordInput = {
  tenantId: string;
  createdBy: string;
  connectionName: string;
  awsAccountId: string;
  roleArn: string;
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

export async function createManualConnectionRecord(input: CreateManualConnectionRecordInput) {
  return ManualCloudConnection.create({
    tenantId: input.tenantId,
    createdBy: input.createdBy,
    connectionName: input.connectionName,
    awsAccountId: input.awsAccountId,
    roleArn: input.roleArn,
    externalId: input.externalId,
    bucketName: input.bucketName,
    prefix: input.prefix ?? null,
    reportName: input.reportName,
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
