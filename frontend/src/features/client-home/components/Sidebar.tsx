import { useMemo, useState } from "react"
import kcxLogo from "@/assets/logos/kcx-logo.svg"
import { handleAppLinkClick } from "@/lib/navigation"

import {
  CLIENT_SIDEBAR_MENU,
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

  const activeState = useMemo(() => {
    const states = new Map<string, { active: boolean; activeSubmenuHref: string | null }>()

    CLIENT_SIDEBAR_MENU.forEach((item) => {
      const submenuMatch = item.submenu?.find((submenu) => routeMatches(route, submenu.activeMatches)) ?? null
      const isActive = routeMatches(route, item.activeMatches) || Boolean(submenuMatch)
      states.set(item.id, {
        active: isActive,
        activeSubmenuHref: submenuMatch?.href ?? null,
      })
    })

    return states
  }, [route])

  return (
    <aside
      className="h-full w-full bg-transparent px-[9px] py-2"
      aria-label="Client sidebar navigation"
    >
      <div className="min-h-[50px] rounded-[9px] border border-[rgba(255,255,255,0.16)] bg-[rgba(23,38,52,0.88)] px-2 py-[5px]">
        <a
          href="/client/overview"
          onClick={(event) => handleAppLinkClick(event, "/client/overview", onNavigate)}
          className="flex min-h-10 items-center gap-[10px]"
          aria-label="Client home"
        >
          <img src={kcxLogo} alt="KCX" className="h-[26px] w-auto object-contain" />
          <span className="truncate text-[0.72rem] font-bold uppercase tracking-[0.09em] text-[var(--dashboard-sidebar-text,#edf4f8)]">
            {orgName}
          </span>
        </a>
      </div>

      <div className="my-[6px] border-t border-[rgba(255,255,255,0.1)]" />

      <nav aria-label="Client workspace navigation" className="space-y-[2px]">
        <ul className="space-y-[2px]">
          {CLIENT_SIDEBAR_MENU.map((item) => {
            const state = activeState.get(item.id)
            const isExpanded = hoveredItemId === item.id || Boolean(state?.activeSubmenuHref)

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
