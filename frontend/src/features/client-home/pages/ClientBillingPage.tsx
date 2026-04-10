import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"

import type { TenantUploadHistoryRecord } from "@/features/client-home/api/upload-history.api"
import { getCloudIntegrationDashboardScope } from "@/features/client-home/api/cloud-integrations.api"
import { AwsAutomaticSetup } from "@/features/client-home/components/AwsAutomaticSetup"
import { AwsManualSetup, AWS_MANUAL_EXPLORER_ROUTE_REGEX } from "@/features/client-home/components/AwsManualSetup"
import { AwsManualSetupSuccess } from "@/features/client-home/components/AwsManualSetupSuccess"
import { ClientPageHeader } from "@/features/client-home/components/ClientPageHeader"
import { ManualBillingUploadDialog } from "@/features/client-home/components/ManualBillingUploadDialog"
import { AddCloudConnectionSection } from "@/features/client-home/components/billing/AddCloudConnectionSection"
import { AwsSetupConnectionSection } from "@/features/client-home/components/billing/AwsSetupConnectionSection"
import { BillingHubSection } from "@/features/client-home/components/billing/BillingHubSection"
import { BillingUploadsSection } from "@/features/client-home/components/billing/BillingUploadsSection"
import {
  ACTIVE_INGESTION_STORAGE_KEY,
  AWS_MANUAL_SUCCESS_ROUTE_REGEX,
  AWS_SETUP_ROUTE_REGEX,
  CLOUD_PROVIDER_LABELS,
  CLOUD_PROVIDER_ROUTE_REGEX,
  CLOUD_SETUP_METHOD_ROUTE_REGEX,
  isCloudConnectionsRoute,
  mapCloudIntegrationOverviewRow,
  normalizeUploadStatusLabel,
  type CloudConnection,
} from "@/features/client-home/components/billing/billingHelpers"
import { CloudProviderComingSoonSection } from "@/features/client-home/components/billing/CloudProviderComingSoonSection"
import { IngestionDetailsDialog } from "@/features/client-home/components/billing/IngestionDetailsDialog"
import { useIngestionStatus, type IngestionStatusPayload } from "@/features/client-home/hooks/useIngestionStatus"
import {
  TENANT_UPLOAD_HISTORY_QUERY_KEY,
  useTenantUploadHistory,
} from "@/features/client-home/hooks/useTenantUploadHistory"
import { useTenantCloudIntegrations } from "@/features/client-home/hooks/useTenantCloudIntegrations"
import { useUploadHistorySelectionStore } from "@/features/client-home/stores/uploadHistorySelection.store"
import { ApiError, apiGet } from "@/lib/api"
import { handleAppLinkClick, navigateTo, useCurrentRoute } from "@/lib/navigation"
import { Button } from "@/components/ui/button"

export function ClientBillingPage() {
  const queryClient = useQueryClient()
  const route = useCurrentRoute()
  const activeRoute = route
  const isBillingHubRoute = activeRoute === "/client/billing"
  const isBillingUploadsRoute = activeRoute === "/client/billing/uploads"
  const isAddCloudConnectionRoute =
    activeRoute === "/client/billing/connect-cloud/add/aws" || activeRoute === "/client/billing/connections/add/aws"
  const isLegacyCloudConnectionsOverviewRoute =
    activeRoute === "/client/billing/connect-cloud" || activeRoute === "/client/billing/connections"
  const isLegacyAwsSetupChoiceRoute =
    activeRoute === "/client/billing/connect-cloud/aws" || activeRoute === "/client/billing/connections/aws"
  const shouldLoadCloudIntegrations = isBillingHubRoute || isAddCloudConnectionRoute
  const [cloudConnectionsSearch, setCloudConnectionsSearch] = useState("")

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
              <a
                href={cloudProviderRoute}
                onClick={(event) => handleAppLinkClick(event, cloudProviderRoute)}
                className={linkClass}
              >
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
  const [localUploadDialogOpen, setLocalUploadDialogOpen] = useState(false)
  const [s3UploadDialogOpen, setS3UploadDialogOpen] = useState(false)
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

  const { status: ingestionStatus } = useIngestionStatus({
    ingestionRunId: activeIngestionRunId,
    enabled: Boolean(activeIngestionRunId),
    onIngestionRunNotFound: () => {
      setActiveIngestionRunId(null)
      window.localStorage.removeItem(ACTIVE_INGESTION_STORAGE_KEY)
    },
  })

  const displayIngestionStatus = ingestionStatus ?? lastTerminalIngestionStatus

  const {
    data: uploadHistoryRecords = [],
    isLoading: isUploadHistoryLoading,
    isError: isUploadHistoryError,
    error: uploadHistoryError,
    refetch: refetchUploadHistory,
  } = useTenantUploadHistory(isBillingUploadsRoute)

  const {
    data: cloudIntegrationRows = [],
    isLoading: isCloudIntegrationsLoading,
    isError: isCloudIntegrationsError,
    error: cloudIntegrationsError,
    refetch: refetchCloudIntegrations,
  } = useTenantCloudIntegrations(shouldLoadCloudIntegrations)

  const [dashboardActionLoading, setDashboardActionLoading] = useState(false)
  const [dashboardConnectionActionId, setDashboardConnectionActionId] = useState<string | null>(null)
  const [dashboardActionError, setDashboardActionError] = useState<string | null>(null)

  const retainOnlyFiles = useUploadHistorySelectionStore((state) => state.retainOnlyFiles)
  const clearSelectedFiles = useUploadHistorySelectionStore((state) => state.clearSelectedFiles)

  const uploadHistoryErrorMessage =
    uploadHistoryError instanceof ApiError ? uploadHistoryError.message : "Failed to load upload history"

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

  const cloudOverviewRows = useMemo(() => cloudIntegrationRows.map(mapCloudIntegrationOverviewRow), [cloudIntegrationRows])

  const filteredCloudOverviewRows = useMemo(() => {
    const normalizedSearch = cloudConnectionsSearch.trim().toLowerCase()
    if (!normalizedSearch) return cloudOverviewRows

    return cloudOverviewRows.filter((row) => {
      return (
        row.connectionName.toLowerCase().includes(normalizedSearch) ||
        row.provider.toLowerCase().includes(normalizedSearch) ||
        row.statusLabel.toLowerCase().includes(normalizedSearch) ||
        row.lastIngestOrMessage.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [cloudConnectionsSearch, cloudOverviewRows])

  const cloudIntegrationsErrorMessage =
    cloudIntegrationsError instanceof ApiError ? cloudIntegrationsError.message : "Unable to load cloud connections."

  useEffect(() => {
    if (isLegacyCloudConnectionsOverviewRoute || isLegacyAwsSetupChoiceRoute) {
      navigateTo("/client/billing/connect-cloud/add/aws")
    }
  }, [isLegacyAwsSetupChoiceRoute, isLegacyCloudConnectionsOverviewRoute])

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
    const nextUrl = `/uploads-dashboard/overview?${search.toString()}`
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

  function handleOpenCloudConnectionDashboard(integrationId: string) {
    if (dashboardConnectionActionId || dashboardActionLoading) return

    setDashboardActionError(null)
    setDashboardConnectionActionId(integrationId)
    setDashboardActionLoading(true)

    void (async () => {
      try {
        const scope = await getCloudIntegrationDashboardScope(integrationId)
        const validRawBillingFileIds = [...new Set(scope.raw_billing_file_ids.filter((id) => Number.isInteger(id)))]

        if (validRawBillingFileIds.length === 0) {
          setDashboardActionError("No ingested files found for this cloud connection yet.")
          return
        }

        const query = new URLSearchParams({
          rawBillingFileIds: validRawBillingFileIds.join(","),
        })
        openDashboardWithQuery(query)
      } catch (error) {
        if (error instanceof ApiError) {
          setDashboardActionError(error.message || "Unable to open dashboard for this cloud connection.")
        } else {
          setDashboardActionError("Unable to open dashboard for this cloud connection.")
        }
      } finally {
        setDashboardConnectionActionId(null)
        setDashboardActionLoading(false)
      }
    })()
  }

  if (isBillingHubRoute) {
    return (
      <>
        <section aria-label="Billing header" className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-muted">Billing / Ingestion</p>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Billing</h1>
          </div>
        
        </section>
        <BillingHubSection
          onOpenLocalUploadModal={() => setLocalUploadDialogOpen(true)}
          onOpenUploadHistory={() => navigateTo("/client/billing/uploads")}
          onOpenConnectCloud={() => navigateTo("/client/billing/connect-cloud/add/aws")}
        />

        <ManualBillingUploadDialog
          open={localUploadDialogOpen}
          onOpenChange={setLocalUploadDialogOpen}
          onIngestionQueued={handleIngestionQueued}
          initialSource="local"
          hideSourceTabs
        />

        <ManualBillingUploadDialog
          open={s3UploadDialogOpen}
          onOpenChange={setS3UploadDialogOpen}
          onIngestionQueued={handleIngestionQueued}
          initialSource="s3"
          hideSourceTabs
        />
      </>
    )
  }

  return (
    <>
      {!isBillingUploadsRoute ? (
        <ClientPageHeader
          eyebrow="Billing Workspace"
          title={pageHeaderTitle}
          description={pageHeaderDescription}
        />
      ) : null}

      <section aria-label="Billing workspace options">
        <div className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
          <div className="space-y-6 p-6">
            {isBillingUploadsRoute ? (
              <BillingUploadsSection
                compactStatusLabel={compactStatusLabel}
                uploadHistoryRecords={uploadHistoryRecords}
                isUploadHistoryLoading={isUploadHistoryLoading}
                isUploadHistoryError={isUploadHistoryError}
                uploadHistoryErrorMessage={uploadHistoryErrorMessage}
                dashboardActionError={dashboardActionError}
                dashboardActionLoading={dashboardActionLoading}
                onChooseSource={() => setUploadDialogOpen(true)}
                onRetryUploadHistory={() => {
                  void refetchUploadHistory()
                }}
                onViewUploadDetails={handleViewUploadDetails}
                onRetryUploadRecord={handleRetryUploadRecord}
                onOpenDashboard={handleOpenDashboard}
              />
            ) : null}

            {isAddCloudConnectionRoute ? (
              <AddCloudConnectionSection
                onAutomaticSetup={() => navigateTo("/client/billing/connect-cloud/aws/automatic")}
                onManualSetup={() => navigateTo("/client/billing/connect-cloud/aws/manual")}
                onOpenS3UploadModal={() => setS3UploadDialogOpen(true)}
                cloudConnectionsSearch={cloudConnectionsSearch}
                onCloudConnectionsSearchChange={setCloudConnectionsSearch}
                cloudOverviewRows={cloudOverviewRows}
                filteredCloudOverviewRows={filteredCloudOverviewRows}
                isCloudIntegrationsLoading={isCloudIntegrationsLoading}
                isCloudIntegrationsError={isCloudIntegrationsError}
                cloudIntegrationsErrorMessage={cloudIntegrationsErrorMessage}
                dashboardActionError={dashboardActionError}
                dashboardActionLoading={dashboardActionLoading}
                dashboardConnectionActionId={dashboardConnectionActionId}
                onRetryCloudIntegrations={() => {
                  void refetchCloudIntegrations()
                }}
                onOpenCloudConnectionDashboard={handleOpenCloudConnectionDashboard}
              />
            ) : null}

            {cloudProviderSlug && cloudProviderSlug !== "aws" && cloudProviderName ? (
              <CloudProviderComingSoonSection cloudProviderName={cloudProviderName} />
            ) : null}

            {activeRoute === "/client/billing/connect-cloud/aws/automatic" ||
            activeRoute === "/client/billing/connections/aws/automatic" ? (
              <AwsAutomaticSetup activeRoute={activeRoute} />
            ) : null}

            {setupConnectionId ? (
              <AwsSetupConnectionSection
                setupLoading={setupLoading}
                setupError={setupError}
                setupConnection={setupConnection}
                onLaunchAwsSetup={() => window.open("/integrations/aws", "_blank", "noopener,noreferrer")}
                onBackToSetupChoice={() => navigateTo("/client/billing/connect-cloud/aws")}
              />
            ) : null}

            {AWS_MANUAL_SUCCESS_ROUTE_REGEX.test(activeRoute) ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">AWS Manual Setup</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Success</h2>
                  <p className="text-sm text-text-secondary">Your manual AWS connection is complete.</p>
                </div>
                <AwsManualSetupSuccess />
              </>
            ) : null}

            {activeRoute === "/client/billing/connect-cloud/aws/manual" ||
            activeRoute === "/client/billing/connections/aws/manual" ||
            AWS_MANUAL_EXPLORER_ROUTE_REGEX.test(activeRoute) ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">AWS Manual Setup</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Manual Setup</h2>
                  <p className="text-sm text-text-secondary">Connect your AWS billing data in one guided setup flow.</p>
                </div>
                <AwsManualSetup activeRoute={activeRoute} />
              </>
            ) : null}
          </div>
        </div>
      </section>

      <IngestionDetailsDialog
        open={detailsDialogOpen}
        detailsRunId={detailsRunId}
        detailsLoading={detailsLoading}
        detailsError={detailsError}
        detailsStatus={detailsStatus}
        onOpenChange={setDetailsDialogOpen}
        onRetry={handleViewUploadDetails}
      />

      <ManualBillingUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onIngestionQueued={handleIngestionQueued}
      />

      <ManualBillingUploadDialog
        open={s3UploadDialogOpen}
        onOpenChange={setS3UploadDialogOpen}
        onIngestionQueued={handleIngestionQueued}
        initialSource="s3"
        hideSourceTabs
      />
    </>
  )
}
