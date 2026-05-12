import { useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"

import {
  fetchAdminBillingUploadByRunId,
  fetchAdminBillingUploads,
  type BillingUploadDetailsResponse,
  type BillingUploadNormalizedStatus,
  type BillingUploadsListRow,
} from "@/modules/billing-uploads/admin-billing-uploads.api"
import { BillingUploadDetailsDrawer } from "@/modules/billing-uploads/components/BillingUploadDetailsDrawer"
import {
  BillingUploadsFilters,
  type BillingSourceTypeFilter,
} from "@/modules/billing-uploads/components/BillingUploadsFilters"
import { BillingUploadsTable } from "@/modules/billing-uploads/components/BillingUploadsTable"
import { getAdminToken } from "@/modules/auth/admin-session"
import { ApiError } from "@/lib/api"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"

const DEFAULT_LIMIT = 10
const SERIAL_LOOKUP_REGEX = /^\d+$/

export function BillingUploadsPage() {
  const token = useMemo(() => getAdminToken(), [])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<BillingUploadsListRow[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<BillingUploadNormalizedStatus | "">("")
  const [sourceType, setSourceType] = useState<BillingSourceTypeFilter>("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<BillingUploadDetailsResponse | null>(null)

  const serialLookupValue = useMemo(() => {
    const normalized = search.trim()
    if (!SERIAL_LOOKUP_REGEX.test(normalized)) return null
    const parsed = Number(normalized)
    if (!Number.isSafeInteger(parsed) || parsed <= 0) return null
    return parsed
  }, [search])

  const requestPage = serialLookupValue ? Math.floor((serialLookupValue - 1) / DEFAULT_LIMIT) + 1 : page
  const isSerialLookup = serialLookupValue !== null

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  const loadList = () => {
    if (!token) return
    setLoading(true)
    setError(null)
    fetchAdminBillingUploads(token, {
      page: requestPage,
      limit: DEFAULT_LIMIT,
      search: isSerialLookup ? undefined : search || undefined,
      status: status || undefined,
      sourceType: sourceType || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })
      .then((res) => {
        if (serialLookupValue !== null) {
          const serialIndexOnPage = (serialLookupValue - 1) % DEFAULT_LIMIT
          const exactMatch = res.data[serialIndexOnPage]
          const serialFilteredItems = exactMatch ? [exactMatch] : []
          setItems(serialFilteredItems)
          setTotal(serialFilteredItems.length)
          setTotalPages(serialFilteredItems.length > 0 ? 1 : 0)
          return
        }

        setItems(res.data)
        setTotal(res.pagination.total)
        setTotalPages(res.pagination.totalPages)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Unable to load billing uploads"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, requestPage, search, isSerialLookup, status, sourceType, dateFrom, dateTo])

  const loadDetails = (runId: number) => {
    if (!token) return
    setDetailLoading(true)
    setDetailError(null)
    fetchAdminBillingUploadByRunId(token, runId)
      .then((res) => setDetailData(res))
      .catch((err: unknown) => setDetailError(err instanceof ApiError ? err.message : "Unable to load run details"))
      .finally(() => setDetailLoading(false))
  }

  useEffect(() => {
    if (!selectedRunId || !token) {
      setDetailData(null)
      setDetailError(null)
      setDetailLoading(false)
      return
    }
    loadDetails(selectedRunId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId, token])

  const warningCount = items.filter((item) => item.status.normalized === "warning").length
  const failedCount = items.filter((item) => item.status.normalized === "failed").length
  const completedCount = items.filter((item) => item.status.normalized === "completed").length

  return (
    <>
      <div className="space-y-5">
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 border-b border-[color:rgba(15,23,42,0.12)] lg:grid-cols-4">
              <div className="px-5 py-4 lg:border-r lg:border-[color:rgba(15,23,42,0.12)]">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Total</p>
                <p className="mt-2 text-4xl font-semibold leading-none text-foreground">{items.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">All uploads</p>
              </div>
              <div className="px-5 py-4 lg:border-r lg:border-[color:rgba(15,23,42,0.12)]">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Completed</p>
                <p className="mt-2 text-4xl font-semibold leading-none text-foreground">{completedCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">Successfully processed</p>
              </div>
              <div className="px-5 py-4 lg:border-r lg:border-[color:rgba(15,23,42,0.12)]">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Warning</p>
                <p className="mt-2 text-4xl font-semibold leading-none text-foreground">{warningCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">Needs attention</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Failed</p>
                <p className="mt-2 text-4xl font-semibold leading-none text-foreground">{failedCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">Failed runs</p>
              </div>
            </div>

            <div className="border-b border-[color:rgba(15,23,42,0.12)] px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <BillingUploadsFilters
                    searchInput={searchInput}
                    status={status}
                    sourceType={sourceType}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onSearchInputChange={setSearchInput}
                    onStatusChange={(value) => {
                      setStatus(value)
                      setPage(1)
                    }}
                    onSourceTypeChange={(value) => {
                      setSourceType(value)
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
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-10 w-10"
                  onClick={loadList}
                  disabled={loading}
                  aria-label="Refresh billing uploads"
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
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
              <BillingUploadsTable
                loading={loading}
                items={items}
                currentPage={isSerialLookup ? 1 : requestPage}
                pageSize={DEFAULT_LIMIT}
                serialStartIndex={serialLookupValue !== null ? serialLookupValue - 1 : undefined}
                onView={setSelectedRunId}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4">
              <div className="text-sm text-[color:rgba(15,23,42,0.70)]">
                Page {isSerialLookup ? 1 : requestPage} of {Math.max(totalPages, 1)} - {total} total
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSerialLookup || requestPage <= 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isSerialLookup || loading || totalPages === 0 || requestPage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <BillingUploadDetailsDrawer
        open={selectedRunId !== null}
        selectedRunId={selectedRunId}
        loading={detailLoading}
        error={detailError}
        data={detailData}
        onOpenChange={(open) => {
          if (!open) setSelectedRunId(null)
        }}
        onRetry={() => {
          if (selectedRunId) loadDetails(selectedRunId)
        }}
      />
    </>
  )
}
