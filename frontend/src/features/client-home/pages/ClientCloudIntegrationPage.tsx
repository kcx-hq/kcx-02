import { useState, useMemo } from "react"

import { AddCloudConnectionSection } from "@/features/client-home/components/billing/AddCloudConnectionSection"
import { getCloudIntegrationDashboardScope } from "@/features/client-home/api/cloud-integrations.api"
import { useTenantCloudIntegrations } from "@/features/client-home/hooks/useTenantCloudIntegrations"
import { mapCloudIntegrationOverviewRow } from "@/features/client-home/components/billing/billingHelpers"
import { ApiError } from "@/lib/api"
import { navigateTo } from "@/lib/navigation"

export function ClientCloudIntegrationPage() {
  const [cloudConnectionsSearch, setCloudConnectionsSearch] = useState("")
  const [dashboardActionLoading, setDashboardActionLoading] = useState(false)
  const [dashboardConnectionActionId, setDashboardConnectionActionId] = useState<string | null>(null)
  const [dashboardActionError, setDashboardActionError] = useState<string | null>(null)

  const {
    data: cloudIntegrationRows = [],
    isLoading: isCloudIntegrationsLoading,
    isError: isCloudIntegrationsError,
    error: cloudIntegrationsError,
    refetch: refetchCloudIntegrations,
  } = useTenantCloudIntegrations(true)

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

  function openDashboardWithQuery(search: URLSearchParams) {
    const nextUrl = `/dashboard/overview?${search.toString()}`
    window.history.pushState({}, "", nextUrl)
    window.dispatchEvent(new PopStateEvent("popstate"))
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

  return (
    <>
      <AddCloudConnectionSection
        onOpenS3UploadModal={() => navigateTo("/client/billing/import-s3")}
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
    </>
  )
}
