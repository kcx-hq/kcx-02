import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight, CheckCircle2, Cloud, FileSpreadsheet, Plus, Wrench } from "lucide-react"

import { ClientPageHeader } from "@/features/client-home/components/ClientPageHeader"
import { handleAppLinkClick, navigateTo, useCurrentRoute } from "@/lib/navigation"
import { cn } from "@/lib/utils"

const BILLING_OPTIONS = [
  {
    label: "Upload CSV",
    href: "/client/billing/uploads",
    description: "Track CSV upload jobs and processing status.",
    icon: FileSpreadsheet,
  },
  {
    label: "Cloud Connections",
    href: "/client/billing/connections",
    description: "Manage providers and integration setup paths.",
    icon: Cloud,
  },
] as const

const CONNECTIONS: Array<{
  name: string
  provider: string
  status: string
  lastChecked: string
  stage: string
}> = [
  {
    name: "Primary-AWS-Connection",
    provider: "AWS",
    status: "Healthy",
    lastChecked: "Mar 26, 2026 - 09:21 UTC",
    stage: "Ingestion Active",
  },
  {
    name: "Billing-AWS-Connection",
    provider: "AWS",
    status: "Pending First Ingest",
    lastChecked: "Mar 26, 2026 - 09:20 UTC",
    stage: "Pending First Ingest",
  },
  {
    name: "Sandbox-Connection",
    provider: "AWS",
    status: "Not Available",
    lastChecked: "Mar 25, 2026 - 19:10 UTC",
    stage: "Needs Reconnect",
  },
]

const PROVIDERS = [
  { name: "AWS", icon: "/aws.svg", availability: "Available", href: "/client/billing/connections/aws" },
  { name: "Azure", icon: "/azure.svg", availability: "Available Soon" },
  { name: "GCP", icon: "/gcp.svg", availability: "Available Soon" },
  { name: "Oracle Cloud", icon: "/oracle.svg", availability: "Planned" },
  { name: "Custom", icon: "/icons/core-platform.png", availability: "Planned" },
] as const

function isCloudConnectionsRoute(path: string) {
  return path.startsWith("/client/billing/connections")
}

function ConnectionStatusBadge({ status }: { status: string }) {
  if (status === "Healthy") {
    return <Badge variant="outline" className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-700">Healthy</Badge>
  }
  if (status === "Pending First Ingest") {
    return <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-700">Pending</Badge>
  }
  if (status === "Failed") {
    return <Badge variant="outline" className="rounded-md border-rose-200 bg-rose-50 text-rose-700">Failed</Badge>
  }
  return <Badge variant="outline" className="rounded-md border-slate-300 bg-slate-100 text-slate-700">Not Available</Badge>
}

function ProviderCard({
  name,
  icon,
  availability,
  href,
}: {
  name: string
  icon: string
  availability: string
  href?: string
}) {
  const isClickable = Boolean(href)
  const cardClassName = cn(
    "rounded-md border border-[color:var(--border-light)] bg-white p-4 transition-colors",
    isClickable ? "hover:border-[color:var(--kcx-border-soft)] hover:bg-[color:var(--bg-surface)]" : "opacity-90"
  )

  const content = (
    <div className={cardClassName}>
      <div className="flex items-center justify-between">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)]">
          <img src={icon} alt={name} className="h-5 w-5 object-contain" />
        </span>
        <Badge
          variant="outline"
          className={cn(
            "rounded-md",
            availability === "Available"
              ? "border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] text-brand-primary"
              : "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-muted"
          )}
        >
          {availability}
        </Badge>
      </div>
      <p className="mt-3 text-sm font-semibold text-text-primary">{name}</p>
    </div>
  )

  if (!href) return content
  return (
    <a href={href} onClick={(event) => handleAppLinkClick(event, href)}>
      {content}
    </a>
  )
}

export function ClientBillingPage() {
  const route = useCurrentRoute()
  const activeRoute = route === "/client/billing" ? "/client/billing/connections" : route

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
                  option.href === "/client/billing/connections" ? isCloudConnectionsRoute(activeRoute) : option.href === activeRoute
                const OptionIcon = option.icon

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
          <CardContent className="space-y-6 p-6">
            {activeRoute === "/client/billing/uploads" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">Upload CSV</p>
                  <h2 className="text-lg font-semibold text-text-primary">Upload History</h2>
                  <p className="text-sm text-text-secondary">
                    CSV upload history and parsing diagnostics will appear here in the next billing sprint.
                  </p>
                </div>
                <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4 text-sm text-text-muted">
                  No upload records available yet.
                </div>
              </>
            ) : null}

            {activeRoute === "/client/billing/connections" ? (
              <>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <p className="kcx-eyebrow text-brand-primary">Cloud Connections</p>
                    <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Cloud Connections</h2>
                    <p className="text-sm text-text-secondary">
                      Manage connected cloud accounts, monitor setup status, and start new billing integrations.
                    </p>
                  </div>
                  <Button className="h-10 rounded-md" onClick={() => navigateTo("/client/billing/connections/aws")}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Connection
                  </Button>
                </div>

                <section className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-text-primary">Current Connections</h3>
                    <p className="text-sm text-text-secondary">Live view of billing integration health and ingestion state.</p>
                  </div>
                  {CONNECTIONS.length < 1 ? (
                    <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-6">
                      <p className="text-sm text-text-secondary">No cloud connections yet.</p>
                      <Button className="mt-3 h-10 rounded-md" onClick={() => navigateTo("/client/billing/connections/aws")}>
                        Add Your First Connection
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-md border border-[color:var(--border-light)]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Connection Name</TableHead>
                            <TableHead>Provider</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Checked</TableHead>
                            <TableHead>Last Success / Stage</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {CONNECTIONS.map((connection) => (
                            <TableRow key={connection.name}>
                              <TableCell className="font-medium text-text-primary">{connection.name}</TableCell>
                              <TableCell>{connection.provider}</TableCell>
                              <TableCell><ConnectionStatusBadge status={connection.status} /></TableCell>
                              <TableCell>{connection.lastChecked}</TableCell>
                              <TableCell>{connection.stage}</TableCell>
                              <TableCell>
                                <Button variant="ghost" className="h-8 rounded-md px-2 text-sm text-text-secondary">
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-text-primary">Add a New Connection</h3>
                    <p className="text-sm text-text-secondary">Choose a provider to begin a new billing connection.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                    {PROVIDERS.map((provider) => (
                      <ProviderCard key={provider.name} {...provider} />
                    ))}
                  </div>
                </section>
              </>
            ) : null}

            {activeRoute === "/client/billing/connections/aws" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">AWS Setup Choice</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Choose Setup Method</h2>
                  <p className="text-sm text-text-secondary">
                    Select how you want to connect AWS billing data into KCX.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card className="rounded-md border-[color:var(--border-light)] bg-[color:var(--bg-surface)]">
                    <CardContent className="space-y-3 p-5">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-white text-text-secondary">
                        <Cloud className="h-4 w-4" />
                      </span>
                      <h3 className="text-base font-semibold text-text-primary">Automatic Setup</h3>
                      <p className="text-sm text-text-secondary">Guided cloud-native onboarding with secure automated provisioning.</p>
                      <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)]" disabled>
                        Coming Soon
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="rounded-md border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)]">
                    <CardContent className="space-y-3 p-5">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--kcx-border-soft)] bg-white text-brand-primary">
                        <Wrench className="h-4 w-4" />
                      </span>
                      <h3 className="text-base font-semibold text-text-primary">Manual Setup</h3>
                      <p className="text-sm text-text-secondary">Use account details and IAM role configuration to connect billing manually.</p>
                      <Button className="h-10 rounded-md" onClick={() => navigateTo("/client/billing/connections/aws/manual")}>
                        Start Manual Setup
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}

            {activeRoute === "/client/billing/connections/aws/manual" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">AWS Manual Setup</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Manual Setup</h2>
                  <p className="text-sm text-text-secondary">
                    Provide AWS account details to configure billing ingestion.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Connection Name</span>
                    <input className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]" placeholder="Primary-AWS-Connection" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Provider</span>
                    <input className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]" value="AWS" readOnly />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">AWS Account ID</span>
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
                    Validate access before activating ingestion.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button className="h-10 rounded-md">Save Connection</Button>
                  <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)]">Test Access</Button>
                  <Button variant="ghost" className="h-10 rounded-md" onClick={() => navigateTo("/client/billing/connections")}>
                    Back to Connections
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </>
  )
}
