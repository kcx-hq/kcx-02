import type {
  AdminCloudConnectionsListQuery,
  AdminCloudIntegrationMode,
  AdminCloudIntegrationStatus,
} from "@/modules/cloud-connections/admin-cloud-connections.api"
import { RotateCcw } from "lucide-react"
import { Button } from "@/shared/ui/button"

export type BillingSourceLinkedFilter = "" | "true" | "false"
const FILTER_LABEL_CLASS = "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground leading-none"
const FILTER_CONTROL_CLASS =
  "mt-1.5 h-9 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-2.5 text-[13px] outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"

type CloudConnectionsFiltersProps = {
  searchInput: string
  provider: string
  mode: AdminCloudIntegrationMode | ""
  status: AdminCloudIntegrationStatus | ""
  billingSourceLinked: BillingSourceLinkedFilter
  dateFrom: string
  dateTo: string
  providerOptions: Array<{ value: string; label: string }>
  onSearchInputChange: (value: string) => void
  onProviderChange: (value: string) => void
  onModeChange: (value: AdminCloudIntegrationMode | "") => void
  onStatusChange: (value: AdminCloudIntegrationStatus | "") => void
  onBillingSourceLinkedChange: (value: BillingSourceLinkedFilter) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onReset: () => void
}

export function CloudConnectionsFilters({
  searchInput,
  provider,
  mode,
  status,
  billingSourceLinked,
  dateFrom,
  dateTo,
  providerOptions,
  onSearchInputChange,
  onProviderChange,
  onModeChange,
  onStatusChange,
  onBillingSourceLinkedChange,
  onDateFromChange,
  onDateToChange,
  onReset,
}: CloudConnectionsFiltersProps) {
  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-16">
        <label className="xl:col-span-3 min-w-0">
          <div className={FILTER_LABEL_CLASS}>Search</div>
          <input
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            className={FILTER_CONTROL_CLASS}
            placeholder="Integration, account, client, slug"
          />
        </label>

        <label className="xl:col-span-2 min-w-0">
          <div className={FILTER_LABEL_CLASS}>Provider</div>
          <select
            value={provider}
            onChange={(event) => onProviderChange(event.target.value)}
            className={FILTER_CONTROL_CLASS}
          >
            <option value="">All</option>
            {providerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="xl:col-span-2 min-w-0">
          <div className={FILTER_LABEL_CLASS}>Mode</div>
          <select
            value={mode}
            onChange={(event) => onModeChange(event.target.value as AdminCloudIntegrationMode | "")}
            className={FILTER_CONTROL_CLASS}
          >
            <option value="">All</option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>
        </label>

        <label className="xl:col-span-2 min-w-0">
          <div className={FILTER_LABEL_CLASS}>Status</div>
          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value as AdminCloudIntegrationStatus | "")}
            className={FILTER_CONTROL_CLASS}
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="connecting">Connecting</option>
            <option value="awaiting_validation">Awaiting Validation</option>
            <option value="active">Active</option>
            <option value="active_with_warnings">Active With Warnings</option>
            <option value="failed">Failed</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>

        <label className="xl:col-span-2 min-w-0">
          <div className={FILTER_LABEL_CLASS}>Bill Source</div>
          <select
            value={billingSourceLinked}
            onChange={(event) => onBillingSourceLinkedChange(event.target.value as BillingSourceLinkedFilter)}
            className={FILTER_CONTROL_CLASS}
          >
            <option value="">All</option>
            <option value="true">Linked</option>
            <option value="false">Missing</option>
          </select>
        </label>

        <div className="md:col-span-2 xl:col-span-4 min-w-0">
          <div className={FILTER_LABEL_CLASS}>Date Range</div>
          <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => onDateFromChange(event.target.value)}
              className="h-9 w-full min-w-0 rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-2.5 text-[13px] outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
              aria-label="Date range start"
            />
            <span className="text-[11px] text-[color:rgba(15,23,42,0.45)]">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => onDateToChange(event.target.value)}
              className="h-9 w-full min-w-0 rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-2.5 text-[13px] outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
              aria-label="Date range end"
            />
          </div>
        </div>

        <div className="min-w-0">
          <div className={FILTER_LABEL_CLASS} aria-hidden="true">
            &nbsp;
          </div>
          <div className="mt-1.5 flex justify-end">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9"
              onClick={onReset}
              aria-label="Reset filters"
              title="Reset filters"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const buildListQuery = (input: {
  page: number
  limit: number
  search: string
  provider: string
  mode: AdminCloudIntegrationMode | ""
  status: AdminCloudIntegrationStatus | ""
  billingSourceLinked: BillingSourceLinkedFilter
  dateFrom: string
  dateTo: string
  sortBy: NonNullable<AdminCloudConnectionsListQuery["sortBy"]>
  sortOrder: NonNullable<AdminCloudConnectionsListQuery["sortOrder"]>
}): AdminCloudConnectionsListQuery => {
  return {
    page: input.page,
    limit: input.limit,
    search: input.search || undefined,
    provider: input.provider || undefined,
    mode: input.mode || undefined,
    status: input.status || undefined,
    billingSourceLinked: input.billingSourceLinked || undefined,
    dateFrom: input.dateFrom || undefined,
    dateTo: input.dateTo || undefined,
    sortBy: input.sortBy,
    sortOrder: input.sortOrder,
  }
}
