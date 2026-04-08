import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"
import { getAdminToken } from "@/modules/auth/admin-session"
import { fetchAdminClients, type AdminClientSummary } from "@/modules/clients/admin-clients.api"
import { ApiError } from "@/lib/api"

function formatDateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function statusVariant(status: string) {
  const normalized = status.toUpperCase()
  if (normalized === "ACTIVE") return "subtle" as const
  if (normalized === "BLOCKED") return "warning" as const
  return "outline" as const
}

export function ClientsPage() {
  const token = useMemo(() => getAdminToken(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<AdminClientSummary[]>([])

  const load = () => {
    if (!token) return
    setLoading(true)
    setError(null)
    fetchAdminClients(token)
      .then((data) => setItems(data))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Unable to load clients"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">
            Client Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Accounts and status.</p>
        </div>
        <Button variant="secondary" onClick={load} disabled={loading || !token}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
          <CardDescription>{items.length} total</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
              {error}
            </div>
          ) : null}

          <div className="mt-3 overflow-auto rounded-xl ring-1 ring-[color:rgba(15,23,42,0.08)]">
            <table className="min-w-[980px] w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Heard about us</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
                      Loading clients...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
                      No clients yet.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-t border-[color:rgba(15,23,42,0.06)]">
                      <td className="px-4 py-3 font-medium text-[color:rgba(15,23,42,0.88)]">
                        {item.firstName} {item.lastName}
                      </td>
                      <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.email}</td>
                      <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.companyName ?? "â€”"}</td>
                      <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.heardAboutUs ?? "â€”"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">{item.source}</td>
                      <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">{formatDateTime(item.updatedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
