import { useDeferredValue, useMemo, useState } from "react"
import { Database, RefreshCw, Search, SlidersHorizontal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type {
  InventoryEc2SnapshotRow,
  InventoryEc2SnapshotSignal,
  InventoryEc2SnapshotsSummary,
} from "@/features/client-home/api/inventory-snapshots.api"
import { TablePagination } from "@/features/client-home/components/TablePagination"
import { useInventoryEc2Snapshots } from "@/features/client-home/hooks/useInventoryEc2Snapshots"
import { ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 25
const STATE_OPTIONS = ["completed", "pending", "error", "recoverable", "recovering"] as const
const ENCRYPTED_FILTER_OPTIONS = [
  { value: "ALL", label: "All Encryption States" },
  { value: "ENCRYPTED", label: "Encrypted" },
  { value: "UNENCRYPTED", label: "Unencrypted" },
] as const

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
})

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
})

const EMPTY_SNAPSHOT_ITEMS: InventoryEc2SnapshotRow[] = []
const EMPTY_SNAPSHOT_SUMMARY: InventoryEc2SnapshotsSummary = {
  snapshotsInView: 0,
  likelyOrphanedCount: 0,
  oldSnapshotsCount: 0,
  totalSnapshotCost: null,
}

function toTitleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function formatDateTime(value: string | null): string {
  if (!value) return "-"
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return "-"
  return dateTimeFormatter.format(new Date(parsed))
}

function formatCell(value: string | number | null | undefined): string {
  if (value === null || typeof value === "undefined") return "-"
  if (typeof value === "number" && !Number.isFinite(value)) return "-"
  const text = String(value).trim()
  return text.length > 0 ? text : "-"
}

function formatAgeDays(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-"
  return `${Math.max(0, Math.trunc(value))}d`
}

function formatCurrency(value: number | null, currencyCode: string | null = "USD"): string {
  if (value === null || !Number.isFinite(value)) return "-"
  if (currencyCode) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 2,
      }).format(value)
    } catch {
      return value.toFixed(2)
    }
  }
  return currencyFormatter.format(value)
}

function formatJson(value: Record<string, unknown> | null): string {
  if (!value || Object.keys(value).length === 0) return "-"
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return "-"
  }
}

function getStateTone(state: string | null): string {
  const normalized = (state ?? "").trim().toLowerCase()
  if (normalized === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (normalized === "pending" || normalized === "recovering" || normalized === "recoverable") {
    return "border-sky-200 bg-sky-50 text-sky-700"
  }
  if (normalized === "error") return "border-rose-200 bg-rose-50 text-rose-700"
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
}

function getSignalTone(signal: InventoryEc2SnapshotSignal): string {
  if (signal === "Orphaned") return "border-rose-200 bg-rose-50 text-rose-700"
  if (signal === "Old") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-emerald-200 bg-emerald-50 text-emerald-700"
}

function getEncryptedTone(encrypted: boolean | null): string {
  if (encrypted === true) return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (encrypted === false) return "border-slate-300 bg-slate-100 text-slate-700"
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
}

function getSourceVolumeLabel(snapshot: InventoryEc2SnapshotRow): string {
  return snapshot.sourceVolumeName ?? snapshot.sourceVolumeId ?? "-"
}

function getSourceInstanceLabel(snapshot: InventoryEc2SnapshotRow): string {
  return snapshot.sourceInstanceName ?? snapshot.sourceInstanceId ?? "-"
}

export function ClientInventorySnapshotsPage() {
  const [searchInput, setSearchInput] = useState("")
  const [stateFilter, setStateFilter] = useState("ALL")
  const [storageTierFilter, setStorageTierFilter] = useState("ALL")
  const [encryptedFilter, setEncryptedFilter] = useState("ALL")
  const [regionFilter, setRegionFilter] = useState("ALL")
  const [page, setPage] = useState(1)
  const [selectedSnapshot, setSelectedSnapshot] = useState<InventoryEc2SnapshotRow | null>(null)

  const deferredSearch = useDeferredValue(searchInput.trim())
  const state = stateFilter === "ALL" ? null : stateFilter
  const storageTier = storageTierFilter === "ALL" ? null : storageTierFilter
  const regionKey = regionFilter === "ALL" ? null : regionFilter
  const encrypted =
    encryptedFilter === "ENCRYPTED"
      ? true
      : encryptedFilter === "UNENCRYPTED"
        ? false
        : null

  const snapshotsQuery = useInventoryEc2Snapshots({
    state,
    storageTier,
    encrypted,
    regionKey,
    cloudConnectionId: null,
    search: deferredSearch.length > 0 ? deferredSearch : null,
    page,
    pageSize: PAGE_SIZE,
  })

  const items = snapshotsQuery.data?.items ?? EMPTY_SNAPSHOT_ITEMS
  const summary = snapshotsQuery.data?.summary ?? EMPTY_SNAPSHOT_SUMMARY
  const rawPagination = snapshotsQuery.data?.pagination
  const totalItems =
    rawPagination?.total && rawPagination.total > 0 ? rawPagination.total : items.length
  const totalPages =
    rawPagination?.totalPages && rawPagination.totalPages > 0
      ? rawPagination.totalPages
      : totalItems > 0
        ? Math.ceil(totalItems / PAGE_SIZE)
        : 1
  const currentPage = rawPagination?.page && rawPagination.page > 0 ? rawPagination.page : page

  const storageTierOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.storageTier)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [items],
  )

  const regionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.regionKey)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [items],
  )

  const snapshotsErrorMessage =
    snapshotsQuery.error instanceof ApiError
      ? snapshotsQuery.error.message
      : snapshotsQuery.error instanceof Error
        ? snapshotsQuery.error.message
        : "Failed to load EC2 inventory snapshots."

  return (
    <section aria-label="Inventory AWS EC2 Snapshots" className="space-y-4">
      <Card className="rounded-[14px] border-[color:var(--border-light)] bg-[#f7fbfb] shadow-sm-custom">
        <div className="grid grid-cols-1 border-b border-[color:var(--border-light)] md:grid-cols-4">
          <div className="min-h-[96px] px-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Snapshots In View</p>
                <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{summary.snapshotsInView}</p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(62,138,118,0.12)] text-[color:#24755d]">
                <Database className="h-4 w-4" />
              </span>
            </div>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Likely Orphaned</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{summary.likelyOrphanedCount}</p>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Old Snapshots</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{summary.oldSnapshotsCount}</p>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Total Snapshot Cost</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">
              {summary.totalSnapshotCost === null ? "-" : formatCurrency(summary.totalSnapshotCost, "USD")}
            </p>
          </div>
        </div>

        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[16rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value)
                  setPage(1)
                }}
                placeholder="Search by snapshot ID or source volume ID"
                className="h-9 w-full rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
              />
            </div>

            <div className="relative min-w-[11rem]">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <select
                value={stateFilter}
                onChange={(event) => {
                  setStateFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-[11rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none"
              >
                <option value="ALL">All States</option>
                {STATE_OPTIONS.map((stateValue) => (
                  <option key={stateValue} value={stateValue}>
                    {toTitleCase(stateValue)}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[11rem]">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <select
                value={storageTierFilter}
                onChange={(event) => {
                  setStorageTierFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-[11rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none"
              >
                <option value="ALL">All Storage Tiers</option>
                {storageTierOptions.map((storageTierValue) => (
                  <option key={storageTierValue} value={storageTierValue}>
                    {toTitleCase(storageTierValue)}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[11rem]">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <select
                value={encryptedFilter}
                onChange={(event) => {
                  setEncryptedFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-[11rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none"
              >
                {ENCRYPTED_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[11rem]">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <select
                value={regionFilter}
                onChange={(event) => {
                  setRegionFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-[11rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none"
              >
                <option value="ALL">All Regions</option>
                {regionOptions.map((regionValue) => (
                  <option key={regionValue} value={regionValue}>
                    {regionValue}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-none border-[color:var(--border-light)] bg-transparent text-text-primary hover:bg-transparent"
              onClick={() => void snapshotsQuery.refetch()}
              disabled={snapshotsQuery.isFetching}
            >
              <RefreshCw className={cn("mr-1.5 h-4 w-4", snapshotsQuery.isFetching ? "animate-spin" : "")} />
              Refresh
            </Button>
          </div>

          {snapshotsQuery.isError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {snapshotsErrorMessage}
            </div>
          ) : null}

          {snapshotsQuery.isLoading ? (
            <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-4 py-6 text-sm text-text-secondary">
              Loading inventory snapshots...
            </div>
          ) : (
            <Table className="min-w-[1040px]">
              <TableHeader>
                <TableRow className="border-b border-[color:var(--border-light)] bg-transparent hover:bg-transparent">
                  <TableHead className="py-4">Snapshot ID</TableHead>
                  <TableHead className="py-4">Source Volume</TableHead>
                  <TableHead className="py-4">Source Instance</TableHead>
                  <TableHead className="py-4">State</TableHead>
                  <TableHead className="py-4">Storage Tier</TableHead>
                  <TableHead className="py-4">Age</TableHead>
                  <TableHead className="py-4">Signal</TableHead>
                  <TableHead className="py-4 text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow className="border-b border-[color:var(--border-light)]">
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-text-secondary">
                      No inventory snapshots found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((snapshot) => (
                    <TableRow
                      key={`${snapshot.snapshotId}:${snapshot.regionKey ?? "no-region"}`}
                      className="cursor-pointer border-b border-[color:var(--border-light)] hover:bg-[rgba(62,138,118,0.06)]"
                      onClick={() => setSelectedSnapshot(snapshot)}
                    >
                      <TableCell className="py-5 font-medium text-text-primary">{snapshot.snapshotId}</TableCell>
                      <TableCell className="py-5">{getSourceVolumeLabel(snapshot)}</TableCell>
                      <TableCell className="py-5">{getSourceInstanceLabel(snapshot)}</TableCell>
                      <TableCell className="py-5">
                        <Badge variant="outline" className={cn("rounded-md", getStateTone(snapshot.state))}>
                          {toTitleCase(snapshot.state ?? "unknown")}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5">{formatCell(snapshot.storageTier)}</TableCell>
                      <TableCell className="py-5">{formatAgeDays(snapshot.ageDays)}</TableCell>
                      <TableCell className="py-5">
                        <Badge variant="outline" className={cn("rounded-md", getSignalTone(snapshot.signal))}>
                          {snapshot.signal}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5 text-right font-medium text-text-primary">
                        {formatCurrency(snapshot.cost, snapshot.currencyCode)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {!snapshotsQuery.isLoading && items.length > 0 ? (
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.max(1, totalPages)}
              totalItems={totalItems}
              pageSize={PAGE_SIZE}
              onPrevious={() => setPage((previous) => Math.max(1, previous - 1))}
              onNext={() => setPage((previous) => Math.min(Math.max(1, totalPages), previous + 1))}
            />
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedSnapshot)} onOpenChange={(open) => (!open ? setSelectedSnapshot(null) : null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto rounded-none">
          <DialogHeader>
            <DialogTitle>Snapshot Details</DialogTitle>
          </DialogHeader>

          {selectedSnapshot ? (
            <div className="space-y-4">
              <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">AWS / EC2 / Snapshots</p>
                <h3 className="mt-2 text-lg font-semibold text-text-primary">{selectedSnapshot.snapshotId}</h3>
                <p className="text-sm text-text-secondary">{getSourceVolumeLabel(selectedSnapshot)}</p>
              </div>

              <div className="rounded-md border border-[color:var(--border-light)] bg-white p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Basic Info</h4>
                <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Snapshot ID</dt>
                    <dd className="mt-1 text-sm text-text-primary">{selectedSnapshot.snapshotId}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">State</dt>
                    <dd className="mt-1">
                      <Badge variant="outline" className={cn("rounded-md", getStateTone(selectedSnapshot.state))}>
                        {toTitleCase(selectedSnapshot.state ?? "unknown")}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Storage Tier</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.storageTier)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Encrypted</dt>
                    <dd className="mt-1">
                      <Badge variant="outline" className={cn("rounded-md", getEncryptedTone(selectedSnapshot.encrypted))}>
                        {selectedSnapshot.encrypted === null ? "Unknown" : selectedSnapshot.encrypted ? "Yes" : "No"}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">KMS Key ID</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.kmsKeyId)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Progress</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.progress)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-md border border-[color:var(--border-light)] bg-white p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Source Relation</h4>
                <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Source Volume Name</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.sourceVolumeName)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Source Volume ID</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.sourceVolumeId)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Source Instance Name</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.sourceInstanceName)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Source Instance ID</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.sourceInstanceId)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Likely Orphaned</dt>
                    <dd className="mt-1">
                      <Badge variant="outline" className={cn("rounded-md", getSignalTone(selectedSnapshot.signal))}>
                        {selectedSnapshot.likelyOrphaned ? "Yes" : "No"}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-md border border-[color:var(--border-light)] bg-white p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Lifecycle Info</h4>
                <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Start Time</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatDateTime(selectedSnapshot.startTime)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Age</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatAgeDays(selectedSnapshot.ageDays)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Signal</dt>
                    <dd className="mt-1">
                      <Badge variant="outline" className={cn("rounded-md", getSignalTone(selectedSnapshot.signal))}>
                        {selectedSnapshot.signal}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Region Key</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.regionKey)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Sub Account Key</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.subAccountKey)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-md border border-[color:var(--border-light)] bg-white p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Cost Info</h4>
                <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Cost</dt>
                    <dd className="mt-1 text-sm text-text-primary">
                      {formatCurrency(selectedSnapshot.cost, selectedSnapshot.currencyCode)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Currency</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.currencyCode)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-md border border-[color:var(--border-light)] bg-white p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Metadata</h4>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Tags</p>
                    <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3 text-xs text-text-primary">
                      {formatJson(selectedSnapshot.tags)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Metadata</p>
                    <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3 text-xs text-text-primary">
                      {formatJson(selectedSnapshot.metadata)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
