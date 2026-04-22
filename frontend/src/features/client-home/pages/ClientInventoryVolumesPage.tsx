import { useDeferredValue, useMemo, useState } from "react"
import { HardDrive, RefreshCw, Search, SlidersHorizontal } from "lucide-react"

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

const PAGE_SIZE = 25

const STATE_OPTIONS = ["in-use", "available", "creating", "deleting", "error"] as const

const ATTACHED_OPTIONS = [
  { value: "ALL", label: "All Attachment States" },
  { value: "ATTACHED", label: "Attached" },
  { value: "UNATTACHED", label: "Unattached" },
] as const
const EMPTY_VOLUME_ITEMS: InventoryEc2VolumeRow[] = []

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

function formatSizeGb(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-"
  return `${value} GiB`
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
  if (normalized === "running" || normalized === "in-use") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }
  if (normalized === "available") return "border-slate-300 bg-slate-100 text-slate-700"
  if (normalized === "creating") return "border-sky-200 bg-sky-50 text-sky-700"
  if (
    normalized === "stopped" ||
    normalized === "stopping" ||
    normalized === "shutting-down" ||
    normalized === "terminated" ||
    normalized === "deleting" ||
    normalized === "error"
  ) {
    return "border-rose-200 bg-rose-50 text-rose-700"
  }
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
}

function getAttachmentTone(isAttached: boolean | null): string {
  if (isAttached === true) return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (isAttached === false) return "border-slate-300 bg-slate-100 text-slate-700"
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
}

function getAttachedToLabel(volume: InventoryEc2VolumeRow): string {
  if (volume.isAttached !== true) return "Unattached"
  return volume.attachedInstanceName ?? volume.attachedInstanceId ?? "-"
}

function getRegionLabel(volume: InventoryEc2VolumeRow): string {
  return volume.regionName ?? volume.regionId ?? volume.regionKey ?? "-"
}

export function ClientInventoryVolumesPage() {
  const [searchInput, setSearchInput] = useState("")
  const [stateFilter, setStateFilter] = useState("ALL")
  const [volumeTypeFilter, setVolumeTypeFilter] = useState("ALL")
  const [attachedFilter, setAttachedFilter] = useState("ALL")
  const [regionFilter, setRegionFilter] = useState("ALL")
  const [page, setPage] = useState(1)
  const [selectedVolume, setSelectedVolume] = useState<InventoryEc2VolumeRow | null>(null)

  const deferredSearch = useDeferredValue(searchInput.trim())
  const state = stateFilter === "ALL" ? null : stateFilter
  const volumeType = volumeTypeFilter === "ALL" ? null : volumeTypeFilter
  const region = regionFilter === "ALL" ? null : regionFilter
  const isAttached =
    attachedFilter === "ATTACHED" ? true : attachedFilter === "UNATTACHED" ? false : null

  const volumesQuery = useInventoryEc2Volumes({
    state,
    volumeType,
    isAttached,
    region,
    search: deferredSearch.length > 0 ? deferredSearch : null,
    page,
    pageSize: PAGE_SIZE,
  })

  const items = volumesQuery.data?.items ?? EMPTY_VOLUME_ITEMS
  const rawPagination = volumesQuery.data?.pagination
  const totalItems = rawPagination?.total && rawPagination.total > 0 ? rawPagination.total : items.length
  const totalPages =
    rawPagination?.totalPages && rawPagination.totalPages > 0
      ? rawPagination.totalPages
      : totalItems > 0
        ? Math.ceil(totalItems / PAGE_SIZE)
        : 1
  const currentPage = rawPagination?.page && rawPagination.page > 0 ? rawPagination.page : page

  const volumeTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.volumeType)
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
            .map((item) => item.regionId ?? item.regionName ?? item.regionKey)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [items],
  )

  const summary = useMemo(() => {
    let attachedCount = 0
    let unattachedCount = 0
    let inUseCount = 0

    for (const item of items) {
      if (item.isAttached === true) attachedCount += 1
      if (item.isAttached === false) unattachedCount += 1
      if ((item.state ?? "").trim().toLowerCase() === "in-use") inUseCount += 1
    }

    return {
      pageCount: items.length,
      attachedCount,
      unattachedCount,
      inUseCount,
    }
  }, [items])

  const volumesErrorMessage =
    volumesQuery.error instanceof ApiError
      ? volumesQuery.error.message
      : volumesQuery.error instanceof Error
        ? volumesQuery.error.message
        : "Failed to load EC2 inventory volumes."

  return (
    <section aria-label="Inventory AWS EC2 Volumes" className="space-y-4">
      <Card className="rounded-[14px] border-[color:var(--border-light)] bg-[#f7fbfb] shadow-sm-custom">
        <div className="grid grid-cols-1 border-b border-[color:var(--border-light)] md:grid-cols-4">
          <div className="min-h-[96px] px-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Volumes In View</p>
                <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{summary.pageCount}</p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(62,138,118,0.12)] text-[color:#24755d]">
                <HardDrive className="h-4 w-4" />
              </span>
            </div>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Attached</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{summary.attachedCount}</p>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Unattached</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{summary.unattachedCount}</p>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">In Use</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{summary.inUseCount}</p>
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
                placeholder="Search by volume name or volume ID"
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
                value={volumeTypeFilter}
                onChange={(event) => {
                  setVolumeTypeFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-[11rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none"
              >
                <option value="ALL">All Volume Types</option>
                {volumeTypeOptions.map((volumeTypeValue) => (
                  <option key={volumeTypeValue} value={volumeTypeValue}>
                    {volumeTypeValue}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[11rem]">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <select
                value={attachedFilter}
                onChange={(event) => {
                  setAttachedFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-[11rem] rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent pl-9 pr-3 text-sm text-text-primary outline-none"
              >
                {ATTACHED_OPTIONS.map((option) => (
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
              onClick={() => void volumesQuery.refetch()}
              disabled={volumesQuery.isFetching}
            >
              <RefreshCw className={cn("mr-1.5 h-4 w-4", volumesQuery.isFetching ? "animate-spin" : "")} />
              Refresh
            </Button>
          </div>

          {volumesQuery.isError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {volumesErrorMessage}
            </div>
          ) : null}

          {volumesQuery.isLoading ? (
            <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-4 py-6 text-sm text-text-secondary">
              Loading inventory volumes...
            </div>
          ) : (
            <Table className="min-w-[1120px]">
              <TableHeader>
                <TableRow className="border-b border-[color:var(--border-light)] bg-transparent hover:bg-transparent">
                  <TableHead className="py-4">Volume Name</TableHead>
                  <TableHead className="py-4">Volume ID</TableHead>
                  <TableHead className="py-4">Type</TableHead>
                  <TableHead className="py-4">Size</TableHead>
                  <TableHead className="py-4">State</TableHead>
                  <TableHead className="py-4">Attached To</TableHead>
                  <TableHead className="py-4">Instance State</TableHead>
                  <TableHead className="py-4">AZ</TableHead>
                  <TableHead className="py-4">IOPS</TableHead>
                  <TableHead className="py-4">Throughput</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow className="border-b border-[color:var(--border-light)]">
                    <TableCell colSpan={10} className="py-12 text-center text-sm text-text-secondary">
                      No inventory volumes found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((volume) => (
                    <TableRow
                      key={`${volume.cloudConnectionId ?? "no-connection"}:${volume.volumeId}`}
                      className="cursor-pointer border-b border-[color:var(--border-light)] hover:bg-[rgba(62,138,118,0.06)]"
                      onClick={() => setSelectedVolume(volume)}
                    >
                      <TableCell className="py-5 font-medium text-text-primary">
                        {formatCell(volume.volumeName)}
                      </TableCell>
                      <TableCell className="py-5">{volume.volumeId}</TableCell>
                      <TableCell className="py-5">{formatCell(volume.volumeType)}</TableCell>
                      <TableCell className="py-5">{formatSizeGb(volume.sizeGb)}</TableCell>
                      <TableCell className="py-5">
                        <Badge variant="outline" className={cn("rounded-md", getStateTone(volume.state))}>
                          {toTitleCase(volume.state ?? "unknown")}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5">
                        <Badge variant="outline" className={cn("rounded-md", getAttachmentTone(volume.isAttached))}>
                          {getAttachedToLabel(volume)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5">
                        {volume.isAttached === true && volume.attachedInstanceState ? (
                          <Badge
                            variant="outline"
                            className={cn("rounded-md", getStateTone(volume.attachedInstanceState))}
                          >
                            {toTitleCase(volume.attachedInstanceState)}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="py-5">{formatCell(volume.availabilityZone)}</TableCell>
                      <TableCell className="py-5">{formatCell(volume.iops)}</TableCell>
                      <TableCell className="py-5">{formatCell(volume.throughput)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {!volumesQuery.isLoading && items.length > 0 ? (
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

      <Dialog open={Boolean(selectedVolume)} onOpenChange={(open) => (!open ? setSelectedVolume(null) : null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto rounded-none">
          <DialogHeader>
            <DialogTitle>Volume Details</DialogTitle>
          </DialogHeader>

          {selectedVolume ? (
            <div className="space-y-4">
              <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">AWS / EC2 / Volumes</p>
                <h3 className="mt-2 text-lg font-semibold text-text-primary">
                  {formatCell(selectedVolume.volumeName)}
                </h3>
                <p className="text-sm text-text-secondary">{selectedVolume.volumeId}</p>
              </div>

              <div className="rounded-md border border-[color:var(--border-light)] bg-white p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Overview</h4>
                <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Volume Name</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedVolume.volumeName)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Volume ID</dt>
                    <dd className="mt-1 text-sm text-text-primary">{selectedVolume.volumeId}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Type</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedVolume.volumeType)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Size</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatSizeGb(selectedVolume.sizeGb)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">State</dt>
                    <dd className="mt-1">
                      <Badge variant="outline" className={cn("rounded-md", getStateTone(selectedVolume.state))}>
                        {toTitleCase(selectedVolume.state ?? "unknown")}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Region</dt>
                    <dd className="mt-1 text-sm text-text-primary">{getRegionLabel(selectedVolume)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Availability Zone</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedVolume.availabilityZone)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Discovered At</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatDateTime(selectedVolume.discoveredAt)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-md border border-[color:var(--border-light)] bg-white p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Attachment</h4>
                <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Status</dt>
                    <dd className="mt-1">
                      <Badge variant="outline" className={cn("rounded-md", getAttachmentTone(selectedVolume.isAttached))}>
                        {selectedVolume.isAttached ? "Attached" : "Unattached"}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Attached Instance Name</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedVolume.attachedInstanceName)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Attached Instance ID</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedVolume.attachedInstanceId)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Attached Instance State</dt>
                    <dd className="mt-1">
                      {selectedVolume.isAttached === true && selectedVolume.attachedInstanceState ? (
                        <Badge
                          variant="outline"
                          className={cn("rounded-md", getStateTone(selectedVolume.attachedInstanceState))}
                        >
                          {toTitleCase(selectedVolume.attachedInstanceState)}
                        </Badge>
                      ) : (
                        <span className="text-sm text-text-primary">-</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Attached Instance Type</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedVolume.attachedInstanceType)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-md border border-[color:var(--border-light)] bg-white p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Configuration</h4>
                <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">IOPS</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedVolume.iops)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Throughput</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedVolume.throughput)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Cloud Connection ID</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedVolume.cloudConnectionId)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Resource Key</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedVolume.resourceKey)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Sub Account Key</dt>
                    <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedVolume.subAccountKey)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-md border border-[color:var(--border-light)] bg-white p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Metadata</h4>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Tags</p>
                    <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3 text-xs text-text-primary">
                      {formatJson(selectedVolume.tags)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Metadata</p>
                    <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3 text-xs text-text-primary">
                      {formatJson(selectedVolume.metadata)}
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
