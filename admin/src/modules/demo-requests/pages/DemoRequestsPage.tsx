import { useEffect, useMemo, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { BadgeCheck, Building2, CalendarClock, CheckCircle2, Clock3, Eye, ListChecks, RefreshCw, Search, Trash2, X, XCircle } from "lucide-react"

import { ApiError } from "@/lib/api"
import { getAdminToken } from "@/modules/auth/admin-session"
import {
  confirmAdminDemoRequest,
  deleteAdminSupportMeeting,
  fetchAdminDemoRequests,
  fetchAdminSupportMeetings,
  rejectAdminDemoRequest,
  updateAdminSupportMeetingStatus,
  type AdminSupportMeetingSummary,
  type AdminDemoRequestSummary,
} from "@/modules/demo-requests/admin-demo-requests.api"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"

function formatDateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function formatSlot(slotStart: string | null, slotEnd: string | null) {
  if (!slotStart || !slotEnd) return "-"
  const start = new Date(slotStart)
  const end = new Date(slotEnd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-"

  const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(start)
  const startTime = new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(start)
  const endTime = new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(end)
  return `${day} - ${startTime} to ${endTime}`
}

function statusVariant(status: string) {
  const normalized = status.toUpperCase()
  if (normalized === "CONFIRMED" || normalized === "SCHEDULED" || normalized === "RESCHEDULED" || normalized === "COMPLETED") return "subtle" as const
  if (normalized === "REJECTED" || normalized === "CANCELLED") return "warning" as const
  return "outline" as const
}

const ADMIN_MEETING_STATUS_OPTIONS: AdminSupportMeetingSummary["status"][] = [
  "REQUESTED",
  "SCHEDULED",
  "RESCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
]

function formatStatusLabel(status: string) {
  return status.replaceAll("_", " ")
}

const DEMO_STATUS_OPTIONS = ["ALL", "PENDING", "CONFIRMED", "REJECTED"] as const
type DemoStatusFilter = (typeof DEMO_STATUS_OPTIONS)[number]

export function DemoRequestsPage() {
  const token = useMemo(() => getAdminToken(), [])
  const [activeTab, setActiveTab] = useState<"demos" | "meetings">("demos")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [items, setItems] = useState<AdminDemoRequestSummary[]>([])
  const [meetingItems, setMeetingItems] = useState<AdminSupportMeetingSummary[]>([])
  const [demoSearch, setDemoSearch] = useState("")
  const [demoStatusFilter, setDemoStatusFilter] = useState<DemoStatusFilter>("ALL")
  const [meetingSearch, setMeetingSearch] = useState("")
  const [meetingStatusFilter, setMeetingStatusFilter] = useState<"ALL" | AdminSupportMeetingSummary["status"]>("ALL")
  const [demoPage, setDemoPage] = useState(1)
  const [meetingPage, setMeetingPage] = useState(1)
  const [pendingMeetingStatuses, setPendingMeetingStatuses] = useState<Record<string, AdminSupportMeetingSummary["status"]>>({})
  const [actingId, setActingId] = useState<number | null>(null)
  const [actingMeetingId, setActingMeetingId] = useState<string | null>(null)
  const [selectedMeeting, setSelectedMeeting] = useState<AdminSupportMeetingSummary | null>(null)

  const load = () => {
    if (!token) return
    setLoading(true)
    setError(null)
    Promise.all([fetchAdminDemoRequests(token), fetchAdminSupportMeetings(token)])
      .then(([demoData, meetingData]) => {
        setItems(demoData)
        setMeetingItems(meetingData)
        setPendingMeetingStatuses(
          Object.fromEntries(meetingData.map((item) => [item.id, item.status as AdminSupportMeetingSummary["status"]]))
        )
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Unable to load demo requests"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    setPendingMeetingStatuses((prev) => {
      const next: Record<string, AdminSupportMeetingSummary["status"]> = {}
      for (const item of meetingItems) {
        next[item.id] = prev[item.id] ?? item.status
      }
      return next
    })
  }, [meetingItems])

  const demoKpis = useMemo(() => {
    const total = items.length
    const pending = items.filter((item) => item.status.toUpperCase() === "PENDING").length
    const confirmed = items.filter((item) => item.status.toUpperCase() === "CONFIRMED").length
    const rejected = items.filter((item) => item.status.toUpperCase() === "REJECTED").length
    const companies = new Set(
      items
        .map((item) => item.client.companyName?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value))
    )
    return { total, pending, confirmed, rejected, companyCount: companies.size }
  }, [items])

  const filteredDemoItems = useMemo(() => {
    const q = demoSearch.trim().toLowerCase()
    return items.filter((item) => {
      const matchesSearch =
        q.length === 0 ||
        [
          item.client.firstName,
          item.client.lastName,
          item.client.email,
          item.client.companyName ?? "",
          formatSlot(item.slotStart, item.slotEnd),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      const matchesStatus = demoStatusFilter === "ALL" || item.status.toUpperCase() === demoStatusFilter
      return matchesSearch && matchesStatus
    })
  }, [demoSearch, demoStatusFilter, items])

  const rowsPerPage = 10
  const demoTotalPages = Math.max(1, Math.ceil(filteredDemoItems.length / rowsPerPage))
  const paginatedDemoItems = useMemo(() => {
    const start = (demoPage - 1) * rowsPerPage
    return filteredDemoItems.slice(start, start + rowsPerPage)
  }, [demoPage, filteredDemoItems])

  const meetingKpis = useMemo(() => {
    const total = meetingItems.length
    const requested = meetingItems.filter((item) => item.status === "REQUESTED").length
    const scheduled = meetingItems.filter((item) => item.status === "SCHEDULED" || item.status === "RESCHEDULED").length
    const completed = meetingItems.filter((item) => item.status === "COMPLETED").length
    const companies = new Set(
      meetingItems
        .map((item) => item.client.company_name?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value))
    )
    return { total, requested, scheduled, completed, companyCount: companies.size }
  }, [meetingItems])

  const filteredMeetingItems = useMemo(() => {
    const q = meetingSearch.trim().toLowerCase()
    return meetingItems.filter((item) => {
      const matchesQuery =
        q.length === 0 ||
        [
          item.meeting_code,
          item.meeting_type,
          item.client.name,
          item.client.email ?? "",
          item.client.company_name ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      const matchesStatus = meetingStatusFilter === "ALL" || item.status === meetingStatusFilter
      return matchesQuery && matchesStatus
    })
  }, [meetingItems, meetingSearch, meetingStatusFilter])

  const meetingTotalPages = Math.max(1, Math.ceil(filteredMeetingItems.length / rowsPerPage))
  const paginatedMeetingItems = useMemo(() => {
    const start = (meetingPage - 1) * rowsPerPage
    return filteredMeetingItems.slice(start, start + rowsPerPage)
  }, [filteredMeetingItems, meetingPage])

  useEffect(() => {
    setDemoPage(1)
  }, [demoSearch, demoStatusFilter])

  useEffect(() => {
    setMeetingPage(1)
  }, [meetingSearch, meetingStatusFilter])

  useEffect(() => {
    if (demoPage > demoTotalPages) setDemoPage(demoTotalPages)
  }, [demoPage, demoTotalPages])

  useEffect(() => {
    if (meetingPage > meetingTotalPages) setMeetingPage(meetingTotalPages)
  }, [meetingPage, meetingTotalPages])

  const runAction = async (id: number, action: "confirm" | "reject") => {
    if (!token) return
    setActingId(id)
    setError(null)
    setNotice(null)
    try {
      const result =
        action === "confirm" ? await confirmAdminDemoRequest(token, id) : await rejectAdminDemoRequest(token, id)
      setItems((prev) => prev.map((item) => (item.id === id ? result.demoRequest : item)))
      setNotice(
        `${action === "confirm" ? "Confirmed" : "Rejected"} demo request #${id}. ${
          result.emailSent ? "Client email sent." : "Client email not sent."
        }`
      )
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Action failed")
    } finally {
      setActingId(null)
    }
  }

  const runDeleteMeeting = async (meetingId: string) => {
    if (!token) return
    setActingMeetingId(meetingId)
    setError(null)
    setNotice(null)
    try {
      await deleteAdminSupportMeeting(token, meetingId)
      setMeetingItems((prev) => prev.filter((item) => item.id !== meetingId))
      setPendingMeetingStatuses((prev) => {
        const { [meetingId]: _ignore, ...rest } = prev
        return rest
      })
      if (selectedMeeting?.id === meetingId) {
        setSelectedMeeting(null)
      }
      setNotice("Meeting deleted successfully.")
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Unable to delete meeting")
    } finally {
      setActingMeetingId(null)
    }
  }

  const runMeetingStatusUpdate = async (meetingId: string, explicitStatus?: AdminSupportMeetingSummary["status"]) => {
    if (!token) return
    const selectedStatus = explicitStatus ?? pendingMeetingStatuses[meetingId]
    if (!selectedStatus) return
    setActingMeetingId(meetingId)
    setError(null)
    setNotice(null)

    try {
      const updatedMeeting = await updateAdminSupportMeetingStatus(token, meetingId, { status: selectedStatus })
      setMeetingItems((prev) => prev.map((item) => (item.id === meetingId ? updatedMeeting : item)))
      setPendingMeetingStatuses((prev) => ({ ...prev, [meetingId]: updatedMeeting.status }))
      setNotice(`Meeting ${updatedMeeting.meeting_code} moved to ${formatStatusLabel(updatedMeeting.status)}.`)
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Unable to update meeting status")
    } finally {
      setActingMeetingId(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative pb-0">
        <div className="flex items-center gap-8 pt-1">
          <div className="flex items-center gap-8">
            <button
              type="button"
              className={`relative pb-3 text-sm font-semibold uppercase tracking-[0.08em] transition-colors ${
                activeTab === "demos" ? "text-[color:rgba(47,125,106,0.92)]" : "text-[color:rgba(15,23,42,0.62)]"
              }`}
              onClick={() => setActiveTab("demos")}
            >
              Demos
              <span
                className={`absolute bottom-[0px] left-0 h-[3px] w-full bg-[color:rgba(47,125,106,0.92)] transition-opacity ${
                  activeTab === "demos" ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
            <button
              type="button"
              className={`relative pb-3 text-sm font-semibold uppercase tracking-[0.08em] transition-colors ${
                activeTab === "meetings" ? "text-[color:rgba(47,125,106,0.92)]" : "text-[color:rgba(15,23,42,0.62)]"
              }`}
              onClick={() => setActiveTab("meetings")}
            >
              Meetings
              <span
                className={`absolute bottom-[0px] left-0 h-[3px] w-full bg-[color:rgba(47,125,106,0.92)] transition-opacity ${
                  activeTab === "meetings" ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent>
          <section className="mb-4 grid grid-cols-2 border-b border-[color:rgba(15,23,42,0.12)] lg:grid-cols-5">
            {(activeTab === "demos"
              ? [
                  { label: "Total Demos", value: demoKpis.total, icon: ListChecks, hint: "All requests logged" },
                  { label: "Pending", value: demoKpis.pending, icon: Clock3, hint: "Awaiting response" },
                  { label: "Confirmed", value: demoKpis.confirmed, icon: CheckCircle2, hint: "Approved meetings" },
                  { label: "Rejected", value: demoKpis.rejected, icon: XCircle, hint: "Declined requests" },
                  { label: "Companies", value: demoKpis.companyCount, icon: Building2, hint: "Unique organizations" },
                ]
              : [
                  { label: "Total Meetings", value: meetingKpis.total, icon: ListChecks, hint: "All meetings logged" },
                  { label: "Requested", value: meetingKpis.requested, icon: CalendarClock, hint: "Pending approval" },
                  { label: "Scheduled", value: meetingKpis.scheduled, icon: Clock3, hint: "Upcoming sessions" },
                  { label: "Completed", value: meetingKpis.completed, icon: BadgeCheck, hint: "Delivered meetings" },
                  { label: "Companies", value: meetingKpis.companyCount, icon: Building2, hint: "Unique organizations" },
                ]
            ).map((kpi, index) => (
              <div
                key={kpi.label}
                className={`px-4 py-4 ${index !== 4 ? "border-r border-[color:rgba(15,23,42,0.12)]" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:rgba(15,23,42,0.55)]">{kpi.label}</p>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:rgba(15,23,42,0.06)] text-[color:rgba(15,23,42,0.52)]">
                    <kpi.icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 text-[2rem] font-semibold leading-none text-[color:rgba(15,23,42,0.9)]">{kpi.value}</p>
                <p className="mt-1 text-sm text-[color:rgba(15,23,42,0.62)]">{kpi.hint}</p>
              </div>
            ))}
          </section>
          {notice ? (
            <div className="rounded-xl border border-[color:rgba(47,125,106,0.18)] bg-[color:rgba(47,125,106,0.06)] px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
              {error}
            </div>
          ) : null}

          {activeTab === "demos" ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[color:rgba(15,23,42,0.1)] pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="relative min-w-[260px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:rgba(15,23,42,0.45)]" />
                  <input
                    value={demoSearch}
                    onChange={(event) => setDemoSearch(event.target.value)}
                    placeholder="Search demo requests..."
                    className="h-11 w-full rounded-xl border border-[color:rgba(15,23,42,0.14)] bg-white pl-9 pr-3 text-sm text-[color:rgba(15,23,42,0.88)] outline-none focus:border-[color:rgba(47,125,106,0.65)]"
                  />
                </span>
                <select
                  value={demoStatusFilter}
                  onChange={(event) => setDemoStatusFilter(event.target.value as DemoStatusFilter)}
                  className="h-11 min-w-[180px] rounded-xl border border-[color:rgba(15,23,42,0.14)] bg-white px-3 text-sm text-[color:rgba(15,23,42,0.88)] outline-none focus:border-[color:rgba(47,125,106,0.65)]"
                >
                  {DEMO_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status === "ALL" ? "All statuses" : formatStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={load}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[color:rgba(15,23,42,0.14)] bg-white text-[color:rgba(15,23,42,0.78)]"
                aria-label="Refresh demos"
                disabled={loading || !token}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          ) : null}

          {activeTab === "meetings" ? (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="relative w-[420px] max-w-[58vw] min-w-[260px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:rgba(15,23,42,0.45)]" />
                  <input
                    value={meetingSearch}
                    onChange={(event) => setMeetingSearch(event.target.value)}
                    placeholder="Search code, client, type"
                    className="h-9 w-full rounded-lg border border-[color:rgba(15,23,42,0.14)] bg-white pl-9 pr-3 text-sm text-[color:rgba(15,23,42,0.88)] outline-none focus:border-[color:rgba(47,125,106,0.65)]"
                  />
                </span>
                <select
                  value={meetingStatusFilter}
                  onChange={(event) => setMeetingStatusFilter(event.target.value as "ALL" | AdminSupportMeetingSummary["status"])}
                  className="h-9 min-w-[190px] rounded-lg border border-[color:rgba(15,23,42,0.14)] bg-white px-3 text-sm text-[color:rgba(15,23,42,0.88)] outline-none focus:border-[color:rgba(47,125,106,0.65)]"
                >
                  <option value="ALL">All statuses</option>
                  {ADMIN_MEETING_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {formatStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={load}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:rgba(15,23,42,0.14)] bg-white text-[color:rgba(15,23,42,0.78)]"
                aria-label="Refresh meetings"
                disabled={loading || !token}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          ) : null}

          {activeTab === "meetings" ? <div className="border-b border-[color:rgba(15,23,42,0.1)]" /> : null}

          <div className="mt-3 overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-[rgba(15,23,42,0.08)] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(15,23,42,0.25)]">
            {activeTab === "demos" ? (
              <table className="min-w-[1100px] w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Slot</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Meeting</th>
                    <th className="px-4 py-3">Requested</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={8}>
                        Loading demo requests...
                      </td>
                    </tr>
                  ) : filteredDemoItems.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={8}>
                        No demo requests yet.
                      </td>
                    </tr>
                  ) : (
                    paginatedDemoItems.map((item) => {
                      const isPending = item.status === "PENDING"
                      const isActing = actingId === item.id

                      return (
                        <tr key={item.id} className="border-b border-[color:rgba(15,23,42,0.12)]">
                          <td className="px-4 py-3 font-medium text-[color:rgba(15,23,42,0.88)]">
                            {item.client.firstName} {item.client.lastName}
                          </td>
                          <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.client.email}</td>
                          <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.client.companyName ?? "-"}</td>
                          <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{formatSlot(item.slotStart, item.slotEnd)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            {item.meetingUrl ? (
                              <a
                                className="font-semibold text-[color:rgba(47,125,106,0.92)] hover:underline underline-offset-4"
                                href={item.meetingUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Join
                              </a>
                            ) : (
                              <span className="text-[color:rgba(15,23,42,0.60)]">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">{formatDateTime(item.createdAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={!isPending || isActing}
                                onClick={() => runAction(item.id, "confirm")}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!isPending || isActing}
                                onClick={() => runAction(item.id, "reject")}
                              >
                                Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table className="min-w-[1080px] w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Slot</th>
                    <th className="px-4 py-3">Meeting</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                        Loading meetings...
                      </td>
                    </tr>
                  ) : filteredMeetingItems.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                        No meetings available.
                      </td>
                    </tr>
                  ) : (
                    paginatedMeetingItems.map((item) => (
                      <tr key={item.id} className="border-b border-[color:rgba(15,23,42,0.12)]">
                        <td className="px-4 py-3 font-medium text-[color:rgba(15,23,42,0.88)]">
                          {item.client.name}
                        </td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.client.email}</td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.client.company_name ?? "-"}</td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{formatSlot(item.slot_start, item.slot_end)}</td>
                        <td className="px-4 py-3">
                          {item.meeting_url ? (
                            <a
                              className="font-semibold text-[color:rgba(47,125,106,0.92)] hover:underline underline-offset-4"
                              href={item.meeting_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Join Meeting
                            </a>
                          ) : (
                            <span className="text-[color:rgba(15,23,42,0.60)]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={pendingMeetingStatuses[item.id] ?? item.status}
                            disabled={actingMeetingId === item.id}
                            onChange={(event) => {
                              const nextStatus = event.target.value as AdminSupportMeetingSummary["status"]
                              setPendingMeetingStatuses((prev) => ({
                                ...prev,
                                [item.id]: nextStatus,
                              }))
                              if (nextStatus !== item.status) {
                                void runMeetingStatusUpdate(item.id, nextStatus)
                              }
                            }}
                            className="h-8 min-w-[150px] rounded-md border border-[color:rgba(15,23,42,0.14)] bg-white px-2 text-xs font-medium uppercase tracking-[0.06em] text-[color:rgba(15,23,42,0.85)] outline-none focus:border-[color:rgba(47,125,106,0.65)]"
                          >
                            {ADMIN_MEETING_STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {formatStatusLabel(status)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:rgba(15,23,42,0.14)] bg-white text-[color:rgba(15,23,42,0.72)] transition hover:bg-[color:rgba(15,23,42,0.03)]"
                              title="View meeting details"
                              onClick={() => setSelectedMeeting(item)}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={actingMeetingId === item.id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                              title="Delete meeting"
                              onClick={() => void runDeleteMeeting(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {activeTab === "demos" && filteredDemoItems.length > rowsPerPage ? (
            <div className="mt-3 flex items-center justify-end gap-2 text-sm">
              <button
                type="button"
                onClick={() => setDemoPage((current) => Math.max(1, current - 1))}
                disabled={demoPage === 1}
                className="inline-flex h-8 items-center rounded-md border border-[color:rgba(15,23,42,0.15)] bg-white px-3 text-[color:rgba(15,23,42,0.72)] disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-[color:rgba(15,23,42,0.72)]">
                Page {demoPage} of {demoTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setDemoPage((current) => Math.min(demoTotalPages, current + 1))}
                disabled={demoPage === demoTotalPages}
                className="inline-flex h-8 items-center rounded-md border border-[color:rgba(15,23,42,0.15)] bg-white px-3 text-[color:rgba(15,23,42,0.72)] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          ) : null}

          {activeTab === "meetings" && filteredMeetingItems.length > rowsPerPage ? (
            <div className="mt-3 flex items-center justify-end gap-2 text-sm">
              <button
                type="button"
                onClick={() => setMeetingPage((current) => Math.max(1, current - 1))}
                disabled={meetingPage === 1}
                className="inline-flex h-8 items-center rounded-md border border-[color:rgba(15,23,42,0.15)] bg-white px-3 text-[color:rgba(15,23,42,0.72)] disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-[color:rgba(15,23,42,0.72)]">
                Page {meetingPage} of {meetingTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setMeetingPage((current) => Math.min(meetingTotalPages, current + 1))}
                disabled={meetingPage === meetingTotalPages}
                className="inline-flex h-8 items-center rounded-md border border-[color:rgba(15,23,42,0.15)] bg-white px-3 text-[color:rgba(15,23,42,0.72)] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          ) : null}

          <Dialog.Root open={Boolean(selectedMeeting)} onOpenChange={(open) => (!open ? setSelectedMeeting(null) : null)}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
              <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-[760px] overflow-y-auto bg-white p-5 shadow-[-18px_0_48px_-30px_rgba(15,23,42,0.55)] outline-none sm:p-6">
                {selectedMeeting ? (
                  <>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <Dialog.Title className="text-lg font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">
                          Meeting Details
                        </Dialog.Title>
                        <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                          {selectedMeeting.meeting_code}
                        </Dialog.Description>
                      </div>
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:rgba(15,23,42,0.14)] text-[color:rgba(15,23,42,0.72)]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </Dialog.Close>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border border-[color:rgba(15,23,42,0.1)] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:rgba(15,23,42,0.55)]">Client</p>
                        <p className="mt-1 text-sm text-[color:rgba(15,23,42,0.9)]">{selectedMeeting.client.name}</p>
                        <p className="text-sm text-[color:rgba(15,23,42,0.7)]">{selectedMeeting.client.email ?? "-"}</p>
                      </div>
                      <div className="rounded-lg border border-[color:rgba(15,23,42,0.1)] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:rgba(15,23,42,0.55)]">Company</p>
                        <p className="mt-1 text-sm text-[color:rgba(15,23,42,0.9)]">{selectedMeeting.client.company_name ?? "-"}</p>
                      </div>
                      <div className="rounded-lg border border-[color:rgba(15,23,42,0.1)] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:rgba(15,23,42,0.55)]">Meeting Type</p>
                        <p className="mt-1 text-sm text-[color:rgba(15,23,42,0.9)]">{selectedMeeting.meeting_type}</p>
                      </div>
                      <div className="rounded-lg border border-[color:rgba(15,23,42,0.1)] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:rgba(15,23,42,0.55)]">Status</p>
                        <p className="mt-1 text-sm text-[color:rgba(15,23,42,0.9)]">{selectedMeeting.status}</p>
                      </div>
                      <div className="sm:col-span-2 rounded-lg border border-[color:rgba(15,23,42,0.1)] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:rgba(15,23,42,0.55)]">Slot</p>
                        <p className="mt-1 text-sm text-[color:rgba(15,23,42,0.9)]">
                          {formatSlot(selectedMeeting.slot_start, selectedMeeting.slot_end)} ({selectedMeeting.time_zone})
                        </p>
                      </div>
                      <div className="sm:col-span-2 rounded-lg border border-[color:rgba(15,23,42,0.1)] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:rgba(15,23,42,0.55)]">Agenda</p>
                        <p className="mt-1 text-sm text-[color:rgba(15,23,42,0.9)] whitespace-pre-wrap">{selectedMeeting.agenda || "-"}</p>
                      </div>
                      <div className="sm:col-span-2 rounded-lg border border-[color:rgba(15,23,42,0.1)] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:rgba(15,23,42,0.55)]">Meeting Link</p>
                        {selectedMeeting.meeting_url ? (
                          <a
                            className="mt-1 inline-block text-sm font-semibold text-[color:rgba(47,125,106,0.92)] hover:underline"
                            href={selectedMeeting.meeting_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open meeting link
                          </a>
                        ) : (
                          <p className="mt-1 text-sm text-[color:rgba(15,23,42,0.7)]">-</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </CardContent>
      </Card>
    </div>
  )
}
