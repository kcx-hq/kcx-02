import { apiGet } from "@/lib/api"

export type UploadHistoryStatus = "queued" | "processing" | "completed" | "warning" | "failed"

export type TenantUploadHistoryRecord = {
  id: string
  rawBillingFileId: string
  fileName: string
  fileType: string
  status: UploadHistoryStatus | string
  uploadedAt: string | null
  uploadedBy: string | null
  totalRows: number
  processedRows: number
  failedRows: number
  tenantId: string
}

export async function getTenantUploadHistory(): Promise<TenantUploadHistoryRecord[]> {
  return apiGet<TenantUploadHistoryRecord[]>("/billing/uploads/history")
}
