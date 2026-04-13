import { Op } from "sequelize";

import { BadRequestError, NotFoundError } from "../../../../errors/http-errors.js";
import { CloudConnectionV2, CloudEvent, CloudtrailSource, sequelize } from "../../../../models/index.js";

type CloudConnectionInstance = InstanceType<typeof CloudConnectionV2>;
type CloudtrailSourceInstance = InstanceType<typeof CloudtrailSource>;

type RegisterCloudtrailObjectEventParams = {
  callbackToken: string;
  eventId?: string;
  accountId?: string;
  region?: string;
  roleArn?: string;
  bucketName: string;
  objectKey: string;
  sourceType: "aws_cloudtrail";
  schemaType: "cloudtrail_json";
  cadence: "event_driven";
  rawPayload: Record<string, unknown>;
};

type RegisterCloudtrailObjectEventResult = {
  queued: boolean;
  skipped: boolean;
  cloudEventId: string;
  cloudtrailSourceId: string;
};

const requireNonEmpty = (value: string | null | undefined, fieldName: string): string => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new BadRequestError(`${fieldName} is required`);
  }
  return normalized;
};

const normalizePrefix = (value: string | null | undefined): string => {
  const trimmed = String(value ?? "").trim().replace(/^\/+/, "");
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
};

const resolveCloudTrailSourceForObject = async ({
  connection,
  bucketName,
  objectKey,
}: {
  connection: CloudConnectionInstance;
  bucketName: string;
  objectKey: string;
}): Promise<CloudtrailSourceInstance> => {
  const candidates = await CloudtrailSource.findAll({
    where: {
      cloudConnectionId: connection.id,
      bucketName,
      status: {
        [Op.notIn]: ["inactive", "suspended"],
      },
    },
    order: [["updatedAt", "DESC"]],
  });

  if (candidates.length === 0) {
    throw new NotFoundError("CloudTrail source not found for connection and bucket");
  }

  const matched = candidates
    .map((source) => ({ source, normalizedPrefix: normalizePrefix(source.prefix) }))
    .filter(({ normalizedPrefix }) => normalizedPrefix.length === 0 || objectKey.startsWith(normalizedPrefix))
    .sort((a, b) => b.normalizedPrefix.length - a.normalizedPrefix.length);

  if (matched.length > 0) {
    return matched[0].source;
  }

  return candidates[0];
};

export async function registerCloudtrailObjectEvent(
  payload: RegisterCloudtrailObjectEventParams,
): Promise<RegisterCloudtrailObjectEventResult> {
  const callbackToken = requireNonEmpty(payload.callbackToken, "callbackToken");
  const bucketName = requireNonEmpty(payload.bucketName, "bucketName");
  const objectKey = requireNonEmpty(payload.objectKey, "objectKey");
  const normalizedAccountId = String(payload.accountId ?? "").trim();
  const normalizedRegion = String(payload.region ?? "").trim();
  const normalizedRoleArn = String(payload.roleArn ?? "").trim();

  const connection = await CloudConnectionV2.findOne({
    where: { callbackToken },
  });
  if (!connection) {
    throw new NotFoundError("Invalid callback token");
  }

  const storedCloudAccountId = String(connection.cloudAccountId ?? "").trim();
  if (normalizedAccountId && storedCloudAccountId && storedCloudAccountId !== normalizedAccountId) {
    throw new BadRequestError("Account id does not match the connected cloud account");
  }

  const storedRoleArn = String(connection.actionRoleArn ?? connection.billingRoleArn ?? "").trim();
  if (normalizedRoleArn && storedRoleArn && storedRoleArn !== normalizedRoleArn) {
    throw new BadRequestError("Role ARN does not match the connected role");
  }

  const cloudtrailSource = await resolveCloudTrailSourceForObject({
    connection,
    bucketName,
    objectKey,
  });

  const eventTime = new Date();
  const cloudEvent = await sequelize.transaction(async (transaction) => {
    await cloudtrailSource.update(
      {
        lastIngestedAt: eventTime,
        updatedAt: eventTime,
      },
      { transaction },
    );

    return CloudEvent.create(
      {
        tenantId: connection.tenantId,
        cloudConnectionId: connection.id,
        providerId: connection.providerId,
        eventTime,
        eventName: "cloudtrail_object_created",
        eventSource: "aws_cloudtrail",
        eventCategory: "cloudtrail_file_event",
        awsAccountId: normalizedAccountId || storedCloudAccountId || null,
        awsRegion: normalizedRegion || String(cloudtrailSource.bucketRegion ?? "").trim() || null,
        resourceId: `s3://${bucketName}/${objectKey}`,
        resourceName: objectKey,
        requestId: payload.eventId ?? null,
        metadataJson: {
          trigger_type: "cloudtrail_object_created",
          source_type: payload.sourceType,
          schema_type: payload.schemaType,
          cadence: payload.cadence,
          bucket_name: bucketName,
          object_key: objectKey,
          cloudtrail_source_id: cloudtrailSource.id,
        },
        rawPayload: payload.rawPayload,
        processingStatus: "pending",
      },
      { transaction },
    );
  });

  return {
    queued: true,
    skipped: false,
    cloudEventId: String(cloudEvent.id),
    cloudtrailSourceId: String(cloudtrailSource.id),
  };
}
