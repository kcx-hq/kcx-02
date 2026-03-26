import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { handleAppLinkClick } from "@/lib/navigation"
import { cn } from "@/lib/utils"

export type MegaMenuLink = {
  title: string
  href: string
  description?: string
  icon?: string
  iconScale?: number
  iconClassName?: string
}

export type MegaMenuGroup = {
  title: string
  links: MegaMenuLink[]
}

export type MegaMenuData = {
  key: string
  label: string
  groups: MegaMenuGroup[]
  featured: {
    title: string
    description: string
    ctaLabel: string
    href: string
  }
}

type MegaMenuProps = {
  menu: MegaMenuData | null
  open: boolean
  shellTone: "light" | "dark"
  onMouseEnter: () => void
  onMouseLeave: () => void
  onLinkClick?: () => void
}

export function MegaMenu({ menu, open, shellTone, onMouseEnter, onMouseLeave, onLinkClick }: MegaMenuProps) {
  if (!menu) return null

  return (
    <div
      className={cn(
        "absolute left-1/2 top-[calc(100%+0.65rem)] z-[70] w-[min(1140px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl p-5 transition-all duration-200",
        shellTone === "light"
          ? "border border-[rgba(20,36,48,0.14)] bg-[rgba(248,251,250,0.82)] shadow-[0_34px_72px_-28px_rgba(8,22,33,0.28)] backdrop-blur-sm"
          : "border border-[rgba(255,255,255,0.2)] bg-[rgba(9,19,29,0.82)] shadow-[0_42px_90px_-30px_rgba(1,7,13,0.95)] backdrop-blur-sm",
        open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="navigation"
      aria-label={`${menu.label} mega menu`}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_265px]">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {menu.groups.map((group) => (
            <div key={group.title}>
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.12em]",
                  shellTone === "light" ? "text-slate-600" : "text-[rgba(226,240,236,0.82)]"
                )}
              >
                {group.title}
              </p>
              <div className="mt-2 space-y-1.5">
                {group.links.map((link) => (
                  <a
                    key={link.title}
                    href={link.href}
                    onClick={(event) => handleAppLinkClick(event, link.href, onLinkClick)}
                    className={cn(
                      "block rounded-md px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      shellTone === "light"
                        ? "hover:bg-[rgba(9,30,43,0.06)]"
                        : "hover:bg-[rgba(255,255,255,0.08)]"
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        shellTone === "light" ? "text-slate-900" : "text-[#f6fbf9]"
                      )}
                    >
                      <span className="inline-flex items-center gap-2">
                        {link.icon ? (
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                            <img
                              src={link.icon}
                              alt=""
                              aria-hidden="true"
                              className={cn(
                                "h-full w-full object-contain",
                                shellTone === "light" ? "opacity-90" : "brightness-0 invert opacity-95",
                                link.iconClassName
                              )}
                              style={{ transform: `scale(${link.iconScale ?? 1})` }}
                              loading="lazy"
                            />
                          </span>
                        ) : null}
                        <span>{link.title}</span>
                      </span>
                    </p>
                    {link.description ? (
                      <p
                        className={cn(
                          "mt-0.5 text-xs leading-5",
                          shellTone === "light"
                            ? "text-slate-600"
                            : "text-[rgba(216,231,226,0.76)]"
                        )}
                      >
                        {link.description}
                      </p>
                    ) : null}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <aside
          className={cn(
            "rounded-xl p-3.5",
            shellTone === "light"
              ? "border border-[rgba(17,35,48,0.12)] bg-[rgba(255,255,255,0.6)] backdrop-blur-sm"
              : "border border-[rgba(255,255,255,0.22)] bg-[rgba(255,255,255,0.14)] backdrop-blur-sm"
          )}
        >
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-[0.12em]",
              shellTone === "light" ? "text-[#2f7f68]" : "text-[rgba(141,227,198,0.95)]"
            )}
          >
            Featured
          </p>
          <h3
            className={cn(
              "mt-2 text-base font-semibold",
              shellTone === "light" ? "text-slate-900" : "text-[#f6fbf9]"
            )}
          >
            {menu.featured.title}
          </h3>
          <p
            className={cn(
              "mt-2 text-sm leading-6",
              shellTone === "light" ? "text-slate-600" : "text-[rgba(223,235,231,0.82)]"
            )}
          >
            {menu.featured.description}
          </p>
          <Button asChild className="mt-4 h-9 px-4 text-xs">
            <a
              href={menu.featured.href}
              className="inline-flex items-center gap-1.5"
              onClick={(event) => handleAppLinkClick(event, menu.featured.href, onLinkClick)}
            >
              {menu.featured.ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </Button>
        </aside>
      </div>
    </div>
  )
}
