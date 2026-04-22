import { useDeferredValue, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react"
import { ArrowUpDown, Download, Search, SlidersHorizontal, TableProperties, Server } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { InventoryEc2InstanceRow } from "@/features/client-home/api/inventory-instances.api"
import { TablePagination } from "@/features/client-home/components/TablePagination"
import { useInventoryEc2Instances } from "@/features/client-home/hooks/useInventoryEc2Instances"
import { ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"

const DEFAULT_PAGE_SIZE = 25
const ROWS_PER_PAGE_OPTIONS = [25, 50, 100] as const
const QUICK_FILTERS = ["all", "running", "stopped", "idle", "underutilized", "overutilized", "spot"] as const
const COLUMN_PREFERENCE_STORAGE_KEY = "inventory-ec2-instances-columns-v1"
const TABLE_SKELETON_ROW_COUNT = 14

const SORTABLE_COLUMN_IDS = [
  "accountName",
  "instanceName",
  "state",
  "instanceType",
  "availabilityZone",
  "cpuAvg",
  "cpuPeak",
  "totalHours",
  "computeCost",
  "launchTime",
] as const

const ALL_COLUMN_IDS = [
  "accountName",
  "instanceName",
  "instanceId",
  "state",
  "publicIp",
  "privateIp",
  "platformProduct",
  "instanceType",
  "tenancy",
  "availabilityZone",
  "attachedVolume",
  "pricingType",
  "utilization",
  "cpuAvg",
  "cpuPeak",
  "totalHours",
  "computeCost",
  "signal",
  "launchTime",
] as const

const DEFAULT_VISIBLE_COLUMN_IDS = [
  "accountName",
  "instanceName",
  "instanceId",
  "state",
  "instanceType",
  "availabilityZone",
  "attachedVolume",
  "pricingType",
  "utilization",
  "cpuAvg",
  "cpuPeak",
  "totalHours",
  "computeCost",
  "signal",
  "launchTime",
] as const

type QuickFilter = (typeof QUICK_FILTERS)[number]
type SortKey = (typeof SORTABLE_COLUMN_IDS)[number]
type SortDirection = "asc" | "desc"
type ColumnId = (typeof ALL_COLUMN_IDS)[number]

type InstanceTableColumn = {
  id: ColumnId
  label: string
  defaultVisible: boolean
  sortable?: boolean
  sortValue?: (instance: InventoryEc2InstanceRow) => number | string | null
  render: (
    instance: InventoryEc2InstanceRow,
    helpers: {
      onVolumeClick: (instance: InventoryEc2InstanceRow, event: MouseEvent<HTMLElement>) => void
      onPerformanceClick: (instance: InventoryEc2InstanceRow, event: MouseEvent<HTMLElement>) => void
    },
  ) => ReactNode
  exportValue: (instance: InventoryEc2InstanceRow) => string
}

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
    .replaceAll("-", " ")
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

function formatAttachedVolumeSummary(instance: InventoryEc2InstanceRow): string {
  if (instance.attachedVolumeTotalSizeGb !== null && Number.isFinite(instance.attachedVolumeTotalSizeGb)) {
    return `${instance.attachedVolumeTotalSizeGb} GiB`
  }
  return "-"
}

function getColumnSizingClass(columnId: ColumnId): string {
  if (columnId === "instanceId") return "min-w-[15rem] w-[15rem]"
  return ""
}

function parseStoredColumns(value: string | null): ColumnId[] | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return null
    const validated = parsed.filter((id): id is ColumnId => ALL_COLUMN_IDS.includes(id as ColumnId))
    return validated.length > 0 ? validated : null
  } catch {
    return null
  }
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

const INSTANCE_TABLE_COLUMNS: InstanceTableColumn[] = [
  {
    id: "accountName",
    label: "Account Name",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("accountName"),
    sortable: true,
    sortValue: (instance) => (instance.subAccountName ?? "").toLowerCase(),
    render: (instance) => <span>{formatCell(instance.subAccountName)}</span>,
    exportValue: (instance) => formatCell(instance.subAccountName),
  },
  {
    id: "instanceName",
    label: "Instance Name",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("instanceName"),
    sortable: true,
    sortValue: (instance) => (instance.instanceName ?? "").toLowerCase(),
    render: (instance, helpers) => (
      <button
        type="button"
        className="text-left font-medium text-text-primary underline-offset-2 hover:underline"
        onClick={(event) => helpers.onPerformanceClick(instance, event)}
      >
        {formatCell(instance.instanceName)}
      </button>
    ),
    exportValue: (instance) => formatCell(instance.instanceName),
  },
  {
    id: "instanceId",
    label: "Instance ID",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("instanceId"),
    render: (instance) => <span className="text-xs text-text-secondary">{instance.instanceId}</span>,
    exportValue: (instance) => instance.instanceId,
  },
  {
    id: "state",
    label: "State",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("state"),
    sortable: true,
    sortValue: (instance) => (instance.state ?? "").toLowerCase(),
    render: (instance) => (
      <Badge variant="outline" className={cn("rounded-md", getStateTone(instance.state))}>
        {toTitleCase(instance.state ?? "unknown")}
      </Badge>
    ),
    exportValue: (instance) => toTitleCase(instance.state ?? "unknown"),
  },
  {
    id: "publicIp",
    label: "Public IP",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("publicIp"),
    render: (instance) => <span>{formatCell(instance.publicIpAddress)}</span>,
    exportValue: (instance) => formatCell(instance.publicIpAddress),
  },
  {
    id: "privateIp",
    label: "Private IP",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("privateIp"),
    render: (instance) => <span>{formatCell(instance.privateIpAddress)}</span>,
    exportValue: (instance) => formatCell(instance.privateIpAddress),
  },
  {
    id: "platformProduct",
    label: "Platform / Product",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("platformProduct"),
    render: (instance) => <span>{formatCell(instance.platform)}</span>,
    exportValue: (instance) => formatCell(instance.platform),
  },
  {
    id: "instanceType",
    label: "Instance Type",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("instanceType"),
    sortable: true,
    sortValue: (instance) => (instance.instanceType ?? "").toLowerCase(),
    render: (instance) => <span>{formatCell(instance.instanceType)}</span>,
    exportValue: (instance) => formatCell(instance.instanceType),
  },
  {
    id: "tenancy",
    label: "Tenancy",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("tenancy"),
    render: (instance) => <span>{formatCell(instance.tenancy)}</span>,
    exportValue: (instance) => formatCell(instance.tenancy),
  },
  {
    id: "availabilityZone",
    label: "Availability Zone",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("availabilityZone"),
    sortable: true,
    sortValue: (instance) => (instance.availabilityZone ?? "").toLowerCase(),
    render: (instance) => <span>{formatCell(instance.availabilityZone)}</span>,
    exportValue: (instance) => formatCell(instance.availabilityZone),
  },
  {
    id: "attachedVolume",
    label: "Attached EBS",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("attachedVolume"),
    render: (instance, helpers) => {
      const label = formatAttachedVolumeSummary(instance)
      if (label === "-") return <span>-</span>
      return (
        <button
          type="button"
          className="text-left text-xs font-semibold text-[color:#24755d] underline-offset-2 hover:underline"
          onClick={(event) => helpers.onVolumeClick(instance, event)}
        >
          {label}
        </button>
      )
    },
    exportValue: (instance) => formatAttachedVolumeSummary(instance),
  },
  {
    id: "pricingType",
    label: "Pricing Type",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("pricingType"),
    render: (instance) => (
      <Badge variant="outline" className={cn("rounded-md", getPricingTypeTone(instance.pricingType))}>
        {getPricingTypeLabel(instance.pricingType)}
      </Badge>
    ),
    exportValue: (instance) => getPricingTypeLabel(instance.pricingType),
  },
  {
    id: "utilization",
    label: "Utilization",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("utilization"),
    render: (instance) => {
      const utilization = getUtilizationStatus(instance)
      return (
        <Badge variant="outline" className={cn("rounded-md", getUtilizationTone(utilization))}>
          {utilization}
        </Badge>
      )
    },
    exportValue: (instance) => getUtilizationStatus(instance),
  },
  {
    id: "cpuAvg",
    label: "CPU Avg",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("cpuAvg"),
    sortable: true,
    sortValue: (instance) => instance.cpuAvg,
    render: (instance, helpers) => (
      <button
        type="button"
        className="text-left text-xs font-semibold text-[color:#24755d] underline-offset-2 hover:underline"
        onClick={(event) => helpers.onPerformanceClick(instance, event)}
      >
        {formatPercent(instance.cpuAvg)}
      </button>
    ),
    exportValue: (instance) => formatPercent(instance.cpuAvg),
  },
  {
    id: "cpuPeak",
    label: "CPU Peak",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("cpuPeak"),
    sortable: true,
    sortValue: (instance) => instance.cpuMax,
    render: (instance, helpers) => (
      <button
        type="button"
        className="text-left text-xs font-semibold text-[color:#24755d] underline-offset-2 hover:underline"
        onClick={(event) => helpers.onPerformanceClick(instance, event)}
      >
        {formatPercent(instance.cpuMax)}
      </button>
    ),
    exportValue: (instance) => formatPercent(instance.cpuMax),
  },
  {
    id: "totalHours",
    label: "Total Hours",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("totalHours"),
    sortable: true,
    sortValue: (instance) => instance.totalHours,
    render: (instance) => <span>{formatHours(instance.totalHours)}</span>,
    exportValue: (instance) => formatHours(instance.totalHours),
  },
  {
    id: "computeCost",
    label: "Compute Cost",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("computeCost"),
    sortable: true,
    sortValue: (instance) => instance.computeCost,
    render: (instance) => <span className="font-medium text-text-primary">{formatCurrency(instance.computeCost)}</span>,
    exportValue: (instance) => formatCurrency(instance.computeCost),
  },
  {
    id: "signal",
    label: "Signal",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("signal"),
    render: (instance) => {
      const signal = getSignalTone(instance)
      return (
        <Badge variant="outline" className={cn("rounded-md", signal.className)}>
          {signal.label}
        </Badge>
      )
    },
    exportValue: (instance) => getSignalTone(instance).label,
  },
  {
    id: "launchTime",
    label: "Launch Time",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("launchTime"),
    sortable: true,
    sortValue: (instance) => {
      const parsed = instance.launchTime ? Date.parse(instance.launchTime) : Number.NaN
      return Number.isFinite(parsed) ? parsed : null
    },
    render: (instance) => <span>{formatDateTime(instance.launchTime)}</span>,
    exportValue: (instance) => formatDateTime(instance.launchTime),
  },
]

export function ClientInventoryInstancesPage() {
  const location = useLocation()
  const navigate = useNavigate()
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
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState<number>(DEFAULT_PAGE_SIZE)
  const [selectedInstance, setSelectedInstance] = useState<InventoryEc2InstanceRow | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("computeCost")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false)
  const [visibleColumnIds, setVisibleColumnIds] = useState<ColumnId[]>(
    INSTANCE_TABLE_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.id),
  )

  useEffect(() => {
    const stored = parseStoredColumns(window.localStorage.getItem(COLUMN_PREFERENCE_STORAGE_KEY))
    if (stored) {
      setVisibleColumnIds(stored)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(COLUMN_PREFERENCE_STORAGE_KEY, JSON.stringify(visibleColumnIds))
  }, [visibleColumnIds])

  useEffect(() => {
    setSearchInput(querySearch)
    setStateFilter(queryState)
    setInstanceTypeFilter(queryInstanceType)
    setQuickFilter("all")
    setPage(1)
  }, [queryAccount, queryConnection, queryEndDate, queryInstanceType, queryRegion, querySearch, queryStartDate, queryState])

  const deferredSearch = useDeferredValue(searchInput.trim())
  const cloudConnectionId = queryConnection === "ALL" ? null : queryConnection
  const subAccountKey = queryAccount === "ALL" ? null : queryAccount
  const state = stateFilter === "ALL" ? null : stateFilter
  const region = queryRegion === "ALL" ? null : queryRegion
  const instanceType = instanceTypeFilter === "ALL" ? null : instanceTypeFilter

  const instancesQuery = useInventoryEc2Instances({
    cloudConnectionId,
    subAccountKey,
    state,
    region,
    instanceType,
    search: deferredSearch.length > 0 ? deferredSearch : null,
    startDate: queryStartDate,
    endDate: queryEndDate,
    page,
    pageSize: rowsPerPage,
  })

  const items = instancesQuery.data?.items ?? []
  const visibleItems = useMemo(() => items.filter((item) => matchesQuickFilter(item, quickFilter)), [items, quickFilter])

  const columnById = useMemo(() => new Map(INSTANCE_TABLE_COLUMNS.map((column) => [column.id, column])), [])

  const sortedItems = useMemo(
    () =>
      [...visibleItems].sort((a, b) => {
        const column = columnById.get(sortKey)
        const getSortValue = column?.sortValue
        if (!getSortValue) return 0
        const result = compareValue(getSortValue(a), getSortValue(b))
        return sortDirection === "asc" ? result : -result
      }),
    [columnById, sortDirection, sortKey, visibleItems],
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
        ? Math.ceil(totalItems / rowsPerPage)
        : 1
  const currentPage = rawPagination?.page && rawPagination.page > 0 ? rawPagination.page : page

  const instanceTypeOptions = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.instanceType).filter((value): value is string => Boolean(value)))).sort((a, b) =>
        a.localeCompare(b),
      ),
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

  const quickFilterCounts = useMemo(
    () =>
      QUICK_FILTERS.reduce<Record<QuickFilter, number>>((accumulator, filter) => {
        accumulator[filter] = items.filter((item) => matchesQuickFilter(item, filter)).length
        return accumulator
      }, { all: 0, running: 0, stopped: 0, idle: 0, underutilized: 0, overutilized: 0, spot: 0 }),
    [items],
  )

  const visibleColumns = useMemo(
    () => INSTANCE_TABLE_COLUMNS.filter((column) => visibleColumnIds.includes(column.id)),
    [visibleColumnIds],
  )

  const instancesErrorMessage =
    instancesQuery.error instanceof ApiError
      ? instancesQuery.error.message
      : instancesQuery.error instanceof Error
        ? instancesQuery.error.message
        : "Failed to load EC2 inventory instances."

  const onSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(nextKey)
    setSortDirection("desc")
  }

  const onAttachedVolumeClick = (instance: InventoryEc2InstanceRow, event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const params = new URLSearchParams()
    params.set("isAttached", "true")
    params.set("instanceId", instance.instanceId)
    params.set("attachedInstanceId", instance.instanceId)
    if (instance.cloudConnectionId) params.set("cloudConnectionId", instance.cloudConnectionId)
    const regionLabel = instance.regionName ?? instance.regionId ?? instance.regionKey
    if (regionLabel) params.set("region", regionLabel)
    navigate(`/dashboard/inventory/aws/ec2/volumes?${params.toString()}`)
  }

  const onPerformanceClick = (instance: InventoryEc2InstanceRow, event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const params = new URLSearchParams(location.search)
    params.set("resourceType", "instance")
    params.set("mode", "single")
    params.set("resourceId", instance.instanceId)
    params.set("topic", "cpu")
    params.set("metrics", "cpu_avg")
    params.set("interval", "daily")
    params.set("time", "last_30_days")
    params.set("chartType", "line")
    if (instance.cloudConnectionId) {
      params.set("cloudConnectionId", instance.cloudConnectionId)
    } else {
      params.delete("cloudConnectionId")
    }
    navigate(`/dashboard/ec2/performance?${params.toString()}`)
  }

  const toggleColumnVisibility = (columnId: ColumnId) => {
    setVisibleColumnIds((previous) => {
      if (previous.includes(columnId)) {
        if (previous.length === 1) return previous
        return previous.filter((id) => id !== columnId)
      }
      return ALL_COLUMN_IDS.filter((id) => id === columnId || previous.includes(id))
    })
  }

  const downloadTableAsCsv = () => {
    if (visibleColumns.length === 0) return
    const header = visibleColumns.map((column) => escapeCsv(column.label)).join(",")
    const rows = sortedItems.map((instance) =>
      visibleColumns.map((column) => escapeCsv(column.exportValue(instance))).join(","),
    )
    const content = [header, ...rows].join("\n")
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", "ec2-instances.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <section aria-label="Inventory AWS EC2 Instances" className="space-y-4">
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
          <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--border-light)] pb-3">
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
              onClick={() => setColumnsDialogOpen(true)}
            >
              <TableProperties className="mr-1.5 h-4 w-4" />
              Edit Columns
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Rows per page</span>
              <select
                value={rowsPerPage}
                onChange={(event) => {
                  setRowsPerPage(Number(event.target.value))
                  setPage(1)
                }}
                className="h-9 min-w-[5.5rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent px-2 text-sm text-text-primary outline-none"
              >
                {ROWS_PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-none border-[color:var(--border-light)] bg-transparent text-text-primary hover:bg-transparent"
              onClick={downloadTableAsCsv}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Download
            </Button>
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

          {instancesQuery.isError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {instancesErrorMessage}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)]">
            <Table className="min-w-[1760px]">
              <TableHeader>
                <TableRow className="border-b border-[color:var(--border-light)] bg-[color:var(--bg-surface)] hover:bg-[color:var(--bg-surface)]">
                  {visibleColumns.map((column) => (
                    <TableHead key={column.id} className={cn("border-r border-[color:var(--border-light)] py-4 last:border-r-0", getColumnSizingClass(column.id))}>
                      {column.sortable && SORTABLE_COLUMN_IDS.includes(column.id as SortKey) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto p-0 text-left text-xs font-semibold uppercase tracking-[0.08em] text-text-muted hover:bg-transparent hover:text-text-primary"
                          onClick={() => onSort(column.id as SortKey)}
                        >
                          {column.label}
                          <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">{column.label}</span>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {instancesQuery.isLoading ? (
                  Array.from({ length: TABLE_SKELETON_ROW_COUNT }).map((_, rowIndex) => (
                    <TableRow
                      key={`skeleton-row-${rowIndex}`}
                      className="border-b border-[color:var(--border-light)] bg-[color:var(--bg-surface)] hover:bg-[color:var(--bg-surface)]"
                    >
                      {visibleColumns.map((column) => (
                        <TableCell
                          key={`${column.id}-skeleton-${rowIndex}`}
                          className={cn("border-r border-[color:var(--border-light)] py-4 last:border-r-0", getColumnSizingClass(column.id))}
                        >
                          <span className="block h-4 w-full max-w-[12rem] animate-pulse rounded bg-[color:var(--bg-surface-hover)]" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : sortedItems.length === 0 ? (
                  <TableRow className="border-b border-[color:var(--border-light)]">
                    <TableCell colSpan={Math.max(1, visibleColumns.length)} className="py-12 text-center text-sm text-text-secondary">
                      No inventory instances found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((instance) => (
                    <TableRow
                      key={`${instance.cloudConnectionId ?? "no-connection"}:${instance.instanceId}`}
                      className="cursor-pointer border-b border-[color:var(--border-light)] hover:bg-[rgba(62,138,118,0.06)]"
                      onClick={() => setSelectedInstance(instance)}
                    >
                      {visibleColumns.map((column) => (
                        <TableCell key={column.id} className={cn("border-r border-[color:var(--border-light)] py-5 last:border-r-0", getColumnSizingClass(column.id))}>
                          {column.render(instance, { onVolumeClick: onAttachedVolumeClick, onPerformanceClick })}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!instancesQuery.isLoading && sortedItems.length > 0 ? (
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.max(1, totalPages)}
              totalItems={totalItems}
              pageSize={rowsPerPage}
              onPrevious={() => setPage((previous) => Math.max(1, previous - 1))}
              onNext={() => setPage((previous) => Math.min(Math.max(1, totalPages), previous + 1))}
            />
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={columnsDialogOpen} onOpenChange={setColumnsDialogOpen}>
        <DialogContent className="left-auto right-0 top-0 h-screen max-h-screen w-[min(96vw,44rem)] max-w-none -translate-x-0 -translate-y-0 rounded-none border-l border-[color:var(--border-light)] p-6 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
          <DialogHeader className="border-b border-[color:var(--border-light)] pb-4">
            <DialogTitle className="text-left text-lg">Edit Columns</DialogTitle>
          </DialogHeader>

          <div className="mt-4 h-[calc(100vh-7.5rem)] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {INSTANCE_TABLE_COLUMNS.map((column) => {
              const checked = visibleColumnIds.includes(column.id)
              const disableUncheck = checked && visibleColumnIds.length === 1
              return (
                <label
                  key={column.id}
                    className="flex items-center justify-between rounded-xl border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-4 py-3 text-sm text-text-primary"
                >
                  <span>{column.label}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disableUncheck}
                    onChange={() => toggleColumnVisibility(column.id)}
                  />
                </label>
              )
            })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                      {selectedInstance.pricingType === "spot" ? "Spot" : formatCell(selectedInstance.instanceLifecycle)}
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
