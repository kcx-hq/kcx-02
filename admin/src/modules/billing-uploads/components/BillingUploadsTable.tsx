import type { BillingUploadsListRow } from "@/modules/billing-uploads/admin-billing-uploads.api"
import { formatDateTime, getStatusBadge } from "@/modules/billing-uploads/billing-uploads.formatters"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"

type BillingUploadsTableProps = {
  loading: boolean
  items: BillingUploadsListRow[]
  onView: (runId: number) => void
}

export function BillingUploadsTable({ loading, items, onView }: BillingUploadsTableProps) {
  return (
    <div className="overflow-auto rounded-xl ring-1 ring-[color:rgba(15,23,42,0.08)]">
      <table className="min-w-[1150px] w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
            <th className="px-4 py-3">Run ID</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">File</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Progress</th>
            <th className="px-4 py-3">Started At</th>
            <th className="px-4 py-3">Finished At</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
                Loading billing uploads...
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
                No billing uploads found for the current filters.
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const badge = getStatusBadge(item.status.normalized)
              return (
                <tr key={item.runId} className="border-t border-[color:rgba(15,23,42,0.06)]">
                  <td className="px-4 py-3 font-semibold text-[color:rgba(15,23,42,0.88)]">#{item.runId}</td>
                  <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.client.name}</td>
                  <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">{item.source.label}</td>
                  <td className="px-4 py-3 text-[color:rgba(15,23,42,0.78)]">
                    <div className="max-w-[260px] truncate" title={item.file.name}>
                      {item.file.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={badge.variant} className={badge.className}>
                      {item.status.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-[120px]">
                      <div className="flex items-center justify-between text-xs text-[color:rgba(15,23,42,0.68)]">
                        <span>{item.progress.percent}%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[color:rgba(15,23,42,0.08)]">
                        <div
                          className="h-full rounded-full bg-[color:rgba(47,125,106,0.88)]"
                          style={{ width: `${Math.max(0, Math.min(100, item.progress.percent))}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">{formatDateTime(item.startedAt)}</td>
                  <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">{formatDateTime(item.finishedAt)}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="secondary" onClick={() => onView(item.runId)}>
                      View
                    </Button>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
