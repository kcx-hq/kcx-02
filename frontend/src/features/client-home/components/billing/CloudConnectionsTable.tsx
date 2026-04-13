import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TablePagination } from "@/features/client-home/components/TablePagination"
import { cn } from "@/lib/utils"

import type { CloudIntegrationOverviewRow } from "./billingHelpers"

type CloudConnectionsTableProps = {
  rows: CloudIntegrationOverviewRow[]
  totalRows: number
  isLoading: boolean
  isError: boolean
  errorMessage: string
  dashboardActionLoading: boolean
  dashboardConnectionActionId: string | null
  onRetry: () => void
  onOpenDashboard: (integrationId: string) => void
  onGetRequestActivityDetails: (
    integrationId: string,
  ) => Promise<{ ingestionRows: number | null; ingestedAt: string | null }>
}

const PAGE_SIZE = 10

function formatActivityDate(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function statusBadgeClass(status: CloudIntegrationOverviewRow["statusLabel"]) {
  if (status === "HEALTHY") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "WARNING") return "border-amber-200 bg-amber-50 text-amber-700"
  if (status === "FAILED") return "border-rose-200 bg-rose-50 text-rose-700"
  if (status === "CONNECTING" || status === "PENDING") return "border-sky-200 bg-sky-50 text-sky-700"
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
}

function RequestActivitySparkline({ status }: { status: CloudIntegrationOverviewRow["statusLabel"] }) {
  const stroke = status === "FAILED" ? "#d45353" : status === "WARNING" ? "#b7791f" : "#2f5f94"
  const fill = status === "FAILED" ? "rgba(212,83,83,0.12)" : status === "WARNING" ? "rgba(183,121,31,0.12)" : "rgba(47,95,148,0.12)"

  return (
    <svg viewBox="0 0 100 36" className="h-8 w-20" aria-hidden="true">
      <path d="M2 30 L2 34 L98 34 L98 16 L75 10 L58 18 L42 22 L26 28 Z" fill={fill} />
      <path d="M2 30 L26 28 L42 22 L58 18 L75 10 L98 16" fill="none" stroke={stroke} strokeWidth="1.8" />
    </svg>
  )
}

export function CloudConnectionsTable({
  rows,
  totalRows,
  isLoading,
  isError,
  errorMessage,
  dashboardActionLoading,
  dashboardConnectionActionId,
  onRetry,
  onOpenDashboard,
  onGetRequestActivityDetails,
}: CloudConnectionsTableProps) {
  const [page, setPage] = useState(1)
  const [activeActivityTooltipId, setActiveActivityTooltipId] = useState<string | null>(null)
  const [activityDetailsById, setActivityDetailsById] = useState<
    Record<string, { loading: boolean; ingestionRows: number | null; ingestedAt: string | null; error: boolean }>
  >({})
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return rows.slice(startIndex, startIndex + PAGE_SIZE)
  }, [currentPage, rows])

  function handleLoadRequestActivityDetails(integrationId: string) {
    const existing = activityDetailsById[integrationId]
    if (existing?.loading || existing) return

    setActivityDetailsById((previous) => ({
      ...previous,
      [integrationId]: { loading: true, ingestionRows: null, ingestedAt: null, error: false },
    }))

    void (async () => {
      try {
        const details = await onGetRequestActivityDetails(integrationId)
        setActivityDetailsById((previous) => ({
          ...previous,
          [integrationId]: {
            loading: false,
            ingestionRows: details.ingestionRows,
            ingestedAt: details.ingestedAt,
            error: false,
          },
        }))
      } catch {
        setActivityDetailsById((previous) => ({
          ...previous,
          [integrationId]: { loading: false, ingestionRows: null, ingestedAt: null, error: true },
        }))
      }
    })()
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto overflow-y-visible">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[color:var(--border-light)]">
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Name</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Cloud Provider</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Last Checked</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Last Success</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Request Activity</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Status</th>
          </tr>
        </thead>

        {isLoading ? (
          <tbody>
            <tr>
              <td className="px-4 py-8 text-text-secondary" colSpan={6}>
                Loading cloud connections...
              </td>
            </tr>
          </tbody>
        ) : isError ? (
          <tbody>
            <tr>
              <td className="px-4 py-8" colSpan={6}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-rose-600">{errorMessage}</span>
                  <Button variant="outline" size="sm" className="h-8 rounded-md" onClick={onRetry}>
                    Retry
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        ) : rows.length === 0 ? (
          <tbody>
            <tr>
              <td className="px-4 py-8" colSpan={6}>
                <p className="text-base font-semibold text-text-primary">No connections found</p>
                <p className="mt-1 text-sm text-text-secondary">
                  {totalRows === 0
                    ? "Connect your first cloud account to start automated billing ingestion."
                    : "Try changing filters or broadening the selected scope."}
                </p>
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody>
            {paginatedRows.map((row) => (
              <tr
                key={row.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!dashboardActionLoading) onOpenDashboard(row.id)
                }}
                onKeyDown={(event) => {
                  if (dashboardActionLoading) return
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onOpenDashboard(row.id)
                  }
                }}
                className={cn(
                  "border-b border-[color:var(--border-light)] transition-colors hover:bg-[color:var(--bg-surface)]",
                  dashboardActionLoading ? "cursor-wait" : "cursor-pointer",
                )}
              >
                <td className="px-4 py-3 text-[0.95rem] font-semibold text-[#226176]">
                  {row.connectionName}
                  {dashboardConnectionActionId === row.id ? (
                    <span className="ml-2 text-xs font-medium text-text-muted">Opening...</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-[0.95rem] text-text-primary">{row.provider}</td>
                <td className="px-4 py-3 text-[0.95rem] text-text-primary">{row.lastChecked}</td>
                <td className="px-4 py-3 text-[0.95rem] text-text-primary">{row.lastSuccess}</td>
                <td className="overflow-visible px-4 py-3">
                  <div
                    className="relative inline-flex"
                    onMouseEnter={() => {
                      setActiveActivityTooltipId(row.id)
                      handleLoadRequestActivityDetails(row.id)
                    }}
                    onMouseLeave={() => setActiveActivityTooltipId((previous) => (previous === row.id ? null : previous))}
                    onFocus={() => {
                      setActiveActivityTooltipId(row.id)
                      handleLoadRequestActivityDetails(row.id)
                    }}
                    onBlur={() => setActiveActivityTooltipId((previous) => (previous === row.id ? null : previous))}
                  >
                    <RequestActivitySparkline status={row.statusLabel} />
                    {activeActivityTooltipId === row.id ? (
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-[color:var(--border-light)] bg-white px-2.5 py-2 text-xs text-text-primary shadow-sm">
                        {activityDetailsById[row.id]?.loading ? (
                          <p>Loading activity...</p>
                        ) : activityDetailsById[row.id]?.error ? (
                          <p>Activity unavailable</p>
                        ) : (
                          <>
                            <p>Ingestion rows: {activityDetailsById[row.id]?.ingestionRows ?? "-"}</p>
                            <p>Ingested on: {formatActivityDate(activityDetailsById[row.id]?.ingestedAt ?? null)}</p>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={cn("rounded-sm px-1.5 py-0 text-[11px]", statusBadgeClass(row.statusLabel))}>
                    {row.statusLabel}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
      </div>
      {!isLoading && !isError && rows.length > 0 ? (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={rows.length}
          pageSize={PAGE_SIZE}
          onPrevious={() => setPage((previous) => Math.max(previous - 1, 1))}
          onNext={() => setPage((previous) => Math.min(previous + 1, totalPages))}
        />
      ) : null}
    </div>
  )
}
