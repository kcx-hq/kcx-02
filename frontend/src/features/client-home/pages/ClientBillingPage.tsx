import { useEffect, useMemo , useState, type ReactNode } from "react"
// STEP 1:
// Client prepares billing data source (S3 bucket)
// This feeds into cross-account access setup in Step 2

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, CheckCircle2, Cloud, ExternalLink, FileSpreadsheet, Wrench } from "lucide-react"

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
    href: "/client/billing/connect-cloud",
    description: "Manage providers and integration setup paths.",
    icon: Cloud,
  },
] as const

const ADD_CONNECTION_PROVIDERS = [
  { name: "AWS", icon: "/aws.svg", availability: "Available", description: "Connect AWS billing for cost ingestion.", href: "/client/billing/connect-cloud/aws" },
  { name: "Azure", icon: "/azure.svg", availability: "Beta", description: "Azure billing integration is currently in beta.", href: "/client/billing/connect-cloud/azure" },
  { name: "GCP", icon: "/gcp.svg", availability: "Planned", description: "GCP billing integration will be available soon.", href: "/client/billing/connect-cloud/gcp" },
  { name: "Oracle Cloud", icon: "/oracle.svg", availability: "Planned", description: "Oracle billing integration will be available soon.", href: "/client/billing/connect-cloud/oracle-cloud" },
] as const

function isCloudConnectionsRoute(path: string) {
  return path.startsWith("/client/billing/connect-cloud") || path.startsWith("/client/billing/connections")
}

const AWS_SETUP_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/aws\/setup\/([0-9a-fA-F-]{36})$/
const CLOUD_PROVIDER_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/(aws|azure|gcp|oracle-cloud)(?:\/|$)/
const CLOUD_SETUP_METHOD_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/(?:aws|azure|gcp|oracle-cloud)\/(automatic|manual)(?:\/|$)/

const CLOUD_PROVIDER_LABELS: Record<string, string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  "oracle-cloud": "Oracle Cloud",
}

type CloudConnection = {
  id: string
  connection_name: string
  provider: string
  status: string
  account_type: string
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
  const isEnabled = Boolean(href)
  const className = cn(
    "h-full rounded-md border bg-white p-4 transition-colors",
    isEnabled
      ? "border-[color:var(--kcx-border-soft)] hover:bg-[color:var(--bg-surface)] hover:border-[color:var(--kcx-border-strong)]"
      : "border-[color:var(--border-light)]"
  )

  const content = (
    <div className={className}>
      <div className="flex items-center justify-between">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)]">
          <img src={icon} alt={name} className="h-7 w-7 object-contain" />
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
      <h3 className="mt-3 text-base font-semibold text-text-primary">{name}</h3>
      <p className="mt-1 text-sm leading-5 text-text-secondary">{description}</p>
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
  const activeRoute = route
  const isBillingHubRoute = activeRoute === "/client/billing"
  const cloudProviderSlug = useMemo(() => {
    const match = CLOUD_PROVIDER_ROUTE_REGEX.exec(activeRoute)
    if (!match) return null
    return match[1]
  }, [activeRoute])
  const cloudProviderName = cloudProviderSlug ? CLOUD_PROVIDER_LABELS[cloudProviderSlug] : null
  const cloudSetupMethod = useMemo(() => {
    const match = CLOUD_SETUP_METHOD_ROUTE_REGEX.exec(activeRoute)
    if (!match) return null
    return match[1] === "automatic" ? "Automatic" : "Manual"
  }, [activeRoute])
  const cloudProviderRoute = cloudProviderSlug ? `/client/billing/connect-cloud/${cloudProviderSlug}` : null

  const pageHeaderTitle: ReactNode = useMemo(() => {
    if (!isCloudConnectionsRoute(activeRoute)) return "Billing"

    const linkClass = "text-brand-primary hover:underline"
    const dividerClass = "mx-2 text-text-muted"

    return (
      <>
        <span>Billing</span>
        <span className={dividerClass}>/</span>
        {cloudProviderName ? (
          <a
            href="/client/billing/connect-cloud"
            onClick={(event) => handleAppLinkClick(event, "/client/billing/connect-cloud")}
            className={linkClass}
          >
            Cloud Connection
          </a>
        ) : (
          <span>Cloud Connection</span>
        )}
        {cloudProviderName ? (
          <>
            <span className={dividerClass}>/</span>
            {cloudSetupMethod && cloudProviderRoute ? (
              <a href={cloudProviderRoute} onClick={(event) => handleAppLinkClick(event, cloudProviderRoute)} className={linkClass}>
                {cloudProviderName}
              </a>
            ) : (
              <span>{cloudProviderName}</span>
            )}
          </>
        ) : null}
        {cloudSetupMethod ? (
          <>
            <span className={dividerClass}>/</span>
            <span>{cloudSetupMethod}</span>
          </>
        ) : null}
      </>
    )
  }, [activeRoute, cloudProviderName, cloudProviderRoute, cloudSetupMethod])
  const pageHeaderDescription = isCloudConnectionsRoute(activeRoute)
    ? "Manage connected cloud accounts and integration setup."
    : "Choose how you want to start billing ingestion."

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

    // Open a tab immediately from the user click to avoid popup blockers.
    // Do not use noopener here because some browsers return null window handles,
    // which prevents us from assigning the backend URL after async calls complete.
    const setupTab = window.open("about:blank", "_blank")
    setAutoSubmitting(true)
    void (async () => {
      try {
        const created = await apiPost<CloudConnection>("/cloud-connections", {
          connection_name: autoConnectionName.trim(),
          provider: "aws",
          status: "draft",
          account_type: autoAccountType,
        })

        const setup = await apiGet<{ url: string }>(`/cloud-connections/${created.id}/aws-cloudformation-url`)
        if (setupTab) {
          setupTab.opener = null
          setupTab.location.href = setup.url
        } else {
          window.open(setup.url, "_blank", "noopener,noreferrer")
        }
      } catch (error) {
        if (setupTab && !setupTab.closed) {
          setupTab.close()
        }
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

  if (isBillingHubRoute) {
    return (
      <>
        <ClientPageHeader eyebrow="Billing Workspace" title={pageHeaderTitle} description={pageHeaderDescription} />

        <section aria-label="Billing quick start" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {BILLING_OPTIONS.map((option) => {
            const OptionIcon = option.icon
            const isCloud = option.href === "/client/billing/connect-cloud"

            return (
              <Card
                key={option.href}
                className={cn(
                  "group relative overflow-hidden rounded-md border shadow-sm-custom transition-all",
                  isCloud
                    ? "border-[color:var(--kcx-border-soft)] bg-[linear-gradient(160deg,#f6fffb_0%,#f2faf7_46%,#ffffff_100%)]"
                    : "border-[color:var(--border-light)] bg-[linear-gradient(160deg,#ffffff_0%,#f7faf9_100%)]"
                )}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-2xl",
                    isCloud ? "bg-[rgba(63,154,125,0.16)]" : "bg-[rgba(35,110,88,0.1)]"
                  )}
                />
                <CardContent className="relative space-y-5 p-6">
                  <div className="space-y-3">
                    <span
                      className={cn(
                        "inline-flex h-11 w-11 items-center justify-center rounded-md border",
                        isCloud
                          ? "border-[color:var(--kcx-border-soft)] bg-white text-brand-primary"
                          : "border-[color:var(--border-light)] bg-white text-text-secondary"
                      )}
                    >
                      <OptionIcon className="h-5 w-5" />
                    </span>
                    <div className="space-y-1.5">
                      <p className="kcx-eyebrow text-brand-primary">{isCloud ? "Cloud Setup" : "Manual Upload"}</p>
                      <h2 className="text-2xl font-semibold tracking-tight text-text-primary">{option.label}</h2>
                      <p className="max-w-[45ch] text-sm leading-6 text-text-secondary">{option.description}</p>
                    </div>
                  </div>

                  <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-white/80 p-3.5 text-xs leading-6 text-text-muted">
                    {isCloud
                      ? "Best for automated, continuous billing ingestion from connected cloud accounts."
                      : "Best for getting started quickly with exported billing files and manual uploads."}
                  </div>

                  <Button
                    className={cn(
                      "h-11 rounded-md px-5",
                      isCloud
                        ? "bg-[color:var(--brand-primary)] text-white hover:brightness-95"
                        : ""
                    )}
                    variant={isCloud ? "default" : "outline"}
                    onClick={() => navigateTo(option.href)}
                  >
                    {isCloud ? "Open Cloud Connection" : "Open Upload CSV"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </section>
      </>
    )
  }

  return (
    <>
      <ClientPageHeader
        eyebrow="Billing Workspace"
        title={pageHeaderTitle}
        description={pageHeaderDescription}
      />

      <section aria-label="Billing workspace options">
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

            {activeRoute === "/client/billing/connect-cloud" ||
            activeRoute === "/client/billing/connect-cloud/add" ||
            activeRoute === "/client/billing/connections" ||
            activeRoute === "/client/billing/connections/add" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">Connect Cloud</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Choose Cloud Provider</h2>
                  <p className="text-sm text-text-secondary">
                    Select a cloud provider to begin a new billing integration setup.
                  </p>
                </div>
                <div className="grid grid-cols-1 auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {ADD_CONNECTION_PROVIDERS.map((provider) => (
                    <AddConnectionProviderCard key={provider.name} {...provider} />
                  ))}
                </div>
              </>
            ) : null}

            {activeRoute === "/client/billing/connect-cloud/aws" || activeRoute === "/client/billing/connections/aws" ? (
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
                        onClick={() => navigateTo("/client/billing/connect-cloud/aws/automatic")}
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
                      <Button className="h-10 rounded-md" onClick={() => navigateTo("/client/billing/connect-cloud/aws/manual")}>
                        Start Manual Setup
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}

            {cloudProviderSlug && cloudProviderSlug !== "aws" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">{cloudProviderName} Integration</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">{cloudProviderName} Setup</h2>
                  <p className="text-sm text-text-secondary">
                    Billing integration setup for {cloudProviderName} is coming soon.
                  </p>
                </div>
                <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4 text-sm text-text-muted">
                  This provider route is ready. Detailed onboarding steps for {cloudProviderName} will be added soon.
                </div>
              </>
            ) : null}

            {activeRoute === "/client/billing/connect-cloud/aws/automatic" || activeRoute === "/client/billing/connections/aws/automatic" ? (
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
                    onClick={() => navigateTo("/client/billing/connect-cloud/aws")}
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
                        onClick={() => navigateTo("/client/billing/connect-cloud/aws")}
                      >
                        Back to Setup Choice
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}

            {activeRoute === "/client/billing/connect-cloud/aws/manual" || activeRoute === "/client/billing/connections/aws/manual" ? (
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
