import { useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  createPersistentS3UploadConnection,
  listPersistentS3UploadConnections,
  type S3UploadConnection,
} from "@/features/client-home/api/billing-s3-upload.api"
import { ApiError } from "@/lib/api"

import type { CloudIntegrationOverviewRow } from "./billingHelpers"
import { CloudConnectionsTable } from "./CloudConnectionsTable"
import { TablePagination } from "@/features/client-home/components/TablePagination"

const S3_PAGE_SIZE = 10

type AddCloudConnectionSectionProps = {
  onOpenProviderSetup: (provider: "aws" | "azure" | "gcp" | "oracle-cloud") => void
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

function normalizePrefix(value: string) {
  return value.trim().replace(/\\/g, "/").replace(/^\/+/, "")
}

export function AddCloudConnectionSection({
  onOpenProviderSetup,
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
  const [s3Page, setS3Page] = useState(1)
  const [isConnectS3DialogOpen, setIsConnectS3DialogOpen] = useState(false)
  const [s3RoleArn, setS3RoleArn] = useState("")
  const [s3BucketName, setS3BucketName] = useState("")
  const [s3Prefix, setS3Prefix] = useState("")
  const [s3ExternalId, setS3ExternalId] = useState("")
  const [connectingS3, setConnectingS3] = useState(false)
  const [connectS3Error, setConnectS3Error] = useState<string | null>(null)

  function handleOpenAddConnectionPanel() {
    setIsAddConnectionPanelOpen(true)
  }

  function handlePanelOpenChange(open: boolean) {
    setIsAddConnectionPanelOpen(open)
  }

  function resetConnectS3Form() {
    setS3RoleArn("")
    setS3BucketName("")
    setS3Prefix("")
    setS3ExternalId("")
    setConnectS3Error(null)
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

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const shouldOpenProviderPicker = params.get("openProviderPicker") === "1"
    if (!shouldOpenProviderPicker) return

    setActiveConnectionsTab("cloud")
    setIsAddConnectionPanelOpen(true)

    params.delete("openProviderPicker")
    const nextSearch = params.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`
    window.history.replaceState({}, "", nextUrl)
  }, [])

  useEffect(() => {
    setS3Page(1)
  }, [s3Connections.length])

  const s3TotalPages = Math.max(1, Math.ceil(s3Connections.length / S3_PAGE_SIZE))
  const s3CurrentPage = Math.min(s3Page, s3TotalPages)
  const paginatedS3Connections = useMemo(() => {
    const startIndex = (s3CurrentPage - 1) * S3_PAGE_SIZE
    return s3Connections.slice(startIndex, startIndex + S3_PAGE_SIZE)
  }, [s3Connections, s3CurrentPage])

  async function handleConnectS3() {
    const normalizedRoleArn = s3RoleArn.trim()
    const normalizedBucketName = s3BucketName.trim()
    const normalizedS3Prefix = normalizePrefix(s3Prefix)
    const normalizedExternalId = s3ExternalId.trim()

    if (!normalizedRoleArn || !normalizedBucketName) {
      setConnectS3Error("Role ARN and Bucket Name are required.")
      return
    }

    setConnectingS3(true)
    setConnectS3Error(null)

    try {
      const response = await createPersistentS3UploadConnection({
        roleArn: normalizedRoleArn,
        bucket: normalizedBucketName,
        prefix: normalizedS3Prefix,
        externalId: normalizedExternalId || undefined,
      })

      setS3Connections((current) => {
        const remaining = current.filter((connection) => connection.id !== response.connection.id)
        return [response.connection, ...remaining]
      })
      setS3ConnectionsLoaded(true)
      setIsConnectS3DialogOpen(false)
      resetConnectS3Form()
    } catch (error) {
      setConnectS3Error(error instanceof ApiError ? error.message : "Failed to connect S3 bucket.")
    } finally {
      setConnectingS3(false)
    }
  }

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
            <Button className="h-10 rounded-md px-4" onClick={() => setIsConnectS3DialogOpen(true)}>
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
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[color:var(--border-light)]">
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Bucket</th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Prefix</th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Account</th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Region</th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Last Validated</th>
                </tr>
              </thead>
              <tbody>
                {s3ConnectionsLoading ? (
                  <tr>
                    <td className="px-3 py-8 text-sm text-text-secondary" colSpan={5}>Loading connected S3 buckets...</td>
                  </tr>
                ) : null}
                {!s3ConnectionsLoading && s3Connections.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-sm text-text-secondary" colSpan={5}>No connected S3 buckets found.</td>
                  </tr>
                ) : null}
                {!s3ConnectionsLoading ? paginatedS3Connections.map((connection) => (
                  <tr key={connection.id} className="border-b border-[color:var(--border-light)] last:border-b-0">
                    <td className="px-3 py-4 text-sm text-text-primary">{connection.bucket}</td>
                    <td className="px-3 py-4 text-sm text-text-secondary">{connection.basePrefix || "/"}</td>
                    <td className="px-3 py-4 text-sm text-text-secondary">{connection.awsAccountId || "-"}</td>
                    <td className="px-3 py-4 text-sm text-text-secondary">{connection.resolvedRegion || "-"}</td>
                    <td className="px-3 py-4 text-sm text-text-secondary">{formatDateTime(connection.lastValidatedAt)}</td>
                  </tr>
                )) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeConnectionsTab === "s3" && !s3ConnectionsLoading && s3Connections.length > 0 ? (
        <TablePagination
          currentPage={s3CurrentPage}
          totalPages={s3TotalPages}
          totalItems={s3Connections.length}
          pageSize={S3_PAGE_SIZE}
          onPrevious={() => setS3Page((previous) => Math.max(1, previous - 1))}
          onNext={() => setS3Page((previous) => Math.min(s3TotalPages, previous + 1))}
        />
      ) : null}

      {activeConnectionsTab === "cloud" && dashboardActionError ? <p className="mt-3 text-sm text-rose-600">{dashboardActionError}</p> : null}
      {activeConnectionsTab === "s3" && s3ConnectionsError ? <p className="mt-3 text-sm text-rose-600">{s3ConnectionsError}</p> : null}

      <Dialog open={isAddConnectionPanelOpen} onOpenChange={handlePanelOpenChange}>
        <DialogContent className="w-[min(90vw,900px)] max-w-none rounded-none border border-[color:var(--border-light)] p-0">
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
                  className={`relative flex h-[210px] flex-col items-center justify-center rounded-none border px-4 py-5 text-center transition-colors ${
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

      <Dialog
        open={isConnectS3DialogOpen}
        onOpenChange={(open) => {
          setIsConnectS3DialogOpen(open)
          if (!open) resetConnectS3Form()
        }}
      >
        <DialogContent className="max-w-3xl rounded-none">
          <DialogHeader>
            <DialogTitle>Connect S3</DialogTitle>
            <DialogDescription>Validate access and save this S3 bucket connection for future imports.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Role ARN</span>
              <input
                type="text"
                className="h-10 w-full rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent px-0 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
                placeholder="arn:aws:iam::123456789012:role/kcx-billing-read-role"
                value={s3RoleArn}
                onChange={(event) => setS3RoleArn(event.target.value)}
                disabled={connectingS3}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Bucket Name</span>
              <input
                type="text"
                className="h-10 w-full rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent px-0 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
                placeholder="my-billing-exports"
                value={s3BucketName}
                onChange={(event) => setS3BucketName(event.target.value)}
                disabled={connectingS3}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Prefix</span>
              <input
                type="text"
                className="h-10 w-full rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent px-0 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
                placeholder="billing/exports/2026/"
                value={s3Prefix}
                onChange={(event) => setS3Prefix(event.target.value)}
                disabled={connectingS3}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">External ID (Optional)</span>
              <input
                type="text"
                className="h-10 w-full rounded-none border-0 border-b border-[color:var(--border-light)] bg-transparent px-0 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
                placeholder="kcx-external-id"
                value={s3ExternalId}
                onChange={(event) => setS3ExternalId(event.target.value)}
                disabled={connectingS3}
              />
            </label>

            {connectS3Error ? <p className="text-sm text-rose-600">{connectS3Error}</p> : null}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-none"
                onClick={() => setIsConnectS3DialogOpen(false)}
                disabled={connectingS3}
              >
                Cancel
              </Button>
              <Button className="h-10 rounded-none" onClick={() => void handleConnectS3()} disabled={connectingS3}>
                {connectingS3 ? "Validating..." : "Validate Access"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
