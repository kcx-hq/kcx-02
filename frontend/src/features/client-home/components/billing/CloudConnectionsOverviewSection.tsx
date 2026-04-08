import type { CloudIntegrationOverviewRow } from "./billingHelpers"
import { CloudConnectionsTable } from "./CloudConnectionsTable"
import { ConnectNewCloudSection } from "./ConnectNewCloudSection"

type CloudConnectionsOverviewSectionProps = {
  cloudConnectionsSearch: string
  onCloudConnectionsSearchChange: (value: string) => void
  cloudOverviewRows: CloudIntegrationOverviewRow[]
  filteredCloudOverviewRows: CloudIntegrationOverviewRow[]
  isCloudIntegrationsLoading: boolean
  isCloudIntegrationsError: boolean
  cloudIntegrationsErrorMessage: string
  dashboardActionError: string | null
  dashboardActionLoading: boolean
  dashboardConnectionActionId: string | null
  onRetryCloudIntegrations: () => void
  onOpenCloudConnectionDashboard: (integrationId: string) => void
  onConnectCloudProvider: (href: string) => void
}

export function CloudConnectionsOverviewSection({
  cloudConnectionsSearch,
  onCloudConnectionsSearchChange,
  cloudOverviewRows,
  filteredCloudOverviewRows,
  isCloudIntegrationsLoading,
  isCloudIntegrationsError,
  cloudIntegrationsErrorMessage,
  dashboardActionError,
  dashboardActionLoading,
  dashboardConnectionActionId,
  onRetryCloudIntegrations,
  onOpenCloudConnectionDashboard,
  onConnectCloudProvider,
}: CloudConnectionsOverviewSectionProps) {
  return (
    <>
      <div className="space-y-1">
        <p className="kcx-eyebrow text-brand-primary">Cloud Connections</p>
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Connections Overview</h2>
        <p className="text-sm text-text-secondary">Manage connected cloud accounts and open scoped dashboards.</p>
      </div>

      <section className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-text-secondary">Current cloud connections and latest ingestion health.</p>
          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Search connections"
              value={cloudConnectionsSearch}
              onChange={(event) => onCloudConnectionsSearchChange(event.target.value)}
              className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
            />
          </div>
        </div>

        <div className="mt-4">
          <CloudConnectionsTable
            rows={filteredCloudOverviewRows}
            totalRows={cloudOverviewRows.length}
            isLoading={isCloudIntegrationsLoading}
            isError={isCloudIntegrationsError}
            errorMessage={cloudIntegrationsErrorMessage}
            dashboardActionLoading={dashboardActionLoading}
            dashboardConnectionActionId={dashboardConnectionActionId}
            onRetry={onRetryCloudIntegrations}
            onOpenDashboard={onOpenCloudConnectionDashboard}
          />
        </div>
        {dashboardActionError ? <p className="mt-3 text-sm text-rose-600">{dashboardActionError}</p> : null}
      </section>

      <ConnectNewCloudSection onConnect={onConnectCloudProvider} />
    </>
  )
}
