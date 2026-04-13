import { useMemo, useState } from "react"
import kcxLogo from "@/assets/logos/kcx-logo.svg"
import { handleAppLinkClick } from "@/lib/navigation"
import { getAuthUser } from "@/lib/auth"

import {
  getClientSidebarMenu,
  routeMatches,
} from "@/features/client-home/components/client-navigation"
import { SidebarMenuItem } from "@/features/client-home/components/SidebarMenuItem"

type SidebarProps = {
  route: string
  orgName: string
  onNavigate: () => void
}

export function Sidebar({ route, orgName, onNavigate }: SidebarProps) {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)
  const user = getAuthUser()
  const menuItems = useMemo(() => getClientSidebarMenu(user?.role), [user?.role])

  const activeState = useMemo(() => {
    const states = new Map<string, { active: boolean; activeSubmenuHref: string | null }>()

    menuItems.forEach((item) => {
      const submenuMatch = item.submenu?.find((submenu) => routeMatches(route, submenu.activeMatches)) ?? null
      const isActive = routeMatches(route, item.activeMatches) || Boolean(submenuMatch)
      states.set(item.id, {
        active: isActive,
        activeSubmenuHref: submenuMatch?.href ?? null,
      })
    })

    return states
  }, [route, menuItems])

  return (
    <aside
      className="h-full w-full bg-transparent px-[10px] py-3"
      aria-label="Client sidebar navigation"
    >
      <div className="px-1 py-1">
        <a
          href="/client/overview"
          onClick={(event) => handleAppLinkClick(event, "/client/overview", onNavigate)}
          className="flex min-h-10 items-center gap-3 px-1.5"
          aria-label="Client home"
        >
          <img src={kcxLogo} alt="KCX" className="h-7 w-auto shrink-0 object-contain opacity-95" />
          <span className="min-w-0 flex-1 truncate text-[0.86rem] font-bold uppercase tracking-[0.08em] text-[var(--dashboard-sidebar-text,#edf4f8)]">
            {orgName}
          </span>
        </a>
      </div>

      <div className="my-2 border-t border-[rgba(255,255,255,0.12)]" />

      <nav aria-label="Client workspace navigation" className="pt-1">
        <ul className="space-y-2.5">
          {menuItems.map((item) => {
            const state = activeState.get(item.id)
            const isExpanded = hoveredItemId === item.id || Boolean(state?.active) || Boolean(state?.activeSubmenuHref)

            return (
              <SidebarMenuItem
                key={item.id}
                item={item}
                isActive={Boolean(state?.active)}
                isExpanded={isExpanded}
                activeSubmenuHref={state?.activeSubmenuHref ?? null}
                onHoverStart={() => setHoveredItemId(item.id)}
                onHoverEnd={() => setHoveredItemId((current) => (current === item.id ? null : current))}
                onNavigate={onNavigate}
              />
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
