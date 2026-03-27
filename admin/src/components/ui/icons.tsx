import { CalendarClock, Megaphone, Ticket, Upload, Users } from "lucide-react"

export function UserIcon({ className }: { className?: string }) {
  return <Users className={className} aria-hidden="true" />
}

export function TicketIcon({ className }: { className?: string }) {
  return <Ticket className={className} aria-hidden="true" />
}

export function MeetingIcon({ className }: { className?: string }) {
  return <CalendarClock className={className} aria-hidden="true" />
}

export function AnnouncementIcon({ className }: { className?: string }) {
  return <Megaphone className={className} aria-hidden="true" />
}

export function BillingUploadsIcon({ className }: { className?: string }) {
  return <Upload className={className} aria-hidden="true" />
}

