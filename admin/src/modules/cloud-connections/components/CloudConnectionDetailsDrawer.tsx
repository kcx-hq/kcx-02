import * as Dialog from "@radix-ui/react-dialog"
import { AlertTriangle, X } from "lucide-react"

import type { AdminCloudConnectionDetailData } from "@/modules/cloud-connections/admin-cloud-connections.api"
import {
  formatBoolean,
  formatCompactDateTime,
  formatModeLabel,
  formatStatusLabel,
  formatValue,
  getStatusBadge,
} from "@/modules/cloud-connections/cloud-connections.formatters"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 text-sm">
      <div className="text-[color:rgba(15,23,42,0.60)]">{label}</div>
      <div className="break-all whitespace-pre-wrap text-[color:rgba(15,23,42,0.88)]">{value}</div>
    </div>
  )
}

type CloudConnectionDetailsDrawerProps = {
  open: boolean
  selectedIntegrationId: string | null
  loading: boolean
  error: string | null
  data: AdminCloudConnectionDetailData | null
  onOpenChange: (open: boolean) => void
  onRetry: () => void
}

export function CloudConnectionDetailsDrawer({
  open,
  selectedIntegrationId,
  loading,
  error,
  data,
  onOpenChange,
  onRetry,
}: CloudConnectionDetailsDrawerProps) {
  const integrationStatus = data ? getStatusBadge(data.integration.status) : null
  const integrationSetupAt = data?.integration.timestamps.connectedAt ?? data?.integration.timestamps.createdAt ?? null
  const integrationLastHealthAt =
    data?.integration.timestamps.lastSuccessAt ??
    data?.integration.timestamps.lastValidatedAt ??
    data?.integration.timestamps.lastCheckedAt ??
    null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-[900px] overflow-y-auto bg-white p-5 shadow-[-18px_0_48px_-30px_rgba(15,23,42,0.55)] outline-none sm:p-6">
          <div className="sticky top-0 z-10 mb-4 flex items-start justify-between gap-3 border-b border-[color:rgba(15,23,42,0.08)] bg-white pb-4">
            <div>
              <Dialog.Title className="text-lg font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">
                Cloud Connection Details
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Integration ID: {selectedIntegrationId ?? "-"}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" aria-label="Close details">
                <X className="h-5 w-5" />
              </Button>
            </Dialog.Close>
          </div>

          {loading ? (
            <div className="rounded-xl border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(15,23,42,0.02)] px-4 py-3 text-sm text-muted-foreground">
              Loading details...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[color:rgba(15,23,42,0.86)]">
              <div>{error}</div>
              {selectedIntegrationId ? (
                <Button className="mt-3" size="sm" variant="secondary" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
            </div>
          ) : data ? (
            <div className="space-y-5 pb-6">
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">A. Integration Overview</div>
                  <DetailRow label="Display Name" value={data.integration.displayName} />
                  <DetailRow label="Client" value={`${data.tenant.name} (${data.tenant.slug})`} />
                  <DetailRow label="Provider" value={`${data.provider.name} (${data.provider.code})`} />
                  <DetailRow label="Mode" value={formatModeLabel(data.integration.mode)} />
                  <div className="grid grid-cols-[180px_1fr] gap-3 text-sm">
                    <div className="text-[color:rgba(15,23,42,0.60)]">Status</div>
                    <div className="flex items-center gap-2">
                      <Badge variant={integrationStatus?.variant} className={integrationStatus?.className}>
                        {formatStatusLabel(data.integration.status)}
                      </Badge>
                      <span className="text-xs text-[color:rgba(15,23,42,0.55)]">{data.integration.status}</span>
                    </div>
                  </div>
                  <DetailRow label="Status Message" value={formatValue(data.integration.statusMessage)} />
                  <DetailRow label="Error Message" value={formatValue(data.integration.errorMessage)} />
                  <DetailRow label="Cloud Account ID" value={formatValue(data.integration.cloudAccountId)} />
                  <DetailRow label="Payer Account ID" value={formatValue(data.integration.payerAccountId)} />
                  <DetailRow label="Connected At" value={formatCompactDateTime(integrationSetupAt)} />
                  <DetailRow label="Last Health Activity" value={formatCompactDateTime(integrationLastHealthAt)} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">B. Connection Detail</div>

                  {data.connectionDetail === null ? (
                    <div className="rounded-xl border border-[color:rgba(217,119,6,0.26)] bg-[color:rgba(217,119,6,0.10)] px-4 py-3 text-sm text-[color:rgba(146,64,14,0.98)]">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4" />
                        <div>
                          <div className="font-semibold">Detail record missing</div>
                          <div className="mt-1">
                            Integration exists, but linked detail record could not be resolved.
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : data.connectionDetail.kind === "automatic" ? (
                    <div className="space-y-3">
                      <DetailRow label="Kind" value="Automatic" />
                      <DetailRow label="Connection Name" value={data.connectionDetail.connectionName} />
                      <DetailRow label="Account Type" value={data.connectionDetail.accountType} />
                      <DetailRow label="Region" value={formatValue(data.connectionDetail.region)} />
                      <DetailRow label="External ID" value={formatValue(data.connectionDetail.externalId)} />
                      <DetailRow label="Callback Token" value={formatValue(data.connectionDetail.callbackToken)} />
                      <DetailRow label="Stack Name" value={formatValue(data.connectionDetail.stackName)} />
                      <DetailRow label="Stack ID" value={formatValue(data.connectionDetail.stackId)} />
                      <DetailRow label="Role ARN" value={formatValue(data.connectionDetail.roleArn)} />
                      <DetailRow label="Cloud Account ID" value={formatValue(data.connectionDetail.cloudAccountId)} />
                      <DetailRow label="Payer Account ID" value={formatValue(data.connectionDetail.payerAccountId)} />
                      <DetailRow label="Export Name" value={formatValue(data.connectionDetail.export.name)} />
                      <DetailRow label="Export Bucket" value={formatValue(data.connectionDetail.export.bucket)} />
                      <DetailRow label="Export Prefix" value={formatValue(data.connectionDetail.export.prefix)} />
                      <DetailRow label="Export Region" value={formatValue(data.connectionDetail.export.region)} />
                      <DetailRow label="Export ARN" value={formatValue(data.connectionDetail.export.arn)} />
                      <DetailRow label="Connected At" value={formatCompactDateTime(data.connectionDetail.connectedAt)} />
                      <DetailRow label="Last Validated At" value={formatCompactDateTime(data.connectionDetail.lastValidatedAt)} />
                      <DetailRow label="Error Message" value={formatValue(data.connectionDetail.errorMessage)} />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <DetailRow label="Kind" value="Manual" />
                      <DetailRow label="Connection Name" value={data.connectionDetail.connectionName} />
                      <DetailRow label="AWS Account ID" value={data.connectionDetail.awsAccountId} />
                      <DetailRow label="Role ARN" value={data.connectionDetail.roleArn} />
                      <DetailRow label="External ID" value={data.connectionDetail.externalId} />
                      <DetailRow label="Bucket Name" value={data.connectionDetail.bucketName} />
                      <DetailRow label="Prefix" value={formatValue(data.connectionDetail.prefix)} />
                      <DetailRow label="Report Name" value={formatValue(data.connectionDetail.reportName)} />
                      <DetailRow label="Validation Status" value={data.connectionDetail.validationStatus} />
                      <DetailRow label="Assume Role Success" value={formatBoolean(data.connectionDetail.assumeRoleSuccess)} />
                      <DetailRow label="Status" value={data.connectionDetail.status} />
                      <DetailRow label="Created At" value={formatCompactDateTime(data.connectionDetail.createdAt)} />
                      <DetailRow label="Last Validated At" value={formatCompactDateTime(data.connectionDetail.lastValidatedAt)} />
                      <DetailRow label="Error Message" value={formatValue(data.connectionDetail.errorMessage)} />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">C. Billing Source</div>
                  {!data.billingSource.linked ? (
                    <div className="rounded-xl border border-[color:rgba(220,38,38,0.22)] bg-[color:rgba(220,38,38,0.07)] px-4 py-3 text-sm text-[color:rgba(153,27,27,0.95)]">
                      No linked billing source found.
                    </div>
                  ) : null}
                  <DetailRow label="Linked" value={formatBoolean(data.billingSource.linked)} />
                  <DetailRow label="Source ID" value={formatValue(data.billingSource.id)} />
                  <DetailRow label="Source Name" value={formatValue(data.billingSource.sourceName)} />
                  <DetailRow label="Source Type" value={formatValue(data.billingSource.sourceType)} />
                  <DetailRow label="Setup Mode" value={formatValue(data.billingSource.setupMode)} />
                  <DetailRow label="Format" value={formatValue(data.billingSource.format)} />
                  <DetailRow label="Schema Type" value={formatValue(data.billingSource.schemaType)} />
                  <DetailRow label="Bucket Name" value={formatValue(data.billingSource.bucketName)} />
                  <DetailRow label="Path Prefix" value={formatValue(data.billingSource.pathPrefix)} />
                  <DetailRow label="File Pattern" value={formatValue(data.billingSource.filePattern)} />
                  <DetailRow label="Cadence" value={formatValue(data.billingSource.cadence)} />
                  <DetailRow label="Status" value={formatValue(data.billingSource.status)} />
                  <DetailRow label="Temporary" value={formatBoolean(data.billingSource.isTemporary)} />
                  <DetailRow label="Last File Received" value={formatCompactDateTime(data.billingSource.lastFileReceivedAt)} />
                  <DetailRow label="Last Ingested" value={formatCompactDateTime(data.billingSource.lastIngestedAt)} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">D. Latest Ingestion Context</div>
                  {!data.latestIngestion.hasData ? (
                    <div className="rounded-xl border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(15,23,42,0.02)] px-4 py-3 text-sm text-muted-foreground">
                      No ingestion context available for this integration.
                    </div>
                  ) : null}
                  <DetailRow label="Has Data" value={formatBoolean(data.latestIngestion.hasData)} />
                  <DetailRow label="Latest Run ID" value={formatValue(data.latestIngestion.latestRun?.id)} />
                  <DetailRow label="Run Status" value={formatValue(data.latestIngestion.latestRun?.status)} />
                  <DetailRow label="Current Step" value={formatValue(data.latestIngestion.latestRun?.currentStep)} />
                  <DetailRow label="Progress %" value={formatValue(data.latestIngestion.latestRun?.progressPercent)} />
                  <DetailRow label="Rows Read" value={formatValue(data.latestIngestion.latestRun?.rowsRead)} />
                  <DetailRow label="Rows Loaded" value={formatValue(data.latestIngestion.latestRun?.rowsLoaded)} />
                  <DetailRow label="Rows Failed" value={formatValue(data.latestIngestion.latestRun?.rowsFailed)} />
                  <DetailRow
                    label="Last Processed At"
                    value={formatCompactDateTime(
                      data.latestIngestion.latestRun?.finishedAt ?? data.latestIngestion.latestRun?.updatedAt ?? null,
                    )}
                  />
                  <DetailRow
                    label="Latest Raw File"
                    value={formatValue(data.latestIngestion.latestRawFile?.originalFileName)}
                  />
                  <DetailRow label="Raw File Format" value={formatValue(data.latestIngestion.latestRawFile?.fileFormat)} />
                  <DetailRow label="Raw File Status" value={formatValue(data.latestIngestion.latestRawFile?.status)} />
                  <DetailRow
                    label="Raw Storage Bucket"
                    value={formatValue(data.latestIngestion.latestRawFile?.rawStorageBucket)}
                  />
                  <DetailRow label="Raw Storage Key" value={formatValue(data.latestIngestion.latestRawFile?.rawStorageKey)} />
                  <DetailRow
                    label="Last Data Arrival"
                    value={formatCompactDateTime(data.latestIngestion.latestRawFile?.createdAt ?? null)}
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="rounded-xl border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(15,23,42,0.02)] px-4 py-3 text-sm text-muted-foreground">
              Select an integration from the table to view details.
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
