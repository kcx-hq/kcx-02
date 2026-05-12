import { useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"

import {
  fetchAdminCloudConnectionByIntegrationId,
  fetchAdminCloudConnections,
  type AdminCloudConnectionDetailData,
  type AdminCloudConnectionListItem,
  type AdminCloudConnectionsListResponse,
  type AdminCloudIntegrationMode,
  type AdminCloudIntegrationStatus,
} from "@/modules/cloud-connections/admin-cloud-connections.api"
import {
  buildListQuery,
  CloudConnectionsFilters,
  type BillingSourceLinkedFilter,
} from "@/modules/cloud-connections/components/CloudConnectionsFilters"
import { CloudConnectionsTable } from "@/modules/cloud-connections/components/CloudConnectionsTable"
import { CloudConnectionDetailsDrawer } from "@/modules/cloud-connections/components/CloudConnectionDetailsDrawer"
import { getAdminToken } from "@/modules/auth/admin-session"
import { ApiError } from "@/lib/api"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"

const DEFAULT_LIMIT = 10

type SortBy =
  | "displayName"
  | "status"
  | "mode"
  | "cloudAccountId"
  | "lastValidatedAt"
  | "connectedAt"
  | "createdAt"
  | "updatedAt"

const DEFAULT_SUMMARY: AdminCloudConnectionsListResponse["summary"] = {
  total: 0,
  draft: 0,
  connecting: 0,
  awaitingValidation: 0,
  active: 0,
  activeWithWarnings: 0,
  failed: 0,
  suspended: 0,
  billingSourceMissing: 0,
}

export function CloudConnectionsPage() {
  const token = useMemo(() => getAdminToken(), [])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<AdminCloudConnectionListItem[]>([])
  const [summary, setSummary] = useState<AdminCloudConnectionsListResponse["summary"]>(DEFAULT_SUMMARY)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [provider, setProvider] = useState("")
  const [mode, setMode] = useState<AdminCloudIntegrationMode | "">("")
  const [status, setStatus] = useState<AdminCloudIntegrationStatus | "">("")
  const [billingSourceLinked, setBillingSourceLinked] = useState<BillingSourceLinkedFilter>("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortBy, setSortBy] = useState<SortBy>("updatedAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<AdminCloudConnectionDetailData | null>(null)

  const providerOptions = useMemo(() => {
    const values = new Map<string, string>()
    for (const item of items) {
      const key = String(item.provider.code || "").trim().toLowerCase()
      const label = key.toUpperCase() || "UNKNOWN"
      if (!values.has(key)) values.set(key, label)
    }
    return Array.from(values.entries()).map(([value, label]) => ({ value, label }))
  }, [items])

  const loadList = () => {
    if (!token) return
    setLoading(true)
    setError(null)

    fetchAdminCloudConnections(
      token,
      buildListQuery({
        page,
        limit: DEFAULT_LIMIT,
        search: "",
        provider,
        mode,
        status,
        billingSourceLinked,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
      }),
    )
      .then((response) => {
        setItems(response.data)
        setSummary(response.summary)
        setTotal(response.meta.total)
        setTotalPages(response.meta.totalPages)
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Unable to load cloud connections"),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, provider, mode, status, billingSourceLinked, dateFrom, dateTo, sortBy, sortOrder])

  const loadDetails = (integrationId: string) => {
    if (!token) return
    setDetailLoading(true)
    setDetailError(null)

    fetchAdminCloudConnectionByIntegrationId(token, integrationId)
      .then((response) => setDetailData(response))
      .catch((err: unknown) =>
        setDetailError(err instanceof ApiError ? err.message : "Unable to load integration details"),
      )
      .finally(() => setDetailLoading(false))
  }

  useEffect(() => {
    if (!selectedIntegrationId || !token) {
      setDetailData(null)
      setDetailError(null)
      setDetailLoading(false)
      return
    }

    loadDetails(selectedIntegrationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIntegrationId, token])

  const handleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder((previous) => (previous === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
    setPage(1)
  }

  return (
    <>
      <div className="space-y-5">
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 border-b border-[color:rgba(15,23,42,0.12)] lg:grid-cols-5">
              <div className="px-5 py-4 lg:border-r lg:border-[color:rgba(15,23,42,0.12)]">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Total</p>
                <p className="mt-2 text-4xl font-semibold leading-none text-foreground">{summary.total}</p>
                <p className="mt-1 text-sm text-muted-foreground">Filtered set</p>
              </div>
              <div className="px-5 py-4 lg:border-r lg:border-[color:rgba(15,23,42,0.12)]">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Active</p>
                <p className="mt-2 text-4xl font-semibold leading-none text-foreground">{summary.active}</p>
                <p className="mt-1 text-sm text-muted-foreground">Healthy integrations</p>
              </div>
              <div className="px-5 py-4 lg:border-r lg:border-[color:rgba(15,23,42,0.12)]">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Failed</p>
                <p className="mt-2 text-4xl font-semibold leading-none text-foreground">{summary.failed}</p>
                <p className="mt-1 text-sm text-muted-foreground">Needs investigation</p>
              </div>
              <div className="px-5 py-4 lg:border-r lg:border-[color:rgba(15,23,42,0.12)]">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Suspended</p>
                <p className="mt-2 text-4xl font-semibold leading-none text-foreground">{summary.suspended}</p>
                <p className="mt-1 text-sm text-muted-foreground">Disconnected state</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Source Missing</p>
                <p className="mt-2 text-4xl font-semibold leading-none text-foreground">{summary.billingSourceMissing}</p>
                <p className="mt-1 text-sm text-muted-foreground">No linked billing source</p>
              </div>
            </div>

            <div className="border-b border-[color:rgba(15,23,42,0.12)] px-5 py-4">
              <div className="overflow-x-auto">
                <div className="flex min-w-max flex-nowrap items-center gap-2.5">
                  <CloudConnectionsFilters
                    provider={provider}
                    mode={mode}
                    status={status}
                    billingSourceLinked={billingSourceLinked}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    providerOptions={providerOptions}
                    onProviderChange={(value) => {
                      setProvider(value)
                      setPage(1)
                    }}
                    onModeChange={(value) => {
                      setMode(value)
                      setPage(1)
                    }}
                    onStatusChange={(value) => {
                      setStatus(value)
                      setPage(1)
                    }}
                    onBillingSourceLinkedChange={(value) => {
                      setBillingSourceLinked(value)
                      setPage(1)
                    }}
                    onDateFromChange={(value) => {
                      setDateFrom(value)
                      setPage(1)
                    }}
                    onDateToChange={(value) => {
                      setDateTo(value)
                      setPage(1)
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-10 w-10 shrink-0"
                    onClick={loadList}
                    disabled={loading}
                    aria-label="Refresh cloud connections"
                    title="Refresh"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </div>

            {error ? (
              <div className="m-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
                <div>{error}</div>
                <Button className="mt-3" size="sm" variant="secondary" onClick={loadList}>
                  Retry
                </Button>
              </div>
            ) : null}

            <div className="px-5 py-4">
              <CloudConnectionsTable
                loading={loading}
                items={items}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                onView={setSelectedIntegrationId}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4">
              <div className="text-sm text-[color:rgba(15,23,42,0.70)]">
                Page {page} of {Math.max(totalPages, 1)} - {total} total
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
                  disabled={loading || totalPages === 0 || page >= totalPages}
                  onClick={() => setPage((previous) => previous + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <CloudConnectionDetailsDrawer
        open={selectedIntegrationId !== null}
        selectedIntegrationId={selectedIntegrationId}
        loading={detailLoading}
        error={detailError}
        data={detailData}
        onOpenChange={(open) => {
          if (!open) setSelectedIntegrationId(null)
        }}
        onRetry={() => {
          if (selectedIntegrationId) loadDetails(selectedIntegrationId)
        }}
      />
    </>
  )
}
