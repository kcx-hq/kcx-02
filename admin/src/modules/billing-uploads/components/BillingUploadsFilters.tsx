import type { BillingUploadNormalizedStatus } from "@/modules/billing-uploads/admin-billing-uploads.api"

export type BillingSourceTypeFilter = "" | "manual_upload" | "s3" | "aws_data_exports_cur2"

type BillingUploadsFiltersProps = {
  searchInput: string
  status: BillingUploadNormalizedStatus | ""
  sourceType: BillingSourceTypeFilter
  dateFrom: string
  dateTo: string
  onSearchInputChange: (value: string) => void
  onStatusChange: (value: BillingUploadNormalizedStatus | "") => void
  onSourceTypeChange: (value: BillingSourceTypeFilter) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
}

export function BillingUploadsFilters({
  searchInput,
  status,
  sourceType,
  dateFrom,
  dateTo,
  onSearchInputChange,
  onStatusChange,
  onSourceTypeChange,
  onDateFromChange,
  onDateToChange,
}: BillingUploadsFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <label className="xl:col-span-2">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Search</div>
        <input
          value={searchInput}
          onChange={(event) => onSearchInputChange(event.target.value)}
          className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
          placeholder="Run ID, file name, client, uploader"
        />
      </label>

      <label>
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</div>
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as BillingUploadNormalizedStatus | "")}
          className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
        >
          <option value="">All</option>
          <option value="queued">Queued</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="warning">Warning</option>
          <option value="failed">Failed</option>
        </select>
      </label>

      <label>
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Source Type</div>
        <select
          value={sourceType}
          onChange={(event) => onSourceTypeChange(event.target.value as BillingSourceTypeFilter)}
          className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
        >
          <option value="">All</option>
          <option value="manual_upload">Local Upload</option>
          <option value="s3">S3 Upload</option>
          <option value="aws_data_exports_cur2">Cloud Connected</option>
        </select>
      </label>

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
    </div>
  )
}
