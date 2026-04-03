import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"

// STEP 1:
// Client prepares billing data source (S3 bucket)
// This feeds into cross-account access setup in Step 2

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowRight,
  Cloud,
  FileSpreadsheet,
  Wrench,
} from "lucide-react"

import type { TenantUploadHistoryRecord } from "@/features/client-home/api/upload-history.api"
import { AwsAutomaticSetup } from "@/features/client-home/components/AwsAutomaticSetup"
import { BillingUploadHistorySection } from "@/features/client-home/components/BillingUploadHistorySection"
import { AwsManualSetup, AWS_MANUAL_EXPLORER_ROUTE_REGEX } from "@/features/client-home/components/AwsManualSetup"
import { ManualBillingUploadDialog } from "@/features/client-home/components/ManualBillingUploadDialog"
import { useIngestionStatus, type IngestionStatusPayload } from "@/features/client-home/hooks/useIngestionStatus"
import {
  TENANT_UPLOAD_HISTORY_QUERY_KEY,
  useTenantUploadHistory,
} from "@/features/client-home/hooks/useTenantUploadHistory"
import { ClientPageHeader } from "@/features/client-home/components/ClientPageHeader"
import { useUploadHistorySelectionStore } from "@/features/client-home/stores/uploadHistorySelection.store"
import { dashboardApi } from "@/features/dashboard/api/dashboardApi"
import { ApiError, apiGet } from "@/lib/api"
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

const ACTIVE_INGESTION_STORAGE_KEY = "kcx.activeBillingIngestionRunId"

function normalizeUploadStatusLabel(value: string | null | undefined): "Idle" | "Queued" | "Processing" | "Completed" | "Warning" | "Failed" {
  if (!value) return "Idle"
  if (value === "queued") return "Queued"
  if (value === "completed") return "Completed"
  if (value === "completed_with_warnings" || value === "warning") return "Warning"
  if (value === "failed") return "Failed"
  return "Processing"
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

export function ClientBillingPage() {
  const queryClient = useQueryClient()
  const route = useCurrentRoute()
  const activeRoute = route
  const isBillingHubRoute = activeRoute === "/client/billing"
  const isBillingUploadsRoute = activeRoute === "/client/billing/uploads"
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

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [activeIngestionRunId, setActiveIngestionRunId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem(ACTIVE_INGESTION_STORAGE_KEY)
  })
  const [latestActiveIngestionLoaded, setLatestActiveIngestionLoaded] = useState(false)
  const [lastTerminalIngestionStatus, setLastTerminalIngestionStatus] = useState<IngestionStatusPayload | null>(null)

  const setupConnectionId = useMemo(() => {
    const match = AWS_SETUP_ROUTE_REGEX.exec(activeRoute)
    if (!match) return null
    return match[1]
  }, [activeRoute])

  const [setupConnection, setSetupConnection] = useState<CloudConnection | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  const {
    status: ingestionStatus,
  } = useIngestionStatus({
    ingestionRunId: activeIngestionRunId,
    enabled: Boolean(activeIngestionRunId),
  })
  const displayIngestionStatus = ingestionStatus ?? lastTerminalIngestionStatus
  const {
    data: uploadHistoryRecords = [],
    isLoading: isUploadHistoryLoading,
    isError: isUploadHistoryError,
    error: uploadHistoryError,
    refetch: refetchUploadHistory,
  } = useTenantUploadHistory(isBillingUploadsRoute)
  const [dashboardActionLoading, setDashboardActionLoading] = useState(false)
  const [dashboardActionError, setDashboardActionError] = useState<string | null>(null)
  const retainOnlyFiles = useUploadHistorySelectionStore((state) => state.retainOnlyFiles)
  const clearSelectedFiles = useUploadHistorySelectionStore((state) => state.clearSelectedFiles)
  const uploadHistoryErrorMessage = uploadHistoryError instanceof ApiError ? uploadHistoryError.message : "Failed to load upload history"
  const [detailsRunId, setDetailsRunId] = useState<string | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [detailsStatus, setDetailsStatus] = useState<IngestionStatusPayload | null>(null)
  const compactStatusLabel = useMemo(() => {
    if (displayIngestionStatus?.status) {
      return normalizeUploadStatusLabel(displayIngestionStatus.status)
    }
    const latestStatus = uploadHistoryRecords[0]?.status
    return normalizeUploadStatusLabel(latestStatus)
  }, [displayIngestionStatus, uploadHistoryRecords])

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

  useEffect(() => {
    if (latestActiveIngestionLoaded || activeIngestionRunId) return

    void (async () => {
      try {
        const latestActive = await apiGet<IngestionStatusPayload | null>("/billing/ingestions/latest-active")
        if (latestActive?.id) {
          setActiveIngestionRunId(latestActive.id)
          setLastTerminalIngestionStatus(null)
          window.localStorage.setItem(ACTIVE_INGESTION_STORAGE_KEY, latestActive.id)
        }
      } catch {
        // Best-effort recovery path for reloads with missing local storage state.
      } finally {
        setLatestActiveIngestionLoaded(true)
      }
    })()
  }, [activeIngestionRunId, latestActiveIngestionLoaded])

  useEffect(() => {
    if (!ingestionStatus) return

    const isTerminalStatus =
      ingestionStatus.status === "completed" ||
      ingestionStatus.status === "completed_with_warnings" ||
      ingestionStatus.status === "failed"

    if (isTerminalStatus) {
      setLastTerminalIngestionStatus(ingestionStatus)
      if (activeIngestionRunId) {
        window.localStorage.removeItem(ACTIVE_INGESTION_STORAGE_KEY)
        setActiveIngestionRunId(null)
      }
      return
    }

    if (activeIngestionRunId && window.localStorage.getItem(ACTIVE_INGESTION_STORAGE_KEY) !== activeIngestionRunId) {
      window.localStorage.setItem(ACTIVE_INGESTION_STORAGE_KEY, activeIngestionRunId)
    }
  }, [activeIngestionRunId, ingestionStatus])

  useEffect(() => {
    const availableRawBillingFileIds = uploadHistoryRecords
      .map((record) => Number(record.rawBillingFileId))
      .filter((rawBillingFileId) => Number.isInteger(rawBillingFileId))
    retainOnlyFiles(availableRawBillingFileIds)
  }, [retainOnlyFiles, uploadHistoryRecords])

  useEffect(() => {
    if (!isBillingUploadsRoute) {
      clearSelectedFiles()
      setDashboardActionError(null)
    }
  }, [clearSelectedFiles, isBillingUploadsRoute])

  function handleIngestionQueued(payload: { ingestionRunId: string }) {
    setLastTerminalIngestionStatus(null)
    setActiveIngestionRunId(payload.ingestionRunId)
    window.localStorage.setItem(ACTIVE_INGESTION_STORAGE_KEY, payload.ingestionRunId)
    void queryClient.invalidateQueries({ queryKey: TENANT_UPLOAD_HISTORY_QUERY_KEY })
  }

  function handleRetryUploadRecord(_record: TenantUploadHistoryRecord) {
    setUploadDialogOpen(true)
  }

  function handleViewUploadDetails(runId: string) {
    setDetailsRunId(runId)
    setDetailsDialogOpen(true)
    setDetailsLoading(true)
    setDetailsError(null)
    setDetailsStatus(null)

    void (async () => {
      try {
        const status = await apiGet<IngestionStatusPayload>(`/billing/ingestions/${runId}/status`)
        setDetailsStatus(status)
      } catch (error) {
        if (error instanceof ApiError) {
          setDetailsError(error.message || "Failed to load ingestion details")
        } else {
          setDetailsError("Failed to load ingestion details")
        }
      } finally {
        setDetailsLoading(false)
      }
    })()
  }

  function openDashboardWithQuery(search: URLSearchParams) {
    const nextUrl = `/dashboard/overview?${search.toString()}`
    window.history.pushState({}, "", nextUrl)
    window.dispatchEvent(new PopStateEvent("popstate"))
  }

  function handleOpenDashboard(selectedRawBillingFileIds: number[]) {
    if (dashboardActionLoading) return

    const validRawBillingFileIds = [...new Set(selectedRawBillingFileIds.filter((id) => Number.isInteger(id)))]
    if (validRawBillingFileIds.length === 0) {
      setDashboardActionError("Select at least one uploaded file to open dashboard.")
      return
    }

    setDashboardActionError(null)
    setDashboardActionLoading(true)

    void (async () => {
      try {
        await dashboardApi.getScope({
          rawBillingFileIds: validRawBillingFileIds,
        })

        const query = new URLSearchParams({
          rawBillingFileIds: validRawBillingFileIds.join(","),
        })
        openDashboardWithQuery(query)
      } catch (error) {
        if (error instanceof ApiError) {
          setDashboardActionError(error.message || "Unable to resolve upload scope for dashboard.")
        } else {
          setDashboardActionError("Unable to resolve upload scope for dashboard.")
        }
      } finally {
        setDashboardActionLoading(false)
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
      {!isBillingUploadsRoute ? (
        <>
          <ClientPageHeader
            eyebrow="Billing Workspace"
            title={pageHeaderTitle}
            description={pageHeaderDescription}
          />
        </>
      ) : null}

      <section aria-label="Billing workspace options">
        <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
          <CardContent className="space-y-6 p-6">
            {isBillingUploadsRoute ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Billing</h1>
                    <p className="text-sm text-text-secondary">
                      Upload billing files. Processing starts automatically after upload.
                    </p>
                  </div>
                  <Button className="h-10 rounded-md" onClick={() => setUploadDialogOpen(true)}>
                    Upload File
                  </Button>
                </div>
                <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-4 py-2.5">
                  <p className="text-sm text-text-secondary">
                    <span className="font-medium text-text-primary">Status:</span> {compactStatusLabel} Â· Auto-processing on
                  </p>
                </div>
                <BillingUploadHistorySection
                  records={uploadHistoryRecords}
                  isLoading={isUploadHistoryLoading}
                  isError={isUploadHistoryError}
                  errorMessage={uploadHistoryErrorMessage}
                  dashboardActionError={dashboardActionError}
                  dashboardActionLoading={dashboardActionLoading}
                  onRetry={() => void refetchUploadHistory()}
                  onViewDetails={handleViewUploadDetails}
                  onRetryUpload={handleRetryUploadRecord}
                  onOpenDashboard={handleOpenDashboard}
                />
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
                      <p className="text-sm text-text-secondary">Guided manual setup using custom trust policy and IAM role validation.</p>
                      <Button className="h-10 rounded-md" onClick={() => navigateTo("/client/billing/connect-cloud/aws/manual")}>
                        Open Manual Setup
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
              <AwsAutomaticSetup activeRoute={activeRoute} />
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

            {activeRoute === "/client/billing/connect-cloud/aws/manual" ||
            activeRoute === "/client/billing/connections/aws/manual" ||
            AWS_MANUAL_EXPLORER_ROUTE_REGEX.test(activeRoute) ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">AWS Manual Setup</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Manual Setup</h2>
                  <p className="text-sm text-text-secondary">
                    Connect your AWS billing data in one guided setup flow.
                  </p>
                </div>
                <AwsManualSetup activeRoute={activeRoute} />
              </>
            ) : null}

          </CardContent>
        </Card>
      </section>
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ingestion details</DialogTitle>
            <DialogDescription>
              Run ID: {detailsRunId ?? "N/A"}
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <p className="text-sm text-text-secondary">Loading details...</p>
          ) : detailsError ? (
            <div className="space-y-3">
              <p className="text-sm text-rose-600">{detailsError}</p>
              <Button variant="outline" size="sm" onClick={() => detailsRunId ? handleViewUploadDetails(detailsRunId) : null}>
                Retry
              </Button>
            </div>
          ) : detailsStatus ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Status</p>
                  <p className="font-medium text-text-primary">{normalizeUploadStatusLabel(detailsStatus.status)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Progress</p>
                  <p className="font-medium text-text-primary">{Math.round(detailsStatus.progressPercent)}%</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Rows Loaded</p>
                  <p className="font-medium text-text-primary">{detailsStatus.rowsLoaded}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Rows Failed</p>
                  <p className="font-medium text-text-primary">{detailsStatus.rowsFailed}</p>
                </div>
              </div>
              {detailsStatus.statusMessage ? (
                <p className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3 text-text-secondary">
                  {detailsStatus.statusMessage}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No details available for this ingestion run.</p>
          )}
        </DialogContent>
      </Dialog>
      <ManualBillingUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onIngestionQueued={handleIngestionQueued}
      />
    </>
  )
}

