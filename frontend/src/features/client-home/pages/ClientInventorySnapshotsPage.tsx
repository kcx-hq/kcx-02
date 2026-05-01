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

const EMPTY_SNAPSHOT_ITEMS: InventoryEc2SnapshotRow[] = []
type SnapshotDateRangeFilter = "ALL" | "LAST_30_DAYS" | "LAST_90_DAYS" | "LAST_180_DAYS"

const DATE_RANGE_FILTER_OPTIONS: { value: SnapshotDateRangeFilter; label: string }[] = [
  { value: "ALL", label: "All Dates" },
  { value: "LAST_30_DAYS", label: "Last 30 Days" },
  { value: "LAST_90_DAYS", label: "Last 90 Days" },
  { value: "LAST_180_DAYS", label: "Last 180 Days" },
]

function toTitleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
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
  if (signal === "orphaned") return "border-rose-200 bg-rose-50 text-rose-700"
  if (signal === "old") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-emerald-200 bg-emerald-50 text-emerald-700"
}

function getSourceVolumeLabel(snapshot: InventoryEc2SnapshotRow): string {
  return snapshot.sourceVolumeId ?? "-"
}

function getSourceInstanceLabel(snapshot: InventoryEc2SnapshotRow): string {
  return snapshot.sourceInstanceId ?? "-"
}

function getDateRangeDays(value: SnapshotDateRangeFilter): number | null {
  if (value === "LAST_30_DAYS") return 30
  if (value === "LAST_90_DAYS") return 90
  if (value === "LAST_180_DAYS") return 180
  return null
}

export function ClientInventorySnapshotsPage() {
  const [searchInput, setSearchInput] = useState("")
  const [dateRangeFilter, setDateRangeFilter] = useState<SnapshotDateRangeFilter>("ALL")
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

  const items = snapshotsQuery.data?.rows ?? EMPTY_SNAPSHOT_ITEMS
  const dateRangeDays = getDateRangeDays(dateRangeFilter)
  const filteredItems = useMemo(() => {
    if (dateRangeDays === null) return items
    return items.filter((item) => {
      const ageDays = item.ageDays
      return typeof ageDays === "number" && Number.isFinite(ageDays) && ageDays <= dateRangeDays
    })
  }, [items, dateRangeDays])
  const rows = useMemo(
    () =>
      [...filteredItems].sort((a, b) => {
        const leftAge = typeof a.ageDays === "number" && Number.isFinite(a.ageDays) ? a.ageDays : -1
        const rightAge = typeof b.ageDays === "number" && Number.isFinite(b.ageDays) ? b.ageDays : -1
        if (rightAge !== leftAge) return rightAge - leftAge
        const leftCost = typeof a.cost === "number" && Number.isFinite(a.cost) ? a.cost : -1
        const rightCost = typeof b.cost === "number" && Number.isFinite(b.cost) ? b.cost : -1
        return rightCost - leftCost
      }),
    [filteredItems],
  )
  const summary = snapshotsQuery.data?.summary
  const hasAccountColumn = useMemo(
    () => rows.some((snapshot) => Boolean(snapshot.accountId)),
    [rows],
  )
  const hasRegionColumn = useMemo(() => rows.some((snapshot) => Boolean(snapshot.region)), [rows])
  const rawPagination = snapshotsQuery.data?.pagination
  const isDateRangeFiltered = dateRangeFilter !== "ALL"
  const totalItems =
    !isDateRangeFiltered && rawPagination?.total && rawPagination.total > 0
      ? rawPagination.total
      : rows.length
  const totalPages =
    !isDateRangeFiltered && rawPagination?.totalPages && rawPagination.totalPages > 0
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
            .map((item) => item.region)
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
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Total Snapshot Cost</p>
                <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">
                  {summary ? formatCurrency(summary.totalSnapshotCost, "USD") : "-"}
                </p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(62,138,118,0.12)] text-[color:#24755d]">
                <Database className="h-4 w-4" />
              </span>
            </div>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Total Snapshots</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{summary?.totalSnapshots ?? "-"}</p>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Old Snapshots</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{summary?.oldSnapshots ?? "-"}</p>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Potential Savings</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">
              {summary ? formatCurrency(summary.potentialSavings, "USD") : "-"}
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
                value={dateRangeFilter}
                onChange={(event) => {
                  setDateRangeFilter(event.target.value as SnapshotDateRangeFilter)
                  setPage(1)
                }}
                className="h-9 min-w-[11rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none"
              >
                {DATE_RANGE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
                  {hasAccountColumn ? <TableHead className="py-4">Account</TableHead> : null}
                  {hasRegionColumn ? <TableHead className="py-4">Region</TableHead> : null}
                  <TableHead className="py-4">State</TableHead>
                  <TableHead className="py-4">Storage Tier</TableHead>
                  <TableHead className="py-4">Age</TableHead>
                  <TableHead className="py-4">Signal</TableHead>
                  <TableHead className="py-4 text-right">Cost</TableHead>
                  <TableHead className="py-4">Recommendation</TableHead>
                  <TableHead className="py-4 text-right">Estimated Savings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow className="border-b border-[color:var(--border-light)]">
                    <TableCell colSpan={hasAccountColumn || hasRegionColumn ? 12 : 10} className="py-12 text-center text-sm text-text-secondary">
                      No inventory snapshots found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((snapshot) => {
                    return (
                    <TableRow
                      key={`${snapshot.snapshotId}:${snapshot.region ?? "no-region"}:${snapshot.accountId ?? "no-account"}`}
                      className="cursor-pointer border-b border-[color:var(--border-light)] hover:bg-[rgba(62,138,118,0.06)]"
                      onClick={() => setSelectedSnapshot(snapshot)}
                    >
                      <TableCell className="py-5 font-medium text-text-primary">{snapshot.snapshotId}</TableCell>
                      <TableCell className="py-5">{getSourceVolumeLabel(snapshot)}</TableCell>
                      <TableCell className="py-5">{getSourceInstanceLabel(snapshot)}</TableCell>
                      {hasAccountColumn ? <TableCell className="py-5">{formatCell(snapshot.accountName ?? snapshot.accountId)}</TableCell> : null}
                      {hasRegionColumn ? <TableCell className="py-5">{formatCell(snapshot.region)}</TableCell> : null}
                      <TableCell className="py-5">
                        <Badge variant="outline" className={cn("rounded-md", getStateTone(snapshot.state))}>
                          {toTitleCase(snapshot.state ?? "unknown")}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5">{formatCell(snapshot.storageTier)}</TableCell>
                      <TableCell className="py-5">{formatAgeDays(snapshot.ageDays)}</TableCell>
                      <TableCell className="py-5">
                        <Badge variant="outline" className={cn("rounded-md", getSignalTone(snapshot.signal))}>
                          {snapshot.signal ? toTitleCase(snapshot.signal) : "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5 text-right font-medium text-text-primary">
                        {formatCurrency(snapshot.cost, "USD")}
                      </TableCell>
                      <TableCell className="py-5">{snapshot.recommendation ?? "-"}</TableCell>
                      <TableCell className="py-5 text-right font-medium text-text-primary">
                        {formatCurrency(snapshot.estimatedSavings, "USD")}
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}

          {!snapshotsQuery.isLoading && rows.length > 0 ? (
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
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Age</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatAgeDays(selectedSnapshot.ageDays)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-md border border-[color:var(--border-light)] bg-white p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Source Relation</h4>
                <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Source Volume ID</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.sourceVolumeId)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Source Instance ID</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.sourceInstanceId)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Account</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.accountName ?? selectedSnapshot.accountId)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Region</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.region)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-md border border-[color:var(--border-light)] bg-white p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">FinOps Info</h4>
                <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Signal</dt>
                    <dd className="mt-1">
                      <Badge variant="outline" className={cn("rounded-md", getSignalTone(selectedSnapshot.signal))}>
                        {selectedSnapshot.signal ? toTitleCase(selectedSnapshot.signal) : "-"}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Cost</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCurrency(selectedSnapshot.cost, "USD")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Recommendation</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedSnapshot.recommendation)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Estimated Savings</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCurrency(selectedSnapshot.estimatedSavings, "USD")}</dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
