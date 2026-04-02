import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { Op } from "sequelize";

import env from "../../../../config/env.js";
import { BillingSource, CloudConnectionV2 } from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";

const AWS_SOURCE_TYPE = "aws_data_exports_cur2";
const CLOUD_CONNECTED_SETUP_MODE = "cloud_connected";
const PENDING_FIRST_FILE_STATUS = "pending_first_file";
const ACTIVE_STATUS = "active";
const POLL_BATCH_SIZE = 50;
const MAX_LIST_PAGES = 20;

let pollTimer: NodeJS.Timeout | null = null;
let isPollInFlight = false;

const buildRoleSessionName = (connectionId: string): string => {
  const normalizedId = connectionId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
  return `kcx-first-file-${normalizedId}`;
};

const createStsClient = (): STSClient => {
  const hasStaticAccessKey = Boolean(env.awsAccessKeyId);
  const hasStaticSecretKey = Boolean(env.awsSecretAccessKey);

  if (hasStaticAccessKey !== hasStaticSecretKey) {
    throw new Error("Incomplete AWS credentials. Set both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.");
  }

  return new STSClient({
    region: env.awsRegion,
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
};

type TempCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
};

type CloudConnectionInstance = InstanceType<typeof CloudConnectionV2>;
type BillingSourceInstance = InstanceType<typeof BillingSource>;

const assumeConnectionRole = async (connection: CloudConnectionInstance): Promise<TempCredentials> => {
  const roleArn = connection.roleArn?.trim();
  const externalId = connection.externalId?.trim();

  if (!roleArn || !externalId) {
    throw new Error("Missing role ARN or external ID for pending first-file monitor");
  }

  const stsClient = createStsClient();
  const assumed = await stsClient.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      ExternalId: externalId,
      RoleSessionName: buildRoleSessionName(connection.id),
    }),
  );

  const credentials = assumed.Credentials;
  if (!credentials?.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken) {
    throw new Error("AssumeRole returned incomplete temporary credentials");
  }

  return {
    accessKeyId: credentials.AccessKeyId,
    secretAccessKey: credentials.SecretAccessKey,
    sessionToken: credentials.SessionToken,
  };
};

const hasParquetFileInPrefix = async ({
  bucket,
  prefix,
  region,
  credentials,
}: {
  bucket: string;
  prefix: string;
  region: string;
  credentials: TempCredentials;
}): Promise<boolean> => {
  const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
  const s3Client = new S3Client({ region, credentials });
  let continuationToken: string | undefined;
  let pageCount = 0;

  while (pageCount < MAX_LIST_PAGES) {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: normalizedPrefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    const hasParquetObject = (response.Contents ?? []).some((item) => item.Key?.toLowerCase().endsWith(".parquet"));
    if (hasParquetObject) {
      return true;
    }

    if (!response.IsTruncated || !response.NextContinuationToken) {
      return false;
    }

    continuationToken = response.NextContinuationToken;
    pageCount += 1;
  }

  return false;
};

const processPendingBillingSource = async (billingSource: BillingSourceInstance): Promise<void> => {
  const connectionId = billingSource.cloudConnectionId;
  if (!connectionId) {
    logger.warn("Skipping pending first-file source without cloud connection id", {
      billingSourceId: billingSource.id,
    });
    return;
  }

  const exportBucket = billingSource.bucketName?.trim();
  const exportPrefix = billingSource.pathPrefix?.trim();
  if (!exportBucket || !exportPrefix) {
    logger.warn("Skipping pending first-file source without export bucket/prefix", {
      billingSourceId: billingSource.id,
      connectionId,
    });
    return;
  }

  const connection = await CloudConnectionV2.findByPk(connectionId);
  if (!connection) {
    logger.warn("Skipping pending first-file source because cloud connection was not found", {
      billingSourceId: billingSource.id,
      connectionId,
    });
    return;
  }

  try {
    const tempCredentials = await assumeConnectionRole(connection);
    const region = connection.exportRegion?.trim() || connection.region?.trim() || "us-east-1";
    const found = await hasParquetFileInPrefix({
      bucket: exportBucket,
      prefix: exportPrefix,
      region,
      credentials: tempCredentials,
    });

    if (!found) {
      return;
    }

    const now = new Date();
    await billingSource.update({
      status: ACTIVE_STATUS,
      lastFileReceivedAt: now,
      lastValidatedAt: now,
    });

    logger.info("AWS first parquet file detected; billing source activated", {
      billingSourceId: billingSource.id,
      connectionId,
      bucket: exportBucket,
      prefix: exportPrefix,
    });
  } catch (error) {
    logger.warn("AWS pending first-file check failed for billing source", {
      billingSourceId: billingSource.id,
      connectionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

async function pollAwsPendingFirstFiles(): Promise<void> {
  if (isPollInFlight) return;
  isPollInFlight = true;

  try {
    const pendingSources = await BillingSource.findAll({
      where: {
        sourceType: AWS_SOURCE_TYPE,
        setupMode: CLOUD_CONNECTED_SETUP_MODE,
        format: "parquet",
        status: PENDING_FIRST_FILE_STATUS,
        cloudConnectionId: { [Op.ne]: null },
      },
      order: [["updatedAt", "ASC"]],
      limit: POLL_BATCH_SIZE,
    });

    for (const billingSource of pendingSources) {
      await processPendingBillingSource(billingSource);
    }
  } catch (error) {
    logger.error("AWS pending first-file monitor poll failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    isPollInFlight = false;
  }
}

export function startAwsFirstFileMonitor(): void {
  if (pollTimer) return;

  const intervalMs = env.awsFirstFilePollingIntervalMs;
  logger.info("Starting AWS pending first-file monitor", { intervalMs });

  void pollAwsPendingFirstFiles();
  pollTimer = setInterval(() => {
    void pollAwsPendingFirstFiles();
  }, intervalMs);
}

export function stopAwsFirstFileMonitor(): void {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
  logger.info("Stopped AWS pending first-file monitor");
}
