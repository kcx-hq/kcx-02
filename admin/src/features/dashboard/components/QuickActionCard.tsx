import type * as React from "react"
import { NavLink } from "react-router-dom"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export function QuickActionCard({
  to,
  title,
  description,
  icon,
}: {
  to: string
  title: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <NavLink
      to={to}
      className={cn(
        "kcx-admin-card group relative overflow-hidden p-5 transition-transform",
        "hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(62,138,118,0.55)]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-primary-soft ring-1 ring-[color:rgba(47,125,106,0.18)]">
              {icon}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-[-0.01em]">{title}</div>
              <div className="truncate text-xs text-muted-foreground">{description}</div>
            </div>
          </div>
        </div>

        <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-white ring-1 ring-[color:rgba(15,23,42,0.10)] transition-colors group-hover:bg-[color:rgba(15,23,42,0.03)]">
          <ChevronRight className="h-5 w-5 text-[color:rgba(15,23,42,0.72)]" aria-hidden="true" />
        </span>
      </div>

      <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_center,rgba(47,125,106,0.22),transparent_70%)] opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
    </NavLink>
  )
}
