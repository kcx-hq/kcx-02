import { apiGet, apiPatch, apiPost } from "@/lib/api"

import type {
  ClientTicketAction,
  TicketCreatePayload,
  TicketItem,
  TicketMessage,
} from "@/features/client-home/components/ticket-management/types"

type ClientTicketsListResponse = {
  tickets: TicketItem[]
}

type ClientCreateTicketResponse = {
  ticket: TicketItem
}

type ClientTicketDetailResponse = {
  ticket: TicketItem
}

type ClientTicketMessagesResponse = {
  messages: TicketMessage[]
}

export async function fetchClientSupportTickets(): Promise<TicketItem[]> {
  const response = await apiGet<ClientTicketsListResponse>("/support/tickets/client")
  return response.tickets
}

export async function createClientSupportTicket(payload: TicketCreatePayload): Promise<TicketItem> {
  const response = await apiPost<ClientCreateTicketResponse>("/support/tickets/client", payload)
  return response.ticket
}

export async function fetchClientSupportTicketDetail(ticketId: string): Promise<TicketItem> {
  const response = await apiGet<ClientTicketDetailResponse>(`/support/tickets/client/${ticketId}`)
  return response.ticket
}

export async function fetchClientSupportTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const response = await apiGet<ClientTicketMessagesResponse>(`/support/tickets/client/${ticketId}/messages`)
  return response.messages
}

export async function sendClientSupportTicketMessage(ticketId: string, message: string): Promise<TicketMessage> {
  return apiPost<TicketMessage>(`/support/tickets/client/${ticketId}/messages`, { message })
}

export async function applyClientSupportTicketAction(ticketId: string, action: ClientTicketAction): Promise<TicketItem> {
  const response = await apiPatch<ClientTicketDetailResponse>(`/support/tickets/client/${ticketId}`, { action })
  return response.ticket
}
