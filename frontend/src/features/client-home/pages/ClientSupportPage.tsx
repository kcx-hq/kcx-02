import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MessageSquare, Phone, Ticket } from "lucide-react"

import { handleAppLinkClick, useCurrentRoute } from "@/lib/navigation"
import { cn } from "@/lib/utils"

const SUPPORT_OPTIONS = [
  {
    label: "Ticket Management",
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
  const liveChatOption = SUPPORT_OPTIONS.find((option) => option.href === "/client/support/live-chat")
  const cardOptions = SUPPORT_OPTIONS.filter((option) => option.href !== "/client/support/live-chat")

  const activePanelTitle =
    activeRoute === "/client/support/schedule-call"
      ? "Schedule Call"
      : activeRoute === "/client/support/live-chat"
        ? "Live Chat"
        : "Ticket Management"

  return (
    <>
      <section aria-label="Support options" className="space-y-5">
        <ul className="flex flex-wrap items-center gap-2 border-b border-[color:var(--border-light)] pb-3">
          {cardOptions.map((option) => {
            const isActive = option.href === activeRoute
            const OptionIcon =
              option.href === "/client/support/schedule-call"
                ? Phone
                : Ticket
            return (
              <li key={option.href}>
                <a
                  href={option.href}
                  onClick={(event) => handleAppLinkClick(event, option.href)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-[color:var(--highlight-green)] font-semibold text-text-primary"
                      : "text-text-secondary hover:bg-[color:var(--bg-surface)] hover:text-text-primary"
                  )}
                >
                  <OptionIcon className="h-4 w-4" />
                  <span>{option.label}</span>
                </a>
              </li>
            )
          })}
        </ul>

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

      {liveChatOption ? (
        <a
          href={liveChatOption.href}
          aria-label={liveChatOption.label}
          title={liveChatOption.label}
          onClick={(event) => handleAppLinkClick(event, liveChatOption.href)}
          className={cn(
            "fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border shadow-sm-custom transition-all duration-200 hover:scale-105",
            activeRoute === liveChatOption.href
              ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] text-white shadow-[0_10px_24px_rgba(34,102,88,0.35)] hover:bg-[color:var(--highlight-green)] hover:text-brand-primary"
              : "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] text-white shadow-[0_10px_24px_rgba(34,102,88,0.35)] hover:bg-[color:var(--highlight-green)] hover:text-brand-primary"
          )}
        >
          <MessageSquare className="h-5 w-5 text-current" />
        </a>
      ) : null}
    </>
  )
}
