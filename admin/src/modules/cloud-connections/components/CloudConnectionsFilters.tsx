import type {
  AdminCloudConnectionsListQuery,
  AdminCloudIntegrationMode,
  AdminCloudIntegrationStatus,
} from "@/modules/cloud-connections/admin-cloud-connections.api"
import { CalendarDays, ChevronDown } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/shared/ui/button"

export type BillingSourceLinkedFilter = "" | "true" | "false"
const FILTER_LABEL_CLASS = "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground leading-none"
const FILTER_CONTROL_CLASS =
  "h-9 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-2.5 text-[13px] outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"

type CloudConnectionsFiltersProps = {
  provider: string
  mode: AdminCloudIntegrationMode | ""
  status: AdminCloudIntegrationStatus | ""
  billingSourceLinked: BillingSourceLinkedFilter
  dateFrom: string
  dateTo: string
  providerOptions: Array<{ value: string; label: string }>
  onProviderChange: (value: string) => void
  onModeChange: (value: AdminCloudIntegrationMode | "") => void
  onStatusChange: (value: AdminCloudIntegrationStatus | "") => void
  onBillingSourceLinkedChange: (value: BillingSourceLinkedFilter) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
}

export function CloudConnectionsFilters({
  provider,
  mode,
  status,
  billingSourceLinked,
  dateFrom,
  dateTo,
  providerOptions,
  onProviderChange,
  onModeChange,
  onStatusChange,
  onBillingSourceLinkedChange,
  onDateFromChange,
  onDateToChange,
}: CloudConnectionsFiltersProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [draftDateFrom, setDraftDateFrom] = useState(dateFrom)
  const [draftDateTo, setDraftDateTo] = useState(dateTo)

  useEffect(() => {
    setDraftDateFrom(dateFrom)
  }, [dateFrom])

  useEffect(() => {
    setDraftDateTo(dateTo)
  }, [dateTo])

  const dateRangeLabel = useMemo(() => {
    if (!dateFrom && !dateTo) return "All dates"
    if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`
    if (dateFrom) return `From ${dateFrom}`
    return `To ${dateTo}`
  }, [dateFrom, dateTo])

  const applyDateRange = () => {
    onDateFromChange(draftDateFrom)
    onDateToChange(draftDateTo)
    setDatePickerOpen(false)
  }

  const cancelDateRange = () => {
    setDraftDateFrom(dateFrom)
    setDraftDateTo(dateTo)
    setDatePickerOpen(false)
  }

  return (
    <div className="flex min-w-max flex-nowrap items-center gap-2.5">
      <label className="w-[150px] shrink-0">
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

      <label className="w-[150px] shrink-0">
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

      <label className="w-[150px] shrink-0">
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

      <label className="w-[150px] shrink-0">
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

      <div className="relative w-[250px] shrink-0">
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-2.5 text-[13px] text-[color:rgba(15,23,42,0.9)] transition-colors hover:border-[color:rgba(15,23,42,0.24)]"
            onClick={() => setDatePickerOpen((open) => !open)}
            aria-expanded={datePickerOpen ? "true" : "false"}
            aria-label="Select date range"
          >
            <span className="inline-flex min-w-0 items-center gap-2 truncate">
              <CalendarDays className="h-4 w-4 shrink-0 text-[color:rgba(47,125,106,0.92)]" />
              <span className="truncate">{dateRangeLabel}</span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-[color:rgba(15,23,42,0.55)] transition-transform ${datePickerOpen ? "rotate-180" : ""}`}
            />
          </button>

          {datePickerOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.45rem)] z-40 w-[min(94vw,360px)] rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white p-3 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.42)]">
              <div className="space-y-3">
                <label className="block">
                  <div className={FILTER_LABEL_CLASS}>From</div>
                  <input
                    type="date"
                    value={draftDateFrom}
                    onChange={(event) => setDraftDateFrom(event.target.value)}
                    className="mt-1.5 h-9 w-full rounded-md border border-[color:rgba(15,23,42,0.14)] bg-white px-2.5 text-[13px] outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
                    aria-label="Date range from"
                  />
                </label>
                <label className="block">
                  <div className={FILTER_LABEL_CLASS}>To</div>
                  <input
                    type="date"
                    value={draftDateTo}
                    onChange={(event) => setDraftDateTo(event.target.value)}
                    className="mt-1.5 h-9 w-full rounded-md border border-[color:rgba(15,23,42,0.14)] bg-white px-2.5 text-[13px] outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
                    aria-label="Date range to"
                  />
                </label>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button type="button" size="sm" variant="outline" onClick={cancelDateRange}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={applyDateRange}>
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
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
