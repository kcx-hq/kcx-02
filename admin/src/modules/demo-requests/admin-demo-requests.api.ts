import { apiFetch } from "@/lib/api"

export type AdminDemoRequestSummary = {
  id: number
  status: string
  slotStart: string | null
  slotEnd: string | null
  calcomBookingId: string | null
  calcomReservationId: string | null
  meetingUrl: string | null
  createdAt: string
  updatedAt: string
  client: {
    id: number
    firstName: string
    lastName: string
    email: string
    companyName: string | null
    heardAboutUs: string | null
  }
  reservation: {
    id: number
    status: string
    slotStart: string
    slotEnd: string
    reservationExpiresAt: string
    calcomReservationId: string
    updatedAt: string
  } | null
}

export type AdminDemoRequestActionResult = {
  demoRequest: AdminDemoRequestSummary
  emailSent: boolean
}

export type AdminSupportMeetingSummary = {
  id: string
  meeting_code: string
  meeting_type: string
  agenda: string
  mode: string
  status: "REQUESTED" | "SCHEDULED" | "RESCHEDULED" | "COMPLETED" | "CANCELLED" | "REJECTED"
  slot_start: string
  slot_end: string
  time_zone: string
  meeting_url: string | null
  after_meeting_summary: string | null
  created_at: string
  updated_at: string
  client: {
    id: string
    name: string
    email: string | null
    company_name: string | null
  }
}

export async function fetchAdminDemoRequests(token: string): Promise<AdminDemoRequestSummary[]> {
  return apiFetch<AdminDemoRequestSummary[]>("/admin/demo-requests", { method: "GET", token })
}

export async function fetchAdminDemoRequestById(token: string, id: number): Promise<AdminDemoRequestSummary> {
  return apiFetch<AdminDemoRequestSummary>(`/admin/demo-requests/${id}`, { method: "GET", token })
}

export async function confirmAdminDemoRequest(token: string, id: number): Promise<AdminDemoRequestActionResult> {
  return apiFetch<AdminDemoRequestActionResult>(`/admin/demo-requests/${id}/confirm`, { method: "PATCH", token })
}

export async function rejectAdminDemoRequest(token: string, id: number): Promise<AdminDemoRequestActionResult> {
  return apiFetch<AdminDemoRequestActionResult>(`/admin/demo-requests/${id}/reject`, { method: "PATCH", token })
}

export async function fetchAdminSupportMeetings(token: string): Promise<AdminSupportMeetingSummary[]> {
  return apiFetch<AdminSupportMeetingSummary[]>("/admin/support-meetings", { method: "GET", token })
}

export async function approveAdminSupportMeeting(
  token: string,
  meetingId: string,
  payload?: { meetingUrl?: string }
): Promise<AdminSupportMeetingSummary> {
  return apiFetch<AdminSupportMeetingSummary>(`/admin/support-meetings/${meetingId}/approve`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload ?? {}),
  })
}

export async function rejectAdminSupportMeeting(token: string, meetingId: string): Promise<AdminSupportMeetingSummary> {
  return apiFetch<AdminSupportMeetingSummary>(`/admin/support-meetings/${meetingId}/reject`, {
    method: "PATCH",
    token,
  })
}

export async function updateAdminSupportMeetingStatus(
  token: string,
  meetingId: string,
  payload: {
    status: AdminSupportMeetingSummary["status"]
    meetingUrl?: string
    afterMeetingSummary?: string
  }
): Promise<AdminSupportMeetingSummary> {
  return apiFetch<AdminSupportMeetingSummary>(`/admin/support-meetings/${meetingId}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  })
}

export async function deleteAdminSupportMeeting(token: string, meetingId: string): Promise<{ meetingId: string }> {
  return apiFetch<{ meetingId: string }>(`/admin/support-meetings/${meetingId}`, {
    method: "DELETE",
    token,
  })
}

