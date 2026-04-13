import { useState, useMemo } from "react"

import { AddCloudConnectionSection } from "@/features/client-home/components/billing/AddCloudConnectionSection"
import { getCloudIntegrationDashboardScope } from "@/features/client-home/api/cloud-integrations.api"
import { useTenantCloudIntegrations } from "@/features/client-home/hooks/useTenantCloudIntegrations"
import { mapCloudIntegrationOverviewRow } from "@/features/client-home/components/billing/billingHelpers"
import { ApiError } from "@/lib/api"
import { navigateTo } from "@/lib/navigation"

export function ClientCloudIntegrationPage() {
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

  const filteredCloudOverviewRows = cloudOverviewRows

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
        const validBillingSourceIds = [...new Set(scope.billing_source_ids.filter((id) => Number.isInteger(id)))]

        if (validBillingSourceIds.length === 0) {
          setDashboardActionError("No billing source found for this cloud connection yet.")
          return
        }

        if (!scope.usage_from || !scope.usage_to) {
          setDashboardActionError("No ingested cost data found for this cloud connection yet.")
          return
        }

        const query = new URLSearchParams({
          tenantId: scope.tenant_id,
          billingSourceIds: validBillingSourceIds.join(","),
          from: scope.usage_from,
          to: scope.usage_to,
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

  async function handleGetRequestActivityDetails(integrationId: string) {
    const scope = await getCloudIntegrationDashboardScope(integrationId)
    const ingestedAt = scope.latest_ingested_at ?? scope.usage_to ?? scope.usage_from
    return {
      ingestionRows: scope.latest_ingestion_rows_loaded,
      ingestedAt,
    }
  }

  function handleOpenProviderSetup(provider: "aws" | "azure" | "gcp" | "oracle-cloud") {
    navigateTo(`/client/billing/connect-cloud/${provider}`)
  }

  return (
    <>
      <AddCloudConnectionSection
        onOpenProviderSetup={handleOpenProviderSetup}
        onOpenS3Connection={() => navigateTo("/client/billing/import-s3")}
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
        onGetRequestActivityDetails={handleGetRequestActivityDetails}
      />
    </>
  )
}
