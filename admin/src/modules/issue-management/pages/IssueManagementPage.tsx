import { useEffect, useMemo, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Eye, Loader2, RefreshCw, Trash2, X } from "lucide-react"

import { ApiError } from "@/lib/api"
import { getAdminToken } from "@/modules/auth/admin-session"
import {
  deleteClientIssueTicket,
  fetchClientIssueMessages,
  fetchClientIssueTicketDetail,
  fetchClientIssueTickets,
  clearClientIssueMessages,
  sendClientIssueMessage,
  updateClientIssueTicket,
  type ClientIssueMessage,
  type ClientIssueTicket,
} from "@/modules/issue-management/admin-support-tickets.api"
import { getAdminTicketSeenAt, setAdminSectionSeenAt, setAdminTicketSeenAt } from "@/services/notificationState"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"

const TEAM_OPTIONS = ["Support", "FinOps", "Engineering", "Data Ops", "Security"]
const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED_BY_CLIENT", label: "Cancelled by Client" },
]
const STAGE_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "CLIENT_REVIEW", label: "Client Review" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
]

const formatDate = (value?: string | null) => {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

const toInputDateTime = (value?: string | null) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

const toStatusLabel = (status?: string | null) => {
  const normalized = String(status || "").trim().toUpperCase()
  if (normalized === "OPEN") return "Open"
  if (normalized === "IN_PROGRESS" || normalized === "WAITING_FOR_CLIENT" || normalized === "UNDER_REVIEW") return "Under Review"
  if (normalized === "RESOLVED") return "Resolved"
  if (normalized === "CLOSED") return "Closed"
  if (normalized === "CANCELLED_BY_CLIENT") return "Cancelled by Client"
  return "Open"
}

const toStageValue = (progress?: string | null, status?: string | null) => {
  const normalized = String(progress || "").trim().toUpperCase()
  if (normalized === "NEW" || normalized === "IN_PROGRESS" || normalized === "CLIENT_REVIEW" || normalized === "RESOLVED" || normalized === "CLOSED") {
    return normalized
  }

  const normalizedStatus = String(status || "").trim().toUpperCase()
  if (normalizedStatus === "OPEN") return "NEW"
  if (normalizedStatus === "UNDER_REVIEW" || normalizedStatus === "IN_PROGRESS") return "IN_PROGRESS"
  if (normalizedStatus === "RESOLVED") return "RESOLVED"
  if (normalizedStatus === "CLOSED" || normalizedStatus === "CANCELLED_BY_CLIENT") return "CLOSED"
  return "NEW"
}

const statusBadgeVariant = (status?: string | null) => {
  const normalized = String(status || "").trim().toUpperCase()
  if (normalized === "RESOLVED") return "subtle" as const
  if (normalized === "CANCELLED_BY_CLIENT") return "warning" as const
  if (normalized === "CLOSED") return "warning" as const
  return "outline" as const
}

const exportTicketsCsv = (rows: ClientIssueTicket[]) => {
  const header = [
    "Ticket ID",
    "Client Name",
    "Ticket Title",
    "Category",
    "Priority",
    "Status",
    "Progress",
    "Assigned To",
    "Created Date",
    "Last Updated",
    "SLA Date",
  ]

  const data = rows.map((ticket) => [
    ticket.ticket_code || ticket.id,
    ticket.client?.name || "",
    ticket.issue?.title || "",
    ticket.issue?.category || "",
    ticket.issue?.priority || "",
    toStatusLabel(ticket.status),
    STAGE_OPTIONS.find((item) => item.value === toStageValue(ticket.progress, ticket.status))?.label || "New",
    ticket.issue?.assigned_team || "",
    formatDate(ticket.created_at),
    formatDate(ticket.updated_at || ticket.created_at),
    formatDate(ticket.issue?.sla_deadline),
  ])

  const lines = [header, ...data]
    .map((cols) => cols.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(","))
    .join("\n")

  const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `client-issues-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const isValidTicket = (ticket: unknown): ticket is ClientIssueTicket => {
  if (!ticket || typeof ticket !== "object") return false
  const maybe = ticket as Partial<ClientIssueTicket>
  return typeof maybe.id === "string" && maybe.id.length > 0
}

export function IssueManagementPage() {
  const token = useMemo(() => getAdminToken(), [])
  const [tickets, setTickets] = useState<ClientIssueTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [clearingChatId, setClearingChatId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ClientIssueTicket | null>(null)
  const [messages, setMessages] = useState<ClientIssueMessage[]>([])
  const [responseDraft, setResponseDraft] = useState("")
  const [toast, setToast] = useState<string | null>(null)

  const selected = useMemo(() => {
    if (!selectedId) return null
    return tickets.find((ticket) => ticket?.id === selectedId) || detail
  }, [detail, selectedId, tickets])

  const loadTickets = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchClientIssueTickets(token, "ALL")
      setTickets(data.filter(isValidTicket))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load client issue tickets")
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (id: string) => {
    if (!token) return
    setDetailLoading(true)
    setError(null)
    try {
      const data = await fetchClientIssueTicketDetail(token, id)
      const thread = await fetchClientIssueMessages(token, id)
      setDetail(data)
      setMessages(thread)
      setSelectedId(id)
      setResponseDraft("")
      setAdminTicketSeenAt(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load ticket detail")
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    void loadTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    setAdminSectionSeenAt("tickets")
  }, [])

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase()
    return tickets.filter((ticket) => {
      if (!isValidTicket(ticket)) return false
      const matchesQuery =
        query.length === 0 ||
        [
          ticket.ticket_code,
          ticket.id,
          ticket.issue?.title,
          ticket.client?.name,
          ticket.issue?.category,
          ticket.issue?.priority,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)

      const statusLabel = toStatusLabel(ticket.status).toUpperCase().replace(/\s+/g, "_")
      const matchesFilter = statusFilter === "ALL" || statusLabel === statusFilter
      return matchesQuery && matchesFilter
    })
  }, [search, statusFilter, tickets])

  const hasNewClientUpdate = (ticket: ClientIssueTicket) => {
    const seenAt = getAdminTicketSeenAt(ticket.id)
    const latest = ticket.client_responded_at || ticket.created_at
    if (!latest) return false
    const latestTime = new Date(latest).getTime()
    return Number.isFinite(latestTime) && latestTime > seenAt
  }

  const kpis = useMemo(() => {
    const validTickets = tickets.filter(isValidTicket)
    const total = validTickets.length
    const open = validTickets.filter((ticket) => String(ticket.status).toUpperCase() === "OPEN").length
    const inProgress = validTickets.filter((ticket) => String(ticket.status).toUpperCase() === "UNDER_REVIEW").length
    const resolved = validTickets.filter((ticket) => String(ticket.status).toUpperCase() === "RESOLVED").length
    return { total, open, inProgress, resolved }
  }, [tickets])

  const updateTicket = async (
    ticketId: string,
    payload: {
      status?: string
      progress?: string
      assignedTeam?: string
      slaDeadline?: string
    }
  ) => {
    if (!token) return
    const previousTicket = tickets.find((row) => row?.id === ticketId)
    if (!previousTicket) return

    setUpdatingId(ticketId)
    setError(null)
    const optimisticTicket: ClientIssueTicket = {
      ...previousTicket,
      status: payload.status ?? previousTicket.status,
      progress: payload.progress ?? previousTicket.progress,
      issue: {
        ...previousTicket.issue,
        assigned_team: payload.assignedTeam ?? previousTicket.issue?.assigned_team ?? null,
        sla_deadline: payload.slaDeadline ?? previousTicket.issue?.sla_deadline ?? null,
      },
    }

    setTickets((prev) => prev.map((row) => (row?.id === ticketId ? optimisticTicket : row)).filter(isValidTicket))
    if (selectedId === ticketId) setDetail(optimisticTicket)

    try {
      const updated = await updateClientIssueTicket(token, ticketId, payload)
      if (!isValidTicket(updated)) {
        throw new Error("Invalid ticket response from server")
      }
      setTickets((prev) => prev.map((row) => (row?.id === ticketId ? updated : row)).filter(isValidTicket))
      if (selectedId === ticketId) setDetail(updated)
      setToast("Ticket updated")
      window.setTimeout(() => setToast(null), 1400)
    } catch (err) {
      setTickets((prev) => prev.map((row) => (row?.id === ticketId ? previousTicket : row)).filter(isValidTicket))
      if (selectedId === ticketId) setDetail(previousTicket)
      setError(err instanceof ApiError ? err.message : "Failed to update ticket")
    } finally {
      setUpdatingId(null)
    }
  }

  const handleRespond = async () => {
    if (!token || !selectedId || !responseDraft.trim()) return
    setRespondingId(selectedId)
    setError(null)
    try {
      const sentMessage = await sendClientIssueMessage(token, selectedId, responseDraft.trim())
      setMessages((current) => [...current, sentMessage])
      setResponseDraft("")
      setToast("Message sent.")
      window.setTimeout(() => setToast(null), 1600)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send response")
    } finally {
      setRespondingId(null)
    }
  }

  const handleClearChat = async () => {
    if (!token || !selectedId) return
    if (!window.confirm("Clear all messages for this ticket?")) return
    setClearingChatId(selectedId)
    setError(null)
    try {
      await clearClientIssueMessages(token, selectedId)
      setMessages([])
      setToast("Conversation cleared.")
      window.setTimeout(() => setToast(null), 1600)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to clear chat")
    } finally {
      setClearingChatId(null)
    }
  }

  const handleDelete = async (ticketId: string) => {
    if (!token || !window.confirm("Delete this ticket permanently? This cannot be undone.")) return
    setDeletingId(ticketId)
    setError(null)
    try {
      await deleteClientIssueTicket(token, ticketId)
      setTickets((prev) => prev.filter((row) => row.id !== ticketId))
      if (selectedId === ticketId) {
        setSelectedId(null)
        setDetail(null)
        setMessages([])
      }
      setToast("Ticket deleted.")
      window.setTimeout(() => setToast(null), 1400)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete ticket")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">Ticket Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage, assign, and track all client support tickets.</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void loadTickets()} disabled={loading} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">{error}</div>
      ) : null}
      {toast ? (
        <div className="rounded-xl border border-[color:rgba(47,125,106,0.18)] bg-[color:rgba(47,125,106,0.06)] px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">{toast}</div>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-md border border-[color:rgba(15,23,42,0.1)] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Total Tickets</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{kpis.total}</p>
            </div>
            <div className="rounded-md border border-[color:rgba(15,23,42,0.1)] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Open Tickets</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{kpis.open}</p>
            </div>
            <div className="rounded-md border border-[color:rgba(15,23,42,0.1)] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">In Progress</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{kpis.inProgress}</p>
            </div>
            <div className="rounded-md border border-[color:rgba(15,23,42,0.1)] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Resolved</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{kpis.resolved}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket, client, title, category"
              className="h-10 w-full rounded-md border border-[color:rgba(15,23,42,0.15)] bg-white px-3 text-sm text-foreground outline-none transition-colors focus:border-[color:rgba(47,125,106,0.7)]"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-[color:rgba(15,23,42,0.15)] bg-white px-3 text-sm text-foreground outline-none transition-colors focus:border-[color:rgba(47,125,106,0.7)]"
            >
              <option value="ALL">All</option>
              <option value="OPEN">Open</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED_BY_CLIENT">Cancelled by Client</option>
            </select>
            <Button variant="outline" onClick={() => exportTicketsCsv(filteredTickets)}>Export CSV</Button>
          </div>

          <div className="overflow-auto rounded-xl ring-1 ring-[color:rgba(15,23,42,0.08)]">
            <table className="min-w-[1650px] w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
                  <th className="px-3 py-3">Ticket ID</th>
                  <th className="px-3 py-3">Client Name</th>
                  <th className="px-3 py-3">Ticket Title</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Workflow Stage</th>
                  <th className="px-3 py-3">Assigned To</th>
                  <th className="px-3 py-3">Created Date</th>
                  <th className="px-3 py-3">Last Updated</th>
                  <th className="px-3 py-3">SLA Date</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-muted-foreground" colSpan={12}>Loading tickets...</td>
                  </tr>
                ) : filteredTickets.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-muted-foreground" colSpan={12}>No tickets found.</td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="border-t border-[color:rgba(15,23,42,0.06)]">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span>{ticket.ticket_code || ticket.id}</span>
                          {hasNewClientUpdate(ticket) ? <Badge variant="warning">New</Badge> : null}
                        </div>
                      </td>
                      <td className="px-3 py-3">{ticket.client?.name || "-"}</td>
                      <td className="px-3 py-3">{ticket.issue?.title || "-"}</td>
                      <td className="px-3 py-3">{ticket.issue?.category || "-"}</td>
                      <td className="px-3 py-3">{ticket.issue?.priority || "-"}</td>
                      <td className="px-3 py-3"><Badge variant={statusBadgeVariant(ticket.status)}>{toStatusLabel(ticket.status)}</Badge></td>
                      <td className="px-3 py-3">
                        <select
                          className="h-9 rounded-md border border-[color:rgba(15,23,42,0.15)] bg-white px-2 text-xs"
                          value={toStageValue(ticket.progress, ticket.status)}
                          disabled={updatingId === ticket.id}
                          onChange={(e) => {
                            void updateTicket(ticket.id, { progress: e.target.value })
                          }}
                        >
                          {STAGE_OPTIONS.map((stage) => (
                            <option key={stage.value} value={stage.value}>{stage.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className="h-9 rounded-md border border-[color:rgba(15,23,42,0.15)] bg-white px-2 text-xs"
                          value={ticket.issue?.assigned_team || ""}
                          disabled={updatingId === ticket.id}
                          onChange={(e) => {
                            void updateTicket(ticket.id, { assignedTeam: e.target.value })
                          }}
                        >
                          <option value="">Unassigned</option>
                          {TEAM_OPTIONS.map((team) => (
                            <option key={team} value={team}>{team}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">{formatDate(ticket.created_at)}</td>
                      <td className="px-3 py-3">{formatDate(ticket.updated_at || ticket.created_at)}</td>
                      <td className="px-3 py-3">
                        <input
                          className="h-9 rounded-md border border-[color:rgba(15,23,42,0.15)] bg-white px-2 text-xs"
                          type="datetime-local"
                          value={toInputDateTime(ticket.issue?.sla_deadline)}
                          disabled={updatingId === ticket.id}
                          onChange={(e) => {
                            void updateTicket(ticket.id, { slaDeadline: e.target.value })
                          }}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            className="h-9 rounded-md border border-[color:rgba(15,23,42,0.15)] bg-white px-2 text-xs"
                            value={String(ticket.status || "").toUpperCase()}
                            disabled={updatingId === ticket.id}
                            onChange={(e) => {
                              void updateTicket(ticket.id, { status: e.target.value })
                            }}
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                          </select>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9"
                            title="Open ticket"
                            aria-label="Open ticket"
                            onClick={() => void loadDetail(ticket.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9"
                            title="Delete ticket"
                            aria-label="Delete ticket"
                            onClick={() => void handleDelete(ticket.id)}
                            disabled={deletingId === ticket.id}
                          >
                            {deletingId === ticket.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog.Root open={Boolean(selected)} onOpenChange={(open) => {
        if (!open) setSelectedId(null)
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-[780px] overflow-y-auto bg-white p-5 shadow-[-18px_0_48px_-30px_rgba(15,23,42,0.55)] outline-none sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-[color:rgba(15,23,42,0.08)] pb-4">
              <div>
                <Dialog.Title className="text-lg font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">Ticket Details</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {selected?.client?.name || "-"}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>

            {detailLoading ? (
              <p className="text-sm text-muted-foreground">Loading detail...</p>
            ) : selected ? (
              <div className="space-y-4">
                <div className="rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(15,23,42,0.02)] p-3 text-sm">
                  <p><span className="font-semibold text-foreground">Ticket:</span> {selected.issue?.title || "Untitled"}</p>
                  <p className="mt-1"><span className="font-semibold text-foreground">Client:</span> {selected.client?.name || "-"}</p>
                  <p className="mt-1"><span className="font-semibold text-foreground">Description:</span> {selected.issue?.description || "-"}</p>
                  <p className="mt-1"><span className="font-semibold text-foreground">Attachments:</span> {(selected.issue?.attachments || []).join(", ") || "None"}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">Conversation</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={clearingChatId === selected.id || messages.length === 0}
                      onClick={() => void handleClearChat()}
                    >
                      {clearingChatId === selected.id ? "Clearing..." : "Clear Chat"}
                    </Button>
                  </div>
                  <div className="max-h-[340px] space-y-2 overflow-y-auto rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(241,245,249,0.45)] p-3">
                    {messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No messages yet.</p>
                    ) : (
                      messages.map((item) => {
                        const isAdmin = String(item.sender_type).toUpperCase() === "ADMIN"
                        return (
                          <div key={item.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                                isAdmin
                                  ? "rounded-br-md bg-[color:rgba(47,125,106,0.16)] text-foreground"
                                  : "rounded-bl-md bg-white text-foreground ring-1 ring-[color:rgba(15,23,42,0.08)]"
                              }`}
                            >
                              <p className="mb-1 text-[11px] text-muted-foreground">
                                {item.sender_name || (isAdmin ? "KCX Support" : "Client")} - {formatDate(item.created_at)}
                              </p>
                              <p className="whitespace-pre-wrap text-foreground">{item.message}</p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <textarea
                    value={responseDraft}
                    onChange={(e) => setResponseDraft(e.target.value)}
                    maxLength={2000}
                    placeholder="Type a message..."
                    disabled={respondingId === selected.id}
                    rows={3}
                    className="w-full rounded-xl border border-[color:rgba(15,23,42,0.15)] bg-white px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-[color:rgba(47,125,106,0.7)]"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                        void handleRespond()
                      }
                    }}
                  />
                  <div className="flex justify-end">
                    <Button
                      disabled={respondingId === selected.id || responseDraft.trim().length === 0}
                      onClick={() => void handleRespond()}
                    >
                      {respondingId === selected.id ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}


