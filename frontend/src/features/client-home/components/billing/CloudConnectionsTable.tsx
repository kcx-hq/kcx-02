import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
}: CloudConnectionsTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-[color:var(--border-light)] bg-white">
      <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
            <th className="border-b border-[color:var(--border-light)] px-4 py-3">Name</th>
            <th className="border-b border-[color:var(--border-light)] px-4 py-3">Cloud Provider</th>
            <th className="border-b border-[color:var(--border-light)] px-4 py-3">Last Checked</th>
            <th className="border-b border-[color:var(--border-light)] px-4 py-3">Last Success / Message</th>
            <th className="border-b border-[color:var(--border-light)] px-4 py-3">Request Activity</th>
            <th className="border-b border-[color:var(--border-light)] px-4 py-3">Status</th>
            <th className="border-b border-[color:var(--border-light)] px-4 py-3 text-right">Action</th>
          </tr>
        </thead>

        {isLoading ? (
          <tbody>
            <tr>
              <td className="px-4 py-8 text-text-secondary" colSpan={7}>
                Loading cloud connections...
              </td>
            </tr>
          </tbody>
        ) : isError ? (
          <tbody>
            <tr>
              <td className="px-4 py-8" colSpan={7}>
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
              <td className="px-4 py-8" colSpan={7}>
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
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-[color:var(--bg-surface)]">
                <td className="border-b border-[color:var(--border-light)] px-4 py-3 text-[0.95rem] font-semibold text-[#226176]">
                  {row.connectionName}
                </td>
                <td className="border-b border-[color:var(--border-light)] px-4 py-3 text-[0.95rem] text-text-primary">{row.provider}</td>
                <td className="border-b border-[color:var(--border-light)] px-4 py-3 text-[0.95rem] text-text-primary">{row.lastChecked}</td>
                <td className="border-b border-[color:var(--border-light)] px-4 py-3 text-[0.95rem] text-text-primary">{row.lastIngestOrMessage}</td>
                <td className="border-b border-[color:var(--border-light)] px-4 py-3">
                  <RequestActivitySparkline status={row.statusLabel} />
                </td>
                <td className="border-b border-[color:var(--border-light)] px-4 py-3">
                  <Badge variant="outline" className={cn("rounded-sm px-1.5 py-0 text-[11px]", statusBadgeClass(row.statusLabel))}>
                    {row.statusLabel}
                  </Badge>
                </td>
                <td className="border-b border-[color:var(--border-light)] px-4 py-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-md"
                    disabled={dashboardActionLoading}
                    onClick={() => onOpenDashboard(row.id)}
                  >
                    {dashboardConnectionActionId === row.id ? "Opening..." : "Dashboard"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>

    </div>
  )
}
