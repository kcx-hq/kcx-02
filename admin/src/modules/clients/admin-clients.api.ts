import { apiFetch } from "@/lib/api"

export type AdminClientSummary = {
  id: number
  firstName: string
  lastName: string
  email: string
  companyName: string | null
  heardAboutUs: string | null
  status: string
  source: string
  createdAt: string
  updatedAt: string
}

export async function fetchAdminClients(token: string): Promise<AdminClientSummary[]> {
  return apiFetch<AdminClientSummary[]>("/admin/clients", { method: "GET", token })
}
