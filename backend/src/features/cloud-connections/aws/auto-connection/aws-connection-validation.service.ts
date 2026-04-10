import { AssumeRoleCommand, GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { DescribeRegionsCommand, EC2Client } from "@aws-sdk/client-ec2";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

import env from "../../../../config/env.js";
import { CloudConnectionV2 } from "../../../../models/index.js";

type ValidationStatus = "active" | "active_with_warnings" | "failed";

type AwsValidationResult = {
  connectionId: string;
  status: ValidationStatus;
  lastValidatedAt: Date;
  errorMessage: string | null;
};

type AwsValidationConfigInput = {
  connectionId: string;
  billingRoleArn: string;
  externalId: string;
  expectedAccountId: string;
  exportBucket?: string | null;
  exportPrefix?: string | null;
  region?: string | null;
  exportRegion?: string | null;
};

const buildRoleSessionName = (connectionId: string): string => {
  const normalizedId = connectionId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
  return `kcx-validate-${normalizedId}`;
};

export async function validateAwsConnectionConfig(
  input: AwsValidationConfigInput,
): Promise<AwsValidationResult> {
  const billingRoleArn = input.billingRoleArn.trim();
  const externalId = input.externalId.trim();
  const expectedAccountId = input.expectedAccountId.trim();
  const exportBucket = input.exportBucket?.trim();
  const exportPrefix = input.exportPrefix?.trim();
  const region = input.region?.trim() || "us-east-1";
  const validatedAt = new Date();

  if (!billingRoleArn || !externalId || !expectedAccountId) {
    return {
      connectionId: input.connectionId,
      status: "failed",
      lastValidatedAt: validatedAt,
      errorMessage: "Missing billing role ARN, external ID, or cloud account ID for validation",
    };
  }

  const hasStaticAccessKey = Boolean(env.awsAccessKeyId);
  const hasStaticSecretKey = Boolean(env.awsSecretAccessKey);

  if (hasStaticAccessKey !== hasStaticSecretKey) {
    return {
      connectionId: input.connectionId,
      status: "failed",
      lastValidatedAt: validatedAt,
      errorMessage: "Incomplete AWS credentials. Set both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.",
    };
  }

  const stsClient = new STSClient({
    region,
    ...(hasStaticAccessKey && hasStaticSecretKey
      ? {
          credentials: {
            accessKeyId: env.awsAccessKeyId as string,
            secretAccessKey: env.awsSecretAccessKey as string,
            ...(env.awsSessionToken ? { sessionToken: env.awsSessionToken } : {}),
          },
        }
      : {}),
  });

  try {
    const assumeRole = await stsClient.send(
      new AssumeRoleCommand({
        RoleArn: billingRoleArn,
        ExternalId: externalId,
        RoleSessionName: buildRoleSessionName(input.connectionId),
      }),
    );

    const credentials = assumeRole.Credentials;
    if (!credentials?.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken) {
      throw new Error("AssumeRole returned incomplete temporary credentials");
    }

    const tempCredentials = {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    };

    const assumedStsClient = new STSClient({ region, credentials: tempCredentials });
    const callerIdentity = await assumedStsClient.send(new GetCallerIdentityCommand({}));
    const actualAccountId = callerIdentity.Account?.trim();

    if (!actualAccountId || actualAccountId !== expectedAccountId) {
      return {
        connectionId: input.connectionId,
        status: "failed",
        lastValidatedAt: validatedAt,
        errorMessage: `Account mismatch after AssumeRole. Expected ${expectedAccountId}, got ${actualAccountId ?? "unknown"}`,
      };
    }

    try {
      const ec2Client = new EC2Client({ region, credentials: tempCredentials });
      await ec2Client.send(new DescribeRegionsCommand({}));

      if (exportBucket && exportPrefix) {
        const s3Client = new S3Client({
          region: input.exportRegion?.trim() || region,
          credentials: tempCredentials,
        });
        await s3Client.send(
          new ListObjectsV2Command({
            Bucket: exportBucket,
            Prefix: exportPrefix.endsWith("/") ? exportPrefix : `${exportPrefix}/`,
            MaxKeys: 1,
          }),
        );
      }

      return {
        connectionId: input.connectionId,
        status: "active",
        lastValidatedAt: validatedAt,
        errorMessage: null,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed DescribeRegions validation check";
      return {
        connectionId: input.connectionId,
        status: "active_with_warnings",
        lastValidatedAt: validatedAt,
        errorMessage,
      };
    }
  } catch (error) {
    const rawErrorMessage = error instanceof Error ? error.message : "Failed to assume role";
    const isProviderChainError = rawErrorMessage.toLowerCase().includes("could not load credentials from any providers");
    const errorMessage = isProviderChainError
      ? "Could not load AWS credentials in backend. Configure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY for the KCX AWS principal account, then retry validation."
      : rawErrorMessage;

    return {
      connectionId: input.connectionId,
      status: "failed",
      lastValidatedAt: validatedAt,
      errorMessage,
    };
  }
}

export async function validateAwsConnection(connectionId: string): Promise<AwsValidationResult> {
  const connection = await CloudConnectionV2.findByPk(connectionId);
  if (!connection) {
    throw new Error("Cloud connection not found");
  }
  const validationResult = await validateAwsConnectionConfig({
    connectionId: connection.id,
    billingRoleArn: connection.billingRoleArn?.trim() ?? "",
    externalId: connection.externalId?.trim() ?? "",
    expectedAccountId: connection.cloudAccountId?.trim() ?? "",
    exportBucket: connection.exportBucket?.trim(),
    exportPrefix: connection.exportPrefix?.trim(),
    region: connection.region?.trim() || "us-east-1",
    exportRegion: connection.exportRegion?.trim() || connection.region?.trim() || "us-east-1",
  });

  await connection.update({
    status: validationResult.status,
    lastValidatedAt: validationResult.lastValidatedAt,
    errorMessage: validationResult.errorMessage,
  });

  return validationResult;
}
