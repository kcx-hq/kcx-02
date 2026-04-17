import { useMemo, useState } from "react"
import { AlertTriangle, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { TenantUploadHistoryRecord } from "@/features/client-home/api/upload-history.api"
import { useUploadHistorySelectionStore } from "@/features/client-home/stores/uploadHistorySelection.store"
import { TablePagination } from "@/features/client-home/components/TablePagination"
import { cn } from "@/lib/utils"

type NormalizedStatus = "idle" | "queued" | "processing" | "completed" | "warning" | "failed"

type BillingUploadHistorySectionProps = {
  records: TenantUploadHistoryRecord[]
  isLoading: boolean
  isError: boolean
  errorMessage: string | null
  dashboardActionError: string | null
  dashboardActionLoading: boolean
  onRetry: () => void
  onViewDetails: (runId: string) => void
  onRetryUpload: (record: TenantUploadHistoryRecord) => void
  onOpenDashboard: (selectedRawBillingFileIds: number[]) => void
  embedded?: boolean
}

const PAGE_SIZE = 10

const FILTER_OPTIONS: Array<{ value: "all" | NormalizedStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "idle", label: "Idle" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "warning", label: "Warning" },
  { value: "failed", label: "Failed" },
]

function normalizeStatus(value: string): NormalizedStatus {
  if (value === "queued") return "queued"
  if (value === "failed") return "failed"
  if (value === "warning" || value === "completed_with_warnings") return "warning"
  if (value === "completed") return "completed"
  if (value === "idle") return "idle"
  return "processing"
}

function formatStatusLabel(status: NormalizedStatus) {
  if (status === "idle") return "Idle"
  if (status === "queued") return "Queued"
  if (status === "processing") return "Processing"
  if (status === "completed") return "Completed"
  if (status === "warning") return "Warning"
  return "Failed"
}

function statusBadgeClass(status: NormalizedStatus) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-700"
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-700"
  if (status === "processing") return "border-sky-200 bg-sky-50 text-sky-700"
  if (status === "queued") return "border-slate-200 bg-slate-50 text-slate-700"
  return "border-zinc-200 bg-zinc-50 text-zinc-700"
}

function formatDateTime(value: string | null) {
  if (!value) return "N/A"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "N/A"
  return date.toLocaleString()
}

function formatRows(record: TenantUploadHistoryRecord) {
  if (record.totalRows > 0 && record.processedRows > 0 && record.failedRows > 0) {
    return `${record.processedRows} success - ${record.failedRows} failed`
  }
  if (record.totalRows > 0 && record.processedRows > 0) {
    return `${record.processedRows} / ${record.totalRows} processed`
  }
  if (record.totalRows > 0) {
    return `${record.totalRows} rows`
  }
  return "N/A"
}

function LoadingState() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="h-12 animate-pulse rounded-lg border border-[color:var(--border-light)] bg-[color:var(--bg-surface)]"
        />
      ))}
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-700" />
        <div className="space-y-3">
          <p className="text-sm font-medium text-rose-700">{message || "Unable to load billing file history."}</p>
          <Button variant="outline" size="sm" className="rounded-md border-rose-200 text-rose-700" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={embedded ? "py-6" : "rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-6"}>
      <p className="text-sm font-semibold text-text-primary">No billing files uploaded yet.</p>
      <p className="mt-1 text-sm text-text-secondary">
        Uploaded files and processing results will appear here.
      </p>
    </div>
  )
}

export function BillingUploadHistorySection({
  records,
  isLoading,
  isError,
  errorMessage,
  dashboardActionError,
  dashboardActionLoading,
  onRetry,
  onViewDetails,
  onRetryUpload,
  onOpenDashboard,
  embedded = false,
}: BillingUploadHistorySectionProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | NormalizedStatus>("all")
  const [page, setPage] = useState(1)
  const selectedFileIds = useUploadHistorySelectionStore((state) => state.selectedFileIds)
  const toggleFile = useUploadHistorySelectionStore((state) => state.toggleFile)
  const toggleSelectAll = useUploadHistorySelectionStore((state) => state.toggleSelectAll)
  const isSelected = useUploadHistorySelectionStore((state) => state.isSelected)

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return records.filter((record) => {
      const status = normalizeStatus(record.status)
      const statusMatches = statusFilter === "all" || status === statusFilter
      const searchMatches =
        normalizedSearch.length === 0 || record.fileName.toLowerCase().includes(normalizedSearch)
      return statusMatches && searchMatches
    })
  }, [records, searchTerm, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredRecords.slice(startIndex, startIndex + PAGE_SIZE)
  }, [currentPage, filteredRecords])

  const visibleRawBillingFileIds = useMemo(() => {
    return paginatedRecords
      .map((record) => Number(record.rawBillingFileId))
      .filter((id) => Number.isInteger(id))
  }, [paginatedRecords])

  const allVisibleSelected =
    visibleRawBillingFileIds.length > 0 &&
    visibleRawBillingFileIds.every((rawBillingFileId) => selectedFileIds.includes(rawBillingFileId))

  return (
    <section
      className={cn(
        "space-y-4",
        embedded ? "" : "rounded-xl border border-[color:var(--border-light)] bg-white p-4 shadow-sm-custom md:p-5"
      )}
      aria-label="Files and processing history"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-text-primary">Files &amp; Processing History</h3>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="relative min-w-[220px] flex-1 sm:w-[260px] sm:flex-none">
            <span className="sr-only">Search files</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setPage(1)
              }}
              placeholder="Search file name"
              className="h-10 w-full rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-8 pr-3 text-sm outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <span className="sr-only">Filter by status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as "all" | NormalizedStatus)
                setPage(1)
              }}
              className="h-10 rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent px-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
              aria-label="Filter by status"
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            className={cn(
              "h-10 rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent",
              selectedFileIds.length > 0 ? "text-text-primary" : "text-text-muted"
            )}
            disabled={selectedFileIds.length === 0 || dashboardActionLoading}
            onClick={() => onOpenDashboard(selectedFileIds)}
          >
            {dashboardActionLoading ? "Opening..." : `Dashboard${selectedFileIds.length > 0 ? ` (${selectedFileIds.length})` : ""}`}
          </Button>
        </div>
      </div>

      <div className={cn(embedded ? "mt-4 overflow-x-auto" : "overflow-hidden rounded-lg border border-[color:var(--border-light)]")}>
        {dashboardActionError ? (
          <div className={cn("text-sm text-rose-700", embedded ? "mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2" : "border-b border-rose-200 bg-rose-50 px-3 py-2")}>
            {dashboardActionError}
          </div>
        ) : null}
        {isLoading ? (
          <div className={cn(embedded ? "" : "p-3")}>
            <LoadingState />
          </div>
        ) : isError ? (
          <div className={cn(embedded ? "" : "p-3")}>
            <ErrorState message={errorMessage} onRetry={onRetry} />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className={cn(embedded ? "" : "p-3")}>
            {records.length === 0 ? (
              <EmptyState embedded={embedded} />
            ) : (
              <div className={cn(
                "text-sm text-text-secondary",
                embedded ? "py-5" : "rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-5"
              )}>
                No files match your current search or filter.
              </div>
            )}
          </div>
        ) : (
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow className="border-b border-[color:var(--border-light)] bg-transparent hover:bg-transparent">
                <TableHead className="w-[52px] py-4">
                  <input
                    type="checkbox"
                    aria-label="Select all visible files"
                    checked={allVisibleSelected}
                    onChange={() => toggleSelectAll(visibleRawBillingFileIds)}
                    className="h-4 w-4 rounded border-[color:var(--border-light)] accent-[color:var(--brand-primary)]"
                  />
                </TableHead>
                <TableHead className="py-4 text-[11px] uppercase tracking-[0.14em]">File Name</TableHead>
                <TableHead className="py-4 text-[11px] uppercase tracking-[0.14em]">Uploaded At</TableHead>
                <TableHead className="py-4 text-[11px] uppercase tracking-[0.14em]">Uploaded By</TableHead>
                <TableHead className="py-4 text-[11px] uppercase tracking-[0.14em]">Processing Status</TableHead>
                <TableHead className="py-4 text-[11px] uppercase tracking-[0.14em]">Rows</TableHead>
                <TableHead className="py-4 text-right text-[11px] uppercase tracking-[0.14em]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRecords.map((record) => {
                const status = normalizeStatus(record.status)
                const canRetry = status === "failed" || status === "warning"
                const rawBillingFileId = Number(record.rawBillingFileId)

                return (
                  <TableRow key={record.id} className="border-b border-[color:var(--border-light)] transition-colors hover:bg-[color:var(--bg-surface)]">
                    <TableCell className="py-4">
                      <input
                        type="checkbox"
                        aria-label={`Select ${record.fileName}`}
                        checked={Number.isInteger(rawBillingFileId) ? isSelected(rawBillingFileId) : false}
                        onChange={() => {
                          if (!Number.isInteger(rawBillingFileId)) return
                          toggleFile(rawBillingFileId)
                        }}
                        className="h-4 w-4 rounded border-[color:var(--border-light)] accent-[color:var(--brand-primary)]"
                      />
                    </TableCell>
                    <TableCell className="py-4 font-medium text-text-primary">{record.fileName}</TableCell>
                    <TableCell className="py-4 text-text-primary">{formatDateTime(record.uploadedAt)}</TableCell>
                    <TableCell className="py-4 text-text-primary">{record.uploadedBy || "-"}</TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className={cn("rounded-md", statusBadgeClass(status))}>
                        {formatStatusLabel(status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-text-primary">{formatRows(record)}</TableCell>
                    <TableCell className="py-4">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="sm" className="h-8 rounded-md text-[15px]" onClick={() => onViewDetails(record.id)}>
                          View details
                        </Button>
                        {canRetry ? (
                          <Button variant="outline" size="sm" className="h-8 rounded-md" onClick={() => onRetryUpload(record)}>
                            Retry
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {!isLoading && !isError && filteredRecords.length > 0 ? (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredRecords.length}
          pageSize={PAGE_SIZE}
          onPrevious={() => setPage((previous) => Math.max(previous - 1, 1))}
          onNext={() => setPage((previous) => Math.min(previous + 1, totalPages))}
        />
      ) : null}
    </section>
  )
}

