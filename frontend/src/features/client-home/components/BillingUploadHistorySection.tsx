import { useMemo, useState } from "react"
import { AlertTriangle, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { TenantUploadHistoryRecord } from "@/features/client-home/api/upload-history.api"
import { cn } from "@/lib/utils"

type NormalizedStatus = "idle" | "queued" | "processing" | "completed" | "warning" | "failed"

type BillingUploadHistorySectionProps = {
  records: TenantUploadHistoryRecord[]
  isLoading: boolean
  isError: boolean
  errorMessage: string | null
  onRetry: () => void
  onViewDetails: (runId: string) => void
  onRetryUpload: (record: TenantUploadHistoryRecord) => void
}

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
    return `${record.processedRows} success · ${record.failedRows} failed`
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
          className="h-12 animate-pulse rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)]"
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

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-6">
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
  onRetry,
  onViewDetails,
  onRetryUpload,
}: BillingUploadHistorySectionProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | NormalizedStatus>("all")

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

  return (
    <section className="space-y-4" aria-label="Files and processing history">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-text-primary">Files &amp; Processing History</h3>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="relative min-w-[220px] flex-1 sm:w-[260px] sm:flex-none">
            <span className="sr-only">Search files</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search file name"
              className="h-9 w-full rounded-md border border-[color:var(--border-light)] bg-white pl-8 pr-3 text-sm outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <span className="sr-only">Filter by status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | NormalizedStatus)}
              className="h-9 rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
              aria-label="Filter by status"
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-md border border-[color:var(--border-light)]">
        {isLoading ? (
          <div className="p-3">
            <LoadingState />
          </div>
        ) : isError ? (
          <div className="p-3">
            <ErrorState message={errorMessage} onRetry={onRetry} />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-3">
            {records.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-5 text-sm text-text-secondary">
                No files match your current search or filter.
              </div>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Uploaded At</TableHead>
                <TableHead>Processing Status</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => {
                const status = normalizeStatus(record.status)
                const canRetry = status === "failed" || status === "warning"

                return (
                  <TableRow key={record.id} className="transition-colors hover:bg-[color:var(--bg-surface)]">
                    <TableCell className="font-medium text-text-primary">{record.fileName}</TableCell>
                    <TableCell>{formatDateTime(record.uploadedAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("rounded-md", statusBadgeClass(status))}>
                        {formatStatusLabel(status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatRows(record)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="sm" className="h-8 rounded-md" onClick={() => onViewDetails(record.id)}>
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
    </section>
  )
}
