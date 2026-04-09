import { Search, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

import type { CloudIntegrationOverviewRow } from "./billingHelpers"
import { CloudConnectionsTable } from "./CloudConnectionsTable"

type AddCloudConnectionSectionProps = {
  onAutomaticSetup: () => void
  onManualSetup: () => void
  onOpenS3UploadModal: () => void
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
}

export function AddCloudConnectionSection({
  onAutomaticSetup,
  onManualSetup,
  onOpenS3UploadModal,
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
}: AddCloudConnectionSectionProps) {
  const activeCount = cloudOverviewRows.filter((row) => row.statusLabel === "HEALTHY").length
  const pendingCount = cloudOverviewRows.filter((row) => row.statusLabel === "PENDING" || row.statusLabel === "CONNECTING").length

  return (
    <>
      <div className="space-y-1">
        <p className="kcx-eyebrow text-brand-primary">Cloud Connections</p>
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Add Cloud Connection</h2>
        <p className="text-sm text-text-secondary">
          Choose your AWS setup path to start automated billing ingestion.
        </p>
      </div>

      <section className="rounded-md border border-[color:var(--border-light)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbfa_100%)] p-4 md:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <div className="rounded-md border border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] p-6">
            <div className="flex h-full flex-col items-center justify-center gap-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-primary">Import from S3</span>
              <img src="/aws.svg" alt="AWS S3 import" className="h-20 w-20 object-contain md:h-24 md:w-24" />
              <p className="max-w-md text-center text-sm leading-6 text-text-secondary">
                Securely connect your AWS billing source with guided onboarding and dashboard-ready scoping.
              </p>
              <Button className="h-11 rounded-md px-5 text-sm font-medium" onClick={onOpenS3UploadModal}>
                Connect
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-[color:var(--border-light)] bg-white p-5 md:p-6">
            <div className="flex h-full flex-col justify-center gap-4">
              <h3 className="text-lg font-semibold text-text-primary">Setup Options</h3>
              <p className="text-sm text-text-secondary">Pick how you want to configure AWS integration.</p>

              <div className="flex flex-col gap-3">
                <Button className="h-11 rounded-md justify-start px-4 text-left" onClick={onAutomaticSetup}>
                  Connect Automatic Setup
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-md justify-start border-[color:var(--border-light)] px-4 text-left"
                  onClick={onManualSetup}
                >
                  Connect Manual Setup
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <h3 className="text-2xl font-semibold tracking-tight text-text-primary">Active Connections</h3>
            <p className="text-sm text-text-secondary">
              {cloudOverviewRows.length} Sources · {activeCount} Active · {pendingCount} Pending
            </p>
          </div>
          <div className="w-full lg:w-[420px]">
            <input
              type="text"
              placeholder="Search connections"
              value={cloudConnectionsSearch}
              onChange={(event) => onCloudConnectionsSearchChange(event.target.value)}
              className="h-12 w-full rounded-xl border border-[color:var(--border-light)] bg-white px-4 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[color:var(--border-light)] bg-white shadow-sm-custom">
          <div className="border-b border-[color:var(--border-light)] px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Search className="h-5 w-5" />
              <span>Search connections</span>
            </div>
          </div>

          <div className="p-0">
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
        </div>

        {dashboardActionError ? <p className="text-sm text-rose-600">{dashboardActionError}</p> : null}
      </section>
    </>
  )
}
