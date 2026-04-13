import { S3UploadConnection } from "../../../models/index.js";

export type SyncS3UploadConnectionFromAwsSetupInput = {
  tenantId: string;
  createdBy?: string | null;
  roleArn: string;
  externalId?: string | null;
  bucketName: string;
  basePrefix?: string | null;
  awsAccountId?: string | null;
  status: "active" | "suspended";
  createIfMissing?: boolean;
};

const normalizeOptional = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizePrefix = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  return normalized.length > 0 ? normalized : null;
};

export async function syncS3UploadConnectionFromAwsSetup(
  input: SyncS3UploadConnectionFromAwsSetupInput,
): Promise<InstanceType<typeof S3UploadConnection> | null> {
  const tenantId = String(input.tenantId ?? "").trim();
  const roleArn = String(input.roleArn ?? "").trim();
  const bucketName = String(input.bucketName ?? "").trim();
  const basePrefix = normalizePrefix(input.basePrefix);
  const externalId = normalizeOptional(input.externalId);
  const awsAccountId = normalizeOptional(input.awsAccountId);
  const createdBy = normalizeOptional(input.createdBy);
  const createIfMissing = input.createIfMissing ?? true;

  if (!tenantId || !roleArn || !bucketName) {
    return null;
  }

  const now = new Date();
  const existing = await S3UploadConnection.findOne({
    where: {
      tenantId,
      bucketName,
      basePrefix,
    },
    order: [["updatedAt", "DESC"]],
  });

  if (existing) {
    await existing.update({
      roleArn,
      externalId,
      awsAccountId,
      status: input.status,
      lastValidatedAt: now,
      updatedAt: now,
    });
    return existing;
  }

  if (!createIfMissing) {
    return null;
  }

  return S3UploadConnection.create({
    tenantId,
    createdBy,
    roleArn,
    externalId,
    bucketName,
    basePrefix,
    awsAccountId,
    assumedArn: null,
    resolvedRegion: null,
    status: input.status,
    lastValidatedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}
