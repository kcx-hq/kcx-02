type AnnouncementsSummaryStripProps = {
  total: number
  published: number
  draft: number
  archived: number
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-h-[108px] px-4 py-4">
      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.52)]">{label}</div>
      <div className="mt-2 text-[2.35rem] font-semibold leading-none tracking-[-0.03em] text-[color:rgba(15,23,42,0.88)]">{value}</div>
    </div>
  )
}

export function AnnouncementsSummaryStrip({ total, published, draft, archived }: AnnouncementsSummaryStripProps) {
  return (
    <div className="grid gap-0 border-y border-[color:rgba(15,23,42,0.08)] sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:border-r sm:border-[color:rgba(15,23,42,0.08)]">
        <StatCell label="Total Announcements" value={total} />
      </div>
      <div className="lg:border-r lg:border-[color:rgba(15,23,42,0.08)]">
        <StatCell label="Published" value={published} />
      </div>
      <div className="sm:border-r sm:border-[color:rgba(15,23,42,0.08)]">
        <StatCell label="Draft" value={draft} />
      </div>
      <StatCell label="Archived" value={archived} />
    </div>
  )
}
