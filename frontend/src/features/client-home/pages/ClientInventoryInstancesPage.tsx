import { useDeferredValue, useMemo, useState } from "react"
import { useEffect } from "react"
import { ArrowUpDown, RefreshCw, Search, Server, SlidersHorizontal } from "lucide-react"
import { useLocation } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { InventoryEc2InstanceRow } from "@/features/client-home/api/inventory-instances.api"
import { TablePagination } from "@/features/client-home/components/TablePagination"
import { useInventoryEc2Instances } from "@/features/client-home/hooks/useInventoryEc2Instances"
import { useTenantCloudIntegrations } from "@/features/client-home/hooks/useTenantCloudIntegrations"
import { ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 25
const QUICK_FILTERS = ["all", "running", "stopped", "idle", "underutilized", "overutilized", "spot"] as const
const SORTABLE_COLUMNS = ["state", "instanceType", "cpuAvg", "cpuMax", "totalHours", "computeCost"] as const

type QuickFilter = (typeof QUICK_FILTERS)[number]
type SortKey = (typeof SORTABLE_COLUMNS)[number]
type SortDirection = "asc" | "desc"

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
})

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
})

function toTitleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function getDefaultDateRange(): { start: string; end: string } {
  const today = new Date()
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  return {
    start: toIsoDate(startOfMonth),
    end: toIsoDate(today),
  }
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-"
  return `${value.toFixed(2)}%`
}

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-"
  return currencyFormatter.format(value)
}

function formatHours(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-"
  return `${value.toFixed(2)}h`
}

function formatDateTime(value: string | null): string {
  if (!value) return "-"
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return "-"
  return dateTimeFormatter.format(new Date(parsed))
}

function formatCell(value: string | null | number | undefined): string {
  if (value === null || typeof value === "undefined") return "-"
  if (typeof value === "number" && !Number.isFinite(value)) return "-"
  const text = String(value).trim()
  return text.length > 0 ? text : "-"
}

function getPricingTypeLabel(value: InventoryEc2InstanceRow["pricingType"]): string {
  if (!value) return "Unknown"
  if (value === "on_demand") return "On-Demand"
  if (value === "savings_plan") return "Savings Plan"
  return toTitleCase(value)
}

function getPricingTypeTone(pricingType: InventoryEc2InstanceRow["pricingType"]): string {
  if (pricingType === "spot") return "border-violet-200 bg-violet-50 text-violet-700"
  if (pricingType === "reserved") return "border-indigo-200 bg-indigo-50 text-indigo-700"
  if (pricingType === "savings_plan") return "border-sky-200 bg-sky-50 text-sky-700"
  if (pricingType === "on_demand") return "border-slate-300 bg-slate-100 text-slate-700"
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
}

function getStateTone(state: string | null): string {
  const normalized = (state ?? "").trim().toLowerCase()
  if (normalized === "running") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (normalized === "stopped" || normalized === "stopping") return "border-slate-300 bg-slate-100 text-slate-700"
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
}

function getUtilizationStatus(instance: InventoryEc2InstanceRow): "Idle" | "Underutilized" | "Optimal" | "Overutilized" {
  if (instance.isIdleCandidate) return "Idle"
  if (instance.isOverutilizedCandidate) return "Overutilized"
  if (instance.isUnderutilizedCandidate) return "Underutilized"
  if (instance.cpuAvg !== null) {
    if (instance.cpuAvg < 5) return "Idle"
    if (instance.cpuAvg > 75) return "Overutilized"
    if (instance.cpuAvg < 25) return "Underutilized"
  }
  return "Optimal"
}

function getUtilizationTone(status: ReturnType<typeof getUtilizationStatus>): string {
  if (status === "Idle") return "border-amber-200 bg-amber-50 text-amber-700"
  if (status === "Underutilized") return "border-sky-200 bg-sky-50 text-sky-700"
  if (status === "Overutilized") return "border-rose-200 bg-rose-50 text-rose-700"
  return "border-emerald-200 bg-emerald-50 text-emerald-700"
}

function getSignalTone(instance: InventoryEc2InstanceRow): { label: string; className: string } {
  if (instance.isOverutilizedCandidate) {
    return { label: "Attention", className: "border-rose-200 bg-rose-50 text-rose-700" }
  }
  if (instance.isIdleCandidate || instance.isUnderutilizedCandidate) {
    return { label: "Watch", className: "border-amber-200 bg-amber-50 text-amber-700" }
  }
  return { label: "Healthy", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
}

function matchesQuickFilter(instance: InventoryEc2InstanceRow, quickFilter: QuickFilter): boolean {
  const normalizedState = (instance.state ?? "").toLowerCase()
  const utilization = getUtilizationStatus(instance)

  if (quickFilter === "all") return true
  if (quickFilter === "running") return normalizedState === "running"
  if (quickFilter === "stopped") return normalizedState === "stopped"
  if (quickFilter === "idle") return utilization === "Idle"
  if (quickFilter === "underutilized") return utilization === "Underutilized"
  if (quickFilter === "overutilized") return utilization === "Overutilized"
  return instance.pricingType === "spot"
}

function compareValue(a: number | string | null, b: number | string | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b))
}

function compareRows(a: InventoryEc2InstanceRow, b: InventoryEc2InstanceRow, sortKey: SortKey): number {
  if (sortKey === "state") return compareValue((a.state ?? "").toLowerCase(), (b.state ?? "").toLowerCase())
  if (sortKey === "instanceType") return compareValue(a.instanceType?.toLowerCase() ?? null, b.instanceType?.toLowerCase() ?? null)
  if (sortKey === "cpuAvg") return compareValue(a.cpuAvg, b.cpuAvg)
  if (sortKey === "cpuMax") return compareValue(a.cpuMax, b.cpuMax)
  if (sortKey === "totalHours") return compareValue(a.totalHours, b.totalHours)
  return compareValue(a.computeCost, b.computeCost)
}

export function ClientInventoryInstancesPage() {
  const location = useLocation()
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const defaults = getDefaultDateRange()

  const querySearch = queryParams.get("search") ?? queryParams.get("instanceId") ?? ""
  const queryState = queryParams.get("state") ?? "ALL"
  const queryInstanceType = queryParams.get("instanceType") ?? "ALL"
  const queryConnection = queryParams.get("cloudConnectionId") ?? "ALL"
  const queryAccount = queryParams.get("subAccountKey") ?? "ALL"
  const queryRegion = queryParams.get("region") ?? "ALL"
  const queryStartDate = queryParams.get("startDate") ?? defaults.start
  const queryEndDate = queryParams.get("endDate") ?? defaults.end

  const [searchInput, setSearchInput] = useState(querySearch)
  const [stateFilter, setStateFilter] = useState(queryState)
  const [instanceTypeFilter, setInstanceTypeFilter] = useState(queryInstanceType)
  const [connectionFilter, setConnectionFilter] = useState(queryConnection)
  const [accountFilter, setAccountFilter] = useState(queryAccount)
  const [regionFilter, setRegionFilter] = useState(queryRegion)
  const [startDate, setStartDate] = useState(queryStartDate)
  const [endDate, setEndDate] = useState(queryEndDate)
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all")
  const [page, setPage] = useState(1)
  const [selectedInstance, setSelectedInstance] = useState<InventoryEc2InstanceRow | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("computeCost")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  useEffect(() => {
    setSearchInput(querySearch)
    setStateFilter(queryState)
    setInstanceTypeFilter(queryInstanceType)
    setConnectionFilter(queryConnection)
    setAccountFilter(queryAccount)
    setRegionFilter(queryRegion)
    setStartDate(queryStartDate)
    setEndDate(queryEndDate)
    setQuickFilter("all")
    setPage(1)
  }, [queryAccount, queryConnection, queryEndDate, queryInstanceType, queryRegion, querySearch, queryStartDate, queryState])

  const deferredSearch = useDeferredValue(searchInput.trim())
  const cloudConnectionId = connectionFilter === "ALL" ? null : connectionFilter
  const subAccountKey = accountFilter === "ALL" ? null : accountFilter
  const state = stateFilter === "ALL" ? null : stateFilter
  const region = regionFilter === "ALL" ? null : regionFilter
  const instanceType = instanceTypeFilter === "ALL" ? null : instanceTypeFilter

  const instancesQuery = useInventoryEc2Instances({
    cloudConnectionId,
    subAccountKey,
    state,
    region,
    instanceType,
    search: deferredSearch.length > 0 ? deferredSearch : null,
    startDate,
    endDate,
    page,
    pageSize: PAGE_SIZE,
  })

  const connectionsQuery = useTenantCloudIntegrations(true)

  const items = instancesQuery.data?.items ?? []
  const visibleItems = useMemo(() => items.filter((item) => matchesQuickFilter(item, quickFilter)), [items, quickFilter])
  const sortedItems = useMemo(
    () =>
      [...visibleItems].sort((a, b) => {
        const result = compareRows(a, b, sortKey)
        return sortDirection === "asc" ? result : -result
      }),
    [visibleItems, sortDirection, sortKey],
  )

  const rawPagination = instancesQuery.data?.pagination
  const totalItems =
    quickFilter === "all"
      ? rawPagination?.total && rawPagination.total > 0
        ? rawPagination.total
        : visibleItems.length
      : visibleItems.length
  const totalPages =
    quickFilter === "all" && rawPagination?.totalPages && rawPagination.totalPages > 0
      ? rawPagination.totalPages
      : totalItems > 0
        ? Math.ceil(totalItems / PAGE_SIZE)
        : 1
  const currentPage = rawPagination?.page && rawPagination.page > 0 ? rawPagination.page : page

  const connectionOptions = useMemo(() => {
    const integrations = connectionsQuery.data ?? []
    return integrations
      .filter((integration) => (integration.provider?.code ?? "").trim().toLowerCase() === "aws")
      .map((integration) => ({
        id: integration.detail_record_id || integration.id,
        label: integration.display_name || integration.cloud_account_id || integration.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [connectionsQuery.data])

  const instanceTypeOptions = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.instanceType).filter((value): value is string => Boolean(value)))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  )

  const regionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.regionName ?? item.regionId ?? item.availabilityZone)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [items],
  )

  const accountOptions = useMemo(
    () =>
      Array.from(
        new Map(
          items
            .filter((item) => item.subAccountKey && item.subAccountName)
            .map((item) => [item.subAccountKey as string, item.subAccountName as string]),
        ).entries(),
      )
        .map(([key, name]) => ({ key, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  )

  const largeSummary = useMemo(() => {
    let idleCount = 0
    let underutilizedCount = 0
    let overutilizedCount = 0

    for (const item of visibleItems) {
      const utilization = getUtilizationStatus(item)
      if (utilization === "Idle") idleCount += 1
      if (utilization === "Underutilized") underutilizedCount += 1
      if (utilization === "Overutilized") overutilizedCount += 1
    }

    return {
      pageCount: visibleItems.length,
      idleCount,
      underutilizedCount,
      overutilizedCount,
    }
  }, [visibleItems])

  const compactSummary = useMemo(() => {
    let running = 0
    let stopped = 0
    let totalHours = 0
    let totalComputeCost = 0

    for (const item of visibleItems) {
      const normalizedState = (item.state ?? "").toLowerCase()
      if (normalizedState === "running") running += 1
      if (normalizedState === "stopped") stopped += 1
      totalHours += item.totalHours
      totalComputeCost += item.computeCost
    }

    return {
      instances: visibleItems.length,
      running,
      stopped,
      totalHours,
      totalComputeCost,
    }
  }, [visibleItems])

  const quickFilterCounts = useMemo(
    () =>
      QUICK_FILTERS.reduce<Record<QuickFilter, number>>((accumulator, filter) => {
        accumulator[filter] = items.filter((item) => matchesQuickFilter(item, filter)).length
        return accumulator
      }, { all: 0, running: 0, stopped: 0, idle: 0, underutilized: 0, overutilized: 0, spot: 0 }),
    [items],
  )

  const instancesErrorMessage =
    instancesQuery.error instanceof ApiError
      ? instancesQuery.error.message
      : instancesQuery.error instanceof Error
        ? instancesQuery.error.message
        : "Failed to load EC2 inventory instances."

  const connectionErrorMessage =
    connectionsQuery.error instanceof ApiError
      ? connectionsQuery.error.message
      : connectionsQuery.error instanceof Error
        ? connectionsQuery.error.message
        : "Failed to load cloud connections."

  const onSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(nextKey)
    setSortDirection("desc")
  }

  const renderSortHead = (label: string, key: SortKey) => (
    <TableHead className="py-4">
      <Button
        type="button"
        variant="ghost"
        className="h-auto p-0 text-left text-xs font-semibold uppercase tracking-[0.08em] text-text-muted hover:bg-transparent hover:text-text-primary"
        onClick={() => onSort(key)}
      >
        {label}
        <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </TableHead>
  )

  return (
    <section aria-label="Inventory AWS EC2 Instances" className="space-y-4">
      <Card className="rounded-[14px] border-[color:var(--border-light)] bg-[#f7fbfb] shadow-sm-custom">
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[10rem]">
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value)
                  setPage(1)
                }}
                className="h-9 w-full rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent px-1 text-sm text-text-primary outline-none"
                aria-label="Start date"
              />
            </div>

            <div className="min-w-[10rem]">
              <input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value)
                  setPage(1)
                }}
                className="h-9 w-full rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent px-1 text-sm text-text-primary outline-none"
                aria-label="End date"
              />
            </div>

            <div className="relative min-w-[11rem]">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <select
                value={connectionFilter}
                onChange={(event) => {
                  setConnectionFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-[11rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none"
              >
                <option value="ALL">All AWS Connections</option>
                {connectionOptions.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[11rem]">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <select
                value={accountFilter}
                onChange={(event) => {
                  setAccountFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-[11rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none"
              >
                <option value="ALL">All Accounts</option>
                {accountOptions.map((account) => (
                  <option key={account.key} value={account.key}>
                    {account.name}
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

            <div className="relative min-w-[11rem]">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <select
                value={instanceTypeFilter}
                onChange={(event) => {
                  setInstanceTypeFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-[11rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none"
              >
                <option value="ALL">All Instance Types</option>
                {instanceTypeOptions.map((instanceTypeValue) => (
                  <option key={instanceTypeValue} value={instanceTypeValue}>
                    {instanceTypeValue}
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
                <option value="running">Running</option>
                <option value="stopped">Stopped</option>
              </select>
            </div>

            <div className="relative min-w-[16rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value)
                  setPage(1)
                }}
                placeholder="Search by instance name or instance ID"
                className="h-9 w-full rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-none border-[color:var(--border-light)] bg-transparent text-text-primary hover:bg-transparent"
              onClick={() => void instancesQuery.refetch()}
              disabled={instancesQuery.isFetching}
            >
              <RefreshCw className={cn("mr-1.5 h-4 w-4", instancesQuery.isFetching ? "animate-spin" : "")} />
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 border-y border-[color:var(--border-light)] py-3 md:grid-cols-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Instances</p>
              <p className="mt-1 text-lg font-semibold text-text-primary">{compactSummary.instances}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Running</p>
              <p className="mt-1 text-lg font-semibold text-text-primary">{compactSummary.running}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Stopped</p>
              <p className="mt-1 text-lg font-semibold text-text-primary">{compactSummary.stopped}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Total Hours</p>
              <p className="mt-1 text-lg font-semibold text-text-primary">{formatHours(compactSummary.totalHours)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Total Compute Cost</p>
              <p className="mt-1 text-lg font-semibold text-text-primary">{formatCurrency(compactSummary.totalComputeCost)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_FILTERS.map((chip) => {
              const active = quickFilter === chip
              return (
                <Button
                  key={chip}
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-8 rounded-md border-[color:var(--border-light)] px-3 text-xs hover:bg-transparent",
                    active ? "border-[color:var(--kcx-border-strong)] bg-[rgba(62,138,118,0.08)] text-text-primary" : "text-text-secondary",
                  )}
                  onClick={() => {
                    setQuickFilter(chip)
                    setPage(1)
                  }}
                >
                  {toTitleCase(chip)} ({quickFilterCounts[chip]})
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[14px] border-[color:var(--border-light)] bg-[#f7fbfb] shadow-sm-custom">
        <div className="grid grid-cols-1 border-b border-[color:var(--border-light)] md:grid-cols-4">
          <div className="min-h-[96px] px-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Instances In View</p>
                <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{largeSummary.pageCount}</p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(62,138,118,0.12)] text-[color:#24755d]">
                <Server className="h-4 w-4" />
              </span>
            </div>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Idle</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{largeSummary.idleCount}</p>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Underutilized</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{largeSummary.underutilizedCount}</p>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Overutilized</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{largeSummary.overutilizedCount}</p>
          </div>
        </div>

        <CardContent className="space-y-4 pt-4">
          {connectionsQuery.isError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {connectionErrorMessage}
            </div>
          ) : null}

          {instancesQuery.isError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {instancesErrorMessage}
            </div>
          ) : null}

          {instancesQuery.isLoading ? (
            <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-4 py-6 text-sm text-text-secondary">
              Loading inventory instances...
            </div>
          ) : (
            <Table className="min-w-[1280px]">
              <TableHeader>
                <TableRow className="border-b border-[color:var(--border-light)] bg-transparent hover:bg-transparent">
                  <TableHead className="py-4">Instance</TableHead>
                  {renderSortHead("State", "state")}
                  {renderSortHead("Instance Type", "instanceType")}
                  <TableHead className="py-4">Availability Zone</TableHead>
                  <TableHead className="py-4">Pricing Type</TableHead>
                  <TableHead className="py-4">Utilization</TableHead>
                  {renderSortHead("CPU Avg", "cpuAvg")}
                  {renderSortHead("CPU Peak", "cpuMax")}
                  {renderSortHead("Total Hours", "totalHours")}
                  {renderSortHead("Compute Cost", "computeCost")}
                  <TableHead className="py-4">Signal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.length === 0 ? (
                  <TableRow className="border-b border-[color:var(--border-light)]">
                    <TableCell colSpan={11} className="py-12 text-center text-sm text-text-secondary">
                      No inventory instances found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((instance) => {
                    const signal = getSignalTone(instance)
                    const utilization = getUtilizationStatus(instance)
                    const stateLabel = toTitleCase(instance.state ?? "unknown")

                    return (
                      <TableRow
                        key={`${instance.cloudConnectionId ?? "no-connection"}:${instance.instanceId}`}
                        className="cursor-pointer border-b border-[color:var(--border-light)] hover:bg-[rgba(62,138,118,0.06)]"
                        onClick={() => setSelectedInstance(instance)}
                      >
                        <TableCell className="py-5">
                          <p className="font-medium text-text-primary">{formatCell(instance.instanceName)}</p>
                          <p className="text-xs text-text-secondary">{instance.instanceId}</p>
                        </TableCell>
                        <TableCell className="py-5">
                          <Badge variant="outline" className={cn("rounded-md", getStateTone(instance.state))}>
                            {stateLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-5">{formatCell(instance.instanceType)}</TableCell>
                        <TableCell className="py-5">{formatCell(instance.availabilityZone)}</TableCell>
                        <TableCell className="py-5">
                          <Badge variant="outline" className={cn("rounded-md", getPricingTypeTone(instance.pricingType))}>
                            {getPricingTypeLabel(instance.pricingType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-5">
                          <Badge variant="outline" className={cn("rounded-md", getUtilizationTone(utilization))}>
                            {utilization}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-5">{formatPercent(instance.cpuAvg)}</TableCell>
                        <TableCell className="py-5">{formatPercent(instance.cpuMax)}</TableCell>
                        <TableCell className="py-5">{formatHours(instance.totalHours)}</TableCell>
                        <TableCell className="py-5 font-medium text-text-primary">{formatCurrency(instance.computeCost)}</TableCell>
                        <TableCell className="py-5">
                          <Badge variant="outline" className={cn("rounded-md", signal.className)}>
                            {signal.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}

          {!instancesQuery.isLoading && sortedItems.length > 0 ? (
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

      <Dialog open={Boolean(selectedInstance)} onOpenChange={(open) => (!open ? setSelectedInstance(null) : null)}>
        <DialogContent className="max-w-4xl rounded-none">
          {selectedInstance ? (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-left text-lg">{formatCell(selectedInstance.instanceName)}</DialogTitle>
                <p className="text-sm text-text-secondary">{selectedInstance.instanceId}</p>
              </DialogHeader>

              <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Overview</p>
                <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">State</dt>
                    <dd className="mt-1 text-sm text-text-primary">{toTitleCase(selectedInstance.state ?? "unknown")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Instance Type</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedInstance.instanceType)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Availability Zone</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedInstance.availabilityZone)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Region</dt>
                    <dd className="mt-1 text-sm text-text-primary">
                      {formatCell(selectedInstance.regionName ?? selectedInstance.regionId ?? selectedInstance.regionKey)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Launch Time</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatDateTime(selectedInstance.launchTime)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Private IP</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedInstance.privateIpAddress)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Public IP</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedInstance.publicIpAddress)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Platform</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedInstance.platform)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Architecture</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedInstance.architecture)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Tenancy</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedInstance.tenancy)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Lifecycle / Spot Status</dt>
                    <dd className="mt-1 text-sm text-text-primary">
                      {selectedInstance.pricingType === "spot"
                        ? "Spot"
                        : formatCell(selectedInstance.instanceLifecycle)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Image ID</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedInstance.imageId)}</dd>
                  </div>
                </dl>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Usage</p>
                  <dl className="mt-3 space-y-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">CPU Avg</dt>
                      <dd className="text-sm text-text-primary">{formatPercent(selectedInstance.cpuAvg)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">CPU Peak</dt>
                      <dd className="text-sm text-text-primary">{formatPercent(selectedInstance.cpuMax)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Cost</p>
                  <dl className="mt-3 space-y-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Compute Cost</dt>
                      <dd className="text-sm text-text-primary">{formatCurrency(selectedInstance.computeCost)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Latest Daily Cost</dt>
                      <dd className="text-sm text-text-primary">{formatCurrency(selectedInstance.latestDailyCost)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Total Hours</dt>
                      <dd className="text-sm text-text-primary">{formatHours(selectedInstance.totalHours)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Coverage</p>
                  <dl className="mt-3 space-y-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Pricing Type</dt>
                      <dd className="text-sm text-text-primary">{getPricingTypeLabel(selectedInstance.pricingType)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Covered Hours</dt>
                      <dd className="text-sm text-text-primary">{formatHours(selectedInstance.coveredHours)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Uncovered Hours</dt>
                      <dd className="text-sm text-text-primary">{formatHours(selectedInstance.uncoveredHours)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
