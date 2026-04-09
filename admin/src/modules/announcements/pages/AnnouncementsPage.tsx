import { useEffect, useMemo, useState } from "react"

import { ApiError } from "@/lib/api"
import { getAdminToken } from "@/modules/auth/admin-session"
import { fetchAdminClients, type AdminClientSummary } from "@/modules/clients/admin-clients.api"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"
import {
  archiveAnnouncement,
  createAnnouncement,
  fetchAnnouncements,
  publishAnnouncement,
  unpublishAnnouncement,
  updateAnnouncement,
  type AdminAnnouncement,
  type AnnouncementAudienceScope,
  type AnnouncementAudienceTier,
  type AnnouncementPayload,
  type AnnouncementStatus,
} from "@/modules/announcements/admin-announcements.api"

const PAGE_SIZE = 10
const STATUS_OPTIONS: AnnouncementStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"]

function toLocalInputValue(iso?: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function toIsoValue(localValue: string): string | null {
  if (!localValue) return null
  const date = new Date(localValue)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function statusVariant(status: AnnouncementStatus) {
  if (status === "PUBLISHED") return "subtle" as const
  if (status === "ARCHIVED") return "warning" as const
  return "outline" as const
}

function toClientLabel(client: AdminClientSummary): string {
  const fullName = `${client.firstName} ${client.lastName}`.trim()
  return fullName.length > 0 ? fullName : client.email
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

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatus | "">("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const [selected, setSelected] = useState<AdminAnnouncement | null>(null)

  const [draft, setDraft] = useState({
    title: "",
    body: "",
    status: "DRAFT" as AnnouncementStatus,
    audienceScope: "ALL" as AnnouncementAudienceScope,
    audienceClientIds: [] as string[],
    audienceTier: "PREMIUM" as AnnouncementAudienceTier,
    publishAt: "",
    expiresAt: "",
  })

  const loadAnnouncements = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAnnouncements(token, {
        page,
        limit: PAGE_SIZE,
        search,
        status: statusFilter,
        sort: sortOrder,
      })
      setItems(data.items)
      setTotalPages(data.totalPages)
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
  }, [token, page, statusFilter, sortOrder])

  useEffect(() => {
    loadClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const resetDraft = () => {
    setDraft({
      title: "",
      body: "",
      status: "DRAFT",
      audienceScope: "ALL",
      audienceClientIds: [],
      audienceTier: "PREMIUM",
      publishAt: "",
      expiresAt: "",
    })
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

  const audienceText = (item: AdminAnnouncement) => {
    if (item.audience_scope === "ALL") return "All clients"
    if (item.audience_scope === "CLIENT_TIER") return `${item.audience_tier ?? "Tier"} clients`
    return `${item.audience_client_ids?.length ?? 0} selected`
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">Announcements</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create, publish, and manage client-facing updates.</p>
        </div>
        <Button variant="secondary" onClick={loadAnnouncements} disabled={loading || !token}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create announcement</CardTitle>
          <CardDescription>Draft now, publish now, or set a publish schedule.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {actionError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
              {actionError}
            </div>
          ) : null}
          {notice ? (
            <div className="rounded-xl border border-[color:rgba(47,125,106,0.18)] bg-[color:rgba(47,125,106,0.06)] px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
              {notice}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="h-10 rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Title"
            />
            <select
              className="h-10 rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
              value={draft.status}
              onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as AnnouncementStatus }))}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <textarea
            className="min-h-[110px] w-full rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
            value={draft.body}
            onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
            placeholder="Message body"
          />

          <div className="grid gap-3 md:grid-cols-3">
            <select
              className="h-10 rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
              value={draft.audienceScope}
              onChange={(e) => setDraft((prev) => ({ ...prev, audienceScope: e.target.value as AnnouncementAudienceScope }))}
            >
              <option value="ALL">All clients</option>
              <option value="CLIENT_TIER">Client tier</option>
              <option value="CLIENT_IDS">Specific clients</option>
            </select>

            {draft.audienceScope === "CLIENT_TIER" ? (
              <select
                className="h-10 rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
                value={draft.audienceTier}
                onChange={(e) => setDraft((prev) => ({ ...prev, audienceTier: e.target.value as AnnouncementAudienceTier }))}
              >
                <option value="PREMIUM">Premium</option>
                <option value="STANDARD">Standard</option>
              </select>
            ) : null}

            <input
              className="h-10 rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
              type="datetime-local"
              value={draft.publishAt}
              onChange={(e) => setDraft((prev) => ({ ...prev, publishAt: e.target.value }))}
            />
          </div>

          {draft.audienceScope === "CLIENT_IDS" ? (
            <select
              multiple
              className="min-h-[96px] w-full rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
              value={draft.audienceClientIds}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  audienceClientIds: Array.from(e.target.selectedOptions).map((opt) => opt.value),
                }))
              }
            >
              {clients.map((client) => (
                <option key={String(client.id)} value={String(client.id)}>
                  {toClientLabel(client)} ({client.email})
                </option>
              ))}
            </select>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="h-10 rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
              type="datetime-local"
              value={draft.expiresAt}
              onChange={(e) => setDraft((prev) => ({ ...prev, expiresAt: e.target.value }))}
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={resetDraft} disabled={saving}>
                Clear
              </Button>
              <Button onClick={submitCreate} disabled={saving}>
                {saving ? "Saving..." : "Save announcement"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manage announcements</CardTitle>
          <CardDescription>{items.length} on this page</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
              {error}
            </div>
          ) : null}

          <div className="mb-3 grid gap-2 md:grid-cols-4">
            <input
              className="h-10 rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title/body"
            />
            <select
              className="h-10 rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
              value={statusFilter}
              onChange={(e) => {
                setPage(1)
                setStatusFilter(e.target.value as AnnouncementStatus | "")
              }}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
              value={sortOrder}
              onChange={(e) => {
                setPage(1)
                setSortOrder(e.target.value as "asc" | "desc")
              }}
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
            <Button
              variant="secondary"
              onClick={() => {
                setPage(1)
                void loadAnnouncements()
              }}
              disabled={loading}
            >
              Apply
            </Button>
          </div>

          <div className="overflow-auto rounded-xl ring-1 ring-[color:rgba(15,23,42,0.08)]">
            <table className="min-w-[1100px] w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Audience</th>
                  <th className="px-4 py-3">Publish at</th>
                  <th className="px-4 py-3">Expires at</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                      Loading announcements...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                      No announcements found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-t border-[color:rgba(15,23,42,0.06)]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[color:rgba(15,23,42,0.88)]">{item.title}</div>
                        <div className="max-w-[420px] truncate text-[color:rgba(15,23,42,0.72)]">{item.body}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{audienceText(item)}</td>
                      <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">{formatDateTime(item.publish_at)}</td>
                      <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">{formatDateTime(item.expires_at)}</td>
                      <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">{formatDateTime(item.updated_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setSelected(item)} disabled={saving}>
                            Edit
                          </Button>
                          {item.status !== "PUBLISHED" ? (
                            <Button
                              size="sm"
                              onClick={() => runStatusAction(item.id, "publish")}
                              disabled={saving}
                            >
                              Publish
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => runStatusAction(item.id, "unpublish")}
                              disabled={saving}
                            >
                              Unpublish
                            </Button>
                          )}
                          {item.status !== "ARCHIVED" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => runStatusAction(item.id, "archive")}
                              disabled={saving}
                            >
                              Archive
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
                Prev
              </Button>
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:rgba(2,6,23,0.45)] p-4">
          <div className="w-full max-w-2xl rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white p-4 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[color:rgba(15,23,42,0.92)]">Edit announcement</h2>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
            <div className="space-y-3">
              <input
                className="h-10 w-full rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
                value={selected.title}
                onChange={(e) => setSelected((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
              />
              <textarea
                className="min-h-[110px] w-full rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
                value={selected.body}
                onChange={(e) => setSelected((prev) => (prev ? { ...prev, body: e.target.value } : prev))}
              />
              <div className="grid gap-3 md:grid-cols-3">
                <select
                  className="h-10 rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
                  value={selected.status}
                  onChange={(e) =>
                    setSelected((prev) => (prev ? { ...prev, status: e.target.value as AnnouncementStatus } : prev))
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
                  value={selected.audience_scope}
                  onChange={(e) =>
                    setSelected((prev) =>
                      prev
                        ? {
                            ...prev,
                            audience_scope: e.target.value as AnnouncementAudienceScope,
                            audience_client_ids: e.target.value === "CLIENT_IDS" ? prev.audience_client_ids ?? [] : null,
                            audience_tier: e.target.value === "CLIENT_TIER" ? prev.audience_tier ?? "PREMIUM" : null,
                          }
                        : prev
                    )
                  }
                >
                  <option value="ALL">All clients</option>
                  <option value="CLIENT_TIER">Client tier</option>
                  <option value="CLIENT_IDS">Specific clients</option>
                </select>
                <input
                  className="h-10 rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
                  type="datetime-local"
                  value={toLocalInputValue(selected.publish_at)}
                  onChange={(e) =>
                    setSelected((prev) => (prev ? { ...prev, publish_at: toIsoValue(e.target.value) } : prev))
                  }
                />
              </div>

              {selected.audience_scope === "CLIENT_TIER" ? (
                <select
                  className="h-10 w-full rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
                  value={selected.audience_tier ?? "PREMIUM"}
                  onChange={(e) =>
                    setSelected((prev) => (prev ? { ...prev, audience_tier: e.target.value as AnnouncementAudienceTier } : prev))
                  }
                >
                  <option value="PREMIUM">Premium</option>
                  <option value="STANDARD">Standard</option>
                </select>
              ) : null}

              {selected.audience_scope === "CLIENT_IDS" ? (
                <select
                  multiple
                  className="min-h-[96px] w-full rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
                  value={selected.audience_client_ids ?? []}
                  onChange={(e) =>
                    setSelected((prev) =>
                      prev
                        ? {
                            ...prev,
                            audience_client_ids: Array.from(e.target.selectedOptions).map((opt) => opt.value),
                          }
                        : prev
                    )
                  }
                >
                  {clients.map((client) => (
                    <option key={String(client.id)} value={String(client.id)}>
                      {toClientLabel(client)} ({client.email})
                    </option>
                  ))}
                </select>
              ) : null}

              <input
                className="h-10 w-full rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
                type="datetime-local"
                value={toLocalInputValue(selected.expires_at)}
                onChange={(e) =>
                  setSelected((prev) => (prev ? { ...prev, expires_at: toIsoValue(e.target.value) } : prev))
                }
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelected(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
