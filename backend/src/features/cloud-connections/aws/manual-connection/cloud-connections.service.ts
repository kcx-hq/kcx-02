import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import env from "../../../../config/env.js";
import { BadRequestError, NotFoundError } from "../../../../errors/http-errors.js";
import { AwsCloudConnection, CloudConnection, sequelize } from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";
import type {
  AwsManualStep1Input,
  AwsManualStep2Input,
  AwsManualStep3Input,
  AwsManualValidateInput,
} from "./cloud-connections.schema.js";

const CLOUD_PROVIDER = {
  AWS: "aws",
} as const;

const CLOUD_CONNECTION_STATUS = {
  DRAFT: "draft",
  READY_FOR_VALIDATION: "READY_FOR_VALIDATION",
  ACTIVE: "active",
  FAILED: "error",
} as const;

const AWS_SETUP_METHOD = {
  MANUAL: "manual",
} as const;

const AWS_MANUAL_STEP_1_NEXT_STEP = 2;
const AWS_MANUAL_STEP_2_NEXT_STEP = 3;

type CreateOrUpdateAwsManualConnectionStep1Result = {
  connectionId: number;
  nextStep: number;
};

type CreateOrUpdateAwsManualConnectionStep2Result = {
  connectionId: number;
  nextStep: number;
};

type CreateOrUpdateAwsManualConnectionStep3Result = {
  connectionId: number;
  status: string;
};

type ValidateAwsManualConnectionResult = {
  connectionId: number;
  status: string;
  error?: string;
};

const sanitizeAwsValidationError = (error: unknown): string => {
  const errorName =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name ?? "")
      : "";
  const errorCode =
    typeof error === "object" && error !== null && "$metadata" in error
      ? String(
          ((error as { $metadata?: { httpStatusCode?: unknown } }).$metadata?.httpStatusCode as
            | string
            | number
            | undefined) ?? "",
        )
      : "";

  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    if (
      normalized.includes("not authorized to perform sts:assumerole") ||
      normalized.includes("accessdenied") ||
      normalized.includes("access denied")
    ) {
      return "AssumeRole denied. Check IAM user permission and role trust principal.";
    }
    if (normalized.includes("invalidclienttokenid") || normalized.includes("signaturedoesnotmatch")) {
      return "Invalid AWS IAM user credentials configured in backend environment.";
    }
    if (normalized.includes("nosuchbucket")) {
      return "Configured S3 bucket does not exist";
    }
    if (
      (normalized.includes("externalid") || normalized.includes("external id")) &&
      (normalized.includes("mismatch") ||
        normalized.includes("invalid") ||
        normalized.includes("failed") ||
        normalized.includes("condition"))
    ) {
      return "External ID mismatch or invalid trust relationship";
    }
    if (normalized.includes("arn")) {
      return "Invalid role ARN or role trust configuration";
    }
    if (normalized.includes("listobjectsv2") || normalized.includes("s3") || normalized.includes("bucket")) {
      return "Unable to access the S3 bucket/prefix with assumed role permissions.";
    }

    logger.warn("AWS validation failed", {
      errorName,
      errorCode,
      errorMessage: error.message,
    });
  }

  return "AWS validation failed. Check role, external ID, and S3 permissions.";
};

export async function createOrUpdateAwsManualConnectionStep1(
  userId: string,
  payload: AwsManualStep1Input,
): Promise<CreateOrUpdateAwsManualConnectionStep1Result> {
  return sequelize.transaction(async (transaction) => {
    let cloudConnection = await CloudConnection.findOne({
      where: {
        userId,
        provider: CLOUD_PROVIDER.AWS,
      },
      order: [["updatedAt", "DESC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!cloudConnection) {
      cloudConnection = await CloudConnection.create(
        {
          userId,
          provider: CLOUD_PROVIDER.AWS,
          connectionName: "AWS Manual Connection",
          status: CLOUD_CONNECTION_STATUS.DRAFT,
          accountType: "payer",
        },
        { transaction },
      );
    }

    const existingAwsConnection = await AwsCloudConnection.findOne({
      where: { cloudConnectionId: String(cloudConnection.id) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const awsConnectionPayload = {
      bucketName: payload.bucketName,
      bucketPrefix: payload.bucketPrefix,
      setupMethod: AWS_SETUP_METHOD.MANUAL,
    };

    if (!existingAwsConnection) {
      await AwsCloudConnection.create(
        {
          cloudConnectionId: String(cloudConnection.id),
          ...awsConnectionPayload,
        },
        { transaction },
      );
    } else {
      await existingAwsConnection.update(awsConnectionPayload, { transaction });
    }

    return {
      connectionId: cloudConnection.id,
      nextStep: AWS_MANUAL_STEP_1_NEXT_STEP,
    };
  });
}

export async function createOrUpdateAwsManualConnectionStep2(
  userId: string,
  payload: AwsManualStep2Input,
): Promise<CreateOrUpdateAwsManualConnectionStep2Result> {
  return sequelize.transaction(async (transaction) => {
    const cloudConnection = await CloudConnection.findOne({
      where: {
        id: payload.connectionId,
        userId,
        provider: CLOUD_PROVIDER.AWS,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!cloudConnection) {
      throw new NotFoundError("Draft AWS cloud connection not found");
    }

    const existingAwsConnection = await AwsCloudConnection.findOne({
      where: { cloudConnectionId: String(cloudConnection.id) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!existingAwsConnection) {
      throw new NotFoundError("AWS cloud connection details not found");
    }

    await existingAwsConnection.update(
      {
        externalId: payload.externalId,
        roleName: payload.roleName,
        policyName: payload.policyName,
      },
      { transaction },
    );

    return {
      connectionId: cloudConnection.id,
      nextStep: AWS_MANUAL_STEP_2_NEXT_STEP,
    };
  });
}

export async function createOrUpdateAwsManualConnectionStep3(
  userId: string,
  payload: AwsManualStep3Input,
): Promise<CreateOrUpdateAwsManualConnectionStep3Result> {
  return sequelize.transaction(async (transaction) => {
    const cloudConnection = await CloudConnection.findOne({
      where: {
        id: payload.connectionId,
        userId,
        provider: CLOUD_PROVIDER.AWS,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!cloudConnection) {
      throw new NotFoundError("Draft AWS cloud connection not found");
    }

    const existingAwsConnection = await AwsCloudConnection.findOne({
      where: { cloudConnectionId: String(cloudConnection.id) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!existingAwsConnection) {
      throw new NotFoundError("AWS cloud connection details not found");
    }
    if (!existingAwsConnection.externalId || !existingAwsConnection.roleName || !existingAwsConnection.policyName) {
      throw new BadRequestError("Step 2 must be completed before Step 3");
    }

    await existingAwsConnection.update(
      {
        roleArn: payload.roleArn,
        reportName: payload.reportName,
      },
      { transaction },
    );

    await cloudConnection.update(
      {
        connectionName: payload.connectionName,
        status: CLOUD_CONNECTION_STATUS.DRAFT,
      },
      { transaction },
    );

    return {
      connectionId: cloudConnection.id,
      status: CLOUD_CONNECTION_STATUS.READY_FOR_VALIDATION,
    };
  });
}

export async function validateAwsManualConnection(
  userId: string,
  payload: AwsManualValidateInput,
): Promise<ValidateAwsManualConnectionResult> {
  const cloudConnection = await CloudConnection.findOne({
    where: {
      id: payload.connectionId,
      userId,
      provider: CLOUD_PROVIDER.AWS,
    },
    include: [{ model: AwsCloudConnection, required: false }],
  });

  if (!cloudConnection) {
    throw new NotFoundError("AWS cloud connection is not ready for validation");
  }

  const awsConnection = (cloudConnection as unknown as {
    AwsCloudConnection?: {
      roleArn: string | null;
      externalId: string | null;
      bucketName: string;
      bucketPrefix: string | null;
    };
  }).AwsCloudConnection;

  if (!awsConnection) {
    throw new NotFoundError("AWS cloud connection details not found");
  }

  const roleArn = awsConnection.roleArn?.trim() ?? "";
  const externalId = awsConnection.externalId?.trim() ?? "";
  const bucketName = awsConnection.bucketName?.trim() ?? "";
  const bucketPrefix = awsConnection.bucketPrefix?.trim() ?? "";

  if (!roleArn || !externalId || !bucketName) {
    throw new BadRequestError("Missing required AWS validation fields");
  }

  if (!env.awsAccessKeyId || !env.awsSecretAccessKey) {
    throw new BadRequestError("AWS validation credentials are not configured");
  }

  try {
    const sts = new STSClient({
      region: env.awsRegion,
      credentials: {
        accessKeyId: env.awsAccessKeyId,
        secretAccessKey: env.awsSecretAccessKey,
      },
    });
    const assumeRoleResponse = await sts.send(
      new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: "kcx-validation-session",
        ExternalId: externalId,
      }),
    );

    const credentials = assumeRoleResponse.Credentials;
    if (!credentials?.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken) {
      throw new Error("AssumeRole did not return temporary credentials");
    }

    const s3 = new S3Client({
      region: env.awsRegion,
      credentials: {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken,
      },
    });

    await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: bucketPrefix || undefined,
        MaxKeys: 1,
      }),
    );
  } catch (error) {
    const sanitizedError = sanitizeAwsValidationError(error);

    await sequelize.transaction(async (transaction) => {
      await cloudConnection.update(
        {
          status: CLOUD_CONNECTION_STATUS.FAILED,
        },
        { transaction },
      );
    });

    return {
      connectionId: cloudConnection.id,
      status: CLOUD_CONNECTION_STATUS.FAILED,
      error: sanitizedError,
    };
  }

  await sequelize.transaction(async (transaction) => {
    await cloudConnection.update(
      {
        status: CLOUD_CONNECTION_STATUS.ACTIVE,
      },
      { transaction },
    );
  });

  return {
    connectionId: cloudConnection.id,
    status: CLOUD_CONNECTION_STATUS.ACTIVE,
  };
}
