import type {
  AdminCloudConnectionsListQuery,
  AdminCloudIntegrationMode,
  AdminCloudIntegrationStatus,
} from "@/modules/cloud-connections/admin-cloud-connections.api"
import { Button } from "@/shared/ui/button"

export type BillingSourceLinkedFilter = "" | "true" | "false"

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
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <label className="xl:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Search</div>
          <input
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
            placeholder="Integration, account, client, slug"
          />
        </label>

        <label>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Provider</div>
          <select
            value={provider}
            onChange={(event) => onProviderChange(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
          >
            <option value="">All</option>
            {providerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Mode</div>
          <select
            value={mode}
            onChange={(event) => onModeChange(event.target.value as AdminCloudIntegrationMode | "")}
            className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
          >
            <option value="">All</option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>
        </label>

        <label>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</div>
          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value as AdminCloudIntegrationStatus | "")}
            className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
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

        <label>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Billing Source</div>
          <select
            value={billingSourceLinked}
            onChange={(event) => onBillingSourceLinkedChange(event.target.value as BillingSourceLinkedFilter)}
            className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
          >
            <option value="">All</option>
            <option value="true">Linked</option>
            <option value="false">Missing</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <label>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Date From</div>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
          />
        </label>

        <label>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Date To</div>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
          />
        </label>

        <div className="xl:col-span-5 flex items-end justify-end">
          <Button type="button" variant="outline" onClick={onReset}>
            Reset Filters
          </Button>
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

