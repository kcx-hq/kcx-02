import { apiGet } from "@/lib/api"

export type CloudIntegrationStatus =
  | "draft"
  | "connecting"
  | "awaiting_validation"
  | "active"
  | "active_with_warnings"
  | "failed"
  | "suspended"

export type CloudIntegrationListItem = {
  id: string
  tenant_id: string
  created_by: string | null
  provider_id: string
  provider: {
    id: string
    code: string
    name: string
  } | null
  connection_mode: "manual" | "automatic"
  display_name: string
  status: CloudIntegrationStatus
  detail_record_id: string
  detail_record_type: string
  cloud_account_id: string | null
  payer_account_id: string | null
  last_validated_at: string | null
  last_success_at: string | null
  last_checked_at: string | null
  status_message: string | null
  error_message: string | null
  connected_at: string | null
  created_at: string | null
  updated_at: string | null
}

export async function getTenantCloudIntegrations() {
  return apiGet<CloudIntegrationListItem[]>("/cloud-integrations")
}
