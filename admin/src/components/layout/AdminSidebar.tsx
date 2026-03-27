import { NavLink, useNavigate } from "react-router-dom"
import { LayoutGrid } from "lucide-react"

import { ADMIN_NAV } from "@/lib/nav"
import { cn } from "@/lib/utils"

export function AdminSidebar({ mobile, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const navigate = useNavigate()

  return (
    <div className={cn("flex h-full flex-col", mobile ? "px-4 pb-6" : "px-5 pb-8 pt-7")}>
      <button
        type="button"
        onClick={() => navigate("/")}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
          "hover:bg-[color:rgba(255,255,255,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(62,138,118,0.55)]"
        )}
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[color:rgba(62,138,118,0.14)] ring-1 ring-[color:rgba(118,177,157,0.22)] shadow-[0_14px_40px_-26px_rgba(62,138,118,0.6)]">
          <LayoutGrid className="h-5 w-5 text-[color:rgba(172,238,214,0.95)]" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold tracking-[-0.01em]">KCX Admin</span>
          <span className="block truncate text-xs text-text-on-dark-muted">Operations Console</span>
        </span>
      </button>

      <div className="mt-6">
        <div className="px-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:rgba(160,175,188,0.82)]">
          Navigation
        </div>
        <nav className="mt-3 grid gap-1.5">
          <NavLink to="/" onClick={onNavigate} className={({ isActive }) => navItemClass(isActive)} end>
            {({ isActive }) => (
              <>
                <span className={navIconClass(isActive)}>
                  <LayoutGrid className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">Dashboard</span>
                  <span className="block truncate text-xs text-text-on-dark-muted">Overview & actions</span>
                </span>
              </>
            )}
          </NavLink>

          {ADMIN_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={onNavigate} className={({ isActive }) => navItemClass(isActive)}>
              {({ isActive }) => (
                <>
                  <span className={navIconClass(isActive)}>
                    <item.Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{item.label}</span>
                    <span className="block truncate text-xs text-text-on-dark-muted">{item.description}</span>
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto pt-6">
        <div className="kcx-admin-card px-4 py-4">
          <div className="text-sm font-semibold">System Status</div>
          <div className="mt-1 text-xs text-text-on-dark-muted">All services operational</div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs">
            <span className="text-[color:rgba(160,175,188,0.88)]">Latency</span>
            <span className="font-semibold text-[color:rgba(172,238,214,0.95)]">142ms</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function navItemClass(isActive: boolean) {
  return cn(
    "group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(62,138,118,0.55)]",
    isActive
      ? "bg-[linear-gradient(90deg,rgba(62,138,118,0.18),rgba(255,255,255,0.04))] ring-1 ring-[color:rgba(118,177,157,0.24)]"
      : "hover:bg-[color:rgba(255,255,255,0.05)] ring-1 ring-transparent hover:ring-[color:rgba(255,255,255,0.08)]"
  )
}

function navIconClass(isActive: boolean) {
  return cn(
    "mt-0.5 grid h-9 w-9 place-items-center rounded-lg ring-1 transition-colors",
    isActive
      ? "bg-[color:rgba(62,138,118,0.14)] text-[color:rgba(172,238,214,0.95)] ring-[color:rgba(118,177,157,0.22)]"
      : "bg-[color:rgba(255,255,255,0.03)] text-[color:rgba(200,214,224,0.92)] ring-[color:rgba(255,255,255,0.10)]"
  )
}
