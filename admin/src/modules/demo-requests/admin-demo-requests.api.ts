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

