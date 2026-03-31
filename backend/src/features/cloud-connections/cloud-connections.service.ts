import { AwsCloudConnection, CloudConnection, sequelize } from "../../models/index.js";
import type { AwsManualStep1Input } from "./cloud-connections.schema.js";

const CLOUD_PROVIDER = {
  AWS: "aws",
} as const;

const CLOUD_CONNECTION_STATUS = {
  DRAFT: "DRAFT",
} as const;

const AWS_SETUP_METHOD = {
  MANUAL: "manual",
} as const;

const AWS_MANUAL_STEP_1_NEXT_STEP = 2;

type CreateOrUpdateAwsManualConnectionStep1Result = {
  connectionId: string;
  nextStep: number;
};

export async function createOrUpdateAwsManualConnectionStep1(
  clientId: number,
  payload: AwsManualStep1Input,
): Promise<CreateOrUpdateAwsManualConnectionStep1Result> {
  return sequelize.transaction(async (transaction) => {
    const existingDraftConnections = await CloudConnection.findAll({
      where: {
        clientId,
        provider: CLOUD_PROVIDER.AWS,
        status: CLOUD_CONNECTION_STATUS.DRAFT,
      },
      order: [["updatedAt", "DESC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    let cloudConnection = existingDraftConnections[0] ?? null;

    if (!cloudConnection) {
      cloudConnection = await CloudConnection.create(
        {
          clientId,
          provider: CLOUD_PROVIDER.AWS,
          connectionName: "AWS Manual Connection",
          setupMode: AWS_SETUP_METHOD.MANUAL,
          status: CLOUD_CONNECTION_STATUS.DRAFT,
          currentStep: AWS_MANUAL_STEP_1_NEXT_STEP,
        },
        { transaction },
      );
    } else {
      await cloudConnection.update(
        {
          currentStep: AWS_MANUAL_STEP_1_NEXT_STEP,
        },
        { transaction },
      );
    }

    const existingAwsConnection = await AwsCloudConnection.findOne({
      where: { cloudConnectionId: cloudConnection.id },
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
          cloudConnectionId: cloudConnection.id,
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
