import { useQuery } from "@tanstack/react-query"

import {
  getTenantUploadHistory,
  type TenantUploadHistoryRecord,
} from "@/features/client-home/api/upload-history.api"

export const TENANT_UPLOAD_HISTORY_QUERY_KEY = ["billing", "upload-history"] as const

export function useTenantUploadHistory(enabled = true) {
  return useQuery<TenantUploadHistoryRecord[]>({
    queryKey: TENANT_UPLOAD_HISTORY_QUERY_KEY,
    queryFn: getTenantUploadHistory,
    enabled,
  })
}
