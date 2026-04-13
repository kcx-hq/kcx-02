import { apiGet, apiPatch, apiPost } from "@/lib/api"

export type OrganizationUserStatus = "active" | "inactive" | "invited" | "pending_approval"

export type OrganizationUser = {
  id: string
  fullName: string
  email: string
  role: string
  status: OrganizationUserStatus | string
  invitedAt: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  isPrimaryAdmin: boolean
}

type OrganizationUsersResponse = {
  users: OrganizationUser[]
}

type OrganizationUserSingleResponse = {
  user: OrganizationUser
}

export async function fetchOrganizationUsers(): Promise<OrganizationUser[]> {
  const response = await apiGet<OrganizationUsersResponse>("/organization/users")
  return response.users
}

export async function inviteOrganizationUser(payload: {
  fullName: string
  email: string
  role: "member" | "admin"
}): Promise<OrganizationUser> {
  const response = await apiPost<OrganizationUserSingleResponse>("/organization/users/invite", payload)
  return response.user
}

export async function approveOrganizationUser(userId: string): Promise<OrganizationUser> {
  const response = await apiPatch<OrganizationUserSingleResponse>(`/organization/users/${userId}/approve`, {})
  return response.user
}

export async function updateOrganizationUserStatus(userId: string, status: "active" | "inactive"): Promise<OrganizationUser> {
  const response = await apiPatch<OrganizationUserSingleResponse>(`/organization/users/${userId}/status`, { status })
  return response.user
}

