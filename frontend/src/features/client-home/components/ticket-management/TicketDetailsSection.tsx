import { cn } from "@/lib/utils"
import type { TicketItem, TicketView } from "@/features/client-home/components/ticket-management/types"
import { CalendarClock, CheckCircle2, CircleDot, Eye, RefreshCw, Search, Tag, User, XCircle } from "lucide-react"

type TicketDetailsSectionProps = {
  tickets: TicketItem[]
  createdCount: number
  draftCount: number
  ticketView: TicketView
  onViewChange: (view: TicketView) => void
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  statusFilter: "ALL" | "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED" | "CANCELLED_BY_CLIENT"
  onStatusFilterChange: (value: "ALL" | "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED" | "CANCELLED_BY_CLIENT") => void
  onRefresh: () => void
  onViewTicket: (ticket: TicketItem) => void
  onClientAction: (ticketId: string, action: "RESOLVED" | "UNRESOLVED" | "CANCEL") => void
  actionLoadingId?: string | null
}

function statusPillClass(status: string) {
  if (status === "Under Review") {
    return "border-[rgba(48,114,191,0.26)] bg-[rgba(66,123,179,0.14)] text-[color:#1f5b9c]"
  }

  if (status === "Open") {
    return "border-[rgba(180,120,24,0.26)] bg-[rgba(214,135,26,0.14)] text-[color:#925208]"
  }

  if (status === "Resolved") {
    return "border-[rgba(55,145,116,0.26)] bg-[rgba(55,145,116,0.14)] text-[color:#1f7d60]"
  }
  if (status === "Cancelled by Client") {
    return "border-[rgba(217,93,85,0.3)] bg-[rgba(217,93,85,0.12)] text-[color:#9b2f28]"
  }

  return "border-[rgba(92,105,117,0.26)] bg-[rgba(92,105,117,0.12)] text-[color:#445362]"
}

function displayStatus(ticket: TicketItem) {
  if (ticket.progress === "CLIENT_REVIEW") return "Client Review"
  if (ticket.workflowStage === "Client Marked Unresolved") return "Not Resolved"
  return ticket.status
}

export function TicketDetailsSection({
  tickets,
  createdCount,
  draftCount,
  ticketView,
  onViewChange,
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  onViewTicket,
  onClientAction,
  actionLoadingId = null,
}: TicketDetailsSectionProps) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => onViewChange("created")}
            className={cn(
              "border-b-2 pb-2 text-sm font-semibold transition-colors",
              ticketView === "created"
                ? "border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]"
                : "border-transparent text-text-secondary"
            )}
          >
            Created Tickets ({createdCount})
          </button>
          <button
            type="button"
            onClick={() => onViewChange("draft")}
            className={cn(
              "border-b-2 pb-2 text-sm font-semibold transition-colors",
              ticketView === "draft"
                ? "border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]"
                : "border-transparent text-text-secondary"
            )}
          >
            Draft Tickets ({draftCount})
          </button>
        </div>

        <div className="flex w-full flex-wrap items-end justify-end gap-2 lg:w-auto lg:flex-nowrap">
          <label className="sr-only" htmlFor="ticket-search">
            Search tickets
          </label>
          <span className="relative block w-full md:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              id="ticket-search"
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search tickets..."
              className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] pl-9 pr-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
            />
          </span>

          <label className="sr-only" htmlFor="ticket-status-filter">
            Filter tickets by status
          </label>
          <select
            id="ticket-status-filter"
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(event.target.value as "ALL" | "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED" | "CANCELLED_BY_CLIENT")
            }
            className="h-10 min-w-[190px] rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED_BY_CLIENT">Cancelled by Client</option>
          </select>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary transition-colors hover:bg-[color:var(--bg-soft)]"
            aria-label="Refresh tickets"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[1500px] w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[color:var(--border-light)]">
              {[
                "Ticket Title",
                "Created By",
                "Category",
                "Priority",
                "Status",
                "Workflow Stage",
                "Created Date",
                "Last Updated",
                "SLA Deadline",
                "Attachments",
                "Actions",
              ].map((label) => (
                <th key={label} className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-sm text-text-secondary">
                  No tickets found for the selected filters.
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id} className="border-b border-[color:var(--border-light)] last:border-b-0">
                  <td className="px-3 py-4">
                    <p className="text-sm font-semibold text-text-primary">{ticket.title}</p>
                    <p className="mt-1 text-xs text-text-secondary">{ticket.code}</p>
                  </td>
                  <td className="px-3 py-4">
                    <span className="inline-flex items-center gap-2 text-sm text-text-primary">
                      <User className="h-3.5 w-3.5 text-text-muted" />
                      {ticket.createdBy}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-2 py-1 text-xs text-text-secondary">
                      <Tag className="h-3 w-3" />
                      {ticket.category}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-2 py-1 text-xs text-text-secondary">
                      <CircleDot className="h-3 w-3" />
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <div className="space-y-1">
                      <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]", statusPillClass(displayStatus(ticket)))}>
                        {displayStatus(ticket)}
                      </span>
                      {ticket.progress === "CLIENT_REVIEW" ? (
                        <p className="text-[11px] font-medium text-[color:#8a4f00]">Please mark: Resolved / Not Resolved</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-text-secondary">{ticket.workflowStage}</td>
                  <td className="px-3 py-4 text-sm text-text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {ticket.createdDate}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-sm text-text-secondary">{ticket.lastUpdated}</td>
                  <td className="px-3 py-4 text-sm text-text-secondary">{ticket.slaDeadline}</td>
                  <td className="px-3 py-4 text-sm text-text-secondary">{ticket.attachments}</td>
                  <td className="px-3 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {ticket.progress === "CLIENT_REVIEW" ? (
                        <>
                          <button
                            type="button"
                            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[rgba(55,145,116,0.3)] bg-[rgba(55,145,116,0.12)] px-2 text-[11px] font-semibold text-[color:#1f7d60] transition hover:bg-[rgba(55,145,116,0.2)] disabled:opacity-60"
                            disabled={actionLoadingId === ticket.id}
                            onClick={() => onClientAction(ticket.id, "RESOLVED")}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Resolved
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[rgba(180,120,24,0.3)] bg-[rgba(214,135,26,0.12)] px-2 text-[11px] font-semibold text-[color:#8a4f00] transition hover:bg-[rgba(214,135,26,0.2)] disabled:opacity-60"
                            disabled={actionLoadingId === ticket.id}
                            onClick={() => onClientAction(ticket.id, "UNRESOLVED")}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Not Resolved
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(55,145,116,0.26)] bg-[rgba(55,145,116,0.12)] text-[color:#1f7d60] transition hover:bg-[rgba(55,145,116,0.2)]"
                        aria-label="View ticket"
                        onClick={() => onViewTicket(ticket)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(217,93,85,0.3)] bg-[rgba(217,93,85,0.11)] text-[color:#a43d37] transition hover:bg-[rgba(217,93,85,0.18)]"
                        aria-label="Cancel ticket"
                        disabled={!ticket.canClientCancel || actionLoadingId === ticket.id}
                        onClick={() => onClientAction(ticket.id, "CANCEL")}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
