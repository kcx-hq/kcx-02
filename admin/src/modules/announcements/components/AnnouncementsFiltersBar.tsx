import type { ReactNode } from "react"
import type { AnnouncementStatus } from "@/modules/announcements/admin-announcements.api"
import { STATUS_OPTIONS } from "@/modules/announcements/components/announcement.helpers"

type AnnouncementsFiltersBarProps = {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: AnnouncementStatus | ""
  onStatusFilterChange: (value: AnnouncementStatus | "") => void
  sortOrder: "asc" | "desc"
  onSortOrderChange: (value: "asc" | "desc") => void
}

const INPUT_CLASS =
  "h-10 w-full rounded-md border border-[color:rgba(15,23,42,0.14)] bg-white px-3 text-sm text-[color:rgba(15,23,42,0.88)] outline-none transition-colors focus:border-[color:rgba(47,125,106,0.42)]"

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[color:rgba(15,23,42,0.5)]">{label}</div>
      {children}
    </div>
  )
}

export function AnnouncementsFiltersBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortOrder,
  onSortOrderChange,
}: AnnouncementsFiltersBarProps) {
  return (
    <div className="grid gap-3 border-b border-[color:rgba(15,23,42,0.08)] border-t border-[color:rgba(15,23,42,0.08)] py-4 lg:grid-cols-[1.5fr_1fr_1fr]">
      <FilterField label="Search">
        <input className={INPUT_CLASS} value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search title or body" />
      </FilterField>

      <FilterField label="Status">
        <select className={INPUT_CLASS} value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value as AnnouncementStatus | "")}>
          <option value="">All status</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Sort">
        <select className={INPUT_CLASS} value={sortOrder} onChange={(e) => onSortOrderChange(e.target.value as "asc" | "desc")}>
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>
      </FilterField>
    </div>
  )
}
