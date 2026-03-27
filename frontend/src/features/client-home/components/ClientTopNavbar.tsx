import { Button } from "@/components/ui/button"
import kcxLogo from "@/assets/logos/kcx-logo.svg"
import { handleAppLinkClick, useCurrentRoute } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import { Bell, LifeBuoy, Sparkles } from "lucide-react"

const NAV_ITEMS = [
  { label: "Overview", href: "/client/overview", matches: ["/client", "/client/overview", "/clienthome", "/client-home"] },
  { label: "Billing", href: "/client/billing/uploads", matches: ["/client/billing", "/client/billing/uploads", "/client/billing/connections", "/client/billing/connections/add", "/client/billing/connections/manual-setup"] },
  { label: "Support", href: "/client/support/tickets", matches: ["/client/support", "/client/support/tickets", "/client/support/schedule-call", "/client/support/live-chat"] },
  { label: "Users", href: "/client/users", matches: ["/client/users"] },
] as const

type ClientTopNavbarProps = {
  orgName: string
}

export function ClientTopNavbar({ orgName }: ClientTopNavbarProps) {
  const route = useCurrentRoute()

  return (
    <header className="sticky top-0 z-40 overflow-hidden border-b border-[rgba(132,165,157,0.2)] bg-[rgba(10,18,20,0.7)] text-text-on-dark backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(92deg,rgba(11,22,24,0.74)_0%,rgba(11,22,24,0.54)_52%,rgba(11,22,24,0.68)_100%)]" />
      <div className="hero-aurora-right-glow-a pointer-events-none absolute inset-0 opacity-[0.14]" />
      <div className="hero-aurora-right-glow-b pointer-events-none absolute inset-0 opacity-[0.1]" />
      <div className="hero-aurora-right-glow-c pointer-events-none absolute inset-0 opacity-[0.08]" />
      <div className="hero-aurora-prism pointer-events-none absolute inset-0 opacity-[0.06]" />
      <div className="hero-aurora-noise pointer-events-none absolute inset-0 opacity-[0.08]" />
      <div className="relative mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 flex-1 items-center gap-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src={kcxLogo} alt="KCX" className="h-7 w-auto" />
            <div className="h-5 w-px bg-[rgba(196,216,208,0.28)]" />
            <p className="truncate text-sm font-medium text-[rgba(236,244,241,0.88)]">{orgName}</p>
          </div>

          <nav className="hidden h-16 items-stretch gap-6 lg:flex" aria-label="Client workspace">
            {NAV_ITEMS.map((item) => {
              const isActive = item.matches.some((path) => path === route)
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(event) => handleAppLinkClick(event, item.href)}
                  className={cn(
                    "inline-flex h-full items-center border-b-2 border-transparent px-0 text-sm font-medium leading-none transition-colors",
                    isActive
                      ? "border-[rgba(132,205,180,0.82)] text-white"
                      : "text-[rgba(218,232,226,0.78)] hover:text-white"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </a>
              )
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Button
            variant="ghost"
            className="hidden h-9 gap-1.5 rounded-md border border-[rgba(164,192,181,0.3)] px-2.5 text-[12px] font-medium text-[rgba(228,240,235,0.9)] hover:bg-[rgba(158,191,178,0.11)] hover:text-white xl:inline-flex"
          >
            <LifeBuoy className="h-3.5 w-3.5" />
            KCX Help
          </Button>
          <Button
            variant="ghost"
            className="hidden h-9 gap-1.5 rounded-md border border-[rgba(164,192,181,0.3)] px-2.5 text-[12px] font-medium text-[rgba(228,240,235,0.9)] hover:bg-[rgba(158,191,178,0.11)] hover:text-white xl:inline-flex"
          >
            <Sparkles className="h-3.5 w-3.5" />
            What's New
          </Button>
          <Button
            variant="ghost"
            className="h-9 rounded-md border border-[rgba(164,192,181,0.3)] px-2 text-[rgba(228,240,235,0.9)] hover:bg-[rgba(158,191,178,0.11)] hover:text-white"
          >
            <span className="sr-only">Notifications</span>
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="ghost" className="h-10 rounded-md border border-[rgba(164,192,181,0.3)] px-2 text-[rgba(228,240,235,0.9)] hover:bg-[rgba(158,191,178,0.11)] hover:text-white">
            <span className="sr-only">Open user menu</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[rgba(209,226,219,0.14)] text-sm font-semibold text-[rgba(231,242,238,0.94)]">
              AK
            </span>
          </Button>
        </div>
      </div>
    </header>
  )
}
