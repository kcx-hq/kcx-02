import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { clearAuthSession } from "@/lib/auth"
import { handleAppLinkClick, navigateTo, useCurrentRoute } from "@/lib/navigation"
import { getClientBreadcrumbLabel } from "@/features/client-home/components/client-navigation"
import { cn } from "@/lib/utils"
import { Bell, ChevronDown, LifeBuoy, LogOut, Menu, Megaphone, User, UserCircle2 } from "lucide-react"
import { useClientAnnouncements } from "@/features/client-home/hooks/useClientAnnouncements"

const ANNOUNCEMENTS_SEEN_KEY = "kcx_client_seen_announcement_at"

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
  onOpenSidebar?: () => void
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
  onOpenSidebar,
}: ClientTopNavbarProps) {
  const route = useCurrentRoute()
  const [menuOpen, setMenuOpen] = useState(false)
  const [announcementsOpen, setAnnouncementsOpen] = useState(false)
  const [seenAnnouncementAt, setSeenAnnouncementAt] = useState<number>(() => {
    if (typeof window === "undefined") return 0
    const raw = window.localStorage.getItem(ANNOUNCEMENTS_SEEN_KEY)
    const parsed = raw ? Number(raw) : 0
    return Number.isFinite(parsed) ? parsed : 0
  })
  const menuRef = useRef<HTMLDivElement>(null)
  const announcementsRef = useRef<HTMLDivElement>(null)
  const { data: announcements = [], isLoading: isAnnouncementsLoading, isError: announcementsError } = useClientAnnouncements(true)

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
      if (!announcementsRef.current?.contains(event.target as Node)) {
        setAnnouncementsOpen(false)
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false)
        setAnnouncementsOpen(false)
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
    setAnnouncementsOpen(false)
  }, [route])

  const roleLabel = toRoleLabel(userRole)
  const currentBreadcrumbLabel = getClientBreadcrumbLabel(route)
  const navIconButtonClass =
    "relative h-10 rounded-md border border-[rgba(170,188,181,0.58)] bg-[color:#f6faf9] px-3 text-[color:#3a555d] transition duration-200 hover:border-[rgba(123,159,148,0.66)] hover:bg-[color:#eef6f3] hover:text-[color:#20363d]"

  function toAnnouncementTimestamp(iso: string | null | undefined) {
    if (!iso) return 0
    const value = Date.parse(iso)
    return Number.isNaN(value) ? 0 : value
  }

  const unreadAnnouncementsCount = announcements.reduce((count, announcement) => {
    const announcementTimestamp = toAnnouncementTimestamp(announcement.publishAt ?? announcement.updatedAt)
    return announcementTimestamp > seenAnnouncementAt ? count + 1 : count
  }, 0)

  function markAnnouncementsSeen() {
    const latestAnnouncementAt = announcements.reduce((latest, announcement) => {
      const announcementTimestamp = toAnnouncementTimestamp(announcement.publishAt ?? announcement.updatedAt)
      return Math.max(latest, announcementTimestamp)
    }, 0)

    const nextSeenTimestamp = Math.max(latestAnnouncementAt, Date.now())
    setSeenAnnouncementAt(nextSeenTimestamp)
    window.localStorage.setItem(ANNOUNCEMENTS_SEEN_KEY, String(nextSeenTimestamp))
  }

  function handleLogout() {
    clearAuthSession()
    navigateTo("/login", { replace: true })
  }

  function formatAnnouncementTime(iso: string | null) {
    if (!iso) return "Recently updated"
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return "Recently updated"
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(177,196,188,0.42)] bg-[linear-gradient(180deg,#fefefe_0%,#f5faf8_100%)] text-[color:#1f2e33] shadow-[0_8px_26px_rgba(16,37,35,0.08)] backdrop-blur-[2px] lg:ml-[228px] lg:w-[calc(100%-228px)]">
      <div className="mx-auto flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-[22px]">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {onOpenSidebar ? (
            <Button
              type="button"
              variant="ghost"
              aria-label="Open sidebar navigation"
              className="h-9 rounded-md border border-[color:#d5e0dd] bg-[color:#f8fbfa] px-2 text-[color:#3f595f] hover:bg-[color:#eef4f2] hover:text-[color:#21343a] lg:hidden"
              onClick={onOpenSidebar}
            >
              <Menu className="h-4 w-4" />
            </Button>
          ) : null}
          <nav className="inline-flex min-w-0 items-center gap-2" aria-label="Breadcrumb">
            <span className="truncate text-[16px] font-semibold text-[color:#192630]">{currentBreadcrumbLabel}</span>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="group relative hidden xl:block">
            <Button
              variant="ghost"
              aria-label="KCX Help"
              className={navIconButtonClass}
            >
              <LifeBuoy className="h-3.5 w-3.5" />
            </Button>
            <HeaderIconTooltip label="KCX Help" />
          </div>
          <div className="relative hidden xl:block" ref={announcementsRef}>
            <div className="group relative">
              <Button
                variant="ghost"
                aria-label="Announcements"
                onClick={() => {
                  setAnnouncementsOpen((open) => {
                    const next = !open
                    if (next) {
                      markAnnouncementsSeen()
                    }
                    return next
                  })
                  setMenuOpen(false)
                }}
                className={cn(
                  navIconButtonClass,
                  announcementsOpen
                    ? "border-[rgba(104,150,134,0.7)] bg-[color:#e5f1ec] text-[color:#163039]"
                    : ""
                )}
              >
                <Megaphone className="h-3.5 w-3.5" />
                {unreadAnnouncementsCount > 0 ? (
                  <span className="ml-1 inline-flex min-w-[1.2rem] items-center justify-center rounded-full border border-[rgba(170,68,68,0.5)] bg-[linear-gradient(180deg,#ff9388_0%,#e66f64_100%)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[rgba(255,247,246,0.96)] shadow-[0_4px_10px_rgba(192,67,55,0.35)]">
                    {unreadAnnouncementsCount}
                  </span>
                ) : null}
              </Button>
              {!announcementsOpen ? <HeaderIconTooltip label="Announcements" /> : null}
            </div>

            {announcementsOpen ? (
              <div className="absolute right-0 top-12 z-50 w-[360px] rounded-md border border-[rgba(163,189,179,0.38)] bg-[rgba(17,28,29,0.97)] p-3 shadow-[0_16px_36px_rgba(5,11,11,0.35)] backdrop-blur-md">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[rgba(242,248,246,0.94)]">Announcements</p>
                  <span className="text-xs text-[rgba(201,220,212,0.78)]">{announcements.length} active</span>
                </div>

                {isAnnouncementsLoading ? (
                  <div className="rounded-md border border-[rgba(163,189,179,0.22)] bg-[rgba(221,236,230,0.04)] p-3 text-sm text-[rgba(213,228,221,0.82)]">
                    Loading announcements...
                  </div>
                ) : null}

                {!isAnnouncementsLoading && announcementsError ? (
                  <div className="rounded-md border border-[rgba(240,133,133,0.32)] bg-[rgba(255,132,132,0.09)] p-3 text-sm text-[rgba(255,220,220,0.94)]">
                    Could not load announcements right now.
                  </div>
                ) : null}

                {!isAnnouncementsLoading && !announcementsError && announcements.length === 0 ? (
                  <div className="rounded-md border border-[rgba(163,189,179,0.22)] bg-[rgba(221,236,230,0.04)] p-3 text-sm text-[rgba(213,228,221,0.82)]">
                    No active announcements.
                  </div>
                ) : null}

                {!isAnnouncementsLoading && !announcementsError && announcements.length > 0 ? (
                  <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
                    {announcements.map((announcement) => (
                      <div
                        key={announcement.id}
                        className="rounded-md border border-[rgba(163,189,179,0.25)] bg-[rgba(221,236,230,0.06)] p-3"
                      >
                        <p className="text-sm font-semibold text-[rgba(242,248,246,0.94)]">{announcement.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[rgba(213,228,221,0.82)]">{announcement.body}</p>
                        <p className="mt-2 text-[11px] text-[rgba(189,211,201,0.74)]">
                          {formatAnnouncementTime(announcement.publishAt ?? announcement.updatedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="group relative">
            <Button
              variant="ghost"
              aria-label="Notifications"
              className={navIconButtonClass}
            >
              <Bell className="h-4 w-4" />
            </Button>
            <HeaderIconTooltip label="Notifications" />
          </div>
          <div className="relative" ref={menuRef}>
            <div className="group relative">
              <Button
                variant="ghost"
                onClick={() => {
                  setMenuOpen((open) => !open)
                  setAnnouncementsOpen(false)
                }}
                aria-label="User Menu"
                className={cn(
                  "h-10 rounded-lg border border-[rgba(170,188,181,0.58)] bg-[color:#f6faf9] px-2 text-[color:#3a555d] transition duration-200 hover:border-[rgba(123,159,148,0.66)] hover:bg-[color:#eef6f3] hover:text-[color:#20363d]",
                  menuOpen
                    ? "border-[rgba(104,150,134,0.7)] bg-[color:#e5f1ec] text-[color:#163039]"
                    : ""
                )}
                aria-haspopup="menu"
                aria-expanded={menuOpen ? "true" : "false"}
              >
                <span className="sr-only">Open user menu</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[color:#e6eeeb] text-sm font-semibold text-[color:#2f4a50]">
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

