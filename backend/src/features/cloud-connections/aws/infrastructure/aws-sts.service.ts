import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";

import env from "../../../../config/env.js";

export type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
};

const buildBaseStsCredentials = (): Credentials | undefined => {
  const accessKeyId = env.awsValidationAccessKeyId ?? env.awsAccessKeyId;
  const secretAccessKey = env.awsValidationSecretAccessKey ?? env.awsSecretAccessKey;
  const sessionToken = env.awsValidationSessionToken ?? env.awsSessionToken;

  if (!accessKeyId || !secretAccessKey) {
    return undefined;
  }

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: sessionToken ?? "",
  };
};

export async function assumeRole(roleArn: string, externalId?: string | null): Promise<Credentials> {
  const normalizedRoleArn = String(roleArn ?? "").trim();
  if (!normalizedRoleArn) {
    throw new Error("AWS role ARN is required to assume role");
  }
  const normalizedExternalId = String(externalId ?? "").trim();

  const baseCredentials = buildBaseStsCredentials();
  const client = new STSClient({
    region: env.awsRegion,
    credentials: baseCredentials?.accessKeyId
      ? {
          accessKeyId: baseCredentials.accessKeyId,
          secretAccessKey: baseCredentials.secretAccessKey,
          ...(baseCredentials.sessionToken ? { sessionToken: baseCredentials.sessionToken } : {}),
        }
      : undefined,
  });

  try {
    const response = await client.send(
      new AssumeRoleCommand({
        RoleArn: normalizedRoleArn,
        RoleSessionName: `kcx-manual-export-${Date.now()}`,
        ...(normalizedExternalId ? { ExternalId: normalizedExternalId } : {}),
      }),
    );

    const accessKeyId = response.Credentials?.AccessKeyId;
    const secretAccessKey = response.Credentials?.SecretAccessKey;
    const sessionToken = response.Credentials?.SessionToken;

    if (!accessKeyId || !secretAccessKey || !sessionToken) {
      throw new Error("Incomplete credentials returned by AssumeRole");
    }

    return {
      accessKeyId,
      secretAccessKey,
      sessionToken,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to assume AWS role (${normalizedRoleArn}): ${reason}`);
  }
}
