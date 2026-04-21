import { useDeferredValue, useMemo, useState } from "react"
import { RefreshCw, Search, Server, SlidersHorizontal } from "lucide-react"

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

const STATE_OPTIONS = ["running", "stopped", "pending", "terminated"] as const

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

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-"
  return `${value.toFixed(2)}%`
}

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-"
  return currencyFormatter.format(value)
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

function getSignalTone(instance: InventoryEc2InstanceRow): { label: string; className: string } {
  if (instance.isIdleCandidate) {
    return { label: "Idle", className: "border-amber-200 bg-amber-50 text-amber-700" }
  }
  if (instance.isUnderutilizedCandidate) {
    return { label: "Underutilized", className: "border-sky-200 bg-sky-50 text-sky-700" }
  }
  if (instance.isOverutilizedCandidate) {
    return { label: "Overutilized", className: "border-rose-200 bg-rose-50 text-rose-700" }
  }
  return { label: "Healthy", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
}

function getStateTone(state: string | null): string {
  const normalized = (state ?? "").trim().toLowerCase()
  if (normalized === "running") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (normalized === "stopped" || normalized === "stopping") return "border-slate-300 bg-slate-100 text-slate-700"
  if (normalized === "pending") return "border-sky-200 bg-sky-50 text-sky-700"
  if (normalized === "terminated") return "border-rose-200 bg-rose-50 text-rose-700"
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
}

export function ClientInventoryInstancesPage() {
  const [searchInput, setSearchInput] = useState("")
  const [stateFilter, setStateFilter] = useState("ALL")
  const [instanceTypeFilter, setInstanceTypeFilter] = useState("ALL")
  const [connectionFilter, setConnectionFilter] = useState("ALL")
  const [page, setPage] = useState(1)
  const [selectedInstance, setSelectedInstance] = useState<InventoryEc2InstanceRow | null>(null)

  const deferredSearch = useDeferredValue(searchInput.trim())
  const cloudConnectionId = connectionFilter === "ALL" ? null : connectionFilter
  const state = stateFilter === "ALL" ? null : stateFilter
  const instanceType = instanceTypeFilter === "ALL" ? null : instanceTypeFilter

  const instancesQuery = useInventoryEc2Instances({
    cloudConnectionId,
    state,
    instanceType,
    search: deferredSearch.length > 0 ? deferredSearch : null,
    page,
    pageSize: PAGE_SIZE,
  })

  const connectionsQuery = useTenantCloudIntegrations(true)

  const items = instancesQuery.data?.items ?? []
  const rawPagination = instancesQuery.data?.pagination
  const totalItems = rawPagination?.total && rawPagination.total > 0 ? rawPagination.total : items.length
  const totalPages =
    rawPagination?.totalPages && rawPagination.totalPages > 0
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
      Array.from(
        new Set(
          items
            .map((item) => item.instanceType)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [items],
  )

  const summary = useMemo(() => {
    let idleCount = 0
    let underutilizedCount = 0
    let overutilizedCount = 0

    for (const item of items) {
      if (item.isIdleCandidate) idleCount += 1
      if (item.isUnderutilizedCandidate) underutilizedCount += 1
      if (item.isOverutilizedCandidate) overutilizedCount += 1
    }

    return {
      pageCount: items.length,
      idleCount,
      underutilizedCount,
      overutilizedCount,
    }
  }, [items])

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

  return (
    <section aria-label="Inventory AWS EC2 Instances" className="space-y-4">
      <Card className="rounded-[14px] border-[color:var(--border-light)] bg-[#f7fbfb] shadow-sm-custom">
        <div className="grid grid-cols-1 border-b border-[color:var(--border-light)] md:grid-cols-4">
          <div className="min-h-[96px] px-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Instances In View</p>
                <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{summary.pageCount}</p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(62,138,118,0.12)] text-[color:#24755d]">
                <Server className="h-4 w-4" />
              </span>
            </div>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Idle</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{summary.idleCount}</p>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Underutilized</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{summary.underutilizedCount}</p>
          </div>
          <div className="min-h-[96px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Overutilized</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-text-primary">{summary.overutilizedCount}</p>
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
                placeholder="Search by instance name or instance ID"
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
            <Table className="min-w-[1220px]">
              <TableHeader>
                <TableRow className="border-b border-[color:var(--border-light)] bg-transparent hover:bg-transparent">
                  <TableHead className="py-4">Instance Name</TableHead>
                  <TableHead className="py-4">Instance ID</TableHead>
                  <TableHead className="py-4">State</TableHead>
                  <TableHead className="py-4">Instance Type</TableHead>
                  <TableHead className="py-4">Availability Zone</TableHead>
                  <TableHead className="py-4">Launch Time</TableHead>
                  <TableHead className="py-4">Private IP</TableHead>
                  <TableHead className="py-4">Public IP</TableHead>
                  <TableHead className="py-4">CPU Avg</TableHead>
                  <TableHead className="py-4">CPU Peak</TableHead>
                  <TableHead className="py-4">Signal</TableHead>
                  <TableHead className="py-4 text-right">Month-To-Date Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow className="border-b border-[color:var(--border-light)]">
                    <TableCell colSpan={12} className="py-12 text-center text-sm text-text-secondary">
                      No inventory instances found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((instance) => {
                    const signal = getSignalTone(instance)
                    const stateLabel = toTitleCase(instance.state ?? "unknown")

                    return (
                      <TableRow
                        key={`${instance.cloudConnectionId ?? "no-connection"}:${instance.instanceId}`}
                        className="cursor-pointer border-b border-[color:var(--border-light)] hover:bg-[rgba(62,138,118,0.06)]"
                        onClick={() => setSelectedInstance(instance)}
                      >
                        <TableCell className="py-5 font-medium text-text-primary">
                          {formatCell(instance.instanceName)}
                        </TableCell>
                        <TableCell className="py-5">{instance.instanceId}</TableCell>
                        <TableCell className="py-5">
                          <Badge variant="outline" className={cn("rounded-md", getStateTone(instance.state))}>
                            {stateLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-5">{formatCell(instance.instanceType)}</TableCell>
                        <TableCell className="py-5">{formatCell(instance.availabilityZone)}</TableCell>
                        <TableCell className="py-5">{formatDateTime(instance.launchTime)}</TableCell>
                        <TableCell className="py-5">{formatCell(instance.privateIpAddress)}</TableCell>
                        <TableCell className="py-5">{formatCell(instance.publicIpAddress)}</TableCell>
                        <TableCell className="py-5">{formatPercent(instance.cpuAvg)}</TableCell>
                        <TableCell className="py-5">{formatPercent(instance.cpuMax)}</TableCell>
                        <TableCell className="py-5">
                          <Badge variant="outline" className={cn("rounded-md", signal.className)}>
                            {signal.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-5 text-right font-medium text-text-primary">
                          {formatCurrency(instance.monthToDateCost)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}

          {!instancesQuery.isLoading && items.length > 0 ? (
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
        <DialogContent className="max-w-2xl rounded-none">
          <DialogHeader>
            <DialogTitle>Instance Details</DialogTitle>
          </DialogHeader>

          {selectedInstance ? (
            <div className="space-y-4">
              <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">AWS / EC2 / Instances</p>
                <h3 className="mt-2 text-lg font-semibold text-text-primary">
                  {formatCell(selectedInstance.instanceName)}
                </h3>
                <p className="text-sm text-text-secondary">{selectedInstance.instanceId}</p>
              </div>

              <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Platform</dt>
                  <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedInstance.platform)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Launch Time</dt>
                  <dd className="mt-1 text-sm text-text-primary">{formatDateTime(selectedInstance.launchTime)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Region</dt>
                  <dd className="mt-1 text-sm text-text-primary">
                    {formatCell(selectedInstance.regionName ?? selectedInstance.regionId ?? selectedInstance.regionKey)}
                  </dd>
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
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">CPU Avg</dt>
                  <dd className="mt-1 text-sm text-text-primary">{formatPercent(selectedInstance.cpuAvg)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">CPU Peak</dt>
                  <dd className="mt-1 text-sm text-text-primary">{formatPercent(selectedInstance.cpuMax)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Month-To-Date Cost</dt>
                  <dd className="mt-1 text-sm text-text-primary">{formatCurrency(selectedInstance.monthToDateCost)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Latest Daily Cost</dt>
                  <dd className="mt-1 text-sm text-text-primary">{formatCurrency(selectedInstance.latestDailyCost)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Tenancy</dt>
                  <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedInstance.tenancy)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Architecture</dt>
                  <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedInstance.architecture)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Lifecycle</dt>
                  <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedInstance.instanceLifecycle)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Image ID</dt>
                  <dd className="mt-1 text-sm text-text-primary">{formatCell(selectedInstance.imageId)}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
