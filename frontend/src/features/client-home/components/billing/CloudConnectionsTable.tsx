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
        <thead className="bg-[color:var(--bg-surface)]">
          <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
            <th className="border-b border-[color:var(--border-light)] px-3 py-2.5">Connection Name</th>
            <th className="border-b border-[color:var(--border-light)] px-3 py-2.5">Provider</th>
            <th className="border-b border-[color:var(--border-light)] px-3 py-2.5">Account</th>
            <th className="border-b border-[color:var(--border-light)] px-3 py-2.5">Last Checked</th>
            <th className="border-b border-[color:var(--border-light)] px-3 py-2.5">Last Ingest / Status Message</th>
            <th className="border-b border-[color:var(--border-light)] px-3 py-2.5">Status</th>
            <th className="border-b border-[color:var(--border-light)] px-3 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        {isLoading ? (
          <tbody>
            <tr>
              <td className="px-3 py-6 text-text-secondary" colSpan={7}>Loading cloud connections...</td>
            </tr>
          </tbody>
        ) : isError ? (
          <tbody>
            <tr>
              <td className="px-3 py-6" colSpan={7}>
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
              <td className="px-3 py-6 text-text-secondary" colSpan={7}>
                {totalRows === 0
                  ? "No cloud connections found. Connect AWS below to create your first billing integration."
                  : "No cloud connections match your search."}
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-[color:var(--bg-surface)]">
                <td className="border-b border-[color:var(--border-light)] px-3 py-3">
                  <span className="font-medium text-brand-primary">{row.connectionName}</span>
                </td>
                <td className="border-b border-[color:var(--border-light)] px-3 py-3 text-text-primary">{row.provider}</td>
                <td className="border-b border-[color:var(--border-light)] px-3 py-3 text-text-primary">
                  {row.cloudAccountId || "-"}
                </td>
                <td className="border-b border-[color:var(--border-light)] px-3 py-3 text-text-primary">{row.lastChecked}</td>
                <td className="border-b border-[color:var(--border-light)] px-3 py-3 text-text-primary">{row.lastIngestOrMessage}</td>
                <td className="border-b border-[color:var(--border-light)] px-3 py-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-md",
                      row.statusLabel === "HEALTHY"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : row.statusLabel === "WARNING"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : row.statusLabel === "FAILED"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary",
                    )}
                  >
                    {row.statusLabel}
                  </Badge>
                </td>
                <td className="border-b border-[color:var(--border-light)] px-3 py-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-md"
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
