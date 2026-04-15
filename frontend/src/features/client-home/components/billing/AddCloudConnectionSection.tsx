import { useEffect, useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  listPersistentS3UploadConnections,
  type S3UploadConnection,
} from "@/features/client-home/api/billing-s3-upload.api"
import { ApiError } from "@/lib/api"

import type { CloudIntegrationOverviewRow } from "./billingHelpers"
import { CloudConnectionsTable } from "./CloudConnectionsTable"

type AddCloudConnectionSectionProps = {
  onOpenProviderSetup: (provider: "aws" | "azure" | "gcp" | "oracle-cloud") => void
  onOpenS3Connection: () => void
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
  onGetRequestActivityDetails: (
    integrationId: string,
  ) => Promise<{ ingestionRows: number | null; ingestedAt: string | null }>
}

function formatDateTime(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

export function AddCloudConnectionSection({
  onOpenProviderSetup,
  onOpenS3Connection,
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
  onGetRequestActivityDetails,
}: AddCloudConnectionSectionProps) {
  const [activeConnectionsTab, setActiveConnectionsTab] = useState<"cloud" | "s3">("cloud")
  const [isAddConnectionPanelOpen, setIsAddConnectionPanelOpen] = useState(false)
  const [s3Connections, setS3Connections] = useState<S3UploadConnection[]>([])
  const [s3ConnectionsLoading, setS3ConnectionsLoading] = useState(false)
  const [s3ConnectionsError, setS3ConnectionsError] = useState<string | null>(null)
  const [s3ConnectionsLoaded, setS3ConnectionsLoaded] = useState(false)

  function handleOpenAddConnectionPanel() {
    setIsAddConnectionPanelOpen(true)
  }

  function handlePanelOpenChange(open: boolean) {
    setIsAddConnectionPanelOpen(open)
  }

  async function loadS3Connections() {
    setS3ConnectionsLoading(true)
    setS3ConnectionsError(null)
    try {
      const response = await listPersistentS3UploadConnections()
      setS3Connections(response)
    } catch (error) {
      setS3ConnectionsError(error instanceof ApiError ? error.message : "Failed to load connected S3 buckets.")
    } finally {
      setS3ConnectionsLoading(false)
      setS3ConnectionsLoaded(true)
    }
  }

  useEffect(() => {
    if (activeConnectionsTab !== "s3" || s3ConnectionsLoaded) return
    void loadS3Connections()
  }, [activeConnectionsTab, s3ConnectionsLoaded])

  const providerCards = [
    {
      name: "AWS",
      slug: "aws" as const,
      logo: "/aws.svg",
      logoClassName: "h-14 w-14",
      tone: "border-[#b7d4c7] bg-white shadow-sm",
      badge: "Available",
      badgeTone: "text-[#1f7a5a]",
    },
    {
      name: "Azure",
      slug: "azure" as const,
      logo: "/azure.svg",
      logoClassName: "h-16 w-16",
      tone: "border-[color:var(--border-light)] bg-[#f8f9f9]",
      badge: "Planned",
      badgeTone: "text-[#bc7d47]",
    },
    {
      name: "GCP",
      slug: "gcp" as const,
      logo: "/gcp.svg",
      logoClassName: "h-14 w-14",
      tone: "border-[color:var(--border-light)] bg-[#f8f9f9]",
      badge: "Planned",
      badgeTone: "text-[#bc7d47]",
    },
    {
      name: "Oracle",
      slug: "oracle-cloud" as const,
      logo: "/oracle.svg",
      logoClassName: "h-16 w-16",
      tone: "border-[color:var(--border-light)] bg-[#f8f9f9]",
      badge: "Planned",
      badgeTone: "text-[#bc7d47]",
    },
  ]

  return (
    <section className="rounded-[14px] border border-[color:var(--border-light)] bg-[#f7fbfb] px-5 py-5 shadow-sm-custom">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[2rem] font-semibold leading-tight text-text-primary">Cloud Integrations</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeConnectionsTab === "s3" ? (
            <Button className="h-10 rounded-md px-4" onClick={onOpenS3Connection}>
              <Plus className="mr-1.5 h-4 w-4" />
              Connect S3
            </Button>
          ) : (
            <Button className="h-10 rounded-md px-4" onClick={handleOpenAddConnectionPanel}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Connection
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-[color:var(--border-light)] pt-4">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-end">
        <div className="inline-flex items-end gap-5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => setActiveConnectionsTab("cloud")}
            className={`border-b-[3px] pb-1.5 text-[1rem] font-semibold leading-none transition-colors ${
              activeConnectionsTab === "cloud"
                ? "border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Cloud Integrations ({cloudOverviewRows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveConnectionsTab("s3")}
            className={`border-b-[3px] pb-1.5 text-[1rem] font-semibold leading-none transition-colors ${
              activeConnectionsTab === "s3"
                ? "border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            S3 Source Connections ({s3Connections.length})
          </button>
        </div>

      </div>
      </div>

      <div className="mt-4 border-t border-[color:var(--border-light)] pt-4">
        {activeConnectionsTab === "cloud" ? (
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
            onGetRequestActivityDetails={onGetRequestActivityDetails}
          />
        ) : (
          <div className="rounded-md border border-[color:var(--border-light)]">
            <table className="w-full text-sm">
              <thead className="bg-[color:var(--bg-surface)] text-left text-xs uppercase tracking-[0.08em] text-text-muted">
                <tr>
                  <th className="px-3 py-2">Bucket</th>
                  <th className="px-3 py-2">Prefix</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Region</th>
                  <th className="px-3 py-2">Last Validated</th>
                </tr>
              </thead>
              <tbody>
                {s3ConnectionsLoading ? (
                  <tr><td className="px-3 py-3 text-text-secondary" colSpan={5}>Loading connected S3 buckets...</td></tr>
                ) : null}
                {!s3ConnectionsLoading && s3Connections.length === 0 ? (
                  <tr><td className="px-3 py-3 text-text-secondary" colSpan={5}>No connected S3 buckets found.</td></tr>
                ) : null}
                {!s3ConnectionsLoading ? s3Connections.map((connection) => (
                  <tr key={connection.id} className="border-t border-[color:var(--border-light)]">
                    <td className="px-3 py-2 text-text-primary">{connection.bucket}</td>
                    <td className="px-3 py-2 text-text-secondary">{connection.basePrefix || "/"}</td>
                    <td className="px-3 py-2 text-text-secondary">{connection.awsAccountId || "-"}</td>
                    <td className="px-3 py-2 text-text-secondary">{connection.resolvedRegion || "-"}</td>
                    <td className="px-3 py-2 text-text-secondary">{formatDateTime(connection.lastValidatedAt)}</td>
                  </tr>
                )) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeConnectionsTab === "cloud" && dashboardActionError ? <p className="mt-3 text-sm text-rose-600">{dashboardActionError}</p> : null}
      {activeConnectionsTab === "s3" && s3ConnectionsError ? <p className="mt-3 text-sm text-rose-600">{s3ConnectionsError}</p> : null}

      <Dialog open={isAddConnectionPanelOpen} onOpenChange={handlePanelOpenChange}>
        <DialogContent className="w-[min(90vw,900px)] max-w-none rounded-[14px] border border-[color:var(--border-light)] p-0">
          <div className="flex max-h-[90vh] flex-col overflow-hidden">
            <DialogHeader className="border-b border-[color:var(--border-light)] px-5 py-4">
              <DialogTitle>Select Cloud Provider</DialogTitle>
              <DialogDescription>Choose a provider to start setting up a billing connection.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 overflow-auto px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Cloud Platforms</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {providerCards.map((provider) => {
                  const isAws = provider.slug === "aws"
                  return (
                <button
                  key={provider.slug}
                  type="button"
                  disabled={!isAws}
                  onClick={
                    isAws
                      ? () => {
                          setIsAddConnectionPanelOpen(false)
                          onOpenProviderSetup(provider.slug)
                        }
                      : undefined
                  }
                  className={`relative flex h-[210px] flex-col items-center justify-center rounded-xl border px-4 py-5 text-center transition-colors ${
                    isAws ? "hover:bg-[color:var(--bg-surface)]" : "cursor-not-allowed opacity-80"
                  } ${provider.tone}`}
                >
                  <span
                    className={`absolute right-4 top-4 text-[0.8rem] font-semibold uppercase tracking-[0.09em] ${provider.badgeTone}`}
                  >
                    {provider.badge}
                  </span>
                  <img
                    src={provider.logo}
                    alt={`${provider.name} logo`}
                    className={`${provider.logoClassName ?? "h-14 w-14"} object-contain`}
                  />
                  <p className="mt-4 text-[1.35rem] font-medium leading-none text-text-primary">{provider.name}</p>
                </button>
              )})}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
