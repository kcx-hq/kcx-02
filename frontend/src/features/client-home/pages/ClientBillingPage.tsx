import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle2, Cloud, FileSpreadsheet, Plus, Sparkles, Wrench } from "lucide-react"

import { ClientPageHeader } from "@/features/client-home/components/ClientPageHeader"
import { handleAppLinkClick, navigateTo, useCurrentRoute } from "@/lib/navigation"
import { cn } from "@/lib/utils"

const BILLING_OPTIONS = [
  {
    label: "Upload CSV",
    href: "/client/billing/uploads",
    description: "Track CSV upload jobs, outcomes, and retries.",
    panelTitle: "Upload History",
    panelDescription: "Recent upload activity and processing outcomes will appear in this panel.",
    cta: "View Uploads",
  },
  {
    label: "Cloud Connections",
    href: "/client/billing/connections",
    description: "Monitor providers, connection health, and setup.",
    panelTitle: "Cloud Connections",
    panelDescription: "Manage provider integrations and billing ingestion setup.",
    cta: "Manage Connections",
  },
] as const

const CONNECTIONS = [
  { name: "Prod AWS Billing", provider: "AWS", lastChecked: "Mar 26, 2026 · 09:21 UTC", lastSuccess: "Pending first ingest", status: "Pending" },
  { name: "Stage AWS Billing", provider: "AWS", lastChecked: "Mar 26, 2026 · 09:21 UTC", lastSuccess: "Mar 25, 2026 · 19:39 UTC", status: "Healthy" },
] as const

const PROVIDERS = [
  { name: "AWS", icon: "/aws.svg", state: "Connected" },
  { name: "Azure", icon: "/azure.svg", state: "Available" },
  { name: "GCP", icon: "/gcp.svg", state: "Available" },
  { name: "Oracle", icon: "/oracle.svg", state: "Available" },
] as const

function isCloudConnectionsRoute(path: string) {
  return path.startsWith("/client/billing/connections")
}

export function ClientBillingPage() {
  const route = useCurrentRoute()
  const activeRoute = route === "/client/billing" ? "/client/billing/uploads" : route
  const activeOption = isCloudConnectionsRoute(activeRoute)
    ? BILLING_OPTIONS[1]
    : BILLING_OPTIONS.find((option) => option.href === activeRoute) ?? BILLING_OPTIONS[0]

  const ActiveIcon = activeOption.href === "/client/billing/connections" ? Cloud : FileSpreadsheet

  return (
    <>
      <ClientPageHeader
        eyebrow="Billing Workspace"
        title="Billing"
        description="Manage uploads, cloud connections, and billing ingestion workflows."
      />

      <section aria-label="Billing workspace options" className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
          <CardContent className="p-3">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Billing Modules</p>
            <ul className="space-y-1.5">
              {BILLING_OPTIONS.map((option) => {
                const isActive =
                  option.href === "/client/billing/connections"
                    ? isCloudConnectionsRoute(activeRoute)
                    : option.href === activeRoute
                const OptionIcon =
                  option.href === "/client/billing/connections" ? Cloud : FileSpreadsheet

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
            {activeRoute === "/client/billing/uploads" ? (
              <>
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary">
                  <ActiveIcon className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-text-primary">{activeOption.panelTitle}</h2>
                  <p className="text-sm leading-6 text-text-secondary">{activeOption.panelDescription}</p>
                </div>
                <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4 text-sm text-text-muted">
                  Upload history table will appear here with job status and ingestion diagnostics.
                </div>
                <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)]">
                  {activeOption.cta}
                </Button>
              </>
            ) : null}

            {activeRoute === "/client/billing/connections" ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-text-primary">Cloud Connections Overview</h2>
                    <p className="text-sm text-text-secondary">
                      Review connection health, sync recency, and provider coverage for billing ingestion.
                    </p>
                  </div>
                  <Button
                    className="h-10 rounded-md"
                    onClick={() => navigateTo("/client/billing/connections/add")}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Connection
                  </Button>
                </div>

                <div className="rounded-md border border-[color:var(--border-light)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Last Checked</TableHead>
                        <TableHead>Last Success</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {CONNECTIONS.map((connection) => (
                        <TableRow key={connection.name}>
                          <TableCell className="font-medium text-text-primary">{connection.name}</TableCell>
                          <TableCell>{connection.provider}</TableCell>
                          <TableCell>{connection.lastChecked}</TableCell>
                          <TableCell>{connection.lastSuccess}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-md",
                                connection.status === "Healthy"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                              )}
                            >
                              {connection.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-primary">Provider Catalog</p>
                    <p className="text-xs text-text-muted">Select a provider when adding a new connection</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {PROVIDERS.map((provider) => (
                      <div
                        key={provider.name}
                        className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white">
                            <img src={provider.icon} alt={provider.name} className="h-5 w-5 object-contain" />
                          </span>
                          <div>
                            <p className="text-sm font-medium text-text-primary">{provider.name}</p>
                            <p className="text-xs text-text-muted">{provider.state}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeRoute === "/client/billing/connections/add" ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-text-primary">Add Connection</h2>
                  <p className="text-sm text-text-secondary">
                    Choose how you want to create a new cloud billing connection.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card className="rounded-md border-[color:var(--border-light)] bg-[color:var(--bg-surface)]">
                    <CardContent className="space-y-3 p-5">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-white text-text-secondary">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <h3 className="text-base font-semibold text-text-primary">Auto Setup</h3>
                      <p className="text-sm text-text-secondary">Guided auto configuration flow with secure provider handoff.</p>
                      <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)]">Coming Soon</Button>
                    </CardContent>
                  </Card>
                  <Card className="rounded-md border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)]">
                    <CardContent className="space-y-3 p-5">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--kcx-border-soft)] bg-white text-brand-primary">
                        <Wrench className="h-4 w-4" />
                      </span>
                      <h3 className="text-base font-semibold text-text-primary">Manual Setup</h3>
                      <p className="text-sm text-text-secondary">Configure IAM and ingestion details manually for immediate onboarding.</p>
                      <Button
                        className="h-10 rounded-md"
                        onClick={() => navigateTo("/client/billing/connections/manual-setup")}
                      >
                        Start Manual Setup
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}

            {activeRoute === "/client/billing/connections/manual-setup" ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-text-primary">Manual Setup</h2>
                  <p className="text-sm text-text-secondary">
                    Enter cloud account and role details to configure manual billing ingestion.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Connection Name</span>
                    <input className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]" placeholder="Example: Production AWS Billing" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Provider</span>
                    <input className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]" value="AWS" readOnly />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Account ID</span>
                    <input className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]" placeholder="123456789012" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">IAM Role ARN</span>
                    <input className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]" placeholder="arn:aws:iam::123456789012:role/kcx-billing-role" />
                  </label>
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">External ID</span>
                    <input className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]" placeholder="kcx-external-id" />
                  </label>
                </div>

                <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
                  <p className="flex items-center gap-2 text-sm text-text-secondary">
                    <CheckCircle2 className="h-4 w-4 text-brand-primary" />
                    Save details and validate permissions to activate ingestion.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button className="h-10 rounded-md">Save Connection</Button>
                  <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)]">Test Access</Button>
                  <Button
                    variant="ghost"
                    className="h-10 rounded-md"
                    onClick={() => navigateTo("/client/billing/connections")}
                  >
                    Back to Connections
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </>
  )
}
