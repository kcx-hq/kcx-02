import { handleAppLinkClick } from "@/lib/navigation"
import { cn } from "@/lib/utils"

import type { ClientSidebarSubmenuItem } from "@/features/client-home/components/client-navigation"

type SidebarSubmenuProps = {
  items: ClientSidebarSubmenuItem[]
  activeHref: string | null
  visible: boolean
  onNavigate: () => void
}

export function SidebarSubmenu({ items, activeHref, visible, onNavigate }: SidebarSubmenuProps) {
  return (
    <div
      className={cn(
        "grid overflow-hidden transition-all duration-200 ease-out",
        visible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
      aria-hidden={visible ? "false" : "true"}
    >
      <ul className="min-h-0 space-y-[2px] overflow-hidden pl-11 pr-[10px] pb-[2px]">
        {items.map((item) => {
          const isActive = activeHref === item.href
          return (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={(event) => handleAppLinkClick(event, item.href, onNavigate)}
                className={cn(
                  "block min-h-[30px] rounded-none px-[6px] py-[6px] text-[0.75rem] font-medium leading-none tracking-[0.01em] transition-colors",
                  isActive
                    ? "text-[rgba(247,251,251,0.96)]"
                    : "text-[rgba(196,217,208,0.82)] hover:text-[rgba(237,247,242,0.96)]"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
