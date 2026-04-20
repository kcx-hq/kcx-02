import type { AdminCloudConnectionListItem } from "@/modules/cloud-connections/admin-cloud-connections.api"
import awsIcon from "@/assets/icons/aws.svg"
import azureIcon from "@/assets/icons/azure.svg"
import gcpIcon from "@/assets/icons/gcp.svg"
import oracleIcon from "@/assets/icons/oracle.svg"
import {
  formatCloudAccountId,
  formatCompactDateTime,
  formatModeLabel,
  formatStatusLabel,
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

const PROVIDER_ICON_BY_CODE: Record<string, string> = {
  aws: awsIcon,
  azure: azureIcon,
  gcp: gcpIcon,
  google_cloud: gcpIcon,
  oracle: oracleIcon,
}

const BILLING_SOURCE_TOKEN_BY_TYPE: Record<string, string> = {
  manual_upload: "Local",
  s3: "S3",
  aws_data_exports_cur2: "Cloud-Auto",
  aws_data_exports_manual: "Cloud-Manual",
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
    <div className="kcx-admin-table-scroll overflow-auto">
      <table className="min-w-[1080px] w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
            <th className="px-3.5 py-3">
              <SortableHeader label="INTEGRATION" field="displayName" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </th>
            <th className="px-3.5 py-3">Client</th>
            <th className="px-3 py-3">Provider</th>
            <th className="px-3.5 py-3 text-center">
              <SortableHeader label="MODE" field="mode" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </th>
            <th className="px-3 py-3">
              <SortableHeader label="CLOUD ACCOUNT" field="cloudAccountId" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </th>
            <th className="px-3.5 py-3 text-center">
              <SortableHeader label="STATUS" field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </th>
            <th className="px-3.5 py-3 text-center">Bill Source</th>
            <th className="pl-[1.875rem] pr-3.5 py-3">Datetime</th>
            <th className="px-3.5 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="px-3.5 py-6 text-muted-foreground" colSpan={9}>
                Loading cloud connections...
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td className="px-3.5 py-6 text-muted-foreground" colSpan={9}>
                No cloud connections found for the current filters.
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const statusBadge = getStatusBadge(item.status)
              const modeLabel = formatModeLabel(item.mode)
              const statusLabel = formatStatusLabel(item.status)
              const providerCode = String(item.provider.code || "").trim().toLowerCase()
              const providerIcon = PROVIDER_ICON_BY_CODE[providerCode] ?? null
              const cloudAccount = formatCloudAccountId(item.cloudAccountId)
              const payerAccount = formatCloudAccountId(item.payerAccountId)
              const payerSubtext =
                item.payerAccountId && item.payerAccountId !== item.cloudAccountId ? `Payer: ${payerAccount}` : null
              const sourceTypeRaw = String(item.billingSource.sourceType || "").trim()
              const sourceTypeKey = sourceTypeRaw.toLowerCase()
              const sourceToken = BILLING_SOURCE_TOKEN_BY_TYPE[sourceTypeKey] || sourceTypeRaw || "-"
              const billingSourceTooltip = item.billingSource.sourceType || sourceToken || "Bill source"

              return (
                <tr
                  key={item.id}
                  tabIndex={0}
                  className="cursor-pointer border-b border-[color:rgba(15,23,42,0.12)] transition-colors hover:bg-[color:rgba(15,23,42,0.03)] focus-visible:bg-[color:rgba(15,23,42,0.03)] focus-visible:outline-none"
                  onClick={() => onView(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onView(item.id)
                    }
                  }}
                  aria-label={`Open cloud connection details for ${item.displayName}`}
                >
                  <td className="px-3.5 py-3">
                    <div className="font-semibold text-[color:rgba(15,23,42,0.88)]">{item.displayName}</div>
                  </td>
                  <td className="px-3.5 py-3">
                    <div className="text-[color:rgba(15,23,42,0.78)]">{item.tenant.name}</div>
                    <div className="mt-0.5 text-xs text-[color:rgba(15,23,42,0.55)]">{item.tenant.slug}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 text-[color:rgba(15,23,42,0.78)]" title={item.provider.name}>
                      {providerIcon ? (
                        <img
                          src={providerIcon}
                          alt={`${item.provider.name} icon`}
                          className="h-4 w-4 shrink-0 object-contain"
                        />
                      ) : (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-[color:rgba(15,23,42,0.08)] px-1 text-[10px] font-semibold uppercase text-[color:rgba(15,23,42,0.58)]">
                          {item.provider.code}
                        </span>
                      )}
                      <span className="text-xs font-semibold uppercase tracking-[0.06em]">{item.provider.code}</span>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    <Badge variant="outline">{modeLabel}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-mono text-[12px] tracking-[0.03em] text-[color:rgba(15,23,42,0.82)]">{cloudAccount}</div>
                    {payerSubtext ? (
                      <div className="mt-0.5 text-xs text-[color:rgba(15,23,42,0.55)] font-mono tracking-[0.02em]">{payerSubtext}</div>
                    ) : null}
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    <div className="inline-flex flex-col items-center">
                      <Badge variant={statusBadge.variant} className={statusBadge.className}>
                        {statusLabel}
                      </Badge>
                      {item.errorMessage ? (
                        <div className="mt-1 max-w-[220px] truncate text-xs text-[color:rgba(220,38,38,0.85)]" title={item.errorMessage}>
                          {item.errorMessage}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    {item.billingSource.linked ? (
                      <div className="inline-flex flex-col items-center" title={billingSourceTooltip}>
                        <Badge variant="subtle">Linked</Badge>
                        <div className="mt-1 max-w-[100px] truncate text-xs text-[color:rgba(15,23,42,0.55)]">
                          {sourceToken}
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
                  <td className="px-3.5 py-3 text-[color:rgba(15,23,42,0.72)]">
                    <div className="max-w-[130px] truncate whitespace-nowrap">{formatCompactDateTime(item.timestamps.updatedAt)}</div>
                  </td>
                  <td className="px-3.5 py-3 text-right">
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
