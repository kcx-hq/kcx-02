import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import type { CloudConnection } from "./billingHelpers"

type AwsSetupConnectionSectionProps = {
  setupLoading: boolean
  setupError: string | null
  setupConnection: CloudConnection | null
  onLaunchAwsSetup: () => void
  onBackToSetupChoice: () => void
}

export function AwsSetupConnectionSection({
  setupLoading,
  setupError,
  setupConnection,
  onLaunchAwsSetup,
  onBackToSetupChoice,
}: AwsSetupConnectionSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <p className="kcx-eyebrow text-brand-primary">Setup AWS Connection</p>
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Setup AWS Connection</h2>
        <p className="text-sm text-text-secondary">Review connection details and launch guided setup.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card className="rounded-md border-[color:var(--border-light)] bg-white">
          <CardContent className="space-y-4 p-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text-primary">Connection Info</p>
              <p className="text-sm text-text-secondary">Connection Name, provider, and status.</p>
            </div>

            {setupLoading ? (
              <p className="text-sm text-text-secondary">Loading connection...</p>
            ) : setupError ? (
              <p className="text-sm text-rose-600">{setupError}</p>
            ) : setupConnection ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Connection Name</p>
                  <p className="text-sm font-medium text-text-primary">{setupConnection.connection_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Provider</p>
                  <p className="text-sm font-medium text-text-primary">{setupConnection.provider.toUpperCase()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Status</p>
                  <p className="text-sm font-medium text-text-primary">
                    {setupConnection.status.charAt(0).toUpperCase() + setupConnection.status.slice(1)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">Connection not found.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-md border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)]">
          <CardContent className="space-y-3 p-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text-primary">Setup Button</p>
              <p className="text-sm text-text-secondary">Launch AWS setup in a new window.</p>
            </div>
            <Button className="h-10 rounded-md" onClick={onLaunchAwsSetup}>
              Launch AWS Setup
            </Button>
            <Button variant="ghost" className="h-10 rounded-md" onClick={onBackToSetupChoice}>
              Back to Setup Choice
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
