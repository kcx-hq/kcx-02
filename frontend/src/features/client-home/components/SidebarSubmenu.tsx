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
      <ul className="min-h-0 space-y-1.5 overflow-hidden pl-[42px] pr-2 pb-1 pt-1">
        {items.map((item) => {
          const isActive = activeHref === item.href
          return (
            <li key={item.href} className="relative">
              <a
                href={item.href}
                onClick={(event) => handleAppLinkClick(event, item.href, onNavigate)}
                className={cn(
                  "relative block min-h-[32px] rounded-none px-2.5 py-[7px] text-[0.79rem] font-medium leading-none tracking-[0.01em] transition-colors duration-200",
                  isActive
                    ? "font-semibold text-[rgba(247,251,251,0.98)] before:absolute before:left-[-9px] before:top-1 before:h-[calc(100%-8px)] before:w-[2px] before:rounded before:bg-[rgba(64,178,155,0.92)] before:content-['']"
                    : "text-[rgba(196,217,208,0.85)] hover:text-[rgba(237,247,242,0.96)]"
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
