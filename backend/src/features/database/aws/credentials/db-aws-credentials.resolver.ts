import { assumeRole } from "../../../cloud-connections/aws/infrastructure/aws-sts.service.js";

import { DbAwsValidationError } from "../errors/db-aws.errors.js";
import { normalizeDbAwsError } from "../errors/db-aws-error-normalizer.js";
import { resolveAwsDatabaseRegion } from "../regions/db-aws-region.resolver.js";
import type { AwsDatabaseCredentialsContext } from "../types/db-aws.types.js";

const normalizeRequired = (value: unknown, fieldName: string): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new DbAwsValidationError(`${fieldName} is required`, { fieldName });
  }
  return normalized;
};

export const resolveAwsDatabaseCredentialsContext = async (input: {
  roleArn: string;
  externalId?: string | null;
  region?: string | null;
  connectionRegion?: string | null;
  connectionExportRegion?: string | null;
  tenantId: string;
  cloudConnectionId: string;
}): Promise<AwsDatabaseCredentialsContext> => {
  const tenantId = normalizeRequired(input.tenantId, "tenantId");
  const cloudConnectionId = normalizeRequired(input.cloudConnectionId, "cloudConnectionId");
  const roleArn = normalizeRequired(input.roleArn, "roleArn");
  const externalId = typeof input.externalId === "string" && input.externalId.trim()
    ? input.externalId.trim()
    : null;

  const region = resolveAwsDatabaseRegion({
    region: input.region,
    connectionRegion: input.connectionRegion,
    connectionExportRegion: input.connectionExportRegion,
  });

  try {
    const credentials = await assumeRole(roleArn, externalId);
    return {
      tenantId,
      cloudConnectionId,
      roleArn,
      externalId,
      region,
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    };
  } catch (error) {
    throw normalizeDbAwsError(error, {
      tenantId,
      cloudConnectionId,
      roleArn,
      region,
    });
  }
};
