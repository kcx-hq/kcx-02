import {
  DeleteSnapshotCommand,
  DeleteVolumeCommand,
  DescribeInstancesCommand,
  DescribeAddressesCommand,
  DescribeSnapshotsCommand,
  DescribeVolumesCommand,
  type DescribeAddressesCommandOutput,
  type DescribeInstancesCommandOutput,
  type DescribeSnapshotsCommandOutput,
  type DescribeVolumesCommandOutput,
  EC2Client,
  ModifyInstanceAttributeCommand,
  ReleaseAddressCommand,
  RebootInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  waitUntilInstanceRunning,
  waitUntilInstanceStopped,
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

type Ec2InstanceChangeTypeResult = {
  success: true;
  action: "change-instance-type";
  instanceId: string;
  previousInstanceType: string;
  targetInstanceType: string;
  initialState: string | null;
  finalState: string | null;
  steps: {
    stopInitiated: boolean;
    waitedForStopped: boolean;
    typeModified: boolean;
    startInitiated: boolean;
    waitedForRunning: boolean;
  };
  message: string;
};

type Ec2IdleActionResult = {
  success: true;
  action: "delete-volume" | "release-address" | "delete-snapshot";
  resourceId: string;
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

const WAIT_TIMEOUT_SECONDS = 300;
const ASG_GROUP_TAG_KEY = "aws:autoscaling:groupname";
const SUPPORTED_MODIFY_STATES = new Set(["running", "stopped"]);
const BLOCKED_MODIFY_STATES = new Set(["pending", "stopping", "shutting-down", "terminated"]);

const normalizeLower = (value: string | null | undefined): string =>
  String(value ?? "").trim().toLowerCase();

const isReasonableInstanceType = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized || normalized.length > 64) return false;
  if (!normalized.includes(".")) return false;
  return /^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(normalized);
};

const waitForState = async (input: {
  client: EC2Client;
  instanceId: string;
  state: "stopped" | "running";
  connectionId: string;
  timeoutSeconds?: number;
}): Promise<void> => {
  const timeoutSeconds = typeof input.timeoutSeconds === "number" && Number.isFinite(input.timeoutSeconds)
    ? Math.max(30, Math.trunc(input.timeoutSeconds))
    : WAIT_TIMEOUT_SECONDS;

  const waiterResult =
    input.state === "stopped"
      ? await waitUntilInstanceStopped(
          {
            client: input.client,
            maxWaitTime: timeoutSeconds,
          },
          { InstanceIds: [input.instanceId] },
        )
      : await waitUntilInstanceRunning(
          {
            client: input.client,
            maxWaitTime: timeoutSeconds,
          },
          { InstanceIds: [input.instanceId] },
        );

  if (waiterResult.state !== "SUCCESS") {
    throw new AwsEc2Error(
      "EC2_WAIT_TIMEOUT",
      `Timed out while waiting for instance to become ${input.state}.`,
      408,
      {
        connectionId: input.connectionId,
        instanceId: input.instanceId,
        targetState: input.state,
        waiterState: waiterResult.state,
      },
    );
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

const getInstanceById = async (input: {
  client: EC2Client;
  connectionId: string;
  instanceId: string;
}) => {
  let response: DescribeInstancesCommandOutput;
  try {
    response = await input.client.send(
      new DescribeInstancesCommand({
        InstanceIds: [input.instanceId],
      }),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AwsEc2Error("EC2_DESCRIBE_FAILED", "Unable to load EC2 instance details.", 400, {
      connectionId: input.connectionId,
      instanceId: input.instanceId,
      reason,
    });
  }

  const instance = response.Reservations?.[0]?.Instances?.[0];
  if (!instance?.InstanceId) {
    throw new AwsEc2Error("EC2_INSTANCE_NOT_FOUND", "EC2 instance not found in selected connection.", 404, {
      connectionId: input.connectionId,
      instanceId: input.instanceId,
    });
  }

  return instance;
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

export async function changeInstanceType(input: {
  tenantId: string;
  connectionId: string;
  instanceId: string;
  targetInstanceType: string;
}): Promise<Ec2InstanceChangeTypeResult> {
  const normalizedInstanceId = normalizeRequired(input.instanceId, "instanceId");
  const normalizedTargetInstanceType = normalizeRequired(
    input.targetInstanceType,
    "targetInstanceType",
  );

  if (!isReasonableInstanceType(normalizedTargetInstanceType)) {
    throw new AwsEc2Error("EC2_INVALID_INSTANCE_TYPE", "targetInstanceType format is invalid.", 400, {
      targetInstanceType: normalizedTargetInstanceType,
    });
  }

  const connectionContext = await resolveAwsConnectionContext(input.tenantId, input.connectionId);
  const client = await buildAssumedEc2Client(connectionContext);

  logger.info("AWS EC2 change instance type requested", {
    action: "change-instance-type",
    instanceId: normalizedInstanceId,
    targetInstanceType: normalizedTargetInstanceType,
    connectionId: connectionContext.connectionId,
  });

  const instance = await getInstanceById({
    client,
    connectionId: connectionContext.connectionId,
    instanceId: normalizedInstanceId,
  });

  const currentType = String(instance.InstanceType ?? "").trim();
  const normalizedState = normalizeLower(instance.State?.Name ?? null);
  const tags =
    (instance.Tags ?? []).reduce<Record<string, string>>((accumulator, tag) => {
      const key = normalizeLower(tag.Key ?? null);
      const value = String(tag.Value ?? "").trim();
      if (key && value) accumulator[key] = value;
      return accumulator;
    }, {}) ?? {};

  if (!currentType) {
    throw new AwsEc2Error(
      "EC2_CURRENT_INSTANCE_TYPE_MISSING",
      "Unable to determine current instance type for this EC2 instance.",
      422,
      {
        instanceId: normalizedInstanceId,
      },
    );
  }

  if (currentType === normalizedTargetInstanceType) {
    throw new AwsEc2Error(
      "EC2_INSTANCE_TYPE_ALREADY_SET",
      "Target instance type is same as current instance type.",
      409,
      {
        instanceId: normalizedInstanceId,
        currentInstanceType: currentType,
        targetInstanceType: normalizedTargetInstanceType,
      },
    );
  }

  if (tags[ASG_GROUP_TAG_KEY]) {
    throw new AwsEc2Error(
      "EC2_ASG_MANAGED_INSTANCE",
      "Instance is managed by Auto Scaling Group and is blocked for manual rightsizing test action.",
      409,
      {
        instanceId: normalizedInstanceId,
        autoScalingGroupName: tags[ASG_GROUP_TAG_KEY],
      },
    );
  }

  if (BLOCKED_MODIFY_STATES.has(normalizedState)) {
    throw new AwsEc2Error(
      "EC2_INSTANCE_STATE_NOT_SUPPORTED",
      `Instance state '${normalizedState}' is not supported for instance-type change.`,
      409,
      {
        instanceId: normalizedInstanceId,
        state: normalizedState,
      },
    );
  }

  if (!SUPPORTED_MODIFY_STATES.has(normalizedState)) {
    throw new AwsEc2Error(
      "EC2_INSTANCE_STATE_UNKNOWN",
      "Instance state is not eligible for type change operation.",
      409,
      {
        instanceId: normalizedInstanceId,
        state: normalizedState,
      },
    );
  }

  const wasRunning = normalizedState === "running";
  const steps: Ec2InstanceChangeTypeResult["steps"] = {
    stopInitiated: false,
    waitedForStopped: false,
    typeModified: false,
    startInitiated: false,
    waitedForRunning: false,
  };

  try {
    if (wasRunning) {
      await client.send(
        new StopInstancesCommand({
          InstanceIds: [normalizedInstanceId],
        }),
      );
      steps.stopInitiated = true;

      await waitForState({
        client,
        instanceId: normalizedInstanceId,
        state: "stopped",
        connectionId: connectionContext.connectionId,
      });
      steps.waitedForStopped = true;
    }

    await client.send(
      new ModifyInstanceAttributeCommand({
        InstanceId: normalizedInstanceId,
        InstanceType: {
          Value: normalizedTargetInstanceType,
        },
      }),
    );
    steps.typeModified = true;

    if (wasRunning) {
      await client.send(
        new StartInstancesCommand({
          InstanceIds: [normalizedInstanceId],
        }),
      );
      steps.startInitiated = true;

      await waitForState({
        client,
        instanceId: normalizedInstanceId,
        state: "running",
        connectionId: connectionContext.connectionId,
      });
      steps.waitedForRunning = true;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn("AWS EC2 change instance type failed", {
      connectionId: connectionContext.connectionId,
      instanceId: normalizedInstanceId,
      targetInstanceType: normalizedTargetInstanceType,
      reason,
      steps,
    });

    if (error instanceof AwsEc2Error) {
      throw error;
    }

    throw new AwsEc2Error(
      "EC2_CHANGE_INSTANCE_TYPE_FAILED",
      "Unable to complete instance-type change workflow.",
      400,
      {
        connectionId: connectionContext.connectionId,
        instanceId: normalizedInstanceId,
        targetInstanceType: normalizedTargetInstanceType,
        reason,
        steps,
      },
    );
  }

  const finalInstance = await getInstanceById({
    client,
    connectionId: connectionContext.connectionId,
    instanceId: normalizedInstanceId,
  });
  const finalState = normalizeLower(finalInstance.State?.Name ?? null) || null;

  logger.info("AWS EC2 change instance type completed", {
    action: "change-instance-type",
    connectionId: connectionContext.connectionId,
    instanceId: normalizedInstanceId,
    previousInstanceType: currentType,
    targetInstanceType: normalizedTargetInstanceType,
    finalState,
    steps,
  });

  return {
    success: true,
    action: "change-instance-type",
    instanceId: normalizedInstanceId,
    previousInstanceType: currentType,
    targetInstanceType: normalizedTargetInstanceType,
    initialState: normalizedState || null,
    finalState,
    steps,
    message: `Instance type changed from ${currentType} to ${normalizedTargetInstanceType}.`,
  };
}

export async function deleteVolume(input: {
  tenantId: string;
  connectionId: string;
  volumeId: string;
}): Promise<Ec2IdleActionResult> {
  const normalizedVolumeId = normalizeRequired(input.volumeId, "volumeId");
  const connectionContext = await resolveAwsConnectionContext(input.tenantId, input.connectionId);
  const client = await buildAssumedEc2Client(connectionContext);

  let describeResponse: DescribeVolumesCommandOutput;
  try {
    describeResponse = await client.send(
      new DescribeVolumesCommand({
        VolumeIds: [normalizedVolumeId],
      }),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AwsEc2Error("EC2_DESCRIBE_VOLUME_FAILED", "Unable to load EBS volume details.", 400, {
      connectionId: connectionContext.connectionId,
      volumeId: normalizedVolumeId,
      reason,
    });
  }

  const volume = (describeResponse.Volumes ?? [])[0];
  if (!volume?.VolumeId) {
    throw new AwsEc2Error("EC2_VOLUME_NOT_FOUND", "EBS volume not found in selected connection.", 404, {
      connectionId: connectionContext.connectionId,
      volumeId: normalizedVolumeId,
    });
  }

  const state = normalizeLower(String(volume.State ?? ""));
  const attachments = Array.isArray(volume.Attachments) ? volume.Attachments : [];
  if (state !== "available" || attachments.length > 0) {
    throw new AwsEc2Error(
      "EC2_VOLUME_NOT_IDLE",
      "Volume is not eligible for deletion (must be available and unattached).",
      409,
      {
        connectionId: connectionContext.connectionId,
        volumeId: normalizedVolumeId,
        state,
        attachmentCount: attachments.length,
      },
    );
  }

  try {
    await client.send(
      new DeleteVolumeCommand({
        VolumeId: normalizedVolumeId,
      }),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AwsEc2Error("EC2_DELETE_VOLUME_FAILED", "Unable to delete EBS volume.", 400, {
      connectionId: connectionContext.connectionId,
      volumeId: normalizedVolumeId,
      reason,
    });
  }

  return {
    success: true,
    action: "delete-volume",
    resourceId: normalizedVolumeId,
    message: `Volume ${normalizedVolumeId} deleted.`,
  };
}

export async function releaseAddress(input: {
  tenantId: string;
  connectionId: string;
  resourceId: string;
}): Promise<Ec2IdleActionResult> {
  const normalizedResourceId = normalizeRequired(input.resourceId, "resourceId");
  const connectionContext = await resolveAwsConnectionContext(input.tenantId, input.connectionId);
  const client = await buildAssumedEc2Client(connectionContext);

  const isAllocationId = normalizedResourceId.startsWith("eipalloc-");

  let describeResponse: DescribeAddressesCommandOutput;
  try {
    describeResponse = await client.send(
      new DescribeAddressesCommand(
        isAllocationId
          ? { AllocationIds: [normalizedResourceId] }
          : { PublicIps: [normalizedResourceId] },
      ),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AwsEc2Error("EC2_DESCRIBE_ADDRESS_FAILED", "Unable to load Elastic IP details.", 400, {
      connectionId: connectionContext.connectionId,
      resourceId: normalizedResourceId,
      reason,
    });
  }

  const address = (describeResponse.Addresses ?? [])[0];
  if (!address) {
    throw new AwsEc2Error("EC2_ADDRESS_NOT_FOUND", "Elastic IP not found in selected connection.", 404, {
      connectionId: connectionContext.connectionId,
      resourceId: normalizedResourceId,
    });
  }

  const associationId = String(address.AssociationId ?? "").trim();
  const instanceId = String(address.InstanceId ?? "").trim();
  const networkInterfaceId = String(address.NetworkInterfaceId ?? "").trim();
  if (associationId || instanceId || networkInterfaceId) {
    throw new AwsEc2Error(
      "EC2_ADDRESS_NOT_IDLE",
      "Elastic IP is associated and cannot be released.",
      409,
      {
        connectionId: connectionContext.connectionId,
        resourceId: normalizedResourceId,
        associationId: associationId || null,
        instanceId: instanceId || null,
        networkInterfaceId: networkInterfaceId || null,
      },
    );
  }

  const allocationId = String(address.AllocationId ?? "").trim();
  const publicIp = String(address.PublicIp ?? "").trim();
  if (!allocationId && !publicIp) {
    throw new AwsEc2Error(
      "EC2_ADDRESS_IDENTIFIER_MISSING",
      "Elastic IP has no releasable identifier.",
      422,
      {
        connectionId: connectionContext.connectionId,
        resourceId: normalizedResourceId,
      },
    );
  }

  try {
    await client.send(
      new ReleaseAddressCommand(allocationId ? { AllocationId: allocationId } : { PublicIp: publicIp }),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AwsEc2Error("EC2_RELEASE_ADDRESS_FAILED", "Unable to release Elastic IP.", 400, {
      connectionId: connectionContext.connectionId,
      resourceId: normalizedResourceId,
      allocationId: allocationId || null,
      publicIp: publicIp || null,
      reason,
    });
  }

  return {
    success: true,
    action: "release-address",
    resourceId: allocationId || publicIp || normalizedResourceId,
    message: `Elastic IP ${allocationId || publicIp || normalizedResourceId} released.`,
  };
}

export async function deleteSnapshot(input: {
  tenantId: string;
  connectionId: string;
  snapshotId: string;
}): Promise<Ec2IdleActionResult> {
  const normalizedSnapshotId = normalizeRequired(input.snapshotId, "snapshotId");
  const connectionContext = await resolveAwsConnectionContext(input.tenantId, input.connectionId);
  const client = await buildAssumedEc2Client(connectionContext);

  let describeResponse: DescribeSnapshotsCommandOutput;
  try {
    describeResponse = await client.send(
      new DescribeSnapshotsCommand({
        SnapshotIds: [normalizedSnapshotId],
        OwnerIds: ["self"],
      }),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AwsEc2Error("EC2_DESCRIBE_SNAPSHOT_FAILED", "Unable to load snapshot details.", 400, {
      connectionId: connectionContext.connectionId,
      snapshotId: normalizedSnapshotId,
      reason,
    });
  }

  const snapshot = (describeResponse.Snapshots ?? [])[0];
  if (!snapshot?.SnapshotId) {
    throw new AwsEc2Error(
      "EC2_SNAPSHOT_NOT_FOUND",
      "Snapshot not found in selected connection or not owned by this account.",
      404,
      {
        connectionId: connectionContext.connectionId,
        snapshotId: normalizedSnapshotId,
      },
    );
  }

  try {
    await client.send(
      new DeleteSnapshotCommand({
        SnapshotId: normalizedSnapshotId,
      }),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AwsEc2Error("EC2_DELETE_SNAPSHOT_FAILED", "Unable to delete snapshot.", 400, {
      connectionId: connectionContext.connectionId,
      snapshotId: normalizedSnapshotId,
      reason,
    });
  }

  return {
    success: true,
    action: "delete-snapshot",
    resourceId: normalizedSnapshotId,
    message: `Snapshot ${normalizedSnapshotId} deleted.`,
  };
}
