import { apiGet, apiPatch, apiPost } from "@/lib/api"

export type ClientSupportMeetingStatus = "REQUESTED" | "SCHEDULED" | "COMPLETED" | "CANCELLED" | "REJECTED"

export type ClientSupportMeeting = {
  id: string
  code: string
  title: string
  meetingType: string
  agenda: string
  mode: string
  status: ClientSupportMeetingStatus
  slotStart: string
  slotEnd: string
  timeZone: string
  meetingUrl: string | null
  requestedBy: string
  host: string
  duration: string
  afterSummary: string
  createdAt: string
  updatedAt: string
}

type ClientMeetingsListResponse = {
  meetings: ClientSupportMeeting[]
}

type ClientMeetingDetailResponse = {
  meeting: ClientSupportMeeting
}

export async function fetchClientSupportMeetings(): Promise<ClientSupportMeeting[]> {
  const response = await apiGet<ClientMeetingsListResponse>("/support/meetings/client")
  return response.meetings
}

export async function createClientSupportMeeting(payload: {
  meetingType: string
  agenda: string
  mode: string
  slotStart: string
  slotEnd: string
  timeZone: string
}): Promise<ClientSupportMeeting> {
  const response = await apiPost<ClientMeetingDetailResponse>("/support/meetings/client", payload)
  return response.meeting
}

export async function applyClientSupportMeetingAction(meetingId: string, action: "CANCEL"): Promise<ClientSupportMeeting> {
  const response = await apiPatch<ClientMeetingDetailResponse>(`/support/meetings/client/${meetingId}`, { action })
  return response.meeting
}
