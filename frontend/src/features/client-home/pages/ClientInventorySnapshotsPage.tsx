import { useDeferredValue, useMemo, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { RefreshCw, Search, SlidersHorizontal, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type {
  InventoryEc2SnapshotRow,
  InventoryEc2SnapshotStatus,
} from "@/features/client-home/api/inventory-snapshots.api"
import { TablePagination } from "@/features/client-home/components/TablePagination"
import { useInventoryEc2Snapshots } from "@/features/client-home/hooks/useInventoryEc2Snapshots"
import { ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 25
const VOLUMES_PAGE_PATH = "/dashboard/inventory/aws/ec2/volumes"
const STATE_OPTIONS = ["completed", "pending", "error", "recoverable", "recovering"] as const
const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "All Status" },
  { value: "old", label: "Old" },
  { value: "orphaned", label: "Orphaned" },
  { value: "normal", label: "Normal" },
] as const

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
})

const EMPTY_SNAPSHOT_ITEMS: InventoryEc2SnapshotRow[] = []

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

function getStatusTone(signal: InventoryEc2SnapshotStatus): string {
  if (signal === "orphaned") return "border-rose-200 bg-rose-50 text-rose-700"
  if (signal === "old") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-emerald-200 bg-emerald-50 text-emerald-700"
}

function getOptimizationActionPath(snapshotId: string, status: InventoryEc2SnapshotStatus): string | null {
  if (status === "orphaned") {
    return `/dashboard/ec2/optimization?resourceId=${encodeURIComponent(snapshotId)}&category=storage&issueType=orphaned_snapshot`
  }
  if (status === "old") {
    return `/dashboard/ec2/optimization?resourceId=${encodeURIComponent(snapshotId)}&category=storage&issueType=old_snapshot`
  }
  return null
}

const OPTIMIZATION_SCOPE_QUERY_KEYS = new Set([
  "tenantId",
  "rawBillingFileId",
  "rawBillingFileIds",
  "billingSourceId",
  "billingSourceIds",
  "from",
  "to",
  "billingPeriodStart",
  "billingPeriodEnd",
  "startDate",
  "endDate",
  "providerId",
  "billingAccountKey",
  "subAccountKey",
  "serviceKey",
  "regionKey",
  "region",
  "account",
  "team",
  "product",
  "environment",
  "env",
  "tags",
])

function buildOptimizationSearch(currentSearch: string): string {
  const source = new URLSearchParams(currentSearch)
  const next = new URLSearchParams()
  for (const [key, value] of source.entries()) {
    if (OPTIMIZATION_SCOPE_QUERY_KEYS.has(key)) {
      next.set(key, value)
    }
  }
  return next.toString()
}

function getOptimizationPrefill(snapshotId: string, status: InventoryEc2SnapshotStatus): {
  resourceId: string
  category: "storage"
  issueType: "old_snapshot" | "orphaned_snapshot"
} | null {
  if (status === "old") {
    return { resourceId: snapshotId, category: "storage", issueType: "old_snapshot" }
  }
  if (status === "orphaned") {
    return { resourceId: snapshotId, category: "storage", issueType: "orphaned_snapshot" }
  }
  return null
}

function getSourceVolumeLabel(snapshot: InventoryEc2SnapshotRow): string {
  return snapshot.sourceVolumeId ?? "-"
}

function getStatusLabel(status: InventoryEc2SnapshotStatus): string {
  if (status === "old") return "Old"
  if (status === "orphaned") return "Orphaned"
  if (status === "normal") return "Normal"
  return "-"
}

function getActionLabel(status: InventoryEc2SnapshotStatus): string {
  if (status === "old") return "Delete snapshot after retention review"
  if (status === "orphaned") return "Delete unused snapshot"
  return "-"
}

export function ClientInventorySnapshotsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState("")
  const [stateFilter, setStateFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTER_OPTIONS)[number]["value"]>("ALL")
  const [regionFilter, setRegionFilter] = useState("ALL")
  const [page, setPage] = useState(1)
  const volumeIdFromUrl = searchParams.get("volumeId")?.trim() ?? ""
  const volumeId = volumeIdFromUrl.length > 0 ? volumeIdFromUrl : null

  const deferredSearch = useDeferredValue(searchInput.trim())
  const state = stateFilter === "ALL" ? null : stateFilter
  const status = statusFilter === "ALL" ? null : statusFilter
  const regionKey = regionFilter === "ALL" ? null : regionFilter

  const snapshotsQuery = useInventoryEc2Snapshots({
    state,
    status,
    storageTier: null,
    encrypted: null,
    regionKey,
    volumeId,
    cloudConnectionId: null,
    search: deferredSearch.length > 0 ? deferredSearch : null,
    page,
    pageSize: PAGE_SIZE,
  })

  const items = snapshotsQuery.data?.rows ?? EMPTY_SNAPSHOT_ITEMS
  const rows = useMemo(() => {
    if (!volumeId) return items
    return items.filter((item) => item.sourceVolumeId === volumeId)
  }, [items, volumeId])
  const hasRegionColumn = useMemo(() => rows.some((snapshot) => Boolean(snapshot.region)), [rows])
  const rawPagination = snapshotsQuery.data?.pagination
  const totalItems =
    !volumeId && rawPagination?.total && rawPagination.total > 0
      ? rawPagination.total
      : rows.length
  const totalPages =
    !volumeId && rawPagination?.totalPages && rawPagination.totalPages > 0
      ? rawPagination.totalPages
      : totalItems > 0
        ? Math.ceil(totalItems / PAGE_SIZE)
        : 1
  const currentPage = rawPagination?.page && rawPagination.page > 0 ? rawPagination.page : page

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

  const resetFilters = () => {
    setSearchInput("")
    setStateFilter("ALL")
    setStatusFilter("ALL")
    setRegionFilter("ALL")
    setPage(1)
    if (volumeId) {
      const next = new URLSearchParams(searchParams)
      next.delete("volumeId")
      setSearchParams(next, { replace: true })
    }
  }

  return (
    <section aria-label="Inventory AWS EC2 Snapshots" className="space-y-4">
      <Card className="rounded-[14px] border-[color:var(--border-light)] bg-[#f7fbfb] shadow-sm-custom">
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
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as (typeof STATUS_FILTER_OPTIONS)[number]["value"])
                  setPage(1)
                }}
                className="h-9 min-w-[11rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
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

            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-none border-[color:var(--border-light)] bg-transparent text-text-primary hover:bg-transparent"
              onClick={resetFilters}
            >
              Reset
            </Button>
          </div>

          {volumeId ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-md border-sky-200 bg-sky-50 text-sky-700">
                <span>{`Volume: ${volumeId}`}</span>
                <button
                  type="button"
                  className="ml-1 inline-flex items-center rounded-sm p-0.5 hover:bg-sky-100"
                  aria-label="Clear volume filter"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams)
                    next.delete("volumeId")
                    setSearchParams(next, { replace: true })
                    setPage(1)
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            </div>
          ) : null}

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
                  <TableHead className="py-4">Volume Status</TableHead>
                  {hasRegionColumn ? <TableHead className="py-4">Region</TableHead> : null}
                  <TableHead className="py-4">State</TableHead>
                  <TableHead className="py-4">Age</TableHead>
                  <TableHead className="py-4">Status</TableHead>
                  <TableHead className="py-4 text-right">Cost</TableHead>
                  <TableHead className="py-4 text-right">Estimated Savings</TableHead>
                  <TableHead className="py-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow className="border-b border-[color:var(--border-light)]">
                    <TableCell colSpan={hasRegionColumn ? 10 : 9} className="py-12 text-center text-sm text-text-secondary">
                      No inventory snapshots found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((snapshot) => {
                    const status = snapshot.status
                    const actionPath = getOptimizationActionPath(snapshot.snapshotId, status)
                    const prefill = getOptimizationPrefill(snapshot.snapshotId, status)
                    return (
                    <TableRow
                      key={`${snapshot.snapshotId}:${snapshot.region ?? "no-region"}:${snapshot.accountId ?? "no-account"}`}
                      className="border-b border-[color:var(--border-light)] hover:bg-[rgba(62,138,118,0.06)]"
                    >
                      <TableCell className="py-5 font-medium text-text-primary">{snapshot.snapshotId}</TableCell>
                      <TableCell className="py-5">
                        {snapshot.sourceVolumeId ? (
                          <button
                            type="button"
                            className="ec2-linked-cell-btn"
                            onClick={() => {
                              const next = new URLSearchParams(location.search)
                              next.set("volumeId", snapshot.sourceVolumeId ?? "")
                              navigate({ pathname: VOLUMES_PAGE_PATH, search: next.toString() })
                            }}
                          >
                            {getSourceVolumeLabel(snapshot)}
                          </button>
                        ) : (
                          getSourceVolumeLabel(snapshot)
                        )}
                      </TableCell>
                      <TableCell className="py-5">{formatCell(snapshot.volumeStatus ? toTitleCase(snapshot.volumeStatus) : null)}</TableCell>
                      {hasRegionColumn ? <TableCell className="py-5">{formatCell(snapshot.region)}</TableCell> : null}
                      <TableCell className="py-5">
                        <Badge variant="outline" className={cn("rounded-md", getStateTone(snapshot.state))}>
                          {toTitleCase(snapshot.state ?? "unknown")}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5">{formatAgeDays(snapshot.ageDays)}</TableCell>
                      <TableCell className="py-5">
                        <Badge variant="outline" className={cn("rounded-md", getStatusTone(status))}>
                          {getStatusLabel(status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5 text-right font-medium text-text-primary">
                        {formatCurrency(snapshot.cost, "USD")}
                      </TableCell>
                      <TableCell className="py-5 text-right font-medium text-text-primary">
                        {formatCurrency(snapshot.estimatedSavings, "USD")}
                      </TableCell>
                      <TableCell className="py-5">
                        {actionPath ? (
                          <button
                            type="button"
                            className="text-left text-xs font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
                            onClick={() =>
                              navigate({
                                pathname: "/dashboard/ec2/optimization",
                                search: buildOptimizationSearch(location.search),
                              }, {
                                state: prefill ? { snapshotOptimizationPrefill: prefill } : undefined,
                              })
                            }
                          >
                            {getActionLabel(status)}
                          </button>
                        ) : (
                          "-"
                        )}
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
    </section>
  )
}
