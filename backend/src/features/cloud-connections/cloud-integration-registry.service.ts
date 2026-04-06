import {
  CloudConnectionV2,
  CloudIntegration,
  CloudProvider,
  ManualCloudConnection,
} from "../../models/index.js";
import type {
  CloudIntegrationStatus,
  CloudIntegrationMode,
} from "../../models/cloud-integration.js";

type CloudIntegrationDetailRecordType = "manual_cloud_connection" | "automatic_cloud_connection";

type CloudIntegrationUpsertInput = {
  tenantId: string;
  createdBy: string | null;
  providerId: string;
  connectionMode: CloudIntegrationMode;
  displayName: string;
  status: CloudIntegrationStatus;
  detailRecordId: string;
  detailRecordType: CloudIntegrationDetailRecordType;
  cloudAccountId: string | null;
  payerAccountId: string | null;
  lastValidatedAt: Date | null;
  lastSuccessAt: Date | null;
  lastCheckedAt: Date | null;
  statusMessage: string | null;
  errorMessage: string | null;
  connectedAt: Date | null;
};

type CloudConnectionV2Instance = InstanceType<typeof CloudConnectionV2>;
type ManualCloudConnectionInstance = InstanceType<typeof ManualCloudConnection>;

const MAX_DISPLAY_NAME_ATTEMPTS = 50;

const isCloudIntegrationStatus = (value: string): value is CloudIntegrationStatus =>
  value === "draft" ||
  value === "connecting" ||
  value === "awaiting_validation" ||
  value === "active" ||
  value === "active_with_warnings" ||
  value === "failed" ||
  value === "suspended";

const getFallbackStatusMessage = (status: CloudIntegrationStatus, errorMessage?: string | null) => {
  if (status === "failed") return errorMessage?.trim() || "Connection Failed";
  if (status === "draft") return "Setup In Progress";
  if (status === "connecting") return "Connecting";
  if (status === "awaiting_validation") return "Awaiting Validation";
  if (status === "active") return "Pending First Ingest";
  if (status === "active_with_warnings") return "Warnings Detected";
  return "Suspended";
};

const normalizeAutomaticStatus = (status: string): CloudIntegrationStatus => {
  if (isCloudIntegrationStatus(status)) return status;
  return "draft";
};

const mapManualStatus = (record: ManualCloudConnectionInstance): CloudIntegrationStatus => {
  const status = String(record.status ?? "").toLowerCase();
  const validationStatus = String(record.validationStatus ?? "").toLowerCase();
  const assumeRoleSuccess = Boolean(record.assumeRoleSuccess);
  const hasError = Boolean(record.errorMessage && record.errorMessage.trim().length > 0);

  if (status === "failed" || validationStatus === "failed" || (!assumeRoleSuccess && hasError)) {
    return "failed";
  }
  if (assumeRoleSuccess) {
    return "active";
  }
  if (status === "awaiting_validation" || validationStatus === "pending") {
    return "awaiting_validation";
  }
  if (status === "suspended") {
    return "suspended";
  }
  return "draft";
};

const buildUniqueDisplayNameCandidate = (
  baseDisplayName: string,
  connectionMode: CloudIntegrationMode,
  attempt: number,
) => {
  if (attempt === 0) return baseDisplayName;
  if (attempt === 1) return `${baseDisplayName} (${connectionMode})`;
  return `${baseDisplayName} (${connectionMode} ${attempt})`;
};

const resolveUniqueDisplayName = async (input: {
  tenantId: string;
  detailRecordType: CloudIntegrationDetailRecordType;
  detailRecordId: string;
  displayName: string;
  connectionMode: CloudIntegrationMode;
}) => {
  const normalizedBase = input.displayName.trim() || `${input.connectionMode}-${input.detailRecordId.slice(0, 8)}`;

  for (let attempt = 0; attempt < MAX_DISPLAY_NAME_ATTEMPTS; attempt += 1) {
    const candidate = buildUniqueDisplayNameCandidate(normalizedBase, input.connectionMode, attempt);
    const existing = await CloudIntegration.findOne({
      where: {
        tenantId: input.tenantId,
        displayName: candidate,
      },
    });

    if (!existing) return candidate;
    if (
      existing.detailRecordType === input.detailRecordType &&
      existing.detailRecordId === input.detailRecordId
    ) {
      return candidate;
    }
  }

  return `${normalizedBase} (${input.connectionMode}-${input.detailRecordId.slice(0, 8)})`;
};

export const upsertCloudIntegrationRegistry = async (input: CloudIntegrationUpsertInput) => {
  const existing = await CloudIntegration.findOne({
    where: {
      detailRecordType: input.detailRecordType,
      detailRecordId: input.detailRecordId,
    },
  });

  const displayName = await resolveUniqueDisplayName({
    tenantId: input.tenantId,
    detailRecordType: input.detailRecordType,
    detailRecordId: input.detailRecordId,
    displayName: input.displayName,
    connectionMode: input.connectionMode,
  });

  const payload = {
    tenantId: input.tenantId,
    createdBy: input.createdBy,
    providerId: input.providerId,
    connectionMode: input.connectionMode,
    displayName,
    status: input.status,
    detailRecordId: input.detailRecordId,
    detailRecordType: input.detailRecordType,
    cloudAccountId: input.cloudAccountId,
    payerAccountId: input.payerAccountId,
    lastValidatedAt: input.lastValidatedAt,
    lastSuccessAt: input.lastSuccessAt,
    lastCheckedAt: input.lastCheckedAt ?? new Date(),
    statusMessage: input.statusMessage,
    errorMessage: input.errorMessage,
    connectedAt: input.connectedAt,
  };

  if (existing) {
    await existing.update(payload);
    return existing;
  }

  return CloudIntegration.create(payload);
};

export const syncAutomaticCloudIntegration = async (
  connection: CloudConnectionV2Instance,
  options?: {
    status?: CloudIntegrationStatus;
    statusMessage?: string | null;
    errorMessage?: string | null;
    lastCheckedAt?: Date | null;
    lastValidatedAt?: Date | null;
    lastSuccessAt?: Date | null;
  },
) => {
  const status = options?.status ?? normalizeAutomaticStatus(String(connection.status ?? ""));
  const statusMessage =
    options?.statusMessage ??
    getFallbackStatusMessage(status, options?.errorMessage ?? connection.errorMessage ?? null);
  const errorMessage = options?.errorMessage ?? connection.errorMessage ?? null;
  const lastValidatedAt = options?.lastValidatedAt ?? connection.lastValidatedAt ?? null;
  const lastCheckedAt = options?.lastCheckedAt ?? lastValidatedAt ?? new Date();
  const lastSuccessAt =
    options?.lastSuccessAt ??
    (status === "active" || status === "active_with_warnings" ? lastValidatedAt : null);

  return upsertCloudIntegrationRegistry({
    tenantId: connection.tenantId,
    createdBy: connection.createdBy ?? null,
    providerId: String(connection.providerId),
    connectionMode: "automatic",
    displayName: connection.connectionName,
    status,
    detailRecordId: connection.id,
    detailRecordType: "automatic_cloud_connection",
    cloudAccountId: connection.cloudAccountId ?? null,
    payerAccountId: connection.payerAccountId ?? null,
    lastValidatedAt,
    lastSuccessAt,
    lastCheckedAt,
    statusMessage,
    errorMessage,
    connectedAt: connection.connectedAt ?? null,
  });
};

export const resolveAwsProviderId = async (): Promise<string> => {
  const [provider] = await CloudProvider.findOrCreate({
    where: { code: "aws" },
    defaults: {
      code: "aws",
      name: "Amazon Web Services",
      status: "active",
    },
  });
  return String(provider.id);
};

export const syncManualCloudIntegration = async (
  record: ManualCloudConnectionInstance,
  options?: { providerId?: string; statusMessage?: string | null; lastCheckedAt?: Date | null },
) => {
  const providerId = options?.providerId ?? (await resolveAwsProviderId());
  const status = mapManualStatus(record);
  const statusMessage =
    options?.statusMessage ?? getFallbackStatusMessage(status, record.errorMessage ?? null);
  const lastValidatedAt = record.lastValidatedAt ?? null;
  const lastCheckedAt = options?.lastCheckedAt ?? lastValidatedAt ?? record.updatedAt ?? record.createdAt ?? null;
  const lastSuccessAt = status === "active" ? lastValidatedAt : null;
  const connectedAt = status === "active" ? lastValidatedAt : null;

  return upsertCloudIntegrationRegistry({
    tenantId: record.tenantId,
    createdBy: record.createdBy ?? null,
    providerId,
    connectionMode: "manual",
    displayName: record.connectionName,
    status,
    detailRecordId: record.id,
    detailRecordType: "manual_cloud_connection",
    cloudAccountId: record.awsAccountId ?? null,
    payerAccountId: null,
    lastValidatedAt,
    lastSuccessAt,
    lastCheckedAt,
    statusMessage,
    errorMessage: record.errorMessage ?? null,
    connectedAt,
  });
};

