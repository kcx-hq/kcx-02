import crypto from "node:crypto";

type SourceCloudFileEvent = {
  tenantId: string;
  cloudConnectionId: string;
  providerId: string;
  awsAccountId: string | null;
  awsRegion: string | null;
  eventTime: Date;
};

type CloudtrailRecord = Record<string, unknown>;

type MappedCloudEventInsert = {
  tenantId: string;
  cloudConnectionId: string;
  providerId: string;
  eventTime: Date;
  eventName: string;
  eventSource: string | null;
  eventCategory: string;
  awsAccountId: string | null;
  awsRegion: string | null;
  resourceId: string | null;
  resourceName: string | null;
  userArn: string | null;
  userType: string | null;
  requestId: string | null;
  metadataJson: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  eventFingerprint: string;
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry)) as Record<
    string,
    unknown
  >[];
};

const resolveResourceFromRequestParameters = (requestParameters: Record<string, unknown> | null): string | null => {
  if (!requestParameters) return null;

  const directResourceId =
    asNonEmptyString(requestParameters.resourceId) ??
    asNonEmptyString(requestParameters.instanceId) ??
    asNonEmptyString(requestParameters.volumeId) ??
    asNonEmptyString(requestParameters.bucketName);
  if (directResourceId) return directResourceId;

  const instancesSet = asRecord(requestParameters.instancesSet);
  const items = asRecordArray(instancesSet?.items);
  for (const item of items) {
    const instanceId = asNonEmptyString(item.instanceId);
    if (instanceId) return instanceId;
  }

  return null;
};

const resolveResourceId = (record: CloudtrailRecord): string | null => {
  const resources = asRecordArray(record.resources);
  if (resources.length > 0) {
    const first = resources[0];
    return (
      asNonEmptyString(first.ARN) ??
      asNonEmptyString(first.arn) ??
      asNonEmptyString(first.resourceName) ??
      asNonEmptyString(first.resourceId)
    );
  }

  const requestParameters = asRecord(record.requestParameters);
  return resolveResourceFromRequestParameters(requestParameters);
};

const resolveResourceName = (record: CloudtrailRecord): string | null => {
  const resources = asRecordArray(record.resources);
  if (resources.length > 0) {
    const first = resources[0];
    return asNonEmptyString(first.resourceName) ?? asNonEmptyString(first.resourceId) ?? asNonEmptyString(first.ARN);
  }

  const requestParameters = asRecord(record.requestParameters);
  return (
    asNonEmptyString(requestParameters?.resourceName) ??
    asNonEmptyString(requestParameters?.instanceId) ??
    asNonEmptyString(requestParameters?.bucketName)
  );
};

const resolveEventTime = (record: CloudtrailRecord, fallback: Date): Date => {
  const rawEventTime = asNonEmptyString(record.eventTime);
  if (!rawEventTime) return fallback;
  const parsed = new Date(rawEventTime);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const computeEventFingerprint = ({
  cloudConnectionId,
  eventTimeIso,
  eventName,
  requestId,
  eventSource,
}: {
  cloudConnectionId: string;
  eventTimeIso: string;
  eventName: string;
  requestId: string;
  eventSource: string;
}): string => {
  const seed = [cloudConnectionId, eventTimeIso, eventName, requestId, eventSource].join("|");
  return crypto.createHash("sha256").update(seed).digest("hex");
};

export function mapCloudtrailRecordToCloudEventInsert(input: {
  source: SourceCloudFileEvent;
  record: CloudtrailRecord;
}): MappedCloudEventInsert {
  const { source, record } = input;
  const eventTime = resolveEventTime(record, source.eventTime);
  const eventName = asNonEmptyString(record.eventName) ?? "unknown";
  const eventSource = asNonEmptyString(record.eventSource);
  const requestId = asNonEmptyString(record.requestID);
  const userIdentity = asRecord(record.userIdentity);

  const eventFingerprint = computeEventFingerprint({
    cloudConnectionId: source.cloudConnectionId,
    eventTimeIso: eventTime.toISOString(),
    eventName,
    requestId: requestId ?? "",
    eventSource: eventSource ?? "",
  });

  return {
    tenantId: source.tenantId,
    cloudConnectionId: source.cloudConnectionId,
    providerId: source.providerId,
    eventTime,
    eventName,
    eventSource,
    eventCategory: asNonEmptyString(record.eventCategory) ?? "management",
    awsAccountId: asNonEmptyString(record.recipientAccountId) ?? source.awsAccountId,
    awsRegion: asNonEmptyString(record.awsRegion) ?? source.awsRegion,
    resourceId: resolveResourceId(record),
    resourceName: resolveResourceName(record),
    userArn: asNonEmptyString(userIdentity?.arn),
    userType: asNonEmptyString(userIdentity?.type),
    requestId,
    metadataJson: {
      eventVersion: record.eventVersion ?? null,
      readOnly: record.readOnly ?? null,
      sourceIPAddress: record.sourceIPAddress ?? null,
      userAgent: record.userAgent ?? null,
      recipientAccountId: record.recipientAccountId ?? null,
      managementEvent: record.managementEvent ?? null,
      eventType: record.eventType ?? null,
    },
    rawPayload: record,
    eventFingerprint,
  };
}
