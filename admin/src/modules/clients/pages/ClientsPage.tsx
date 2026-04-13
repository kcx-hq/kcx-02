import { useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"

import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"
import { getAdminToken } from "@/modules/auth/admin-session"
import { fetchAdminClients, type AdminClientV1 } from "@/modules/clients/admin-clients.api"
import { ClientDetailsDrawer } from "@/modules/clients/components/ClientDetailsDrawer"
import { ApiError } from "@/lib/api"

function formatDateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day} ${hours}:${minutes}`
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
  const [items, setItems] = useState<AdminClientV1[]>([])
  const [selectedClient, setSelectedClient] = useState<AdminClientV1 | null>(null)

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
    <>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">
              Client Management
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Accounts and status.</p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9"
            onClick={load}
            disabled={loading || !token}
            aria-label="Refresh clients"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
                    <th className="px-4 py-3">Serial No.</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Datetime</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                        Loading clients...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                        No clients yet.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr
                        key={item.id}
                        tabIndex={0}
                        className="cursor-pointer border-t border-[color:rgba(15,23,42,0.06)] transition-colors hover:bg-[color:rgba(15,23,42,0.03)] focus-visible:bg-[color:rgba(15,23,42,0.03)] focus-visible:outline-none"
                        onClick={() => setSelectedClient(item)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setSelectedClient(item)
                          }
                        }}
                        aria-label={`Open client details for ${item.fullName}`}
                      >
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">{index + 1}</td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.88)]">
                          <div className="font-medium">{item.fullName}</div>
                          <div className="text-xs text-[color:rgba(15,23,42,0.62)]">{item.email}</div>
                        </td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.tenant.name ?? "-"}</td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.role}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">{formatDateTime(item.updatedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-[color:rgba(15,23,42,0.55)]"
                            aria-label="Actions coming soon"
                            title="Actions coming soon"
                            onClick={(event) => {
                              event.stopPropagation()
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.stopPropagation()
                              }
                            }}
                          >
                            ...
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <ClientDetailsDrawer
        open={selectedClient !== null}
        client={selectedClient}
        onOpenChange={(open) => {
          if (!open) setSelectedClient(null)
        }}
      />
    </>
  )
}
