import { useEffect, useMemo, useState } from "react"

import { ApiError } from "@/lib/api"
import { getAdminToken } from "@/modules/auth/admin-session"
import {
  confirmAdminDemoRequest,
  fetchAdminDemoRequests,
  rejectAdminDemoRequest,
  type AdminDemoRequestSummary,
} from "@/modules/demo-requests/admin-demo-requests.api"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"

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
  if (normalized === "CONFIRMED") return "subtle" as const
  if (normalized === "REJECTED") return "warning" as const
  return "outline" as const
}

export function DemoRequestsPage() {
  const token = useMemo(() => getAdminToken(), [])
  const [activeTab, setActiveTab] = useState<"demos" | "meetings">("demos")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [items, setItems] = useState<AdminDemoRequestSummary[]>([])
  const [actingId, setActingId] = useState<number | null>(null)

  const meetingItems = useMemo(
    () => items.filter((item) => item.status === "CONFIRMED" || Boolean(item.meetingUrl)),
    [items]
  )

  const load = () => {
    if (!token) return
    setLoading(true)
    setError(null)
    fetchAdminDemoRequests(token)
      .then((data) => setItems(data))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Unable to load demo requests"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

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

  return (
    <div className="space-y-5">
      <div className="border-b border-[color:rgba(15,23,42,0.12)]">
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-8">
          <button
            type="button"
            className={`border-b-2 pb-3 text-sm font-semibold uppercase tracking-[0.08em] transition-colors ${
              activeTab === "demos"
                ? "border-[color:rgba(47,125,106,0.92)] text-[color:rgba(47,125,106,0.92)]"
                : "border-transparent text-[color:rgba(15,23,42,0.62)]"
            }`}
            onClick={() => setActiveTab("demos")}
          >
            Demos
          </button>
          <button
            type="button"
            className={`border-b-2 pb-3 text-sm font-semibold uppercase tracking-[0.08em] transition-colors ${
              activeTab === "meetings"
                ? "border-[color:rgba(47,125,106,0.92)] text-[color:rgba(47,125,106,0.92)]"
                : "border-transparent text-[color:rgba(15,23,42,0.62)]"
            }`}
            onClick={() => setActiveTab("meetings")}
          >
            Meetings
          </button>
          </div>
          <Button variant="secondary" onClick={load} disabled={loading || !token}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{activeTab === "demos" ? "Demo requests" : "Meetings"}</CardTitle>
          <CardDescription>{activeTab === "demos" ? `${items.length} total` : `${meetingItems.length} total`}</CardDescription>
        </CardHeader>
        <CardContent>
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

          <div className="mt-3 overflow-auto rounded-xl ring-1 ring-[color:rgba(15,23,42,0.08)]">
            {activeTab === "demos" ? (
              <table className="min-w-[1100px] w-full border-separate border-spacing-0 text-sm">
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
                  ) : items.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={8}>
                        No demo requests yet.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const isPending = item.status === "PENDING"
                      const isActing = actingId === item.id

                      return (
                        <tr key={item.id} className="border-t border-[color:rgba(15,23,42,0.06)]">
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
              <table className="min-w-[960px] w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Slot</th>
                    <th className="px-4 py-3">Meeting</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                        Loading meetings...
                      </td>
                    </tr>
                  ) : meetingItems.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                        No meetings available.
                      </td>
                    </tr>
                  ) : (
                    meetingItems.map((item) => (
                      <tr key={item.id} className="border-t border-[color:rgba(15,23,42,0.06)]">
                        <td className="px-4 py-3 font-medium text-[color:rgba(15,23,42,0.88)]">
                          {item.client.firstName} {item.client.lastName}
                        </td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.client.email}</td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.client.companyName ?? "-"}</td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{formatSlot(item.slotStart, item.slotEnd)}</td>
                        <td className="px-4 py-3">
                          {item.meetingUrl ? (
                            <a
                              className="font-semibold text-[color:rgba(47,125,106,0.92)] hover:underline underline-offset-4"
                              href={item.meetingUrl}
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
                          <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
