import * as Dialog from "@radix-ui/react-dialog"
import { Outlet, useLocation } from "react-router-dom"
import { Bell, PanelLeft, UserRound, X } from "lucide-react"
import { useState } from "react"

import { AdminSidebar } from "@/components/layout/AdminSidebar"
import { Button } from "@/components/ui/button"
import kcxLogo from "../../../../frontend/src/assets/logos/kcx-logo.svg"
import { ADMIN_NAV } from "@/lib/nav"

export function AdminShell() {
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const activeTitle =
    location.pathname === "/"
      ? "Overview"
      : ADMIN_NAV.find((item) => item.to === location.pathname)?.label ?? location.pathname.replace("/", "")

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
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-[-0.01em] text-white">KCX Admin</div>
                  <div className="truncate text-xs text-[color:rgba(226,232,240,0.80)]">Admin Dashboard</div>
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
              <img src={kcxLogo} alt="KCX logo" className="h-7 w-auto" />
              <div className="truncate text-sm font-semibold tracking-[-0.01em]">KCX Admin</div>
            </div>

            <div className="flex min-w-0 flex-1 border-b border-[color:rgba(15,23,42,0.08)] bg-white">
              <div className="mx-auto flex h-full w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
                <div className="flex min-w-0 items-center gap-3">
                  <Dialog.Trigger asChild>
                    <Button className="lg:hidden" variant="secondary" size="icon" aria-label="Open navigation">
                      <PanelLeft className="h-5 w-5" />
                    </Button>
                  </Dialog.Trigger>

                  <div className="flex min-w-0 items-center gap-3 lg:hidden">
                    <img src={kcxLogo} alt="KCX logo" className="h-7 w-auto" />
                    <div className="truncate text-sm font-semibold tracking-[-0.01em] text-[color:rgba(15,23,42,0.92)]">
                      KCX Admin
                    </div>
                    <div className="hidden text-sm text-muted-foreground sm:block">/</div>
                    <div className="hidden min-w-0 truncate text-sm font-semibold text-[color:rgba(15,23,42,0.86)] sm:block">
                      {activeTitle}
                    </div>
                  </div>

                  <div className="hidden min-w-0 truncate text-sm font-semibold text-[color:rgba(15,23,42,0.86)] lg:block">
                    {activeTitle}
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
                  <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[color:rgba(15,23,42,0.70)] ring-1 ring-[color:rgba(15,23,42,0.10)] transition-colors hover:bg-[color:rgba(15,23,42,0.03)]"
                    aria-label="Open profile"
                  >
                    <UserRound className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <aside className="hidden lg:block">
          <AdminSidebar />
        </aside>

        <main id="admin-content" className="min-h-screen pt-24 lg:pl-[240px]">
          <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-10 lg:pb-14">
            <Outlet />
          </div>
        </main>
      </div>
    </Dialog.Root>
  )
}
