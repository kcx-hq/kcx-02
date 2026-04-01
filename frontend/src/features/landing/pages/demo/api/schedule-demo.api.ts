import { apiGet, apiPost } from "@/lib/api"

export type ScheduleDemoSlot = {
  time: string
  available: boolean
  slotStart: string
  slotEnd: string
}

export type ScheduleDemoDailySlotsResponse = {
  date: string
  timeZone: string
  slots: ScheduleDemoSlot[]
}

export type ScheduleDemoBookingPayload = {
  firstName: string
  lastName: string
  companyEmail: string
  companyName: string
  heardAboutUs: string
  slotDate: string
  slotTime: string
  slotStart?: string
  slotEnd?: string
  timeZone?: string
}

export type ScheduleDemoBookingResponse = {
  demoRequestId: number
  clientId: number
  slotReservationId: number
  status: string
  emailSent: boolean
}

export async function fetchScheduleDemoSlotsForDate(
  date: string,
  timeZone?: string
): Promise<ScheduleDemoDailySlotsResponse> {
  const encodedDate = encodeURIComponent(date)
  const params = new URLSearchParams()
  if (timeZone) params.set("timeZone", timeZone)
  const query = params.toString()
  const path = query ? `/schedule-demo/slots/${encodedDate}?${query}` : `/schedule-demo/slots/${encodedDate}`
  return apiGet<ScheduleDemoDailySlotsResponse>(path)
}

export async function submitScheduleDemoBooking(
  payload: ScheduleDemoBookingPayload
): Promise<ScheduleDemoBookingResponse> {
  return apiPost<ScheduleDemoBookingResponse>("/schedule-demo", payload)
}
