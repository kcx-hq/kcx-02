import { apiFetch } from "@/lib/api"

export type AdminClientV1 = {
  id: string
  fullName: string
  email: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
  tenant: {
    name: string | null
    slug: string | null
    status: string | null
  }
  platformContext?: {
    cloudConnection: {
      exists: boolean
      providerName: string | null
      status: string | null
      setupType: string | null
      cloudAccountId: string | null
      lastValidatedAt: string | null
      lastSuccessAt: string | null
      lastCheckedAt: string | null
    }
    billing: {
      sourceExists: boolean
      dataExists: boolean
      lastUploadAt: string | null
      lastIngestedAt: string | null
      totalFiles: number
      totalFilesUploaded: number
      totalFilesProcessed: number
      totalFilesIngested: number
      latestRunStatus: string | null
      latestRunAt: string | null
      latestRunErrorSummary: string | null
      latestRunFailedRows: number | null
      latestFileName: string | null
    }
  }
}

export async function fetchAdminClients(token: string): Promise<AdminClientV1[]> {
  return apiFetch<AdminClientV1[]>("/admin/clients", { method: "GET", token })
}
