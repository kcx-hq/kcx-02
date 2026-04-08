import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { ADD_CONNECTION_PROVIDERS } from "./billingHelpers"

type ConnectNewCloudSectionProps = {
  onConnect: (href: string) => void
}

export function ConnectNewCloudSection({ onConnect }: ConnectNewCloudSectionProps) {
  return (
    <section className="rounded-md border border-[color:var(--border-light)] bg-white">
      <div className="border-b border-[color:var(--border-light)] px-4 py-3">
        <h3 className="text-base font-semibold text-text-primary">Connect a New Cloud</h3>
        <p className="text-sm text-text-secondary">Select a provider to set up a new billing integration.</p>
      </div>
      <div className="divide-y divide-[color:var(--border-light)]">
        {ADD_CONNECTION_PROVIDERS.map((provider) => {
          const isEnabled = provider.name === "AWS" && Boolean(provider.href)

          return (
            <div key={provider.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)]">
                <img src={provider.icon} alt={provider.name} className="h-5 w-5 object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">{provider.name}</p>
                <p className="text-xs text-text-secondary">{provider.description}</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-md",
                  isEnabled
                    ? "border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] text-brand-primary"
                    : "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-muted",
                )}
              >
                {provider.availability}
              </Badge>
              {isEnabled && provider.href ? (
                <Button variant="outline" className="h-9 rounded-md" onClick={() => onConnect(provider.href)}>
                  Connect
                </Button>
              ) : (
                <Button variant="outline" className="h-9 rounded-md" disabled>
                  Coming Soon
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
