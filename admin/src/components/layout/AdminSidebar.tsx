import { NavLink } from "react-router-dom"
import { LayoutGrid } from "lucide-react"
import type { ReactNode } from "react"

import { ADMIN_NAV } from "@/lib/nav"
import { cn } from "@/lib/utils"

export function AdminSidebar({ mobile, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const isMobile = Boolean(mobile)

  return (
    <div
      className={cn(
        "relative flex flex-col",
        isMobile
          ? "h-full px-4 pb-6"
          : "fixed bottom-0 left-0 top-0 z-30 w-[240px] bg-[linear-gradient(180deg,#0B1B2B_0%,#08192A_65%,#071625_100%)] pt-16 shadow-[0_18px_50px_-26px_rgba(2,6,23,0.65)] ring-1 ring-[color:rgba(148,163,184,0.14)]"
      )}
    >
      {!isMobile ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-16 h-10 bg-[radial-gradient(120%_70%_at_15%_0%,rgba(47,125,106,0.22)_0%,transparent_55%)]" />
        </>
      ) : null}

      <div className={cn(isMobile ? "mt-6" : "mt-5 px-3 pt-3")}>
        <nav className={cn("grid", isMobile ? "gap-1.5" : "gap-1")}>
          <SidebarItem
            to="/"
            label="Overview"
            icon={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}
            isMobile={isMobile}
            onNavigate={onNavigate}
            end
          />

          {ADMIN_NAV.map((item) => (
            <SidebarItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={<item.Icon className="h-4 w-4" />}
              isMobile={isMobile}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </div>
    </div>
  )
}

function SidebarItem({
  to,
  label,
  icon,
  isMobile,
  onNavigate,
  end,
}: {
  to: string
  label: string
  icon: ReactNode
  isMobile: boolean
  onNavigate?: () => void
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      end={end}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-2.5 border-l-2 border-transparent px-2.5 py-2.5 text-left transition-[background,transform,color] duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(62,138,118,0.55)]",
          isMobile ? "hover:bg-white/10 active:bg-white/12" : "hover:bg-white/6 active:bg-white/8",
          isActive &&
            "border-l-[color:rgba(47,125,106,0.92)] bg-[linear-gradient(90deg,rgba(47,125,106,0.20),rgba(255,255,255,0.06))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={cn("text-white/80 transition-colors group-hover:text-white/90", isActive && "text-white")}>{icon}</span>

          <span className="min-w-0">
            <span className={cn("block truncate text-[13px] font-semibold tracking-[-0.01em] text-white/90", isActive && "text-white")}>
              {label}
            </span>
          </span>
        </>
      )}
    </NavLink>
  )
}
