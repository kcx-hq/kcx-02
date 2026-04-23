import { useDeferredValue, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react"
import { ArrowUpDown, Download, Search, SlidersHorizontal, TableProperties } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { InventoryEc2VolumeRow } from "@/features/client-home/api/inventory-volumes.api"
import { TablePagination } from "@/features/client-home/components/TablePagination"
import { useInventoryEc2Volumes } from "@/features/client-home/hooks/useInventoryEc2Volumes"
import { ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"

const DEFAULT_PAGE_SIZE = 25
const ROWS_PER_PAGE_OPTIONS = [25, 50, 100] as const
const COLUMN_PREFERENCE_STORAGE_KEY = "inventory-ec2-volumes-columns-v2"
const TABLE_SKELETON_ROW_COUNT = 12

const ATTACHMENT_FILTER_OPTIONS = [
  { value: "ALL", label: "All Attachment States" },
  { value: "attached", label: "Attached" },
  { value: "unattached", label: "Unattached" },
  { value: "attached_stopped", label: "Attached to Stopped" },
] as const

const OPTIMIZATION_FILTER_OPTIONS = [
  { value: "ALL", label: "All Optimization Statuses" },
  { value: "warning", label: "Warning" },
  { value: "idle", label: "Idle" },
  { value: "underutilized", label: "Underutilized" },
  { value: "optimal", label: "Optimal" },
] as const

const SORTABLE_COLUMN_IDS = [
  "volumeId",
  "volumeType",
  "sizeGb",
  "availabilityZone",
  "dailyCost",
  "mtdCost",
  "attachedInstanceState",
] as const

const ALL_COLUMN_IDS = [
  "volumeId",
  "volumeType",
  "sizeGb",
  "state",
  "attachedTo",
  "attachedInstanceState",
  "availabilityZone",
  "dailyCost",
  "mtdCost",
  "utilization",
  "optimizationStatus",
  "signal",
  "iops",
  "throughput",
  "region",
  "account",
] as const

const DEFAULT_VISIBLE_COLUMN_IDS = [
  "volumeId",
  "volumeType",
  "sizeGb",
  "state",
  "attachedTo",
  "attachedInstanceState",
  "availabilityZone",
  "dailyCost",
  "mtdCost",
  "utilization",
  "optimizationStatus",
  "signal",
] as const

type ColumnId = (typeof ALL_COLUMN_IDS)[number]
type SortKey = (typeof SORTABLE_COLUMN_IDS)[number]
type SortDirection = "asc" | "desc"

type VolumeTableColumn = {
  id: ColumnId
  label: string
  defaultVisible: boolean
  sortable?: boolean
  sortKey?: SortKey
  render: (
    volume: InventoryEc2VolumeRow,
    helpers: {
      onAttachedInstanceClick: (volume: InventoryEc2VolumeRow, event: MouseEvent<HTMLElement>) => void
    },
  ) => ReactNode
  exportValue: (volume: InventoryEc2VolumeRow) => string
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
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

function formatCell(value: string | null | number | undefined): string {
  if (value === null || typeof value === "undefined") return "-"
  if (typeof value === "number" && !Number.isFinite(value)) return "-"
  const text = String(value).trim()
  return text.length > 0 ? text : "-"
}

function formatSizeGb(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-"
  return `${numberFormatter.format(value)} GB`
}

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-"
  return currencyFormatter.format(value)
}

function getStateTone(state: string | null): string {
  const normalized = (state ?? "").trim().toLowerCase()
  if (normalized === "in-use") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (normalized === "available") return "border-slate-300 bg-slate-100 text-slate-700"
  if (normalized === "creating") return "border-sky-200 bg-sky-50 text-sky-700"
  if (normalized === "error" || normalized === "deleting") return "border-rose-200 bg-rose-50 text-rose-700"
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
}

function getUtilizationStatus(volume: InventoryEc2VolumeRow): "Idle" | "Underutilized" | "Active / Optimal" | "Unknown" {
  if (volume.isIdleCandidate === true) return "Idle"
  if (volume.isUnderutilizedCandidate === true) return "Underutilized"
  if (volume.isIdleCandidate === false || volume.isUnderutilizedCandidate === false) return "Active / Optimal"
  return "Unknown"
}

function getUtilizationTone(status: ReturnType<typeof getUtilizationStatus>): string {
  if (status === "Idle") return "border-amber-200 bg-amber-50 text-amber-700"
  if (status === "Underutilized") return "border-sky-200 bg-sky-50 text-sky-700"
  if (status === "Active / Optimal") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
}

function getOptimizationTone(status: InventoryEc2VolumeRow["optimizationStatus"]): string {
  if (status === "warning") return "border-rose-200 bg-rose-50 text-rose-700"
  if (status === "idle") return "border-amber-200 bg-amber-50 text-amber-700"
  if (status === "underutilized") return "border-sky-200 bg-sky-50 text-sky-700"
  if (status === "optimal") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
}

function getSignalLabel(volume: InventoryEc2VolumeRow): string {
  if (volume.isUnattached) return "Unattached"
  if (volume.isAttachedToStoppedInstance) return "Attached to stopped instance"
  if (volume.isIdleCandidate) return "Idle"
  if (volume.isUnderutilizedCandidate) return "Underutilized"
  return "-"
}

function getSignalTone(volume: InventoryEc2VolumeRow): string {
  if (volume.isUnattached || volume.isAttachedToStoppedInstance) return "border-rose-200 bg-rose-50 text-rose-700"
  if (volume.isIdleCandidate || volume.isUnderutilizedCandidate) return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
}

function getAttachedToLabel(volume: InventoryEc2VolumeRow): string {
  if (volume.isAttached !== true) return "Unattached"
  return volume.attachedInstanceName ?? volume.attachedInstanceId ?? "-"
}

function parseStoredColumns(value: string | null): ColumnId[] | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return null
    const valid = parsed.filter((item): item is ColumnId => ALL_COLUMN_IDS.includes(item as ColumnId))
    return valid.length > 0 ? valid : null
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

function getColumnSizingClass(columnId: ColumnId): string {
  if (columnId === "volumeId") return "min-w-[12rem] w-[12rem]"
  if (columnId === "signal") return "min-w-[14rem] w-[14rem]"
  return ""
}

const VOLUME_COLUMNS: VolumeTableColumn[] = [
  {
    id: "volumeId",
    label: "Volume ID",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("volumeId"),
    sortable: true,
    sortKey: "volumeId",
    render: (volume) => <span className="font-medium text-text-primary">{volume.volumeId}</span>,
    exportValue: (volume) => volume.volumeId,
  },
  {
    id: "volumeType",
    label: "Volume Type",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("volumeType"),
    sortable: true,
    sortKey: "volumeType",
    render: (volume) => <span>{formatCell(volume.volumeType)}</span>,
    exportValue: (volume) => formatCell(volume.volumeType),
  },
  {
    id: "sizeGb",
    label: "Size (GB)",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("sizeGb"),
    sortable: true,
    sortKey: "sizeGb",
    render: (volume) => <span>{formatSizeGb(volume.sizeGb)}</span>,
    exportValue: (volume) => formatSizeGb(volume.sizeGb),
  },
  {
    id: "state",
    label: "State",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("state"),
    render: (volume) => (
      <Badge variant="outline" className={cn("rounded-md", getStateTone(volume.state))}>
        {toTitleCase(volume.state ?? "unknown")}
      </Badge>
    ),
    exportValue: (volume) => toTitleCase(volume.state ?? "unknown"),
  },
  {
    id: "attachedTo",
    label: "Attached To",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("attachedTo"),
    render: (volume, helpers) => {
      const label = getAttachedToLabel(volume)
      if (volume.isAttached !== true || !volume.attachedInstanceId) return <span>{label}</span>
      return (
        <button
          type="button"
          className="text-left text-xs font-semibold text-[color:#24755d] underline-offset-2 hover:underline"
          onClick={(event) => helpers.onAttachedInstanceClick(volume, event)}
        >
          {label}
        </button>
      )
    },
    exportValue: (volume) => getAttachedToLabel(volume),
  },
  {
    id: "attachedInstanceState",
    label: "Attached Instance State",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("attachedInstanceState"),
    sortable: true,
    sortKey: "attachedInstanceState",
    render: (volume) =>
      volume.isAttached === true && volume.attachedInstanceState ? (
        <Badge variant="outline" className={cn("rounded-md", getStateTone(volume.attachedInstanceState))}>
          {toTitleCase(volume.attachedInstanceState)}
        </Badge>
      ) : (
        "-"
      ),
    exportValue: (volume) => formatCell(volume.attachedInstanceState),
  },
  {
    id: "availabilityZone",
    label: "Availability Zone",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("availabilityZone"),
    sortable: true,
    sortKey: "availabilityZone",
    render: (volume) => <span>{formatCell(volume.availabilityZone)}</span>,
    exportValue: (volume) => formatCell(volume.availabilityZone),
  },
  {
    id: "dailyCost",
    label: "Daily Cost",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("dailyCost"),
    sortable: true,
    sortKey: "dailyCost",
    render: (volume) => <span className="font-medium text-text-primary">{formatCurrency(volume.dailyCost)}</span>,
    exportValue: (volume) => formatCurrency(volume.dailyCost),
  },
  {
    id: "mtdCost",
    label: "MTD Cost",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("mtdCost"),
    sortable: true,
    sortKey: "mtdCost",
    render: (volume) => <span className="font-medium text-text-primary">{formatCurrency(volume.mtdCost)}</span>,
    exportValue: (volume) => formatCurrency(volume.mtdCost),
  },
  {
    id: "utilization",
    label: "Utilization",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("utilization"),
    render: (volume) => {
      const status = getUtilizationStatus(volume)
      return (
        <Badge variant="outline" className={cn("rounded-md", getUtilizationTone(status))}>
          {status}
        </Badge>
      )
    },
    exportValue: (volume) => getUtilizationStatus(volume),
  },
  {
    id: "optimizationStatus",
    label: "Optimization Status",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("optimizationStatus"),
    render: (volume) => (
      <Badge variant="outline" className={cn("rounded-md", getOptimizationTone(volume.optimizationStatus))}>
        {toTitleCase(volume.optimizationStatus ?? "unknown")}
      </Badge>
    ),
    exportValue: (volume) => toTitleCase(volume.optimizationStatus ?? "unknown"),
  },
  {
    id: "signal",
    label: "Signal / Issue",
    defaultVisible: DEFAULT_VISIBLE_COLUMN_IDS.includes("signal"),
    render: (volume) => (
      <Badge variant="outline" className={cn("rounded-md", getSignalTone(volume))}>
        {getSignalLabel(volume)}
      </Badge>
    ),
    exportValue: (volume) => getSignalLabel(volume),
  },
  {
    id: "iops",
    label: "IOPS",
    defaultVisible: false,
    render: (volume) => <span>{formatCell(volume.iops)}</span>,
    exportValue: (volume) => formatCell(volume.iops),
  },
  {
    id: "throughput",
    label: "Throughput",
    defaultVisible: false,
    render: (volume) => <span>{formatCell(volume.throughput)}</span>,
    exportValue: (volume) => formatCell(volume.throughput),
  },
  {
    id: "region",
    label: "Region",
    defaultVisible: false,
    render: (volume) => <span>{formatCell(volume.regionId ?? volume.regionName ?? volume.regionKey)}</span>,
    exportValue: (volume) => formatCell(volume.regionId ?? volume.regionName ?? volume.regionKey),
  },
  {
    id: "account",
    label: "Account",
    defaultVisible: false,
    render: (volume) => <span>{formatCell(volume.subAccountName ?? volume.subAccountKey)}</span>,
    exportValue: (volume) => formatCell(volume.subAccountName ?? volume.subAccountKey),
  },
]

export function ClientInventoryVolumesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const selectedStartDate =
    queryParams.get("billingPeriodStart") ?? queryParams.get("from") ?? queryParams.get("startDate")
  const selectedEndDate =
    queryParams.get("billingPeriodEnd") ?? queryParams.get("to") ?? queryParams.get("endDate")

  const [searchInput, setSearchInput] = useState(queryParams.get("search") ?? queryParams.get("volumeId") ?? "")
  const [regionFilter, setRegionFilter] = useState(queryParams.get("region") ?? "ALL")
  const [volumeTypeFilter, setVolumeTypeFilter] = useState(queryParams.get("volumeType") ?? "ALL")
  const [attachmentStateFilter, setAttachmentStateFilter] = useState(queryParams.get("attachmentState") ?? "ALL")
  const [optimizationStatusFilter, setOptimizationStatusFilter] = useState(queryParams.get("optimizationStatus") ?? "ALL")
  const [cloudConnectionFilter, setCloudConnectionFilter] = useState(queryParams.get("cloudConnectionId") ?? "ALL")
  const [subAccountFilter, setSubAccountFilter] = useState(queryParams.get("subAccountKey") ?? "ALL")
  const [signalFilter, setSignalFilter] = useState<"ALL" | "unattached" | "attached_stopped" | "idle" | "underutilized">("ALL")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState<number>(DEFAULT_PAGE_SIZE)
  const [sortKey, setSortKey] = useState<SortKey>("mtdCost")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false)
  const [visibleColumnIds, setVisibleColumnIds] = useState<ColumnId[]>(
    VOLUME_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.id),
  )

  const deferredSearch = useDeferredValue(searchInput.trim())

  useEffect(() => {
    const stored = parseStoredColumns(window.localStorage.getItem(COLUMN_PREFERENCE_STORAGE_KEY))
    if (stored) setVisibleColumnIds(stored)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(COLUMN_PREFERENCE_STORAGE_KEY, JSON.stringify(visibleColumnIds))
  }, [visibleColumnIds])

  const volumesQuery = useInventoryEc2Volumes({
    cloudConnectionId: cloudConnectionFilter === "ALL" ? null : cloudConnectionFilter,
    subAccountKey: subAccountFilter === "ALL" ? null : subAccountFilter,
    startDate: selectedStartDate,
    endDate: selectedEndDate,
    region: regionFilter === "ALL" ? null : regionFilter,
    volumeType: volumeTypeFilter === "ALL" ? null : volumeTypeFilter,
    attachmentState:
      attachmentStateFilter === "ALL"
        ? null
        : (attachmentStateFilter as "attached" | "unattached" | "attached_stopped"),
    optimizationStatus:
      optimizationStatusFilter === "ALL"
        ? null
        : (optimizationStatusFilter as "idle" | "underutilized" | "optimal" | "warning"),
    signal: signalFilter === "ALL" ? null : signalFilter,
    search: deferredSearch.length > 0 ? deferredSearch : null,
    sortBy:
      sortKey === "mtdCost"
        ? "mtdCost"
        : sortKey === "dailyCost"
          ? "dailyCost"
          : sortKey === "sizeGb"
            ? "sizeGb"
            : sortKey === "volumeType"
              ? "volumeType"
              : sortKey === "availabilityZone"
                ? "availabilityZone"
                : sortKey === "attachedInstanceState"
                  ? "attachedInstanceState"
                  : "volumeId",
    sortDirection,
    page,
    pageSize: rowsPerPage,
  })

  const items = volumesQuery.data?.items ?? []
  const summary = volumesQuery.data?.summary
  const responseDateRange = volumesQuery.data?.dateRange
  const pagination = volumesQuery.data?.pagination
  const totalItems = pagination?.total ?? items.length
  const totalPages = pagination?.totalPages && pagination.totalPages > 0 ? pagination.totalPages : Math.max(1, Math.ceil(Math.max(totalItems, 1) / rowsPerPage))
  const currentPage = pagination?.page ?? page

  const volumeTypeOptions = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.volumeType).filter((value): value is string => Boolean(value)))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  )
  const regionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.regionId ?? item.regionName ?? item.regionKey)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [items],
  )
  const connectionOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.cloudConnectionId).filter((value): value is string => Boolean(value)))),
    [items],
  )
  const accountOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.subAccountKey).filter((value): value is string => Boolean(value)))),
    [items],
  )

  const volumesErrorMessage =
    volumesQuery.error instanceof ApiError
      ? volumesQuery.error.message
      : volumesQuery.error instanceof Error
        ? volumesQuery.error.message
        : "Failed to load EC2 volumes."

  const visibleColumns = useMemo(
    () => VOLUME_COLUMNS.filter((column) => visibleColumnIds.includes(column.id)),
    [visibleColumnIds],
  )

  const toggleColumnVisibility = (columnId: ColumnId) => {
    setVisibleColumnIds((previous) => {
      if (previous.includes(columnId)) {
        if (previous.length === 1) return previous
        return previous.filter((id) => id !== columnId)
      }
      return ALL_COLUMN_IDS.filter((id) => id === columnId || previous.includes(id))
    })
  }

  const onSort = (key: SortKey) => {
    setSortKey((previousKey) => {
      if (previousKey === key) {
        setSortDirection((previousDirection) => (previousDirection === "asc" ? "desc" : "asc"))
        return previousKey
      }
      setSortDirection("asc")
      return key
    })
    setPage(1)
  }

  const onAttachedInstanceClick = (volume: InventoryEc2VolumeRow, event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!volume.attachedInstanceId) return
    const params = new URLSearchParams(location.search)
    params.set("instanceId", volume.attachedInstanceId)
    params.set("search", volume.attachedInstanceId)
    if (selectedStartDate) {
      params.set("startDate", selectedStartDate)
      params.set("from", selectedStartDate)
      params.set("billingPeriodStart", selectedStartDate)
    }
    if (selectedEndDate) {
      params.set("endDate", selectedEndDate)
      params.set("to", selectedEndDate)
      params.set("billingPeriodEnd", selectedEndDate)
    }
    if (volume.cloudConnectionId) params.set("cloudConnectionId", volume.cloudConnectionId)
    navigate(`/dashboard/inventory/aws/ec2/instances?${params.toString()}`)
  }

  const navigateToPerformance = (volume: InventoryEc2VolumeRow) => {
    const params = new URLSearchParams(location.search)
    params.set("resourceType", "volume")
    params.set("resourceId", volume.volumeId)
    params.set("topic", "ebs")
    params.set("metrics", "volume_read_bytes,volume_write_bytes")
    params.set("interval", "daily")
    if (selectedStartDate) {
      params.set("startDate", selectedStartDate)
      params.set("from", selectedStartDate)
      params.set("billingPeriodStart", selectedStartDate)
    }
    if (selectedEndDate) {
      params.set("endDate", selectedEndDate)
      params.set("to", selectedEndDate)
      params.set("billingPeriodEnd", selectedEndDate)
    }
    if (volume.cloudConnectionId) params.set("cloudConnectionId", volume.cloudConnectionId)
    navigate(`/dashboard/ec2/performance?${params.toString()}`)
  }

  const downloadTableAsCsv = () => {
    const header = visibleColumns.map((column) => escapeCsv(column.label)).join(",")
    const rows = items.map((volume) =>
      visibleColumns.map((column) => escapeCsv(column.exportValue(volume))).join(","),
    )
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    const filenameStart = selectedStartDate ?? responseDateRange?.startDate ?? "range-start"
    const filenameEnd = selectedEndDate ?? responseDateRange?.endDate ?? "range-end"
    link.download = `ec2-volumes-${filenameStart}-${filenameEnd}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const selectSignalCard = (signal: "ALL" | "unattached" | "attached_stopped" | "idle" | "underutilized") => {
    setSignalFilter(signal)
    setPage(1)
  }

  return (
    <section aria-label="Inventory AWS EC2 Volumes" className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative min-w-[10rem]">
          <SlidersHorizontal className="pointer-events-none absolute left-3 top-[2.1rem] h-4 w-4 -translate-y-1/2 text-text-muted" />
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">AWS Connection</p>
          <select
            value={cloudConnectionFilter}
            onChange={(event) => {
              setCloudConnectionFilter(event.target.value)
              setPage(1)
            }}
            className="mt-1 h-9 min-w-[10rem] w-full rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-2 text-sm text-text-primary outline-none"
          >
            <option value="ALL">All Connections</option>
            {connectionOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="relative min-w-[10rem]">
          <SlidersHorizontal className="pointer-events-none absolute left-3 top-[2.1rem] h-4 w-4 -translate-y-1/2 text-text-muted" />
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Account</p>
          <select
            value={subAccountFilter}
            onChange={(event) => {
              setSubAccountFilter(event.target.value)
              setPage(1)
            }}
            className="mt-1 h-9 min-w-[10rem] w-full rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-2 text-sm text-text-primary outline-none"
          >
            <option value="ALL">All Accounts</option>
            {accountOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card className="rounded-[14px] border-[color:var(--border-light)] bg-[#f7fbfb] shadow-sm-custom">
        <div className="grid grid-cols-1 border-b border-[color:var(--border-light)] md:grid-cols-3 xl:grid-cols-7">
          <button type="button" className="min-h-[96px] px-6 py-4 text-left" onClick={() => selectSignalCard("ALL")}>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Total Volumes</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{numberFormatter.format(summary?.totalVolumes ?? 0)}</p>
          </button>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Total Storage (GB)</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{numberFormatter.format(summary?.totalStorageGb ?? 0)}</p>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 xl:border-l xl:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Total Cost</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{formatCurrency(summary?.totalCost ?? 0)}</p>
          </div>
          <button type="button" className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 text-left md:border-l xl:border-t-0" onClick={() => selectSignalCard("unattached")}>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Unattached</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{numberFormatter.format(summary?.unattachedVolumes ?? 0)}</p>
          </button>
          <button type="button" className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 text-left xl:border-l xl:border-t-0" onClick={() => selectSignalCard("attached_stopped")}>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Attached to Stopped</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{numberFormatter.format(summary?.attachedToStoppedInstance ?? 0)}</p>
          </button>
          <button type="button" className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 text-left md:border-l xl:border-t-0" onClick={() => selectSignalCard("idle")}>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Idle Volumes</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{numberFormatter.format(summary?.idleVolumes ?? 0)}</p>
          </button>
          <button type="button" className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 text-left xl:border-l xl:border-t-0" onClick={() => selectSignalCard("underutilized")}>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Underutilized</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{numberFormatter.format(summary?.underutilizedVolumes ?? 0)}</p>
          </button>
        </div>

        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--border-light)] pb-3">
            <div className="relative min-w-[16rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value)
                  setPage(1)
                }}
                placeholder="Search by volume ID or attached instance"
                className="h-9 w-full rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
              />
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
                {regionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[11rem]">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <select
                value={volumeTypeFilter}
                onChange={(event) => {
                  setVolumeTypeFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-[11rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none"
              >
                <option value="ALL">All Volume Types</option>
                {volumeTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[11rem]">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <select
                value={attachmentStateFilter}
                onChange={(event) => {
                  setAttachmentStateFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-[11rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none"
              >
                {ATTACHMENT_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[11rem]">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <select
                value={optimizationStatusFilter}
                onChange={(event) => {
                  setOptimizationStatusFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-[11rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none"
              >
                {OPTIMIZATION_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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

          {volumesQuery.isError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {volumesErrorMessage}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)]">
            <Table className="min-w-[1760px]">
              <TableHeader>
                <TableRow className="border-b border-[color:var(--border-light)] bg-[color:var(--bg-surface)] hover:bg-[color:var(--bg-surface)]">
                  {visibleColumns.map((column) => (
                    <TableHead key={column.id} className={cn("border-r border-[color:var(--border-light)] py-4 last:border-r-0", getColumnSizingClass(column.id))}>
                      {column.sortable && column.sortKey ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto p-0 text-left text-xs font-semibold uppercase tracking-[0.08em] text-text-muted hover:bg-transparent hover:text-text-primary"
                          onClick={() => onSort(column.sortKey as SortKey)}
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
                {volumesQuery.isLoading ? (
                  Array.from({ length: TABLE_SKELETON_ROW_COUNT }).map((_, rowIndex) => (
                    <TableRow key={`volume-skeleton-${rowIndex}`} className="border-b border-[color:var(--border-light)] bg-[color:var(--bg-surface)] hover:bg-[color:var(--bg-surface)]">
                      {visibleColumns.map((column) => (
                        <TableCell key={`${column.id}-skeleton-${rowIndex}`} className={cn("border-r border-[color:var(--border-light)] py-4 last:border-r-0", getColumnSizingClass(column.id))}>
                          <span className="block h-4 w-full max-w-[12rem] animate-pulse rounded bg-[color:var(--bg-surface-hover)]" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow className="border-b border-[color:var(--border-light)]">
                    <TableCell colSpan={Math.max(1, visibleColumns.length)} className="py-12 text-center text-sm text-text-secondary">
                      No volumes match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((volume) => {
                    const hasSignal =
                      volume.isUnattached ||
                      volume.isAttachedToStoppedInstance ||
                      volume.isIdleCandidate ||
                      volume.isUnderutilizedCandidate
                    return (
                      <TableRow
                        key={`${volume.cloudConnectionId ?? "no-connection"}:${volume.volumeId}`}
                        className={cn(
                          "cursor-pointer border-b border-[color:var(--border-light)] hover:bg-[rgba(62,138,118,0.06)]",
                          hasSignal ? "bg-[rgba(245,158,11,0.06)]" : "",
                        )}
                        onClick={() => navigateToPerformance(volume)}
                      >
                        {visibleColumns.map((column) => (
                          <TableCell key={column.id} className={cn("border-r border-[color:var(--border-light)] py-5 last:border-r-0", getColumnSizingClass(column.id))}>
                            {column.render(volume, { onAttachedInstanceClick })}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {!volumesQuery.isLoading && items.length > 0 ? (
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
              {VOLUME_COLUMNS.map((column) => {
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
    </section>
  )
}
