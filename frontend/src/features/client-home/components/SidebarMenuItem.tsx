import { ChevronDown } from "lucide-react"

import { handleAppLinkClick } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import type { ClientSidebarMenuItem } from "@/features/client-home/components/client-navigation"
import { SidebarSubmenu } from "@/features/client-home/components/SidebarSubmenu"

type SidebarMenuItemProps = {
  item: ClientSidebarMenuItem
  isActive: boolean
  isExpanded: boolean
  activeSubmenuHref: string | null
  onHoverStart: () => void
  onHoverEnd: () => void
  onNavigate: () => void
}

export function SidebarMenuItem({
  item,
  isActive,
  isExpanded,
  activeSubmenuHref,
  onHoverStart,
  onHoverEnd,
  onNavigate,
}: SidebarMenuItemProps) {
  const Icon = item.icon

  return (
    <li
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onHoverEnd()
        }
      }}
      className="rounded-none"
    >
      <a
        href={item.href}
        onClick={(event) => handleAppLinkClick(event, item.href, onNavigate)}
        className={cn(
          "group relative flex min-h-[42px] items-center justify-between gap-3 rounded-none border-0 px-3.5 py-[7px] pl-[15px] text-[0.82rem] font-medium leading-none tracking-[0.01em] transition-colors duration-200",
          isActive
            ? "font-semibold text-[rgba(247,251,251,0.98)] before:absolute before:left-0 before:top-1.5 before:h-[calc(100%-12px)] before:w-[3px] before:rounded before:bg-[rgba(64,178,155,0.95)] before:content-['']"
            : "text-[rgba(207,222,232,0.95)] hover:text-[rgba(237,244,248,1)]"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex h-[18px] w-[18px] items-center justify-center transition-colors",
              isActive ? "text-[rgba(237,244,248,1)]" : "text-[rgba(207,222,232,0.95)] group-hover:text-[rgba(237,244,248,1)]"
            )}
          >
            <Icon className="h-[18px] w-[18px] stroke-[2.15]" />
          </span>
          <span>{item.label}</span>
        </span>

        {item.submenu ? (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-[rgba(195,216,226,0.94)] transition-transform duration-200",
              isExpanded ? "rotate-180" : "rotate-0"
            )}
          />
        ) : null}
      </a>

      {item.submenu ? (
        <SidebarSubmenu
          items={item.submenu}
          activeHref={activeSubmenuHref}
          visible={isExpanded}
          onNavigate={onNavigate}
        />
      ) : null}
    </li>
  )
}
