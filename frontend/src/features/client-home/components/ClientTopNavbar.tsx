import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import kcxLogo from "@/assets/logos/kcx-logo.svg"
import { clearAuthSession } from "@/lib/auth"
import { handleAppLinkClick, navigateTo, useCurrentRoute } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import { Bell, ChevronDown, LifeBuoy, LogOut, Megaphone, User, UserCircle2 } from "lucide-react"

const NAV_ITEMS = [
  { label: "Overview", href: "/client/overview", matches: ["/client", "/client/overview", "/clienthome", "/client-home"] },
  { label: "Billing", href: "/client/billing", matches: ["/client/billing", "/client/billing/uploads", "/client/billing/connections", "/client/billing/connections/aws", "/client/billing/connections/aws/automatic", "/client/billing/connections/aws/manual"] },
  { label: "Support", href: "/client/support/tickets", matches: ["/client/support", "/client/support/tickets", "/client/support/schedule-call", "/client/support/live-chat"] },
  { label: "Users", href: "/client/users", matches: ["/client/users"] },
] as const

function HeaderIconTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.65rem)] z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-[rgba(162,188,178,0.38)] bg-[rgba(18,30,31,0.98)] px-2.5 py-1.5 text-xs font-medium text-[rgba(232,243,238,0.95)] opacity-0 shadow-[0_10px_26px_rgba(7,15,15,0.34)] transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
      {label}
    </span>
  )
}

type ClientTopNavbarProps = {
  orgName: string
  userDisplayName: string
  userEmail: string
  userRole: string
}

function toRoleLabel(role: string) {
  if (!role.trim()) return "Client User"
  return role
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function ClientTopNavbar({
  orgName,
  userDisplayName,
  userEmail,
  userRole,
}: ClientTopNavbarProps) {
  const route = useCurrentRoute()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onEscape)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onEscape)
    }
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [route])

  const roleLabel = toRoleLabel(userRole)

  function handleLogout() {
    clearAuthSession()
    navigateTo("/login", { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(132,165,157,0.2)] bg-[rgba(10,18,20,0.7)] text-text-on-dark backdrop-blur-md">
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
              const isActive = item.label === "Billing" ? route.startsWith("/client/billing") : item.matches.some((path) => path === route)
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
          <div className="group relative hidden xl:block">
            <Button
              variant="ghost"
              aria-label="KCX Help"
              className="h-9 rounded-md border border-[rgba(164,192,181,0.3)] px-2 text-[rgba(228,240,235,0.9)] hover:bg-[rgba(158,191,178,0.11)] hover:text-white"
            >
              <LifeBuoy className="h-3.5 w-3.5" />
            </Button>
            <HeaderIconTooltip label="KCX Help" />
          </div>
          <div className="group relative hidden xl:block">
            <Button
              variant="ghost"
              aria-label="Announcements"
              className="h-9 rounded-md border border-[rgba(164,192,181,0.3)] px-2 text-[rgba(228,240,235,0.9)] hover:bg-[rgba(158,191,178,0.11)] hover:text-white"
            >
              <Megaphone className="h-3.5 w-3.5" />
            </Button>
            <HeaderIconTooltip label="Announcements" />
          </div>
          <div className="group relative">
            <Button
              variant="ghost"
              aria-label="Notifications"
              className="h-9 rounded-md border border-[rgba(164,192,181,0.3)] px-2 text-[rgba(228,240,235,0.9)] hover:bg-[rgba(158,191,178,0.11)] hover:text-white"
            >
              <span className="sr-only">Notifications</span>
              <Bell className="h-4 w-4" />
            </Button>
            <HeaderIconTooltip label="Notifications" />
          </div>
          <div className="relative" ref={menuRef}>
            <div className="group relative">
              <Button
                variant="ghost"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="User Menu"
                className={cn(
                  "h-10 rounded-md border border-[rgba(164,192,181,0.3)] px-2 text-[rgba(228,240,235,0.9)] hover:bg-[rgba(158,191,178,0.11)] hover:text-white",
                  menuOpen ? "bg-[rgba(158,191,178,0.12)] text-white" : ""
                )}
                aria-haspopup="menu"
                aria-expanded={menuOpen ? "true" : "false"}
              >
                <span className="sr-only">Open user menu</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[rgba(209,226,219,0.14)] text-sm font-semibold text-[rgba(231,242,238,0.94)]">
                  <User className="h-4 w-4" />
                </span>
                <ChevronDown className="ml-1 h-4 w-4 opacity-80" />
              </Button>
              {!menuOpen ? <HeaderIconTooltip label="User Menu" /> : null}
            </div>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-12 z-50 w-[290px] rounded-md border border-[rgba(163,189,179,0.38)] bg-[rgba(17,28,29,0.97)] p-3 shadow-[0_16px_36px_rgba(5,11,11,0.35)] backdrop-blur-md"
              >
                <div className="rounded-md border border-[rgba(163,189,179,0.25)] bg-[rgba(221,236,230,0.06)] p-3">
                  <p className="text-sm font-semibold text-[rgba(242,248,246,0.94)]">{userDisplayName}</p>
                  <p className="mt-0.5 text-xs text-[rgba(213,228,221,0.78)]">{userEmail}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-[rgba(196,218,208,0.85)]">
                    <span className="rounded-sm border border-[rgba(167,197,186,0.45)] px-1.5 py-0.5">{roleLabel}</span>
                    <span className="rounded-sm border border-[rgba(167,197,186,0.45)] px-1.5 py-0.5">{orgName}</span>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <a
                    href="/client/profile"
                    role="menuitem"
                    onClick={(event) => handleAppLinkClick(event, "/client/profile", () => setMenuOpen(false))}
                    className="flex items-center justify-between rounded-sm px-2.5 py-2 text-sm text-[rgba(228,239,234,0.9)] transition-colors hover:bg-[rgba(162,193,181,0.12)] hover:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <UserCircle2 className="h-4 w-4" />
                      Profile Settings
                    </span>
                  </a>
                </div>

                <div className="mt-3 border-t border-[rgba(163,189,179,0.28)] pt-2">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm font-medium text-[rgba(255,220,220,0.94)] transition-colors hover:bg-[rgba(255,120,120,0.12)] hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
