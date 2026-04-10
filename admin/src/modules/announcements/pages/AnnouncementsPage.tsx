import { useEffect, useMemo, useState } from "react"

import { ApiError } from "@/lib/api"
import {
  createAnnouncement,
  fetchAnnouncements,
  publishAnnouncement,
  unpublishAnnouncement,
  updateAnnouncement,
  archiveAnnouncement,
  type AdminAnnouncement,
  type AnnouncementPayload,
  type AnnouncementStatus,
} from "@/modules/announcements/admin-announcements.api"
import { AnnouncementCreateModal, type CreateAnnouncementDraft } from "@/modules/announcements/components/AnnouncementCreateModal"
import { AnnouncementEditModal } from "@/modules/announcements/components/AnnouncementEditModal"
import { AnnouncementsFiltersBar } from "@/modules/announcements/components/AnnouncementsFiltersBar"
import { AnnouncementsPagination } from "@/modules/announcements/components/AnnouncementsPagination"
import { AnnouncementsSummaryStrip } from "@/modules/announcements/components/AnnouncementsSummaryStrip"
import {
  toIsoValue,
} from "@/modules/announcements/components/announcement.helpers"
import { AnnouncementsTable } from "@/modules/announcements/components/AnnouncementsTable"
import { getAdminToken } from "@/modules/auth/admin-session"
import { fetchAdminClients, type AdminClientSummary } from "@/modules/clients/admin-clients.api"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"

const PAGE_SIZE = 10

const INITIAL_DRAFT: CreateAnnouncementDraft = {
  title: "",
  body: "",
  status: "DRAFT",
  audienceScope: "ALL",
  audienceClientIds: [],
  audienceTier: "PREMIUM",
  publishAt: "",
  expiresAt: "",
}

export function AnnouncementsPage() {
  const token = useMemo(() => getAdminToken(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [items, setItems] = useState<AdminAnnouncement[]>([])
  const [clients, setClients] = useState<AdminClientSummary[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const [searchInput, setSearchInput] = useState("")
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatus | "">("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<AdminAnnouncement | null>(null)
  const [draft, setDraft] = useState<CreateAnnouncementDraft>(INITIAL_DRAFT)

  const publishedCount = items.filter((item) => item.status === "PUBLISHED").length
  const draftCount = items.filter((item) => item.status === "DRAFT").length
  const archivedCount = items.filter((item) => item.status === "ARCHIVED").length

  const loadAnnouncements = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAnnouncements(token, {
        page,
        limit: PAGE_SIZE,
        search: searchInput,
        status: statusFilter,
        sort: sortOrder,
      })
      setItems(data.items)
      setTotalPages(data.totalPages)
      setTotalItems(data.total)
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Unable to load announcements")
    } finally {
      setLoading(false)
    }
  }

  const loadClients = async () => {
    if (!token) return
    try {
      const data = await fetchAdminClients(token)
      setClients(data)
    } catch {
      setClients([])
    }
  }

  useEffect(() => {
    loadAnnouncements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, statusFilter, sortOrder, searchInput])

  useEffect(() => {
    loadClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const resetDraft = () => {
    setDraft(INITIAL_DRAFT)
  }

  const submitCreate = async () => {
    if (!token) return
    setActionError(null)
    setNotice(null)

    const title = draft.title.trim()
    const body = draft.body.trim()
    if (!title || !body) {
      setActionError("Title and body are required.")
      return
    }
    if (draft.audienceScope === "CLIENT_IDS" && draft.audienceClientIds.length === 0) {
      setActionError("Select at least one client when audience is specific clients.")
      return
    }

    setSaving(true)
    try {
      const payload: AnnouncementPayload = {
        title,
        body,
        status: draft.status,
        audience_scope: draft.audienceScope,
        audience_client_ids: draft.audienceScope === "CLIENT_IDS" ? draft.audienceClientIds : null,
        audience_tier: draft.audienceScope === "CLIENT_TIER" ? draft.audienceTier : null,
        publish_at: toIsoValue(draft.publishAt),
        expires_at: toIsoValue(draft.expiresAt),
      }
      await createAnnouncement(token, payload)
      resetDraft()
      setCreateOpen(false)
      setNotice("Announcement created.")
      await loadAnnouncements()
    } catch (err: unknown) {
      setActionError(err instanceof ApiError ? err.message : "Unable to create announcement")
    } finally {
      setSaving(false)
    }
  }

  const runStatusAction = async (id: string, action: "publish" | "unpublish" | "archive") => {
    if (!token) return
    setActionError(null)
    setNotice(null)
    setSaving(true)
    try {
      if (action === "publish") await publishAnnouncement(token, id)
      if (action === "unpublish") await unpublishAnnouncement(token, id)
      if (action === "archive") await archiveAnnouncement(token, id)
      setNotice("Announcement updated.")
      await loadAnnouncements()
    } catch (err: unknown) {
      setActionError(err instanceof ApiError ? err.message : "Unable to update announcement")
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async () => {
    if (!token || !selected) return
    setActionError(null)
    setNotice(null)
    if (!selected.title.trim() || !selected.body.trim()) {
      setActionError("Title and body are required.")
      return
    }
    if (selected.audience_scope === "CLIENT_IDS" && (selected.audience_client_ids?.length ?? 0) === 0) {
      setActionError("Select at least one client when audience is specific clients.")
      return
    }

    setSaving(true)
    try {
      await updateAnnouncement(token, selected.id, {
        title: selected.title.trim(),
        body: selected.body.trim(),
        status: selected.status,
        audience_scope: selected.audience_scope,
        audience_client_ids: selected.audience_scope === "CLIENT_IDS" ? selected.audience_client_ids ?? [] : null,
        audience_tier: selected.audience_scope === "CLIENT_TIER" ? selected.audience_tier ?? "PREMIUM" : null,
        publish_at: selected.publish_at,
        expires_at: selected.expires_at,
      })
      setSelected(null)
      setNotice("Announcement saved.")
      await loadAnnouncements()
    } catch (err: unknown) {
      setActionError(err instanceof ApiError ? err.message : "Unable to update announcement")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.025em] text-[color:rgba(15,23,42,0.92)]">Announcements</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="h-9 rounded-[7px] bg-[color:rgba(47,125,106,0.98)] px-4 text-sm text-white hover:bg-[color:rgba(38,107,90,0.98)]"
            onClick={() => {
              setActionError(null)
              setCreateOpen(true)
            }}
            disabled={!token}
          >
            Create Announcement
          </Button>
        </div>
      </div>

      <Card className="rounded-[2px] border border-[color:rgba(15,23,42,0.1)] bg-[color:rgba(249,250,251,0.85)]">
        <CardContent className="p-4">
          <AnnouncementsSummaryStrip total={totalItems} published={publishedCount} draft={draftCount} archived={archivedCount} />

          {actionError && !createOpen && !selected ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
              {actionError}
            </div>
          ) : null}
          {notice ? (
            <div className="mt-4 rounded-xl border border-[color:rgba(47,125,106,0.18)] bg-[color:rgba(47,125,106,0.06)] px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
              {error}
            </div>
          ) : null}

          <div className="mt-4">
            <AnnouncementsFiltersBar
              search={searchInput}
              onSearchChange={(value) => {
                setPage(1)
                setSearchInput(value)
              }}
              statusFilter={statusFilter}
              onStatusFilterChange={(value) => {
                setPage(1)
                setStatusFilter(value)
              }}
              sortOrder={sortOrder}
              onSortOrderChange={(value) => {
                setPage(1)
                setSortOrder(value)
              }}
            />
          </div>

          <AnnouncementsTable
            items={items}
            loading={loading}
            saving={saving}
            onEdit={(item) => {
              setActionError(null)
              setSelected(item)
            }}
            onPublish={(id) => void runStatusAction(id, "publish")}
            onUnpublish={(id) => void runStatusAction(id, "unpublish")}
            onArchive={(id) => void runStatusAction(id, "archive")}
          />

          <AnnouncementsPagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </CardContent>
      </Card>

      <AnnouncementCreateModal
        open={createOpen}
        draft={draft}
        clients={clients}
        saving={saving}
        errorMessage={createOpen ? actionError : null}
        onClose={() => {
          setCreateOpen(false)
          setActionError(null)
        }}
        onDraftChange={setDraft}
        onClear={resetDraft}
        onSave={() => void submitCreate()}
      />

      <AnnouncementEditModal
        selected={selected}
        clients={clients}
        saving={saving}
        errorMessage={selected ? actionError : null}
        onClose={() => {
          setSelected(null)
          setActionError(null)
        }}
        onChange={setSelected}
        onSave={() => void saveEdit()}
      />
    </div>
  )
}
