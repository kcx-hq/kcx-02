import { useMemo, useState } from "react"
import { Cloud, Database, Hexagon, Orbit, Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { navigateTo } from "@/lib/navigation"

import type { CloudIntegrationOverviewRow } from "./billingHelpers"
import { CloudConnectionsTable } from "./CloudConnectionsTable"

type AddCloudConnectionSectionProps = {
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

const STATUS_FILTERS = [
  { label: "Any", value: "all" },
  { label: "Healthy", value: "HEALTHY" },
  { label: "Pending", value: "PENDING" },
  { label: "Connecting", value: "CONNECTING" },
  { label: "Warning", value: "WARNING" },
  { label: "Failed", value: "FAILED" },
  { label: "Suspended", value: "SUSPENDED" },
] as const

export function AddCloudConnectionSection({
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
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isAddConnectionPanelOpen, setIsAddConnectionPanelOpen] = useState(false)

  const providerOptions = useMemo(() => {
    const providers = Array.from(new Set(cloudOverviewRows.map((row) => row.provider))).sort((a, b) => a.localeCompare(b))
    return [{ label: "Any", value: "all" }, ...providers.map((provider) => ({ label: provider, value: provider }))]
  }, [cloudOverviewRows])

  const visibleRows = useMemo(() => {
    return filteredCloudOverviewRows.filter((row) => {
      const providerMatch = providerFilter === "all" || row.provider === providerFilter
      const statusMatch = statusFilter === "all" || row.statusLabel === statusFilter
      return providerMatch && statusMatch
    })
  }, [filteredCloudOverviewRows, providerFilter, statusFilter])

  function handleOpenAddConnectionPanel() {
    setIsAddConnectionPanelOpen(true)
  }

  function handlePanelOpenChange(open: boolean) {
    setIsAddConnectionPanelOpen(open)
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[2rem] font-semibold leading-tight text-text-primary">Cloud Integrations</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Manage cost sources that sync billing and cloud metadata into the platform.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-10 rounded-md" onClick={onOpenS3UploadModal}>
            Import from S3
          </Button>
          <Button className="h-10 rounded-md px-4" onClick={handleOpenAddConnectionPanel}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Connection
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,1fr)_220px_220px] lg:items-end">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Search</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={cloudConnectionsSearch}
              onChange={(event) => onCloudConnectionsSearchChange(event.target.value)}
              placeholder="Search..."
              className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] pl-9 pr-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
            />
          </span>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Provider</span>
          <select
            value={providerFilter}
            onChange={(event) => setProviderFilter(event.target.value)}
            className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
          >
            {providerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <CloudConnectionsTable
        rows={visibleRows}
        totalRows={cloudOverviewRows.length}
        isLoading={isCloudIntegrationsLoading}
        isError={isCloudIntegrationsError}
        errorMessage={cloudIntegrationsErrorMessage}
        dashboardActionLoading={dashboardActionLoading}
        dashboardConnectionActionId={dashboardConnectionActionId}
        onRetry={onRetryCloudIntegrations}
        onOpenDashboard={onOpenCloudConnectionDashboard}
      />

      {dashboardActionError ? <p className="text-sm text-rose-600">{dashboardActionError}</p> : null}

      <Dialog open={isAddConnectionPanelOpen} onOpenChange={handlePanelOpenChange}>
        <DialogContent className="left-auto right-0 top-0 h-screen w-[min(96vw,34rem)] translate-x-0 translate-y-0 rounded-none border-l border-[color:var(--border-light)] p-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
          <div className="flex h-full flex-col">
            <DialogHeader className="border-b border-[color:var(--border-light)] px-5 py-4">
              <DialogTitle>Select Cloud Provider</DialogTitle>
              <DialogDescription>Choose a provider to start setting up a billing connection.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setIsAddConnectionPanelOpen(false)
                  navigateTo("/client/billing/connect-cloud/aws")
                }}
                className="flex w-full items-center justify-between rounded-md border border-[color:var(--kcx-border-strong)] bg-[color:var(--highlight-green)] px-4 py-3 text-left transition-colors hover:bg-[#edf7f3]"
              >
                <span className="inline-flex items-center gap-2 font-medium text-text-primary">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/70 text-brand-primary">
                    <Cloud className="h-4 w-4" />
                  </span>
                  AWS
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-primary">Active</span>
              </button>

              {[
                { name: "Azure", icon: Hexagon },
                { name: "GCP", icon: Orbit },
                { name: "Oracle", icon: Database },
              ].map((provider) => {
                const Icon = provider.icon
                return (
                <button
                  key={provider.name}
                  type="button"
                  disabled
                  className="flex w-full items-center justify-between rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-4 py-3 text-left opacity-70"
                >
                  <span className="inline-flex items-center gap-2 font-medium text-text-primary">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-text-muted">
                      <Icon className="h-4 w-4" />
                    </span>
                    {provider.name}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Coming soon</span>
                </button>
              )})}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
