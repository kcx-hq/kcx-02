import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MessageSquare, Phone, Ticket } from "lucide-react"

import { ClientPageHeader } from "@/features/client-home/components/ClientPageHeader"
import { handleAppLinkClick, useCurrentRoute } from "@/lib/navigation"
import { cn } from "@/lib/utils"

const SUPPORT_OPTIONS = [
  {
    label: "Tickets",
    href: "/client/support/tickets",
    description: "Open and track support issues.",
  },
  {
    label: "Schedule Call",
    href: "/client/support/schedule-call",
    description: "Book guided support sessions.",
  },
  {
    label: "Live Chat",
    href: "/client/support/live-chat",
    description: "Real-time help and quick answers.",
  },
] as const

export function ClientSupportPage() {
  const route = useCurrentRoute()
  const activeRoute = route === "/client/support" ? "/client/support/tickets" : route

  const activePanelTitle =
    activeRoute === "/client/support/schedule-call"
      ? "Schedule Call"
      : activeRoute === "/client/support/live-chat"
        ? "Live Chat"
        : "Tickets"

  return (
    <>
      <ClientPageHeader
        eyebrow="Support Workspace"
        title="Support"
        description="Access guided support actions for operations, incidents, and implementation assistance."
      />

      <section aria-label="Support options" className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
          <CardContent className="p-3">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Support Modules</p>
            <ul className="space-y-1.5">
              {SUPPORT_OPTIONS.map((option) => {
                const isActive = option.href === activeRoute
                const OptionIcon =
                  option.href === "/client/support/schedule-call"
                    ? Phone
                    : option.href === "/client/support/live-chat"
                      ? MessageSquare
                      : Ticket
                return (
                  <li key={option.href}>
                    <a
                      href={option.href}
                      onClick={(event) => handleAppLinkClick(event, option.href)}
                      className={cn(
                        "block rounded-md border px-3 py-2.5 transition-colors",
                        isActive
                          ? "border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)]"
                          : "border-transparent hover:border-[color:var(--border-light)] hover:bg-[color:var(--bg-surface)]"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md border",
                            isActive
                              ? "border-[color:var(--kcx-border-soft)] bg-white text-brand-primary"
                              : "border-[color:var(--border-light)] bg-white text-text-muted"
                          )}
                        >
                          <OptionIcon className="h-3.5 w-3.5" />
                        </span>
                        <div className="space-y-0.5">
                          <p className={cn("text-sm", isActive ? "font-semibold text-text-primary" : "font-medium text-text-secondary")}>
                            {option.label}
                          </p>
                          <p className="text-xs leading-5 text-text-muted">{option.description}</p>
                        </div>
                      </div>
                    </a>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-text-primary">{activePanelTitle} Panel</h2>
            {activeRoute === "/client/support/schedule-call" ? (
              <>
                <p className="text-sm text-text-secondary">
                  Book a session with the KCX team for billing onboarding, ingestion help, or operational reviews.
                </p>
                <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)]">Schedule Call</Button>
              </>
            ) : null}
            {activeRoute === "/client/support/live-chat" ? (
              <>
                <p className="text-sm text-text-secondary">
                  Live chat placeholder for quick guidance and issue triage during business hours.
                </p>
                <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)]">Open Live Chat</Button>
              </>
            ) : null}
            {activeRoute === "/client/support/tickets" ? (
              <>
                <p className="text-sm text-text-secondary">
                  View ticket queue and open tracked support requests for platform or billing issues.
                </p>
                <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4 text-sm text-text-muted">
                  No tickets yet. Create your first support ticket to begin tracking.
                </div>
                <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)]">Open Ticket</Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </>
  )
}
