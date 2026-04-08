import {
  DescribeInstancesCommand,
  type DescribeInstancesCommandOutput,
  EC2Client,
  RebootInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
} from "@aws-sdk/client-ec2";

import { BadRequestError, NotFoundError } from "../../../../errors/http-errors.js";
import { CloudConnectionV2 } from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";
import { assumeRole, type Credentials } from "../infrastructure/aws-sts.service.js";
import { flattenEc2Reservations, type Ec2InstanceListItem } from "./ec2.mapper.js";

type AwsConnectionContext = {
  connectionId: string;
  actionRoleArn: string;
  externalId: string;
  region: string;
};

type Ec2InstanceActionType = "start" | "stop" | "reboot";

type Ec2InstanceActionResult = {
  success: true;
  action: Ec2InstanceActionType;
  instanceId: string;
  message: string;
};

export class AwsEc2Error extends Error {
  constructor(
    public readonly errorCode: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const normalizeRequired = (value: string | null | undefined, fieldName: string): string => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new BadRequestError(`${fieldName} is required`);
  }
  return normalized;
};

const resolveAwsConnectionContext = async (
  tenantId: string,
  connectionId: string,
): Promise<AwsConnectionContext> => {
  const normalizedConnectionId = normalizeRequired(connectionId, "connectionId");
  const connection = await CloudConnectionV2.findOne({
    where: {
      id: normalizedConnectionId,
      tenantId,
    },
  });

  if (!connection) {
    throw new NotFoundError("Cloud connection not found");
  }

  const actionRoleArn = normalizeRequired(connection.actionRoleArn, "actionRoleArn");
  const externalId = normalizeRequired(connection.externalId, "externalId");
  const region = normalizeRequired(connection.region, "region");

  return {
    connectionId: connection.id,
    actionRoleArn,
    externalId,
    region,
  };
};

export const buildEC2ClientFromAssumedCredentials = (
  region: string,
  credentials: Credentials,
): EC2Client => {
  return new EC2Client({
    region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });
};

const buildAssumedEc2Client = async (connectionContext: AwsConnectionContext): Promise<EC2Client> => {
  try {
    const credentials = await assumeRole(connectionContext.actionRoleArn, connectionContext.externalId);
    return buildEC2ClientFromAssumedCredentials(connectionContext.region, credentials);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AwsEc2Error("ASSUME_ROLE_FAILED", "Unable to assume role for EC2 action.", 400, {
      connectionId: connectionContext.connectionId,
      reason,
    });
  }
};

const listEc2Reservations = async (client: EC2Client): Promise<DescribeInstancesCommandOutput["Reservations"]> => {
  let nextToken: string | undefined;
  const allReservations: NonNullable<DescribeInstancesCommandOutput["Reservations"]> = [];

  do {
    const response = await client.send(
      new DescribeInstancesCommand({
        NextToken: nextToken,
      }),
    );

    allReservations.push(...(response.Reservations ?? []));
    nextToken = response.NextToken;
  } while (nextToken);

  return allReservations;
};

export async function listInstances(input: {
  tenantId: string;
  connectionId: string;
}): Promise<Ec2InstanceListItem[]> {
  const connectionContext = await resolveAwsConnectionContext(input.tenantId, input.connectionId);
  const client = await buildAssumedEc2Client(connectionContext);

  logger.info("AWS EC2 list instances requested", {
    action: "list",
    connectionId: connectionContext.connectionId,
  });

  try {
    const reservations = await listEc2Reservations(client);
    return flattenEc2Reservations(reservations);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AwsEc2Error("EC2_LIST_FAILED", "Unable to list EC2 instances.", 400, {
      connectionId: connectionContext.connectionId,
      reason,
    });
  }
}

const runEc2InstanceAction = async (input: {
  action: Ec2InstanceActionType;
  tenantId: string;
  connectionId: string;
  instanceId: string;
}): Promise<Ec2InstanceActionResult> => {
  const normalizedInstanceId = normalizeRequired(input.instanceId, "instanceId");
  const connectionContext = await resolveAwsConnectionContext(input.tenantId, input.connectionId);
  const client = await buildAssumedEc2Client(connectionContext);

  logger.info("AWS EC2 instance action requested", {
    action: input.action,
    instanceId: normalizedInstanceId,
    connectionId: connectionContext.connectionId,
  });

  try {
    if (input.action === "start") {
      await client.send(
        new StartInstancesCommand({
          InstanceIds: [normalizedInstanceId],
        }),
      );
    } else if (input.action === "stop") {
      await client.send(
        new StopInstancesCommand({
          InstanceIds: [normalizedInstanceId],
        }),
      );
    } else {
      await client.send(
        new RebootInstancesCommand({
          InstanceIds: [normalizedInstanceId],
        }),
      );
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AwsEc2Error("EC2_ACTION_FAILED", `Unable to ${input.action} EC2 instance.`, 400, {
      action: input.action,
      instanceId: normalizedInstanceId,
      connectionId: connectionContext.connectionId,
      reason,
    });
  }

  return {
    success: true,
    action: input.action,
    instanceId: normalizedInstanceId,
    message: `Instance ${input.action} initiated`,
  };
};

export async function startInstance(input: {
  tenantId: string;
  connectionId: string;
  instanceId: string;
}): Promise<Ec2InstanceActionResult> {
  return runEc2InstanceAction({
    action: "start",
    ...input,
  });
}

export async function stopInstance(input: {
  tenantId: string;
  connectionId: string;
  instanceId: string;
}): Promise<Ec2InstanceActionResult> {
  return runEc2InstanceAction({
    action: "stop",
    ...input,
  });
}

export async function rebootInstance(input: {
  tenantId: string;
  connectionId: string;
  instanceId: string;
}): Promise<Ec2InstanceActionResult> {
  return runEc2InstanceAction({
    action: "reboot",
    ...input,
  });
}
