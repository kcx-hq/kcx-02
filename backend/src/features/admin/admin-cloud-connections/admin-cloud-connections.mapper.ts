import type {
  AdminCloudConnectionListItem,
  AdminCloudIntegrationMode,
  AdminCloudIntegrationStatus,
  AutomaticConnectionDetail,
  ManualConnectionDetail,
} from "./admin-cloud-connections.types.js";

type ListRow = {
  id: string;
  display_name: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  provider_id: number;
  provider_code: string;
  provider_name: string;
  connection_mode: string;
  status: string;
  status_message: string | null;
  error_message: string | null;
  cloud_account_id: string | null;
  payer_account_id: string | null;
  detail_record_type: string;
  detail_record_id: string;
  linked_billing_source_id: number | null;
  linked_billing_source_type: string | null;
  linked_billing_setup_mode: string | null;
  linked_billing_status: string | null;
  linked_last_file_received_at: string | null;
  linked_last_ingested_at: string | null;
  latest_run_id: number | null;
  latest_run_status: string | null;
  connected_at: string | null;
  last_validated_at: string | null;
  last_success_at: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

type AutomaticDetailRow = {
  id: string;
  connection_name: string;
  account_type: string;
  region: string | null;
  external_id: string | null;
  callback_token: string | null;
  stack_name: string | null;
  stack_id: string | null;
  billing_role_arn: string | null;
  action_role_arn: string | null;
  cloud_account_id: string | null;
  payer_account_id: string | null;
  export_name: string | null;
  export_bucket: string | null;
  export_prefix: string | null;
  export_region: string | null;
  export_arn: string | null;
  connected_at: string | null;
  last_validated_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type ManualDetailRow = {
  id: string;
  connection_name: string;
  aws_account_id: string;
  role_arn: string;
  external_id: string;
  bucket_name: string;
  prefix: string | null;
  report_name: string | null;
  validation_status: string;
  assume_role_success: boolean;
  status: string;
  last_validated_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

const toIsoOrNull = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const toIsoOrThrow = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(0).toISOString();
  return date.toISOString();
};

const normalizeMode = (value: string): AdminCloudIntegrationMode =>
  value === "manual" ? "manual" : "automatic";

const normalizeStatus = (value: string): AdminCloudIntegrationStatus => {
  if (value === "draft") return "draft";
  if (value === "connecting") return "connecting";
  if (value === "awaiting_validation") return "awaiting_validation";
  if (value === "active") return "active";
  if (value === "active_with_warnings") return "active_with_warnings";
  if (value === "failed") return "failed";
  if (value === "suspended") return "suspended";
  return "draft";
};

const maskCallbackToken = (token: string | null): string | null => {
  const normalized = String(token ?? "").trim();
  if (!normalized) return null;
  if (normalized.length <= 8) return "****";
  return `${"*".repeat(normalized.length - 6)}${normalized.slice(-6)}`;
};

export const mapAdminCloudConnectionListRow = (row: ListRow): AdminCloudConnectionListItem => {
  return {
    id: row.id,
    displayName: row.display_name,
    tenant: {
      id: row.tenant_id,
      name: row.tenant_name,
      slug: row.tenant_slug,
    },
    provider: {
      id: Number(row.provider_id),
      code: row.provider_code,
      name: row.provider_name,
    },
    mode: normalizeMode(row.connection_mode),
    status: normalizeStatus(row.status),
    statusMessage: row.status_message,
    errorMessage: row.error_message,
    cloudAccountId: row.cloud_account_id,
    payerAccountId: row.payer_account_id,
    detailRecordType: row.detail_record_type,
    detailRecordId: row.detail_record_id,
    billingSource: {
      linked: row.linked_billing_source_id !== null,
      id: row.linked_billing_source_id === null ? null : Number(row.linked_billing_source_id),
      sourceType: row.linked_billing_source_type,
      setupMode: row.linked_billing_setup_mode,
      status: row.linked_billing_status,
    },
    timestamps: {
      connectedAt: toIsoOrNull(row.connected_at),
      lastValidatedAt: toIsoOrNull(row.last_validated_at),
      lastSuccessAt: toIsoOrNull(row.last_success_at),
      lastCheckedAt: toIsoOrNull(row.last_checked_at),
      createdAt: toIsoOrThrow(row.created_at),
      updatedAt: toIsoOrThrow(row.updated_at),
    },
    latestIngestion: {
      hasData: row.latest_run_id !== null,
      lastFileReceivedAt: toIsoOrNull(row.linked_last_file_received_at),
      lastIngestedAt: toIsoOrNull(row.linked_last_ingested_at),
      latestRunId: row.latest_run_id === null ? null : Number(row.latest_run_id),
      latestRunStatus: row.latest_run_status,
    },
  };
};

export const mapAutomaticConnectionDetail = (row: AutomaticDetailRow): AutomaticConnectionDetail => ({
  kind: "automatic",
  id: row.id,
  connectionName: row.connection_name,
  accountType: row.account_type,
  region: row.region,
  externalId: row.external_id,
  callbackToken: maskCallbackToken(row.callback_token),
  stackName: row.stack_name,
  stackId: row.stack_id,
  billingRoleArn: row.billing_role_arn,
  actionRoleArn: row.action_role_arn,
  roleArn: row.billing_role_arn,
  cloudAccountId: row.cloud_account_id,
  payerAccountId: row.payer_account_id,
  export: {
    name: row.export_name,
    bucket: row.export_bucket,
    prefix: row.export_prefix,
    region: row.export_region,
    arn: row.export_arn,
  },
  connectedAt: toIsoOrNull(row.connected_at),
  lastValidatedAt: toIsoOrNull(row.last_validated_at),
  errorMessage: row.error_message,
  createdAt: toIsoOrThrow(row.created_at),
  updatedAt: toIsoOrThrow(row.updated_at),
});

export const mapManualConnectionDetail = (row: ManualDetailRow): ManualConnectionDetail => ({
  kind: "manual",
  id: row.id,
  connectionName: row.connection_name,
  awsAccountId: row.aws_account_id,
  roleArn: row.role_arn,
  externalId: row.external_id,
  bucketName: row.bucket_name,
  prefix: row.prefix,
  reportName: row.report_name,
  validationStatus: row.validation_status,
  assumeRoleSuccess: Boolean(row.assume_role_success),
  status: row.status,
  lastValidatedAt: toIsoOrNull(row.last_validated_at),
  errorMessage: row.error_message,
  createdAt: toIsoOrThrow(row.created_at),
  updatedAt: toIsoOrThrow(row.updated_at),
});

export { toIsoOrNull, toIsoOrThrow, normalizeMode, normalizeStatus };

