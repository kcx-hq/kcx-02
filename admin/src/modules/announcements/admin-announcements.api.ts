import { apiFetch } from "@/lib/api"

export type AnnouncementStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED"
export type AnnouncementAudienceScope = "ALL" | "CLIENT_IDS" | "CLIENT_TIER"
export type AnnouncementAudienceTier = "PREMIUM" | "STANDARD"

export type AdminAnnouncement = {
  id: string
  title: string
  body: string
  status: AnnouncementStatus
  audience: "ALL"
  audience_scope: AnnouncementAudienceScope
  audience_client_ids?: string[] | null
  audience_tier?: AnnouncementAudienceTier | null
  publish_at: string | null
  expires_at: string | null
  created_by_admin_id: string | null
  created_at: string
  updated_at: string
}

export type AdminAnnouncementListResponse = {
  items: AdminAnnouncement[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export type AnnouncementPayload = {
  title?: string
  body?: string
  status?: AnnouncementStatus
  audience_scope?: AnnouncementAudienceScope
  audience_client_ids?: string[] | null
  audience_tier?: AnnouncementAudienceTier | null
  publish_at?: string | null
  expires_at?: string | null
}

type FetchAnnouncementsQuery = {
  page: number
  limit: number
  search?: string
  status?: AnnouncementStatus | ""
  sort?: "asc" | "desc"
}

function toQueryString(query: FetchAnnouncementsQuery): string {
  const params = new URLSearchParams()
  params.set("page", String(query.page))
  params.set("limit", String(query.limit))
  if (query.search?.trim()) params.set("search", query.search.trim())
  if (query.status) params.set("status", query.status)
  if (query.sort) params.set("sort", query.sort)
  return params.toString()
}

export async function fetchAnnouncements(token: string, query: FetchAnnouncementsQuery): Promise<AdminAnnouncementListResponse> {
  return apiFetch<AdminAnnouncementListResponse>(`/admin/announcements?${toQueryString(query)}`, {
    method: "GET",
    token,
  })
}

export async function createAnnouncement(token: string, payload: AnnouncementPayload): Promise<AdminAnnouncement> {
  return apiFetch<AdminAnnouncement>("/admin/announcements", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  })
}

export async function updateAnnouncement(token: string, id: string, payload: AnnouncementPayload): Promise<AdminAnnouncement> {
  return apiFetch<AdminAnnouncement>(`/admin/announcements/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  })
}

export async function publishAnnouncement(token: string, id: string): Promise<AdminAnnouncement> {
  return apiFetch<AdminAnnouncement>(`/admin/announcements/${id}/publish`, {
    method: "POST",
    token,
  })
}

export async function unpublishAnnouncement(token: string, id: string): Promise<AdminAnnouncement> {
  return apiFetch<AdminAnnouncement>(`/admin/announcements/${id}/unpublish`, {
    method: "POST",
    token,
  })
}

export async function archiveAnnouncement(token: string, id: string): Promise<AdminAnnouncement> {
  return apiFetch<AdminAnnouncement>(`/admin/announcements/${id}/archive`, {
    method: "POST",
    token,
  })
}
