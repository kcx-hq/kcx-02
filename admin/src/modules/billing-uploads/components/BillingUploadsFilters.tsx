import type { BillingUploadNormalizedStatus } from "@/modules/billing-uploads/admin-billing-uploads.api"

export type BillingSourceTypeFilter = "" | "manual_upload" | "s3" | "aws_data_exports_cur2" | "aws_data_exports_manual"

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
          className="mt-1.5 h-10 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm text-[color:rgba(15,23,42,0.88)] placeholder:text-[color:rgba(15,23,42,0.48)] outline-none ring-[color:rgba(15,23,42,0.14)] focus:border-[color:rgba(15,23,42,0.24)] focus:ring-2"
          placeholder="Search by Sr. No., client, source, file, status"
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
          <option value="manual_upload">Local</option>
          <option value="s3">S3 Bucket</option>
          <option value="aws_data_exports_cur2">Cloud-Auto</option>
          <option value="aws_data_exports_manual">Cloud-Manual</option>
        </select>
      </label>

      <div className="xl:col-span-2">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Date Range</div>
        <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="h-10 w-full min-w-0 rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
            aria-label="Date range start"
          />
          <span className="text-xs text-[color:rgba(15,23,42,0.45)]">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className="h-10 w-full min-w-0 rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
            aria-label="Date range end"
          />
        </div>
      </div>
    </div>
  )
}
