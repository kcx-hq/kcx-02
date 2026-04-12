import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TicketCreateDialog } from "@/features/client-home/components/ticket-management/TicketCreateDialog"
import { TicketDetailsSection } from "@/features/client-home/components/ticket-management/TicketDetailsSection"
import { TicketManagementHero } from "@/features/client-home/components/ticket-management/TicketManagementHero"
import { TicketStatsRow } from "@/features/client-home/components/ticket-management/TicketStatsRow"
import type {
  ClientTicketAction,
  TicketCreatePayload,
  TicketItem,
  TicketMessage,
  TicketTableStatus,
  TicketView,
} from "@/features/client-home/components/ticket-management/types"
import {
  applyClientSupportTicketAction,
  createClientSupportTicket,
  fetchClientSupportTicketDetail,
  fetchClientSupportTicketMessages,
  fetchClientSupportTickets,
  sendClientSupportTicketMessage,
} from "@/features/client-home/components/ticket-management/ticket-management.api"
import { ApiError } from "@/lib/api"

const STATUS_FILTER_TO_TABLE_STATUS: Record<
  "ALL" | "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED" | "CANCELLED_BY_CLIENT",
  TicketTableStatus | "ALL"
> = {
  ALL: "ALL",
  OPEN: "Open",
  UNDER_REVIEW: "Under Review",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED_BY_CLIENT: "Cancelled by Client",
}

export function TicketManagementSection() {
  const [ticketView, setTicketView] = useState<TicketView>("created")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED" | "CANCELLED_BY_CLIENT">("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false)
  const [createdTickets, setCreatedTickets] = useState<TicketItem[]>([])
  const [draftTickets, setDraftTickets] = useState<TicketItem[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [ticketsError, setTicketsError] = useState<string | null>(null)
  const [submittingTicket, setSubmittingTicket] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null)
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([])
  const [loadingTicketDetail, setLoadingTicketDetail] = useState(false)
  const [messageDraft, setMessageDraft] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const messagesViewportRef = useRef<HTMLDivElement | null>(null)

  const tableTickets = ticketView === "created" ? createdTickets : draftTickets

  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const mappedStatus = STATUS_FILTER_TO_TABLE_STATUS[statusFilter]

    return tableTickets.filter((ticket) => {
      const searchableText = [ticket.title, ticket.code, ticket.createdBy, ticket.category, ticket.priority, ticket.status]
        .join(" ")
        .toLowerCase()
      const matchesSearch = !query || searchableText.includes(query)
      const matchesStatus = mappedStatus === "ALL" || ticket.status === mappedStatus

      return matchesSearch && matchesStatus
    })
  }, [searchQuery, statusFilter, tableTickets])

  const stats = useMemo(() => {
    const allTickets = [...createdTickets, ...draftTickets]
    return {
      total: allTickets.length,
      open: allTickets.filter((ticket) => ticket.status === "Open").length,
      underReview: allTickets.filter((ticket) => ticket.status === "Under Review").length,
      resolved: allTickets.filter((ticket) => ticket.status === "Resolved").length,
      closed: allTickets.filter((ticket) => ticket.status === "Closed").length,
    }
  }, [createdTickets, draftTickets])

  function applyTicketBuckets(tickets: TicketItem[]) {
    setCreatedTickets(tickets.filter((ticket) => ticket.status !== "Draft"))
    setDraftTickets(tickets.filter((ticket) => ticket.status === "Draft"))
  }

  function upsertTicket(updated: TicketItem) {
    setCreatedTickets((current) => {
      const nextCreated = current.filter((row) => row.id !== updated.id)
      return updated.status === "Draft" ? nextCreated : [updated, ...nextCreated]
    })
    setDraftTickets((current) => {
      const nextDraft = current.filter((row) => row.id !== updated.id)
      return updated.status === "Draft" ? [updated, ...nextDraft] : nextDraft
    })
  }

  async function loadTickets() {
    setLoadingTickets(true)
    setTicketsError(null)
    try {
      const tickets = await fetchClientSupportTickets()
      applyTicketBuckets(tickets)
    } catch (err: unknown) {
      setTicketsError(err instanceof ApiError ? err.message : "Unable to load tickets")
    } finally {
      setLoadingTickets(false)
    }
  }

  useEffect(() => {
    void loadTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreateTicket(payload: TicketCreatePayload, mode: "submit" | "draft") {
    setSubmittingTicket(true)
    setTicketsError(null)
    try {
      const created = await createClientSupportTicket(payload)
      upsertTicket(created)
      setTicketView(mode === "draft" ? "draft" : "created")
      setStatusFilter("ALL")
      setSearchQuery("")
      setIsCreateTicketOpen(false)
    } catch (err: unknown) {
      setTicketsError(err instanceof ApiError ? err.message : "Unable to create ticket")
    } finally {
      setSubmittingTicket(false)
    }
  }

  async function handleViewTicket(ticket: TicketItem) {
    setSelectedTicketId(ticket.id)
    setLoadingTicketDetail(true)
    setTicketsError(null)
    try {
      const [detail, messages] = await Promise.all([
        fetchClientSupportTicketDetail(ticket.id),
        fetchClientSupportTicketMessages(ticket.id),
      ])
      setSelectedTicket(detail)
      setTicketMessages(messages)
    } catch (err: unknown) {
      setTicketsError(err instanceof ApiError ? err.message : "Unable to load ticket details")
    } finally {
      setLoadingTicketDetail(false)
    }
  }

  async function handleSendMessage() {
    if (!selectedTicketId || !messageDraft.trim()) return
    setSendingMessage(true)
    setTicketsError(null)
    try {
      const message = await sendClientSupportTicketMessage(selectedTicketId, messageDraft.trim())
      setTicketMessages((current) => [...current, message])
      setMessageDraft("")
    } catch (err: unknown) {
      setTicketsError(err instanceof ApiError ? err.message : "Unable to send message")
    } finally {
      setSendingMessage(false)
    }
  }

  useEffect(() => {
    if (!messagesViewportRef.current) return
    messagesViewportRef.current.scrollTop = messagesViewportRef.current.scrollHeight
  }, [ticketMessages, selectedTicketId])

  async function handleClientAction(ticketId: string, action: ClientTicketAction) {
    setActionLoadingId(ticketId)
    setTicketsError(null)
    try {
      const updated = await applyClientSupportTicketAction(ticketId, action)
      upsertTicket(updated)
      if (selectedTicketId === updated.id) {
        setSelectedTicket(updated)
      }
    } catch (err: unknown) {
      setTicketsError(err instanceof ApiError ? err.message : "Unable to update ticket")
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <section className="space-y-4">
      <section className="rounded-[24px] border border-[color:var(--border-light)] bg-white px-5 py-5 shadow-sm-custom">
        <TicketManagementHero onCreateTicket={() => setIsCreateTicketOpen(true)} />

        <div className="mt-4 border-t border-[color:var(--border-light)] pt-4">
          <TicketStatsRow
            total={stats.total}
            open={stats.open}
            underReview={stats.underReview}
            resolved={stats.resolved}
            closed={stats.closed}
          />
        </div>

        <div className="mt-4 border-t border-[color:var(--border-light)] pt-4">
          <TicketDetailsSection
            tickets={loadingTickets ? [] : filteredTickets}
            createdCount={createdTickets.length}
            draftCount={draftTickets.length}
            ticketView={ticketView}
            onViewChange={setTicketView}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onRefresh={() => {
              void loadTickets()
            }}
            onViewTicket={(ticket) => {
              void handleViewTicket(ticket)
            }}
            onClientAction={(ticketId, action) => {
              void handleClientAction(ticketId, action)
            }}
            actionLoadingId={actionLoadingId}
          />
          {ticketsError ? (
            <p className="mt-3 text-sm text-rose-600">{ticketsError}</p>
          ) : null}
          {loadingTickets ? (
            <p className="mt-3 text-sm text-text-secondary">Loading tickets...</p>
          ) : null}
        </div>
      </section>

      <TicketCreateDialog
        open={isCreateTicketOpen}
        onOpenChange={setIsCreateTicketOpen}
        onSubmit={(payload, mode) => {
          void handleCreateTicket(payload, mode)
        }}
        submitting={submittingTicket}
      />

      <Dialog
        open={Boolean(selectedTicketId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTicketId(null)
            setSelectedTicket(null)
            setTicketMessages([])
            setMessageDraft("")
          }
        }}
      >
        <DialogContent className="!left-auto !right-0 !top-0 !h-screen !max-h-screen !w-[min(92vw,48rem)] !max-w-none !translate-x-0 !translate-y-0 overflow-hidden rounded-none border-l border-[color:var(--border-light)] p-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right">
          <DialogHeader className="border-b border-[color:var(--border-light)] px-6 py-4">
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em] text-text-primary">Ticket Insights</DialogTitle>
            <p className="mt-1 text-sm text-text-secondary">{selectedTicket?.createdBy || "Client"}</p>
          </DialogHeader>

          {loadingTicketDetail ? (
            <p className="px-6 py-6 text-sm text-text-secondary">Loading ticket details...</p>
          ) : selectedTicket ? (
            <div className="flex h-[calc(100vh-88px)] flex-col gap-4 px-6 py-4">
              <div className="rounded-2xl border border-[color:var(--border-light)] bg-[color:rgba(15,23,42,0.015)] p-4 text-sm text-text-secondary">
                <p><span className="font-semibold text-text-primary">Ticket:</span> {selectedTicket.title || "Untitled"}</p>
                <p className="mt-1"><span className="font-semibold text-text-primary">Client:</span> {selectedTicket.createdBy || "-"}</p>
                <p className="mt-1"><span className="font-semibold text-text-primary">Description:</span> {selectedTicket.description || "-"}</p>
                <p className="mt-1"><span className="font-semibold text-text-primary">Attachments:</span> {selectedTicket.attachmentFiles.join(", ") || "None"}</p>
              </div>

              <div className="flex min-h-0 flex-1 flex-col space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Conversation</p>
                <div
                  ref={messagesViewportRef}
                  className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-[color:var(--border-light)] bg-[color:rgba(241,245,249,0.45)] p-3"
                >
                  {ticketMessages.length === 0 ? (
                    <p className="text-sm text-text-secondary">No messages yet.</p>
                  ) : (
                    ticketMessages.map((message) => {
                      const isClient = String(message.sender_type).toUpperCase() === "CLIENT"
                      return (
                        <div key={message.id} className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm ${
                              isClient
                                ? "rounded-br-md bg-[rgba(55,145,116,0.14)] text-text-primary"
                                : "rounded-bl-md bg-white text-text-primary ring-1 ring-[color:var(--border-light)]"
                            }`}
                          >
                            <p className="mb-1 text-[11px] text-text-muted">{message.sender_name || (isClient ? "You" : "KCX Support")}</p>
                            <p className="whitespace-pre-wrap">{message.message}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <textarea
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  rows={4}
                  placeholder="Type a message..."
                  className="w-full rounded-2xl border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    className="h-11 rounded-xl px-5"
                    disabled={sendingMessage || messageDraft.trim().length === 0}
                    onClick={() => {
                      void handleSendMessage()
                    }}
                  >
                    {sendingMessage ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
