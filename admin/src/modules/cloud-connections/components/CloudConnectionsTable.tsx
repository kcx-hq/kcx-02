import type { AdminCloudConnectionListItem } from "@/modules/cloud-connections/admin-cloud-connections.api"
import {
  formatDateTime,
  formatModeLabel,
  formatStatusLabel,
  getLastActivity,
  getStatusBadge,
} from "@/modules/cloud-connections/cloud-connections.formatters"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"

type SortBy =
  | "displayName"
  | "status"
  | "mode"
  | "cloudAccountId"
  | "lastValidatedAt"
  | "connectedAt"
  | "createdAt"
  | "updatedAt"

type CloudConnectionsTableProps = {
  loading: boolean
  items: AdminCloudConnectionListItem[]
  sortBy: SortBy
  sortOrder: "asc" | "desc"
  onSort: (sortBy: SortBy) => void
  onView: (integrationId: string) => void
}

function SortableHeader({
  label,
  field,
  sortBy,
  sortOrder,
  onSort,
}: {
  label: string
  field: SortBy
  sortBy: SortBy
  sortOrder: "asc" | "desc"
  onSort: (sortBy: SortBy) => void
}) {
  const active = sortBy === field
  const arrow = !active ? "" : sortOrder === "asc" ? " ^" : " v"

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-[color:rgba(15,23,42,0.88)]"
      onClick={() => onSort(field)}
    >
      <span>{label}</span>
      <span>{arrow}</span>
    </button>
  )
}

export function CloudConnectionsTable({
  loading,
  items,
  sortBy,
  sortOrder,
  onSort,
  onView,
}: CloudConnectionsTableProps) {
  return (
    <div className="overflow-auto rounded-xl ring-1 ring-[color:rgba(15,23,42,0.08)]">
      <table className="min-w-[1380px] w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
            <th className="px-4 py-3">
              <SortableHeader label="Integration" field="displayName" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Provider</th>
            <th className="px-4 py-3">
              <SortableHeader label="Mode" field="mode" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </th>
            <th className="px-4 py-3">
              <SortableHeader label="Cloud Account" field="cloudAccountId" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </th>
            <th className="px-4 py-3">
              <SortableHeader label="Status" field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </th>
            <th className="px-4 py-3">Billing Source</th>
            <th className="px-4 py-3">
              <SortableHeader
                label="Last Validated"
                field="lastValidatedAt"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </th>
            <th className="px-4 py-3">Last Activity</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="px-4 py-6 text-muted-foreground" colSpan={10}>
                Loading cloud connections...
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-muted-foreground" colSpan={10}>
                No cloud connections found for the current filters.
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const statusBadge = getStatusBadge(item.status)
              const modeLabel = formatModeLabel(item.mode)
              const statusLabel = formatStatusLabel(item.status)
              const lastActivity = formatDateTime(getLastActivity(item))
              const cloudAccount = item.cloudAccountId || "-"
              const payerSubtext =
                item.payerAccountId && item.payerAccountId !== item.cloudAccountId ? `Payer: ${item.payerAccountId}` : null

              return (
                <tr key={item.id} className="border-t border-[color:rgba(15,23,42,0.06)]">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[color:rgba(15,23,42,0.88)]">{item.displayName}</div>
                    <div className="mt-0.5 text-xs text-[color:rgba(15,23,42,0.55)]">{item.detailRecordType}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[color:rgba(15,23,42,0.78)]">{item.tenant.name}</div>
                    <div className="mt-0.5 text-xs text-[color:rgba(15,23,42,0.55)]">{item.tenant.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[color:rgba(15,23,42,0.78)]">{item.provider.name}</div>
                    <div className="mt-0.5 text-xs text-[color:rgba(15,23,42,0.55)]">{item.provider.code}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{modeLabel}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-[12px] text-[color:rgba(15,23,42,0.78)]">{cloudAccount}</div>
                    {payerSubtext ? (
                      <div className="mt-0.5 text-xs text-[color:rgba(15,23,42,0.55)] font-mono">{payerSubtext}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadge.variant} className={statusBadge.className}>
                      {statusLabel}
                    </Badge>
                    {item.errorMessage ? (
                      <div className="mt-1 text-xs text-[color:rgba(220,38,38,0.85)] max-w-[220px] truncate" title={item.errorMessage}>
                        {item.errorMessage}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {item.billingSource.linked ? (
                      <div>
                        <Badge variant="subtle">Linked</Badge>
                        <div className="mt-1 text-xs text-[color:rgba(15,23,42,0.55)]">
                          {item.billingSource.sourceType || "-"} / {item.billingSource.status || "-"}
                        </div>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-[color:rgba(220,38,38,0.28)] bg-[color:rgba(220,38,38,0.10)] text-[color:rgba(153,27,27,0.95)]"
                      >
                        Missing
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">
                    {formatDateTime(item.timestamps.lastValidatedAt)}
                  </td>
                  <td className="px-4 py-3 text-[color:rgba(15,23,42,0.72)]">{lastActivity}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="secondary" onClick={() => onView(item.id)}>
                      View Details
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
