import { useEffect, useMemo, useState } from "react"
import { Ban, CalendarClock, CalendarDays, CalendarPlus2, CheckCircle2, Clock3, Eye, Link as LinkIcon, RefreshCw, Search, User, Video, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  applyClientSupportMeetingAction,
  createClientSupportMeeting,
  fetchClientSupportMeetings,
  type ClientSupportMeeting,
  type ClientSupportMeetingStatus,
} from "@/features/client-home/api/client-meetings.api"
import { SlotPickerDialog } from "@/features/landing/pages/demo/components/SlotPickerDialog"
import { ApiError } from "@/lib/api"

const MEETING_TYPE_OPTIONS = [
  "Billing Ingestion Review",
  "Cost Optimization Review",
  "Cloud Connection Support",
  "Platform Walkthrough",
] as const

function formatDateTimeRange(slotStartIso: string, slotEndIso: string) {
  const start = new Date(slotStartIso)
  const end = new Date(slotEndIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-"

  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(start)
  const startTime = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).format(start)
  const endTime = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).format(end)
  return `${day} - ${startTime} to ${endTime}`
}

function toPrettyDateLabel(dateIso: string) {
  const [year, month, day] = dateIso.split("-").map(Number)
  if (!year || !month || !day) return dateIso
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
}

function statusBadgeClass(status: ClientSupportMeetingStatus) {
  if (status === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "SCHEDULED") return "border-sky-200 bg-sky-50 text-sky-700"
  if (status === "REQUESTED") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-rose-200 bg-rose-50 text-rose-700"
}

export function ClientMeetingsPage() {
  const [meetings, setMeetings] = useState<ClientSupportMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [slotPickerOpen, setSlotPickerOpen] = useState(false)
  const [agendaPreview, setAgendaPreview] = useState<ClientSupportMeeting | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | ClientSupportMeetingStatus>("ALL")
  const [page, setPage] = useState(1)
  const [meetingType, setMeetingType] = useState<string>(MEETING_TYPE_OPTIONS[0])
  const [agenda, setAgenda] = useState("")
  const [slot, setSlot] = useState<{ date: string; time: string; timeZone: string; slotStart?: string; slotEnd?: string } | null>(null)

  const loadMeetings = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchClientSupportMeetings()
      setMeetings(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load meetings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMeetings()
  }, [])

  const stats = useMemo(() => {
    const total = meetings.length
    const upcoming = meetings.filter((item) => item.status === "REQUESTED" || item.status === "SCHEDULED").length
    const completed = meetings.filter((item) => item.status === "COMPLETED").length
    const cancelled = meetings.filter((item) => item.status === "CANCELLED" || item.status === "REJECTED").length
    return { total, upcoming, completed, cancelled }
  }, [meetings])

  const upcomingMeetings = useMemo(
    () => meetings.filter((item) => item.status === "REQUESTED" || item.status === "SCHEDULED"),
    [meetings]
  )

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase()
    return meetings.filter((item) => {
      const dateTime = formatDateTimeRange(item.slotStart, item.slotEnd)
      const matchesSearch =
        q.length === 0 ||
        [item.code, item.title, item.meetingType, item.host, item.requestedBy, dateTime].join(" ").toLowerCase().includes(q)
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [meetings, search, statusFilter])

  const rowsPerPage = 10
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / rowsPerPage))
  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * rowsPerPage
    return filteredHistory.slice(start, start + rowsPerPage)
  }, [filteredHistory, page])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  function resetScheduleForm() {
    setMeetingType(MEETING_TYPE_OPTIONS[0])
    setAgenda("")
    setSlot(null)
  }

  async function handleScheduleMeeting() {
    if (!slot || agenda.trim().length === 0 || !slot.slotStart || !slot.slotEnd) return

    setSaving(true)
    setError(null)
    try {
      const created = await createClientSupportMeeting({
        meetingType,
        agenda: agenda.trim(),
        mode: "Google Meet",
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
        timeZone: slot.timeZone,
      })
      setMeetings((current) => [created, ...current])
      setNotice("Meeting request sent to KCX for approval")
      setTimeout(() => setNotice(null), 2200)
      setScheduleOpen(false)
      resetScheduleForm()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create meeting request")
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelMeeting(id: string) {
    setError(null)
    try {
      const updated = await applyClientSupportMeetingAction(id, "CANCEL")
      setMeetings((current) => current.map((item) => (item.id === id ? updated : item)))
      setNotice("Meeting cancelled")
      setTimeout(() => setNotice(null), 1800)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to cancel meeting")
    }
  }

  return (
    <section className="rounded-[14px] border border-[color:var(--border-light)] bg-white px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mt-2 text-2xl font-semibold text-text-primary">Meetings Workspace</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="h-10 rounded-md bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-[color:var(--text-on-dark)] hover:bg-[color:var(--brand-primary-hover)]"
            onClick={() => setScheduleOpen(true)}
          >
            <CalendarPlus2 className="mr-1.5 h-4 w-4" />
            Schedule Meeting
          </Button>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      {notice ? <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

      <section className="mt-5 grid grid-cols-1 divide-y divide-[color:var(--border-light)] border-t border-[color:var(--border-light)] pt-4 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
        <article className="px-4 py-2 md:first:pl-0">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">Total Meetings</p>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(55,145,116,0.12)] text-[color:#1f7d60]">
              <CalendarDays className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-1 text-4xl font-semibold leading-none text-text-primary">{stats.total}</p>
          <p className="mt-1 text-sm text-text-secondary">All scheduled sessions</p>
        </article>

        <article className="px-4 py-2">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">Upcoming Meetings</p>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(214,135,26,0.14)] text-[color:#925208]">
              <Clock3 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-1 text-4xl font-semibold leading-none text-text-primary">{stats.upcoming}</p>
          <p className="mt-1 text-sm text-text-secondary">Next sessions pending</p>
        </article>

        <article className="px-4 py-2">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">Completed Meetings</p>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(55,145,116,0.14)] text-[color:#1f7d60]">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-1 text-4xl font-semibold leading-none text-text-primary">{stats.completed}</p>
          <p className="mt-1 text-sm text-text-secondary">Delivered sessions</p>
        </article>

        <article className="px-4 py-2 md:last:pr-0">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">Cancelled Meetings</p>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(217,93,85,0.12)] text-[color:#a43d37]">
              <XCircle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-1 text-4xl font-semibold leading-none text-text-primary">{stats.cancelled}</p>
          <p className="mt-1 text-sm text-text-secondary">Requests cancelled</p>
        </article>
      </section>

      <div className="mt-5 border-t border-[color:var(--border-light)] pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Upcoming Meetings</p>
        <div className="mt-3">
          {loading ? (
            <p className="text-sm text-text-secondary">Loading meetings...</p>
          ) : upcomingMeetings.length === 0 ? (
            <p className="text-sm text-text-secondary">No upcoming meetings yet.</p>
          ) : (
            <div className="divide-y divide-[color:rgba(15,23,42,0.08)]">
              {upcomingMeetings.map((item) => (
                <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-base font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-0.5 text-sm text-text-secondary">{formatDateTimeRange(item.slotStart, item.slotEnd)} ({item.timeZone})</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === "REQUESTED" ? (
                      <span className="text-sm font-semibold text-amber-700">Pending approval</span>
                    ) : null}
                    {item.meetingUrl ? (
                      <a
                        href={item.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-sm font-semibold text-[color:var(--brand-primary)] hover:underline"
                      >
                        <LinkIcon className="mr-1 h-3.5 w-3.5" />
                        Join meeting
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-[color:var(--border-light)] pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Booking History</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="meeting-search">
            Search meetings
          </label>
          <span className="relative block min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              id="meeting-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search meeting title, requester, host"
              className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] pl-9 pr-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
            />
          </span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "ALL" | ClientSupportMeetingStatus)}
            className="h-10 min-w-[190px] rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
          >
            <option value="ALL">All Statuses</option>
            <option value="REQUESTED">Requested</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button
            type="button"
            onClick={() => void loadMeetings()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary transition-colors hover:bg-[color:var(--bg-soft)]"
            aria-label="Refresh meetings"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1200px] w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[color:var(--border-light)]">
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Meeting</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Date & Time</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Requested By</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">KCX Host</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Status</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Duration</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">After Meeting Summary</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-sm text-text-secondary">Loading meetings...</td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-sm text-text-secondary">No meetings found.</td>
                </tr>
              ) : (
                paginatedHistory.map((item) => (
                  <tr key={item.id} className="border-b border-[color:var(--border-light)] last:border-b-0">
                    <td className="px-3 py-4">
                      <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                      <p className="mt-1 text-xs text-text-secondary">{item.code}</p>
                    </td>
                    <td className="px-3 py-4 text-sm text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatDateTimeRange(item.slotStart, item.slotEnd)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-text-muted" />
                        {item.requestedBy}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm text-text-secondary">{item.host}</td>
                    <td className="px-3 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm text-text-secondary">{item.duration}</td>
                    <td className="px-3 py-4 text-sm text-text-secondary">{item.afterSummary}</td>
                    <td className="px-3 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.meetingUrl ? (
                          <a
                            href={item.meetingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(55,145,116,0.26)] bg-[rgba(55,145,116,0.12)] text-[color:#1f7d60] transition hover:bg-[rgba(55,145,116,0.2)]"
                            title="Join meeting"
                          >
                            <LinkIcon className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(55,145,116,0.26)] bg-[rgba(55,145,116,0.12)] text-[color:#1f7d60] transition hover:bg-[rgba(55,145,116,0.2)]"
                          title="View agenda"
                          onClick={() => setAgendaPreview(item)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(217,93,85,0.3)] bg-[rgba(217,93,85,0.11)] text-[color:#a43d37] transition hover:bg-[rgba(217,93,85,0.18)] disabled:opacity-50"
                          title="Cancel meeting"
                          disabled={item.status === "CANCELLED" || item.status === "COMPLETED" || item.status === "REJECTED"}
                          onClick={() => void handleCancelMeeting(item.id)}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredHistory.length > rowsPerPage ? (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="inline-flex h-8 items-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 text-text-secondary disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-text-secondary">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              className="inline-flex h-8 items-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 text-text-secondary disabled:opacity-50"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>

      <Dialog
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open)
          if (!open) resetScheduleForm()
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Schedule Meeting</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Meeting Type</span>
                <select
                  value={meetingType}
                  onChange={(event) => setMeetingType(event.target.value)}
                  className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
                >
                  {MEETING_TYPE_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Mode</span>
                <div className="inline-flex h-10 w-full items-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 text-sm text-text-secondary">
                  <Video className="mr-2 h-4 w-4" />
                  Google Meet
                </div>
              </label>
            </div>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Meeting Agenda</span>
              <textarea
                value={agenda}
                onChange={(event) => setAgenda(event.target.value)}
                rows={4}
                placeholder="Write meeting agenda for KCX support..."
                className="w-full rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
              />
            </label>

            <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3 text-sm text-text-secondary">
              {slot ? (
                <p>
                  Selected Slot: <span className="font-semibold text-text-primary">{toPrettyDateLabel(slot.date)} - {slot.time}</span> ({slot.timeZone})
                </p>
              ) : (
                <p>No slot selected yet.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSlotPickerOpen(true)}
              >
                Select Time & Slot Booking
              </Button>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setScheduleOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!slot || !slot.slotStart || !slot.slotEnd || agenda.trim().length === 0 || saving}
                  onClick={() => void handleScheduleMeeting()}
                >
                  {saving ? "Submitting..." : "Confirm Meeting"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(agendaPreview)} onOpenChange={(open) => (!open ? setAgendaPreview(null) : null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Meeting Agenda</DialogTitle>
          </DialogHeader>
          {agendaPreview ? (
            <div className="space-y-2 text-sm text-text-secondary">
              <p><span className="font-semibold text-text-primary">Meeting:</span> {agendaPreview.title}</p>
              <p><span className="font-semibold text-text-primary">Time:</span> {formatDateTimeRange(agendaPreview.slotStart, agendaPreview.slotEnd)}</p>
              <p><span className="font-semibold text-text-primary">Agenda:</span> {agendaPreview.agenda}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <SlotPickerDialog
        open={slotPickerOpen}
        onOpenChange={setSlotPickerOpen}
        value={slot ? { date: slot.date, time: slot.time } : null}
        onConfirm={async (next) => {
          setSlot(next)
        }}
      />
    </section>
  )
}
