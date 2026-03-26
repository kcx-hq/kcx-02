import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import kcxLogo from "@/assets/logos/kcx-logo.svg"
import { cn } from "@/lib/utils"

const NAV_ITEMS = ["Overview", "Billing", "Tickets", "Support", "Users"] as const

type ClientTopNavbarProps = {
  orgName: string
}

export function ClientTopNavbar({ orgName }: ClientTopNavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border-light)] bg-[color:var(--bg-surface)]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 flex-1 items-center gap-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src={kcxLogo} alt="KCX" className="h-7 w-auto" />
            <div className="h-5 w-px bg-[color:var(--border-light)]" />
            <p className="truncate text-sm font-medium text-text-secondary">{orgName}</p>
          </div>

          <nav className="hidden h-16 items-stretch gap-6 lg:flex" aria-label="Client workspace">
            {NAV_ITEMS.map((item) => {
              const isActive = item === "Overview"
              return (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "h-full border-b-2 border-transparent px-0 text-sm font-medium transition-colors",
                    isActive
                      ? "border-brand-primary text-text-primary"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Badge
            variant="outline"
            className="hidden rounded-md border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-primary sm:inline-flex"
          >
            Workspace
          </Badge>
          <Button variant="ghost" className="h-10 rounded-md border border-[color:var(--border-light)] px-2">
            <span className="sr-only">Open user menu</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--bg-soft)] text-sm font-semibold text-text-secondary">
              AK
            </span>
          </Button>
        </div>
      </div>
    </header>
  )
}
