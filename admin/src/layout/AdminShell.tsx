import * as Dialog from "@radix-ui/react-dialog"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { Bell, LogOut, PanelLeft, UserRound, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { AdminSidebar } from "@/layout/AdminSidebar"
import { Button } from "@/shared/ui/button"
import kcxLogo from "../../../frontend/src/assets/logos/kcx-logo.svg"
import { ADMIN_NAV } from "@/app/nav"
import { clearAdminToken } from "@/modules/auth/admin-session"

export function AdminShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const activeTitle =
    location.pathname === "/"
      ? "Dashboard"
      : ADMIN_NAV.find((item) => item.to === location.pathname)?.label ?? location.pathname.replace("/", "")

  const onLogout = () => {
    clearAdminToken()
    navigate("/login", { replace: true })
  }

  useEffect(() => {
    if (!profileMenuOpen) return

    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node
      if (!profileMenuRef.current?.contains(target)) setProfileMenuOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false)
    }

    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [profileMenuOpen])

  return (
    <Dialog.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <div className="min-h-screen bg-[#F5F7FA] text-foreground">
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[color:rgba(255,255,255,0.10)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:ring-2 focus:ring-[color:rgba(62,138,118,0.55)]"
          href="#admin-content"
        >
          Skip to content
        </a>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-0 top-0 z-50 h-full w-[320px] max-w-[88vw] outline-none">
            <Dialog.Title className="sr-only">KCX Admin navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Primary navigation for the KCX internal admin console.</Dialog.Description>
            <div className="h-full bg-[color:rgba(11,27,43,0.96)] backdrop-blur-2xl">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <img src={kcxLogo} alt="KCX" className="h-8 w-auto object-contain" />
                  <span className="min-w-0 leading-none">
                    <span className="block truncate text-[1.15rem] font-semibold tracking-[-0.02em] text-white">
                      <span className="text-white">KC</span>
                      <span className="text-[#4fa58f] [text-shadow:0_0_10px_rgba(79,165,143,0.3)]">X</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">
                      FinOps Platform
                    </span>
                  </span>
                </div>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon" aria-label="Close navigation" className="text-white hover:bg-white/10">
                    <X className="h-5 w-5" />
                  </Button>
                </Dialog.Close>
              </div>
              <AdminSidebar mobile onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>

        <header className="fixed left-0 right-0 top-0 z-40 h-16">
          <div className="flex h-full w-full">
            <div className="hidden w-[240px] items-center gap-3 border-b border-white/10 bg-[#0B1B2B] px-4 text-white lg:flex">
              <img src={kcxLogo} alt="KCX" className="h-8 w-auto object-contain" />
              <span className="leading-none">
                <span className="block text-[1.18rem] font-semibold tracking-[-0.02em]">
                  <span className="text-white">KC</span>
                  <span className="text-[#4fa58f] [text-shadow:0_0_10px_rgba(79,165,143,0.3)]">X</span>
                </span>
                <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  FinOps Platform
                </span>
              </span>
            </div>

            <div className="flex min-w-0 flex-1 border-b border-[color:rgba(15,23,42,0.08)] bg-white">
              <div className="mx-auto flex h-full w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <Dialog.Trigger asChild>
                    <Button className="lg:hidden" variant="secondary" size="icon" aria-label="Open navigation">
                      <PanelLeft className="h-5 w-5" />
                    </Button>
                  </Dialog.Trigger>

                  <div className="flex min-w-0 items-center gap-3 lg:hidden">
                    <img src={kcxLogo} alt="KCX logo" className="h-7 w-auto" />
                    <div className="min-w-0 leading-none">
                      <div className="truncate text-sm font-semibold tracking-[-0.01em] text-[color:rgba(15,23,42,0.92)]">
                        KCX / {activeTitle}
                      </div>
                      <div className="mt-0.5 truncate text-xs font-medium text-[color:rgba(15,23,42,0.52)]">Admin</div>
                    </div>
                  </div>

                  <div className="hidden min-w-0 leading-none lg:block">
                    <div className="truncate text-sm font-semibold tracking-[-0.01em] text-[color:rgba(15,23,42,0.90)]">
                      KCX / {activeTitle}
                    </div>
                    <div className="mt-0.5 truncate text-xs font-medium text-[color:rgba(15,23,42,0.52)]">Admin</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="relative grid h-10 w-10 place-items-center rounded-xl bg-white text-[color:rgba(15,23,42,0.70)] ring-1 ring-[color:rgba(15,23,42,0.10)] transition-colors hover:bg-[color:rgba(15,23,42,0.03)]"
                    aria-label="Notifications"
                  >
                    <Bell className="h-5 w-5" aria-hidden="true" />
                    <span className="absolute right-2 top-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ef4444] px-1 text-[10px] font-semibold leading-none text-white">
                      3
                    </span>
                  </button>
                  <div className="relative" ref={profileMenuRef}>
                    <button
                      type="button"
                      className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[color:rgba(15,23,42,0.78)] ring-1 ring-[color:rgba(62,138,118,0.22)] transition-[background,box-shadow,transform] hover:bg-[color:rgba(62,138,118,0.04)] hover:shadow-[0_16px_30px_-22px_rgba(15,23,42,0.35)] active:translate-y-[0.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(62,138,118,0.55)]"
                      aria-label="Open profile menu"
                      aria-haspopup="menu"
                      aria-expanded={profileMenuOpen ? "true" : "false"}
                      onClick={() => setProfileMenuOpen((open) => !open)}
                    >
                      <UserRound className="h-5 w-5 text-[color:rgba(62,138,118,0.95)]" aria-hidden="true" />
                    </button>

                    {profileMenuOpen ? (
                      <div
                        role="menu"
                        aria-label="Profile menu"
                        className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-44 overflow-hidden rounded-2xl bg-white shadow-[0_22px_50px_-30px_rgba(15,23,42,0.55)] ring-1 ring-[color:rgba(15,23,42,0.10)]"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-[color:rgba(15,23,42,0.86)] transition-colors hover:bg-[color:rgba(15,23,42,0.04)]"
                          onClick={() => {
                            setProfileMenuOpen(false)
                            onLogout()
                          }}
                        >
                          <LogOut className="h-4 w-4 text-[color:rgba(15,23,42,0.72)]" aria-hidden="true" />
                          Logout
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <aside className="hidden lg:block">
          <AdminSidebar />
        </aside>

        <main id="admin-content" className="min-h-screen pt-20 lg:pl-[240px]">
          <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-6 lg:pb-14">
            <Outlet />
          </div>
        </main>
      </div>
    </Dialog.Root>
  )
}
