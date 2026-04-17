import { useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"

import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"
import { getAdminToken } from "@/modules/auth/admin-session"
import { fetchAdminClients, type AdminClientV1 } from "@/modules/clients/admin-clients.api"
import { deriveClientOperationalSummary } from "@/modules/clients/client-operational-summary"
import { ClientDetailsDrawer } from "@/modules/clients/components/ClientDetailsDrawer"
import { ApiError } from "@/lib/api"

const CLIENTS_PAGE_SIZE = 10

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

function operationalStateVariant(state: string) {
  const normalized = state.toUpperCase()
  if (normalized === "OPERATIONAL") return "subtle" as const
  if (normalized === "NEEDS ATTENTION" || normalized === "NO DATA FLOW") return "warning" as const
  return "outline" as const
}

export function ClientsPage() {
  const token = useMemo(() => getAdminToken(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<AdminClientV1[]>([])
  const [selectedClient, setSelectedClient] = useState<AdminClientV1 | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [page, setPage] = useState(1)

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

  const rows = useMemo(
    () =>
      items.map((client) => ({
        client,
        operational: deriveClientOperationalSummary(client),
      })),
    [items]
  )

  const kpis = useMemo(() => {
    const total = rows.length
    const active = rows.filter((row) => String(row.client.status).toUpperCase() === "ACTIVE").length
    const operational = rows.filter((row) => row.operational.state === "Operational").length
    const needsAttention = rows.filter((row) =>
      ["Needs Attention", "No Data Flow", "Partial", "Not Setup"].includes(row.operational.state)
    ).length

    return { total, active, operational, needsAttention }
  }, [rows])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesQuery =
        query.length === 0 ||
        [
          row.client.fullName,
          row.client.email,
          row.client.tenant.name,
          row.client.role,
          row.client.status,
          row.operational.state,
          row.operational.cloudStatus,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)

      const normalizedStatus = String(row.client.status).toUpperCase()
      const matchesStatus = statusFilter === "ALL" || normalizedStatus === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [rows, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / CLIENTS_PAGE_SIZE))
  const pagedRows = useMemo(() => {
    const start = (page - 1) * CLIENTS_PAGE_SIZE
    return filteredRows.slice(start, start + CLIENTS_PAGE_SIZE)
  }, [filteredRows, page])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <>
      <div className="space-y-5">
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 border-b border-[color:rgba(15,23,42,0.12)] lg:grid-cols-4">
              <div className="px-5 py-4 lg:border-r lg:border-[color:rgba(15,23,42,0.12)]">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Total Clients</p>
                <p className="mt-2 text-4xl font-semibold leading-none text-foreground">{kpis.total}</p>
                <p className="mt-1 text-sm text-muted-foreground">All onboarded accounts</p>
              </div>
              <div className="px-5 py-4 lg:border-r lg:border-[color:rgba(15,23,42,0.12)]">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Active Accounts</p>
                <p className="mt-2 text-4xl font-semibold leading-none text-foreground">{kpis.active}</p>
                <p className="mt-1 text-sm text-muted-foreground">Currently enabled</p>
              </div>
              <div className="px-5 py-4 lg:border-r lg:border-[color:rgba(15,23,42,0.12)]">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Operational</p>
                <p className="mt-2 text-4xl font-semibold leading-none text-foreground">{kpis.operational}</p>
                <p className="mt-1 text-sm text-muted-foreground">Data flow healthy</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Needs Attention</p>
                <p className="mt-2 text-4xl font-semibold leading-none text-foreground">{kpis.needsAttention}</p>
                <p className="mt-1 text-sm text-muted-foreground">Follow-up required</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:rgba(15,23,42,0.12)] px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by client, email, company, role, status"
                  className="h-10 w-[440px] max-w-[72vw] rounded-md border border-[color:rgba(15,23,42,0.15)] bg-white px-3 text-sm text-foreground outline-none transition-colors focus:border-[color:rgba(47,125,106,0.7)]"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 min-w-[180px] rounded-md border border-[color:rgba(15,23,42,0.15)] bg-white px-3 text-sm text-foreground outline-none transition-colors focus:border-[color:rgba(47,125,106,0.7)]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-10 w-10"
                onClick={load}
                disabled={loading || !token}
                aria-label="Refresh clients"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {error ? (
              <div className="m-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
                {error}
              </div>
            ) : null}

            <div className="kcx-admin-table-scroll overflow-auto px-5 py-4">
              <table className="min-w-[1280px] w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
                    <th className="px-4 py-3">Serial No.</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Account Status</th>
                    <th className="px-4 py-3">Operational State</th>
                    <th className="px-4 py-3">Cloud Status</th>
                    <th className="px-4 py-3">Last Activity</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
                        Loading clients...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
                        No clients found.
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((row, index) => (
                      <tr
                        key={row.client.id}
                        tabIndex={0}
                        className="cursor-pointer border-b border-[color:rgba(15,23,42,0.12)] transition-colors hover:bg-[color:rgba(15,23,42,0.03)] focus-visible:bg-[color:rgba(15,23,42,0.03)] focus-visible:outline-none"
                        onClick={() => setSelectedClient(row.client)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setSelectedClient(row.client)
                          }
                        }}
                        aria-label={`Open client details for ${row.client.fullName}`}
                      >
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">
                          {(page - 1) * CLIENTS_PAGE_SIZE + index + 1}
                        </td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.88)]">
                          <div className="font-medium">{row.client.fullName}</div>
                          <div className="text-xs text-[color:rgba(15,23,42,0.62)]">{row.client.email}</div>
                        </td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{row.client.tenant.name ?? "-"}</td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{row.client.role}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(row.client.status)}>{row.client.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={operationalStateVariant(row.operational.state)}>{row.operational.state}</Badge>
                        </td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{row.operational.cloudStatus}</td>
                        <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">
                          {formatDateTime(row.operational.lastActivity)}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-9"
                            aria-label={`View details for ${row.client.fullName}`}
                            title="View details"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedClient(row.client)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.stopPropagation()
                              }
                            }}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4">
              <div className="text-sm text-[color:rgba(15,23,42,0.70)]">
                Page {page} of {totalPages} - {filteredRows.length} total
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((previous) => previous - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={loading || page >= totalPages}
                  onClick={() => setPage((previous) => previous + 1)}
                >
                  Next
                </Button>
              </div>
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
