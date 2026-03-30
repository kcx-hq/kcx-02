import { useEffect, useMemo , useState } from "react"
// STEP 1:
// Client prepares billing data source (S3 bucket)
// This feeds into cross-account access setup in Step 2

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight, CheckCircle2, Cloud, ExternalLink, FileSpreadsheet, Plus, Wrench } from "lucide-react"

import { ClientPageHeader } from "@/features/client-home/components/ClientPageHeader"
import { ApiError, apiGet, apiPost } from "@/lib/api"
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
}> = []

const PROVIDERS = [
  { name: "AWS", icon: "/aws.svg", availability: "Available", href: "/client/billing/connections/aws" },
  { name: "Azure", icon: "/azure.svg", availability: "Beta" },
  { name: "GCP", icon: "/gcp.svg", availability: "Available Soon" },
  { name: "Oracle Cloud", icon: "/oracle.svg", availability: "Planned" },
  { name: "Custom", icon: "/icons/core-platform.png", availability: "Planned" },
] as const

const ADD_CONNECTION_PROVIDERS = [
  { name: "AWS", icon: "/aws.svg", availability: "Available", description: "Connect AWS billing for cost ingestion.", href: "/client/billing/connections/aws" },
  { name: "Azure", icon: "/azure.svg", availability: "Beta", description: "Azure billing integration is currently in beta." },
  { name: "GCP", icon: "/gcp.svg", availability: "Planned", description: "GCP billing integration will be available soon." },
  { name: "Oracle Cloud", icon: "/oracle.svg", availability: "Planned", description: "Oracle billing integration will be available soon." },
  { name: "Custom", icon: "/icons/core-platform.png", availability: "Planned", description: "Custom source ingestion is planned." },
] as const

function isCloudConnectionsRoute(path: string) {
  return path.startsWith("/client/billing/connections")
}

const AWS_SETUP_ROUTE_REGEX = /^\/client\/billing\/connections\/aws\/setup\/([0-9a-fA-F-]{36})$/

type CloudConnection = {
  id: string
  connection_name: string
  provider: string
  status: string
  account_type: string
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

function AddConnectionProviderCard({
  name,
  icon,
  availability,
  description,
  href,
}: {
  name: string
  icon: string
  availability: string
  description: string
  href?: string
}) {
  const isEnabled = availability === "Available" && Boolean(href)
  const className = cn(
    "h-full rounded-md border bg-white p-5 transition-colors",
    isEnabled
      ? "border-[color:var(--kcx-border-soft)] hover:bg-[color:var(--bg-surface)] hover:border-[color:var(--kcx-border-strong)]"
      : "border-[color:var(--border-light)]"
  )

  const content = (
    <div className={className}>
      <div className="flex items-center justify-between">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)]">
          <img src={icon} alt={name} className="h-5 w-5 object-contain" />
        </span>
        <Badge
          variant="outline"
          className={cn(
            "rounded-md",
            isEnabled
              ? "border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] text-brand-primary"
              : "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-muted"
          )}
        >
          {availability}
        </Badge>
      </div>
      <h3 className="mt-4 text-base font-semibold text-text-primary">{name}</h3>
      <p className="mt-1.5 min-h-[3rem] text-sm leading-6 text-text-secondary">{description}</p>
    </div>
  )

  if (!isEnabled || !href) return content

  return (
    <a href={href} onClick={(event) => handleAppLinkClick(event, href)} className="block h-full">
      {content}
    </a>
  )
}

function AwsLoginSection() {
  const billingConsoleUrl = "https://console.aws.amazon.com/costmanagement/home#/bcm-data-exports"

  return (
    <section className="space-y-3 rounded-md border border-gray-200 bg-white p-5">
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-text-primary">Access AWS Console</h4>
        <p className="text-sm text-text-secondary">
          Log in to your AWS account to configure billing data export.
        </p>
      </div>
      <div>
        <a href={billingConsoleUrl} target="_blank" rel="noreferrer">
          <Button variant="outline" className="h-10 rounded-md border-gray-200">
            Open AWS Billing Console
            <ExternalLink className="ml-1.5 h-4 w-4" />
          </Button>
        </a>
      </div>
    </section>
  )
}

function DataExportChecklist() {
  return (
    <section className="space-y-3 rounded-md border border-gray-200 bg-white p-5">
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-text-primary">Set up billing data export</h4>
        <p className="text-sm text-text-secondary">
          Ensure your Cost &amp; Usage data is configured to be delivered to an S3 bucket.
        </p>
      </div>
      <ul className="space-y-2">
        <li className="flex items-center gap-2 text-sm text-text-secondary">
          <CheckCircle2 className="h-4 w-4 text-text-muted" />
          Data export is enabled
        </li>
        <li className="flex items-center gap-2 text-sm text-text-secondary">
          <CheckCircle2 className="h-4 w-4 text-text-muted" />
          Delivery is configured to S3
        </li>
        <li className="flex items-center gap-2 text-sm text-text-secondary">
          <CheckCircle2 className="h-4 w-4 text-text-muted" />
          Data is updated regularly
        </li>
      </ul>
      <p className="text-xs text-text-muted">
        If you have already configured billing export, you can proceed.
      </p>
    </section>
  )
}

function S3InputSection({
  bucketName,
  pathPrefix,
  onBucketNameChange,
  onPathPrefixChange,
  showBucketFormatHint,
}: {
  bucketName: string
  pathPrefix: string
  onBucketNameChange: (value: string) => void
  onPathPrefixChange: (value: string) => void
  showBucketFormatHint: boolean
}) {
  return (
    <section className="space-y-4 rounded-md border border-gray-200 bg-white p-5">
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">S3 Bucket Name</span>
        <input
          className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
          placeholder="e.g. my-company-billing-bucket"
          value={bucketName}
          onChange={(event) => onBucketNameChange(event.target.value)}
        />
      </label>
      {showBucketFormatHint ? (
        <p className="text-xs text-text-muted">Bucket names should not contain spaces.</p>
      ) : null}
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">S3 Path Prefix (optional)</span>
        <input
          className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
          placeholder="e.g. billing-reports/"
          value={pathPrefix}
          onChange={(event) => onPathPrefixChange(event.target.value)}
        />
      </label>
      <p className="text-xs text-text-muted">
        Specify a folder path if your billing files are stored inside a subdirectory.
      </p>
    </section>
  )
}

function ManualSetupStepOne() {
  const [bucketName, setBucketName] = useState("")
  const [pathPrefix, setPathPrefix] = useState("")

  const hasBucketName = bucketName.trim().length > 0
  const hasNoSpacesInBucketName = !/\s/.test(bucketName)
  const showBucketFormatHint = hasBucketName && !hasNoSpacesInBucketName

  const canContinue = useMemo(() => {
    return hasBucketName && hasNoSpacesInBucketName
  }, [hasBucketName, hasNoSpacesInBucketName])

  return (
    <Card className="rounded-md border-gray-200 bg-[color:var(--bg-surface)] shadow-none">
      <CardContent className="space-y-5 p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Step 1</p>
          <h3 className="text-lg font-semibold text-text-primary">Prepare your billing data</h3>
          <p className="text-sm text-text-secondary">
            Before connecting your AWS account, ensure your billing data is exported to an S3 bucket.
          </p>
        </div>
        <AwsLoginSection />
        <DataExportChecklist />
        <S3InputSection
          bucketName={bucketName}
          pathPrefix={pathPrefix}
          onBucketNameChange={setBucketName}
          onPathPrefixChange={setPathPrefix}
          showBucketFormatHint={showBucketFormatHint}
        />
        <div className="flex justify-end">
          <Button
            className="h-10 rounded-md"
            disabled={!canContinue}
            onClick={() => navigateTo("/client/billing/connections/aws/manual/step-2")}
          >
            Continue to Step 2
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function ClientBillingPage() {
  const route = useCurrentRoute()
  const activeRoute = route === "/client/billing" ? "/client/billing/connections" : route

  const [autoConnectionName, setAutoConnectionName] = useState("")
  const [autoAccountType, setAutoAccountType] = useState<"payer" | "member">("payer")
  const [autoTouched, setAutoTouched] = useState(false)
  const [autoSubmitting, setAutoSubmitting] = useState(false)
  const [autoError, setAutoError] = useState<string | null>(null)

  const setupConnectionId = useMemo(() => {
    const match = AWS_SETUP_ROUTE_REGEX.exec(activeRoute)
    if (!match) return null
    return match[1]
  }, [activeRoute])

  const [setupConnection, setSetupConnection] = useState<CloudConnection | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  useEffect(() => {
    if (!setupConnectionId) return
    setSetupLoading(true)
    setSetupError(null)
    void (async () => {
      try {
        const connection = await apiGet<CloudConnection>(`/cloud-connections/${setupConnectionId}`)
        setSetupConnection(connection)
      } catch (error) {
        if (error instanceof ApiError) {
          setSetupError(error.message || "Failed to load connection")
        } else {
          setSetupError("Failed to load connection")
        }
        setSetupConnection(null)
      } finally {
        setSetupLoading(false)
      }
    })()
  }, [setupConnectionId])

  function validateAutoConnectionName(value: string) {
    return value.trim().length > 0
  }

  function onSubmitAutomaticSetup() {
    setAutoTouched(true)
    setAutoError(null)
    if (!validateAutoConnectionName(autoConnectionName)) return

    setAutoSubmitting(true)
    void (async () => {
      try {
        await apiPost<CloudConnection>("/cloud-connections", {
          connection_name: autoConnectionName.trim(),
          provider: "aws",
          status: "draft",
          account_type: autoAccountType,
        })
        navigateTo("/integrations/aws")
      } catch (error) {
        if (error instanceof ApiError) {
          setAutoError(error.message || "Failed to create connection")
        } else {
          setAutoError("Failed to create connection")
        }
      } finally {
        setAutoSubmitting(false)
      }
    })()
  }

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
                  <Button className="h-10 rounded-md" onClick={() => navigateTo("/client/billing/connections/add")}>
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
                      <p className="text-sm text-text-secondary">No active cloud connections found. Connected accounts will appear here once billing integration is configured.</p>
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

            {activeRoute === "/client/billing/connections/add" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">Add Connection</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Choose Cloud Provider</h2>
                  <p className="text-sm text-text-secondary">
                    Select a cloud provider to begin a new billing integration setup.
                  </p>
                </div>
                <div className="grid grid-cols-1 auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {ADD_CONNECTION_PROVIDERS.map((provider) => (
                    <AddConnectionProviderCard key={provider.name} {...provider} />
                  ))}
                </div>
                <div className="border-t border-[color:var(--border-light)] pt-4">
                  <Button variant="ghost" className="h-10 rounded-md" onClick={() => navigateTo("/client/billing/connections")}>
                    <ArrowRight className="mr-1.5 h-4 w-4 rotate-180" />
                    Back to Cloud Connections
                  </Button>
                </div>
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
                      <h3 className="text-base font-semibold text-text-primary">Automatic Setup </h3>
                      <p className="text-sm text-text-secondary">Guided cloud-native onboarding with secure automated provisioning.</p>
                      <Button
                        variant="outline"
                        className="h-10 rounded-md border-[color:var(--border-light)]"
                        onClick={() => navigateTo("/client/billing/connections/aws/automatic")}
                      >
                        Start Automatic Setup
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

            {activeRoute === "/client/billing/connections/aws/automatic" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">AWS Automatic Setup</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Start Automatic Setup</h2>
                  <p className="text-sm text-text-secondary">Create an AWS connection to begin guided setup.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                      Connection Name
                      <span className="ml-2 align-middle text-[11px] font-semibold text-brand-primary">Required</span>
                    </span>
                    <input
                      className={cn(
                        "h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]",
                        autoTouched && !validateAutoConnectionName(autoConnectionName)
                          ? "border-rose-300"
                          : "border-[color:var(--border-light)]"
                      )}
                      placeholder="prod-aws-account"
                      value={autoConnectionName}
                      onChange={(event) => setAutoConnectionName(event.target.value)}
                      onBlur={() => setAutoTouched(true)}
                      required
                    />
                    {autoTouched && !validateAutoConnectionName(autoConnectionName) ? (
                      <p className="text-xs text-rose-600">Connection Name is required.</p>
                    ) : null}
                    {autoError ? <p className="text-xs text-rose-600">{autoError}</p> : null}
                  </label>

                  <fieldset className="space-y-2 md:col-span-2">
                    <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                      Account Type
                      <span className="ml-2 align-middle text-[11px] font-semibold text-brand-primary">Required</span>
                    </legend>
                    <div className="space-y-2 rounded-md border border-[color:var(--border-light)] bg-white p-3">
                      <label className="flex items-center gap-2 text-sm text-text-primary">
                        <input
                          type="radio"
                          name="aws-account-type"
                          value="payer"
                          checked={autoAccountType === "payer"}
                          onChange={() => setAutoAccountType("payer")}
                          className="h-4 w-4 accent-[color:var(--brand-primary)]"
                        />
                        <span className="font-medium">Payer Account</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-text-primary">
                        <input
                          type="radio"
                          name="aws-account-type"
                          value="member"
                          checked={autoAccountType === "member"}
                          onChange={() => setAutoAccountType("member")}
                          className="h-4 w-4 accent-[color:var(--brand-primary)]"
                        />
                        <span className="font-medium">Member Account</span>
                      </label>
                    </div>
                  </fieldset>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button className="h-10 rounded-md" disabled={autoSubmitting} onClick={onSubmitAutomaticSetup}>
                    {autoSubmitting ? "Saving..." : "Continue Setup"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-10 rounded-md"
                    onClick={() => navigateTo("/client/billing/connections/aws")}
                  >
                    Back
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : null}

            {setupConnectionId ? (
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
                      <Button
                        className="h-10 rounded-md"
                        onClick={() => window.open("/integrations/aws", "_blank", "noopener,noreferrer")}
                      >
                        Launch AWS Setup
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-10 rounded-md"
                        onClick={() => navigateTo("/client/billing/connections/aws")}
                      >
                        Back to Setup Choice
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}

            {activeRoute === "/client/billing/connections/aws/manual" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">AWS MANUAL SETUP</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Manual Setup</h2>
                  <p className="text-sm text-text-secondary">
                    Connect your AWS billing data step-by-step.
                  </p>
                </div>
                <ManualSetupStepOne />
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </>
  )
}
