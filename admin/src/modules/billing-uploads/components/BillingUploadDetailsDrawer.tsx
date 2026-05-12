import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import type { BillingUploadDetailsResponse } from "@/modules/billing-uploads/admin-billing-uploads.api"
import {
  formatBoolean,
  formatCompactDateTime,
  formatFileSize,
  formatValue,
} from "@/modules/billing-uploads/billing-uploads.formatters"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <div className="text-[color:rgba(15,23,42,0.60)]">{label}</div>
      <div className="break-all text-[color:rgba(15,23,42,0.88)]">{value}</div>
    </div>
  )
}

type BillingUploadDetailsDrawerProps = {
  open: boolean
  selectedRunId: number | null
  loading: boolean
  error: string | null
  data: BillingUploadDetailsResponse | null
  onOpenChange: (open: boolean) => void
  onRetry: () => void
}

export function BillingUploadDetailsDrawer({
  open,
  selectedRunId,
  loading,
  error,
  data,
  onOpenChange,
  onRetry,
}: BillingUploadDetailsDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-[820px] overflow-y-auto bg-white p-5 shadow-[-18px_0_48px_-30px_rgba(15,23,42,0.55)] outline-none sm:p-6">
          <div className="sticky top-0 z-10 mb-4 flex items-start justify-between gap-3 border-b border-[color:rgba(15,23,42,0.08)] bg-white pb-4">
            <div>
              <Dialog.Title className="text-lg font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">
                Billing Upload Details
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Run #{selectedRunId ?? "-"} operational details
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
              {selectedRunId ? (
                <Button className="mt-3" size="sm" variant="secondary" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
            </div>
          ) : data ? (
            <div className="space-y-5 pb-6">
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">A. Run Overview</div>
                  <DetailRow label="Run ID" value={String(data.runOverview.runId)} />
                  <DetailRow label="Status" value={`${data.runOverview.status.label} (${data.runOverview.status.raw})`} />
                  <DetailRow label="Current Step" value={formatValue(data.runOverview.currentStep)} />
                  <DetailRow label="Progress %" value={String(data.runOverview.progressPercent)} />
                  <DetailRow label="Status Message" value={formatValue(data.runOverview.statusMessage)} />
                  <DetailRow label="Started At" value={formatCompactDateTime(data.runOverview.startedAt)} />
                  <DetailRow label="Finished At" value={formatCompactDateTime(data.runOverview.finishedAt)} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">B. Client</div>
                  <DetailRow label="Client Name" value={data.client.name} />
                  <DetailRow label="Client ID" value={data.client.id} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">C. Source Context</div>
                  <DetailRow label="Billing Source ID" value={String(data.sourceContext.billingSourceId)} />
                  <DetailRow label="Source Name" value={data.sourceContext.sourceName} />
                  <DetailRow label="Source Type" value={data.sourceContext.sourceType} />
                  <DetailRow label="Setup Mode" value={data.sourceContext.setupMode} />
                  <DetailRow label="Temporary" value={formatBoolean(data.sourceContext.isTemporary)} />
                  <DetailRow label="Source Status" value={data.sourceContext.sourceStatus} />
                  <DetailRow
                    label="Cloud Provider"
                    value={`${data.sourceContext.cloudProvider.name} (${data.sourceContext.cloudProvider.code})`}
                  />
                  <DetailRow label="Cloud Connection ID" value={formatValue(data.sourceContext.cloudConnectionId)} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">D. File Context</div>
                  <DetailRow label="Raw Billing File ID" value={String(data.fileContext.rawBillingFileId)} />
                  <DetailRow label="Original File Name" value={data.fileContext.originalFileName} />
                  <DetailRow label="Original File Path" value={formatValue(data.fileContext.originalFilePath)} />
                  <DetailRow label="File Format" value={data.fileContext.fileFormat} />
                  <DetailRow label="File Size" value={formatFileSize(data.fileContext.fileSizeBytes)} />
                  <DetailRow label="Checksum" value={formatValue(data.fileContext.checksum)} />
                  <DetailRow label="Uploaded At" value={formatCompactDateTime(data.fileContext.uploadedAt)} />
                  <DetailRow
                    label="Uploaded By"
                    value={
                      data.fileContext.uploadedBy
                        ? `${data.fileContext.uploadedBy.fullName} (${data.fileContext.uploadedBy.email})`
                        : "-"
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">E. Raw Storage Context</div>
                  <DetailRow label="Bucket" value={formatValue(data.rawStorageContext.bucket)} />
                  <DetailRow label="Key" value={formatValue(data.rawStorageContext.key)} />
                  <DetailRow label="Status" value={formatValue(data.rawStorageContext.status)} />
                  <DetailRow label="Persisted to Raw Storage" value={formatBoolean(data.rawStorageContext.persistedToRawStorage)} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">F. Processing Metrics</div>
                  <DetailRow label="Rows Read" value={String(data.processingMetrics.rowsRead)} />
                  <DetailRow label="Rows Loaded" value={String(data.processingMetrics.rowsLoaded)} />
                  <DetailRow label="Rows Failed" value={String(data.processingMetrics.rowsFailed)} />
                  <DetailRow label="Total Rows Estimated" value={formatValue(data.processingMetrics.totalRowsEstimated)} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">G. Failure Details</div>
                  <DetailRow label="Error Message" value={formatValue(data.failureDetails.errorMessage)} />
                  <DetailRow label="Row Error Count" value={String(data.failureDetails.rowErrorCount)} />

                  <div className="kcx-admin-table-scroll mt-2 overflow-x-auto rounded-xl ring-1 ring-[color:rgba(15,23,42,0.08)]">
                    <table className="min-w-[620px] w-full border-separate border-spacing-0 text-sm">
                      <thead className="bg-white">
                        <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
                          <th className="px-3 py-2.5">ID</th>
                          <th className="px-3 py-2.5">Row</th>
                          <th className="px-3 py-2.5">Code</th>
                          <th className="px-3 py-2.5">Error</th>
                          <th className="px-3 py-2.5">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.failureDetails.sampleRowErrors.length === 0 ? (
                          <tr>
                            <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                              No sample row errors.
                            </td>
                          </tr>
                        ) : (
                          data.failureDetails.sampleRowErrors.map((item) => (
                            <tr key={item.id} className="border-t border-[color:rgba(15,23,42,0.06)]">
                              <td className="px-3 py-2.5">{item.id}</td>
                              <td className="px-3 py-2.5">{formatValue(item.rowNumber)}</td>
                              <td className="px-3 py-2.5">{formatValue(item.errorCode)}</td>
                              <td className="px-3 py-2.5">{item.errorMessage}</td>
                              <td className="px-3 py-2.5">{formatCompactDateTime(item.createdAt)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">H. Related Files</div>
                  <div className="kcx-admin-table-scroll overflow-x-auto rounded-xl ring-1 ring-[color:rgba(15,23,42,0.08)]">
                    <table className="min-w-[620px] w-full border-separate border-spacing-0 text-sm">
                      <thead className="bg-white">
                        <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.55)]">
                          <th className="px-3 py-2.5">Raw Billing File ID</th>
                          <th className="px-3 py-2.5">File Role</th>
                          <th className="px-3 py-2.5">Processing Order</th>
                          <th className="px-3 py-2.5">Original File Name</th>
                          <th className="px-3 py-2.5">File Format</th>
                          <th className="px-3 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.relatedFiles.length === 0 ? (
                          <tr>
                            <td className="px-3 py-3 text-muted-foreground" colSpan={6}>
                              No related files.
                            </td>
                          </tr>
                        ) : (
                          data.relatedFiles.map((item) => (
                            <tr
                              key={`${item.rawBillingFileId}-${item.processingOrder}`}
                              className="border-t border-[color:rgba(15,23,42,0.06)]"
                            >
                              <td className="px-3 py-2.5">{item.rawBillingFileId}</td>
                              <td className="px-3 py-2.5">{item.fileRole}</td>
                              <td className="px-3 py-2.5">{item.processingOrder}</td>
                              <td className="px-3 py-2.5">{item.originalFileName}</td>
                              <td className="px-3 py-2.5">{item.fileFormat}</td>
                              <td className="px-3 py-2.5">{item.status}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="rounded-xl border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(15,23,42,0.02)] px-4 py-3 text-sm text-muted-foreground">
              Select a run from the table to view details.
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
