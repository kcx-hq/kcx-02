import { useQuery } from "@tanstack/react-query"

import {
  getTenantCloudIntegrations,
  type CloudIntegrationListItem,
} from "@/features/client-home/api/cloud-integrations.api"

export const TENANT_CLOUD_INTEGRATIONS_QUERY_KEY = ["billing", "cloud-integrations"] as const

export function useTenantCloudIntegrations(enabled = true) {
  return useQuery<CloudIntegrationListItem[]>({
    queryKey: TENANT_CLOUD_INTEGRATIONS_QUERY_KEY,
    queryFn: getTenantCloudIntegrations,
    enabled,
  })
}
