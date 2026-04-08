import { Search, Upload, ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { CloudIntegrationOverviewRow } from "./billingHelpers"

type BillingHubSectionProps = {
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
  onOpenLocalUploadModal: () => void
  onOpenS3UploadModal: () => void
  onOpenUploadHistory: () => void
}

export function BillingHubSection({
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
  onOpenLocalUploadModal,
  onOpenS3UploadModal,
  onOpenUploadHistory,
}: BillingHubSectionProps) {
  const activeCount = cloudOverviewRows.filter((row) => row.statusLabel === "HEALTHY").length
  const pendingCount = cloudOverviewRows.filter((row) => row.statusLabel === "PENDING" || row.statusLabel === "CONNECTING").length

  return (
    <section aria-label="Billing ingestion and connections" className="space-y-8">
      <div className="border-b border-[color:var(--border-light)]" />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Add Data</h2>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <article className="rounded-xl border border-[color:var(--border-light)] bg-white p-6 shadow-sm-custom">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-xl border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-brand-primary">
                <Upload className="h-8 w-8" />
              </span>
              <div className="space-y-1">
                <h3 className="text-2xl font-semibold tracking-tight text-text-primary">Upload from Local</h3>
                <p className="text-sm text-text-secondary">Upload files from your computer</p>
              </div>
            </div>
            <div className="mt-5 border-t border-[color:var(--border-light)] pt-4">
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  className="h-10 rounded-xl border-[color:var(--border-light)] px-6 text-base font-medium"
                  onClick={onOpenUploadHistory}
                >
                  History
                </Button>
                <Button
                  variant="outline"
                  className="h-10 rounded-xl border-[color:var(--border-light)] px-6 text-base font-medium"
                  onClick={onOpenLocalUploadModal}
                >
                  Upload
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-[color:var(--border-light)] bg-white p-6 shadow-sm-custom">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-xl border border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] text-brand-primary">
                <img src="/aws.svg" alt="S3 import" className="h-10 w-10 object-contain" />
              </span>
              <div className="space-y-1">
                <h3 className="text-2xl font-semibold tracking-tight text-text-primary">Import from S3</h3>
                <p className="text-sm text-text-secondary">Connect and sync your S3 bucket</p>
              </div>
            </div>
            <div className="mt-5 border-t border-[color:var(--border-light)] pt-4">
              <div className="flex justify-end">
                <Button className="h-10 rounded-xl px-6 text-base font-medium" onClick={onOpenS3UploadModal}>
                  Connect
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <h3 className="text-2xl font-semibold tracking-tight text-text-primary">Connected Sources</h3>
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

          <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-sm">
            <thead className="bg-[color:var(--bg-surface)]">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                <th className="border-b border-[color:var(--border-light)] px-4 py-3">Connection Name</th>
                <th className="border-b border-[color:var(--border-light)] px-4 py-3">Provider</th>
                <th className="border-b border-[color:var(--border-light)] px-4 py-3">Account</th>
                <th className="border-b border-[color:var(--border-light)] px-4 py-3">Last Checked</th>
                <th className="border-b border-[color:var(--border-light)] px-4 py-3">Last Ingest / Status Message</th>
                <th className="border-b border-[color:var(--border-light)] px-4 py-3">Status</th>
                <th className="border-b border-[color:var(--border-light)] px-4 py-3 text-right">Action</th>
              </tr>
            </thead>

            {isCloudIntegrationsLoading ? (
              <tbody>
                <tr>
                  <td className="px-4 py-6 text-text-secondary" colSpan={7}>Loading cloud connections...</td>
                </tr>
              </tbody>
            ) : isCloudIntegrationsError ? (
              <tbody>
                <tr>
                  <td className="px-4 py-6" colSpan={7}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-rose-600">{cloudIntegrationsErrorMessage}</span>
                      <Button variant="outline" size="sm" className="h-8 rounded-md" onClick={onRetryCloudIntegrations}>
                        Retry
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : filteredCloudOverviewRows.length === 0 ? (
              <tbody>
                <tr>
                  <td className="px-4 py-6 text-text-secondary" colSpan={7}>
                    {cloudOverviewRows.length === 0
                      ? "No cloud connections found. Connect AWS to create your first billing integration."
                      : "No cloud connections match your search."}
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {filteredCloudOverviewRows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-[color:var(--bg-surface)]">
                    <td className="border-b border-[color:var(--border-light)] px-4 py-4">
                      <span className="font-medium text-brand-primary">{row.connectionName}</span>
                    </td>
                    <td className="border-b border-[color:var(--border-light)] px-4 py-4 text-text-primary">{row.provider}</td>
                    <td className="border-b border-[color:var(--border-light)] px-4 py-4 text-text-primary">{row.cloudAccountId || "-"}</td>
                    <td className="border-b border-[color:var(--border-light)] px-4 py-4 text-text-primary">{row.lastChecked}</td>
                    <td className="border-b border-[color:var(--border-light)] px-4 py-4 text-text-primary">{row.lastIngestOrMessage}</td>
                    <td className="border-b border-[color:var(--border-light)] px-4 py-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-3 py-1 text-sm",
                          row.statusLabel === "HEALTHY"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : row.statusLabel === "WARNING"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : row.statusLabel === "FAILED"
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary",
                        )}
                      >
                        {row.statusLabel}
                      </Badge>
                    </td>
                    <td className="border-b border-[color:var(--border-light)] px-4 py-4 text-right">
                      <Button
                        variant="outline"
                        className="h-10 rounded-xl border-[color:var(--border-light)] px-5 text-sm"
                        disabled={dashboardActionLoading}
                        onClick={() => onOpenCloudConnectionDashboard(row.id)}
                      >
                        {dashboardConnectionActionId === row.id ? "Opening..." : "View"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        {dashboardActionError ? <p className="text-sm text-rose-600">{dashboardActionError}</p> : null}
      </section>
    </section>
  )
}
