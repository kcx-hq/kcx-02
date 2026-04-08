import type { BillingUploadsListRow } from "@/modules/billing-uploads/admin-billing-uploads.api"
import { formatCompactDateTime, getStatusBadge } from "@/modules/billing-uploads/billing-uploads.formatters"
import { UploadProgressIndicator } from "@/modules/billing-uploads/components/UploadProgressIndicator"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"

type BillingUploadsTableProps = {
  loading: boolean
  items: BillingUploadsListRow[]
  currentPage: number
  pageSize: number
  serialStartIndex?: number
  onView: (runId: number) => void
}

export function BillingUploadsTable({
  loading,
  items,
  currentPage,
  pageSize,
  serialStartIndex,
  onView,
}: BillingUploadsTableProps) {
  return (
    <div className="overflow-auto rounded-xl ring-1 ring-[color:rgba(15,23,42,0.08)]">
      <table className="min-w-[1040px] w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
            <th className="w-20 px-3 py-3 text-center">Sr. No.</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">File</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Progress</th>
            <th className="px-4 py-3">Datetime</th>
            <th className="w-16 px-3 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="px-4 py-6 text-muted-foreground" colSpan={8}>
                Loading billing uploads...
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-muted-foreground" colSpan={8}>
                No billing uploads found for the current filters.
              </td>
            </tr>
          ) : (
            items.map((item, rowIndexOnPage) => {
              const badge = getStatusBadge(item.status.normalized)
              const serialBase = typeof serialStartIndex === "number" ? serialStartIndex : (currentPage - 1) * pageSize
              const serialNumber = serialBase + rowIndexOnPage + 1
              const userName = item.client.userName?.trim() || null
              const companyName = item.client.companyName?.trim() || null
              const normalizedStatus = item.status?.normalized ?? null
              const normalizedClientName = item.client.name?.trim()
              const fallbackName =
                normalizedClientName && normalizedClientName.toLowerCase() !== "unknown"
                  ? normalizedClientName
                  : "Unknown Client"
              const primaryClientText = userName || companyName || fallbackName
              const secondaryClientText = userName && companyName ? companyName : null

              return (
                <tr
                  key={item.runId}
                  tabIndex={0}
                  className="cursor-pointer border-t border-[color:rgba(15,23,42,0.06)] transition-colors hover:bg-[color:rgba(15,23,42,0.03)] focus-visible:bg-[color:rgba(15,23,42,0.03)] focus-visible:outline-none"
                  onClick={() => onView(item.runId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onView(item.runId)
                    }
                  }}
                  aria-label={`Open upload details for run ${item.runId}`}
                >
                  <td className="w-20 px-3 py-3 text-center font-medium text-[color:rgba(15,23,42,0.84)]">{serialNumber}</td>
                  <td className="px-4 py-3">
                    <div className="max-w-[220px] truncate text-[color:rgba(15,23,42,0.78)]">{primaryClientText}</div>
                    {secondaryClientText ? (
                      <div className="mt-0.5 max-w-[220px] truncate text-xs text-[color:rgba(15,23,42,0.55)]">
                        {secondaryClientText}
                      </div>
                    ) : null}
                  </td>
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
                    <UploadProgressIndicator status={normalizedStatus} progressPercent={item.progress?.percent} />
                  </td>
                  <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">
                    <div className="max-w-[130px] truncate whitespace-nowrap">{formatCompactDateTime(item.startedAt)}</div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-[color:rgba(15,23,42,0.55)]"
                      aria-label="Actions coming soon"
                      title="Actions coming soon"
                      onClick={(event) => {
                        event.stopPropagation()
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.stopPropagation()
                        }
                      }}
                    >
                      ...
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
