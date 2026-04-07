import * as Dialog from "@radix-ui/react-dialog"
import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getAdminToken } from "@/features/auth/admin-session"
import {
  fetchAdminBillingUploadByRunId,
  fetchAdminBillingUploads,
  type BillingUploadDetailsResponse,
  type BillingUploadNormalizedStatus,
  type BillingUploadsListRow,
} from "@/features/billing-uploads/admin-billing-uploads.api"
import { ApiError } from "@/lib/api"

type SourceTypeFilter = "" | "manual_upload" | "s3" | "aws_data_exports_cur2"

const DEFAULT_LIMIT = 20

function formatDateTime(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function formatValue(value: string | number | null | undefined) {
  if (value === null || typeof value === "undefined" || value === "") return "-"
  return String(value)
}

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No"
}

function formatFileSize(bytes: number | null) {
  if (bytes === null || bytes < 0) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function getStatusBadge(status: BillingUploadNormalizedStatus): { variant: "outline" | "subtle" | "warning"; className?: string } {
  if (status === "completed") return { variant: "subtle" }
  if (status === "warning") return { variant: "warning" }
  if (status === "processing") {
    return {
      variant: "outline",
      className: "border-[color:rgba(37,99,235,0.28)] bg-[color:rgba(37,99,235,0.10)] text-[color:rgba(30,64,175,0.95)]",
    }
  }
  if (status === "failed") {
    return {
      variant: "outline",
      className: "border-[color:rgba(220,38,38,0.28)] bg-[color:rgba(220,38,38,0.10)] text-[color:rgba(153,27,27,0.95)]",
    }
  }
  return { variant: "outline" }
}

function MetricCard({ title, value, note }: { title: string; value: number; note: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</div>
        <div className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{note}</div>
      </CardContent>
    </Card>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <div className="text-[color:rgba(15,23,42,0.60)]">{label}</div>
      <div className="break-all text-[color:rgba(15,23,42,0.88)]">{value}</div>
    </div>
  )
}

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
  const [sourceType, setSourceType] = useState<SourceTypeFilter>("")
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

  useEffect(() => {
    if (!selectedRunId || !token) {
      setDetailData(null)
      setDetailError(null)
      setDetailLoading(false)
      return
    }

    setDetailLoading(true)
    setDetailError(null)
    fetchAdminBillingUploadByRunId(token, selectedRunId)
      .then((res) => setDetailData(res))
      .catch((err: unknown) => setDetailError(err instanceof ApiError ? err.message : "Unable to load run details"))
      .finally(() => setDetailLoading(false))
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total" value={items.length} note="Current page" />
          <MetricCard title="Processing" value={processingCount} note="Current page" />
          <MetricCard title="Failed" value={failedCount} note="Current page" />
          <MetricCard title="Completed" value={completedCount} note="Current page" />
        </div>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label className="xl:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Search</div>
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
                  placeholder="Run ID, file name, client, uploader"
                />
              </label>

              <label>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</div>
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as BillingUploadNormalizedStatus | "")
                    setPage(1)
                  }}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
                >
                  <option value="">All</option>
                  <option value="queued">Queued</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="warning">Warning</option>
                  <option value="failed">Failed</option>
                </select>
              </label>

              <label>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Source Type</div>
                <select
                  value={sourceType}
                  onChange={(event) => {
                    setSourceType(event.target.value as SourceTypeFilter)
                    setPage(1)
                  }}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
                >
                  <option value="">All</option>
                  <option value="manual_upload">Local Upload</option>
                  <option value="s3">S3 Upload</option>
                  <option value="aws_data_exports_cur2">Cloud Connected</option>
                </select>
              </label>

              <label>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Date From</div>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value)
                    setPage(1)
                  }}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
                />
              </label>

              <label>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Date To</div>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value)
                    setPage(1)
                  }}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
                />
              </label>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
                <div>{error}</div>
                <Button className="mt-3" size="sm" variant="secondary" onClick={loadList}>
                  Retry
                </Button>
              </div>
            ) : null}

            <div className="overflow-auto rounded-xl ring-1 ring-[color:rgba(15,23,42,0.08)]">
              <table className="min-w-[1150px] w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
                    <th className="px-4 py-3">Run ID</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Started At</th>
                    <th className="px-4 py-3">Finished At</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
                        Loading billing uploads...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
                        No billing uploads found for the current filters.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const badge = getStatusBadge(item.status.normalized)
                      return (
                        <tr key={item.runId} className="border-t border-[color:rgba(15,23,42,0.06)]">
                          <td className="px-4 py-3 font-semibold text-[color:rgba(15,23,42,0.88)]">#{item.runId}</td>
                          <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.client.name}</td>
                          <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.source.label}</td>
                          <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">
                            <div className="max-w-[260px] truncate" title={item.file.name}>
                              {item.file.name}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={badge.variant} className={badge.className}>
                              {item.status.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="w-[120px]">
                              <div className="flex items-center justify-between text-xs text-[color:rgba(15,23,42,0.68)]">
                                <span>{item.progress.percent}%</span>
                              </div>
                              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[color:rgba(15,23,42,0.08)]">
                                <div
                                  className="h-full rounded-full bg-[color:rgba(47,125,106,0.88)]"
                                  style={{ width: `${Math.max(0, Math.min(100, item.progress.percent))}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">{formatDateTime(item.startedAt)}</td>
                          <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">{formatDateTime(item.finishedAt)}</td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant="secondary" onClick={() => setSelectedRunId(item.runId)}>
                              View
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[color:rgba(15,23,42,0.70)]">
                Page {page} of {Math.max(totalPages, 1)} • {total} total
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

      <Dialog.Root open={selectedRunId !== null} onOpenChange={(open) => !open && setSelectedRunId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-[820px] overflow-y-auto bg-white p-5 shadow-[-18px_0_48px_-30px_rgba(15,23,42,0.55)] outline-none sm:p-6">
            <div className="sticky top-0 z-10 mb-4 flex items-start justify-between gap-3 border-b border-[color:rgba(15,23,42,0.08)] bg-white pb-4">
              <div>
                <Dialog.Title className="text-lg font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">
                  Billing Upload Details
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Run #{selectedRunId ?? "-"} operational details
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button size="icon" variant="ghost" aria-label="Close details">
                  <X className="h-5 w-5" />
                </Button>
              </Dialog.Close>
            </div>

            {detailLoading ? (
              <div className="rounded-xl border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(15,23,42,0.02)] px-4 py-3 text-sm text-muted-foreground">
                Loading details...
              </div>
            ) : detailError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
                <div>{detailError}</div>
                {selectedRunId ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setDetailLoading(true)
                      setDetailError(null)
                      fetchAdminBillingUploadByRunId(token ?? "", selectedRunId)
                        .then((res) => setDetailData(res))
                        .catch((err: unknown) =>
                          setDetailError(err instanceof ApiError ? err.message : "Unable to load run details")
                        )
                        .finally(() => setDetailLoading(false))
                    }}
                  >
                    Retry
                  </Button>
                ) : null}
              </div>
            ) : detailData ? (
              <div className="space-y-5 pb-6">
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">A. Run Overview</div>
                    <DetailRow label="Run ID" value={String(detailData.runOverview.runId)} />
                    <DetailRow
                      label="Status"
                      value={`${detailData.runOverview.status.label} (${detailData.runOverview.status.raw})`}
                    />
                    <DetailRow label="Current Step" value={formatValue(detailData.runOverview.currentStep)} />
                    <DetailRow label="Progress %" value={String(detailData.runOverview.progressPercent)} />
                    <DetailRow label="Status Message" value={formatValue(detailData.runOverview.statusMessage)} />
                    <DetailRow label="Started At" value={formatDateTime(detailData.runOverview.startedAt)} />
                    <DetailRow label="Finished At" value={formatDateTime(detailData.runOverview.finishedAt)} />
                    <DetailRow label="Created At" value={formatDateTime(detailData.runOverview.createdAt)} />
                    <DetailRow label="Updated At" value={formatDateTime(detailData.runOverview.updatedAt)} />
                    <DetailRow label="Last Heartbeat" value={formatDateTime(detailData.runOverview.lastHeartbeatAt)} />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">B. Client</div>
                    <DetailRow label="Client Name" value={detailData.client.name} />
                    <DetailRow label="Client ID" value={detailData.client.id} />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">C. Source Context</div>
                    <DetailRow label="Billing Source ID" value={String(detailData.sourceContext.billingSourceId)} />
                    <DetailRow label="Source Name" value={detailData.sourceContext.sourceName} />
                    <DetailRow label="Source Type" value={detailData.sourceContext.sourceType} />
                    <DetailRow label="Setup Mode" value={detailData.sourceContext.setupMode} />
                    <DetailRow label="Temporary" value={formatBoolean(detailData.sourceContext.isTemporary)} />
                    <DetailRow label="Source Status" value={detailData.sourceContext.sourceStatus} />
                    <DetailRow
                      label="Cloud Provider"
                      value={`${detailData.sourceContext.cloudProvider.name} (${detailData.sourceContext.cloudProvider.code})`}
                    />
                    <DetailRow label="Cloud Connection ID" value={formatValue(detailData.sourceContext.cloudConnectionId)} />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">D. File Context</div>
                    <DetailRow label="Raw Billing File ID" value={String(detailData.fileContext.rawBillingFileId)} />
                    <DetailRow label="Original File Name" value={detailData.fileContext.originalFileName} />
                    <DetailRow label="Original File Path" value={formatValue(detailData.fileContext.originalFilePath)} />
                    <DetailRow label="File Format" value={detailData.fileContext.fileFormat} />
                    <DetailRow label="File Size" value={formatFileSize(detailData.fileContext.fileSizeBytes)} />
                    <DetailRow label="Checksum" value={formatValue(detailData.fileContext.checksum)} />
                    <DetailRow label="Uploaded At" value={formatDateTime(detailData.fileContext.uploadedAt)} />
                    <DetailRow
                      label="Uploaded By"
                      value={
                        detailData.fileContext.uploadedBy
                          ? `${detailData.fileContext.uploadedBy.fullName} (${detailData.fileContext.uploadedBy.email})`
                          : "-"
                      }
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">E. Raw Storage Context</div>
                    <DetailRow label="Bucket" value={formatValue(detailData.rawStorageContext.bucket)} />
                    <DetailRow label="Key" value={formatValue(detailData.rawStorageContext.key)} />
                    <DetailRow label="Status" value={formatValue(detailData.rawStorageContext.status)} />
                    <DetailRow
                      label="Persisted to Raw Storage"
                      value={formatBoolean(detailData.rawStorageContext.persistedToRawStorage)}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">F. Processing Metrics</div>
                    <DetailRow label="Rows Read" value={String(detailData.processingMetrics.rowsRead)} />
                    <DetailRow label="Rows Loaded" value={String(detailData.processingMetrics.rowsLoaded)} />
                    <DetailRow label="Rows Failed" value={String(detailData.processingMetrics.rowsFailed)} />
                    <DetailRow
                      label="Total Rows Estimated"
                      value={formatValue(detailData.processingMetrics.totalRowsEstimated)}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">G. Failure Details</div>
                    <DetailRow label="Error Message" value={formatValue(detailData.failureDetails.errorMessage)} />
                    <DetailRow label="Row Error Count" value={String(detailData.failureDetails.rowErrorCount)} />

                    <div className="mt-2 overflow-auto rounded-xl ring-1 ring-[color:rgba(15,23,42,0.08)]">
                      <table className="min-w-[620px] w-full border-separate border-spacing-0 text-sm">
                        <thead className="bg-white">
                          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
                            <th className="px-3 py-2.5">ID</th>
                            <th className="px-3 py-2.5">Row</th>
                            <th className="px-3 py-2.5">Code</th>
                            <th className="px-3 py-2.5">Error</th>
                            <th className="px-3 py-2.5">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailData.failureDetails.sampleRowErrors.length === 0 ? (
                            <tr>
                              <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                                No sample row errors.
                              </td>
                            </tr>
                          ) : (
                            detailData.failureDetails.sampleRowErrors.map((item) => (
                              <tr key={item.id} className="border-t border-[color:rgba(15,23,42,0.06)]">
                                <td className="px-3 py-2.5">{item.id}</td>
                                <td className="px-3 py-2.5">{formatValue(item.rowNumber)}</td>
                                <td className="px-3 py-2.5">{formatValue(item.errorCode)}</td>
                                <td className="px-3 py-2.5">{item.errorMessage}</td>
                                <td className="px-3 py-2.5">{formatDateTime(item.createdAt)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">H. Related Files</div>
                    <div className="overflow-auto rounded-xl ring-1 ring-[color:rgba(15,23,42,0.08)]">
                      <table className="min-w-[620px] w-full border-separate border-spacing-0 text-sm">
                        <thead className="bg-white">
                          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
                            <th className="px-3 py-2.5">Raw Billing File ID</th>
                            <th className="px-3 py-2.5">File Role</th>
                            <th className="px-3 py-2.5">Processing Order</th>
                            <th className="px-3 py-2.5">Original File Name</th>
                            <th className="px-3 py-2.5">File Format</th>
                            <th className="px-3 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailData.relatedFiles.length === 0 ? (
                            <tr>
                              <td className="px-3 py-3 text-muted-foreground" colSpan={6}>
                                No related files.
                              </td>
                            </tr>
                          ) : (
                            detailData.relatedFiles.map((item) => (
                              <tr
                                key={`${item.rawBillingFileId}-${item.processingOrder}`}
                                className="border-t border-[color:rgba(15,23,42,0.06)]"
                              >
                                <td className="px-3 py-2.5">{item.rawBillingFileId}</td>
                                <td className="px-3 py-2.5">{item.fileRole}</td>
                                <td className="px-3 py-2.5">{item.processingOrder}</td>
                                <td className="px-3 py-2.5">{item.originalFileName}</td>
                                <td className="px-3 py-2.5">{item.fileFormat}</td>
                                <td className="px-3 py-2.5">{item.status}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="rounded-xl border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(15,23,42,0.02)] px-4 py-3 text-sm text-muted-foreground">
                Select a run from the table to view details.
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
