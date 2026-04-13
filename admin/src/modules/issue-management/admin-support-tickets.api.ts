import { apiFetch } from "@/lib/api"

export type ClientIssueTicket = {
  id: string
  ticket_code: string
  status: string
  progress: string
  created_at: string
  updated_at: string
  client_responded_at: string | null
  client: {
    name: string
    email: string | null
  }
  issue: {
    title: string
    category: string
    priority: string
    description: string
    attachments: string[]
    assigned_team: string | null
    sla_deadline: string | null
  }
}

export type ClientIssueMessage = {
  id: string
  sender_type: string
  sender_name: string | null
  message: string
  created_at: string
}

type TicketListQuery = { status?: string; search?: string; tenantId?: string }

type MessageResponse = { id: string; sender_type: string; sender_name: string | null; message: string; created_at: string }

export async function fetchClientIssueTickets(
  token: string,
  status: string,
  query: TicketListQuery = {}
): Promise<ClientIssueTicket[]> {
  const params = new URLSearchParams()
  if (status && status !== "ALL") params.set("status", status)
  if (query.status) params.set("status", query.status)
  if (query.search) params.set("search", query.search)
  if (query.tenantId) params.set("tenantId", query.tenantId)

  const queryString = params.toString()
  const path = queryString.length > 0 ? `/admin/support-tickets?${queryString}` : "/admin/support-tickets"

  const response = await apiFetch<ClientIssueTicket[]>(path, {
    method: "GET",
    token,
  })

  return response
}

export async function fetchClientIssueTicketDetail(token: string, ticketId: string): Promise<ClientIssueTicket> {
  return apiFetch<ClientIssueTicket>(`/admin/support-tickets/${ticketId}`, { method: "GET", token })
}

export async function fetchClientIssueMessages(token: string, ticketId: string): Promise<ClientIssueMessage[]> {
  return apiFetch<ClientIssueMessage[]>(`/admin/support-tickets/${ticketId}/messages`, { method: "GET", token })
}

export async function sendClientIssueMessage(
  token: string,
  ticketId: string,
  message: string
): Promise<ClientIssueMessage> {
  return apiFetch<MessageResponse>(`/admin/support-tickets/${ticketId}/messages`, {
    method: "POST",
    token,
    body: JSON.stringify({ message }),
  })
}

export async function clearClientIssueMessages(
  token: string,
  ticketId: string
): Promise<{ ticketId: string; deletedCount: number }> {
  return apiFetch<{ ticketId: string; deletedCount: number }>(`/admin/support-tickets/${ticketId}/messages`, {
    method: "DELETE",
    token,
  })
}

export async function updateClientIssueTicket(
  token: string,
  ticketId: string,
  payload: {
    status?: string
    progress?: string
    assignedTeam?: string
    slaDeadline?: string
  }
): Promise<ClientIssueTicket> {
  return apiFetch<ClientIssueTicket>(`/admin/support-tickets/${ticketId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({
      status: payload.status,
      progress: payload.progress,
      assignedTeam: payload.assignedTeam,
      slaDeadline: payload.slaDeadline,
    }),
  })
}

export async function deleteClientIssueTicket(token: string, ticketId: string): Promise<void> {
  await apiFetch<{ id: string }>(`/admin/support-tickets/${ticketId}`, {
    method: "DELETE",
    token,
  })
}
