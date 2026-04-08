import { useEffect, useMemo, useState } from "react"

import {
  fetchAdminBillingUploadByRunId,
  fetchAdminBillingUploads,
  type BillingUploadDetailsResponse,
  type BillingUploadNormalizedStatus,
  type BillingUploadsListRow,
} from "@/modules/billing-uploads/admin-billing-uploads.api"
import {
  BillingUploadDetailsDrawer,
} from "@/modules/billing-uploads/components/BillingUploadDetailsDrawer"
import {
  BillingUploadsFilters,
  type BillingSourceTypeFilter,
} from "@/modules/billing-uploads/components/BillingUploadsFilters"
import { BillingUploadsSummaryCards } from "@/modules/billing-uploads/components/BillingUploadsSummaryCards"
import { BillingUploadsTable } from "@/modules/billing-uploads/components/BillingUploadsTable"
import { getAdminToken } from "@/modules/auth/admin-session"
import { ApiError } from "@/lib/api"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"

const DEFAULT_LIMIT = 20

export function BillingUploadsPage() {
  const token = useMemo(() => getAdminToken(), [])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<BillingUploadsListRow[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_LIMIT)
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
      page,
      limit,
      search: search || undefined,
      status: status || undefined,
      sourceType: sourceType || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })
      .then((res) => {
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
  }, [token, page, limit, search, status, sourceType, dateFrom, dateTo])

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

  const processingCount = items.filter((item) => item.status.normalized === "processing").length
  const failedCount = items.filter((item) => item.status.normalized === "failed").length
  const completedCount = items.filter((item) => item.status.normalized === "completed").length

  return (
    <>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">Billing Uploads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor billing file intake and ingestion run health across clients.
          </p>
        </div>

        <BillingUploadsSummaryCards
          total={items.length}
          processing={processingCount}
          failed={failedCount}
          completed={completedCount}
        />

        <Card>
          <CardContent className="space-y-4 p-4">
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

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
                <div>{error}</div>
                <Button className="mt-3" size="sm" variant="secondary" onClick={loadList}>
                  Retry
                </Button>
              </div>
            ) : null}

            <BillingUploadsTable loading={loading} items={items} onView={setSelectedRunId} />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[color:rgba(15,23,42,0.70)]">
                Page {page} of {Math.max(totalPages, 1)} - {total} total
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={limit}
                  onChange={(event) => {
                    setLimit(Number(event.target.value))
                    setPage(1)
                  }}
                  className="h-9 rounded-lg border border-[color:rgba(15,23,42,0.12)] bg-white px-2.5 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
                >
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
                <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={loading || totalPages === 0 || page >= totalPages}
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
