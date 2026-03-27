import * as Dialog from "@radix-ui/react-dialog"
import { Outlet, useLocation } from "react-router-dom"
import { PanelLeft, X } from "lucide-react"
import { useState } from "react"

import { cn } from "@/lib/utils"
import { AdminSidebar } from "@/components/layout/AdminSidebar"
import { Button } from "@/components/ui/button"

export function AdminShell() {
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="kcx-admin-surface min-h-screen text-foreground">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[color:rgba(255,255,255,0.10)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:ring-2 focus:ring-[color:rgba(62,138,118,0.55)]"
        href="#admin-content"
      >
        Skip to content
      </a>

      <div className="mx-auto flex min-h-screen w-full max-w-[1440px]">
        <aside className="hidden w-[284px] shrink-0 border-r border-[color:rgba(255,255,255,0.08)] lg:block">
          <AdminSidebar />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className={cn(
              "sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(5,11,17,0.70)] px-4 py-3 backdrop-blur-xl lg:hidden",
              "supports-[backdrop-filter]:bg-[color:rgba(5,11,17,0.55)]"
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Dialog.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <Dialog.Trigger asChild>
                  <Button variant="secondary" size="icon" aria-label="Open navigation">
                    <PanelLeft className="h-5 w-5" />
                  </Button>
                </Dialog.Trigger>

                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
                  <Dialog.Content className="fixed left-0 top-0 z-50 h-full w-[320px] max-w-[88vw] outline-none">
                    <Dialog.Title className="sr-only">KCX Admin navigation</Dialog.Title>
                    <Dialog.Description className="sr-only">Primary navigation for the KCX internal admin console.</Dialog.Description>
                    <div className="h-full border-r border-[color:rgba(255,255,255,0.10)] bg-[color:rgba(5,11,17,0.84)] backdrop-blur-2xl">
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold tracking-[-0.01em]">KCX Admin</div>
                          <div className="truncate text-xs text-text-on-dark-muted">Operations Console</div>
                        </div>
                        <Dialog.Close asChild>
                          <Button variant="ghost" size="icon" aria-label="Close navigation">
                            <X className="h-5 w-5" />
                          </Button>
                        </Dialog.Close>
                      </div>
                      <AdminSidebar mobile onNavigate={() => setMobileNavOpen(false)} />
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>

              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-[-0.01em]">KCX Admin</div>
                <div className="truncate text-xs text-text-on-dark-muted">
                  {location.pathname === "/" ? "Dashboard" : location.pathname.replace("/", "")}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden text-xs text-text-on-dark-muted sm:block">Enterprise Ops</div>
              <div className="h-1.5 w-1.5 rounded-full bg-[color:rgba(62,138,118,0.78)] shadow-[0_0_0_3px_rgba(62,138,118,0.12)]" />
            </div>
          </div>

          <main id="admin-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
