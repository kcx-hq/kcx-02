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

const buildRoleSessionName = (connectionId: string): string => {
  const normalizedId = connectionId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
  return `kcx-validate-${normalizedId}`;
};

export async function validateAwsConnection(connectionId: string): Promise<AwsValidationResult> {
  const connection = await CloudConnectionV2.findByPk(connectionId);
  if (!connection) {
    throw new Error("Cloud connection not found");
  }

  const billingRoleArn = connection.billingRoleArn?.trim();
  const externalId = connection.externalId?.trim();
  const expectedAccountId = connection.cloudAccountId?.trim();
  const exportBucket = connection.exportBucket?.trim();
  const exportPrefix = connection.exportPrefix?.trim();
  const region = connection.region?.trim() || "us-east-1";
  const validatedAt = new Date();

  if (!billingRoleArn || !externalId || !expectedAccountId) {
    const errorMessage = "Missing billing role ARN, external ID, or cloud account ID for validation";
    await connection.update({
      status: "failed",
      lastValidatedAt: validatedAt,
      errorMessage,
    });

    return {
      connectionId: connection.id,
      status: "failed",
      lastValidatedAt: validatedAt,
      errorMessage,
    };
  }

  const hasStaticAccessKey = Boolean(env.awsAccessKeyId);
  const hasStaticSecretKey = Boolean(env.awsSecretAccessKey);

  if (hasStaticAccessKey !== hasStaticSecretKey) {
    const errorMessage =
      "Incomplete AWS credentials. Set both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.";
    await connection.update({
      status: "failed",
      lastValidatedAt: validatedAt,
      errorMessage,
    });

    return {
      connectionId: connection.id,
      status: "failed",
      lastValidatedAt: validatedAt,
      errorMessage,
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
        RoleSessionName: buildRoleSessionName(connection.id),
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
      const errorMessage = `Account mismatch after AssumeRole. Expected ${expectedAccountId}, got ${actualAccountId ?? "unknown"}`;
      await connection.update({
        status: "failed",
        lastValidatedAt: validatedAt,
        errorMessage,
      });

      return {
        connectionId: connection.id,
        status: "failed",
        lastValidatedAt: validatedAt,
        errorMessage,
      };
    }

    try {
      const ec2Client = new EC2Client({ region, credentials: tempCredentials });
      await ec2Client.send(new DescribeRegionsCommand({}));

      if (exportBucket && exportPrefix) {
        const s3Client = new S3Client({
          region: connection.exportRegion?.trim() || region,
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

      await connection.update({
        status: "active",
        lastValidatedAt: validatedAt,
        errorMessage: null,
      });

      return {
        connectionId: connection.id,
        status: "active",
        lastValidatedAt: validatedAt,
        errorMessage: null,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed DescribeRegions validation check";
      await connection.update({
        status: "active_with_warnings",
        lastValidatedAt: validatedAt,
        errorMessage,
      });

      return {
        connectionId: connection.id,
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
    await connection.update({
      status: "failed",
      lastValidatedAt: validatedAt,
      errorMessage,
    });

    return {
      connectionId: connection.id,
      status: "failed",
      lastValidatedAt: validatedAt,
      errorMessage,
    };
  }
}
