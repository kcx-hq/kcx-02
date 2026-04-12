import { AlertCircle, Archive, CheckCircle2, Clock3, Ticket } from "lucide-react"

type TicketStatsRowProps = {
  total: number
  open: number
  underReview: number
  resolved: number
  closed: number
}

export function TicketStatsRow({ total, open, underReview, resolved, closed }: TicketStatsRowProps) {
  const stats = [
    {
      label: "Total Tickets",
      value: total,
      helper: "All issues logged",
      icon: Ticket,
      tone: "bg-[rgba(55,145,116,0.12)] text-[color:#24755d]",
    },
    {
      label: "Open",
      value: open,
      helper: "Awaiting response",
      icon: AlertCircle,
      tone: "bg-[rgba(214,135,26,0.14)] text-[color:#9e5a00]",
    },
    {
      label: "Under Review",
      value: underReview,
      helper: "KCX reviewing",
      icon: Clock3,
      tone: "bg-[rgba(53,122,196,0.14)] text-[color:#1f5f9f]",
    },
    {
      label: "Resolved",
      value: resolved,
      helper: "Completed items",
      icon: CheckCircle2,
      tone: "bg-[rgba(55,145,116,0.14)] text-[color:#1f7d60]",
    },
    {
      label: "Closed",
      value: closed,
      helper: "Archived tickets",
      icon: Archive,
      tone: "bg-[rgba(92,105,117,0.12)] text-[color:#445362]",
    },
  ] as const

  return (
    <section className="overflow-x-auto">
      <div className="flex min-w-[840px] items-stretch">
        {stats.map((item, index) => {
        const Icon = item.icon
        return (
          <article
            key={item.label}
            className={`flex min-w-0 flex-1 items-start justify-between gap-3 px-4 py-2 ${index !== 0 ? "border-l border-[color:var(--border-light)]" : ""}`}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{item.label}</p>
              <p className="mt-2 text-[34px] font-semibold leading-none text-text-primary">{item.value}</p>
              <p className="mt-2 text-xs text-text-secondary">{item.helper}</p>
            </div>
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}>
              <Icon className="h-4 w-4" />
            </span>
          </article>
        )
      })}
      </div>
    </section>
  )
}
